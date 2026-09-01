import { BankFileFormat, BankTransactionDirection } from "@prisma/client";

export type ParsedBankTransaction = {
  externalTransactionId?: string;
  bookingDate: Date;
  valueDate?: Date;
  amount: string;
  currency: string;
  direction: BankTransactionDirection;
  debtorName?: string;
  debtorIban?: string;
  creditorName?: string;
  creditorIban?: string;
  purpose: string;
  bankReference?: string;
  endToEndId?: string;
  mandateReference?: string;
  creditorReference?: string;
  bankTransactionCode?: string;
  normalizedData: Record<string, string>;
};

export type ParsedBankFile = {
  format: BankFileFormat;
  transactions: ParsedBankTransaction[];
};

export interface BankFileParser {
  parse(buffer: Buffer): ParsedBankFile;
}
