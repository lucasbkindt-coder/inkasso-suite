import { BadRequestException, Injectable } from "@nestjs/common";
import { BankFileFormat, BankTransactionDirection } from "@prisma/client";
import { XMLParser, XMLValidator } from "fast-xml-parser";

import type { BankFileParser, ParsedBankFile, ParsedBankTransaction } from "./bank-file-parser";

type Node = Record<string, unknown>;

@Injectable()
export class CamtParser implements BankFileParser {
  parse(buffer: Buffer): ParsedBankFile {
    const xml = buffer.toString("utf8");
    if (!xml.trim()) throw new BadRequestException("Die Bankdatei ist leer.");
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
      throw new BadRequestException(
        "DTD- und Entity-Deklarationen sind in Bankdateien nicht zulässig.",
      );
    }
    const validation = XMLValidator.validate(xml, { allowBooleanAttributes: false });
    if (validation !== true)
      throw new BadRequestException("Die Bankdatei enthält kein gültiges XML.");

    let parsed: Node;
    try {
      parsed = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        removeNSPrefix: true,
        parseTagValue: false,
        parseAttributeValue: false,
        processEntities: false,
        trimValues: true,
      }).parse(xml) as Node;
    } catch {
      throw new BadRequestException("Die CAMT-Datei konnte nicht gelesen werden.");
    }

    const document = this.object(parsed.Document);
    const statement = this.object(document.BkToCstmrStmt);
    const notification = this.object(document.BkToCstmrDbtCdtNtfctn);
    const format = Object.keys(statement).length
      ? BankFileFormat.CAMT_053
      : Object.keys(notification).length
        ? BankFileFormat.CAMT_054
        : null;
    if (!format)
      throw new BadRequestException("Unterstützt werden ausschließlich CAMT.053 und CAMT.054.");

    const containers =
      format === BankFileFormat.CAMT_053
        ? this.array(statement.Stmt)
        : this.array(notification.Ntfctn);
    const transactions = containers.flatMap((container) =>
      this.array(this.object(container).Ntry).flatMap((entry) =>
        this.parseEntry(this.object(entry)),
      ),
    );
    if (!transactions.length)
      throw new BadRequestException("Die CAMT-Datei enthält keine Buchungen.");
    return { format, transactions };
  }

  private parseEntry(entry: Node): ParsedBankTransaction[] {
    const details = this.array(this.object(this.object(entry.NtryDtls).TxDtls));
    const values = details.length ? details.map((item) => this.object(item)) : [{}];
    return values.map((detail) => this.transaction(entry, detail));
  }

  private transaction(entry: Node, detail: Node): ParsedBankTransaction {
    const refs = this.object(detail.Refs);
    const parties = this.object(detail.RltdPties);
    const accounts = this.object(detail.RltdAgts);
    const amountNode = this.firstDefined(
      this.object(this.object(this.object(detail.AmtDtls).TxAmt).Amt),
      this.object(detail.Amt),
      this.object(entry.Amt),
    );
    const amount = this.text(amountNode);
    const currency =
      this.attribute(amountNode, "Ccy") || this.attribute(this.object(entry.Amt), "Ccy");
    if (!/^\d+(\.\d+)?$/.test(amount) || !currency) {
      throw new BadRequestException(
        "Eine CAMT-Buchung enthält keinen gültigen Betrag oder keine Währung.",
      );
    }
    const indicator = this.text(detail.CdtDbtInd) || this.text(entry.CdtDbtInd);
    if (indicator !== "CRDT" && indicator !== "DBIT") {
      throw new BadRequestException(
        "Eine CAMT-Buchung enthält keine gültige Soll-/Haben-Kennzeichnung.",
      );
    }
    const direction =
      indicator === "CRDT" ? BankTransactionDirection.CREDIT : BankTransactionDirection.DEBIT;
    const bookingDate = this.date(this.object(entry.BookgDt), "Buchungsdatum");
    const valueDate = this.optionalDate(this.object(entry.ValDt));
    const remittance = this.object(detail.RmtInf);
    const structured = this.array(remittance.Strd).map((value) => this.object(value));
    const purpose = [
      ...this.array(remittance.Ustrd).map((value) => this.text(value)),
      ...structured.map((value) => this.text(value.AddtlRmtInf)),
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const creditorReference = structured
      .map((value) => this.text(this.object(value.CdtrRefInf).Ref))
      .find(Boolean);
    const debtor = this.object(parties.Dbtr);
    const creditor = this.object(parties.Cdtr);
    const debtorAccount = this.object(parties.DbtrAcct);
    const creditorAccount = this.object(parties.CdtrAcct);
    const bankReference = this.cleanReference(
      this.text(refs.AcctSvcrRef) || this.text(entry.AcctSvcrRef),
    );
    const transactionId = this.cleanReference(this.text(refs.TxId));
    const endToEndId = this.cleanReference(this.text(refs.EndToEndId));
    const mandateReference = this.cleanReference(this.text(refs.MndtId));
    const bankTransactionCode = this.bankCode(this.object(entry.BkTxCd));

    return {
      externalTransactionId: transactionId ?? bankReference ?? endToEndId,
      bookingDate,
      valueDate,
      amount,
      currency: currency.toUpperCase(),
      direction,
      debtorName: this.text(debtor.Nm) || undefined,
      debtorIban: this.iban(debtorAccount),
      creditorName: this.text(creditor.Nm) || undefined,
      creditorIban: this.iban(creditorAccount),
      purpose,
      bankReference,
      endToEndId,
      mandateReference,
      creditorReference: this.cleanReference(creditorReference),
      bankTransactionCode: bankTransactionCode || undefined,
      normalizedData: {
        creditDebitIndicator: indicator,
        ...(this.text(accounts.DbtrAgt) ? { debtorAgent: this.text(accounts.DbtrAgt) } : {}),
      },
    };
  }

  private bankCode(value: Node) {
    const domain = this.object(value.Domn);
    const family = this.object(domain.Fmly);
    return [
      this.text(domain.Cd),
      this.text(family.Cd),
      this.text(family.SubFmlyCd),
      this.text(this.object(value.Prtry).Cd),
    ]
      .filter(Boolean)
      .join("/");
  }

  private iban(account: Node) {
    return this.text(this.object(account.Id).IBAN).replace(/\s+/g, "").toUpperCase() || undefined;
  }

  private date(value: Node, label: string) {
    const raw = this.text(value.Dt) || this.text(value.DtTm);
    const parsed = raw ? new Date(raw) : new Date(Number.NaN);
    if (Number.isNaN(parsed.getTime()))
      throw new BadRequestException(`${label} fehlt oder ist ungültig.`);
    return parsed;
  }

  private optionalDate(value: Node) {
    if (!Object.keys(value).length) return undefined;
    return this.date(value, "Valutadatum");
  }

  private cleanReference(value?: string) {
    const normalized = value?.trim();
    return normalized && !/^(NOTPROVIDED|NONREF)$/i.test(normalized) ? normalized : undefined;
  }

  private firstDefined(...values: Node[]) {
    return values.find((value) => Object.keys(value).length) ?? {};
  }

  private attribute(value: Node, name: string) {
    return this.text(value[`@_${name}`]);
  }

  private object(value: unknown): Node {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Node) : {};
  }

  private array(value: unknown): unknown[] {
    return value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
  }

  private text(value: unknown): string {
    if (typeof value === "string" || typeof value === "number") return String(value).trim();
    if (value && typeof value === "object" && !Array.isArray(value))
      return this.text((value as Node)["#text"]);
    return "";
  }
}
