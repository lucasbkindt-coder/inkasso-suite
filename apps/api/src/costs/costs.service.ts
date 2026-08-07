import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, RvgFeeScheduleStatus } from "@prisma/client";
import { LegalReferenceSyncService } from "../legal-references/legal-reference-sync.service";
import { PrismaService } from "../prisma/prisma.service";
import {
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
  ) {}
  async rvgPreview(dto: RvgPreviewDto) {
    const date = new Date(dto.calculationDate),
      value = new Prisma.Decimal(dto.subjectValue);
    const s = await this.prisma.rvgFeeScheduleVersion.findFirst({
      where: {
        status: RvgFeeScheduleStatus.ACTIVE,
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
}
