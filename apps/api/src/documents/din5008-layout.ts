import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import PDFDocument from "pdfkit";

// PDFKit embeds the server-side Noto Sans font and performs Unicode-to-glyph mapping.
// The asset is backend-only and must be copied with the Nest build assets.
const mm = (value: number) => (value * 72) / 25.4;
const A4 = { width: mm(210), height: mm(297) };
const LAYOUT = { version: "DIN5008_2020_FORM_B_V1", left: mm(20), right: mm(20), addressTop: mm(45), addressWidth: mm(85), footerTop: mm(267) };
const sourceFont = existsSync(join(process.cwd(), "src", "documents", "assets", "NotoSans-Regular.ttf"))
  ? join(process.cwd(), "src", "documents", "assets", "NotoSans-Regular.ttf")
  : join(process.cwd(), "apps", "api", "src", "documents", "assets", "NotoSans-Regular.ttf");
const distFont = join(process.cwd(), "dist", "documents", "assets", "NotoSans-Regular.ttf");
const font = readFileSync(existsSync(sourceFont) ? sourceFont : distFont);
const get = (value: unknown, key: string) => typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;
const string = (value: unknown) => value == null ? "" : String(value);
const eur = (value: unknown) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(string(value)) || 0);

export async function renderDin5008Document(subject: string, body: string, snapshot: Record<string, unknown>) {
  const company = get(snapshot, "company"); const debtor = get(snapshot, "debtor"); const address = get(debtor, "address"); const ledger = get(snapshot, "ledger"); const caseData = get(snapshot, "case");
  if (!get(address, "street") || !get(address, "postalCode") || !get(address, "city")) throw new Error("Für diese Akte ist keine vollständige primäre Schuldneranschrift hinterlegt.");
  const pdf = new PDFDocument({ size: "A4", margin: 0, info: { Title: subject, Author: string(get(company, "name")), Subject: `${string(get(caseData, "caseNumber"))} · ${LAYOUT.version}`, Creator: "RisePay" } });
  pdf.registerFont("NotoSans", font); pdf.font("NotoSans"); const chunks: Buffer[] = []; pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
  const drawFooter = (page: number) => { pdf.fontSize(6.5).text([string(get(company, "legalName")) || string(get(company, "name")), `${string(get(company, "street"))} ${string(get(company, "houseNumber"))}`.trim(), `${string(get(company, "postalCode"))} ${string(get(company, "city"))}`].filter(Boolean).join("\n"), LAYOUT.left, mm(270), { width: mm(50) }); pdf.text([string(get(company, "phone")), string(get(company, "email")), string(get(company, "website"))].filter(Boolean).join("\n"), mm(78), mm(270), { width: mm(48) }); pdf.text(string(get(company, "footer")), mm(132), mm(270), { width: mm(50) }); pdf.text(`Seite ${page}`, mm(170), mm(287), { width: mm(20), align: "right" }); };
  let page = 1;
  const header = (first: boolean) => { if (first) { pdf.fontSize(14).text(string(get(company, "name")), LAYOUT.left, mm(21)); pdf.fontSize(7).text(`${string(get(company, "street"))} ${string(get(company, "houseNumber"))}`.trim(), LAYOUT.left, mm(28)); pdf.fontSize(6).text(`${string(get(company, "name"))} · ${string(get(company, "street"))} ${string(get(company, "postalCode"))} ${string(get(company, "city"))}`, LAYOUT.left, mm(48)); pdf.fontSize(10).text([string(get(debtor, "displayName")), string(get(address, "street")), `${string(get(address, "postalCode"))} ${string(get(address, "city"))}`, string(get(address, "country"))].filter(Boolean).join("\n"), LAYOUT.left, mm(57)); pdf.fontSize(8).text(`Aktenzeichen:  ${string(get(caseData, "caseNumber"))}\nTelefon:       ${string(get(company, "phone"))}\nE-Mail:        ${string(get(company, "email"))}\nDatum:         ${string(get(snapshot, "today"))}`, mm(125), mm(52)); pdf.fontSize(12).text(subject, LAYOUT.left, mm(103), { width: mm(170) }); return mm(115); } pdf.fontSize(8).text("RisePay", LAYOUT.left, mm(15)); pdf.text(`Aktenzeichen: ${string(get(caseData, "caseNumber"))}`, mm(120), mm(15), { width: mm(70), align: "right" }); return mm(27); };
  let y = header(true); const add = (value: string, options: Record<string, unknown> = {}) => { const height = pdf.heightOfString(value, { width: mm(170), ...options }); if (y + height > LAYOUT.footerTop) { drawFooter(page); pdf.addPage(); page += 1; y = header(false); } pdf.text(value, LAYOUT.left, y, { width: mm(170), ...options }); y += height + mm(2.4); };
  body.split(/\n\s*\n/).forEach((paragraph) => add(paragraph)); add("Forderungsaufstellung", { continued: false }); const positions = [["Hauptforderung", eur(get(ledger, "openPrincipal"))], ["Inkassokosten", eur(get(ledger, "openCosts"))], ["Zinsen", eur(get(ledger, "openInterest"))], ["Offener Gesamtbetrag", eur(get(ledger, "openTotal"))]]; positions.forEach(([label, amount]) => { add(label); pdf.text(amount, mm(150), y - mm(7.6), { width: mm(40), align: "right" }); });
  if (get(company, "iban")) { add("Zahlungsinformationen"); [["Zahlungsempfänger", string(get(company, "name"))], ["IBAN", string(get(company, "iban"))], ["BIC", string(get(company, "bic"))], ["Bank", string(get(company, "bankName"))], ["Verwendungszweck", string(get(caseData, "caseNumber"))]].filter(([, value]) => value).forEach(([label, value]) => add(`${label}    ${value}`)); }
  drawFooter(page); pdf.end(); return await new Promise<Buffer>((resolve) => pdf.on("end", () => resolve(Buffer.concat(chunks))));
}
export { LAYOUT as DIN5008_FORM_B };
