import { BadRequestException, Injectable } from "@nestjs/common";
import { CommunicationAttachmentType } from "@prisma/client";
import { createHash } from "node:crypto";
import { extname } from "node:path";
import { LocalDocumentStorage } from "../documents/local-document-storage";

const allowed = new Map<string, string[]>([
  ["eml", ["message/rfc822", "application/octet-stream"]],
  ["pdf", ["application/pdf", "application/octet-stream"]],
  ["png", ["image/png", "application/octet-stream"]],
  ["jpg", ["image/jpeg", "application/octet-stream"]],
  ["jpeg", ["image/jpeg", "application/octet-stream"]],
  ["doc", ["application/msword", "application/octet-stream"]],
  [
    "docx",
    [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/octet-stream",
    ],
  ],
  ["xls", ["application/vnd.ms-excel", "application/octet-stream"]],
  [
    "xlsx",
    [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/octet-stream",
    ],
  ],
  ["txt", ["text/plain", "application/octet-stream"]],
]);

type PreparedAttachment = {
  attachmentType: CommunicationAttachmentType;
  originalFileName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  sha256: string;
};

@Injectable()
export class MailAttachmentService {
  constructor(private readonly storage: LocalDocumentStorage) {}
  async prepare(
    items: {
      filename: string;
      mimeType: string;
      size: number;
      content: Buffer;
      type?: CommunicationAttachmentType;
    }[],
  ) {
    if (items.length > 10)
      throw new BadRequestException("Es dürfen höchstens zehn Dateien angehängt werden.");
    const saved: string[] = [];
    const data: PreparedAttachment[] = [];
    try {
      for (const item of items) {
        const name = this.name(item.filename);
        const extension = extname(name).slice(1).toLowerCase();
        if (!allowed.get(extension)?.includes(item.mimeType || "application/octet-stream"))
          throw new BadRequestException(`Der Dateityp von ${name} ist nicht zulässig.`);
        if (!item.size || item.size > 10 * 1024 * 1024)
          throw new BadRequestException("Eine Datei darf maximal 10 MB groß sein.");
        const storageKey = await this.storage.save(item.content, extension);
        saved.push(storageKey);
        data.push({
          attachmentType: item.type ?? CommunicationAttachmentType.ATTACHMENT,
          originalFileName: name,
          mimeType: item.mimeType,
          size: item.size,
          storageKey,
          sha256: createHash("sha256").update(item.content).digest("hex"),
        });
      }
      return { data, saved };
    } catch (error) {
      await this.remove(saved);
      throw error;
    }
  }
  remove(keys: string[]) {
    return Promise.all(keys.map((key) => this.storage.remove(key)));
  }
  private name(value: string) {
    const name = value
      .replace(/^.*[\\/]/, "")
      .replace(/[\u0000-\u001f]/g, "")
      .trim();
    if (!name || name === "." || name === "..")
      throw new BadRequestException("Ungültiger Dateiname.");
    return name.slice(0, 255);
  }
}
