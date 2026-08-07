import { Injectable } from "@nestjs/common";
import { RvgFeeScheduleStatus } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class LegalReferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async status() {
    const [currentBaseRate, latestBaseSync, activeRvg, pendingRvg] = await Promise.all([
      this.prisma.baseInterestRatePeriod.findFirst({
        where: {
          validFrom: { lte: new Date() },
          OR: [{ validTo: null }, { validTo: { gte: new Date() } }],
        },
        orderBy: { validFrom: "desc" },
      }),
      this.prisma.legalReferenceSyncRun.findFirst({
        where: { sourceType: "BUNDESBANK_BASE_INTEREST_RATE" },
        orderBy: { startedAt: "desc" },
      }),
      this.prisma.rvgFeeScheduleVersion.findFirst({
        where: { status: RvgFeeScheduleStatus.ACTIVE },
        orderBy: { validFrom: "desc" },
      }),
      this.prisma.rvgFeeScheduleVersion.findFirst({
        where: { status: RvgFeeScheduleStatus.PENDING_REVIEW },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return {
      baseInterestRate: currentBaseRate && {
        rate: currentBaseRate.rate.toFixed(4),
        validFrom: currentBaseRate.validFrom,
        lastSyncedAt: latestBaseSync?.finishedAt ?? null,
      },
      rvg: activeRvg && {
        identifier: activeRvg.identifier,
        validFrom: activeRvg.validFrom,
        lastCheckedAt: activeRvg.fetchedAt,
        pendingUpdate: Boolean(pendingRvg),
        pendingVersionId: pendingRvg?.id ?? null,
      },
    };
  }
  async rvgVersions() {
    return this.prisma.rvgFeeScheduleVersion.findMany({
      include: { _count: { select: { thresholds: true } } },
      orderBy: { createdAt: "desc" },
    });
  }
  async activateRvg(id: string) {
    const candidate = await this.prisma.rvgFeeScheduleVersion.findUnique({
      where: { id },
      include: { thresholds: true },
    });
    if (
      !candidate ||
      candidate.status !== RvgFeeScheduleStatus.PENDING_REVIEW ||
      candidate.thresholds.length < 40
    )
      throw new Error("RVG-Fassung ist nicht aktivierbar.");
    return this.prisma.$transaction(async (tx) => {
      await tx.rvgFeeScheduleVersion.updateMany({
        where: { identifier: candidate.identifier, status: RvgFeeScheduleStatus.ACTIVE },
        data: {
          status: RvgFeeScheduleStatus.REJECTED,
          validTo: new Date(candidate.validFrom.getTime() - 86400000),
        },
      });
      return tx.rvgFeeScheduleVersion.update({
        where: { id },
        data: { status: RvgFeeScheduleStatus.ACTIVE },
      });
    });
  }
  async rejectRvg(id: string) {
    const x = await this.prisma.rvgFeeScheduleVersion.findUnique({ where: { id } });
    if (!x || x.status !== RvgFeeScheduleStatus.PENDING_REVIEW)
      throw new Error("Nur ausstehende RVG-Fassungen können abgelehnt werden.");
    return this.prisma.rvgFeeScheduleVersion.update({
      where: { id },
      data: { status: RvgFeeScheduleStatus.REJECTED },
    });
  }
}
