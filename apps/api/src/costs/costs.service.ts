import { createHash } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CaseCostCalculationStatus,
  CaseCostCalculationType,
  LedgerEntrySide,
  LedgerEntryType,
  Prisma,
  RvgFeeScheduleStatus,
} from "@prisma/client";
import { LegalReferenceSyncService } from "../legal-references/legal-reference-sync.service";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import {
  CaseInterestCostDto,
  CaseRvgCostDto,
  InterestMode,
  type InterestPreviewDto,
  RvgPreviewDto,
  RvgScenario,
} from "./dto/cost-preview.dto";
const money = (v: Prisma.Decimal) => v.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2);
const rules: Record<RvgScenario, [string, string, string]> = {
  SIMPLE_LETTER: ["0.3", "0.3", "VV RVG Nr. 2301"],
  SIMPLE_CASE: ["0.5", "0.5", "VV RVG Nr. 2300"],
  REGULAR_UNCONTESTED: ["0.9", "1.3", "VV RVG Nr. 2300"],
  EXTENSIVE_OR_DIFFICULT: ["1.3", "1.3", "VV RVG Nr. 2300"],
};
@Injectable()
export class CostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly legal: LegalReferenceSyncService,
    private readonly tenantContext: TenantContextService,
  ) {}
  async rvgPreview(dto: RvgPreviewDto) {
    const date = new Date(dto.calculationDate),
      value = new Prisma.Decimal(dto.subjectValue);
    const s = await this.prisma.rvgFeeScheduleVersion.findFirst({
      where: {
        // A superseded, reviewed schedule is retained as REJECTED by the
        // legal-reference workflow. It remains the authoritative local source
        // for calculations whose date falls within its validity period.
        status: { in: [RvgFeeScheduleStatus.ACTIVE, RvgFeeScheduleStatus.REJECTED] },
        validFrom: { lte: date },
        OR: [{ validTo: null }, { validTo: { gte: date } }],
      },
      include: { thresholds: { orderBy: { valueUpTo: "asc" } } },
    });
    if (!s) throw new NotFoundException("Keine aktive RVG-Fassung.");
    const t = s.thresholds.find((x) => value.lte(x.valueUpTo)),
      max = s.thresholds.at(-1);
    if (!max) throw new NotFoundException("Keine RVG-Wertstufen.");
    const steps = t
        ? new Prisma.Decimal(0)
        : value.minus(max.valueUpTo).div(s.aboveMaximumIncrement).ceil(),
      base = t?.baseFee ?? max.baseFee.plus(steps.mul(s.aboveMaximumFeeIncrease)),
      threshold = t?.valueUpTo ?? max.valueUpTo.plus(steps.mul(s.aboveMaximumIncrement));
    const [def, limit, ref] = rules[dto.scenario],
      factor = new Prisma.Decimal(dto.customFactor ?? def);
    if (factor.lte(0) || factor.gt(limit))
      throw new BadRequestException("Unzulässiger Gebührenfaktor.");
    const special =
        dto.scenario === RvgScenario.REGULAR_UNCONTESTED &&
        value.lte(50) &&
        s.smallClaimCollectionFee,
      fee = (special ? s.smallClaimCollectionFee! : base).mul(factor).toDecimalPlaces(2),
      allowance = dto.includeExpenseAllowance
        ? Prisma.Decimal.min(fee.mul("0.2"), new Prisma.Decimal(20)).toDecimalPlaces(2)
        : new Prisma.Decimal(0),
      net = fee.plus(allowance),
      vat = dto.includeVat
        ? net
            .mul(dto.vatRate ?? "19")
            .div(100)
            .toDecimalPlaces(2)
        : new Prisma.Decimal(0);
    return {
      subjectValue: money(value),
      threshold: money(threshold),
      baseFee: money(base),
      scheduleVersionId: s.id,
      scheduleIdentifier: s.identifier,
      validFrom: s.validFrom,
      legalReference: s.legalReference,
      feeReference: ref,
      factor: factor.toString(),
      specialRuleApplied: Boolean(special),
      feeNet: money(fee),
      expenseAllowance: money(allowance),
      taxableSubtotal: money(net),
      vatAmount: money(vat),
      grossTotal: money(net.plus(vat)),
      vatIsAutomaticDebtorDamage: false,
    };
  }
  async interestPreview(dto: InterestPreviewDto) {
    const from = new Date(dto.fromDate),
      to = new Date(dto.toDate);
    if (to < from) throw new BadRequestException("Ungültiger Zeitraum.");
    const principal = new Prisma.Decimal(dto.principalAmount),
      periods = await this.legal.getBaseRatePeriods(from, to);
    if (!periods.length) throw new NotFoundException("Keine Basiszinsperioden.");
    const result = periods.map((p) => {
      const days = Math.floor((p.validTo.getTime() - p.validFrom.getTime()) / 86400000) + 1,
        base = new Prisma.Decimal(p.rate),
        margin =
          dto.mode === InterestMode.CONSUMER_DEFAULT
            ? new Prisma.Decimal(5)
            : dto.mode === InterestMode.COMMERCIAL_DEFAULT
              ? new Prisma.Decimal(9)
              : new Prisma.Decimal(dto.baseRateMargin ?? 0),
        annual =
          dto.mode === InterestMode.CUSTOM && dto.fixedAnnualRate
            ? new Prisma.Decimal(dto.fixedAnnualRate)
            : base.plus(margin),
        interest = principal.mul(annual).div(100).mul(days).div(365).toDecimalPlaces(2);
      return {
        from: p.validFrom,
        to: p.validTo,
        days,
        baseRate: base.toFixed(4),
        margin: margin.toFixed(4),
        effectiveAnnualRate: annual.toFixed(4),
        interestAmount: money(interest),
      };
    });
    return {
      principalAmount: money(principal),
      totalInterest: money(
        result.reduce((x, p) => x.plus(p.interestAmount), new Prisma.Decimal(0)),
      ),
      calculationFrom: from,
      calculationTo: to,
      dayConvention: "actual/365",
      periods: result,
    };
  }

  async caseRvgPreview(caseId: string, dto: CaseRvgCostDto) {
    const claim = await this.getCaseClaim(caseId);
    return this.rvgPreview({
      ...dto,
      subjectValue: claim.principalAmount.toFixed(2),
      calculationDate: dto.calculationDate,
    });
  }

  async applyCaseRvg(caseId: string, dto: CaseRvgCostDto) {
    const claim = await this.getCaseClaim(caseId);
    const preview = await this.caseRvgPreview(caseId, dto);
    const tenantId = await this.tenantContext.getTenantId();
    const fingerprint = this.fingerprint({ type: "RVG", caseId, claimId: claim.id, preview });
    return this.prisma.$transaction(async (tx) => {
      await this.lockCalculation(tx, caseId, fingerprint);
      await this.assertNoActiveCalculation(tx, tenantId, caseId, fingerprint);
      const calculation = await tx.caseCostCalculation.create({
        data: {
          tenantId,
          caseId,
          type: CaseCostCalculationType.RVG,
          fingerprint,
          calculatedAmount: new Prisma.Decimal(preview.feeNet).plus(preview.expenseAllowance),
          referenceData: { claimId: claim.id, currency: claim.currency, preview },
        },
      });
      const bookingDate = new Date(dto.calculationDate);
      const entries = await Promise.all(
        [
          {
            type: LedgerEntryType.COLLECTION_FEE,
            amount: preview.feeNet,
            description: `RVG-Inkassogebühr (${preview.feeReference})`,
          },
          ...(new Prisma.Decimal(preview.expenseAllowance).gt(0)
            ? [
                {
                  type: LedgerEntryType.EXPENSE,
                  amount: preview.expenseAllowance,
                  description: "Auslagenpauschale nach VV RVG",
                },
              ]
            : []),
        ].map((entry) =>
          tx.caseLedgerEntry.create({
            data: {
              tenantId,
              caseId,
              costCalculationId: calculation.id,
              side: LedgerEntrySide.DEBIT,
              type: entry.type,
              amount: entry.amount,
              currency: claim.currency,
              bookingDate,
              description: entry.description,
              externalReference: `rvg:${fingerprint}`,
              source: "rvg-calculation",
            },
          }),
        ),
      );
      return { calculation, ledgerEntries: entries, preview };
    });
  }

  async caseInterestPreview(caseId: string, dto: CaseInterestCostDto) {
    const claim = await this.getCaseClaim(caseId);
    const fromDate = dto.fromDate ?? this.dateOnly(claim.defaultDate ?? claim.dueDate);
    return this.interestPreview({
      ...dto,
      principalAmount: claim.principalAmount.toFixed(2),
      fromDate,
      toDate: dto.toDate ?? this.dateOnly(new Date()),
    });
  }

  async applyCaseInterest(caseId: string, dto: CaseInterestCostDto) {
    const claim = await this.getCaseClaim(caseId);
    const preview = await this.caseInterestPreview(caseId, dto);
    const tenantId = await this.tenantContext.getTenantId();
    const fingerprint = this.fingerprint({ type: "INTEREST", caseId, claimId: claim.id, preview });
    return this.prisma.$transaction(async (tx) => {
      await this.lockCalculation(tx, caseId, fingerprint);
      await this.assertNoActiveCalculation(tx, tenantId, caseId, fingerprint);
      const calculation = await tx.caseCostCalculation.create({
        data: {
          tenantId,
          caseId,
          type: CaseCostCalculationType.INTEREST,
          fingerprint,
          calculatedAmount: preview.totalInterest,
          referenceData: { claimId: claim.id, currency: claim.currency, preview },
        },
      });
      const entry = await tx.caseLedgerEntry.create({
        data: {
          tenantId,
          caseId,
          costCalculationId: calculation.id,
          side: LedgerEntrySide.DEBIT,
          type: LedgerEntryType.INTEREST,
          amount: preview.totalInterest,
          currency: claim.currency,
          bookingDate: new Date(preview.calculationTo),
          description: `Verzugszinsen ${this.dateOnly(preview.calculationFrom)} bis ${this.dateOnly(preview.calculationTo)}`,
          externalReference: `interest:${fingerprint}`,
          source: "interest-calculation",
        },
      });
      return { calculation, ledgerEntries: [entry], preview };
    });
  }

  private async getCaseClaim(caseId: string) {
    const tenantId = await this.tenantContext.getTenantId();
    const caseRecord = await this.prisma.case.findFirst({
      where: { id: caseId, tenantId, deletedAt: null },
      include: { claim: true },
    });
    if (!caseRecord) throw new NotFoundException("Akte wurde nicht gefunden.");
    if (!caseRecord.claim) throw new BadRequestException("Die Akte enthält keine Forderung.");
    return caseRecord.claim;
  }

  private async assertNoActiveCalculation(
    tx: Prisma.TransactionClient,
    tenantId: string,
    caseId: string,
    fingerprint: string,
  ) {
    const exists = await tx.caseCostCalculation.findFirst({
      where: { tenantId, caseId, fingerprint, status: CaseCostCalculationStatus.APPLIED },
      select: { id: true },
    });
    if (exists) throw new ConflictException("Diese Kostenberechnung wurde bereits übernommen.");
  }

  private async lockCalculation(tx: Prisma.TransactionClient, caseId: string, fingerprint: string) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`cost:${caseId}:${fingerprint}`}))`;
  }

  private fingerprint(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }

  private dateOnly(value: Date) {
    return value.toISOString().slice(0, 10);
  }
}
