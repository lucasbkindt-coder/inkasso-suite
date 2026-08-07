import { createHash } from "node:crypto";

export type BaseRateSourceRecord = {
  validFrom: Date;
  rate: string;
  source: string;
  sourceReference: string;
  sourcePublishedAt?: Date;
  fetchedAt: Date;
  sourceHash: string;
};

export class BundesbankBaseRateProvider {
  private readonly url =
    "https://api.statistiken.bundesbank.de/rest/data/BBIN1/M.DE.BBK.BBKBAS2.EUR.ME";

  async fetchPeriods(): Promise<BaseRateSourceRecord[]> {
    const response = await fetch(this.url, {
      headers: { Accept: "application/vnd.sdmx.genericdata+xml" },
    });
    if (!response.ok)
      throw new Error(`Bundesbank-SDMX-Anfrage fehlgeschlagen (${response.status}).`);
    const xml = await response.text();
    const fetchedAt = new Date();
    const publishedAt = this.parsePublishedAt(xml);
    const observations = [
      ...xml.matchAll(
        /<generic:ObsDimension value="(\d{4}-\d{2})"[^>]*><\/generic:ObsDimension><generic:ObsValue value="(-?\d+(?:\.\d+)?)"/g,
      ),
    ]
      .map((match) => ({ month: match[1], rate: match[2] }))
      .filter((record) => record.month >= "2002-07");
    if (!observations.length)
      throw new Error("Bundesbank-SDMX-Antwort enthält keine Basiszinsbeobachtungen.");
    const periods: BaseRateSourceRecord[] = [];
    for (const observation of observations) {
      const previous = periods.at(-1);
      if (previous?.rate === observation.rate) continue;
      const validFrom = new Date(`${observation.month}-01T00:00:00.000Z`);
      periods.push({
        validFrom,
        rate: observation.rate,
        source: "Deutsche Bundesbank SDMX",
        sourceReference: "BBIN1.M.DE.BBK.BBKBAS2.EUR.ME",
        sourcePublishedAt: publishedAt,
        fetchedAt,
        sourceHash: createHash("sha256")
          .update(`${observation.month}|${observation.rate}`)
          .digest("hex"),
      });
    }
    return periods;
  }

  private parsePublishedAt(xml: string) {
    const prepared = xml.match(/<message:Prepared>([^<]+)<\/message:Prepared>/)?.[1];
    return prepared && !Number.isNaN(Date.parse(prepared)) ? new Date(prepared) : undefined;
  }
}
