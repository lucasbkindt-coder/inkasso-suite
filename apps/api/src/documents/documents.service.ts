import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ActivityEventType, DocumentDeliveryChannel, DocumentDeliveryStatus, DocumentStatus, PortalAccountStatus, PortalAccountType, Prisma, TemplateStatus } from "@prisma/client";
import { ActivityService } from "../activity/activity.service";
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

const INITIAL_DEBTOR_PORTAL_TEMPLATE_KEYS = new Set(["payment-request-consumer"]);
type SystemTemplateRule = {
  filename: string;
  requiresOpenBalance: boolean;
  requiresPaymentDueDate: boolean;
  requiresPreviousTemplate?: string | string[];
  requiresEnforceableTitle?: boolean;
  requiresActiveInstallmentPlan?: boolean;
  requiresDefaultedInstallmentPlan?: boolean;
  debtorType?: "PERSON" | "COMPANY";
  requiresSettledBalance?: boolean;
};

type InstallmentPlanWithItems = Prisma.InstallmentPlanGetPayload<{ include: { items: true } }>;

const SYSTEM_TEMPLATE_RULES: Record<string, SystemTemplateRule> = {
  "payment-request": { filename: "zahlungsaufforderung", requiresOpenBalance: true, requiresPaymentDueDate: true },
  "payment-request-consumer": { filename: "zahlungsaufforderung-privatperson", requiresOpenBalance: true, requiresPaymentDueDate: true, debtorType: "PERSON" },
  "payment-request-business": { filename: "zahlungsaufforderung-unternehmen", requiresOpenBalance: true, requiresPaymentDueDate: true, debtorType: "COMPANY" },
  "payment-reminder": { filename: "zweite-zahlungsaufforderung", requiresOpenBalance: true, requiresPaymentDueDate: true, requiresPreviousTemplate: ["payment-request-consumer", "payment-request-business", "payment-request"] },
  "court-dunning-notice": { filename: "ankuendigung-mahnverfahren", requiresOpenBalance: true, requiresPaymentDueDate: true },
  "enforcement-notice": { filename: "vollstreckungsankuendigung", requiresOpenBalance: true, requiresPaymentDueDate: true, requiresEnforceableTitle: true },
  "title-notification": { filename: "mitteilung-titulierung", requiresOpenBalance: true, requiresPaymentDueDate: true, requiresEnforceableTitle: true },
  "claim-statement": { filename: "forderungsaufstellung", requiresOpenBalance: false, requiresPaymentDueDate: false },
  "case-settled": { filename: "erledigung", requiresOpenBalance: false, requiresPaymentDueDate: false, requiresSettledBalance: true },
  "installment-agreement": { filename: "ratenplanbestaetigung", requiresOpenBalance: false, requiresPaymentDueDate: false, requiresActiveInstallmentPlan: true },
  "installment-default-notice": { filename: "ratenplan-ausfall", requiresOpenBalance: true, requiresPaymentDueDate: true, requiresDefaultedInstallmentPlan: true },
  "enforcement-order": { filename: "vollstreckungsauftrag", requiresOpenBalance: true, requiresPaymentDueDate: false, requiresEnforceableTitle: true },
  "enforcement-cover-letter": { filename: "anschreiben-vollstreckung", requiresOpenBalance: true, requiresPaymentDueDate: false, requiresEnforceableTitle: true },
  "garnishment-application": { filename: "pfaendungsunterlagen", requiresOpenBalance: true, requiresPaymentDueDate: false, requiresEnforceableTitle: true },
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
    private readonly activity: ActivityService,
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
      renderedBody: this.composeSystemBody(template.key, this.render(template.bodyTemplate, snapshot), snapshot),
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
    const renderedBody = this.composeSystemBody(template.key, this.render(template.bodyTemplate, snapshot), snapshot);
    let activation: { portalAccountId: string; activationId: string } | undefined;
    let storageKey: string | undefined;
    let documentPersisted = false;
    try {
      const portal = await this.portalBlock(template.key, caseData.debtorPartyId, tenantId);
      if (portal?.activation) activation = portal.activation;
      const renderSnapshot = {
        ...snapshot,
        document: { ...(snapshot.document as Record<string, unknown>), templateKey: template.key },
        ...(portal ? { portalAccess: portal.renderBlock } : {}),
      };
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
        await this.activity.recordStaffEvent(tx, this.tenant.getStaffContext().tenantMembershipId, {
          tenantId,
          caseId,
          partyId: caseData.debtorPartyId,
          eventType: ActivityEventType.DOCUMENT_CREATED,
          description: `${template.name} wurde erstellt.`,
          metadata: { documentId: document.id, templateKey: template.key, documentName: document.filename },
          sourceEntityType: "CaseDocument",
          sourceEntityId: document.id,
        });
        return document;
      });
      documentPersisted = true;
      if (["payment-request-consumer", "payment-request-business"].includes(template.key)) await this.deliverPaymentRequest(document.id, tenantId, caseData.debtorPartyId);
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
    if (rule.debtorType && caseData.debtorParty.type !== rule.debtorType) throw new BadRequestException("Diese Dokumentvorlage ist für den Typ des Schuldners nicht zulässig.");
    if (templateKey === "payment-request-consumer") {
      const required = ["name", "street", "postalCode", "city", "iban", "collectionRegistrationAuthority", "collectionRegistrationAddress", "collectionRegistrationContact"] as const;
      const missing = required.find((key) => !company[key]);
      if (missing) throw new BadRequestException(this.missingPaymentRequestSettingMessage(missing));
    }
    if (rule.requiresPreviousTemplate) {
      const previous = await this.prisma.caseDocument.findFirst({ where: { caseId: caseData.id, tenantId: caseData.tenantId, status: { not: DocumentStatus.VOIDED }, template: { key: { in: Array.isArray(rule.requiresPreviousTemplate) ? rule.requiresPreviousTemplate : [rule.requiresPreviousTemplate] } } }, select: { id: true } });
      if (!previous) throw new BadRequestException("Eine zweite Zahlungsaufforderung setzt eine vorherige Zahlungsaufforderung voraus.");
    }
    if (templateKey === "court-dunning-notice" && (caseData.status !== "OPEN" || !["OUT_OF_COURT", "JUDICIAL_DUNNING"].includes(caseData.phase) || caseData.claim?.status === "DISPUTED")) throw new BadRequestException("Die Ankündigung eines gerichtlichen Mahnverfahrens ist für den aktuellen Aktenstatus nicht zulässig.");
    if (rule.requiresEnforceableTitle) {
      const title = await this.prisma.enforcementTitle.findFirst({ where: { tenantId: caseData.tenantId, caseId: caseData.id, status: "ACTIVE" }, select: { id: true } });
      if (!title) throw new BadRequestException("Für dieses Schreiben ist ein aktiver Vollstreckungstitel erforderlich.");
      if (["enforcement-cover-letter", "garnishment-application"].includes(templateKey)) {
        const action = await this.prisma.enforcementAction.findFirst({ where: { tenantId: caseData.tenantId, caseId: caseData.id, titleId: title.id }, select: { id: true } });
        if (!action) throw new BadRequestException("Für dieses Schreiben ist eine Vollstreckungsmaßnahme erforderlich.");
      }
    }
    if (rule.requiresActiveInstallmentPlan) {
      const plan = await this.prisma.installmentPlan.findFirst({ where: { tenantId: caseData.tenantId, caseId: caseData.id, status: "ACTIVE" }, select: { id: true } });
      if (!plan) throw new BadRequestException("Für dieses Schreiben ist ein aktiver Ratenplan erforderlich.");
    }
    if (rule.requiresDefaultedInstallmentPlan) {
      const plan = await this.prisma.installmentPlan.findFirst({ where: { tenantId: caseData.tenantId, caseId: caseData.id, status: "DEFAULTED" }, select: { id: true } });
      if (!plan) throw new BadRequestException("Für dieses Schreiben ist ein ausgefallener Ratenplan erforderlich.");
    }
    if (rule.requiresSettledBalance && new Prisma.Decimal(statement.grandTotal).gt(0)) throw new BadRequestException("Eine Erledigterklärung ist nur bei ausgeglichener Forderung zulässig.");
  }

  private missingPaymentRequestSettingMessage(field: string) {
    const labels: Record<string, string> = { name: "Firmenname", street: "Straße", postalCode: "PLZ", city: "Ort", iban: "IBAN", collectionRegistrationAuthority: "Zuständige Aufsichtsbehörde", collectionRegistrationAddress: "Anschrift der Aufsichtsbehörde", collectionRegistrationContact: "Elektronische Erreichbarkeit der Aufsichtsbehörde" };
    return `${labels[field] ?? field} ist in den Unternehmenseinstellungen nicht hinterlegt.`;
  }

  private previewWarnings(templateKey: string, snapshot: Record<string, unknown>) {
    const warnings: string[] = [];
    if (templateKey === "payment-request-consumer" && (snapshot.debtor as Record<string, unknown>).type === "PERSON") {
      const company = snapshot.company as Record<string, unknown>;
      const required = ["name", "street", "postalCode", "city", "iban", "collectionRegistrationAuthority", "collectionRegistrationAddress", "collectionRegistrationContact"];
      warnings.push(...required.filter((field) => !company[field]).map((field) => this.missingPaymentRequestSettingMessage(field)));
    }
    const requiresTitle = ["title-notification", "enforcement-notice", "enforcement-order", "enforcement-cover-letter", "garnishment-application"].includes(templateKey);
    if (requiresTitle && !snapshot.title) warnings.push("Für dieses Schreiben ist ein aktiver Vollstreckungstitel erforderlich.");
    if (["enforcement-cover-letter", "garnishment-application"].includes(templateKey) && !snapshot.enforcementAction) warnings.push("Für dieses Schreiben ist zusätzlich eine Vollstreckungsmaßnahme erforderlich.");
    if (templateKey === "installment-agreement" && !snapshot.installmentPlan) warnings.push("Für dieses Schreiben ist ein aktiver Ratenplan erforderlich.");
    if (templateKey === "installment-default-notice" && (!snapshot.installmentPlan || this.record(snapshot.installmentPlan).status !== "DEFAULTED")) warnings.push("Für dieses Schreiben ist ein ausgefallener Ratenplan erforderlich.");
    return warnings;
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
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.caseDocument.update({ where: { id }, data: { status: DocumentStatus.VOIDED, voidedAt: new Date() } });
      const caseRecord = await tx.case.findFirstOrThrow({ where: { id: caseId, tenantId: updated.tenantId }, select: { debtorPartyId: true } });
      await this.activity.recordStaffEvent(tx, this.tenant.getStaffContext().tenantMembershipId, { tenantId: updated.tenantId, caseId, partyId: caseRecord.debtorPartyId, eventType: ActivityEventType.DOCUMENT_VOIDED, description: `${updated.filename} wurde annulliert.`, metadata: { documentId: updated.id }, sourceEntityType: "CaseDocument", sourceEntityId: updated.id });
      return updated;
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
    const [data, settings, activeTitle, enforcementAction, activeInstallmentPlan, defaultedInstallmentPlan, firstPaymentRequest] = await Promise.all([
      this.caseData(caseId, tenantId),
      this.prisma.tenantDocumentSettings.findUnique({ where: { tenantId } }),
      this.prisma.enforcementTitle.findFirst({ where: { tenantId, caseId, status: "ACTIVE" }, orderBy: { titleDate: "desc" } }),
      this.prisma.enforcementAction.findFirst({ where: { tenantId, caseId, title: { status: "ACTIVE" } }, orderBy: { createdAt: "desc" } }),
      this.prisma.installmentPlan.findFirst({ where: { tenantId, caseId, status: "ACTIVE" }, include: { items: { orderBy: { sequenceNumber: "asc" } } } }),
      this.prisma.installmentPlan.findFirst({ where: { tenantId, caseId, status: "DEFAULTED" }, include: { items: { orderBy: { sequenceNumber: "asc" } } } }),
      this.prisma.caseDocument.findFirst({ where: { tenantId, caseId, status: { not: DocumentStatus.VOIDED }, template: { key: { in: ["payment-request-consumer", "payment-request-business", "payment-request"] } } }, orderBy: { generatedAt: "asc" }, select: { generatedAt: true } }),
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
    const clientAddress = `${address(data.clientParty).street} ${address(data.clientParty).houseNumber}`.trim() + `, ${address(data.clientParty).postalCode} ${address(data.clientParty).city}`;
    const interestCalculation = data.costCalculations.find((calculation) => calculation.type === "INTEREST");
    const interestPreview = this.record(this.record(interestCalculation?.referenceData).preview);
    const interestPeriods = this.array(interestPreview.periods).map((period) => this.record(period));
    const firstInterestPeriod = interestPeriods[0];
    const interestNarrative = interestCalculation?.calculatedAmount.gt(0) && firstInterestPeriod.from && firstInterestPeriod.to && firstInterestPeriod.principalAmount && firstInterestPeriod.effectiveAnnualRate
      ? `Auf die verzinsliche Forderung von ${this.money(firstInterestPeriod.principalAmount)} werden für den Zeitraum vom ${this.displayDate(firstInterestPeriod.from)} bis ${this.displayDate(firstInterestPeriod.to)} Verzugszinsen in Höhe von ${this.rate(firstInterestPeriod.effectiveAnnualRate)} % p.a. berechnet. Bis zum Berechnungsstichtag belaufen sich diese auf ${this.money(interestCalculation?.calculatedAmount)}.`
      : "";
    const rvgCosts = data.costCalculations.filter((calculation) => calculation.type === "RVG");
    const rvgCostAmount = rvgCosts.reduce((sum, calculation) => sum.plus(calculation.calculatedAmount), new Prisma.Decimal(0));
    const costNarrative = rvgCostAmount.gt(0)
      ? `Daneben sind die aufgrund des Zahlungsverzugs entstandenen Inkassokosten in Höhe von ${this.money(rvgCostAmount)} zu erstatten. Es handelt sich um außergerichtliche Inkassokosten aus der Beauftragung mit der Forderungseinziehung.`
      : "";
    const legalNarrative = {
      commission: `${data.clientParty.displayName} hat uns mit der Einziehung der gegen Sie bestehenden Forderung beauftragt.`,
      clientAddress: data.debtorParty.type === "PERSON" && clientAddress ? `Die Anschrift des Auftraggebers lautet ${clientAddress}.` : "",
      claim: `Die zugrunde liegende Hauptforderung beträgt ${this.money(claim.principalAmount)} und betrifft ${claim.description ?? `die Rechnung ${claim.invoiceNumber}`}. Rechnung ${claim.invoiceNumber} vom ${this.date(claim.invoiceDate)} war am ${this.date(claim.dueDate)} fällig.`,
      interest: interestNarrative,
      costs: costNarrative,
    };
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
      correspondence: { firstPaymentRequestDate: firstPaymentRequest ? this.date(firstPaymentRequest.generatedAt) : "" },
      title: activeTitle ? {
        type: activeTitle.type,
        status: activeTitle.status,
        courtOrAuthority: activeTitle.courtOrAuthority ?? "",
        referenceNumber: activeTitle.referenceNumber ?? "",
        titleDate: this.date(activeTitle.titleDate),
        serviceDate: activeTitle.serviceDate ? this.date(activeTitle.serviceDate) : "",
        enforceableFrom: activeTitle.enforceableFrom ? this.date(activeTitle.enforceableFrom) : "",
        principalAmount: activeTitle.principalAmount.toFixed(2),
        costAmount: activeTitle.costAmount.toFixed(2),
        interestAmount: activeTitle.interestAmount.toFixed(2),
        titleTotal: activeTitle.titleTotal.toFixed(2),
      } : null,
      enforcementAction: enforcementAction ? {
        type: enforcementAction.type,
        status: enforcementAction.status,
        referenceNumber: enforcementAction.referenceNumber ?? "",
        requestedAt: enforcementAction.requestedAt ? this.date(enforcementAction.requestedAt) : "",
        amountAtRequest: enforcementAction.amountAtRequest.toFixed(2),
        notes: enforcementAction.notes ?? "",
      } : null,
      installmentPlan: this.installmentPlanSnapshot(activeInstallmentPlan ?? defaultedInstallmentPlan),
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
      legalDetails: legalNarrative,
      today: this.date(new Date()),
    } as Record<string, unknown>;
  }
  private async deliverPaymentRequest(documentId: string, tenantId: string, debtorPartyId: string) {
    const document = await this.prisma.caseDocument.findFirst({ where: { id: documentId, tenantId }, include: { case: { include: { debtorParty: { include: { contacts: { where: { deletedAt: null, type: "EMAIL" }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } } } } } } });
    if (!document) return;
    const recipient = document.case.debtorParty.contacts[0]?.value;
    const subject = `Forderungsangelegenheit – Aktenzeichen ${document.dataSnapshot && typeof document.dataSnapshot === "object" ? (document.dataSnapshot as { case?: { caseNumber?: string } }).case?.caseNumber ?? document.caseId : document.caseId}`;
    const delivery = await this.prisma.documentDelivery.upsert({ where: { documentId_channel: { documentId, channel: DocumentDeliveryChannel.EMAIL } }, update: {}, create: { tenantId, documentId, caseId: document.caseId, channel: DocumentDeliveryChannel.EMAIL, status: recipient ? DocumentDeliveryStatus.PENDING : DocumentDeliveryStatus.SKIPPED, recipient, subject } });
    if (!recipient) {
      await this.activity.recordSystemEvent(this.prisma, { tenantId, caseId: document.caseId, partyId: debtorPartyId, eventType: ActivityEventType.DOCUMENT_EMAIL_SKIPPED, description: "Forderungs-E-Mail wurde mangels E-Mail-Adresse übersprungen.", metadata: { documentId }, sourceEntityType: "DocumentDelivery", sourceEntityId: delivery.id });
      return;
    }
    if (delivery.status === DocumentDeliveryStatus.SENT) return;
    try {
      const sent = await this.mail.send({ to: recipient, subject, text: `Guten Tag,\n\nanbei erhalten Sie das Forderungsschreiben zu Ihrem Aktenzeichen ${subject.split(" ").at(-1)}.\n\nMit freundlichen Grüßen\npayveo`, attachments: [{ filename: document.filename, contentType: "application/pdf", content: await this.storage.read(document.storageKey) }] });
      const updated = await this.prisma.documentDelivery.update({ where: { id: delivery.id }, data: { status: DocumentDeliveryStatus.SENT, attemptedAt: new Date(), sentAt: new Date(), provider: sent.provider, providerMessageId: sent.providerMessageId, errorCode: null, errorMessage: null } });
      await this.activity.recordSystemEvent(this.prisma, { tenantId, caseId: document.caseId, partyId: debtorPartyId, eventType: ActivityEventType.DOCUMENT_EMAIL_SENT, description: "Forderungs-E-Mail wurde versendet.", metadata: { documentId, deliveryId: updated.id }, sourceEntityType: "DocumentDelivery", sourceEntityId: updated.id });
    } catch (error) {
      const updated = await this.prisma.documentDelivery.update({ where: { id: delivery.id }, data: { status: DocumentDeliveryStatus.FAILED, attemptedAt: new Date(), failedAt: new Date(), errorCode: "MAIL_SEND_FAILED", errorMessage: error instanceof Error ? error.message : "Mailversand fehlgeschlagen." } });
      await this.activity.recordSystemEvent(this.prisma, { tenantId, caseId: document.caseId, partyId: debtorPartyId, eventType: ActivityEventType.DOCUMENT_EMAIL_FAILED, description: "Forderungs-E-Mail konnte nicht versendet werden.", metadata: { documentId, deliveryId: updated.id }, sourceEntityType: "DocumentDelivery", sourceEntityId: updated.id });
    }
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
  private composeSystemBody(templateKey: string, templateBody: string, snapshot: Record<string, unknown>) {
    if (!SYSTEM_TEMPLATE_RULES[templateKey]) return templateBody;
    const greeting = "Sehr geehrte Damen und Herren,";
    const legal = this.record(snapshot.legalDetails);
    const claim = this.record(snapshot.claim);
    const ledger = this.record(snapshot.ledger);
    const document = this.record(snapshot.document);
    const title = this.record(snapshot.title);
    const action = this.record(snapshot.enforcementAction);
    const plan = this.record(snapshot.installmentPlan);
    const correspondence = this.record(snapshot.correspondence);
    const dueDate = String(document.paymentDueDate ?? "").trim();
    const total = String(ledger.openTotal ?? "").trim();
    const amount = total ? this.money(total) : "";
    const invoiceReference = String(claim.invoiceNumber ?? "").trim();
    const claimReference = invoiceReference ? ` aus der Rechnung ${invoiceReference}` : "";
    const request = (prefix: string) => {
      return `${prefix}, den nachstehend ausgewiesenen Gesamtbetrag von ${amount} bis spätestens zum ${dueDate} auszugleichen.`;
    };
    const closing = "Für Rückfragen oder falls Sie Einwendungen gegen die Forderung haben, stehen wir Ihnen gerne zur Verfügung.";
    const interestAndCosts = [legal.interest, legal.costs]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .join(" ");
    const titleName = this.titleName(String(title.type ?? ""));
    const actionName = this.actionName(String(action.type ?? ""));
    const titleDate = String(title.titleDate ?? "").trim();
    const titleReference = String(title.referenceNumber ?? "").trim();
    const titleAuthority = String(title.courtOrAuthority ?? "").trim();
    const planItems = this.array(plan.items).map((item) => this.record(item));
    const firstInstallment = planItems[0];
    const paidInstallments = planItems.filter((item) => item.status === "PAID").length;

    if (templateKey === "payment-request-consumer" || templateKey === "payment-request-business") {
      const firstParagraph = [legal.commission, legal.clientAddress, legal.claim]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
        .join(" ");
      const contextParagraph = templateKey === "payment-request-business"
        ? "Da die Forderung gegenüber einem Unternehmen besteht, richten sich Verzugszinsen und die Erstattungsfähigkeit der Kosten nach den für den unternehmerischen Geschäftsverkehr geltenden gesetzlichen Vorschriften."
        : "Die ausgewiesenen Verzugszinsen und Inkassokosten wurden auf Grundlage der für Verbraucherforderungen maßgeblichen gesetzlichen Vorschriften ermittelt.";
      const portal = templateKey === "payment-request-consumer"
        ? "Wenn Sie den Betrag nicht auf einmal ausgleichen können, können Sie über das Schuldnerportal eine Ratenzahlung anfragen."
        : "Bitte veranlassen Sie die Zahlung unter Angabe des Aktenzeichens als Verwendungszweck.";
      return [greeting, firstParagraph, interestAndCosts, contextParagraph, request("Wir bitten Sie daher"), closing, portal, "Mit freundlichen Grüßen\npayveo"]
        .filter(Boolean)
        .join("\n\n");
    }
    if (templateKey === "payment-reminder") {
      return [
        greeting,
        `Mit unserem Schreiben vom ${String(correspondence.firstPaymentRequestDate ?? "dem vorherigen Datum")} haben wir Sie bereits gebeten, die Forderung${claimReference} auszugleichen. Bis heute konnten wir keinen vollständigen Zahlungseingang feststellen. Der aktuelle Forderungsstand beträgt ${amount}.`,
        interestAndCosts,
        request("Wir fordern Sie erneut auf"),
        "Sollte die Frist ohne vollständigen Ausgleich verstreichen, behalten wir uns vor, weitere Schritte der Rechtsverfolgung zu prüfen.",
        closing,
        "Mit freundlichen Grüßen\npayveo",
      ].join("\n\n");
    }
    if (templateKey === "court-dunning-notice") return [greeting, `Trotz der bisherigen Korrespondenz ist die Forderung${claimReference} weiterhin offen. Der aktuelle Gesamtbetrag beträgt ${amount}.`, request("Wir fordern Sie letztmalig auf"), "Nach fruchtlosem Ablauf dieser Frist kann die gerichtliche Rechtsverfolgung, insbesondere ein Mahnverfahren, veranlasst oder geprüft werden. Dadurch können weitere gesetzlich erstattungsfähige Kosten entstehen.", closing, "Mit freundlichen Grüßen\npayveo"].join("\n\n");
    if (templateKey === "title-notification") return [greeting, `In der oben bezeichneten Angelegenheit liegt nun ein ${titleName} vor${titleAuthority ? `, erlassen durch ${titleAuthority}` : ""}${titleReference ? ` unter dem Aktenzeichen ${titleReference}` : ""}${titleDate ? `. Das Titeldatum ist der ${titleDate}` : ""}.`, title.serviceDate ? `Die Zustellung erfolgte am ${title.serviceDate}.` : "", title.enforceableFrom ? `Der Titel ist seit dem ${title.enforceableFrom} vollstreckbar.` : "", `Die titulierte Forderung beträgt insgesamt ${this.money(title.titleTotal)}. Davon entfallen ${this.money(title.principalAmount)} auf die Hauptforderung, ${this.money(title.costAmount)} auf Kosten und ${this.money(title.interestAmount)} auf Zinsen. Nach dem aktuellen Buchungsstand beträgt der offene Betrag ${amount}.`, request("Wir bitten Sie"), "Ein vollstreckbarer Titel ermöglicht grundsätzlich die Einleitung von Zwangsvollstreckungsmaßnahmen. Über konkrete Maßnahmen entscheiden wir erst unter Berücksichtigung des weiteren Zahlungsverlaufs.", closing, "Mit freundlichen Grüßen\npayveo"].filter(Boolean).join("\n\n");
    if (templateKey === "enforcement-notice") return [greeting, `Unter Bezugnahme auf den ${titleName}${titleReference ? ` zum Aktenzeichen ${titleReference}` : ""} stellen wir fest, dass die Forderung weiterhin nicht vollständig ausgeglichen ist. Der aktuelle offene Betrag beträgt ${amount}.`, request("Wir fordern Sie daher letztmalig auf"), action.type ? `Nach ergebnislosem Fristablauf kann die vorbereitete Maßnahme „${actionName}“ im Rahmen der gesetzlichen Voraussetzungen weiterverfolgt werden.` : "Nach ergebnislosem Fristablauf können geeignete Zwangsvollstreckungsmaßnahmen im Rahmen der gesetzlichen Voraussetzungen veranlasst werden.", closing, "Mit freundlichen Grüßen\npayveo"].join("\n\n");
    if (templateKey === "case-settled") return [greeting, `wir bestätigen, dass die Forderungsangelegenheit zum Aktenzeichen ${this.record(snapshot.case).caseNumber} nach dem aktuellen Buchungsstand vollständig ausgeglichen ist.`, "Die Angelegenheit wird bei payveo als erledigt geführt. Diese Bestätigung betrifft ausschließlich den hier dokumentierten Forderungsstand.", "Wir danken Ihnen für die Erledigung.", "Mit freundlichen Grüßen\npayveo"].join("\n\n");
    if (templateKey === "installment-agreement") return [greeting, `wir bestätigen die für die Forderungsangelegenheit zum Aktenzeichen ${this.record(snapshot.case).caseNumber} getroffene Ratenvereinbarung. Der Gesamtplanbetrag beträgt ${this.money(plan.initialOpenAmount)}; die vereinbarte Rate beträgt ${this.money(plan.plannedInstallmentAmount)}.`, firstInstallment?.dueDate || plan.startDate ? `Die erste Rate ist am ${firstInstallment?.dueDate ?? this.displayDate(plan.startDate)} fällig. Die weiteren Raten richten sich nach der nachfolgenden tabellarischen Ratenübersicht und sind jeweils fristgerecht zu zahlen.` : "Die weiteren Raten richten sich nach der nachfolgenden tabellarischen Ratenübersicht und sind jeweils fristgerecht zu zahlen.", "Bitte verwenden Sie bei jeder Zahlung das Aktenzeichen als Verwendungszweck. Zahlungsdaten und den aktuellen Planstand finden Sie auch im Schuldnerportal.", "Bitte halten Sie die vereinbarten Fälligkeiten ein; bei Fragen zu einzelnen Raten kontaktieren Sie uns rechtzeitig.", "Mit freundlichen Grüßen\npayveo"].join("\n\n");
    if (templateKey === "installment-default-notice") return [greeting, `die Ratenvereinbarung zum Aktenzeichen ${this.record(snapshot.case).caseNumber} wird aktuell als ausgefallen geführt. Von ${planItems.length} vereinbarten Raten wurden bislang ${paidInstallments} vollständig erfüllt.`, `Der derzeit offene Betrag beträgt ${amount}.`, request("Wir bitten Sie"), "Nach fruchtlosem Ablauf der Frist kann die weitere Rechtsverfolgung geprüft werden.", closing, "Mit freundlichen Grüßen\npayveo"].join("\n\n");
    if (templateKey === "claim-statement") return [greeting, `nachfolgend erhalten Sie zum Stichtag ${this.record(snapshot.claimStatement).asOf ? this.displayDate(this.record(snapshot.claimStatement).asOf) : this.record(snapshot.today)} die aktuelle Forderungsaufstellung zur Forderungsangelegenheit des Auftraggebers ${this.record(snapshot.client).displayName} gegen ${this.record(snapshot.debtor).displayName} unter dem Aktenzeichen ${this.record(snapshot.case).caseNumber}.`, "Die nachstehende Übersicht bildet den aktuellen Buchungs- und Forderungsstand ab.", "Mit freundlichen Grüßen\npayveo"].join("\n\n");
    if (templateKey === "enforcement-cover-letter") return [greeting, `in vorbezeichneter Angelegenheit ersuchen wir um Bearbeitung der angelegten Maßnahme „${actionName}“. Gläubiger ist ${this.record(snapshot.client).displayName}; Schuldner ist ${this.record(snapshot.debtor).displayName}.`, `Grundlage ist der ${titleName}${titleReference ? ` zum Aktenzeichen ${titleReference}` : ""}${titleAuthority ? ` der Stelle ${titleAuthority}` : ""}${titleDate ? ` vom ${titleDate}` : ""}. Der aktuelle Forderungsstand beträgt ${amount}.`, "Die für die Bearbeitung erforderlichen Unterlagen zum Titel und zur Forderung sind beigefügt. Für Rückfragen stehen wir unter Angabe des payveo-Aktenzeichens gerne zur Verfügung.", "Mit freundlichen Grüßen\npayveo"].join("\n\n");
    if (templateKey === "enforcement-order") return [greeting, `für die Forderungsangelegenheit des Gläubigers ${this.record(snapshot.client).displayName} gegen ${this.record(snapshot.debtor).displayName} liegt ein ${titleName}${title.referenceNumber ? ` zum Aktenzeichen ${title.referenceNumber}` : ""} vor. Der aktuelle Forderungsstand beträgt ${amount}.`, "Dieses Schreiben dient als strukturierte Unterlage zur Vorbereitung der Vollstreckung. Maßgebliche amtliche Formulare und deren gesetzliche Anforderungen bleiben unberührt.", "Mit freundlichen Grüßen\npayveo"].join("\n\n");
    if (templateKey === "garnishment-application") return [greeting, `für die Forderungsangelegenheit des Gläubigers ${this.record(snapshot.client).displayName} gegen ${this.record(snapshot.debtor).displayName} wird die Maßnahme „${actionName}“ vorbereitet. Grundlage ist der ${titleName}${title.referenceNumber ? ` zum Aktenzeichen ${title.referenceNumber}` : ""}; der aktuelle Forderungsstand beträgt ${amount}.`, "Dieses Schreiben ist eine strukturierte Begleitunterlage zur amtlichen Formularbearbeitung und kein amtlicher Pfändungs- und Überweisungsbeschluss oder Antrag. Die erforderlichen amtlichen Formulare sind gesondert und vollständig zu verwenden.", "Für Rückfragen stehen wir unter Angabe des payveo-Aktenzeichens zur Verfügung.", "Mit freundlichen Grüßen\npayveo"].join("\n\n");
    return templateBody;
  }
  private installmentPlanSnapshot(plan: InstallmentPlanWithItems | null) {
    if (!plan) return null;
    return {
      status: plan.status,
      initialOpenAmount: plan.initialOpenAmount.toFixed(2),
      plannedInstallmentAmount: plan.plannedInstallmentAmount.toFixed(2),
      startDate: this.date(plan.startDate),
      numberOfInstallments: plan.numberOfInstallments,
      items: plan.items.map((item) => ({
        sequenceNumber: item.sequenceNumber,
        dueDate: this.date(item.dueDate),
        plannedAmount: item.plannedAmount.toFixed(2),
        status: item.status,
      })),
    };
  }
  private titleName(type: string) {
    const names: Record<string, string> = {
      ENFORCEMENT_ORDER: "Vollstreckungsbescheid",
      JUDGMENT: "Urteil",
      COST_ASSESSMENT_ORDER: "Kostenfestsetzungsbeschluss",
      SETTLEMENT: "Vergleich",
      NOTARIAL_DEED: "notarielles Schuldanerkenntnis",
      OTHER: "Vollstreckungstitel",
    };
    return names[type] ?? "Vollstreckungstitel";
  }
  private actionName(type: string) {
    const names: Record<string, string> = {
      BAILIFF_ORDER: "Vollstreckungsauftrag an den Gerichtsvollzieher",
      ASSET_DISCLOSURE: "Antrag auf Vermögensauskunft",
      GARNISHMENT: "Pfändungsmaßnahme",
      ACCOUNT_GARNISHMENT: "Kontopfändung",
      WAGE_GARNISHMENT: "Lohnpfändung",
      OTHER: "Vollstreckungsmaßnahme",
    };
    return names[type] ?? "Vollstreckungsmaßnahme";
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
  private record(value: unknown) {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }
  private array(value: unknown) {
    return Array.isArray(value) ? value : [];
  }
  private money(value: unknown) {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(new Prisma.Decimal(String(value ?? "0")).toFixed(2)));
  }
  private rate(value: unknown) {
    return new Prisma.Decimal(String(value ?? "0")).toDecimalPlaces(2).toFixed(2).replace(".", ",");
  }
  private displayDate(value: unknown) {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? String(value) : this.date(date);
  }
  private date(value: Date) {
    return new Intl.DateTimeFormat("de-DE").format(value);
  }
}
