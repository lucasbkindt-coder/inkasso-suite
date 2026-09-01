import { Injectable } from "@nestjs/common";
import {
  ContactType,
  ExternalIntegrationEntityType,
  IntegrationProvider,
  PartyRoleType,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";

export type ZohoMatchResult =
  | { status: "MATCHED"; partyId: string; matchedBy: "EXTERNAL_LINK" | "EMAIL" | "PHONE" }
  | { status: "REVIEW_REQUIRED"; candidatePartyIds: string[] }
  | { status: "NOT_FOUND"; candidatePartyIds: [] };

@Injectable()
export class ZohoDeskMatchingService {
  constructor(private readonly prisma: PrismaService) {}

  async matchParty(
    tenantId: string,
    input: { externalContactId?: string; email?: string; phone?: string },
  ): Promise<ZohoMatchResult> {
    if (input.externalContactId) {
      const link = await this.prisma.externalIntegrationLink.findFirst({
        where: {
          tenantId,
          provider: IntegrationProvider.ZOHO_DESK,
          entityType: ExternalIntegrationEntityType.PARTY_CONTACT,
          externalId: input.externalContactId,
        },
        select: { partyId: true },
      });
      if (link?.partyId)
        return { status: "MATCHED", partyId: link.partyId, matchedBy: "EXTERNAL_LINK" };
    }
    const email = input.email?.trim().toLowerCase();
    const phone = input.phone ? this.normalizePhone(input.phone) : "";
    if (!email && !phone) return { status: "NOT_FOUND", candidatePartyIds: [] };
    const candidates = await this.prisma.party.findMany({
      where: {
        tenantId,
        deletedAt: null,
        roles: {
          some: { role: { in: [PartyRoleType.CLIENT, PartyRoleType.DEBTOR] }, deletedAt: null },
        },
        contacts: {
          some: {
            deletedAt: null,
            OR: [
              ...(email
                ? [
                    {
                      type: ContactType.EMAIL,
                      value: { equals: email, mode: "insensitive" as const },
                    },
                  ]
                : []),
              ...(phone ? [{ type: { in: [ContactType.PHONE, ContactType.MOBILE] } }] : []),
            ],
          },
        },
      },
      select: {
        id: true,
        contacts: { where: { deletedAt: null }, select: { type: true, value: true } },
      },
    });
    const exact = candidates.filter((party) =>
      party.contacts.some(
        (contact) =>
          (email &&
            contact.type === ContactType.EMAIL &&
            contact.value.trim().toLowerCase() === email) ||
          (phone &&
            (contact.type === ContactType.PHONE || contact.type === ContactType.MOBILE) &&
            this.normalizePhone(contact.value) === phone),
      ),
    );
    if (exact.length === 1) {
      const matchedBy =
        email &&
        exact[0].contacts.some(
          (contact) =>
            contact.type === ContactType.EMAIL && contact.value.trim().toLowerCase() === email,
        )
          ? "EMAIL"
          : "PHONE";
      return { status: "MATCHED", partyId: exact[0].id, matchedBy };
    }
    if (exact.length > 1)
      return { status: "REVIEW_REQUIRED", candidatePartyIds: exact.map((party) => party.id) };
    return { status: "NOT_FOUND", candidatePartyIds: [] };
  }

  private normalizePhone(value: string) {
    const trimmed = value.trim();
    const digits = trimmed.replace(/\D/g, "");
    if (!digits) return "";
    if (trimmed.startsWith("+") || digits.startsWith("00")) return digits.replace(/^00/, "");
    return digits.startsWith("0") ? `49${digits.slice(1)}` : digits;
  }
}
