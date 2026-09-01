import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

@Injectable()
export class BankImportStorage {
  private readonly root = join(process.cwd(), "../../.data/bank-imports");

  async save(buffer: Buffer) {
    const key = `${randomUUID()}.xml`;
    await mkdir(this.root, { recursive: true });
    await writeFile(join(this.root, key), buffer, { mode: 0o600 });
    return key;
  }

  read(key: string) {
    return readFile(join(this.root, key));
  }

  remove(key: string) {
    return rm(join(this.root, key), { force: true });
  }
}
