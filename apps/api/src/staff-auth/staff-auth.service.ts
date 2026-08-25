import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { MembershipStatus, Prisma, RoleKind } from "@prisma/client";
import argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";

import { PrismaService } from "../prisma/prisma.service";
import type { StaffRequestContext } from "../tenant/tenant-context.service";
import { ChangeStaffPasswordDto } from "./dto/change-staff-password.dto";
import { CreateStaffMemberDto } from "./dto/create-staff-member.dto";
import { LoginStaffDto } from "./dto/login-staff.dto";
import { UpdateStaffMemberDto } from "./dto/update-staff-member.dto";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const STAFF_SESSION_COOKIE = "payveo_staff_session";

const memberInclude = {
  user: { select: { id: true, email: true, displayName: true, isActive: true, passwordMustChange: true } },
  tenant: { select: { id: true, name: true, slug: true } },
  roleAssignments: {
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  },
  teamMemberships: { include: { team: { select: { id: true, name: true } } } },
} satisfies Prisma.TenantMembershipInclude;

@Injectable()
export class StaffAuthService {
  private dummyPasswordHash: string | undefined;

  constructor(private readonly prisma: PrismaService) {}

  async login(dto: LoginStaffDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email }, include: { memberships: { where: { status: MembershipStatus.ACTIVE, deletedAt: null, tenant: { isActive: true, deletedAt: null } }, include: memberInclude } } });
    const passwordHash = user?.passwordHash ?? (await this.getDummyPasswordHash());
    const matches = await argon2.verify(passwordHash, dto.password).catch(() => false);
    const memberships = user?.isActive && !user.deletedAt && matches ? user.memberships : [];
    if (!user || !user.isActive || user.deletedAt || !user.passwordHash || !matches || !memberships.length) {
      throw new UnauthorizedException("Anmeldedaten ungültig.");
    }
    if (memberships.length > 1 && !dto.membershipId) {
      return { requiresTenantSelection: true as const, memberships: memberships.map((membership) => this.membershipChoice(membership)) };
    }
    const membership = dto.membershipId ? memberships.find((item) => item.id === dto.membershipId) : memberships[0];
    if (!membership) throw new UnauthorizedException("Anmeldedaten ungültig.");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    const token = randomBytes(32).toString("base64url");
    await this.prisma.staffSession.create({ data: { userId: user.id, tenantId: membership.tenantId, tenantMembershipId: membership.id, tokenHash: this.hashSecret(token), expiresAt, lastSeenAt: now } });
    return { requiresTenantSelection: false as const, token, expiresAt, session: this.serializeMembership(membership) };
  }

  async requireSession(token: string | undefined): Promise<StaffRequestContext> {
    if (!token) throw new UnauthorizedException("Mitarbeiter-Anmeldung erforderlich.");
    const now = new Date();
    const session = await this.prisma.staffSession.findFirst({
      where: {
        tokenHash: this.hashSecret(token), revokedAt: null, expiresAt: { gt: now },
        user: { isActive: true, deletedAt: null },
        membership: { status: MembershipStatus.ACTIVE, deletedAt: null, tenant: { isActive: true, deletedAt: null } },
      },
      include: { membership: { include: memberInclude } },
    });
    if (!session) throw new UnauthorizedException("Mitarbeiter-Anmeldung erforderlich.");
    await this.prisma.staffSession.update({ where: { id: session.id }, data: { lastSeenAt: now } });
    const value = this.serializeMembership(session.membership);
    return { userId: session.userId, tenantId: session.tenantId, tenantMembershipId: session.tenantMembershipId, permissions: value.permissions, roles: value.roles, passwordMustChange: value.passwordMustChange };
  }

  async logout(token: string | undefined) {
    if (!token) return;
    await this.prisma.staffSession.updateMany({ where: { tokenHash: this.hashSecret(token), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async changePassword(context: StaffRequestContext, token: string | undefined, dto: ChangeStaffPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: context.userId } });
    const valid = user?.passwordHash && (await argon2.verify(user.passwordHash, dto.currentPassword).catch(() => false));
    if (!user || !valid) throw new UnauthorizedException("Anmeldedaten ungültig.");
    if (dto.currentPassword === dto.newPassword) throw new BadRequestException("Das neue Passwort muss sich unterscheiden.");
    const tokenHash = token ? this.hashSecret(token) : undefined;
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await this.hashPassword(dto.newPassword), passwordMustChange: false } }),
      this.prisma.staffSession.updateMany({ where: { userId: user.id, revokedAt: null, ...(tokenHash ? { tokenHash: { not: tokenHash } } : {}) }, data: { revokedAt: new Date() } }),
    ]);
  }

  async session(context: StaffRequestContext) {
    const membership = await this.prisma.tenantMembership.findFirst({ where: { id: context.tenantMembershipId, tenantId: context.tenantId }, include: memberInclude });
    if (!membership) throw new UnauthorizedException("Mitarbeiter-Anmeldung erforderlich.");
    return { authenticated: true, ...this.serializeMembership(membership) };
  }

  async activeMembers(context: StaffRequestContext) {
    this.requireAnyPermission(context, ["member:read", "case:assign"]);
    const memberships = await this.prisma.tenantMembership.findMany({ where: { tenantId: context.tenantId, status: MembershipStatus.ACTIVE, deletedAt: null, user: { isActive: true, deletedAt: null } }, include: memberInclude, orderBy: { createdAt: "asc" } });
    return memberships.map((membership) => ({ membershipId: membership.id, displayName: membership.user.displayName ?? membership.user.email, email: membership.user.email, roles: membership.roleAssignments.map((assignment) => assignment.role.name) }));
  }

  async listMembers(context: StaffRequestContext) {
    this.requirePermission(context, "member:read");
    const memberships = await this.prisma.tenantMembership.findMany({ where: { tenantId: context.tenantId, deletedAt: null }, include: memberInclude, orderBy: { createdAt: "asc" } });
    return memberships.map((membership) => this.serializeMembership(membership));
  }

  async listRoles(context: StaffRequestContext) {
    this.requirePermission(context, "member:assign_role");
    return this.prisma.role.findMany({
      where: { tenantId: context.tenantId, deletedAt: null },
      select: { id: true, name: true, description: true },
      orderBy: { name: "asc" },
    });
  }

  async createMember(context: StaffRequestContext, dto: CreateStaffMemberDto) {
    this.requirePermission(context, "member:invite");
    const email = dto.email.trim().toLowerCase();
    const roles = await this.rolesForTenant(context.tenantId, dto.roleIds ?? []);
    const existingUser = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) throw new ConflictException("Für diese E-Mail-Adresse existiert bereits ein Benutzer.");
    const user = await this.prisma.user.create({ data: { email, displayName: dto.displayName.trim(), passwordHash: await this.hashPassword(dto.initialPassword), passwordMustChange: true } });
    const membership = await this.prisma.tenantMembership.create({ data: { tenantId: context.tenantId, userId: user.id, status: MembershipStatus.ACTIVE } });
    await this.prisma.$transaction([
      this.prisma.membershipRole.deleteMany({ where: { membershipId: membership.id } }),
      ...(roles.length ? [this.prisma.membershipRole.createMany({ data: roles.map((role) => ({ membershipId: membership.id, roleId: role.id })) })] : []),
    ]);
    const result = await this.prisma.tenantMembership.findUniqueOrThrow({ where: { id: membership.id }, include: memberInclude });
    return this.serializeMembership(result);
  }

  async updateMember(context: StaffRequestContext, membershipId: string, dto: UpdateStaffMemberDto) {
    this.requirePermission(context, dto.roleIds ? "member:assign_role" : "member:update");
    const membership = await this.prisma.tenantMembership.findFirst({ where: { id: membershipId, tenantId: context.tenantId, deletedAt: null } });
    if (!membership) throw new NotFoundException("Mitglied wurde nicht gefunden.");
    const roles = dto.roleIds ? await this.rolesForTenant(context.tenantId, dto.roleIds) : undefined;
    await this.prisma.$transaction(async (tx) => {
      await this.assertTenantOwnerRemains(
        tx,
        context.tenantId,
        membership,
        dto.status,
        roles?.map((role) => role.id),
      );
      if (dto.status) await tx.tenantMembership.update({ where: { id: membership.id }, data: { status: dto.status } });
      if (roles) {
        await tx.membershipRole.deleteMany({ where: { membershipId: membership.id } });
        if (roles.length) await tx.membershipRole.createMany({ data: roles.map((role) => ({ membershipId: membership.id, roleId: role.id })) });
      }
      if (dto.status === MembershipStatus.SUSPENDED || dto.status === MembershipStatus.REMOVED) await tx.staffSession.updateMany({ where: { tenantMembershipId: membership.id, revokedAt: null }, data: { revokedAt: new Date() } });
    });
    const result = await this.prisma.tenantMembership.findUniqueOrThrow({ where: { id: membership.id }, include: memberInclude });
    return this.serializeMembership(result);
  }

  requirePermission(context: StaffRequestContext, permission: string) {
    if (!context.permissions.includes(permission)) throw new ForbiddenException("Berechtigung erforderlich.");
  }

  requireAnyPermission(context: StaffRequestContext, permissions: string[]) {
    if (!permissions.some((permission) => context.permissions.includes(permission))) {
      throw new ForbiddenException("Berechtigung erforderlich.");
    }
  }

  sessionCookieOptions(expiresAt?: Date) { return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", ...(expiresAt ? { expires: expiresAt } : { maxAge: 0 }) }; }

  private serializeMembership(membership: Prisma.TenantMembershipGetPayload<{ include: typeof memberInclude }>) {
    const permissions = Array.from(new Set(membership.roleAssignments.flatMap((assignment) => assignment.role.permissions.map((rolePermission) => `${rolePermission.permission.resource}:${rolePermission.permission.action}`))));
    return { user: membership.user, membership: { id: membership.id, status: membership.status, createdAt: membership.createdAt }, tenant: membership.tenant, roles: membership.roleAssignments.map((assignment) => assignment.role.name), permissions, teams: membership.teamMemberships.map((teamMembership) => ({ id: teamMembership.team.id, name: teamMembership.team.name })), passwordMustChange: membership.user.passwordMustChange };
  }

  private membershipChoice(membership: Prisma.TenantMembershipGetPayload<{ include: typeof memberInclude }>) { const value = this.serializeMembership(membership); return { membershipId: membership.id, tenant: value.tenant, roles: value.roles }; }
  private async rolesForTenant(tenantId: string, roleIds: string[]) { const roles = await this.prisma.role.findMany({ where: { id: { in: roleIds }, tenantId, deletedAt: null }, select: { id: true } }); if (roles.length !== roleIds.length) throw new ConflictException("Mindestens eine Rolle gehört nicht zum aktuellen Mandanten."); return roles; }
  private async assertTenantOwnerRemains(
    tx: Prisma.TransactionClient,
    tenantId: string,
    membership: { id: string; status: MembershipStatus },
    nextStatus: MembershipStatus | undefined,
    nextRoleIds: string[] | undefined,
  ) {
    const ownerRole = await tx.role.findFirst({
      where: { tenantId, name: "Tenant Owner", kind: RoleKind.SYSTEM, deletedAt: null },
      select: { id: true },
    });
    if (!ownerRole || membership.status !== MembershipStatus.ACTIVE) return;

    const isOwner = await tx.membershipRole.findUnique({
      where: { membershipId_roleId: { membershipId: membership.id, roleId: ownerRole.id } },
      select: { membershipId: true },
    });
    if (!isOwner) return;

    const becomesInactive = nextStatus !== undefined && nextStatus !== MembershipStatus.ACTIVE;
    const losesOwnerRole = nextRoleIds !== undefined && !nextRoleIds.includes(ownerRole.id);
    if (!becomesInactive && !losesOwnerRole) return;

    const remainingOwners = await tx.tenantMembership.count({
      where: {
        tenantId,
        id: { not: membership.id },
        status: MembershipStatus.ACTIVE,
        deletedAt: null,
        roleAssignments: { some: { roleId: ownerRole.id } },
      },
    });
    if (!remainingOwners) {
      throw new ConflictException("Ein Mandant muss mindestens einen aktiven Tenant Owner behalten.");
    }
  }
  private hashSecret(secret: string) { return createHash("sha256").update(secret).digest("hex"); }
  private hashPassword(password: string) { return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 }); }
  private async getDummyPasswordHash() { if (!this.dummyPasswordHash) this.dummyPasswordHash = await this.hashPassword("not-a-password"); return this.dummyPasswordHash; }
}
