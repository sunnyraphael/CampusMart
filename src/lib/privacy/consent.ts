export const POLICY_VERSION='2026-11-01'
export type ConsentStatus={accepted:boolean;eligible:boolean;selling_eligible:boolean;age_band:'adult'|'under_18'|null;accepted_at:string|null;guardian_request_id:string|null;vendor_terms:boolean}
export type GuardianRequest={id:string;state:'pending'|'approved'|'rejected'|'withdrawn';relationship:string;allows_selling:boolean;created_at:string;review_note:string|null}
