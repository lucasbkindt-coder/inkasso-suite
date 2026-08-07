import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { MembershipStatus, Prisma, TaskStatus, TaskType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import { CreateTaskDto } from "./dto/create-task.dto";
import { QueryTasksDto } from "./dto/query-tasks.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";

const detailInclude = { case: { select: { id: true, caseNumber: true } }, assignedMembership: { select: { id: true, user: { select: { email: true, displayName: true } } } }, createdByMembership: { select: { id: true, user: { select: { email: true, displayName: true } } } } } satisfies Prisma.CaseTaskInclude;

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService, private readonly tenant: TenantContextService) {}

  async findAll(query: QueryTasksDto) {
    const tenantId = await this.tenant.getTenantId();
    const now = new Date();
    const where: Prisma.CaseTaskWhereInput = { tenantId, type: query.type, status: query.status, priority: query.priority, caseId: query.caseId, assignedMembershipId: query.assignedMembershipId };
    if (query.search) where.OR = [{ title: { contains: query.search, mode: "insensitive" } }, { description: { contains: query.search, mode: "insensitive" } }];
    const relevant = { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] };
    if (query.overdue) { where.status = relevant; where.OR = [{ dueAt: { lt: now } }, { followUpAt: { lt: now } }]; }
    if (query.today || query.upcoming || query.dueFrom || query.dueTo) {
      const start = query.dueFrom ? new Date(query.dueFrom) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = query.dueTo ? new Date(query.dueTo) : query.today ? new Date(start.getTime() + 86400000) : query.upcoming ? new Date(start.getTime() + 7 * 86400000) : undefined;
      where.dueAt = { gte: start, ...(end ? { lt: end } : {}) };
    }
    const [items, total] = await this.prisma.$transaction([this.prisma.caseTask.findMany({ where, include: detailInclude, orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }), this.prisma.caseTask.count({ where })]);
    return { items, page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) };
  }
  async findOne(id: string) { return this.findTask(id, await this.tenant.getTenantId()); }
  async create(dto: CreateTaskDto) {
    const tenantId = await this.tenant.getTenantId();
    this.validateDates(dto.type, dto.dueAt, dto.followUpAt);
    if (dto.caseId) await this.assertCase(dto.caseId, tenantId);
    if (dto.assignedMembershipId) await this.assertMembership(dto.assignedMembershipId, tenantId);
    return this.prisma.caseTask.create({ data: { tenantId, caseId: dto.caseId, type: dto.type, priority: dto.priority, title: dto.title.trim(), description: dto.description, dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined, followUpAt: dto.followUpAt ? new Date(dto.followUpAt) : undefined, assignedMembershipId: dto.assignedMembershipId }, include: detailInclude });
  }
  async update(id: string, dto: UpdateTaskDto) {
    const tenantId = await this.tenant.getTenantId(); const current = await this.findTask(id, tenantId);
    if (dto.assignedMembershipId) await this.assertMembership(dto.assignedMembershipId, tenantId);
    const type = dto.type ?? current.type; const dueAt = dto.dueAt === undefined ? current.dueAt?.toISOString() : dto.dueAt; const followUpAt = dto.followUpAt === undefined ? current.followUpAt?.toISOString() : dto.followUpAt;
    this.validateDates(type, dueAt, followUpAt);
    return this.prisma.caseTask.update({ where: { id }, data: { type: dto.type, priority: dto.priority, title: dto.title?.trim(), description: dto.description, dueAt: dto.dueAt === undefined ? undefined : new Date(dto.dueAt), followUpAt: dto.followUpAt === undefined ? undefined : new Date(dto.followUpAt), assignedMembershipId: dto.assignedMembershipId }, include: detailInclude });
  }
  async complete(id: string) { return this.transition(id, TaskStatus.COMPLETED); }
  async reopen(id: string) { return this.transition(id, TaskStatus.OPEN); }
  async cancel(id: string) { return this.transition(id, TaskStatus.CANCELLED); }
  private async transition(id: string, status: TaskStatus) { const tenantId = await this.tenant.getTenantId(); await this.findTask(id, tenantId); const now = new Date(); return this.prisma.caseTask.update({ where: { id }, data: { status, completedAt: status === TaskStatus.COMPLETED ? now : null, cancelledAt: status === TaskStatus.CANCELLED ? now : null }, include: detailInclude }); }
  private validateDates(type: TaskType, dueAt?: string | null, followUpAt?: string | null) { if (type === TaskType.DEADLINE && !dueAt) throw new BadRequestException("Für eine Frist ist dueAt erforderlich."); if (type === TaskType.FOLLOW_UP && !dueAt && !followUpAt) throw new BadRequestException("Für eine Wiedervorlage ist dueAt oder followUpAt erforderlich."); }
  private async assertCase(id: string, tenantId: string) { const value = await this.prisma.case.findFirst({ where: { id, tenantId, deletedAt: null }, select: { id: true } }); if (!value) throw new BadRequestException("Die Akte gehört nicht zum aktiven Mandanten."); }
  private async assertMembership(id: string, tenantId: string) { const value = await this.prisma.tenantMembership.findFirst({ where: { id, tenantId, deletedAt: null, status: MembershipStatus.ACTIVE }, select: { id: true } }); if (!value) throw new BadRequestException("Die zugewiesene Mitgliedschaft gehört nicht zum aktiven Mandanten."); }
  private async findTask(id: string, tenantId: string) { const value = await this.prisma.caseTask.findFirst({ where: { id, tenantId }, include: detailInclude }); if (!value) throw new NotFoundException("Aufgabe wurde nicht gefunden."); return value; }
}
