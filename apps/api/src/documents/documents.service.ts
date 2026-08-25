import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { DocumentDeliveryChannel, DocumentDeliveryStatus, DocumentStatus, PortalAccountStatus, PortalAccountType, Prisma, TemplateStatus } from "@prisma/client";
import QRCode from "qrcode";
import { PortalAuthService } from "../portal-auth/portal-auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import { DocumentRenderDto } from "./dto/document.dto";
import { LocalDocumentStorage } from "./local-document-storage";
import { TenantDocumentSettingsDto } from "./dto/tenant-document-settings.dto";
import { TemplateDto } from "./dto/template.dto";
import { renderDin5008Document } from "./din5008-layout";
import { MailService } from "./mail.service";

const INITIAL_DEBTOR_PORTAL_TEMPLATE_KEYS = new Set(["payment-request"]);
type SystemTemplateRule = {
  filename: string;
  requiresOpenBalance: boolean;
  requiresPaymentDueDate: boolean;
  requiresPreviousTemplate?: string;
  requiresEnforceableTitle?: boolean;
};

const SYSTEM_TEMPLATE_RULES: Record<string, SystemTemplateRule> = {
  "payment-request": { filename: "zahlungsaufforderung", requiresOpenBalance: true, requiresPaymentDueDate: true },
  "payment-reminder": { filename: "zweite-zahlungsaufforderung", requiresOpenBalance: true, requiresPaymentDueDate: true, requiresPreviousTemplate: "payment-request" },
  "court-dunning-notice": { filename: "ankuendigung-mahnverfahren", requiresOpenBalance: true, requiresPaymentDueDate: true },
  "enforcement-notice": { filename: "vollstreckungsankuendigung", requiresOpenBalance: true, requiresPaymentDueDate: true, requiresEnforceableTitle: true },
} as const;

type PortalRenderBlock =
  | {
      mode: "ACTIVATION";
      loginIdentifier: string;
      activationCode: string;
      activationUrl: string;
      qrCode: Buffer;
    }
  | { mode: "ACTIVE" };

type PortalDocumentAccess = {
  renderBlock: PortalRenderBlock;
  snapshot: Record<string, unknown>;
  activation?: { portalAccountId: string; activationId: string };
};

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly storage: LocalDocumentStorage,
    private readonly portalAuth: PortalAuthService,
    private readonly mail: MailService,
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
      include: {
        template: { select: { name: true, key: true } },
        deliveries: {
          select: {
            channel: true,
            status: true,
            recipient: true,
            attemptedAt: true,
            sentAt: true,
            failedAt: true,
            errorMessage: true,
          },
        },
      },
      orderBy: { generatedAt: "desc" },
    });
  }
  async get(caseId: string, id: string) {
    const tenantId = await this.tenant.getTenantId();
    const document = await this.prisma.caseDocument.findFirst({
      where: { id, caseId, tenantId },
      include: { template: true, deliveries: true },
    });
    if (!document) throw new NotFoundException("Dokument wurde nicht gefunden.");
    return document;
  }
  async preview(caseId: string, dto: DocumentRenderDto) {
    const tenantId = await this.tenant.getTenantId();
    const [template, snapshot] = await Promise.all([
      this.template(dto, tenantId),
      this.snapshot(caseId, tenantId, dto.paymentDueDate),
    ]);
    return {
      subject: this.render(template.subject ?? template.name, snapshot),
      renderedBody: this.render(template.bodyTemplate, snapshot),
      warnings: this.previewWarnings(template.key, snapshot),
      templateId: template.id,
      templateVersion: template.version,
      dataSnapshot: snapshot,
    };
  }
  async generate(caseId: string, dto: DocumentRenderDto) {
    const tenantId = await this.tenant.getTenantId();
    const [template, snapshot, caseData] = await Promise.all([
      this.template(dto, tenantId),
      this.snapshot(caseId, tenantId, dto.paymentDueDate),
      this.caseData(caseId, tenantId),
    ]);
    await this.preflight(template.key, snapshot, caseData);
    const subject = this.render(template.subject ?? template.name, snapshot);
    const renderedBody = this.render(template.bodyTemplate, snapshot);
    let activation: { portalAccountId: string; activationId: string } | undefined;
    let storageKey: string | undefined;
    let documentPersisted = false;
    try {
      const portal = await this.portalBlock(template.key, caseData.debtorPartyId, tenantId);
      if (portal?.activation) activation = portal.activation;
      const renderSnapshot = portal
        ? { ...snapshot, portalAccess: portal.renderBlock }
        : snapshot;
      const persistedSnapshot = portal
        ? { ...snapshot, portalAccess: portal.snapshot }
        : snapshot;
      const pdf = await renderDin5008Document(subject, renderedBody, renderSnapshot);
      const documentStorageKey = await this.storage.save(pdf);
      storageKey = documentStorageKey;
      const rule = SYSTEM_TEMPLATE_RULES[template.key as keyof typeof SYSTEM_TEMPLATE_RULES];
      const filename = `payveo_${String((snapshot as { case: { caseNumber: string } }).case.caseNumber).replace(/\//g, "-")}_${rule?.filename ?? "dokument"}.pdf`;
      const document = await this.prisma.$transaction(async (tx) => {
        const document = await tx.caseDocument.create({
          data: {
            tenantId,
            caseId,
            templateId: template.id,
            type: template.type,
            status: DocumentStatus.GENERATED,
            filename,
            storageKey: documentStorageKey,
            templateVersion: template.version,
            renderedSubject: subject,
            renderedBody,
            dataSnapshot: {
              ...persistedSnapshot,
              layoutVersion: "DIN5008_2020_FORM_B_V1",
            } as Prisma.InputJsonValue,
          },
        });
        if (activation) {
          await this.portalAuth.finalizeActivation(
            tx,
            activation.portalAccountId,
            activation.activationId,
          );
        }
        return document;
      });
      documentPersisted = true;
      if (template.key === "payment-request") await this.deliverPaymentRequest(document.id, tenantId, caseData.debtorPartyId);
      return document;
    } catch (error) {
      if (storageKey && !documentPersisted) await this.storage.remove(storageKey);
      if (activation && !documentPersisted) {
        await this.portalAuth.discardActivation(activation.portalAccountId, activation.activationId);
      }
      throw error;
    }
  }

  private async portalBlock(
    templateKey: string,
    debtorPartyId: string,
    tenantId: string,
  ): Promise<PortalDocumentAccess | undefined> {
    if (!INITIAL_DEBTOR_PORTAL_TEMPLATE_KEYS.has(templateKey)) return undefined;
    const ensured = await this.portalAuth.ensurePortalAccountForParty(
      tenantId,
      debtorPartyId,
      PortalAccountType.DEBTOR,
    );
    const account = ensured.account;
    if (account.status === PortalAccountStatus.ACTIVE) {
      return {
        renderBlock: { mode: "ACTIVE" } satisfies PortalRenderBlock,
        snapshot: { included: true, state: "ACTIVE", portalAccountId: account.id },
      };
    }
    if (account.status !== PortalAccountStatus.PENDING_ACTIVATION) return undefined;

    const activationBaseUrl = this.portalActivationBaseUrl();
    const issued = await this.portalAuth.issueActivation(tenantId, account.id, {
      invalidateExisting: false,
    });
    const activationUrl = new URL("/portal/aktivieren", activationBaseUrl);
    activationUrl.searchParams.set("login", issued.loginIdentifier);
    activationUrl.searchParams.set("code", issued.activationCode);
    const qrCode = await QRCode.toBuffer(activationUrl.toString(), {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 180,
    });
    return {
      activation: { portalAccountId: account.id, activationId: issued.activationId },
      renderBlock: {
        mode: "ACTIVATION",
        loginIdentifier: issued.loginIdentifier,
        activationCode: issued.activationCode,
        activationUrl: activationUrl.toString(),
        qrCode,
      } satisfies PortalRenderBlock,
      snapshot: {
        included: true,
        state: "PENDING_ACTIVATION",
        portalAccountId: account.id,
        loginIdentifier: issued.loginIdentifier,
      },
    };
  }

  private async preflight(
    templateKey: string,
    snapshot: Record<string, unknown>,
    caseData: { id: string; tenantId: string; status: string; phase: string; debtorParty: { type: string }; claim: { status: string } | null },
  ) {
    const rule = SYSTEM_TEMPLATE_RULES[templateKey as keyof typeof SYSTEM_TEMPLATE_RULES];
    if (!rule) return;
    const statement = snapshot.claimStatement as { rows: unknown[]; grandTotal: string };
    if (rule.requiresOpenBalance && (!statement.rows.length || new Prisma.Decimal(statement.grandTotal).lte(0))) throw new BadRequestException("Dieses Schreiben benötigt eine offene Forderungsposition.");
    const company = snapshot.company as Record<string, unknown>;
    const dueDate = (snapshot.document as Record<string, unknown>).paymentDueDate;
    if (rule.requiresPaymentDueDate && !dueDate) throw new BadRequestException("Für dieses Schreiben muss eine konkrete Zahlungsfrist angegeben werden.");
    if (dueDate && new Date(String(dueDate).split(".").reverse().join("-")).getTime() <= Date.now()) throw new BadRequestException("Die Zahlungsfrist muss in der Zukunft liegen.");
    if (templateKey === "payment-request" && caseData.debtorParty.type === "PERSON") {
      const required = ["companyName", "street", "postalCode", "city", "iban", "collectionRegistrationAuthority", "collectionRegistrationAddress", "collectionRegistrationContact"] as const;
      const missing = required.find((key) => !company[key]);
      if (missing) throw new BadRequestException(this.missingPaymentRequestSettingMessage(missing));
    }
    if (rule.requiresPreviousTemplate) {
      const previous = await this.prisma.caseDocument.findFirst({ where: { caseId: caseData.id, tenantId: caseData.tenantId, status: { not: DocumentStatus.VOIDED }, template: { key: rule.requiresPreviousTemplate } }, select: { id: true } });
      if (!previous) throw new BadRequestException("Eine zweite Zahlungsaufforderung setzt eine vorherige Zahlungsaufforderung voraus.");
    }
    if (templateKey === "court-dunning-notice" && (caseData.status !== "OPEN" || !["OUT_OF_COURT", "JUDICIAL_DUNNING"].includes(caseData.phase) || caseData.claim?.status === "DISPUTED")) throw new BadRequestException("Die Ankündigung eines gerichtlichen Mahnverfahrens ist für den aktuellen Aktenstatus nicht zulässig.");
    if (rule.requiresEnforceableTitle) throw new BadRequestException("Eine Vollstreckungsankündigung ist ohne dokumentierte Vollstreckungsgrundlage nicht generierbar.");
  }

  private missingPaymentRequestSettingMessage(field: string) {
    const labels: Record<string, string> = { companyName: "Firmenname", street: "Straße", postalCode: "PLZ", city: "Ort", iban: "IBAN", collectionRegistrationAuthority: "Zuständige Aufsichtsbehörde", collectionRegistrationAddress: "Anschrift der Aufsichtsbehörde", collectionRegistrationContact: "Elektronische Erreichbarkeit der Aufsichtsbehörde" };
    return `${labels[field] ?? field} ist in den Unternehmenseinstellungen nicht hinterlegt.`;
  }

  private previewWarnings(templateKey: string, snapshot: Record<string, unknown>) {
    if (templateKey !== "payment-request" || (snapshot.debtor as Record<string, unknown>).type !== "PERSON") return [];
    const company = snapshot.company as Record<string, unknown>;
    const required = ["companyName", "street", "postalCode", "city", "iban", "collectionRegistrationAuthority", "collectionRegistrationAddress", "collectionRegistrationContact"];
    return required.filter((field) => !company[field]).map((field) => this.missingPaymentRequestSettingMessage(field));
  }

  private portalActivationBaseUrl() {
    const configured = process.env.PORTAL_PUBLIC_BASE_URL?.trim();
    if (!configured) {
      throw new BadRequestException(
        "PORTAL_PUBLIC_BASE_URL muss für ein Schreiben mit Portalaktivierung konfiguriert sein.",
      );
    }
    try {
      const url = new URL(configured);
      if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
        throw new Error("HTTPS ist in Production erforderlich.");
      }
      return url.toString();
    } catch {
      throw new BadRequestException("PORTAL_PUBLIC_BASE_URL ist ungültig.");
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
  async retryEmail(documentId: string) {
    const tenantId = await this.tenant.getTenantId();
    const delivery = await this.prisma.documentDelivery.findFirst({ where: { documentId, tenantId, channel: DocumentDeliveryChannel.EMAIL } });
    if (!delivery) throw new NotFoundException("E-Mail-Versand wurde nicht gefunden.");
    if (delivery.status !== DocumentDeliveryStatus.FAILED) throw new BadRequestException("Nur fehlgeschlagene E-Mail-Versände können wiederholt werden.");
    const document = await this.prisma.caseDocument.findFirst({ where: { id: documentId, tenantId } });
    if (!document || !delivery.recipient) throw new BadRequestException("Ein E-Mail-Versand ist nicht möglich.");
    try { const sent = await this.mail.send({ to: delivery.recipient, subject: delivery.subject, text: `Guten Tag,\n\nanbei erhalten Sie das Forderungsschreiben.\n\nMit freundlichen Grüßen\npayveo`, attachments: [{ filename: document.filename, contentType: "application/pdf", content: await this.storage.read(document.storageKey) }] }); return this.prisma.documentDelivery.update({ where: { id: delivery.id }, data: { status: DocumentDeliveryStatus.SENT, attemptedAt: new Date(), sentAt: new Date(), provider: sent.provider, providerMessageId: sent.providerMessageId, errorCode: null, errorMessage: null } }); } catch (error) { return this.prisma.documentDelivery.update({ where: { id: delivery.id }, data: { attemptedAt: new Date(), failedAt: new Date(), errorCode: "MAIL_SEND_FAILED", errorMessage: error instanceof Error ? error.message : "Mailversand fehlgeschlagen." } }); }
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
        costCalculations: { where: { status: "APPLIED" }, orderBy: { appliedAt: "desc" } },
        clientParty: { include: { addresses: { where: { deletedAt: null, isPrimary: true } } } },
        debtorParty: { include: { person: true, addresses: { where: { deletedAt: null, isPrimary: true } }, contacts: { where: { deletedAt: null, type: "EMAIL" }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } } },
      },
    });
    if (!value || !value.claim)
      throw new NotFoundException("Akte oder Forderung wurde nicht gefunden.");
    return value;
  }
  private async snapshot(caseId: string, tenantId: string, paymentDueDate?: string) {
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
      party.addresses[0] ?? { street: "", houseNumber: "", postalCode: "", city: "", country: "" };
    const debtorAddress = address(data.debtorParty);
    if (!debtorAddress.street || !debtorAddress.postalCode || !debtorAddress.city)
      throw new BadRequestException("Für diese Akte ist keine vollständige primäre Schuldneranschrift hinterlegt.");
    const openPrincipal = open(["PRINCIPAL"]);
    const openInterest = open(["INTEREST"]);
    const openCosts = open(["COLLECTION_FEE", "EXPENSE", "COURT_COST", "ENFORCEMENT_COST"]);
    const costTypes = new Set(["COLLECTION_FEE", "EXPENSE", "COURT_COST", "ENFORCEMENT_COST"]);
    const rows = entries.filter((entry) => entry.side === "DEBIT").map((entry) => {
      const allocated = entry.targetAllocations.reduce((sum, allocation) => sum.plus(allocation.amount), new Prisma.Decimal(0));
      const remaining = Prisma.Decimal.max(0, entry.amount.minus(allocated));
      return { date: this.date(entry.bookingDate), description: entry.description, principalAmount: entry.type === "PRINCIPAL" ? remaining.toFixed(2) : "0.00", costAmount: costTypes.has(entry.type) ? remaining.toFixed(2) : "0.00", interestAmount: entry.type === "INTEREST" ? remaining.toFixed(2) : "0.00" };
    }).filter((row) => new Prisma.Decimal(row.principalAmount).plus(row.costAmount).plus(row.interestAmount).gt(0));
    const claimStatement = { asOf: new Date().toISOString(), caseId, caseNumber: data.caseNumber, currency: claim.currency, rows, principalTotal: openPrincipal, costTotal: openCosts, interestTotal: openInterest, grandTotal: new Prisma.Decimal(openPrincipal).plus(openCosts).plus(openInterest).toFixed(2) };
    return {
      case: { caseNumber: data.caseNumber, status: data.status, phase: data.phase },
      client: { displayName: data.clientParty.displayName, address: address(data.clientParty) },
      debtor: { type: data.debtorParty.type, displayName: data.debtorParty.displayName, salutation: data.debtorParty.person?.salutation ?? "", address: debtorAddress },
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
      claimStatement,
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
        registrationCourt: settings.registrationCourt ?? "",
        registrationNumber: settings.registrationNumber ?? "",
        collectionRegistrationAuthority: settings.collectionRegistrationAuthority ?? "",
        collectionRegistrationAddress: settings.collectionRegistrationAddress ?? "",
        collectionRegistrationContact: settings.collectionRegistrationContact ?? "",
        footer: settings.documentFooter ?? "",
      },
      document: { date: this.date(new Date()), paymentDueDate: paymentDueDate ? this.date(new Date(paymentDueDate)) : "" },
      legalDetails: {
        rows: data.debtorParty.type === "PERSON" ? [
          { label: "Auftraggeber", value: data.clientParty.displayName },
          { label: "Anschrift Auftraggeber", value: `${address(data.clientParty).street} ${address(data.clientParty).houseNumber}`.trim() + `, ${address(data.clientParty).postalCode} ${address(data.clientParty).city}` },
          { label: "Forderungsgrund", value: claim.description ?? `Rechnung ${claim.invoiceNumber}` },
          { label: "Rechnungsdatum", value: this.date(claim.invoiceDate) },
          { label: "Fälligkeit", value: this.date(claim.dueDate) },
          ...(new Prisma.Decimal(openInterest).gt(0) ? [{ label: "Zinsen bis zum Berechnungsstichtag", value: `${openInterest} EUR` }] : []),
          ...data.costCalculations.map((calculation) => ({ label: calculation.type === "RVG" ? "Inkassokosten" : "Zinsen", value: `${calculation.calculatedAmount.toFixed(2)} EUR` })),
          ...(settings.collectionRegistrationAuthority ? [{ label: "Zuständige Aufsichtsbehörde", value: [settings.collectionRegistrationAuthority, settings.collectionRegistrationAddress, settings.collectionRegistrationContact].filter(Boolean).join(" · ") }] : []),
        ] : [],
      },
      today: this.date(new Date()),
    } as Record<string, unknown>;
  }
  private async deliverPaymentRequest(documentId: string, tenantId: string, debtorPartyId: string) {
    const document = await this.prisma.caseDocument.findFirst({ where: { id: documentId, tenantId }, include: { case: { include: { debtorParty: { include: { contacts: { where: { deletedAt: null, type: "EMAIL" }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } } } } } } });
    if (!document) return;
    const recipient = document.case.debtorParty.contacts[0]?.value;
    const subject = `Forderungsangelegenheit – Aktenzeichen ${document.dataSnapshot && typeof document.dataSnapshot === "object" ? (document.dataSnapshot as { case?: { caseNumber?: string } }).case?.caseNumber ?? document.caseId : document.caseId}`;
    const delivery = await this.prisma.documentDelivery.upsert({ where: { documentId_channel: { documentId, channel: DocumentDeliveryChannel.EMAIL } }, update: {}, create: { tenantId, documentId, caseId: document.caseId, channel: DocumentDeliveryChannel.EMAIL, status: recipient ? DocumentDeliveryStatus.PENDING : DocumentDeliveryStatus.SKIPPED, recipient, subject } });
    if (!recipient || delivery.status === DocumentDeliveryStatus.SENT) return;
    try { const sent = await this.mail.send({ to: recipient, subject, text: `Guten Tag,\n\nanbei erhalten Sie das Forderungsschreiben zu Ihrem Aktenzeichen ${subject.split(" ").at(-1)}.\n\nMit freundlichen Grüßen\npayveo`, attachments: [{ filename: document.filename, contentType: "application/pdf", content: await this.storage.read(document.storageKey) }] }); await this.prisma.documentDelivery.update({ where: { id: delivery.id }, data: { status: DocumentDeliveryStatus.SENT, attemptedAt: new Date(), sentAt: new Date(), provider: sent.provider, providerMessageId: sent.providerMessageId, errorCode: null, errorMessage: null } }); } catch (error) { await this.prisma.documentDelivery.update({ where: { id: delivery.id }, data: { status: DocumentDeliveryStatus.FAILED, attemptedAt: new Date(), failedAt: new Date(), errorCode: "MAIL_SEND_FAILED", errorMessage: error instanceof Error ? error.message : "Mailversand fehlgeschlagen." } }); }
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
      "case.status",
      "case.phase",
      "document.date",
      "document.paymentDueDate",
      "client.displayName",
      "client.address.street",
      "client.address.postalCode",
      "client.address.city",
      "debtor.displayName",
      "debtor.type",
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
      "company.registrationCourt",
      "company.registrationNumber",
      "company.collectionRegistrationAuthority",
      "company.collectionRegistrationAddress",
      "company.collectionRegistrationContact",
    ]);
    for (const value of [dto.subject ?? "", dto.bodyTemplate])
      for (const match of value.matchAll(/{{\s*([\w.]+)\s*}}/g))
        if (!allowed.has(match[1]))
          throw new BadRequestException(`Unbekannter Platzhalter: ${match[1]}`);
  }
  private date(value: Date) {
    return new Intl.DateTimeFormat("de-DE").format(value);
  }
}
