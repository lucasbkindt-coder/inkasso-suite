import { Injectable } from "@nestjs/common";
import type { MailAccount, MailDraft } from "@prisma/client";
import { randomUUID } from "node:crypto";

export type MailTransportResult = { providerExternalId: string; messageId: string };

@Injectable()
export class DeskMailTransportService {
  async test(account: Pick<MailAccount, "provider" | "status">) {
    if (account.provider === "MOCK") return { configured: true, connected: true, provider: "MOCK" };
    return {
      configured: account.status !== "NOT_CONFIGURED",
      connected: false,
      provider: "GENERIC_SMTP_IMAP",
      message: "Konfiguration validiert; in P1 wird keine externe Verbindung geöffnet.",
    };
  }
  async send(
    account: Pick<MailAccount, "provider" | "emailAddress">,
    draft: Pick<MailDraft, "subject" | "toAddresses" | "ccAddresses">,
  ): Promise<MailTransportResult> {
    if (account.provider !== "MOCK") throw new Error("GENERIC_MAIL_PROVIDER_NOT_CONNECTED_IN_P1");
    const messageId = `<${randomUUID()}@payveo.local>`;
    console.info("[desk-mail:log]", {
      account: account.emailAddress,
      recipients: draft.toAddresses.length + draft.ccAddresses.length,
      subjectLength: draft.subject.length,
      messageId,
    });
    return { providerExternalId: `mock-${randomUUID()}`, messageId };
  }
}
