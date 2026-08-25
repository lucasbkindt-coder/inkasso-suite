export type EnforcementTitleStatus = "DRAFT" | "ACTIVE" | "SATISFIED" | "VOIDED";
export type EnforcementTitleType = "ENFORCEMENT_ORDER" | "JUDGMENT" | "COST_ASSESSMENT_ORDER" | "SETTLEMENT" | "NOTARIAL_DEED" | "OTHER";
export type EnforcementActionStatus = "DRAFT" | "PREPARED" | "SUBMITTED" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";
export type EnforcementActionType = "BAILIFF_ORDER" | "ASSET_DISCLOSURE" | "GARNISHMENT" | "ACCOUNT_GARNISHMENT" | "WAGE_GARNISHMENT" | "OTHER";
export type EnforcementTitle = { id: string; type: EnforcementTitleType; status: EnforcementTitleStatus; courtOrAuthority: string | null; referenceNumber: string | null; titleDate: string; serviceDate: string | null; enforceableFrom: string | null; principalAmount: string; costAmount: string; interestAmount: string; titleTotal: string; notes: string | null };
export type EnforcementAction = { id: string; titleId: string; type: EnforcementActionType; status: EnforcementActionStatus; amountAtRequest: string; referenceNumber: string | null; notes: string | null; createdAt: string };
