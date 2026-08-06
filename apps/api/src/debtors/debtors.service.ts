import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { DebtorType, type Prisma } from "@prisma/client";

import type { PrismaService } from "../prisma/prisma.service";
import type { TenantContextService } from "../tenant/tenant-context.service";
import type { CreateDebtorDto } from "./dto/create-debtor.dto";
import type { QueryDebtorsDto } from "./dto/query-debtors.dto";
import type { UpdateDebtorDto } from "./dto/update-debtor.dto";

@Injectable()
export class DebtorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(dto: CreateDebtorDto) {
    this.validateIdentity(dto.type, dto);
    const tenantId = await this.tenantContext.getTenantId();
    return this.prisma.debtor.create({
      data: { ...dto, tenantId, country: dto.country?.toUpperCase() },
    });
  }

  async findAll(query: QueryDebtorsDto) {
    const tenantId = await this.tenantContext.getTenantId();
    const where: Prisma.DebtorWhereInput = { tenantId, deletedAt: null, type: query.type };
    if (query.search)
      where.OR = [
        { firstName: { contains: query.search, mode: "insensitive" } },
        { lastName: { contains: query.search, mode: "insensitive" } },
        { companyName: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
      ];
    const [items, total] = await this.prisma.$transaction([
      this.prisma.debtor.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortDirection },
      }),
      this.prisma.debtor.count({ where }),
    ]);
    return {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(id: string) {
    return this.getActiveDebtor(id, await this.tenantContext.getTenantId());
  }

  async update(id: string, dto: UpdateDebtorDto) {
    const tenantId = await this.tenantContext.getTenantId();
    const debtor = await this.getActiveDebtor(id, tenantId);
    this.validateIdentity(dto.type ?? debtor.type, { ...debtor, ...dto });
    return this.prisma.debtor.update({
      where: { id },
      data: { ...dto, country: dto.country?.toUpperCase() },
    });
  }

  async remove(id: string) {
    await this.getActiveDebtor(id, await this.tenantContext.getTenantId());
    return this.prisma.debtor.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private async getActiveDebtor(id: string, tenantId: string) {
    const debtor = await this.prisma.debtor.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!debtor) throw new NotFoundException("Schuldner wurde nicht gefunden.");
    return debtor;
  }

  private validateIdentity(
    type: DebtorType,
    value: { firstName?: string | null; lastName?: string | null; companyName?: string | null },
  ) {
    if (type === DebtorType.PERSON && (!value.firstName?.trim() || !value.lastName?.trim()))
      throw new BadRequestException("Vor- und Nachname sind erforderlich.");
    if (type === DebtorType.COMPANY && !value.companyName?.trim())
      throw new BadRequestException("Firmenname ist erforderlich.");
  }
}
