import type { Payment } from "@/types/payment";

export const mockPayments: Payment[] = [
  {
    id: "1",
    bookingDate: "2026-08-01",
    amount: 250,
    reference: "Überweisung",
    type: "Teilzahlung",
  },
  {
    id: "2",
    bookingDate: "2026-07-18",
    amount: 500,
    reference: "SEPA",
    type: "Zahlung",
  },
];
