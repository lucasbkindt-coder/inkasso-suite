import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

@Injectable()
export class SecretEncryptionService {
  encrypt(value: object) {
    const key = this.key();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
    return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${encrypted.toString("base64")}`;
  }

  decrypt<T>(value: string): T {
    const [version, ivValue, tagValue, encryptedValue] = value.split(":");
    if (version !== "v1" || !ivValue || !tagValue || !encryptedValue)
      throw new BadRequestException("Ungültiges Credential-Format.");
    try {
      const decipher = createDecipheriv("aes-256-gcm", this.key(), Buffer.from(ivValue, "base64"));
      decipher.setAuthTag(Buffer.from(tagValue, "base64"));
      return JSON.parse(
        Buffer.concat([
          decipher.update(Buffer.from(encryptedValue, "base64")),
          decipher.final(),
        ]).toString("utf8"),
      ) as T;
    } catch {
      throw new ServiceUnavailableException("Zugangsdaten konnten nicht entschlüsselt werden.");
    }
  }

  configured() {
    try {
      this.key();
      return true;
    } catch {
      return false;
    }
  }

  private key() {
    const configured = process.env.APP_SECRET_ENCRYPTION_KEY?.trim();
    if (!configured)
      throw new ServiceUnavailableException("APP_SECRET_ENCRYPTION_KEY ist nicht konfiguriert.");
    const key = /^[a-f0-9]{64}$/i.test(configured)
      ? Buffer.from(configured, "hex")
      : Buffer.from(configured, "base64");
    if (key.length !== 32)
      throw new ServiceUnavailableException(
        "APP_SECRET_ENCRYPTION_KEY muss genau 32 Bytes enthalten.",
      );
    return key;
  }
}
