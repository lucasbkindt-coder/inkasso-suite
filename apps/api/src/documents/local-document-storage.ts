import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

@Injectable()
export class LocalDocumentStorage {
  private readonly root = join(process.cwd(), "../../.data/documents");
  async save(buffer: Buffer) {
    const key = `${randomUUID()}.pdf`;
    await mkdir(this.root, { recursive: true });
    await writeFile(join(this.root, key), buffer);
    return key;
  }
  read(key: string) {
    return readFile(join(this.root, key));
  }
  async exists(key: string) {
    try {
      await access(join(this.root, key));
      return true;
    } catch {
      return false;
    }
  }
  remove(key: string) {
    return rm(join(this.root, key), { force: true });
  }
}
