import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { DocumentStatus, Prisma, TemplateStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import { DocumentRenderDto } from "./dto/document.dto";
import { LocalDocumentStorage } from "./local-document-storage";
import { TenantDocumentSettingsDto } from "./dto/tenant-document-settings.dto";
import { TemplateDto } from "./dto/template.dto";

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly storage: LocalDocumentStorage,
  ) {}
  async settings() {
    const tenantId = await this.tenant.getTenantId();
    return this.prisma.tenantDocumentSettings.findUnique({ where: { tenantId } });
  }
  async saveSettings(dto: TenantDocumentSettingsDto) {
    const tenantId = await this.tenant.getTenantId();
    return this.prisma.tenantDocumentSettings.upsert({
      where: { tenantId },
      update: dto,
      create: { tenantId, ...dto },
    });
  }
  async templates(includeArchived = false) {
    const tenantId = await this.tenant.getTenantId();
    return this.prisma.documentTemplate.findMany({
      where: {
        ...(includeArchived ? {} : { status: TemplateStatus.ACTIVE }),
        OR: [{ tenantId }, { tenantId: null }],
      },
      orderBy: [{ type: "asc" }, { version: "desc" }],
    });
  }
  async templateById(id: string) {
    const tenantId = await this.tenant.getTenantId();
    const template = await this.prisma.documentTemplate.findFirst({ where: { id, tenantId } });
    if (!template) throw new NotFoundException("Dokumentvorlage wurde nicht gefunden.");
    return template;
  }
  async createTemplate(dto: TemplateDto) {
    const tenantId = await this.tenant.getTenantId();
    this.validateTemplate(dto);
    const existing = await this.prisma.documentTemplate.findFirst({
      where: { tenantId, key: dto.key },
      orderBy: { version: "desc" },
    });
    if (existing)
      throw new BadRequestException(
        "Für diesen Key existiert bereits eine Vorlage. Bitte eine neue Version anlegen.",
      );
    return this.prisma.documentTemplate.create({
      data: { ...dto, tenantId, version: 1, status: TemplateStatus.ACTIVE },
    });
  }
  async newVersion(id: string, dto: TemplateDto) {
    const current = await this.templateById(id);
    if (dto.key !== current.key)
      throw new BadRequestException("Der Key einer Vorlagenversion darf nicht geändert werden.");
    this.validateTemplate(dto);
    const tenantId = current.tenantId;
    if (!tenantId)
      throw new BadRequestException("Systemvorlagen können hier nicht versioniert werden.");
    return this.prisma.$transaction(async (tx) => {
      const highest = await tx.documentTemplate.findFirst({
        where: { tenantId, key: current.key },
        orderBy: { version: "desc" },
      });
      await tx.documentTemplate.updateMany({
        where: { tenantId, key: current.key, status: TemplateStatus.ACTIVE },
        data: { status: TemplateStatus.ARCHIVED },
      });
      return tx.documentTemplate.create({
        data: {
          ...dto,
          tenantId,
          version: (highest?.version ?? 0) + 1,
          status: TemplateStatus.ACTIVE,
        },
      });
    });
  }
  async archiveTemplate(id: string) {
    const template = await this.templateById(id);
    return this.prisma.documentTemplate.update({
      where: { id: template.id },
      data: { status: TemplateStatus.ARCHIVED },
    });
  }
  async list(caseId: string) {
    const tenantId = await this.tenant.getTenantId();
    await this.caseData(caseId, tenantId);
    return this.prisma.caseDocument.findMany({
      where: { tenantId, caseId },
      include: { template: { select: { name: true, key: true } } },
      orderBy: { generatedAt: "desc" },
    });
  }
  async get(caseId: string, id: string) {
    const tenantId = await this.tenant.getTenantId();
    const document = await this.prisma.caseDocument.findFirst({
      where: { id, caseId, tenantId },
      include: { template: true },
    });
    if (!document) throw new NotFoundException("Dokument wurde nicht gefunden.");
    return document;
  }
  async preview(caseId: string, dto: DocumentRenderDto) {
    const tenantId = await this.tenant.getTenantId();
    const [template, snapshot] = await Promise.all([
      this.template(dto, tenantId),
      this.snapshot(caseId, tenantId),
    ]);
    return {
      subject: this.render(template.subject ?? template.name, snapshot),
      renderedBody: this.render(template.bodyTemplate, snapshot),
      warnings: [],
      templateId: template.id,
      templateVersion: template.version,
      dataSnapshot: snapshot,
    };
  }
  async generate(caseId: string, dto: DocumentRenderDto) {
    const preview = await this.preview(caseId, dto);
    const tenantId = await this.tenant.getTenantId();
    const pdf = this.pdf(preview.subject, preview.renderedBody, preview.dataSnapshot);
    const storageKey = await this.storage.save(pdf);
    const filename = `RisePay-${String((preview.dataSnapshot as { case: { caseNumber: string } }).case.caseNumber).replace(/\//g, "-")}-${Date.now()}.pdf`;
    try {
      return await this.prisma.caseDocument.create({
        data: {
          tenantId,
          caseId,
          templateId: preview.templateId,
          type: (await this.template(dto, tenantId)).type,
          status: DocumentStatus.GENERATED,
          filename,
          storageKey,
          templateVersion: preview.templateVersion,
          renderedSubject: preview.subject,
          renderedBody: preview.renderedBody,
          dataSnapshot: preview.dataSnapshot as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      await this.storage.remove(storageKey);
      throw error;
    }
  }
  async void(caseId: string, id: string) {
    const document = await this.get(caseId, id);
    if (document.status === DocumentStatus.VOIDED)
      throw new BadRequestException("Dokument ist bereits ungültig.");
    return this.prisma.caseDocument.update({
      where: { id },
      data: { status: DocumentStatus.VOIDED, voidedAt: new Date() },
    });
  }
  async download(caseId: string, id: string) {
    const document = await this.get(caseId, id);
    return { filename: document.filename, buffer: await this.storage.read(document.storageKey) };
  }
  private async template(dto: DocumentRenderDto, tenantId: string) {
    if (!dto.templateId && !dto.templateKey)
      throw new BadRequestException("Eine Dokumentvorlage ist erforderlich.");
    const alternatives = [
      ...(dto.templateId ? [{ id: dto.templateId, tenantId }] : []),
      ...(dto.templateKey
        ? [
            { key: dto.templateKey, tenantId },
            { key: dto.templateKey, tenantId: null },
          ]
        : []),
    ];
    const template = await this.prisma.documentTemplate.findFirst({
      where: {
        status: TemplateStatus.ACTIVE,
        OR: alternatives,
      },
    });
    if (!template) throw new NotFoundException("Aktive Dokumentvorlage wurde nicht gefunden.");
    return template;
  }
  private async caseData(caseId: string, tenantId: string) {
    const value = await this.prisma.case.findFirst({
      where: { id: caseId, tenantId, deletedAt: null },
      include: {
        claim: true,
        clientParty: { include: { addresses: { where: { deletedAt: null, isPrimary: true } } } },
        debtorParty: { include: { addresses: { where: { deletedAt: null, isPrimary: true } } } },
      },
    });
    if (!value || !value.claim)
      throw new NotFoundException("Akte oder Forderung wurde nicht gefunden.");
    return value;
  }
  private async snapshot(caseId: string, tenantId: string) {
    const [data, settings] = await Promise.all([
      this.caseData(caseId, tenantId),
      this.prisma.tenantDocumentSettings.findUnique({ where: { tenantId } }),
    ]);
    if (!settings)
      throw new BadRequestException("Unternehmensdaten für Schreiben sind nicht konfiguriert.");
    const claim = data.claim;
    if (!claim) throw new NotFoundException("Forderung wurde nicht gefunden.");
    const entries = await this.prisma.caseLedgerEntry.findMany({
      where: { caseId, tenantId, status: "ACTIVE" },
      include: { targetAllocations: { where: { status: "ACTIVE" } } },
    });
    const open = (types: string[]) =>
      entries
        .filter((entry) => types.includes(entry.type) && entry.side === "DEBIT")
        .reduce(
          (sum, entry) =>
            sum.plus(
              entry.amount.minus(
                entry.targetAllocations.reduce(
                  (x, allocation) => x.plus(allocation.amount),
                  new Prisma.Decimal(0),
                ),
              ),
            ),
          new Prisma.Decimal(0),
        )
        .toFixed(2);
    const address = (party: typeof data.clientParty) =>
      party.addresses[0] ?? { street: "", postalCode: "", city: "" };
    const openPrincipal = open(["PRINCIPAL"]);
    const openInterest = open(["INTEREST"]);
    const openCosts = open(["COLLECTION_FEE", "EXPENSE", "COURT_COST", "ENFORCEMENT_COST"]);
    return {
      case: { caseNumber: data.caseNumber },
      client: { displayName: data.clientParty.displayName, address: address(data.clientParty) },
      debtor: { displayName: data.debtorParty.displayName, address: address(data.debtorParty) },
      claim: {
        invoiceNumber: claim.invoiceNumber,
        invoiceDate: this.date(claim.invoiceDate),
        dueDate: this.date(claim.dueDate),
        principalAmount: claim.principalAmount.toFixed(2),
      },
      ledger: {
        openPrincipal,
        openInterest,
        openCosts,
        openTotal: new Prisma.Decimal(openPrincipal).plus(openInterest).plus(openCosts).toFixed(2),
      },
      payments: {
        total: entries
          .filter((entry) => entry.type === "PAYMENT" && entry.side === "CREDIT")
          .reduce((sum, entry) => sum.plus(entry.amount), new Prisma.Decimal(0))
          .toFixed(2),
      },
      company: {
        name: settings.companyName,
        legalName: settings.legalName ?? "",
        street: settings.street,
        houseNumber: settings.houseNumber ?? "",
        postalCode: settings.postalCode,
        city: settings.city,
        phone: settings.phone ?? "",
        email: settings.email ?? "",
        website: settings.website ?? "",
        iban: settings.iban ?? "",
        bic: settings.bic ?? "",
        bankName: settings.bankName ?? "",
        footer: settings.documentFooter ?? "",
      },
      today: this.date(new Date()),
    } as Record<string, unknown>;
  }
  private render(template: string, snapshot: Record<string, unknown>) {
    return template.replace(/{{\s*([\w.]+)\s*}}/g, (_match, path: string) => {
      const value = path
        .split(".")
        .reduce<unknown>(
          (current, key) =>
            typeof current === "object" && current !== null && key in current
              ? (current as Record<string, unknown>)[key]
              : undefined,
          snapshot,
        );
      if (value === undefined || value === null)
        throw new BadRequestException(`Vorlagenwert ${path} ist nicht verfügbar.`);
      return String(value);
    });
  }
  private validateTemplate(dto: Pick<TemplateDto, "subject" | "bodyTemplate">) {
    const allowed = new Set([
      "case.caseNumber",
      "client.displayName",
      "client.address.street",
      "client.address.postalCode",
      "client.address.city",
      "debtor.displayName",
      "debtor.address.street",
      "debtor.address.postalCode",
      "debtor.address.city",
      "claim.invoiceNumber",
      "claim.invoiceDate",
      "claim.dueDate",
      "claim.principalAmount",
      "ledger.openPrincipal",
      "ledger.openInterest",
      "ledger.openCosts",
      "ledger.openTotal",
      "ledger.principal",
      "ledger.interest",
      "ledger.costs",
      "ledger.total",
      "payments.total",
      "today",
      "company.name",
      "company.legalName",
      "company.street",
      "company.houseNumber",
      "company.postalCode",
      "company.city",
      "company.phone",
      "company.email",
      "company.website",
      "company.iban",
      "company.bic",
      "company.bankName",
    ]);
    for (const value of [dto.subject ?? "", dto.bodyTemplate])
      for (const match of value.matchAll(/{{\s*([\w.]+)\s*}}/g))
        if (!allowed.has(match[1]))
          throw new BadRequestException(`Unbekannter Platzhalter: ${match[1]}`);
  }
  private date(value: Date) {
    return new Intl.DateTimeFormat("de-DE").format(value);
  }
  private pdf(subject: string, body: string, snapshot: Record<string, unknown>) {
    const lines = [
      `${(snapshot.company as { name: string }).name}`,
      "Forderungsmanagement",
      "",
      `${(snapshot.debtor as { displayName: string }).displayName}`,
      "",
      `Datum: ${snapshot.today as string}`,
      `Aktenzeichen: ${(snapshot.case as { caseNumber: string }).caseNumber}`,
      "",
      subject,
      "",
      ...body.split("\n"),
      "",
      `Hauptforderung: ${(snapshot.ledger as { openPrincipal: string }).openPrincipal} EUR`,
      `Kosten: ${(snapshot.ledger as { openCosts: string }).openCosts} EUR`,
      `Zinsen: ${(snapshot.ledger as { openInterest: string }).openInterest} EUR`,
      `Offen gesamt: ${(snapshot.ledger as { openTotal: string }).openTotal} EUR`,
      ...(snapshot.company && (snapshot.company as { iban: string }).iban
        ? [
            "",
            `Zahlungsempfänger: ${(snapshot.company as { name: string }).name}`,
            `IBAN: ${(snapshot.company as { iban: string }).iban}`,
            `BIC: ${(snapshot.company as { bic: string }).bic}`,
            `Verwendungszweck: ${(snapshot.case as { caseNumber: string }).caseNumber}`,
          ]
        : []),
    ];
    const content = lines
      .map(
        (line, index) =>
          `BT /F1 ${index === 0 ? 18 : 11} Tf 50 ${790 - index * 18} Td (${line.replace(/[()\\]/g, "\\$&")}) Tj ET`,
      )
      .join("\n");
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(Buffer.byteLength(pdf));
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const start = Buffer.byteLength(pdf);
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
      .slice(1)
      .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
      .join("")}trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
    return Buffer.from(pdf);
  }
}
