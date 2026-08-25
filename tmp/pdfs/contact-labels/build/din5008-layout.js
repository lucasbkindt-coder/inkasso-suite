"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DIN5008_FORM_B = exports.DIN5008_DESIGN = void 0;
exports.renderDin5008Document = renderDin5008Document;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const client_1 = require("@prisma/client");
const pdfkit_1 = __importDefault(require("pdfkit"));
const document_branding_1 = require("./document-branding");
const mm = (value) => (value * 72) / 25.4;
exports.DIN5008_DESIGN = {
    colors: {
        accent: document_branding_1.documentBranding.primaryColor,
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
};
const LAYOUT = {
    version: "DIN5008_2020_FORM_B_V1",
    left: mm(20),
    right: mm(190),
    contentWidth: mm(170),
    addressWidth: mm(85),
    contentBottom: mm(258),
    footerLine: mm(266),
    footerTop: mm(269),
};
exports.DIN5008_FORM_B = LAYOUT;
const sourceFont = (0, node_fs_1.existsSync)((0, node_path_1.join)(process.cwd(), "src", "documents", "assets", "NotoSans-Regular.ttf"))
    ? (0, node_path_1.join)(process.cwd(), "src", "documents", "assets", "NotoSans-Regular.ttf")
    : (0, node_path_1.join)(process.cwd(), "apps", "api", "src", "documents", "assets", "NotoSans-Regular.ttf");
const font = (0, node_fs_1.readFileSync)((0, node_fs_1.existsSync)(sourceFont) ? sourceFont : (0, node_path_1.join)(process.cwd(), "dist", "documents", "assets", "NotoSans-Regular.ttf"));
const get = (value, key) => typeof value === "object" && value !== null ? value[key] : undefined;
const text = (value) => value == null ? "" : String(value);
const nonEmpty = (...values) => values.map(text).filter(Boolean);
const decimal = (value) => new client_1.Prisma.Decimal(text(value) || "0");
const amount = (value) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(decimal(value).toFixed(2)));
const nonZeroAmount = (value) => decimal(value).gt(0) ? amount(value) : "";
function writeKeyValue(pdf, label, value, x, y, valueWidth) {
    pdf.fillColor(exports.DIN5008_DESIGN.colors.muted).fontSize(exports.DIN5008_DESIGN.fontSize.meta).text(label, x, y, { width: mm(34) });
    pdf.fillColor(exports.DIN5008_DESIGN.colors.ink).fontSize(exports.DIN5008_DESIGN.fontSize.table).text(value, x + mm(36), y, { width: valueWidth - mm(36) });
}
async function renderDin5008Document(subject, body, snapshot) {
    const company = get(snapshot, "company");
    const debtor = get(snapshot, "debtor");
    const address = get(debtor, "address");
    const ledger = get(snapshot, "ledger");
    const statement = get(snapshot, "claimStatement");
    const caseData = get(snapshot, "case");
    const portalAccess = get(snapshot, "portalAccess");
    const document = get(snapshot, "document");
    const installmentPlan = get(snapshot, "installmentPlan");
    const dueDate = text(get(document, "paymentDueDate"));
    if (!get(address, "street") || !get(address, "postalCode") || !get(address, "city")) {
        throw new Error("Für diese Akte ist keine vollständige primäre Schuldneranschrift hinterlegt.");
    }
    const pdf = new pdfkit_1.default({
        size: "A4",
        margin: 0,
        info: {
            Title: subject,
            Author: text(get(company, "legalName")) || text(get(company, "name")),
            Subject: `Aktenzeichen ${text(get(caseData, "caseNumber"))}`,
            Creator: document_branding_1.documentBranding.brandName,
        },
    });
    pdf.registerFont("NotoSans", font);
    pdf.font("NotoSans");
    const chunks = [];
    pdf.on("data", (chunk) => chunks.push(chunk));
    const drawHeader = (first) => {
        pdf.font("NotoSans").fillColor(exports.DIN5008_DESIGN.colors.ink);
        const logo = (0, document_branding_1.documentLogoPath)();
        if ((0, node_fs_1.existsSync)(logo))
            pdf.image(logo, LAYOUT.left, first ? mm(17) : mm(12), { width: first ? document_branding_1.documentBranding.logoWidth : mm(33) });
        if (!first) {
            pdf.fillColor(exports.DIN5008_DESIGN.colors.muted).fontSize(exports.DIN5008_DESIGN.fontSize.meta)
                .text(`Aktenzeichen ${text(get(caseData, "caseNumber"))}`, mm(119), mm(16), { width: mm(71), align: "right" });
            return mm(34);
        }
        pdf.fillColor(exports.DIN5008_DESIGN.colors.muted).fontSize(exports.DIN5008_DESIGN.fontSize.meta)
            .text(nonEmpty(text(get(company, "name")), `${text(get(company, "street"))} ${text(get(company, "houseNumber"))}`.trim(), `${text(get(company, "postalCode"))} ${text(get(company, "city"))}`.trim()).join(" · "), LAYOUT.left, mm(43), { width: LAYOUT.addressWidth });
        pdf.fillColor(exports.DIN5008_DESIGN.colors.ink).fontSize(10.1)
            .text(nonEmpty(get(debtor, "displayName"), get(address, "street") && `${text(get(address, "street"))} ${text(get(address, "houseNumber"))}`.trim(), `${text(get(address, "postalCode"))} ${text(get(address, "city"))}`.trim(), get(address, "country")).join("\n"), LAYOUT.left, mm(53), { width: LAYOUT.addressWidth, lineGap: 1.2 });
        const infoX = mm(135);
        const infoWidth = mm(55);
        let infoY = mm(43);
        const infoRows = [
            ["Aktenzeichen", text(get(caseData, "caseNumber"))],
            ["Datum", text(get(document, "date") || get(snapshot, "today"))],
            ["Telefon:", text(get(company, "phone"))],
            ["Fax:", text(get(company, "fax"))],
            ["E-Mail:", text(get(company, "email"))],
            ["Web:", text(get(company, "website"))],
        ].filter(([, value]) => value);
        for (const [label, value] of infoRows) {
            pdf.fillColor(exports.DIN5008_DESIGN.colors.muted).fontSize(exports.DIN5008_DESIGN.fontSize.meta).text(label, infoX, infoY, { width: mm(20) });
            pdf.fillColor(exports.DIN5008_DESIGN.colors.ink).fontSize(7.3).text(value, infoX + mm(20), infoY, { width: infoWidth - mm(20), align: "right" });
            infoY += mm(5.3);
        }
        pdf.fillColor(exports.DIN5008_DESIGN.colors.accent).fontSize(exports.DIN5008_DESIGN.fontSize.subject).text(subject, LAYOUT.left, mm(105), { width: LAYOUT.contentWidth });
        pdf.fillColor(exports.DIN5008_DESIGN.colors.muted).fontSize(8).text(`Aktenzeichen ${text(get(caseData, "caseNumber"))}`, LAYOUT.left, mm(113), { width: LAYOUT.contentWidth });
        return mm(125);
    };
    const drawFooter = (page) => {
        pdf.strokeColor(exports.DIN5008_DESIGN.colors.line).lineWidth(0.45).moveTo(LAYOUT.left, LAYOUT.footerLine).lineTo(LAYOUT.right, LAYOUT.footerLine).stroke();
        pdf.fillColor(exports.DIN5008_DESIGN.colors.muted).fontSize(exports.DIN5008_DESIGN.fontSize.footer);
        pdf.text(nonEmpty(text(get(company, "legalName")) || text(get(company, "name")), `${text(get(company, "street"))} ${text(get(company, "houseNumber"))}`.trim(), `${text(get(company, "postalCode"))} ${text(get(company, "city"))}`.trim(), get(company, "registrationCourt") && `Registergericht: ${text(get(company, "registrationCourt"))}`, get(company, "registrationNumber") && `Registernummer: ${text(get(company, "registrationNumber"))}`).join("\n"), LAYOUT.left, LAYOUT.footerTop, { width: mm(42), lineGap: 0.5 });
        pdf.text(nonEmpty(get(company, "phone") && `Telefon: ${text(get(company, "phone"))}`, get(company, "fax") && `Fax: ${text(get(company, "fax"))}`, get(company, "email") && `E-Mail: ${text(get(company, "email"))}`, get(company, "website") && `Web: ${text(get(company, "website"))}`).join("\n"), mm(65), LAYOUT.footerTop, { width: mm(35), lineGap: 0.5 });
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
    const ensure = (height) => {
        if (y + height > LAYOUT.contentBottom)
            newPage();
    };
    const drawSectionTitle = (title) => {
        ensure(mm(11));
        pdf.fillColor(exports.DIN5008_DESIGN.colors.accent).rect(LAYOUT.left, y + mm(2), mm(1.6), mm(3.2)).fill();
        pdf.fillColor(exports.DIN5008_DESIGN.colors.ink).fontSize(exports.DIN5008_DESIGN.fontSize.section).text(title, LAYOUT.left + mm(5), y, { width: LAYOUT.contentWidth - mm(5) });
        y += mm(8);
    };
    const drawParagraph = (value, options = {}) => {
        const size = options.size ?? exports.DIN5008_DESIGN.fontSize.body;
        pdf.font("NotoSans").fontSize(size).fillColor(options.color ?? exports.DIN5008_DESIGN.colors.ink);
        const height = pdf.heightOfString(value, { width: LAYOUT.contentWidth, lineGap: 2 });
        ensure(height + (options.gap ?? exports.DIN5008_DESIGN.spacing.m));
        pdf.text(value, LAYOUT.left, y, { width: LAYOUT.contentWidth, lineGap: 2 });
        y += height + (options.gap ?? exports.DIN5008_DESIGN.spacing.m);
    };
    const drawKeyValues = (rows) => {
        const rendered = rows.filter(([, value]) => value);
        if (!rendered.length)
            return;
        const height = rendered.reduce((sum, [, value]) => {
            pdf.fontSize(exports.DIN5008_DESIGN.fontSize.table);
            return sum + Math.max(mm(5.8), pdf.heightOfString(value, { width: mm(129), lineGap: 1 }) + mm(2));
        }, 0);
        ensure(height + exports.DIN5008_DESIGN.spacing.s);
        for (const [label, value] of rendered) {
            pdf.fontSize(exports.DIN5008_DESIGN.fontSize.table);
            const rowHeight = Math.max(mm(5.8), pdf.heightOfString(value, { width: mm(129), lineGap: 1 }) + mm(2));
            writeKeyValue(pdf, label, value, LAYOUT.left, y + mm(0.8), LAYOUT.contentWidth);
            pdf.strokeColor(exports.DIN5008_DESIGN.colors.line).lineWidth(0.3).moveTo(LAYOUT.left, y + rowHeight).lineTo(LAYOUT.right, y + rowHeight).stroke();
            y += rowHeight;
        }
        y += exports.DIN5008_DESIGN.spacing.s;
    };
    for (const paragraph of body.split(/\n\s*\n/).map((value) => value.trim()).filter(Boolean))
        drawParagraph(paragraph);
    if (text(get(document, "templateKey")) === "installment-agreement" && installmentPlan) {
        const items = Array.isArray(get(installmentPlan, "items")) ? get(installmentPlan, "items") : [];
        if (items.length) {
            drawSectionTitle("Ratenübersicht");
            const header = () => {
                ensure(mm(9));
                pdf.fillColor(exports.DIN5008_DESIGN.colors.muted).fontSize(exports.DIN5008_DESIGN.fontSize.meta)
                    .text("Rate", LAYOUT.left + mm(1.5), y + mm(2), { width: mm(24) })
                    .text("Fälligkeit", mm(62), y + mm(2), { width: mm(45) })
                    .text("Betrag", mm(142), y + mm(2), { width: mm(47), align: "right" });
                pdf.strokeColor(exports.DIN5008_DESIGN.colors.line).lineWidth(0.55).moveTo(LAYOUT.left, y + mm(6.6)).lineTo(LAYOUT.right, y + mm(6.6)).stroke();
                y += mm(7.8);
            };
            header();
            items.forEach((item, index) => {
                const rowHeight = mm(7.5);
                if (y + rowHeight > LAYOUT.contentBottom) {
                    newPage();
                    header();
                }
                if (index % 2 === 1)
                    pdf.fillColor("#FBFCFD").rect(LAYOUT.left, y, LAYOUT.contentWidth, rowHeight).fill();
                pdf.fillColor(exports.DIN5008_DESIGN.colors.ink).fontSize(exports.DIN5008_DESIGN.fontSize.table)
                    .text(String(get(item, "sequenceNumber") ?? ""), LAYOUT.left + mm(1.5), y + mm(1.6), { width: mm(24) })
                    .text(text(get(item, "dueDate")), mm(62), y + mm(1.6), { width: mm(45) })
                    .text(amount(get(item, "plannedAmount")), mm(142), y + mm(1.6), { width: mm(47), align: "right" });
                pdf.strokeColor(exports.DIN5008_DESIGN.colors.line).lineWidth(0.3).moveTo(LAYOUT.left, y + rowHeight).lineTo(LAYOUT.right, y + rowHeight).stroke();
                y += rowHeight;
            });
            y += exports.DIN5008_DESIGN.spacing.s;
        }
    }
    drawSectionTitle("Forderungsübersicht");
    const rows = Array.isArray(get(statement, "rows")) ? get(statement, "rows") : [];
    const tableHeader = () => {
        ensure(mm(10));
        pdf.fillColor(exports.DIN5008_DESIGN.colors.muted).fontSize(exports.DIN5008_DESIGN.fontSize.meta)
            .text("Datum", LAYOUT.left + mm(1.5), y + mm(2), { width: mm(19) })
            .text("Bezeichnung", mm(43), y + mm(2), { width: mm(59) })
            .text("Hauptforderung", mm(105), y + mm(2), { width: mm(27), align: "right" })
            .text("Kosten", mm(134), y + mm(2), { width: mm(26), align: "right" })
            .text("Zinsen", mm(162), y + mm(2), { width: mm(27), align: "right" });
        pdf.strokeColor(exports.DIN5008_DESIGN.colors.line).lineWidth(0.55).moveTo(LAYOUT.left, y + mm(6.6)).lineTo(LAYOUT.right, y + mm(6.6)).stroke();
        y += mm(7.8);
    };
    tableHeader();
    rows.forEach((row, index) => {
        pdf.fontSize(exports.DIN5008_DESIGN.fontSize.table);
        const rowHeight = Math.max(mm(8), pdf.heightOfString(text(row.description), { width: mm(59), lineGap: 1 }) + mm(3.2));
        if (y + rowHeight > LAYOUT.contentBottom) {
            newPage();
            tableHeader();
        }
        if (index % 2 === 1)
            pdf.fillColor("#FBFCFD").rect(LAYOUT.left, y, LAYOUT.contentWidth, rowHeight).fill();
        pdf.fillColor(exports.DIN5008_DESIGN.colors.ink).fontSize(exports.DIN5008_DESIGN.fontSize.table)
            .text(text(row.date), LAYOUT.left + mm(1.5), y + mm(1.5), { width: mm(19) })
            .text(text(row.description), mm(43), y + mm(1.5), { width: mm(59), lineGap: 1 })
            .text(nonZeroAmount(row.principalAmount), mm(105), y + mm(1.5), { width: mm(27), align: "right" })
            .text(nonZeroAmount(row.costAmount), mm(134), y + mm(1.5), { width: mm(26), align: "right" })
            .text(nonZeroAmount(row.interestAmount), mm(162), y + mm(1.5), { width: mm(27), align: "right" });
        pdf.strokeColor(exports.DIN5008_DESIGN.colors.line).lineWidth(0.3).moveTo(LAYOUT.left, y + rowHeight).lineTo(LAYOUT.right, y + rowHeight).stroke();
        y += rowHeight;
    });
    const totals = [
        ["Hauptforderung", get(statement, "principalTotal") ?? get(ledger, "openPrincipal")],
        ["Kosten", get(statement, "costTotal") ?? get(ledger, "openCosts")],
        ["Zinsen", get(statement, "interestTotal") ?? get(ledger, "openInterest")],
    ];
    ensure(mm(35));
    y += exports.DIN5008_DESIGN.spacing.m;
    for (const [label, value] of totals) {
        pdf.fillColor(exports.DIN5008_DESIGN.colors.muted).fontSize(7.8).text(label, mm(120), y, { width: mm(34) });
        pdf.fillColor(exports.DIN5008_DESIGN.colors.ink).fontSize(7.8).text(amount(value), mm(154), y, { width: mm(36), align: "right" });
        y += mm(5.8);
    }
    pdf.strokeColor(exports.DIN5008_DESIGN.colors.line).lineWidth(0.55).moveTo(mm(105), y + mm(0.5)).lineTo(LAYOUT.right, y + mm(0.5)).stroke();
    y += exports.DIN5008_DESIGN.spacing.s;
    const total = get(statement, "grandTotal") ?? get(ledger, "openTotal");
    pdf.fillColor(exports.DIN5008_DESIGN.colors.ink).fontSize(8.2).text("Zu zahlender Gesamtbetrag", mm(105), y + mm(2.2), { width: mm(38) });
    pdf.fillColor(exports.DIN5008_DESIGN.colors.accent).fontSize(exports.DIN5008_DESIGN.fontSize.amount).text(amount(total), mm(145), y + mm(1.3), { width: mm(45), align: "right" });
    if (dueDate)
        pdf.fillColor(exports.DIN5008_DESIGN.colors.muted).fontSize(6.5).text(`Zahlbar bis ${dueDate}`, mm(105), y + mm(9.5), { width: mm(66) });
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
        y += exports.DIN5008_DESIGN.spacing.s;
    }
    if (get(portalAccess, "mode") === "ACTIVE") {
        ensure(mm(15));
        pdf.fillColor(exports.DIN5008_DESIGN.colors.subtle).rect(LAYOUT.left, y, LAYOUT.contentWidth, mm(11)).fill();
        pdf.fillColor(exports.DIN5008_DESIGN.colors.muted).fontSize(8).text("Ihre Unterlagen und den aktuellen Forderungsstand können Sie auch im payveo Schuldnerportal einsehen.", LAYOUT.left + mm(3), y + mm(3), { width: LAYOUT.contentWidth - mm(6) });
        y += mm(15);
    }
    if (get(portalAccess, "mode") === "ACTIVATION") {
        const blockHeight = mm(44);
        ensure(blockHeight + exports.DIN5008_DESIGN.spacing.m);
        const top = y;
        pdf.fillColor(exports.DIN5008_DESIGN.colors.accentSoft).rect(LAYOUT.left, top, LAYOUT.contentWidth, blockHeight).fill();
        pdf.fillColor(exports.DIN5008_DESIGN.colors.accent).rect(LAYOUT.left, top, mm(4), blockHeight).fill();
        pdf.fillColor(exports.DIN5008_DESIGN.colors.ink).fontSize(10).text("Ihre Forderung online einsehen", LAYOUT.left + mm(8), top + mm(4), { width: mm(110) });
        pdf.fillColor(exports.DIN5008_DESIGN.colors.muted).fontSize(7.6).text("Aktivieren Sie Ihren persönlichen Zugang zum payveo Schuldnerportal.", LAYOUT.left + mm(8), top + mm(10), { width: mm(110) });
        pdf.fillColor(exports.DIN5008_DESIGN.colors.ink).fontSize(8).text(`Login-ID: ${text(get(portalAccess, "loginIdentifier"))}\nEinmalcode: ${text(get(portalAccess, "activationCode"))}`, LAYOUT.left + mm(8), top + mm(17), { width: mm(110), lineGap: 1.5 });
        pdf.fillColor(exports.DIN5008_DESIGN.colors.muted).fontSize(6.5).text("Aktivierung unter", LAYOUT.left + mm(8), top + mm(30), { width: mm(110) });
        pdf.fillColor(exports.DIN5008_DESIGN.colors.ink).fontSize(5.9).text(text(get(portalAccess, "activationUrl")), LAYOUT.left + mm(8), top + mm(34), { width: mm(110), lineBreak: false });
        const qrCode = get(portalAccess, "qrCode");
        if (Buffer.isBuffer(qrCode))
            pdf.image(qrCode, mm(157), top + mm(8), { width: mm(28), height: mm(28) });
        y += blockHeight + exports.DIN5008_DESIGN.spacing.m;
    }
    drawFooter(page);
    pdf.end();
    return await new Promise((resolve) => pdf.on("end", () => resolve(Buffer.concat(chunks))));
}
