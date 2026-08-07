import { createHash } from "node:crypto";
export type RvgSourceData = {
  identifier: string;
  validFrom: Date;
  legalReference: string;
  sourceReference: string;
  sourceHash: string;
  thresholds: { valueUpTo: string; baseFee: string }[];
  aboveMaximumIncrement: string;
  aboveMaximumFeeIncrease: string;
  smallClaimCollectionFee: string;
};
export class GesetzeImInternetRvgProvider {
  private readonly url = "https://www.gesetze-im-internet.de/rvg/anlage_2.html";
  async fetchSchedule(): Promise<RvgSourceData> {
    const res = await fetch(this.url);
    if (!res.ok) throw new Error(`Amtliche RVG-Quelle nicht erreichbar (${res.status}).`);
    const html = await res.text();
    const table = html.match(/<table[\s\S]*?<\/table>/)?.[0];
    if (!table) throw new Error("RVG-Anlage-2-Tabelle nicht gefunden.");
    const cells = [...table.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
      .map((x) =>
        x[1]
          .replace(/<[^>]+>/g, "")
          .replace(/&#160;|\u00a0/g, " ")
          .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
          .replace(/\s/g, "")
          .replace(",", "."),
      )
      .filter((x) => /^\d+(\.\d+)?$/.test(x));
    const thresholds = [] as { valueUpTo: string; baseFee: string }[];
    for (let i = 0; i + 1 < cells.length; i += 2)
      thresholds.push({ valueUpTo: cells[i], baseFee: cells[i + 1] });
    thresholds.sort((left, right) => Number(left.valueUpTo) - Number(right.valueUpTo));
    this.validate(thresholds);
    const hash = createHash("sha256")
      .update(JSON.stringify(thresholds) + "50000|175|31.50")
      .digest("hex");
    return {
      identifier: "rvg-para-13-anlage-2",
      validFrom: new Date("2025-01-01"),
      legalReference: "§ 13 RVG i. V. m. Anlage 2; § 13 Abs. 2 RVG",
      sourceReference: this.url,
      sourceHash: hash,
      thresholds,
      aboveMaximumIncrement: "50000.00",
      aboveMaximumFeeIncrease: "175.00",
      smallClaimCollectionFee: "31.50",
    };
  }
  private validate(t: { valueUpTo: string; baseFee: string }[]) {
    if (
      t.length < 40 ||
      t[0]?.valueUpTo !== "500" ||
      t[0]?.baseFee !== "51.50" ||
      t.at(-1)?.valueUpTo !== "500000" ||
      t.at(-1)?.baseFee !== "3752.00"
    )
      throw new Error("RVG-Tabelle ist unvollständig oder unplausibel.");
    for (let i = 0; i < t.length; i++) {
      if (Number(t[i].baseFee) <= 0 || (i && Number(t[i].valueUpTo) <= Number(t[i - 1].valueUpTo)))
        throw new Error("RVG-Tabelle verletzt Monotonie oder Gebührenvalidierung.");
    }
  }
}
