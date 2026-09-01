import { Injectable } from "@nestjs/common";
import {
  ActivityActorType,
  ActivityEventType,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

type DbClient = Prisma.TransactionClient | PrismaService;
type EventInput = {
  tenantId: string;
  caseId?: string;
  partyId?: string;
  eventType: ActivityEventType;
  title?: string;
  description?: string;
  metadata?: Prisma.InputJsonValue;
  sourceEntityType?: string;
  sourceEntityId?: string;
};

const TITLES: Record<ActivityEventType, string> = {
  PARTY_CREATED: "Partei angelegt",
  PARTY_UPDATED: "Partei bearbeitet",
  PARTY_ADDRESS_UPDATED: "Anschrift aktualisiert",
  PARTY_CONTACT_UPDATED: "Kontaktdaten aktualisiert",
  CASE_CREATED: "Inkassoakte angelegt",
  CASE_STATUS_CHANGED: "Aktenstatus geändert",
  CASE_ASSIGNEE_CHANGED: "Sachbearbeitung geändert",
  CLAIM_CREATED: "Forderung angelegt",
  CLAIM_UPDATED: "Forderung bearbeitet",
  COST_CREATED: "Kosten gebucht",
  PAYMENT_CREATED: "Zahlung erfasst",
  PAYMENT_REVERSED: "Zahlung storniert",
  DOCUMENT_CREATED: "Dokument erstellt",
  DOCUMENT_VOIDED: "Dokument annulliert",
  DOCUMENT_EMAIL_SENT: "Forderungs-E-Mail versendet",
  DOCUMENT_EMAIL_FAILED: "Forderungs-E-Mail fehlgeschlagen",
  DOCUMENT_EMAIL_SKIPPED: "Forderungs-E-Mail übersprungen",
  TASK_CREATED: "Aufgabe angelegt",
  TASK_UPDATED: "Aufgabe bearbeitet",
  TASK_COMPLETED: "Aufgabe erledigt",
  INSTALLMENT_REQUEST_CREATED: "Ratenanfrage eingegangen",
  INSTALLMENT_REQUEST_REVIEWED: "Ratenanfrage geprüft",
  INSTALLMENT_REQUEST_APPROVED: "Ratenanfrage genehmigt",
  INSTALLMENT_REQUEST_REJECTED: "Ratenanfrage abgelehnt",
  INSTALLMENT_PLAN_CREATED: "Ratenplan erstellt",
  INSTALLMENT_PLAN_ACTIVATED: "Ratenplan aktiviert",
  INSTALLMENT_PLAN_CANCELLED: "Ratenplan storniert",
  INSTALLMENT_PLAN_DEFAULTED: "Ratenplan als gescheitert markiert",
  INSTALLMENT_PLAN_COMPLETED: "Ratenplan abgeschlossen",
  COMMUNICATION_CREATED: "Kommunikation erfasst",
  COMMUNICATION_UPDATED: "Kommunikation bearbeitet",
  COMMUNICATION_ATTACHMENT_ADDED: "Kommunikationsanhang hinzugefügt",
  PORTAL_ACCOUNT_CREATED: "Portalzugang angelegt",
  PORTAL_ACTIVATION_ISSUED: "Portalaktivierung ausgestellt",
  PORTAL_ACCOUNT_ACTIVATED: "Portalzugang aktiviert",
  PORTAL_ACCOUNT_SUSPENDED: "Portalzugang gesperrt",
  PORTAL_ACCOUNT_REACTIVATED: "Portalzugang freigegeben",
  CLIENT_CONTACT_CREATED: "Ansprechpartner angelegt",
  CLIENT_CONTACT_UPDATED: "Ansprechpartner bearbeitet",
  CLIENT_CONTACT_PRIMARY_CHANGED: "Hauptansprechpartner geändert",
  DATA_SUBJECT_REQUEST_CREATED: "Datenschutzfall angelegt",
  DATA_SUBJECT_REQUEST_ASSIGNED: "Datenschutzfall zugewiesen",
  DATA_SUBJECT_IDENTITY_VERIFIED: "Identität geprüft",
  DATA_SUBJECT_REQUEST_STATUS_CHANGED: "Status des Datenschutzfalls geändert",
  DATA_SUBJECT_ACCESS_EXPORT_GENERATED: "Betroffenenauskunft erstellt",
  DATA_SUBJECT_REVIEW_DECIDED: "Datenschutzprüfung entschieden",
  DATA_SUBJECT_RESTRICTION_APPLIED: "Verarbeitung eingeschränkt",
  DATA_SUBJECT_RESTRICTION_REMOVED: "Verarbeitungseinschränkung aufgehoben",
  DATA_SUBJECT_REQUEST_COMPLETED: "Datenschutzfall abgeschlossen",
  BANK_IMPORT_CREATED: "Bankimport angelegt",
  BANK_TRANSACTION_AUTO_MATCHED: "Bankbuchung automatisch zugeordnet",
  BANK_TRANSACTION_REVIEW_REQUIRED: "Bankbuchung zur Prüfung vorgemerkt",
  BANK_TRANSACTION_MANUALLY_MATCHED: "Bankbuchung manuell zugeordnet",
  BANK_TRANSACTION_BOOKED: "Bankzahlung gebucht",
  BANK_TRANSACTION_IGNORED: "Bankbuchung ignoriert",
  ADDRESS_RESEARCH_CREATED: "Adressermittlung angelegt",
  ADDRESS_RESEARCH_RESULT_ADDED: "Rechercheergebnis erfasst",
  ADDRESS_RESEARCH_NO_RESULT: "Adressermittlung ohne Ergebnis abgeschlossen",
  ADDRESS_RESEARCH_RESULT_SELECTED: "Rechercheergebnis ausgewählt",
  ADDRESS_RESEARCH_ADDRESS_APPLIED: "Rechercheanschrift übernommen",
  ADDRESS_RESEARCH_CANCELLED: "Adressermittlung abgebrochen",
  CREDIT_REPORT_CREATED: "Auskunfteiprüfung angelegt",
  CREDIT_REPORT_ELIGIBILITY_CHECKED: "Meldefähigkeit geprüft",
  CREDIT_REPORT_APPROVED: "Auskunfteimeldung freigegeben",
  CREDIT_REPORT_APPROVAL_REVOKED: "Freigabe widerrufen",
  CREDIT_REPORT_STATUS_CHANGED: "Status der Auskunfteiprüfung geändert",
  CREDIT_REPORT_SETTLED: "Auskunfteiprüfung als erledigt markiert",
  TITLE_CREATED: "Titel erfasst",
  TITLE_ACTIVATED: "Titel aktiviert",
  TITLE_VOIDED: "Titel annulliert",
  TITLE_SATISFIED: "Titel als erfüllt markiert",
  ENFORCEMENT_ACTION_CREATED: "Vollstreckungsmaßnahme angelegt",
  ENFORCEMENT_ACTION_STATUS_CHANGED: "Status der Vollstreckungsmaßnahme geändert",
};

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  recordStaffEvent(client: DbClient, membershipId: string, input: EventInput) {
    return this.record(client, {
      ...input,
      actorType: ActivityActorType.STAFF,
      actorMembershipId: membershipId,
    });
  }

  recordPortalEvent(client: DbClient, portalAccountId: string, input: EventInput) {
    return this.record(client, {
      ...input,
      actorType: ActivityActorType.PORTAL,
      actorPortalAccountId: portalAccountId,
    });
  }

  recordSystemEvent(client: DbClient, input: EventInput) {
    return this.record(client, { ...input, actorType: ActivityActorType.SYSTEM });
  }

  async listForCase(tenantId: string, caseId: string, page = 1, limit = 25) {
    return this.list(tenantId, { caseId }, page, limit);
  }

  async listForParty(tenantId: string, partyId: string, page = 1, limit = 25) {
    return this.list(tenantId, { partyId }, page, limit);
  }

  private record(
    client: DbClient,
    input: EventInput & {
      actorType: ActivityActorType;
      actorMembershipId?: string;
      actorPortalAccountId?: string;
    },
  ) {
    return client.activityEvent.create({
      data: {
        tenantId: input.tenantId,
        caseId: input.caseId,
        partyId: input.partyId,
        actorType: input.actorType,
        actorMembershipId: input.actorMembershipId,
        actorPortalAccountId: input.actorPortalAccountId,
        eventType: input.eventType,
        title: input.title ?? TITLES[input.eventType],
        description: input.description,
        metadata: input.metadata,
        sourceEntityType: input.sourceEntityType,
        sourceEntityId: input.sourceEntityId,
      },
    });
  }

  private async list(
    tenantId: string,
    reference: Pick<Prisma.ActivityEventWhereInput, "caseId" | "partyId">,
    page: number,
    limit: number,
  ) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.activityEvent.findMany({
        where: { tenantId, ...reference },
        include: {
          actorMembership: { select: { user: { select: { displayName: true, email: true } } } },
          actorPortalAccount: { select: { portalType: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.activityEvent.count({ where: { tenantId, ...reference } }),
    ]);
    return {
      items: items.map((event) => ({
        ...event,
        actor: event.actorType === ActivityActorType.STAFF
          ? event.actorMembership
            ? event.actorMembership.user.displayName ?? event.actorMembership.user.email
            : "Mitarbeiter"
          : event.actorType === ActivityActorType.PORTAL
            ? event.actorPortalAccount?.portalType === "CLIENT" ? "Mandantenportal" : "Schuldnerportal"
            : "System",
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }
}
