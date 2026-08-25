import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { Prisma } from "@prisma/client";
import PDFDocument from "pdfkit";

import { documentBranding, documentLogoPath } from "./document-branding";

const mm = (value: number) => (value * 72) / 25.4;
const LAYOUT = { version: "DIN5008_2020_FORM_B_V1", left: mm(20), contentWidth: mm(170), addressWidth: mm(85), footerTop: mm(267) } as const;
const sourceFont = existsSync(join(process.cwd(), "src", "documents", "assets", "NotoSans-Regular.ttf")) ? join(process.cwd(), "src", "documents", "assets", "NotoSans-Regular.ttf") : join(process.cwd(), "apps", "api", "src", "documents", "assets", "NotoSans-Regular.ttf");
const font = readFileSync(existsSync(sourceFont) ? sourceFont : join(process.cwd(), "dist", "documents", "assets", "NotoSans-Regular.ttf"));
const get = (value: unknown, key: string) => typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;
const text = (value: unknown) => value == null ? "" : String(value);
const nonEmpty = (...values: unknown[]) => values.map(text).filter(Boolean);
const amount = (value: unknown) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(new Prisma.Decimal(text(value) || "0").toFixed(2)));

export async function renderDin5008Document(subject: string, body: string, snapshot: Record<string, unknown>) {
  const company = get(snapshot, "company"); const debtor = get(snapshot, "debtor"); const address = get(debtor, "address"); const ledger = get(snapshot, "ledger"); const statement = get(snapshot, "claimStatement"); const caseData = get(snapshot, "case"); const portalAccess = get(snapshot, "portalAccess"); const document = get(snapshot, "document"); const legal = get(snapshot, "legalDetails");
  if (!get(address, "street") || !get(address, "postalCode") || !get(address, "city")) throw new Error("Für diese Akte ist keine vollständige primäre Schuldneranschrift hinterlegt.");
  const pdf = new PDFDocument({ size: "A4", margin: 0, info: { Title: subject, Author: text(get(company, "legalName")) || text(get(company, "name")), Subject: `${text(get(caseData, "caseNumber"))} · ${LAYOUT.version}`, Creator: documentBranding.brandName } });
  pdf.registerFont("NotoSans", font); pdf.font("NotoSans"); const chunks: Buffer[] = []; pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
  const footer = (page: number) => {
    pdf.strokeColor(documentBranding.mutedLineColor).lineWidth(0.45).moveTo(LAYOUT.left, mm(266)).lineTo(mm(190), mm(266)).stroke(); pdf.fillColor("#000000").font("NotoSans").fontSize(6.4);
    pdf.text(nonEmpty(text(get(company, "legalName")) || text(get(company, "name")), `${text(get(company, "street"))} ${text(get(company, "houseNumber"))}`.trim(), `${text(get(company, "postalCode"))} ${text(get(company, "city"))}`.trim(), get(company, "registrationCourt") && `Registergericht: ${text(get(company, "registrationCourt"))}`, get(company, "registrationNumber") && `Registernummer: ${text(get(company, "registrationNumber"))}`).join("\n"), LAYOUT.left, mm(269), { width: mm(43) });
    pdf.text(nonEmpty(get(company, "phone"), get(company, "email"), get(company, "website")).join("\n"), mm(66), mm(269), { width: mm(34) });
    pdf.text(nonEmpty(get(company, "iban") && `IBAN: ${text(get(company, "iban"))}`, get(company, "bic") && `BIC: ${text(get(company, "bic"))}`, get(company, "bankName")).join("\n"), mm(106), mm(269), { width: mm(42) });
    pdf.text(nonEmpty(get(company, "collectionRegistrationAuthority"), get(company, "collectionRegistrationContact")).join("\n") || text(get(company, "footer")), mm(151), mm(269), { width: mm(34) });
    pdf.fontSize(6).text(`Seite ${page}`, mm(170), mm(288), { width: mm(20), align: "right" });
  };
  let page = 1;
  const header = (first: boolean) => {
    pdf.font("NotoSans").fillColor("#000000");
    if (!first) { const logo = documentLogoPath(); if (existsSync(logo)) pdf.image(logo, LAYOUT.left, mm(13), { width: mm(35) }); pdf.fontSize(7.4).text(`Aktenzeichen: ${text(get(caseData, "caseNumber"))}`, mm(118), mm(16), { width: mm(72), align: "right" }); pdf.strokeColor(documentBranding.mutedLineColor).lineWidth(0.45).moveTo(LAYOUT.left, mm(25)).lineTo(mm(190), mm(25)).stroke(); return mm(31); }
    const logo = documentLogoPath(); if (existsSync(logo)) pdf.image(logo, LAYOUT.left, mm(17), { width: documentBranding.logoWidth }); pdf.strokeColor(documentBranding.primaryColor).lineWidth(1.2).moveTo(LAYOUT.left, mm(37)).lineTo(mm(190), mm(37)).stroke();
    pdf.fillColor("#000000").fontSize(6.2).text(nonEmpty(text(get(company, "name")), `${text(get(company, "street"))} ${text(get(company, "houseNumber"))}`.trim(), `${text(get(company, "postalCode"))} ${text(get(company, "city"))}`.trim()).join(" · "), LAYOUT.left, mm(47), { width: LAYOUT.addressWidth });
    pdf.fontSize(10).text(nonEmpty(get(debtor, "displayName"), get(address, "street") && `${text(get(address, "street"))} ${text(get(address, "houseNumber"))}`.trim(), `${text(get(address, "postalCode"))} ${text(get(address, "city"))}`.trim(), get(address, "country")).join("\n"), LAYOUT.left, mm(57), { width: LAYOUT.addressWidth });
    pdf.fontSize(7.8).text(nonEmpty(`Aktenzeichen: ${text(get(caseData, "caseNumber"))}`, get(company, "phone") && `Telefon: ${text(get(company, "phone"))}`, get(company, "email") && `E-Mail: ${text(get(company, "email"))}`, `Datum: ${text(get(document, "date") || get(snapshot, "today"))}`).join("\n"), mm(128), mm(48), { width: mm(62) });
    pdf.fillColor(documentBranding.primaryColor).fontSize(13).text(subject, LAYOUT.left, mm(103), { width: LAYOUT.contentWidth }); pdf.fillColor("#000000"); return mm(116);
  };
  let y = header(true); const newPage = () => { footer(page); pdf.addPage(); page += 1; y = header(false); }; const ensure = (height: number) => { if (y + height > LAYOUT.footerTop) newPage(); };
  const add = (value: string, options: { size?: number; color?: string; gap?: number } = {}) => { const size = options.size ?? 9.2; pdf.font("NotoSans").fontSize(size).fillColor(options.color ?? "#000000"); const height = pdf.heightOfString(value, { width: LAYOUT.contentWidth, lineGap: 1.5 }); ensure(height); pdf.text(value, LAYOUT.left, y, { width: LAYOUT.contentWidth, lineGap: 1.5 }); y += height + (options.gap ?? mm(2.4)); };
  body.split(/\n\s*\n/).map((value) => value.trim()).filter(Boolean).forEach((paragraph) => add(paragraph));
  const legalRows = Array.isArray(get(legal, "rows")) ? get(legal, "rows") as Array<Record<string, unknown>> : [];
  if (legalRows.length) { add("Angaben zur Forderung", { size: 10.5, color: documentBranding.primaryColor, gap: mm(1.2) }); legalRows.forEach((row) => add(`${text(row.label)}: ${text(row.value)}`, { size: 8.4, gap: mm(0.9) })); }
  add("Forderungsübersicht", { size: 10.5, color: documentBranding.primaryColor, gap: mm(1.2) }); const rows = Array.isArray(get(statement, "rows")) ? get(statement, "rows") as Array<Record<string, unknown>> : [];
  const tableHeader = () => { ensure(mm(8)); pdf.fillColor(documentBranding.primaryColor).rect(LAYOUT.left, y, LAYOUT.contentWidth, mm(5.6)).fill(); pdf.fillColor("#FFFFFF").fontSize(6.7).text("Datum", LAYOUT.left + mm(1.4), y + mm(1.5), { width: mm(20) }).text("Bezeichnung", mm(43), y + mm(1.5), { width: mm(58) }).text("Hauptforderung", mm(105), y + mm(1.5), { width: mm(27), align: "right" }).text("Kosten", mm(134), y + mm(1.5), { width: mm(26), align: "right" }).text("Zinsen", mm(162), y + mm(1.5), { width: mm(27), align: "right" }); y += mm(7.5); };
  tableHeader(); for (const row of rows) { const height = Math.max(mm(6.6), pdf.heightOfString(text(row.description), { width: mm(58), lineGap: 0.5 }) + mm(2)); if (y + height > LAYOUT.footerTop) { newPage(); tableHeader(); } pdf.fillColor("#000000").fontSize(6.8).text(text(row.date), LAYOUT.left + mm(1.4), y + mm(1), { width: mm(20) }).text(text(row.description), mm(43), y + mm(1), { width: mm(58), lineGap: 0.5 }).text(new Prisma.Decimal(text(row.principalAmount) || "0").gt(0) ? amount(row.principalAmount) : "", mm(105), y + mm(1), { width: mm(27), align: "right" }).text(new Prisma.Decimal(text(row.costAmount) || "0").gt(0) ? amount(row.costAmount) : "", mm(134), y + mm(1), { width: mm(26), align: "right" }).text(new Prisma.Decimal(text(row.interestAmount) || "0").gt(0) ? amount(row.interestAmount) : "", mm(162), y + mm(1), { width: mm(27), align: "right" }); y += height; }
  [["Hauptforderung", get(statement, "principalTotal") ?? get(ledger, "openPrincipal")], ["Kosten", get(statement, "costTotal") ?? get(ledger, "openCosts")], ["Zinsen", get(statement, "interestTotal") ?? get(ledger, "openInterest")]].forEach(([label, value]) => { ensure(mm(6)); pdf.fillColor("#000000").fontSize(7.4).text(String(label), mm(122), y, { width: mm(30) }); pdf.text(amount(value), mm(153), y, { width: mm(37), align: "right" }); y += mm(5.4); });
  ensure(mm(9)); pdf.fillColor(documentBranding.primaryColor).rect(mm(120), y - mm(1), mm(70), mm(7.4)).fill(); pdf.fillColor("#FFFFFF").fontSize(8.2).text("Zu zahlender Gesamtbetrag", mm(122), y + mm(0.9), { width: mm(38) }); pdf.text(amount(get(statement, "grandTotal") ?? get(ledger, "openTotal")), mm(160), y + mm(0.9), { width: mm(28), align: "right" }); y += mm(10);
  if (get(company, "iban")) { add("Zahlungsinformationen", { size: 10.5, color: documentBranding.primaryColor, gap: mm(1.2) }); [["Zahlungsempfänger", text(get(company, "legalName")) || text(get(company, "name"))], ["IBAN", text(get(company, "iban"))], ["BIC", text(get(company, "bic"))], ["Bank", text(get(company, "bankName"))], ["Verwendungszweck", text(get(caseData, "caseNumber"))]].filter(([, value]) => value).forEach(([label, value]) => add(`${label}: ${value}`, { size: 8.6, gap: mm(0.8) })); }
  if (get(portalAccess, "mode") === "ACTIVE") add("Sie können die Forderungsdetails und Dokumente auch in Ihrem payveo Schuldnerportal einsehen.", { size: 8.6 });
  if (get(portalAccess, "mode") === "ACTIVATION") { const blockHeight = mm(45); ensure(blockHeight); const top = y; pdf.roundedRect(LAYOUT.left, top, LAYOUT.contentWidth, blockHeight, mm(1.5)).strokeColor(documentBranding.mutedLineColor).lineWidth(0.55).stroke(); pdf.fillColor(documentBranding.primaryColor).fontSize(9.2).text("Online-Zugang zum payveo Schuldnerportal", LAYOUT.left + mm(4), top + mm(3.5), { width: mm(118) }); pdf.fillColor("#000000").fontSize(7.8).text(`Login-ID: ${text(get(portalAccess, "loginIdentifier"))}\nAktivierungscode: ${text(get(portalAccess, "activationCode"))}`, LAYOUT.left + mm(4), top + mm(10), { width: mm(108) }); pdf.fontSize(6.7).text("Aktivieren Sie Ihren Zugang einmalig unter:", LAYOUT.left + mm(4), top + mm(22), { width: mm(108) }); pdf.fontSize(5.8).text(text(get(portalAccess, "activationUrl")), LAYOUT.left + mm(4), top + mm(28), { width: mm(108), lineBreak: false }); const qrCode = get(portalAccess, "qrCode"); if (Buffer.isBuffer(qrCode)) pdf.image(qrCode, mm(157), top + mm(8), { width: mm(28), height: mm(28) }); y += blockHeight + mm(2.4); }
  footer(page); pdf.end(); return await new Promise<Buffer>((resolve) => pdf.on("end", () => resolve(Buffer.concat(chunks))));
}

export { LAYOUT as DIN5008_FORM_B };
