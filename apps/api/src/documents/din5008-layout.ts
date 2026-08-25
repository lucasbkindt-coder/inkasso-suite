import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { Prisma } from "@prisma/client";
import PDFDocument from "pdfkit";

import { documentBranding, documentLogoPath } from "./document-branding";

const mm = (value: number) => (value * 72) / 25.4;

export const DIN5008_DESIGN = {
  colors: {
    accent: documentBranding.primaryColor,
    accentSoft: "#F4F7F8",
    ink: "#14212B",
    muted: "#5C6B76",
    line: "#D7E0E6",
    subtle: "#F6F8FA",
    white: "#FFFFFF",
  },
  fontSize: {
    meta: 6.8,
    table: 7.2,
    body: 9.4,
    section: 10.4,
    subject: 15,
    amount: 14.5,
    footer: 6.4,
  },
  spacing: {
    xs: mm(1.5),
    s: mm(2.5),
    m: mm(4),
    l: mm(6),
    xl: mm(9),
  },
} as const;

const LAYOUT = {
  version: "DIN5008_2020_FORM_B_V1",
  left: mm(20),
  right: mm(190),
  contentWidth: mm(170),
  addressWidth: mm(85),
  contentBottom: mm(258),
  footerLine: mm(266),
  footerTop: mm(269),
} as const;

const sourceFont = existsSync(join(process.cwd(), "src", "documents", "assets", "NotoSans-Regular.ttf"))
  ? join(process.cwd(), "src", "documents", "assets", "NotoSans-Regular.ttf")
  : join(process.cwd(), "apps", "api", "src", "documents", "assets", "NotoSans-Regular.ttf");
const font = readFileSync(existsSync(sourceFont) ? sourceFont : join(process.cwd(), "dist", "documents", "assets", "NotoSans-Regular.ttf"));

type RecordValue = Record<string, unknown>;
type StatementRow = { date?: unknown; description?: unknown; principalAmount?: unknown; costAmount?: unknown; interestAmount?: unknown };

const get = (value: unknown, key: string) => typeof value === "object" && value !== null ? (value as RecordValue)[key] : undefined;
const text = (value: unknown) => value == null ? "" : String(value);
const nonEmpty = (...values: unknown[]) => values.map(text).filter(Boolean);
const decimal = (value: unknown) => new Prisma.Decimal(text(value) || "0");
const amount = (value: unknown) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(decimal(value).toFixed(2)));
const nonZeroAmount = (value: unknown) => decimal(value).gt(0) ? amount(value) : "";

function writeKeyValue(pdf: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, valueWidth: number) {
  pdf.fillColor(DIN5008_DESIGN.colors.muted).fontSize(DIN5008_DESIGN.fontSize.meta).text(label, x, y, { width: mm(34) });
  pdf.fillColor(DIN5008_DESIGN.colors.ink).fontSize(DIN5008_DESIGN.fontSize.table).text(value, x + mm(36), y, { width: valueWidth - mm(36) });
}

export async function renderDin5008Document(subject: string, body: string, snapshot: Record<string, unknown>) {
  const company = get(snapshot, "company");
  const debtor = get(snapshot, "debtor");
  const address = get(debtor, "address");
  const ledger = get(snapshot, "ledger");
  const statement = get(snapshot, "claimStatement");
  const caseData = get(snapshot, "case");
  const portalAccess = get(snapshot, "portalAccess");
  const document = get(snapshot, "document");
  const dueDate = text(get(document, "paymentDueDate"));

  if (!get(address, "street") || !get(address, "postalCode") || !get(address, "city")) {
    throw new Error("Für diese Akte ist keine vollständige primäre Schuldneranschrift hinterlegt.");
  }

  const pdf = new PDFDocument({
    size: "A4",
    margin: 0,
    info: {
      Title: subject,
      Author: text(get(company, "legalName")) || text(get(company, "name")),
      Subject: `Aktenzeichen ${text(get(caseData, "caseNumber"))}`,
      Creator: documentBranding.brandName,
    },
  });
  pdf.registerFont("NotoSans", font);
  pdf.font("NotoSans");
  const chunks: Buffer[] = [];
  pdf.on("data", (chunk: Buffer) => chunks.push(chunk));

  const drawHeader = (first: boolean) => {
    pdf.font("NotoSans").fillColor(DIN5008_DESIGN.colors.ink);
    const logo = documentLogoPath();
    if (existsSync(logo)) pdf.image(logo, LAYOUT.left, first ? mm(17) : mm(12), { width: first ? documentBranding.logoWidth : mm(33) });

    if (!first) {
      pdf.fillColor(DIN5008_DESIGN.colors.muted).fontSize(DIN5008_DESIGN.fontSize.meta)
        .text(`Aktenzeichen ${text(get(caseData, "caseNumber"))}`, mm(119), mm(16), { width: mm(71), align: "right" });
      return mm(34);
    }

    pdf.fillColor(DIN5008_DESIGN.colors.muted).fontSize(DIN5008_DESIGN.fontSize.meta)
      .text(nonEmpty(text(get(company, "name")), `${text(get(company, "street"))} ${text(get(company, "houseNumber"))}`.trim(), `${text(get(company, "postalCode"))} ${text(get(company, "city"))}`.trim()).join(" · "), LAYOUT.left, mm(43), { width: LAYOUT.addressWidth });
    pdf.fillColor(DIN5008_DESIGN.colors.ink).fontSize(10.1)
      .text(nonEmpty(get(debtor, "displayName"), get(address, "street") && `${text(get(address, "street"))} ${text(get(address, "houseNumber"))}`.trim(), `${text(get(address, "postalCode"))} ${text(get(address, "city"))}`.trim(), get(address, "country")).join("\n"), LAYOUT.left, mm(53), { width: LAYOUT.addressWidth, lineGap: 1.2 });

    const infoX = mm(135);
    const infoWidth = mm(55);
    let infoY = mm(43);
    const infoRows = [
      ["Aktenzeichen", text(get(caseData, "caseNumber"))],
      ["Datum", text(get(document, "date") || get(snapshot, "today"))],
      ["Telefon", text(get(company, "phone"))],
      ["E-Mail", text(get(company, "email"))],
    ].filter(([, value]) => value);
    for (const [label, value] of infoRows) {
      pdf.fillColor(DIN5008_DESIGN.colors.muted).fontSize(DIN5008_DESIGN.fontSize.meta).text(label, infoX, infoY, { width: mm(20) });
      pdf.fillColor(DIN5008_DESIGN.colors.ink).fontSize(7.3).text(value, infoX + mm(20), infoY, { width: infoWidth - mm(20), align: "right" });
      infoY += mm(5.3);
    }

    pdf.fillColor(DIN5008_DESIGN.colors.accent).fontSize(DIN5008_DESIGN.fontSize.subject).text(subject, LAYOUT.left, mm(105), { width: LAYOUT.contentWidth });
    pdf.fillColor(DIN5008_DESIGN.colors.muted).fontSize(8).text(`Aktenzeichen ${text(get(caseData, "caseNumber"))}`, LAYOUT.left, mm(113), { width: LAYOUT.contentWidth });
    return mm(125);
  };

  const drawFooter = (page: number) => {
    pdf.strokeColor(DIN5008_DESIGN.colors.line).lineWidth(0.45).moveTo(LAYOUT.left, LAYOUT.footerLine).lineTo(LAYOUT.right, LAYOUT.footerLine).stroke();
    pdf.fillColor(DIN5008_DESIGN.colors.muted).fontSize(DIN5008_DESIGN.fontSize.footer);
    pdf.text(nonEmpty(text(get(company, "legalName")) || text(get(company, "name")), `${text(get(company, "street"))} ${text(get(company, "houseNumber"))}`.trim(), `${text(get(company, "postalCode"))} ${text(get(company, "city"))}`.trim(), get(company, "registrationCourt") && `Registergericht: ${text(get(company, "registrationCourt"))}`, get(company, "registrationNumber") && `Registernummer: ${text(get(company, "registrationNumber"))}`).join("\n"), LAYOUT.left, LAYOUT.footerTop, { width: mm(42), lineGap: 0.5 });
    pdf.text(nonEmpty(get(company, "phone"), get(company, "email"), get(company, "website")).join("\n"), mm(65), LAYOUT.footerTop, { width: mm(35), lineGap: 0.5 });
    pdf.text(nonEmpty(get(company, "iban") && `IBAN: ${text(get(company, "iban"))}`, get(company, "bic") && `BIC: ${text(get(company, "bic"))}`, get(company, "bankName")).join("\n"), mm(106), LAYOUT.footerTop, { width: mm(41), lineGap: 0.5 });
    pdf.fontSize(5.3).text(nonEmpty(get(company, "collectionRegistrationAuthority"), get(company, "collectionRegistrationAddress"), get(company, "collectionRegistrationContact")).join("\n") || text(get(company, "footer")), mm(151), LAYOUT.footerTop, { width: mm(37), lineGap: 0.5 });
    pdf.fontSize(6).text(`Seite ${page}`, mm(170), mm(288), { width: mm(20), align: "right" });
  };

  let page = 1;
  let y = drawHeader(true);
  const newPage = () => {
    drawFooter(page);
    pdf.addPage();
    page += 1;
    y = drawHeader(false);
  };
  const ensure = (height: number) => {
    if (y + height > LAYOUT.contentBottom) newPage();
  };
  const drawSectionTitle = (title: string) => {
    ensure(mm(11));
    pdf.fillColor(DIN5008_DESIGN.colors.accent).rect(LAYOUT.left, y + mm(2), mm(1.6), mm(3.2)).fill();
    pdf.fillColor(DIN5008_DESIGN.colors.ink).fontSize(DIN5008_DESIGN.fontSize.section).text(title, LAYOUT.left + mm(5), y, { width: LAYOUT.contentWidth - mm(5) });
    y += mm(8);
  };
  const drawParagraph = (value: string, options: { color?: string; gap?: number; size?: number } = {}) => {
    const size = options.size ?? DIN5008_DESIGN.fontSize.body;
    pdf.font("NotoSans").fontSize(size).fillColor(options.color ?? DIN5008_DESIGN.colors.ink);
    const height = pdf.heightOfString(value, { width: LAYOUT.contentWidth, lineGap: 2 });
    ensure(height + (options.gap ?? DIN5008_DESIGN.spacing.m));
    pdf.text(value, LAYOUT.left, y, { width: LAYOUT.contentWidth, lineGap: 2 });
    y += height + (options.gap ?? DIN5008_DESIGN.spacing.m);
  };
  const drawKeyValues = (rows: Array<[string, string]>) => {
    const rendered = rows.filter(([, value]) => value);
    if (!rendered.length) return;
    const height = rendered.reduce((sum, [, value]) => {
      pdf.fontSize(DIN5008_DESIGN.fontSize.table);
      return sum + Math.max(mm(5.8), pdf.heightOfString(value, { width: mm(129), lineGap: 1 }) + mm(2));
    }, 0);
    ensure(height + DIN5008_DESIGN.spacing.s);
    for (const [label, value] of rendered) {
      pdf.fontSize(DIN5008_DESIGN.fontSize.table);
      const rowHeight = Math.max(mm(5.8), pdf.heightOfString(value, { width: mm(129), lineGap: 1 }) + mm(2));
      writeKeyValue(pdf, label, value, LAYOUT.left, y + mm(0.8), LAYOUT.contentWidth);
      pdf.strokeColor(DIN5008_DESIGN.colors.line).lineWidth(0.3).moveTo(LAYOUT.left, y + rowHeight).lineTo(LAYOUT.right, y + rowHeight).stroke();
      y += rowHeight;
    }
    y += DIN5008_DESIGN.spacing.s;
  };

  for (const paragraph of body.split(/\n\s*\n/).map((value) => value.trim()).filter(Boolean)) drawParagraph(paragraph);

  drawSectionTitle("Forderungsübersicht");
  const rows = Array.isArray(get(statement, "rows")) ? get(statement, "rows") as StatementRow[] : [];
  const tableHeader = () => {
    ensure(mm(10));
    pdf.fillColor(DIN5008_DESIGN.colors.muted).fontSize(DIN5008_DESIGN.fontSize.meta)
      .text("Datum", LAYOUT.left + mm(1.5), y + mm(2), { width: mm(19) })
      .text("Bezeichnung", mm(43), y + mm(2), { width: mm(59) })
      .text("Hauptforderung", mm(105), y + mm(2), { width: mm(27), align: "right" })
      .text("Kosten", mm(134), y + mm(2), { width: mm(26), align: "right" })
      .text("Zinsen", mm(162), y + mm(2), { width: mm(27), align: "right" });
    pdf.strokeColor(DIN5008_DESIGN.colors.line).lineWidth(0.55).moveTo(LAYOUT.left, y + mm(6.6)).lineTo(LAYOUT.right, y + mm(6.6)).stroke();
    y += mm(7.8);
  };
  tableHeader();
  rows.forEach((row, index) => {
    pdf.fontSize(DIN5008_DESIGN.fontSize.table);
    const rowHeight = Math.max(mm(8), pdf.heightOfString(text(row.description), { width: mm(59), lineGap: 1 }) + mm(3.2));
    if (y + rowHeight > LAYOUT.contentBottom) {
      newPage();
      tableHeader();
    }
    if (index % 2 === 1) pdf.fillColor("#FBFCFD").rect(LAYOUT.left, y, LAYOUT.contentWidth, rowHeight).fill();
    pdf.fillColor(DIN5008_DESIGN.colors.ink).fontSize(DIN5008_DESIGN.fontSize.table)
      .text(text(row.date), LAYOUT.left + mm(1.5), y + mm(1.5), { width: mm(19) })
      .text(text(row.description), mm(43), y + mm(1.5), { width: mm(59), lineGap: 1 })
      .text(nonZeroAmount(row.principalAmount), mm(105), y + mm(1.5), { width: mm(27), align: "right" })
      .text(nonZeroAmount(row.costAmount), mm(134), y + mm(1.5), { width: mm(26), align: "right" })
      .text(nonZeroAmount(row.interestAmount), mm(162), y + mm(1.5), { width: mm(27), align: "right" });
    pdf.strokeColor(DIN5008_DESIGN.colors.line).lineWidth(0.3).moveTo(LAYOUT.left, y + rowHeight).lineTo(LAYOUT.right, y + rowHeight).stroke();
    y += rowHeight;
  });

  const totals = [
    ["Hauptforderung", get(statement, "principalTotal") ?? get(ledger, "openPrincipal")],
    ["Kosten", get(statement, "costTotal") ?? get(ledger, "openCosts")],
    ["Zinsen", get(statement, "interestTotal") ?? get(ledger, "openInterest")],
  ] as const;
  ensure(mm(35));
  y += DIN5008_DESIGN.spacing.m;
  for (const [label, value] of totals) {
    pdf.fillColor(DIN5008_DESIGN.colors.muted).fontSize(7.8).text(label, mm(120), y, { width: mm(34) });
    pdf.fillColor(DIN5008_DESIGN.colors.ink).fontSize(7.8).text(amount(value), mm(154), y, { width: mm(36), align: "right" });
    y += mm(5.8);
  }
  pdf.strokeColor(DIN5008_DESIGN.colors.line).lineWidth(0.55).moveTo(mm(105), y + mm(0.5)).lineTo(LAYOUT.right, y + mm(0.5)).stroke();
  y += DIN5008_DESIGN.spacing.s;
  const total = get(statement, "grandTotal") ?? get(ledger, "openTotal");
  pdf.fillColor(DIN5008_DESIGN.colors.ink).fontSize(8.2).text("Zu zahlender Gesamtbetrag", mm(105), y + mm(2.2), { width: mm(38) });
  pdf.fillColor(DIN5008_DESIGN.colors.accent).fontSize(DIN5008_DESIGN.fontSize.amount).text(amount(total), mm(145), y + mm(1.3), { width: mm(45), align: "right" });
  if (dueDate) pdf.fillColor(DIN5008_DESIGN.colors.muted).fontSize(6.5).text(`Zahlbar bis ${dueDate}`, mm(105), y + mm(9.5), { width: mm(66) });
  y += mm(18);

  if (get(company, "iban")) {
    drawSectionTitle("Zahlungsinformationen");
    drawKeyValues([
      ["Zahlungsempfänger", text(get(company, "legalName")) || text(get(company, "name"))],
      ["IBAN", text(get(company, "iban"))],
      ["BIC", text(get(company, "bic"))],
      ["Bank", text(get(company, "bankName"))],
      ["Verwendungszweck", text(get(caseData, "caseNumber"))],
    ]);
    y += DIN5008_DESIGN.spacing.s;
  }

  if (get(portalAccess, "mode") === "ACTIVE") {
    ensure(mm(15));
    pdf.fillColor(DIN5008_DESIGN.colors.subtle).rect(LAYOUT.left, y, LAYOUT.contentWidth, mm(11)).fill();
    pdf.fillColor(DIN5008_DESIGN.colors.muted).fontSize(8).text("Ihre Unterlagen und den aktuellen Forderungsstand können Sie auch im payveo Schuldnerportal einsehen.", LAYOUT.left + mm(3), y + mm(3), { width: LAYOUT.contentWidth - mm(6) });
    y += mm(15);
  }
  if (get(portalAccess, "mode") === "ACTIVATION") {
    const blockHeight = mm(44);
    ensure(blockHeight + DIN5008_DESIGN.spacing.m);
    const top = y;
    pdf.fillColor(DIN5008_DESIGN.colors.accentSoft).rect(LAYOUT.left, top, LAYOUT.contentWidth, blockHeight).fill();
    pdf.fillColor(DIN5008_DESIGN.colors.accent).rect(LAYOUT.left, top, mm(4), blockHeight).fill();
    pdf.fillColor(DIN5008_DESIGN.colors.ink).fontSize(10).text("Ihre Forderung online einsehen", LAYOUT.left + mm(8), top + mm(4), { width: mm(110) });
    pdf.fillColor(DIN5008_DESIGN.colors.muted).fontSize(7.6).text("Aktivieren Sie Ihren persönlichen Zugang zum payveo Schuldnerportal.", LAYOUT.left + mm(8), top + mm(10), { width: mm(110) });
    pdf.fillColor(DIN5008_DESIGN.colors.ink).fontSize(8).text(`Login-ID: ${text(get(portalAccess, "loginIdentifier"))}\nEinmalcode: ${text(get(portalAccess, "activationCode"))}`, LAYOUT.left + mm(8), top + mm(17), { width: mm(110), lineGap: 1.5 });
    pdf.fillColor(DIN5008_DESIGN.colors.muted).fontSize(6.5).text("Aktivierung unter", LAYOUT.left + mm(8), top + mm(30), { width: mm(110) });
    pdf.fillColor(DIN5008_DESIGN.colors.ink).fontSize(5.9).text(text(get(portalAccess, "activationUrl")), LAYOUT.left + mm(8), top + mm(34), { width: mm(110), lineBreak: false });
    const qrCode = get(portalAccess, "qrCode");
    if (Buffer.isBuffer(qrCode)) pdf.image(qrCode, mm(157), top + mm(8), { width: mm(28), height: mm(28) });
    y += blockHeight + DIN5008_DESIGN.spacing.m;
  }

  drawFooter(page);

  pdf.end();
  return await new Promise<Buffer>((resolve) => pdf.on("end", () => resolve(Buffer.concat(chunks))));
}

export { LAYOUT as DIN5008_FORM_B };
