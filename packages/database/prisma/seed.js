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
  ["document", "read", PermissionScope.TENANT, "Dokumente anzeigen"],
  ["document", "create", PermissionScope.TENANT, "Dokumente hochladen"],
  ["document", "delete", PermissionScope.TENANT, "Dokumente löschen"],
  ["report", "read", PermissionScope.TENANT, "Auswertungen anzeigen"],
  ["settings", "read", PermissionScope.TENANT, "Einstellungen anzeigen"],
  ["settings", "update", PermissionScope.TENANT, "Einstellungen verwalten"],
];

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "inkasso-suite" },
    update: { deletedAt: null, isActive: true, name: "Inkasso Suite" },
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
    update: { deletedAt: null, isActive: true, passwordHash: adminPasswordHash, passwordMustChange: false },
    create: { email: "admin@example.com", displayName: "Tenant Owner", passwordHash: adminPasswordHash },
  });

  const membership = await prisma.tenantMembership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: admin.id } },
    update: { deletedAt: null, status: MembershipStatus.ACTIVE },
    create: { tenantId: tenant.id, userId: admin.id, status: MembershipStatus.ACTIVE },
  });

  const ownerRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "Tenant Owner" } },
    update: {
      deletedAt: null,
      kind: RoleKind.SYSTEM,
      description: "Vollzugriff innerhalb des Mandanten",
    },
    create: {
      tenantId: tenant.id,
      name: "Tenant Owner",
      kind: RoleKind.SYSTEM,
      description: "Vollzugriff innerhalb des Mandanten",
    },
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

  await prisma.rolePermission.deleteMany({
    where: {
      roleId: ownerRole.id,
      permissionId: { notIn: permissions.map((permission) => permission.id) },
    },
  });

  await prisma.rolePermission.createMany({
    data: permissions.map((permission) => ({
      roleId: ownerRole.id,
      permissionId: permission.id,
    })),
    skipDuplicates: true,
  });

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

  await seedPartyMasterData(tenant.id);
  const seededCase = await seedCase(tenant.id);
  await seedCaseTasks(tenant.id, seededCase.id);
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
    },
  });
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
  ];
  for (const [key, name, type, subject, bodyTemplate] of templates) {
    await prisma.documentTemplate.upsert({
      where: { tenantId_key_version: { tenantId, key, version: 1 } },
      update: { name, type, subject, bodyTemplate, status: "ACTIVE" },
      create: { tenantId, key, name, type, version: 1, status: "ACTIVE", subject, bodyTemplate },
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
