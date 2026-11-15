/**
 * core/validation — لوله انتشار (CD-02).
 */
export {
  idParamSchema,
  jalaliDateSchema,
  nonNegativeIntSchema,
  moneySchema,
  positiveIntSchema,
  paginationSchema,
  optionalTextSchema,
  requiredTextSchema,
  phoneSchema,
} from "./schemas";
export { parseOrFail, zodErrorToFields } from "./parse";
export type { ErrorMapFn } from "./parse";
export { faErrorMap, faIssueMessage } from "./zodLocale";
