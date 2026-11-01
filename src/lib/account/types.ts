export type AccountRequestKind='delete_data'|'close_account'|'close_both'
export type AccountRequest={id:string;kind:AccountRequestKind;status:'pending'|'in_review'|'completed'|'declined'|'cancelled';note:string|null;admin_note:string|null;created_at:string;reviewed_at:string|null}
export type AccountControlsState={active:boolean;closed_at:string|null;has_store:boolean;store_closed_at:string|null;requests:AccountRequest[]}
export const accountRequestLabels:Record<AccountRequestKind,string>={delete_data:'Delete eligible personal data',close_account:'Close account only',close_both:'Close account and store'}
