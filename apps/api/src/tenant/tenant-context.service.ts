import { Injectable, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TenantContextService {
  constructor(private readonly prisma: PrismaService) {}

  async getTenantId() {
    const tenant = await this.prisma.tenant.findFirst({
      where: { slug: "inkasso-suite", isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!tenant)
      throw new NotFoundException("Entwicklungsmandant nicht gefunden. Bitte Seed ausführen.");
    return tenant.id;
  }
}
