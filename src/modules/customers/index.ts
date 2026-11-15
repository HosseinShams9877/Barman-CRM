/**
 * ماژول مشتریان — لوله انتشار (CD-02 / PHASE_03 §۵).
 */
export { AccountList } from "./components/AccountList";
export { AccountForm } from "./components/AccountForm";
export { PhoneEditor, emptyPhone } from "./components/PhoneEditor";
export type { PhoneDraft, PhoneEditorProps } from "./components/PhoneEditor";
export { ContactEditor, emptyContact } from "./components/ContactEditor";
export type { ContactDraft, ContactEditorProps, ContactFieldErrors } from "./components/ContactEditor";
export { useAccountsQuery, useCreateAccountMutation, useUpdateAccountMutation, useDeactivateAccountMutation } from "./hooks/useAccounts";
export type { AccountListParams } from "./hooks/useAccounts";
export { useAccountQuery } from "./hooks/useAccount";
export { invalidateAccounts } from "./queries/invalidations";
export { queryKeys } from "./queries/keys";
export {
  createAccountSchema,
  updateAccountSchema,
  listAccountsQuerySchema,
  accountKindSchema,
} from "./schemas/account.schema";
export {
  listAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deactivateAccount,
} from "./services/account.service";
export { ACCOUNT_KINDS, accountKindLabel, kindRequiresName } from "./constants/account-kinds";
export type { AccountKindKey } from "./constants/account-kinds";
export { PHONE_KINDS, phoneKindLabel } from "./constants/phone-kinds";
export type { PhoneKindKey } from "./constants/phone-kinds";
export type {
  AccountPhoneRow,
  AccountContactRow,
  AccountListItem,
  AccountDetail,
  AccountListResult,
} from "./types/account.types";
