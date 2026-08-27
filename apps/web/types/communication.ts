export type CommunicationDirection = "INBOUND" | "OUTBOUND";
export type CommunicationChannel = "PHONE" | "EMAIL" | "LETTER" | "PORTAL" | "IN_PERSON" | "OTHER";
export type CommunicationAttachmentType = "ORIGINAL_MESSAGE" | "ATTACHMENT" | "LETTER" | "OTHER";

export type CommunicationAttachment = {
  id: string;
  attachmentType: CommunicationAttachmentType;
  originalFileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

export type Communication = {
  id: string;
  partyId: string;
  caseId: string | null;
  direction: CommunicationDirection;
  channel: CommunicationChannel;
  occurredAt: string;
  subject: string | null;
  summary: string;
  durationSeconds: number | null;
  createdAt: string;
  updatedAt: string;
  case: { id: string; caseNumber: string } | null;
  attachments: CommunicationAttachment[];
  createdByMembership: { user: { displayName: string | null; email: string } };
};

export type CommunicationsResponse = {
  items: Communication[];
  page: number;
  totalPages: number;
  total: number;
};
