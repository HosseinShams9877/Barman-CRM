/**
 * core/errors — لوله انتشار (CD-02).
 */
export {
  ApiError,
  unauthorized,
  forbidden,
  badRequest,
  notFound,
  conflict,
  internal,
  errorToResponse,
} from "./errors";
export type { ErrorCode, FieldErrors, ErrorResponsePayload } from "./errors";
