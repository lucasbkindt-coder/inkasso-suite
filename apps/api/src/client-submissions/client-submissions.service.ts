import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AddressType,
  CasePriority,
  ClientSubmissionStatus,
  ContactType,
  PartyRoleType,
  PartyType,
  Prisma,
  type ClientSubmission,
} from "@prisma/client";
import { CasesService } from "../cases/cases.service";
import { PortalPreviewService } from "../portal-preview/portal-preview.service";
import { PortalAccessService } from "../portal-auth/portal-access.service";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import { CreateClientSubmissionDto } from "./dto/create-client-submission.dto";
import { AcceptClientSubmissionDto, DebtorResolution } from "./dto/accept-client-submission.dto";
import { QueryClientSubmissionsDto } from "./dto/query-client-submissions.dto";
import { RejectClientSubmissionDto } from "./dto/reject-client-submission.dto";

type DebtorCandidateResult = {
  id: string;
  displayName: string;
  type: PartyType;
  address: {
    street: string;
    houseNumber: string | null;
    postalCode: string;
    city: string;
    country: string;
  } | null;
  email: string | null;
  phone: string | null;
  matches: string[];
  matchStrength: "POSSIBLE" | "STRONG";
  caseCount: number;
  clientRelationships: string[];
};

@Injectable()
export class ClientSubmissionsService {
  constructor(
    private prisma: PrismaService,
    private tenant: TenantContextService,
    private previews: PortalPreviewService,
    private portalAccess: PortalAccessService,
    private cases: CasesService,
  ) {}
  async create(dto: CreateClientSubmissionDto, previewToken?: string, sessionToken?: string) {
    const c = await this.portalAccess.resolve(previewToken, sessionToken, "CLIENT");
    const party = await this.prisma.party.findFirst({
      where: {
        id: c.partyId,
        tenantId: c.tenantId,
        deletedAt: null,
        roles: { some: { role: PartyRoleType.CLIENT, deletedAt: null } },
      },
    });
    if (!party) throw new NotFoundException("Mandant wurde nicht gefunden.");
    if (
      dto.debtorType === "PERSON" &&
      (!dto.debtorFirstName?.trim() || !dto.debtorLastName?.trim())
    )
      throw new BadRequestException("Vor- und Nachname sind erforderlich.");
    if (dto.debtorType === "COMPANY" && !dto.debtorCompanyName?.trim())
      throw new BadRequestException("Firmenname ist erforderlich.");
    if (dto.invoiceDate && new Date(dto.invoiceDate) > new Date(dto.dueDate))
      throw new BadRequestException("Rechnungsdatum darf nicht nach dem Fälligkeitsdatum liegen.");
    const amount = new Prisma.Decimal(dto.principalAmount);
    if (amount.lte(0))
      throw new BadRequestException("Die Hauptforderung muss größer als null sein.");
    const item = await this.prisma.clientSubmission.create({
      data: {
        ...dto,
        tenantId: c.tenantId,
        clientPartyId: c.partyId,
        status: ClientSubmissionStatus.SUBMITTED,
        principalAmount: amount,
        dueDate: new Date(dto.dueDate),
        invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : undefined,
        debtorCountry: (dto.debtorCountry ?? "DE").toUpperCase(),
        currency: (dto.currency ?? "EUR").toUpperCase(),
      },
    });
    return {
      id: item.id,
      status: item.status,
      reference: item.reference,
      submittedAt: item.submittedAt,
    };
  }
  async portalList(previewToken?: string, sessionToken?: string) {
    const c = await this.portalAccess.resolve(previewToken, sessionToken, "CLIENT");
    const items = await this.prisma.clientSubmission.findMany({
      where: { tenantId: c.tenantId, clientPartyId: c.partyId },
      include: { acceptedCase: { select: { caseNumber: true } } },
      orderBy: { submittedAt: "desc" },
    });
    return items.map((x) => ({
      id: x.id,
      reference: x.reference,
      debtorDisplayName:
        x.debtorType === "PERSON"
          ? [x.debtorFirstName, x.debtorLastName].filter(Boolean).join(" ")
          : x.debtorCompanyName,
      principalAmount: x.principalAmount.toFixed(2),
      currency: x.currency,
      submittedAt: x.submittedAt,
      status: x.status,
      acceptedCaseId: x.status === "ACCEPTED" ? x.acceptedCaseId : null,
      acceptedCaseNumber: x.status === "ACCEPTED" ? x.acceptedCase?.caseNumber : null,
    }));
  }
  async portalOne(id: string, previewToken?: string, sessionToken?: string) {
    const c = await this.portalAccess.resolve(previewToken, sessionToken, "CLIENT");
    const x = await this.prisma.clientSubmission.findFirst({
      where: { id, tenantId: c.tenantId, clientPartyId: c.partyId },
      include: { acceptedCase: { select: { caseNumber: true } } },
    });
    if (!x) throw new NotFoundException("Eingereichter Auftrag wurde nicht gefunden.");
    const accepted = x.status === "ACCEPTED";
    return {
      id: x.id,
      status: x.status,
      reference: x.reference,
      debtorType: x.debtorType,
      debtorFirstName: x.debtorFirstName,
      debtorLastName: x.debtorLastName,
      debtorCompanyName: x.debtorCompanyName,
      debtorStreet: x.debtorStreet,
      debtorHouseNumber: x.debtorHouseNumber,
      debtorPostalCode: x.debtorPostalCode,
      debtorCity: x.debtorCity,
      debtorCountry: x.debtorCountry,
      debtorEmail: x.debtorEmail,
      debtorPhone: x.debtorPhone,
      invoiceNumber: x.invoiceNumber,
      invoiceDate: x.invoiceDate,
      dueDate: x.dueDate,
      principalAmount: x.principalAmount.toFixed(2),
      currency: x.currency,
      claimDescription: x.claimDescription,
      clientNote: x.clientNote,
      submittedAt: x.submittedAt,
      acceptedCaseId: accepted ? x.acceptedCaseId : null,
      acceptedCaseNumber: accepted ? x.acceptedCase?.caseNumber : null,
    };
  }
  async list(q: QueryClientSubmissionsDto) {
    const tenantId = await this.tenant.getTenantId();
    const where = {
      tenantId,
      status: q.status,
      OR: q.search
        ? [
            { reference: { contains: q.search, mode: "insensitive" as const } },
            { invoiceNumber: { contains: q.search, mode: "insensitive" as const } },
            { debtorCompanyName: { contains: q.search, mode: "insensitive" as const } },
            { debtorLastName: { contains: q.search, mode: "insensitive" as const } },
            {
              clientParty: {
                is: { displayName: { contains: q.search, mode: "insensitive" as const } },
              },
            },
          ]
        : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.clientSubmission.findMany({
        where,
        include: {
          clientParty: { select: { displayName: true } },
          acceptedCase: { select: { caseNumber: true } },
          reviewedByMembership: {
            select: { user: { select: { displayName: true, email: true } } },
          },
        },
        orderBy: { submittedAt: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.clientSubmission.count({ where }),
    ]);
    return {
      items,
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.ceil(total / q.pageSize),
    };
  }
  async one(id: string) {
    const tenantId = await this.tenant.getTenantId();
    const x = await this.prisma.clientSubmission.findFirst({
      where: { id, tenantId },
      include: {
        clientParty: { select: { displayName: true } },
        acceptedCase: { select: { id: true, caseNumber: true } },
        reviewedByMembership: { select: { user: { select: { displayName: true, email: true } } } },
      },
    });
    if (!x) throw new NotFoundException("Eingereichter Auftrag wurde nicht gefunden.");
    return x;
  }

  async debtorCandidates(id: string) {
    const tenantId = await this.tenant.getTenantId();
    const submission = await this.findSubmission(this.prisma, id, tenantId);
    return this.findDebtorCandidates(this.prisma, submission);
  }

  private async findDebtorCandidates(
    client: Prisma.TransactionClient | PrismaService,
    submission: ClientSubmission,
  ): Promise<DebtorCandidateResult[]> {
    const candidates = await client.party.findMany({
      where: {
        tenantId: submission.tenantId,
        deletedAt: null,
        roles: { some: { role: PartyRoleType.DEBTOR, deletedAt: null } },
        OR: this.candidateWhere(submission),
      },
      include: {
        person: true,
        company: true,
        addresses: { where: { deletedAt: null }, orderBy: { isPrimary: "desc" } },
        contacts: { where: { deletedAt: null }, orderBy: { isPrimary: "desc" } },
        debtorCases: {
          where: { deletedAt: null },
          select: { clientParty: { select: { id: true, displayName: true } } },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });

    return candidates
      .map((candidate) => {
        const primaryAddress = candidate.addresses[0] ?? null;
        const email =
          candidate.contacts.find((contact) => contact.type === ContactType.EMAIL)?.value ?? null;
        const phone =
          candidate.contacts.find((contact) => contact.type === ContactType.PHONE)?.value ?? null;
        const matches = this.matchingFields(submission, candidate);
        const matchStrength: DebtorCandidateResult["matchStrength"] = this.isStrongMatch(
          submission,
          candidate,
        )
          ? "STRONG"
          : "POSSIBLE";
        return {
          id: candidate.id,
          displayName: candidate.displayName,
          type: candidate.type,
          address: primaryAddress
            ? {
                street: primaryAddress.street,
                houseNumber: primaryAddress.houseNumber,
                postalCode: primaryAddress.postalCode,
                city: primaryAddress.city,
                country: primaryAddress.country,
              }
            : null,
          email,
          phone,
          matches,
          matchStrength,
          caseCount: candidate.debtorCases.length,
          clientRelationships: Array.from(
            new Map(
              candidate.debtorCases.map((caseRecord) => [
                caseRecord.clientParty.id,
                caseRecord.clientParty.displayName,
              ]),
            ).values(),
          ),
        };
      })
      .filter((candidate) => candidate.matches.length > 0)
      .sort((left, right) => {
        if (left.matchStrength !== right.matchStrength) {
          return left.matchStrength === "STRONG" ? -1 : 1;
        }
        return right.matches.length - left.matches.length;
      });
  }

  async review(id: string) {
    const tenantId = await this.tenant.getTenantId();
    return this.prisma.$transaction(async (tx) => {
      await this.lockSubmission(tx, tenantId, id);
      const submission = await this.findSubmission(tx, id, tenantId);
      if (submission.status === ClientSubmissionStatus.UNDER_REVIEW) return submission;
      if (submission.status !== ClientSubmissionStatus.SUBMITTED) {
        throw new ConflictException("Dieser Auftrag kann nicht mehr in Prüfung gesetzt werden.");
      }
      const reviewedByMembershipId = await this.currentMembershipId(tx, tenantId);
      return tx.clientSubmission.update({
        where: { id },
        data: {
          status: ClientSubmissionStatus.UNDER_REVIEW,
          reviewedAt: new Date(),
          reviewedByMembershipId,
        },
      });
    });
  }

  async reject(id: string, dto: RejectClientSubmissionDto) {
    const tenantId = await this.tenant.getTenantId();
    return this.prisma.$transaction(async (tx) => {
      await this.lockSubmission(tx, tenantId, id);
      const submission = await this.findSubmission(tx, id, tenantId);
      if (
        submission.status !== ClientSubmissionStatus.SUBMITTED &&
        submission.status !== ClientSubmissionStatus.UNDER_REVIEW
      ) {
        throw new ConflictException("Dieser Auftrag kann nicht abgelehnt werden.");
      }
      const now = new Date();
      const reviewedByMembershipId = await this.currentMembershipId(tx, tenantId);
      return tx.clientSubmission.update({
        where: { id },
        data: {
          status: ClientSubmissionStatus.REJECTED,
          rejectedAt: now,
          reviewedAt: submission.reviewedAt ?? now,
          reviewedByMembershipId: submission.reviewedByMembershipId ?? reviewedByMembershipId,
          rejectionReason: dto.rejectionReason?.trim() || null,
        },
      });
    });
  }

  async accept(id: string, dto: AcceptClientSubmissionDto) {
    const tenantId = await this.tenant.getTenantId();
    return this.prisma.$transaction(async (tx) => {
      await this.lockSubmission(tx, tenantId, id);
      const submission = await this.findSubmission(tx, id, tenantId);
      if (submission.status === ClientSubmissionStatus.ACCEPTED || submission.acceptedCaseId) {
        throw new ConflictException("Dieser Auftrag wurde bereits als Inkassoakte übernommen.");
      }
      if (
        submission.status !== ClientSubmissionStatus.SUBMITTED &&
        submission.status !== ClientSubmissionStatus.UNDER_REVIEW
      ) {
        throw new ConflictException("Dieser Auftrag kann nicht angenommen werden.");
      }
      await this.assertClientParty(tx, submission.clientPartyId, tenantId);
      this.assertSubmissionForAcceptance(submission);

      const candidates = await this.findDebtorCandidates(tx, submission);
      const strongCandidateIds = candidates
        .filter((candidate) => candidate.matchStrength === "STRONG")
        .map((candidate) => candidate.id);
      const needsStrongMatchOverride =
        dto.debtorResolution === DebtorResolution.NEW && strongCandidateIds.length > 0;
      const strongMatchOverrideReason = dto.strongMatchOverrideReason?.trim();
      if (
        needsStrongMatchOverride &&
        (!dto.strongMatchOverrideConfirmed || !strongMatchOverrideReason)
      ) {
        throw new ConflictException(
          "Für einen neuen Schuldner trotz sehr wahrscheinlicher Dublette sind Bestätigung und Begründung erforderlich.",
        );
      }

      const debtorPartyId =
        dto.debtorResolution === DebtorResolution.EXISTING
          ? await this.assertExistingDebtorParty(tx, dto.debtorPartyId, tenantId)
          : dto.debtorResolution === DebtorResolution.NEW
            ? await this.createDebtorParty(tx, submission)
            : (() => {
                throw new BadRequestException(
                  "Für die Schuldnerzuordnung ist eine gültige Entscheidung erforderlich.",
                );
              })();

      const invoiceNumber =
        submission.invoiceNumber?.trim() ||
        `MANDANTENAUFTRAG-${submission.id.slice(0, 8).toUpperCase()}`;
      const invoiceDate = submission.invoiceDate ?? submission.dueDate;
      const reviewedByMembershipId = await this.currentMembershipId(tx, tenantId);
      const caseRecord = await this.cases.createInTransaction(tx, tenantId, {
        clientPartyId: submission.clientPartyId,
        debtorPartyId,
        ownerMembershipId: reviewedByMembershipId,
        priority: CasePriority.NORMAL,
        internalNotes: submission.clientNote ?? undefined,
        claim: {
          invoiceNumber,
          invoiceDate: invoiceDate.toISOString(),
          dueDate: submission.dueDate.toISOString(),
          defaultDate: submission.dueDate.toISOString(),
          principalAmount: submission.principalAmount.toFixed(2),
          currency: submission.currency,
          description: submission.claimDescription ?? undefined,
        },
      }, reviewedByMembershipId);
      const now = new Date();
      const accepted = await tx.clientSubmission.update({
        where: { id },
        data: {
          status: ClientSubmissionStatus.ACCEPTED,
          acceptedCaseId: caseRecord.id,
          acceptedAt: now,
          reviewedAt: submission.reviewedAt ?? now,
          reviewedByMembershipId: submission.reviewedByMembershipId ?? reviewedByMembershipId,
          strongMatchOverride: needsStrongMatchOverride,
          strongMatchCandidateIds: needsStrongMatchOverride ? strongCandidateIds : Prisma.DbNull,
          strongMatchOverrideReason: needsStrongMatchOverride ? strongMatchOverrideReason : null,
          strongMatchOverrideAt: needsStrongMatchOverride ? now : null,
        },
      });
      return {
        id: accepted.id,
        status: accepted.status,
        acceptedCaseId: caseRecord.id,
        acceptedCaseNumber: caseRecord.caseNumber,
      };
    });
  }

  private async lockSubmission(tx: Prisma.TransactionClient, tenantId: string, id: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`client-submission:${tenantId}:${id}`}))`;
  }

  private async findSubmission(
    client: Prisma.TransactionClient | PrismaService,
    id: string,
    tenantId: string,
  ) {
    const submission = await client.clientSubmission.findFirst({ where: { id, tenantId } });
    if (!submission) throw new NotFoundException("Eingereichter Auftrag wurde nicht gefunden.");
    return submission;
  }

  private async assertClientParty(tx: Prisma.TransactionClient, partyId: string, tenantId: string) {
    const party = await tx.party.findFirst({
      where: {
        id: partyId,
        tenantId,
        deletedAt: null,
        roles: { some: { role: PartyRoleType.CLIENT, deletedAt: null } },
      },
      select: { id: true },
    });
    if (!party)
      throw new BadRequestException(
        "Der Auftraggeber ist nicht mehr als aktiver Mandant verfügbar.",
      );
  }

  private async assertExistingDebtorParty(
    tx: Prisma.TransactionClient,
    partyId: string | undefined,
    tenantId: string,
  ) {
    if (!partyId)
      throw new BadRequestException("Bitte wählen Sie einen bestehenden Schuldner aus.");
    const party = await tx.party.findFirst({
      where: {
        id: partyId,
        tenantId,
        deletedAt: null,
        roles: { some: { role: PartyRoleType.DEBTOR, deletedAt: null } },
      },
      select: { id: true },
    });
    if (!party) throw new NotFoundException("Der ausgewählte Schuldner ist nicht verfügbar.");
    return party.id;
  }

  private async createDebtorParty(tx: Prisma.TransactionClient, submission: ClientSubmission) {
    const displayName =
      submission.debtorType === PartyType.PERSON
        ? `${submission.debtorFirstName?.trim() ?? ""} ${submission.debtorLastName?.trim() ?? ""}`.trim()
        : (submission.debtorCompanyName?.trim() ?? "");
    const contacts: Prisma.ContactCreateWithoutPartyInput[] = [];
    if (submission.debtorEmail?.trim()) {
      contacts.push({
        type: ContactType.EMAIL,
        value: submission.debtorEmail.trim(),
        isPrimary: true,
      });
    }
    if (submission.debtorPhone?.trim()) {
      contacts.push({
        type: ContactType.PHONE,
        value: submission.debtorPhone.trim(),
        isPrimary: contacts.length === 0,
      });
    }
    const party = await tx.party.create({
      data: {
        tenantId: submission.tenantId,
        type: submission.debtorType,
        displayName,
        roles: { create: { role: PartyRoleType.DEBTOR } },
        person:
          submission.debtorType === PartyType.PERSON
            ? {
                create: {
                  firstName: submission.debtorFirstName?.trim() ?? "",
                  lastName: submission.debtorLastName?.trim() ?? "",
                },
              }
            : undefined,
        company:
          submission.debtorType === PartyType.COMPANY
            ? { create: { companyName: submission.debtorCompanyName?.trim() ?? "" } }
            : undefined,
        addresses: {
          create: {
            type: AddressType.PRIMARY,
            street: submission.debtorStreet.trim(),
            houseNumber: submission.debtorHouseNumber?.trim() || undefined,
            postalCode: submission.debtorPostalCode.trim(),
            city: submission.debtorCity.trim(),
            country: submission.debtorCountry.toUpperCase(),
            isPrimary: true,
          },
        },
        contacts: contacts.length ? { create: contacts } : undefined,
      },
      select: { id: true },
    });
    return party.id;
  }

  private assertSubmissionForAcceptance(submission: ClientSubmission) {
    if (
      submission.debtorType === PartyType.PERSON &&
      (!submission.debtorFirstName?.trim() || !submission.debtorLastName?.trim())
    ) {
      throw new BadRequestException("Der Auftrag enthält keinen vollständigen Personenschuldner.");
    }
    if (submission.debtorType === PartyType.COMPANY && !submission.debtorCompanyName?.trim()) {
      throw new BadRequestException("Der Auftrag enthält keinen Unternehmensnamen.");
    }
    if (
      !submission.debtorStreet.trim() ||
      !submission.debtorPostalCode.trim() ||
      !submission.debtorCity.trim()
    ) {
      throw new BadRequestException("Der Auftrag enthält keine vollständige Schuldneranschrift.");
    }
    if (submission.principalAmount.lte(0)) {
      throw new BadRequestException("Die Hauptforderung muss größer als null sein.");
    }
    if (submission.invoiceDate && submission.invoiceDate > submission.dueDate) {
      throw new BadRequestException("Rechnungsdatum darf nicht nach dem Fälligkeitsdatum liegen.");
    }
  }

  private candidateWhere(submission: ClientSubmission): Prisma.PartyWhereInput["OR"] {
    const filters: Prisma.PartyWhereInput[] = [];
    const firstName = this.normalizeText(submission.debtorFirstName);
    const lastName = this.normalizeText(submission.debtorLastName);
    const companyName = this.normalizeText(submission.debtorCompanyName);
    const street = this.normalizeText(submission.debtorStreet);
    const postalCode = this.normalizePostalCode(submission.debtorPostalCode);
    const city = this.normalizeText(submission.debtorCity);
    const houseNumber = this.normalizeText(submission.debtorHouseNumber);
    const email = this.normalizeText(submission.debtorEmail);
    if (
      submission.debtorType === PartyType.PERSON &&
      firstName &&
      lastName
    ) {
      filters.push({
        person: {
          is: {
            firstName: { equals: firstName, mode: "insensitive" },
            lastName: { equals: lastName, mode: "insensitive" },
          },
        },
      });
    }
    if (submission.debtorType === PartyType.COMPANY && companyName) {
      filters.push({
        company: {
          is: { companyName: { equals: companyName, mode: "insensitive" } },
        },
      });
    }
    const addressMatch: Prisma.AddressWhereInput = {
      deletedAt: null,
      street: { equals: street, mode: "insensitive" },
      postalCode: { equals: postalCode, mode: "insensitive" },
      city: { equals: city, mode: "insensitive" },
    };
    if (houseNumber) {
      addressMatch.houseNumber = {
        equals: houseNumber,
        mode: "insensitive",
      };
    }
    filters.push({ addresses: { some: addressMatch } });
    if (email) {
      filters.push({
        contacts: {
          some: {
            deletedAt: null,
            type: ContactType.EMAIL,
            value: { equals: email, mode: "insensitive" },
          },
        },
      });
    }
    if (submission.debtorPhone?.trim()) {
      filters.push({
        contacts: {
          some: { deletedAt: null, type: ContactType.PHONE, value: submission.debtorPhone.trim() },
        },
      });
    }
    return filters;
  }

  private matchingFields(
    submission: ClientSubmission,
    candidate: Prisma.PartyGetPayload<{
      include: { person: true; company: true; addresses: true; contacts: true };
    }>,
  ) {
    const matches: string[] = [];
    if (
      submission.debtorType === PartyType.PERSON &&
      candidate.person &&
      this.equalText(submission.debtorFirstName, candidate.person.firstName) &&
      this.equalText(submission.debtorLastName, candidate.person.lastName)
    )
      matches.push("Name");
    if (
      submission.debtorType === PartyType.COMPANY &&
      candidate.company &&
      this.equalText(submission.debtorCompanyName, candidate.company.companyName)
    )
      matches.push("Firma");
    if (candidate.addresses.some((address) => this.addressMatches(submission, address, false)))
      matches.push("Anschrift");
    if (
      submission.debtorEmail?.trim() &&
      candidate.contacts.some(
        (contact) =>
          contact.type === ContactType.EMAIL &&
          this.equalText(contact.value, submission.debtorEmail),
      )
    )
      matches.push("E-Mail");
    if (
      submission.debtorPhone?.trim() &&
      candidate.contacts.some(
        (contact) =>
          contact.type === ContactType.PHONE &&
          this.normalizePhone(contact.value) === this.normalizePhone(submission.debtorPhone),
      )
    )
      matches.push("Telefon");
    return matches;
  }

  private isStrongMatch(
    submission: ClientSubmission,
    candidate: Prisma.PartyGetPayload<{
      include: { person: true; company: true; addresses: true; contacts: true };
    }>,
  ) {
    const hasExactAddress = candidate.addresses.some((address) =>
      this.addressMatches(submission, address, true),
    );
    if (!hasExactAddress) return false;
    if (submission.debtorType === PartyType.PERSON && candidate.person) {
      return (
        this.equalText(submission.debtorFirstName, candidate.person.firstName) &&
        this.equalText(submission.debtorLastName, candidate.person.lastName)
      );
    }
    if (submission.debtorType === PartyType.COMPANY && candidate.company) {
      return this.equalText(submission.debtorCompanyName, candidate.company.companyName);
    }
    return false;
  }

  private addressMatches(
    submission: ClientSubmission,
    address: { street: string; houseNumber: string | null; postalCode: string; city: string },
    requireHouseNumber: boolean,
  ) {
    const submissionHouseNumber = this.normalizeText(submission.debtorHouseNumber);
    return (
      this.equalText(address.street, submission.debtorStreet) &&
      this.normalizePostalCode(address.postalCode) ===
        this.normalizePostalCode(submission.debtorPostalCode) &&
      this.equalText(address.city, submission.debtorCity) &&
      (!requireHouseNumber ||
        (Boolean(submissionHouseNumber) &&
          submissionHouseNumber === this.normalizeText(address.houseNumber)))
    );
  }

  private equalText(left: string | null | undefined, right: string | null | undefined) {
    return Boolean(this.normalizeText(left)) && this.normalizeText(left) === this.normalizeText(right);
  }

  private normalizeText(value: string | null | undefined) {
    return (value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");
  }

  private normalizePostalCode(value: string | null | undefined) {
    return (value ?? "").trim();
  }

  private normalizePhone(value: string | null | undefined) {
    return (value ?? "").trim().replace(/[\s()./-]/g, "").replace(/^00/, "+");
  }

  private async currentMembershipId(_tx: Prisma.TransactionClient, _tenantId: string) {
    const context = this.tenant.getStaffContext();
    if (context.tenantId !== _tenantId) throw new NotFoundException("Mitgliedschaft wurde nicht gefunden.");
    return context.tenantMembershipId;
  }
}
