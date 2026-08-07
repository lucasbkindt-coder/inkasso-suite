import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { LegalReferenceSyncStatus, Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { BundesbankBaseRateProvider } from "./bundesbank-base-rate.provider";
import { GesetzeImInternetRvgProvider } from "./gesetze-im-internet-rvg.provider";

@Injectable()
export class LegalReferenceSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly provider = new BundesbankBaseRateProvider();
  private readonly rvgProvider = new GesetzeImInternetRvgProvider();
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    void this.syncBaseInterestRates();
    this.timer = setInterval(() => void this.syncBaseInterestRates(), 24 * 60 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async syncBaseInterestRates() {
    const run = await this.prisma.legalReferenceSyncRun.create({
      data: { sourceType: "BUNDESBANK_BASE_INTEREST_RATE" },
    });
    try {
      const records = await this.provider.fetchPeriods();
      const outcome = await this.prisma.$transaction(async (tx) => {
        let insertedRecords = 0;
        let conflictRecords = 0;
        for (const record of records) {
          const existing = await tx.baseInterestRatePeriod.findUnique({
            where: { validFrom: record.validFrom },
          });
          if (!existing) {
            await tx.baseInterestRatePeriod.create({ data: record });
            insertedRecords++;
          } else if (!new Prisma.Decimal(existing.rate).equals(record.rate)) conflictRecords++;
        }
        const periods = await tx.baseInterestRatePeriod.findMany({ orderBy: { validFrom: "asc" } });
        for (const [index, period] of periods.entries()) {
          const next = periods[index + 1];
          const validTo = next ? new Date(next.validFrom.getTime() - 24 * 60 * 60 * 1000) : null;
          if ((period.validTo?.getTime() ?? null) !== (validTo?.getTime() ?? null))
            await tx.baseInterestRatePeriod.update({ where: { id: period.id }, data: { validTo } });
        }
        return { insertedRecords, conflictRecords };
      });
      return this.prisma.legalReferenceSyncRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          fetchedRecords: records.length,
          ...outcome,
          status: outcome.conflictRecords
            ? LegalReferenceSyncStatus.SUCCEEDED_WITH_CONFLICTS
            : LegalReferenceSyncStatus.SUCCEEDED,
        },
      });
    } catch (error) {
      return this.prisma.legalReferenceSyncRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          status: LegalReferenceSyncStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : "Unbekannter Sync-Fehler",
        },
      });
    }
  }

  async getBaseRatePeriods(from: Date, to: Date) {
    if (to < from)
      throw new RangeError("Das Periodenende darf nicht vor dem Periodenbeginn liegen.");
    const periods = await this.prisma.baseInterestRatePeriod.findMany({
      where: { validFrom: { lte: to }, OR: [{ validTo: null }, { validTo: { gte: from } }] },
      orderBy: { validFrom: "asc" },
    });
    return periods.map((period) => ({
      validFrom: period.validFrom < from ? from : period.validFrom,
      validTo: !period.validTo || period.validTo > to ? to : period.validTo,
      rate: period.rate.toFixed(4),
      sourceReference: period.sourceReference,
    }));
  }
  async syncRvg() {
    const run = await this.prisma.legalReferenceSyncRun.create({ data: { sourceType: "RVG" } });
    try {
      const data = await this.rvgProvider.fetchSchedule();
      const active = await this.prisma.rvgFeeScheduleVersion.findFirst({
        where: { identifier: data.identifier, status: "ACTIVE" },
        orderBy: { validFrom: "desc" },
        include: { thresholds: { orderBy: { valueUpTo: "asc" } } },
      });
      const equivalent = active && active.thresholds.length === data.thresholds.length && active.thresholds.every((threshold, index) => threshold.valueUpTo.equals(data.thresholds[index].valueUpTo) && threshold.baseFee.equals(data.thresholds[index].baseFee)) && active.aboveMaximumIncrement.equals(data.aboveMaximumIncrement) && active.aboveMaximumFeeIncrease.equals(data.aboveMaximumFeeIncrease) && active.smallClaimCollectionFee?.equals(data.smallClaimCollectionFee);
      if (active?.sourceHash === data.sourceHash || equivalent)
        return this.prisma.legalReferenceSyncRun.update({
          where: { id: run.id },
          data: {
            finishedAt: new Date(),
            status: "SUCCEEDED",
            fetchedRecords: data.thresholds.length,
          },
        });
      const pending = await this.prisma.rvgFeeScheduleVersion.findFirst({
        where: {
          identifier: data.identifier,
          sourceHash: data.sourceHash,
          status: "PENDING_REVIEW",
        },
      });
      if (!pending)
        await this.prisma.rvgFeeScheduleVersion.create({
          data: {
            ...data,
            fetchedAt: new Date(),
            status: "PENDING_REVIEW",
            thresholds: { create: data.thresholds },
          },
        });
      return this.prisma.legalReferenceSyncRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          status: "SUCCEEDED",
          fetchedRecords: data.thresholds.length,
          insertedRecords: pending ? 0 : data.thresholds.length,
        },
      });
    } catch (e) {
      return this.prisma.legalReferenceSyncRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          status: "FAILED",
          errorMessage: e instanceof Error ? e.message : "RVG-Sync-Fehler",
        },
      });
    }
  }
}
