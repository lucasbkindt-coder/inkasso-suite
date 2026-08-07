import type { Client } from "./client";
import type { Debtor } from "./debtor";
import type { Document } from "./document";
import type { Note } from "./note";
import type { Payment } from "./payment";
import type { Task } from "./task";

export type CaseStatus =
  | "neu"
  | "aussergerichtlich"
  | "gerichtlich"
  | "vollstreckung"
  | "abgeschlossen";

export interface Case {

  id: string;

  fileNumber: string;

  status: CaseStatus;

  principalClaim: number;

  interest: number;

  costs: number;

  totalClaim: number;

  openAmount: number;

  createdAt: string;

  updatedAt: string;

  dueDate: string;

  clerk: string;

  client: Client;

  debtor: Debtor;

  documents: Document[];

  payments: Payment[];

  tasks: Task[];

  notes: Note[];

}