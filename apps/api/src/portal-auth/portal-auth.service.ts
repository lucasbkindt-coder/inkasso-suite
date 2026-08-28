import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  PartyRoleType,
  ActivityEventType,
  PortalAccountStatus,
  PortalAccountType,
  Prisma,
} from "@prisma/client";
import argon2 from "argon2";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

import { PrismaService } from "../prisma/prisma.service";
import { ActivityService } from "../activity/activity.service";
import { ActivatePortalAccountDto } from "./dto/activate-portal-account.dto";
import { LoginPortalAccountDto } from "./dto/login-portal-account.dto";

const ACTIVATION_TTL_MS = 72 * 60 * 60 * 1000;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LOGIN_IDENTIFIER_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const PORTAL_SESSION_COOKIE = "risepay_portal_session";

export type PortalAuthContext = {
  tenantId: string;
  portalAccountId: string;
  portalType: PortalAccountType;
  partyId: string;
  clientContactId?: string;
  clientContactName?: string;
};

type IssueActivationOptions = {
  invalidateExisting?: boolean;
  actorMembershipId?: string;
};

@Injectable()
export class PortalAuthService {
  private dummyPasswordHash: string | undefined;

  constructor(private readonly prisma: PrismaService, private readonly activity: ActivityService) {}

  async ensurePortalAccountForParty(
    tenantId: string,
    partyId: string,
    portalType: PortalAccountType,
  ) {
    if (portalType === PortalAccountType.CLIENT) {
      throw new BadRequestException("Neue Mandantenportalzugänge benötigen einen Ansprechpartner.");
    }
    await this.assertEligibleParty(tenantId, partyId, portalType);
    const existing = await this.prisma.portalAccount.findFirst({
      where: { tenantId, partyId, portalType, clientContactId: null },
    });
    if (existing) return { account: existing, created: false };

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const account = await this.prisma.$transaction(async (tx) => {
          const created = await tx.portalAccount.create({ data: {
            tenantId,
            partyId,
            portalType,
            status: PortalAccountStatus.PENDING_ACTIVATION,
            loginIdentifier: await this.createLoginIdentifier(),
          } });
          await this.activity.recordSystemEvent(tx, { tenantId, partyId, eventType: ActivityEventType.PORTAL_ACCOUNT_CREATED, description: "Portalzugang wurde angelegt.", metadata: { portalType }, sourceEntityType: "PortalAccount", sourceEntityId: created.id });
          return created;
        });
        return { account, created: true };
      } catch (error) {
        if (!this.isUniqueConstraint(error)) throw error;
        const concurrentAccount = await this.prisma.portalAccount.findFirst({
          where: { tenantId, partyId, portalType, clientContactId: null },
        });
        if (concurrentAccount) return { account: concurrentAccount, created: false };
      }
    }
    throw new ConflictException("Portalzugang konnte nicht erzeugt werden.");
  }

  async createClientAccountForContact(tenantId: string, partyId: string, clientContactId: string) {
    const contact = await this.prisma.clientContact.findFirst({
      where: { id: clientContactId, tenantId, partyId, isActive: true, party: { deletedAt: null, roles: { some: { role: PartyRoleType.CLIENT, deletedAt: null } } } },
      select: { id: true, email: true },
    });
    if (!contact) throw new BadRequestException("Der Ansprechpartner ist nicht für einen Mandantenportalzugang geeignet.");
    if (!contact.email) throw new BadRequestException("Für den Portalzugang muss eine E-Mail-Adresse hinterlegt sein.");
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`client-portal-account:${clientContactId}`}))`;
        const existing = await tx.portalAccount.findUnique({ where: { clientContactId } });
        if (existing) return { account: existing, created: false };
        const created = await tx.portalAccount.create({ data: {
          tenantId, partyId, clientContactId, portalType: PortalAccountType.CLIENT,
          status: PortalAccountStatus.PENDING_ACTIVATION, loginIdentifier: await this.createLoginIdentifier(),
        } });
        await this.activity.recordSystemEvent(tx, { tenantId, partyId, eventType: ActivityEventType.PORTAL_ACCOUNT_CREATED, description: "Mandantenportalzugang wurde angelegt.", metadata: { portalType: PortalAccountType.CLIENT, clientContactId }, sourceEntityType: "PortalAccount", sourceEntityId: created.id });
        return { account: created, created: true };
      });
      return result;
    } catch (error) {
      if (!this.isUniqueConstraint(error)) throw error;
      const account = await this.prisma.portalAccount.findUnique({ where: { clientContactId } });
      if (account) return { account, created: false };
      throw error;
    }
  }

  async issueActivation(
    tenantId: string,
    portalAccountId: string,
    options: IssueActivationOptions = {},
  ) {
    const account = await this.prisma.portalAccount.findFirst({
      where: { id: portalAccountId, tenantId },
      select: { id: true, partyId: true, loginIdentifier: true, status: true },
    });
    if (!account) throw new NotFoundException("Portalzugang wurde nicht gefunden.");
    if (account.status !== PortalAccountStatus.PENDING_ACTIVATION) {
      throw new ConflictException("Für diesen Portalzugang kann keine Aktivierung ausgestellt werden.");
    }

    const activationCode = randomBytes(24).toString("base64url");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ACTIVATION_TTL_MS);
    const activation = await this.prisma.$transaction(async (tx) => {
      if (options.invalidateExisting !== false) {
        await tx.portalActivation.updateMany({
          where: { portalAccountId: account.id, usedAt: null, invalidatedAt: null },
          data: { invalidatedAt: now },
        });
      }
      const created = await tx.portalActivation.create({
        data: {
          portalAccountId: account.id,
          secretHash: this.hashSecret(activationCode),
          expiresAt,
        },
      });
      const event = { tenantId, partyId: account.partyId, eventType: ActivityEventType.PORTAL_ACTIVATION_ISSUED, description: "Portalaktivierung wurde ausgestellt.", metadata: { portalAccountId: account.id }, sourceEntityType: "PortalActivation", sourceEntityId: created.id };
      if (options.actorMembershipId) await this.activity.recordStaffEvent(tx, options.actorMembershipId, event);
      else await this.activity.recordSystemEvent(tx, event);
      return created;
    });

    return {
      activationId: activation.id,
      portalAccountId: account.id,
      loginIdentifier: account.loginIdentifier,
      activationCode,
      expiresAt,
    };
  }

  async finalizeActivation(
    tx: Prisma.TransactionClient,
    portalAccountId: string,
    activationId: string,
  ) {
    const now = new Date();
    const activation = await tx.portalActivation.findFirst({
      where: { id: activationId, portalAccountId, usedAt: null, invalidatedAt: null },
      select: { id: true },
    });
    if (!activation) throw new ConflictException("Aktivierung ist nicht mehr verfügbar.");
    await tx.portalActivation.updateMany({
      where: {
        portalAccountId,
        id: { not: activationId },
        usedAt: null,
        invalidatedAt: null,
      },
      data: { invalidatedAt: now },
    });
  }

  async discardActivation(portalAccountId: string, activationId: string) {
    await this.prisma.portalActivation.updateMany({
      where: { id: activationId, portalAccountId, usedAt: null, invalidatedAt: null },
      data: { invalidatedAt: new Date() },
    });
  }

  async activate(dto: ActivatePortalAccountDto) {
    const loginIdentifier = this.normalizeLoginIdentifier(dto.loginIdentifier);
    this.assertPassword(dto.newPassword, dto.confirmPassword);

    return this.prisma.$transaction(async (tx) => {
      const account = await tx.portalAccount.findUnique({ where: { loginIdentifier } });
      if (!account || account.status !== PortalAccountStatus.PENDING_ACTIVATION) {
        throw new BadRequestException("Aktivierung nicht möglich.");
      }
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-account:${account.id}`}))`;
      const now = new Date();
      const activation = await tx.portalActivation.findFirst({
        where: {
          portalAccountId: account.id,
          usedAt: null,
          invalidatedAt: null,
          expiresAt: { gt: now },
        },
        orderBy: { createdAt: "desc" },
      });
      if (!activation || !this.secretMatches(dto.activationCode, activation.secretHash)) {
        throw new BadRequestException("Aktivierung nicht möglich.");
      }

      const passwordHash = await this.hashPassword(dto.newPassword);
      await tx.portalActivation.update({ where: { id: activation.id }, data: { usedAt: now } });
      const activated = await tx.portalAccount.update({
        where: { id: account.id },
        data: { status: PortalAccountStatus.ACTIVE, passwordHash, activatedAt: now },
      });
      await this.activity.recordPortalEvent(tx, activated.id, {
        tenantId: activated.tenantId, partyId: activated.partyId, eventType: ActivityEventType.PORTAL_ACCOUNT_ACTIVATED,
        description: "Portalzugang wurde aktiviert.", sourceEntityType: "PortalAccount", sourceEntityId: activated.id,
      });
      return { id: activated.id, portalType: activated.portalType, status: activated.status };
    });
  }

  async login(dto: LoginPortalAccountDto) {
    const loginIdentifier = this.normalizeLoginIdentifier(dto.loginIdentifier);
    const account = await this.prisma.portalAccount.findUnique({ where: { loginIdentifier } });
    const hash = account?.passwordHash ?? (await this.getDummyPasswordHash());
    const passwordMatches = await argon2.verify(hash, dto.password).catch(() => false);
    if (
      !account ||
      account.status !== PortalAccountStatus.ACTIVE ||
      !account.passwordHash ||
      !passwordMatches
    ) {
      throw new UnauthorizedException("Anmeldedaten ungültig.");
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    const token = randomBytes(32).toString("base64url");
    await this.prisma.$transaction([
      this.prisma.portalAccount.update({ where: { id: account.id }, data: { lastLoginAt: now } }),
      this.prisma.portalSession.create({
        data: {
          portalAccountId: account.id,
          tokenHash: this.hashSecret(token),
          expiresAt,
          lastSeenAt: now,
        },
      }),
    ]);
    return { token, expiresAt, portalType: account.portalType };
  }

  async logout(token: string | undefined) {
    if (!token) return;
    await this.prisma.portalSession.updateMany({
      where: { tokenHash: this.hashSecret(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async requireSession(token: string | undefined, expectedType?: PortalAccountType) {
    if (!token) throw new UnauthorizedException("Portal-Anmeldung erforderlich.");
    const now = new Date();
    const session = await this.prisma.portalSession.findFirst({
      where: {
        tokenHash: this.hashSecret(token),
        revokedAt: null,
        expiresAt: { gt: now },
        portalAccount: { status: PortalAccountStatus.ACTIVE },
      },
      include: { portalAccount: { include: { clientContact: { select: { firstName: true, lastName: true, isActive: true } } } }, },
    });
    if (!session || (expectedType && session.portalAccount.portalType !== expectedType)) {
      throw new UnauthorizedException("Portal-Anmeldung erforderlich.");
    }
    if (session.portalAccount.portalType === PortalAccountType.CLIENT && (!session.portalAccount.clientContactId || !session.portalAccount.clientContact?.isActive)) {
      throw new UnauthorizedException("Portal-Anmeldung erforderlich.");
    }
    await this.prisma.portalSession.update({ where: { id: session.id }, data: { lastSeenAt: now } });
    return {
      tenantId: session.portalAccount.tenantId,
      portalAccountId: session.portalAccount.id,
      portalType: session.portalAccount.portalType,
      partyId: session.portalAccount.partyId,
      clientContactId: session.portalAccount.clientContactId ?? undefined,
      clientContactName: session.portalAccount.clientContact ? `${session.portalAccount.clientContact.firstName} ${session.portalAccount.clientContact.lastName}` : undefined,
    } satisfies PortalAuthContext;
  }

  async suspendAccount(tenantId: string, portalAccountId: string, actorMembershipId?: string) {
    return this.prisma.$transaction((tx) => this.suspendAccountInTransaction(tx, tenantId, portalAccountId, "Portalzugang wurde gesperrt.", actorMembershipId));
  }

  async suspendAccountInTransaction(tx: Prisma.TransactionClient, tenantId: string, portalAccountId: string, reason = "Portalzugang wurde gesperrt.", actorMembershipId?: string) {
    const account = await tx.portalAccount.findFirst({ where: { id: portalAccountId, tenantId }, select: { id: true, partyId: true, status: true, loginIdentifier: true, activatedAt: true, lastLoginAt: true } });
    if (!account) throw new NotFoundException("Portalzugang wurde nicht gefunden.");
    if (account.status === PortalAccountStatus.LOCKED) return account;
    const updated = await tx.portalAccount.update({ where: { id: account.id }, data: { status: PortalAccountStatus.LOCKED } });
    await tx.portalSession.updateMany({ where: { portalAccountId: account.id, revokedAt: null }, data: { revokedAt: new Date() } });
    const event = { tenantId, partyId: account.partyId, eventType: ActivityEventType.PORTAL_ACCOUNT_SUSPENDED, description: reason, sourceEntityType: "PortalAccount", sourceEntityId: account.id };
    if (actorMembershipId) await this.activity.recordStaffEvent(tx, actorMembershipId, event);
    else await this.activity.recordSystemEvent(tx, event);
    return updated;
  }

  async reactivateAccount(tenantId: string, portalAccountId: string, actorMembershipId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.portalAccount.findFirst({ where: { id: portalAccountId, tenantId }, select: { id: true, partyId: true, status: true, passwordHash: true } });
      if (!account) throw new NotFoundException("Portalzugang wurde nicht gefunden.");
      if (account.status !== PortalAccountStatus.LOCKED) throw new ConflictException("Dieser Portalzugang ist nicht gesperrt.");
      const status = account.passwordHash ? PortalAccountStatus.ACTIVE : PortalAccountStatus.PENDING_ACTIVATION;
      const updated = await tx.portalAccount.update({ where: { id: account.id }, data: { status } });
      const event = { tenantId, partyId: account.partyId, eventType: ActivityEventType.PORTAL_ACCOUNT_REACTIVATED, description: "Portalzugang wurde freigegeben.", sourceEntityType: "PortalAccount", sourceEntityId: account.id };
      if (actorMembershipId) await this.activity.recordStaffEvent(tx, actorMembershipId, event);
      else await this.activity.recordSystemEvent(tx, event);
      return updated;
    });
  }

  sessionCookieOptions(expiresAt?: Date) {
    return {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      ...(expiresAt ? { expires: expiresAt } : { maxAge: 0 }),
    };
  }

  private async assertEligibleParty(
    tenantId: string,
    partyId: string,
    portalType: PortalAccountType,
  ) {
    const requiredRole =
      portalType === PortalAccountType.CLIENT ? PartyRoleType.CLIENT : PartyRoleType.DEBTOR;
    const party = await this.prisma.party.findFirst({
      where: {
        id: partyId,
        tenantId,
        deletedAt: null,
        roles: { some: { role: requiredRole, deletedAt: null } },
      },
      select: { id: true },
    });
    if (!party) throw new BadRequestException("Die Partei ist nicht für diesen Portalzugang geeignet.");
  }

  private async createLoginIdentifier() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const body = Array.from({ length: 8 }, () =>
        LOGIN_IDENTIFIER_ALPHABET[randomInt(LOGIN_IDENTIFIER_ALPHABET.length)],
      ).join("");
      const loginIdentifier = `RP-${body.slice(0, 4)}-${body.slice(4)}`;
      const existing = await this.prisma.portalAccount.findUnique({
        where: { loginIdentifier },
        select: { id: true },
      });
      if (!existing) return loginIdentifier;
    }
    throw new ConflictException("Login-Identifier konnte nicht erzeugt werden.");
  }

  private assertPassword(newPassword: string, confirmPassword: string) {
    if (newPassword !== confirmPassword) throw new BadRequestException("Passwörter stimmen nicht überein.");
    if (newPassword.trim().length < 12) {
      throw new BadRequestException("Das Passwort muss mindestens 12 nichtleere Zeichen enthalten.");
    }
  }

  private normalizeLoginIdentifier(value: string) {
    return value.trim().toUpperCase();
  }

  private hashSecret(secret: string) {
    return createHash("sha256").update(secret).digest("hex");
  }

  private secretMatches(secret: string, expectedHash: string) {
    const actualHash = this.hashSecret(secret);
    return timingSafeEqual(Buffer.from(actualHash, "hex"), Buffer.from(expectedHash, "hex"));
  }

  private hashPassword(password: string) {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  private async getDummyPasswordHash() {
    if (!this.dummyPasswordHash) this.dummyPasswordHash = await this.hashPassword("not-a-password");
    return this.dummyPasswordHash;
  }

  private isUniqueConstraint(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }
}
