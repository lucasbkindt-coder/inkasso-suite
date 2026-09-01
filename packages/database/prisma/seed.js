const {
  AddressType,
  CasePhase,
  CasePriority,
  CaseStatus,
  ClaimStatus,
  ContactType,
  LedgerEntrySide,
  LedgerEntryStatus,
  LedgerEntryType,
  MembershipStatus,
  PartyRoleType,
  PartyType,
  PermissionScope,
  PrismaClient,
  RoleKind,
  RvgFeeScheduleStatus,
  TaskPriority,
  TaskStatus,
  TaskType,
} = require("@prisma/client");
const argon2 = require("argon2");

const rvg2025Tiers = [
  [500, "51.50"],
  [1000, "93.00"],
  [1500, "134.50"],
  [2000, "176.00"],
  [3000, "235.50"],
  [4000, "295.00"],
  [5000, "354.50"],
  [6000, "414.00"],
  [7000, "473.50"],
  [8000, "533.00"],
  [9000, "592.50"],
  [10000, "652.00"],
  [13000, "707.00"],
  [16000, "762.00"],
  [19000, "817.00"],
  [22000, "872.00"],
  [25000, "927.00"],
  [30000, "1013.00"],
  [35000, "1099.00"],
  [40000, "1185.00"],
  [45000, "1271.00"],
  [50000, "1357.00"],
  [65000, "1456.50"],
  [80000, "1556.00"],
  [95000, "1655.50"],
  [110000, "1755.00"],
  [125000, "1854.50"],
  [140000, "1954.00"],
  [155000, "2053.50"],
  [170000, "2153.00"],
  [185000, "2252.50"],
  [200000, "2352.00"],
  [230000, "2492.00"],
  [260000, "2632.00"],
  [290000, "2772.00"],
  [320000, "2912.00"],
  [350000, "3052.00"],
  [380000, "3192.00"],
  [410000, "3332.00"],
  [440000, "3472.00"],
  [470000, "3612.00"],
  [500000, "3752.00"],
];

const prisma = new PrismaClient();

const standardPermissions = [
  ["tenant", "read", PermissionScope.TENANT, "Mandant anzeigen"],
  ["tenant", "update", PermissionScope.TENANT, "Mandant verwalten"],
  ["member", "read", PermissionScope.TENANT, "Mitglieder anzeigen"],
  ["member", "invite", PermissionScope.TENANT, "Mitglieder einladen"],
  ["member", "update", PermissionScope.TENANT, "Mitglieder verwalten"],
  ["member", "assign_role", PermissionScope.TENANT, "Rollen zuweisen"],
  ["team", "read", PermissionScope.TENANT, "Teams anzeigen"],
  ["team", "create", PermissionScope.TENANT, "Teams erstellen"],
  ["team", "update", PermissionScope.TENANT, "Teams verwalten"],
  ["team", "delete", PermissionScope.TENANT, "Teams löschen"],
  ["team", "manage_members", PermissionScope.TENANT, "Teammitglieder verwalten"],
  ["role", "read", PermissionScope.TENANT, "Rollen anzeigen"],
  ["role", "create", PermissionScope.TENANT, "Rollen erstellen"],
  ["role", "update", PermissionScope.TENANT, "Rollen verwalten"],
  ["role", "delete", PermissionScope.TENANT, "Rollen löschen"],
  ["role", "manage_permissions", PermissionScope.TENANT, "Rollenberechtigungen verwalten"],
  ["case", "read", PermissionScope.TENANT, "Fälle anzeigen"],
  ["case", "create", PermissionScope.TENANT, "Fälle erstellen"],
  ["case", "update", PermissionScope.TENANT, "Fälle bearbeiten"],
  ["case", "assign", PermissionScope.TENANT, "Fälle zuweisen"],
  ["debtor", "read", PermissionScope.TENANT, "Schuldner anzeigen"],
  ["debtor", "create", PermissionScope.TENANT, "Schuldner erstellen"],
  ["debtor", "update", PermissionScope.TENANT, "Schuldner bearbeiten"],
  ["claim", "read", PermissionScope.TENANT, "Forderungen anzeigen"],
  ["claim", "create", PermissionScope.TENANT, "Forderungen erstellen"],
  ["claim", "update", PermissionScope.TENANT, "Forderungen bearbeiten"],
  ["payment", "read", PermissionScope.TENANT, "Zahlungen anzeigen"],
  ["payment", "create", PermissionScope.TENANT, "Zahlungen erfassen"],
  ["payment", "update", PermissionScope.TENANT, "Zahlungen bearbeiten"],
  ["bank-import", "read", PermissionScope.TENANT, "Bankimporte anzeigen"],
  ["bank-import", "manage", PermissionScope.TENANT, "Bankimporte importieren und zuordnen"],
  ["document", "read", PermissionScope.TENANT, "Dokumente anzeigen"],
  ["document", "create", PermissionScope.TENANT, "Dokumente hochladen"],
  ["document", "delete", PermissionScope.TENANT, "Dokumente löschen"],
  ["report", "read", PermissionScope.TENANT, "Auswertungen anzeigen"],
  ["settings", "read", PermissionScope.TENANT, "Einstellungen anzeigen"],
  ["settings", "update", PermissionScope.TENANT, "Einstellungen verwalten"],
  ["privacy", "read", PermissionScope.TENANT, "Datenschutzfälle anzeigen"],
  ["privacy", "manage", PermissionScope.TENANT, "Datenschutzfälle bearbeiten"],
  ["privacy", "export", PermissionScope.TENANT, "Betroffenenauskünfte exportieren"],
];

const systemRoles = [
  {
    name: "Tenant Owner",
    description: "Vollzugriff innerhalb des Mandanten",
    permissionKeys: null,
  },
  {
    name: "Administrator",
    description: "Operativer und administrativer Vollzugriff innerhalb des Mandanten",
    permissionKeys: null,
  },
  {
    name: "Sachbearbeitung",
    description: "Operative Bearbeitung von Inkassoakten und Stammdaten",
    permissionKeys: [
      "tenant:read",
      "case:read",
      "case:create",
      "case:update",
      "case:assign",
      "debtor:read",
      "debtor:create",
      "debtor:update",
      "claim:read",
      "claim:create",
      "claim:update",
      "payment:read",
      "payment:create",
      "payment:update",
      "bank-import:read",
      "bank-import:manage",
      "document:read",
      "document:create",
      "report:read",
    ],
  },
  {
    name: "Teamleiter",
    description: "Operative Leitung mit erweiterten Aktenzuweisungen",
    permissionKeys: [
      "tenant:read",
      "case:read",
      "case:create",
      "case:update",
      "case:assign",
      "debtor:read",
      "debtor:create",
      "debtor:update",
      "claim:read",
      "claim:create",
      "claim:update",
      "payment:read",
      "payment:create",
      "payment:update",
      "bank-import:read",
      "bank-import:manage",
      "document:read",
      "document:create",
      "report:read",
    ],
  },
  {
    name: "Buchhaltung",
    description: "Lesender und zahlungsbezogener Zugriff auf Inkassoakten",
    permissionKeys: [
      "case:read",
      "debtor:read",
      "claim:read",
      "payment:read",
      "payment:create",
      "bank-import:read",
      "bank-import:manage",
      "document:read",
      "report:read",
    ],
  },
  {
    name: "Lesen",
    description: "Schreibgeschützter Zugriff auf Inkassoakten und Auswertungen",
    permissionKeys: ["case:read", "debtor:read", "claim:read", "document:read", "report:read"],
  },
];

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "inkasso-suite" },
    update: {},
    create: { name: "Inkasso Suite", slug: "inkasso-suite" },
  });

  const adminPasswordHash = await argon2.hash("ChangeMeNow!2026", {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: { email: "admin@example.com", displayName: "Tenant Owner", passwordHash: adminPasswordHash },
  });

  const membership = await prisma.tenantMembership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: admin.id } },
    update: {},
    create: { tenantId: tenant.id, userId: admin.id, status: MembershipStatus.ACTIVE },
  });

  const permissions = await Promise.all(
    standardPermissions.map(([resource, action, scope, description]) =>
      prisma.permission.upsert({
        where: { resource_action_scope: { resource, action, scope } },
        update: { description },
        create: { resource, action, scope, description },
      }),
    ),
  );

  const tenants = await prisma.tenant.findMany({ where: { deletedAt: null }, select: { id: true } });
  const rolesByTenant = new Map();
  for (const value of tenants) rolesByTenant.set(value.id, await seedSystemRoles(value.id, permissions));
  const ownerRole = rolesByTenant.get(tenant.id).get("Tenant Owner");

  await prisma.membershipRole.upsert({
    where: {
      membershipId_roleId: {
        membershipId: membership.id,
        roleId: ownerRole.id,
      },
    },
    update: {},
    create: { membershipId: membership.id, roleId: ownerRole.id },
  });

  await seedRvgReferenceData();
  await seedDocumentTemplates(tenant.id);
  await prisma.tenantDocumentSettings.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      companyName: "payveo Entwicklungsumgebung",
      street: "Entwicklungsstraße",
      postalCode: "00000",
      city: "Entwicklungsort",
      country: "DE",
      documentFooter: "Lokale Entwicklungsdaten – vor produktivem Versand konfigurieren.",
      collectionRegistrationAuthority: "Landesamt für Bürger- und Ordnungsangelegenheiten",
      collectionRegistrationAddress: "Puttkamerstraße 16–18, 10969 Berlin",
      collectionRegistrationContact: "https://www.berlin.de/labo/",
    },
  });
}

async function seedSystemRoles(tenantId, permissions) {
  const permissionsByKey = new Map(permissions.map((permission) => [`${permission.resource}:${permission.action}`, permission]));
  const roles = new Map();

  for (const definition of systemRoles) {
    const role = await prisma.role.upsert({
      where: { tenantId_name: { tenantId, name: definition.name } },
      update: { deletedAt: null, kind: RoleKind.SYSTEM, description: definition.description },
      create: { tenantId, name: definition.name, kind: RoleKind.SYSTEM, description: definition.description },
    });
    const assignedPermissions = definition.permissionKeys === null
      ? permissions
      : definition.permissionKeys.map((key) => {
        const permission = permissionsByKey.get(key);
        if (!permission) throw new Error(`Unbekannte Standardberechtigung: ${key}`);
        return permission;
      });

    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id, permissionId: { notIn: assignedPermissions.map((permission) => permission.id) } },
    });
    await prisma.rolePermission.createMany({
      data: assignedPermissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
      skipDuplicates: true,
    });
    roles.set(definition.name, role);
  }

  return roles;
}

async function seedDocumentTemplates(tenantId) {
  const templates = [
    [
      "payment-request",
      "Zahlungsaufforderung",
      "PAYMENT_REQUEST",
      "Zahlungsaufforderung zu {{case.caseNumber}}",
      "Sehr geehrte Damen und Herren,\n\npayveo wurde von {{client.displayName}} mit dem Einzug der nachstehend erläuterten Forderung beauftragt.\n\nBitte zahlen Sie den ausgewiesenen Gesamtbetrag bis spätestens {{document.paymentDueDate}} unter Angabe des Aktenzeichens {{case.caseNumber}}.\n\nBei Fragen zur Forderung oder wenn Angaben unzutreffend sind, kontaktieren Sie uns bitte. Wenn eine vollständige Zahlung derzeit nicht möglich ist, kann über das Schuldnerportal eine Ratenzahlungsanfrage gestellt werden.\n\nMit freundlichen Grüßen\npayveo",
    ],
    [
      "payment-reminder",
      "Zweite Zahlungsaufforderung",
      "SECOND_PAYMENT_REQUEST",
      "Zweite Zahlungsaufforderung zu {{case.caseNumber}}",
      "Sehr geehrte Damen und Herren,\n\nauf unser vorheriges Schreiben zur Forderungsangelegenheit {{claim.invoiceNumber}} ist bislang keine vollständige Zahlung eingegangen.\n\nBitte zahlen Sie den aktuellen Gesamtbetrag bis spätestens {{document.paymentDueDate}}. Andernfalls kann die Prüfung weiterer Rechtsverfolgung erforderlich werden.\n\nMit freundlichen Grüßen\npayveo",
    ],
    [
      "court-dunning-notice",
      "Ankündigung gerichtliches Mahnverfahren",
      "JUDICIAL_DUNNING_NOTICE",
      "Ankündigung gerichtliches Mahnverfahren zu {{case.caseNumber}}",
      "Sehr geehrte Damen und Herren,\n\nbitte zahlen Sie den aktuellen Gesamtbetrag bis spätestens {{document.paymentDueDate}}. Sollte die Forderung nicht fristgerecht ausgeglichen werden, kann die Einleitung eines gerichtlichen Mahnverfahrens geprüft oder veranlasst werden.\n\nWeitere Rechtsverfolgung kann zusätzliche Kosten verursachen, soweit diese gesetzlich erstattungsfähig sind.\n\nMit freundlichen Grüßen\npayveo",
    ],
    [
      "enforcement-notice",
      "Vollstreckungsankündigung",
      "ENFORCEMENT_NOTICE",
      "Vollstreckungsankündigung zu {{case.caseNumber}}",
      "Sehr geehrte Damen und Herren,\n\nbitte zahlen Sie den aktuellen Gesamtbetrag bis spätestens {{document.paymentDueDate}}. Bei Nichtzahlung können Vollstreckungsmaßnahmen auf Grundlage eines dokumentierten Titels veranlasst werden.\n\nMit freundlichen Grüßen\npayveo",
    ],
    ["payment-request-consumer", "Zahlungsaufforderung – Privatperson", "PAYMENT_REQUEST", "Zahlungsaufforderung zu {{case.caseNumber}}", "Sehr geehrte Damen und Herren,\n\nbitte beachten Sie die nachstehende Forderungsaufstellung und die Zahlungsinformationen.\n\nMit freundlichen Grüßen\npayveo"],
    ["payment-request-business", "Zahlungsaufforderung – Unternehmen", "PAYMENT_REQUEST", "Zahlungsaufforderung zu {{case.caseNumber}}", "Sehr geehrte Damen und Herren,\n\nbitte beachten Sie die nachstehende Forderungsaufstellung und die Zahlungsinformationen.\n\nMit freundlichen Grüßen\npayveo"],
    ["title-notification", "Mitteilung der Titulierung", "TITLE_NOTIFICATION", "Mitteilung der Titulierung zu {{case.caseNumber}}", "Sehr geehrte Damen und Herren,\n\nfür die Forderungsangelegenheit liegt ein dokumentierter Vollstreckungstitel vor. Bitte gleichen Sie den aktuellen offenen Betrag aus.\n\nMit freundlichen Grüßen\npayveo"],
    ["claim-statement", "Forderungsaufstellung", "CLAIM_STATEMENT", "Forderungsaufstellung zu {{case.caseNumber}}", "Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie den aktuellen Forderungsstand.\n\nMit freundlichen Grüßen\npayveo"],
    ["case-settled", "Erledigterklärung", "CASE_SETTLED", "Erledigung zu {{case.caseNumber}}", "Sehr geehrte Damen und Herren,\n\ndie Forderungsangelegenheit ist nach unserem aktuellen Forderungskonto ausgeglichen.\n\nMit freundlichen Grüßen\npayveo"],
    ["installment-agreement", "Ratenplanbestätigung", "PAYMENT_PLAN", "Ratenplan zu {{case.caseNumber}}", "Sehr geehrte Damen und Herren,\n\ndie vereinbarte Ratenzahlung richtet sich nach dem aktiven Ratenplan. Bitte beachten Sie die vereinbarten Fälligkeiten.\n\nMit freundlichen Grüßen\npayveo"],
    ["installment-default-notice", "Mitteilung Ratenplan-Ausfall", "PAYMENT_PLAN", "Ratenplan zu {{case.caseNumber}}", "Sehr geehrte Damen und Herren,\n\nder Ratenplan ist nicht mehr aktiv. Bitte beachten Sie den aktuellen Forderungsstand.\n\nMit freundlichen Grüßen\npayveo"],
    ["enforcement-order", "Vollstreckungsauftragsdaten", "ENFORCEMENT_ORDER", "Vollstreckungsauftrag zu {{case.caseNumber}}", "Interne strukturierte Vollstreckungsauftragsdaten auf Grundlage eines aktiven Titels. Dieses Dokument ersetzt kein amtliches Formular.\n\nAktenzeichen: {{case.caseNumber}}"],
    ["enforcement-cover-letter", "Anschreiben Vollstreckung", "ENFORCEMENT_COVER_LETTER", "Anschreiben zu {{case.caseNumber}}", "Sehr geehrte Damen und Herren,\n\nanbei übermitteln wir die strukturierten Unterlagen zur weiteren Bearbeitung.\n\nMit freundlichen Grüßen\npayveo"],
    ["garnishment-application", "Pfändungsunterlagen", "GARNISHMENT_APPLICATION", "Pfändungsunterlagen zu {{case.caseNumber}}", "Interne strukturierte Datenbasis für Pfändungsunterlagen. Dieses Dokument ersetzt keinen amtlichen Antrag.\n\nAktenzeichen: {{case.caseNumber}}"],
  ];
  const professionalBodies = {
    "payment-request-consumer": "Sehr geehrte Damen und Herren,\n\nwir wurden vom Auftraggeber mit der Einziehung der Forderung beauftragt. Bitte entnehmen Sie die Entstehung, Fälligkeit und den aktuellen Forderungsstand der nachfolgenden Aufstellung.\n\nWir bitten Sie, den ausgewiesenen Gesamtbetrag bis zur angegebenen Frist auszugleichen. Bei Einwendungen oder wenn Sie eine Ratenzahlung anfragen möchten, kontaktieren Sie uns bitte rechtzeitig.\n\nMit freundlichen Grüßen\npayveo",
    "payment-request-business": "Sehr geehrte Damen und Herren,\n\nwir machen im Auftrag unseres Auftraggebers die fällige Forderung geltend. Der aktuelle Forderungsstand einschließlich der angefallenen Kosten und Zinsen ist nachfolgend ausgewiesen.\n\nBitte veranlassen Sie den vollständigen Ausgleich bis zur angegebenen Frist unter Angabe des Aktenzeichens.\n\nMit freundlichen Grüßen\npayveo",
    "payment-reminder": "Sehr geehrte Damen und Herren,\n\nauf unsere vorherige Zahlungsaufforderung ist bislang kein vollständiger Ausgleich festgestellt worden. Der aktuelle Forderungsstand ist nachfolgend aufgeführt.\n\nWir bitten Sie erneut, den Gesamtbetrag fristgerecht zu zahlen. Andernfalls kann eine weitere Rechtsverfolgung geprüft werden.\n\nMit freundlichen Grüßen\npayveo",
    "court-dunning-notice": "Sehr geehrte Damen und Herren,\n\ntrotz der bisherigen Korrespondenz besteht die Forderung weiterhin. Bitte beachten Sie den nachfolgend ausgewiesenen Forderungsstand und die Zahlungsfrist.\n\nNach fruchtlosem Ablauf der Frist kann ein gerichtliches Mahnverfahren geprüft oder veranlasst werden; dadurch können weitere gesetzlich erstattungsfähige Kosten entstehen.\n\nMit freundlichen Grüßen\npayveo",
    "title-notification": "Sehr geehrte Damen und Herren,\n\nin der Forderungsangelegenheit liegt ein Vollstreckungstitel vor. Die maßgeblichen Titeldaten und der aktuelle Forderungsstand werden im Schreiben ausgewiesen.\n\nBitte gleichen Sie den offenen Betrag innerhalb der genannten Frist aus. Ein vollstreckbarer Titel kann grundsätzlich Vollstreckungsmaßnahmen ermöglichen.\n\nMit freundlichen Grüßen\npayveo",
    "enforcement-notice": "Sehr geehrte Damen und Herren,\n\nauf Grundlage des aktiven Vollstreckungstitels besteht die Forderung weiterhin. Der aktuelle Forderungsstand und die Zahlungsfrist sind nachfolgend aufgeführt.\n\nNach ergebnislosem Fristablauf können geeignete Zwangsvollstreckungsmaßnahmen im gesetzlichen Rahmen veranlasst werden.\n\nMit freundlichen Grüßen\npayveo",
    "case-settled": "Sehr geehrte Damen und Herren,\n\nwir bestätigen, dass die Forderungsangelegenheit nach dem aktuellen Buchungsstand vollständig ausgeglichen ist.\n\nDie Angelegenheit wird bei payveo als erledigt geführt. Diese Bestätigung betrifft ausschließlich den dokumentierten Forderungsstand.\n\nMit freundlichen Grüßen\npayveo",
    "installment-agreement": "Sehr geehrte Damen und Herren,\n\nwir bestätigen die vereinbarte Ratenzahlung. Gesamtplanbetrag, Ratenhöhe und Fälligkeiten ergeben sich aus der nachfolgenden Ratenübersicht.\n\nBitte verwenden Sie bei jeder Zahlung das Aktenzeichen als Verwendungszweck und halten Sie die vereinbarten Fälligkeiten ein.\n\nMit freundlichen Grüßen\npayveo",
    "installment-default-notice": "Sehr geehrte Damen und Herren,\n\ndie Ratenvereinbarung wird aktuell als ausgefallen geführt. Der aktuelle offene Forderungsstand und die Zahlungsfrist sind nachfolgend ausgewiesen.\n\nBitte gleichen Sie den Betrag fristgerecht aus. Andernfalls kann die weitere Rechtsverfolgung geprüft werden.\n\nMit freundlichen Grüßen\npayveo",
    "claim-statement": "Sehr geehrte Damen und Herren,\n\nnachfolgend erhalten Sie die aktuelle Forderungsaufstellung zum Aktenzeichen {{case.caseNumber}}. Die Übersicht bildet den Buchungs- und Forderungsstand zum Stichtag ab.\n\nMit freundlichen Grüßen\npayveo",
    "enforcement-order": "Sehr geehrte Damen und Herren,\n\ndieses Schreiben enthält die strukturierten Angaben zur Vorbereitung einer Vollstreckungsmaßnahme. Maßgebliche amtliche Formulare und deren gesetzliche Anforderungen bleiben unberührt.\n\nMit freundlichen Grüßen\npayveo",
    "enforcement-cover-letter": "Sehr geehrte Damen und Herren,\n\nbeigefügt übermitteln wir die Unterlagen zur Bearbeitung der angelegten Vollstreckungsmaßnahme. Titel, Forderungsstand und Aktenzeichen werden im Schreiben konkret ausgewiesen.\n\nFür Rückfragen stehen wir gerne zur Verfügung.\n\nMit freundlichen Grüßen\npayveo",
    "garnishment-application": "Sehr geehrte Damen und Herren,\n\ndieses Schreiben dient als strukturierte Begleitunterlage zur amtlichen Formularbearbeitung einer Pfändungsmaßnahme. Es ersetzt keinen amtlichen Antrag oder Pfändungs- und Überweisungsbeschluss.\n\nMit freundlichen Grüßen\npayveo",
  };
  for (const [key, name, type, subject, bodyTemplate] of templates) {
    const professionalBody = professionalBodies[key] ?? bodyTemplate;
    await prisma.documentTemplate.upsert({
      where: { tenantId_key_version: { tenantId, key, version: 1 } },
      update: {},
      create: { tenantId, key, name, type, version: 1, status: "ACTIVE", subject, bodyTemplate: professionalBody },
    });
  }
}

async function seedRvgReferenceData() {
  const schedule = await prisma.rvgFeeScheduleVersion.upsert({
    where: {
      identifier_validFrom: {
        identifier: "rvg-para-13-anlage-2",
        validFrom: new Date("2025-01-01"),
      },
    },
    update: {},
    create: {
      identifier: "rvg-para-13-anlage-2",
      validFrom: new Date("2025-01-01"),
      legalReference: "§ 13 RVG i. V. m. Anlage 2; § 13 Abs. 2 RVG",
      sourceReference: "https://www.gesetze-im-internet.de/rvg/anlage_2.html",
      fetchedAt: new Date(),
      sourceHash: "rvg-2025-initial",
      status: RvgFeeScheduleStatus.ACTIVE,
      aboveMaximumIncrement: "50000.00",
      aboveMaximumFeeIncrease: "175.00",
      smallClaimCollectionFee: "31.50",
    },
  });
  await prisma.rvgFeeThreshold.createMany({
    data: rvg2025Tiers.map(([valueUpTo, baseFee]) => ({
      scheduleVersionId: schedule.id,
      valueUpTo,
      baseFee,
    })),
    skipDuplicates: true,
  });
}

async function seedCase(tenantId) {
  const client = await prisma.party.findFirst({
    where: {
      tenantId,
      displayName: "Muster GmbH",
      deletedAt: null,
      roles: { some: { role: "CLIENT", deletedAt: null } },
    },
  });
  const debtor = await prisma.party.findFirst({
    where: {
      tenantId,
      displayName: "Max Mustermann",
      deletedAt: null,
      roles: { some: { role: "DEBTOR", deletedAt: null } },
    },
  });
  if (!client || !debtor) throw new Error("Seed-Parties für die Inkassoakte fehlen.");
  await prisma.caseNumberSequence.upsert({
    where: { tenantId_year: { tenantId, year: 2026 } },
    update: {},
    create: { tenantId, year: 2026, lastNumber: 1 },
  });
  const seededCase = await prisma.case.upsert({
    where: { tenantId_caseNumber: { tenantId, caseNumber: "0000001/2026" } },
    update: {
      status: CaseStatus.OPEN,
      phase: CasePhase.OUT_OF_COURT,
      priority: CasePriority.NORMAL,
      deletedAt: null,
      clientPartyId: client.id,
      debtorPartyId: debtor.id,
      claim: {
        upsert: {
          update: {
            invoiceNumber: "RE-2026-1001",
            invoiceDate: new Date("2026-01-15"),
            dueDate: new Date("2026-02-14"),
            defaultDate: new Date("2026-02-15"),
            principalAmount: "1248.53",
            currency: "EUR",
            description: "Beispielrechnung für Seed-Inkassoakte",
            status: ClaimStatus.OPEN,
            deletedAt: null,
          },
          create: {
            tenantId,
            invoiceNumber: "RE-2026-1001",
            invoiceDate: new Date("2026-01-15"),
            dueDate: new Date("2026-02-14"),
            defaultDate: new Date("2026-02-15"),
            principalAmount: "1248.53",
            currency: "EUR",
            description: "Beispielrechnung für Seed-Inkassoakte",
          },
        },
      },
    },
    create: {
      tenantId,
      caseNumber: "0000001/2026",
      sequenceYear: 2026,
      sequenceNumber: 1,
      clientPartyId: client.id,
      debtorPartyId: debtor.id,
      status: CaseStatus.OPEN,
      phase: CasePhase.OUT_OF_COURT,
      priority: CasePriority.NORMAL,
      claim: {
        create: {
          tenantId,
          invoiceNumber: "RE-2026-1001",
          invoiceDate: new Date("2026-01-15"),
          dueDate: new Date("2026-02-14"),
          defaultDate: new Date("2026-02-15"),
          principalAmount: "1248.53",
          currency: "EUR",
          description: "Beispielrechnung für Seed-Inkassoakte",
        },
      },
    },
  });
  const principal = await prisma.caseLedgerEntry.findFirst({
    where: {
      caseId: seededCase.id,
      type: LedgerEntryType.PRINCIPAL,
      side: LedgerEntrySide.DEBIT,
      source: "seed",
    },
  });
  const principalData = {
    tenantId,
    caseId: seededCase.id,
    side: LedgerEntrySide.DEBIT,
    type: LedgerEntryType.PRINCIPAL,
    status: LedgerEntryStatus.ACTIVE,
    amount: "1248.53",
    currency: "EUR",
    bookingDate: new Date("2026-01-15"),
    description: "Hauptforderung RE-2026-1001",
    source: "seed",
  };
  if (principal)
    await prisma.caseLedgerEntry.update({ where: { id: principal.id }, data: principalData });
  else await prisma.caseLedgerEntry.create({ data: principalData });
  return seededCase;
}

async function seedCaseTasks(tenantId, caseId) {
  const tasks = [
    ["Schuldner telefonisch kontaktieren", TaskType.FOLLOW_UP, TaskPriority.NORMAL, new Date("2026-08-12T09:00:00.000Z"), new Date("2026-08-12T09:00:00.000Z")],
    ["Zahlungsfrist prüfen", TaskType.DEADLINE, TaskPriority.HIGH, new Date("2026-08-15T12:00:00.000Z"), null],
  ];
  for (const [title, type, priority, dueAt, followUpAt] of tasks) {
    const existing = await prisma.caseTask.findFirst({ where: { tenantId, caseId, title } });
    const data = { tenantId, caseId, title, type, priority, status: TaskStatus.OPEN, dueAt, followUpAt, completedAt: null, cancelledAt: null };
    if (existing) await prisma.caseTask.update({ where: { id: existing.id }, data });
    else await prisma.caseTask.create({ data });
  }
}

async function seedPartyMasterData(tenantId) {
  const client = await findOrCreateParty({
    tenantId,
    type: PartyType.COMPANY,
    displayName: "Muster GmbH",
  });
  await prisma.company.upsert({
    where: { partyId: client.id },
    update: { companyName: "Muster GmbH", legalForm: "GmbH" },
    create: { partyId: client.id, companyName: "Muster GmbH", legalForm: "GmbH" },
  });
  await seedRole(client.id, PartyRoleType.CLIENT);
  await seedAddress(client.id, {
    street: "Musterstraße",
    houseNumber: "12",
    postalCode: "10115",
    city: "Berlin",
  });
  await seedContact(client.id, { type: ContactType.EMAIL, value: "buchhaltung@muster-gmbh.de" });

  const secondClient = await findOrCreateParty({
    tenantId,
    type: PartyType.COMPANY,
    displayName: "Beispiel Handel GmbH",
  });
  await prisma.company.upsert({
    where: { partyId: secondClient.id },
    update: { companyName: "Beispiel Handel GmbH", legalForm: "GmbH" },
    create: { partyId: secondClient.id, companyName: "Beispiel Handel GmbH", legalForm: "GmbH" },
  });
  await seedRole(secondClient.id, PartyRoleType.CLIENT);
  await seedAddress(secondClient.id, {
    street: "Handelsstraße",
    houseNumber: "24",
    postalCode: "20095",
    city: "Hamburg",
  });
  await seedContact(secondClient.id, {
    type: ContactType.EMAIL,
    value: "buchhaltung@beispiel-handel.de",
  });

  const debtor = await findOrCreateParty({
    tenantId,
    type: PartyType.PERSON,
    displayName: "Max Mustermann",
  });
  await prisma.person.upsert({
    where: { partyId: debtor.id },
    update: { salutation: "Herr", firstName: "Max", lastName: "Mustermann" },
    create: { partyId: debtor.id, salutation: "Herr", firstName: "Max", lastName: "Mustermann" },
  });
  await seedRole(debtor.id, PartyRoleType.DEBTOR);
  await seedAddress(debtor.id, {
    street: "Beispielweg",
    houseNumber: "7",
    postalCode: "50667",
    city: "Köln",
  });
  await seedContact(debtor.id, { type: ContactType.MOBILE, value: "+49 171 5550101" });
}

async function findOrCreateParty(data) {
  const existing = await prisma.party.findFirst({
    where: { tenantId: data.tenantId, type: data.type, displayName: data.displayName },
  });
  if (existing)
    return prisma.party.update({ where: { id: existing.id }, data: { deletedAt: null } });
  return prisma.party.create({ data });
}

async function seedRole(partyId, role) {
  return prisma.partyRole.upsert({
    where: { partyId_role: { partyId, role } },
    update: { deletedAt: null },
    create: { partyId, role },
  });
}

async function seedAddress(partyId, data) {
  const existing = await prisma.address.findFirst({
    where: { partyId, type: AddressType.PRIMARY },
  });
  if (existing)
    return prisma.address.update({
      where: { id: existing.id },
      data: { ...data, type: AddressType.PRIMARY, isPrimary: true, deletedAt: null },
    });
  return prisma.address.create({
    data: { partyId, ...data, type: AddressType.PRIMARY, isPrimary: true },
  });
}

async function seedContact(partyId, data) {
  const existing = await prisma.contact.findFirst({
    where: { partyId, type: data.type, isPrimary: true },
  });
  if (existing)
    return prisma.contact.update({
      where: { id: existing.id },
      data: { ...data, isPrimary: true, deletedAt: null },
    });
  return prisma.contact.create({ data: { partyId, ...data, isPrimary: true } });
}

main()
  .then(() => console.info("Database seed completed."))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
