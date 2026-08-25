import { Injectable } from "@nestjs/common";

export type MailAttachment = { filename: string; contentType: string; content: Buffer };
export type MailMessage = { to: string; subject: string; text: string; attachments: MailAttachment[] };

@Injectable()
export class MailService {
  async send(message: MailMessage) {
    if ((process.env.MAIL_TRANSPORT ?? "log") !== "log") throw new Error("Der konfigurierte Mailtransport ist nicht verfügbar.");
    console.info("[mail:log]", { to: message.to, subject: message.subject, attachments: message.attachments.map((item) => ({ filename: item.filename, contentType: item.contentType, bytes: item.content.length })) });
    return { provider: "log", providerMessageId: `log-${Date.now()}` };
  }
}
