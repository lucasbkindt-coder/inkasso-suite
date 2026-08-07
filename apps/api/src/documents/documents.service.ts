import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { DocumentStatus, Prisma, TemplateStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import { DocumentRenderDto } from "./dto/document.dto";
import { LocalDocumentStorage } from "./local-document-storage";

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly storage: LocalDocumentStorage,
  ) {}
  async templates() {
    const tenantId = await this.tenant.getTenantId();
    return this.prisma.documentTemplate.findMany({
      where: { status: TemplateStatus.ACTIVE, OR: [{ tenantId }, { tenantId: null }] },
      orderBy: [{ type: "asc" }, { version: "desc" }],
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
    const template = await this.prisma.documentTemplate.findFirst({
      where: {
        status: TemplateStatus.ACTIVE,
        OR: [
          { id: dto.templateId, tenantId },
          { key: dto.templateKey, tenantId },
          { key: dto.templateKey, tenantId: null },
        ],
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
    const data = await this.caseData(caseId, tenantId);
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
  private date(value: Date) {
    return new Intl.DateTimeFormat("de-DE").format(value);
  }
  private pdf(subject: string, body: string, snapshot: Record<string, unknown>) {
    const lines = [
      "RisePay",
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
