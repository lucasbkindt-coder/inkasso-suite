import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import QRCode from "../../../apps/api/node_modules/qrcode/lib/index.js";

import { renderDin5008Document } from "./build/din5008-layout.js";

const output = join(process.cwd(), "output", "pdf", "document-design-p2");
mkdirSync(output, { recursive: true });

const company = {
  name: "payveo Forderungsmanagement GmbH",
  legalName: "payveo Forderungsmanagement GmbH",
  street: "Hafenstraße",
  houseNumber: "18",
  postalCode: "20457",
  city: "Hamburg",
  phone: "+49 40 123 45 67",
  email: "service@payveo.de",
  website: "www.payveo.de",
  iban: "DE89 3704 0044 0532 0130 00",
  bic: "COBADEFFXXX",
  bankName: "Commerzbank AG",
  registrationCourt: "Amtsgericht Hamburg",
  registrationNumber: "HRB 123456",
  collectionRegistrationAuthority: "Freie und Hansestadt Hamburg, Bezirksamt Hamburg-Mitte",
  collectionRegistrationAddress: "Caffamacherreihe 1-3, 20355 Hamburg",
  collectionRegistrationContact: "inkassoaufsicht@hamburg.de",
};

const rows = [
  { date: "03.01.2026", description: "Hauptforderung aus Rechnung RE-2026-1001", principalAmount: "1248.53", costAmount: "0.00", interestAmount: "0.00" },
  { date: "08.01.2026", description: "RVG-Inkassogebühr", principalAmount: "0.00", costAmount: "156.50", interestAmount: "0.00" },
  { date: "08.01.2026", description: "Auslagenpauschale nach VV RVG", principalAmount: "0.00", costAmount: "20.00", interestAmount: "0.00" },
  { date: "31.08.2026", description: "Verzugszinsen 04.01.2026 bis 31.08.2026", principalAmount: "0.00", costAmount: "0.00", interestAmount: "64.82" },
];

function snapshot(options: { companyDebtor?: boolean; longTable?: boolean; portal?: "ACTIVE" | "ACTIVATION"; subject?: string }) {
  const statementRows = options.longTable
    ? Array.from({ length: 30 }, (_, index) => ({
      date: `${String((index % 27) + 1).padStart(2, "0")}.08.2026`,
      description: `Forderungsposition ${index + 1}: ausführliche Leistungsbeschreibung mit nachvollziehbarem Bezug zur beauftragten Dienstleistung und zur Rechnung RE-2026-${String(index + 1).padStart(4, "0")}.`,
      principalAmount: index === 0 ? "1234567.89" : "0.00",
      costAmount: index % 3 === 0 ? "999.99" : "0.00",
      interestAmount: index % 4 === 0 ? "9.99" : "0.00",
    }))
    : rows;
  const totals = statementRows.reduce((sum, row) => ({ principal: sum.principal + Number(row.principalAmount), costs: sum.costs + Number(row.costAmount), interest: sum.interest + Number(row.interestAmount) }), { principal: 0, costs: 0, interest: 0 });
  return {
    company,
    debtor: {
      type: options.companyDebtor ? "COMPANY" : "PERSON",
      displayName: options.companyDebtor ? "Musterhandel GmbH" : "Max Mustermann",
      address: { street: "Musterstraße", houseNumber: "12", postalCode: "50667", city: "Köln", country: "DE" },
    },
    case: { caseNumber: options.longTable ? "0000042/2026" : "0000001/2026" },
    document: { date: "25.08.2026", paymentDueDate: "15.09.2026", templateKey: options.subject ?? "payment-request" },
    ledger: { openPrincipal: totals.principal.toFixed(2), openCosts: totals.costs.toFixed(2), openInterest: totals.interest.toFixed(2), openTotal: (totals.principal + totals.costs + totals.interest).toFixed(2) },
    claimStatement: { rows: statementRows, principalTotal: totals.principal.toFixed(2), costTotal: totals.costs.toFixed(2), interestTotal: totals.interest.toFixed(2), grandTotal: (totals.principal + totals.costs + totals.interest).toFixed(2) },
    legalDetails: {
      narrative: options.companyDebtor ? [] : [
        "Muster GmbH hat uns mit der Einziehung der gegen Sie bestehenden Forderung beauftragt.",
        "Anschrift des Auftraggebers: Beispielallee 7, 10115 Berlin.",
        "Die zugrunde liegende Hauptforderung beträgt 1.248,53 € und betrifft die Bereitstellung von IT-Dienstleistungen. Rechnung RE-2026-1001 vom 03.01.2026 war am 03.01.2026 fällig.",
        "Auf die verzinsliche Forderung von 1.248,53 € werden für den Zeitraum vom 04.01.2026 bis 31.08.2026 Verzugszinsen in Höhe von 9,12 % p.a. berechnet. Bis zum Berechnungsstichtag belaufen sich diese auf 64,82 €.",
        "Die geltend gemachten Inkassokosten betragen 176,50 €. Es handelt sich um außergerichtliche Inkassokosten aus der Beauftragung mit der Forderungseinziehung.",
      ],
    },
  };
}

async function write(name: string, subject: string, body: string, data: Record<string, unknown>) {
  writeFileSync(join(output, name), await renderDin5008Document(subject, body, data));
}

const activationUrl = "http://192.168.178.56:3000/portal/aktivieren?login=payveo-123&code=ABCD-EFGH";
const qrCode = await QRCode.toBuffer(activationUrl, { width: 180, margin: 1 });
const person = snapshot({ portal: "ACTIVATION" });
await write("01-payment-request-person.pdf", "Zahlungsaufforderung", "Sehr geehrter Herr Mustermann,\n\nMuster GmbH hat uns mit der Einziehung der gegen Sie bestehenden Forderung beauftragt. Die Anschrift des Auftraggebers lautet Beispielallee 7, 10115 Berlin. Die Forderung betrifft die Bereitstellung von IT-Dienstleistungen und wurde mit Rechnung RE-2026-1001 vom 03.01.2026 abgerechnet. Der Rechnungsbetrag war am 03.01.2026 zur Zahlung fällig.\n\nDie noch offene Hauptforderung beträgt 1.248,53 €. Auf die verzinsliche Forderung fallen für den Zeitraum vom 04.01.2026 bis 31.08.2026 Verzugszinsen in Höhe von 9,12 % p.a. an; bis zum Berechnungsstichtag belaufen sie sich auf 64,82 €. Daneben sind die aufgrund des Zahlungsverzugs entstandenen Inkassokosten in Höhe von 176,50 € zu erstatten.\n\nWir fordern Sie daher auf, den nachstehend ausgewiesenen Gesamtbetrag von 1.489,85 € bis spätestens zum 15.09.2026 auszugleichen.", { ...person, portalAccess: { mode: "ACTIVATION", loginIdentifier: "payveo-123", activationCode: "ABCD-EFGH", activationUrl, qrCode } });
await write("02-payment-request-company.pdf", "Zahlungsaufforderung", "Sehr geehrte Damen und Herren,\n\nMuster GmbH hat uns mit der Einziehung der gegen Sie bestehenden Forderung beauftragt. Die Forderung betrifft die Bereitstellung von IT-Dienstleistungen und wurde mit Rechnung RE-2026-1001 vom 03.01.2026 abgerechnet. Der Rechnungsbetrag war am 03.01.2026 zur Zahlung fällig.\n\nDie noch offene Hauptforderung beträgt 1.248,53 €. Auf die verzinsliche Forderung fallen für den Zeitraum vom 04.01.2026 bis 31.08.2026 Verzugszinsen in Höhe von 9,12 % p.a. an; bis zum Berechnungsstichtag belaufen sie sich auf 64,82 €. Daneben sind die aufgrund des Zahlungsverzugs entstandenen Inkassokosten in Höhe von 176,50 € zu erstatten.\n\nWir fordern Sie daher auf, den nachstehend ausgewiesenen Gesamtbetrag von 1.489,85 € bis spätestens zum 15.09.2026 auszugleichen.", { ...snapshot({ companyDebtor: true, portal: "ACTIVE" }), portalAccess: { mode: "ACTIVE" } });
await write("03-payment-request-long-table.pdf", "Zahlungsaufforderung", "Sehr geehrter Herr Mustermann,\n\nMuster GmbH hat uns mit der Einziehung der gegen Sie bestehenden Forderung beauftragt. Die Forderung betrifft die Bereitstellung von IT-Dienstleistungen und wurde mit Rechnung RE-2026-1001 vom 03.01.2026 abgerechnet. Der Rechnungsbetrag war am 03.01.2026 zur Zahlung fällig.\n\nDie nachstehende Forderungsübersicht enthält die gegenwärtig offenen Positionen einschließlich der angefallenen Kosten und Zinsen.\n\nWir fordern Sie daher auf, den nachstehend ausgewiesenen Gesamtbetrag bis spätestens zum 15.09.2026 auszugleichen.", snapshot({ longTable: true }));
await write("04-payment-reminder.pdf", "Zweite Zahlungsaufforderung", "Sehr geehrter Herr Mustermann,\n\nMit unserem vorherigen Schreiben haben wir Sie bereits aufgefordert, die offene Forderung zur Forderungsangelegenheit RE-2026-1001 auszugleichen. Bis heute konnten wir keinen vollständigen Zahlungseingang feststellen. Der derzeit offene Gesamtbetrag beläuft sich auf 1.489,85 €.\n\nWir fordern Sie erneut auf, den nachstehend ausgewiesenen Gesamtbetrag von 1.489,85 € bis spätestens zum 15.09.2026 auszugleichen.", snapshot({ subject: "payment-reminder" }));
await write("05-court-dunning-notice.pdf", "Ankündigung gerichtliches Mahnverfahren", "Sehr geehrter Herr Mustermann,\n\nTrotz unserer bisherigen Zahlungsaufforderungen ist die offene Forderung zur Forderungsangelegenheit RE-2026-1001 weiterhin nicht vollständig ausgeglichen. Der derzeit offene Gesamtbetrag beläuft sich auf 1.489,85 €.\n\nWir fordern Sie daher letztmalig auf, den nachstehend ausgewiesenen Gesamtbetrag von 1.489,85 € bis spätestens zum 15.09.2026 auszugleichen. Andernfalls kann die Einleitung eines gerichtlichen Mahnverfahrens geprüft werden.", snapshot({ subject: "court-dunning-notice" }));
