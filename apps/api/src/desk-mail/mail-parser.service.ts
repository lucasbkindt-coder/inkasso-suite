import { BadRequestException, Injectable } from "@nestjs/common";
import { simpleParser } from "mailparser";
import sanitizeHtml from "sanitize-html";

export type ParsedInboundMail = {
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  subject: string;
  fromAddress: string;
  toAddresses: string[];
  ccAddresses: string[];
  sentAt: Date | null;
  receivedAt: Date;
  bodyPlain: string;
  sanitizedHtml: string | null;
  autoSubmitted: string | null;
  precedence: string | null;
  autoResponseSuppress: string | null;
  explicitTicketId: string | null;
  attachments: { filename: string; mimeType: string; size: number; content: Buffer }[];
};

@Injectable()
export class MailParserService {
  async parse(raw: Buffer): Promise<ParsedInboundMail> {
    if (!raw.length || raw.length > 25 * 1024 * 1024)
      throw new BadRequestException("Die E-Mail ist leer oder größer als 25 MB.");
    const mail = await simpleParser(raw, { skipImageLinks: true });
    const fromAddress = mail.from?.value[0]?.address?.trim().toLowerCase() ?? "";
    if (!this.validEmail(fromAddress))
      throw new BadRequestException("Die Absenderadresse der E-Mail ist ungültig.");
    const html = typeof mail.html === "string" ? this.sanitize(mail.html) : null;
    const plain =
      mail.text?.trim() ||
      (html ? sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim() : "");
    return {
      messageId: this.headerId(mail.messageId),
      inReplyTo: this.headerId(mail.inReplyTo),
      references: (Array.isArray(mail.references)
        ? mail.references
        : mail.references
          ? [mail.references]
          : []
      )
        .map((value) => this.headerId(value))
        .filter((value): value is string => Boolean(value)),
      subject: (mail.subject?.trim() || "Ohne Betreff").slice(0, 998),
      fromAddress,
      toAddresses: this.addresses(mail.to),
      ccAddresses: this.addresses(mail.cc),
      sentAt: mail.date ?? null,
      receivedAt: new Date(),
      bodyPlain: plain || "(Kein Textinhalt)",
      sanitizedHtml: html,
      autoSubmitted: this.header(mail.headers.get("auto-submitted")),
      precedence: this.header(mail.headers.get("precedence")),
      autoResponseSuppress: this.header(mail.headers.get("x-auto-response-suppress")),
      explicitTicketId: this.header(mail.headers.get("x-payveo-ticket-id")),
      attachments: mail.attachments.map((item) => ({
        filename: item.filename || "Anhang",
        mimeType: item.contentType || "application/octet-stream",
        size: item.size,
        content: item.content,
      })),
    };
  }

  sanitize(value: string) {
    return sanitizeHtml(value, {
      allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "blockquote", "a"],
      allowedAttributes: { a: ["href", "title"] },
      allowedSchemes: ["http", "https", "mailto"],
      allowProtocolRelative: false,
      transformTags: {
        a: (_tag, attrs) => ({ tagName: "a", attribs: { ...attrs, rel: "noopener noreferrer" } }),
      },
      exclusiveFilter: (frame) =>
        ["img", "iframe", "object", "embed", "script", "style"].includes(frame.tag),
    });
  }

  private addresses(value: unknown) {
    const item = value as { value?: { address?: string }[] } | undefined;
    return (item?.value ?? [])
      .map((entry) => entry.address?.trim().toLowerCase() ?? "")
      .filter((address) => this.validEmail(address));
  }
  private validEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
  private headerId(value: unknown) {
    const text = this.header(value);
    return text ? text.trim().toLowerCase().slice(0, 998) : null;
  }
  private header(value: unknown) {
    if (typeof value === "string") return value.slice(0, 1000);
    if (value === undefined || value === null) return null;
    return String(value).slice(0, 1000);
  }
}
