const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const { renderDin5008Document } = require("./build/din5008-layout.js");

const output = join(process.cwd(), "output", "pdf", "contact-labels");
mkdirSync(output, { recursive: true });

const company = {
  name: "payveo Forderungsmanagement GmbH",
  legalName: "payveo Forderungsmanagement GmbH",
  street: "Hafenstraße",
  houseNumber: "18",
  postalCode: "20457",
  city: "Hamburg",
  phone: "+49 40 123 45 67",
  fax: "+49 40 123 45 68",
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

const baseRows = [
  { date: "03.01.2026", description: "Hauptforderung aus Rechnung RE-2026-1001", principalAmount: "1248.53", costAmount: "0.00", interestAmount: "0.00" },
  { date: "08.01.2026", description: "Inkassokosten", principalAmount: "0.00", costAmount: "176.50", interestAmount: "0.00" },
  { date: "31.08.2026", description: "Verzugszinsen", principalAmount: "0.00", costAmount: "0.00", interestAmount: "64.82" },
];

function snapshot(rows, caseNumber) {
  const totals = rows.reduce(
    (sum, row) => ({
      principal: sum.principal + Number(row.principalAmount),
      costs: sum.costs + Number(row.costAmount),
      interest: sum.interest + Number(row.interestAmount),
    }),
    { principal: 0, costs: 0, interest: 0 },
  );
  return {
    company,
    debtor: {
      type: "PERSON",
      displayName: "Max Mustermann",
      address: { street: "Musterstraße", houseNumber: "12", postalCode: "50667", city: "Köln", country: "DE" },
    },
    case: { caseNumber },
    document: { date: "25.08.2026", paymentDueDate: "15.09.2026", templateKey: "payment-request-consumer" },
    ledger: { openPrincipal: totals.principal.toFixed(2), openCosts: totals.costs.toFixed(2), openInterest: totals.interest.toFixed(2), openTotal: (totals.principal + totals.costs + totals.interest).toFixed(2) },
    claimStatement: { rows, principalTotal: totals.principal.toFixed(2), costTotal: totals.costs.toFixed(2), interestTotal: totals.interest.toFixed(2), grandTotal: (totals.principal + totals.costs + totals.interest).toFixed(2) },
  };
}

async function render(name, subject, body, data) {
  writeFileSync(join(output, name), await renderDin5008Document(subject, body, data));
}

const consumerBody = [
  "Sehr geehrter Herr Mustermann,",
  "wir wurden vom Auftraggeber mit der Einziehung der fälligen Forderung beauftragt. Die nachfolgende Übersicht weist den aktuellen Stand einschließlich Kosten und Zinsen aus.",
  "Bitte überweisen Sie den Gesamtbetrag bis zum genannten Termin unter Angabe des Aktenzeichens.",
].join("\n\n");

const longRows = Array.from({ length: 38 }, (_, index) => ({
  date: `${String((index % 27) + 1).padStart(2, "0")}.08.2026`,
  description: `Forderungsposition ${index + 1}: ausführliche Leistungsbeschreibung mit nachvollziehbarem Bezug zur beauftragten Dienstleistung und zur Rechnung RE-2026-${String(index + 1).padStart(4, "0")}.`,
  principalAmount: index === 0 ? "1248.53" : "0.00",
  costAmount: index % 3 === 0 ? "12.50" : "0.00",
  interestAmount: index % 4 === 0 ? "1.25" : "0.00",
}));
const longBody = Array.from({ length: 7 }, () => "wir erläutern den gegenwärtigen Forderungsstand. Bitte beachten Sie die beigefügte Aufstellung, die alle Buchungen und den offenen Gesamtbetrag nachvollziehbar ausweist. Für Rückfragen stehen wir Ihnen zur Verfügung.").join("\n\n");

Promise.all([
  render("consumer-zahlungsaufforderung.pdf", "Zahlungsaufforderung", consumerBody, snapshot(baseRows, "0000001/2026")),
  render("mehrseitiges-schreiben.pdf", "Zahlungsaufforderung", longBody, snapshot(longRows, "0000042/2026")),
]).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
