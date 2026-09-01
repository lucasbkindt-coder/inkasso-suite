export type BankImportStatus = "PROCESSING" | "COMPLETED" | "COMPLETED_WITH_REVIEW" | "FAILED";
export type BankTransactionStatus =
  | "IMPORTED"
  | "MATCHED"
  | "BOOKED"
  | "REVIEW_REQUIRED"
  | "DUPLICATE"
  | "IGNORED"
  | "ERROR"
  | "PAYMENT_REVERSED";

export type BankImport = {
  id: string;
  fileName: string;
  fileFormat: "CAMT_053" | "CAMT_054";
  status: BankImportStatus;
  importedAt: string;
  transactionCount: number;
  matchedCount: number;
  bookedCount: number;
  reviewCount: number;
  duplicateCount: number;
  errorCount: number;
  importedBy: { user: { displayName: string | null; email: string } };
};

export type BankCaseCandidate = {
  id: string;
  caseNumber: string;
  debtorName: string;
  clientName: string;
  openAmount: string;
  currency: string;
};

export type BankTransaction = {
  id: string;
  bankImportId: string;
  bookingDate: string;
  valueDate: string | null;
  amount: string;
  currency: string;
  direction: "CREDIT" | "DEBIT";
  debtorName: string | null;
  debtorIban: string | null;
  creditorName: string | null;
  creditorIban: string | null;
  purpose: string;
  bankReference: string | null;
  endToEndId: string | null;
  mandateReference: string | null;
  creditorReference: string | null;
  bankTransactionCode: string | null;
  status: BankTransactionStatus;
  matchScore: number | null;
  matchReason: string | null;
  ignoreReason: string | null;
  reviewedAt: string | null;
  bankImport: Pick<BankImport, "id" | "fileName" | "fileFormat" | "importedAt">;
  matchedCase: {
    id: string;
    caseNumber: string;
    status: string;
    clientParty: { displayName: string };
    debtorParty: { displayName: string };
  } | null;
  matchedParty: { id: string; displayName: string } | null;
  payment: {
    id: string;
    status: string;
    amount: string;
    currency: string;
    bookingDate: string;
  } | null;
  reviewedBy: { user: { displayName: string | null; email: string } } | null;
};

export type BankTransactionDetail = BankTransaction & { candidates: BankCaseCandidate[] };
type ApiError = { message?: string | string[] };

async function errorMessage(response: Response) {
  const body = (await response.json().catch(() => null)) as ApiError | null;
  return Array.isArray(body?.message)
    ? body.message.join(" ")
    : (body?.message ?? "Die Anfrage konnte nicht verarbeitet werden.");
}

async function call<T>(path: string, init?: RequestInit) {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return (await response.json()) as T;
}

async function downloadImport(item: BankImport) {
  const response = await fetch(`/api/bank-imports/${item.id}/download`, { credentials: "include" });
  if (!response.ok) throw new Error(await errorMessage(response));
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = item.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const bankImportApi = {
  imports: () => call<BankImport[]>("/bank-imports"),
  upload: (file: File) => {
    const body = new FormData();
    body.set("file", file);
    return call<BankImport>("/bank-imports", { method: "POST", body });
  },
  transactions: (
    filters: {
      status?: BankTransactionStatus;
      importId?: string;
      bookingFrom?: string;
      bookingTo?: string;
    } = {},
  ) => {
    const query = new URLSearchParams(
      Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])),
    );
    return call<BankTransaction[]>(`/bank-imports/transactions${query.size ? `?${query}` : ""}`);
  },
  transaction: (id: string) => call<BankTransactionDetail>(`/bank-imports/transactions/${id}`),
  searchCases: (query: string) =>
    call<BankCaseCandidate[]>(`/bank-imports/cases/search?query=${encodeURIComponent(query)}`),
  book: (id: string, caseId: string) =>
    call(`/bank-imports/transactions/${id}/book`, {
      method: "POST",
      body: JSON.stringify({ caseId }),
    }),
  ignore: (id: string, reason: string) =>
    call(`/bank-imports/transactions/${id}/ignore`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  downloadImport,
};
