import { ErrorData } from "@/types";
import { castToError } from "../utils";

/**
 * Represents an HTTP response headers object.
 */
export type Headers = Record<string, string | null | undefined>;

/**
 * Base class for all SDK-level errors.
 */
export class CloudsaniaError extends Error { }

/**
 * Represents a structured API error with metadata like status, headers, and body.
 *
 * @template TStatus - HTTP status code type.
 * @template THeaders - Response headers type.
 * @template TError - Raw error body object type.
 */
export class APIError<
  TStatus extends number | undefined = number | undefined,
  THeaders extends Headers | undefined = Headers | undefined,
  TError extends Record<string, any> | undefined = Record<string, any> | undefined,
> extends CloudsaniaError {
  readonly status: TStatus;
  readonly headers: THeaders;
  readonly error: TError;
  readonly errors: ErrorData[];

  /**
   * Constructs an APIError.
   * 
   * @param status - HTTP status code.
   * @param error - Parsed error body object.
   * @param message - Optional message string.
   * @param headers - Response headers.
   */
  constructor(status: TStatus, error: TError, message: string | undefined, headers: THeaders) {
    super(APIError.makeMessage(status, error, message));
    this.status = status;
    this.headers = headers;
    this.error = error;
    this.errors = (error as any)?.errors ?? [];
  }

  private static makeMessage(
    status: number | undefined,
    error: any,
    message: string | undefined,
  ): string {
    const msg =
      typeof error?.message === 'string'
        ? error.message
        : error?.message
          ? JSON.stringify(error.message)
          : error
            ? JSON.stringify(error)
            : message;

    if (status && msg) return `${status} ${msg}`;
    if (status) return `${status} status code (no body)`;
    return msg || '(no status code or body)';
  }

  /**
   * Factory method to create appropriate subclass based on status code.
   * 
   * @param status - HTTP status code.
   * @param errorResponse - Parsed error object.
   * @param message - Optional message string.
   * @param headers - Response headers.
   * @returns A typed instance of `APIError` or its subclass.
   */
  static generate(
    status: number | undefined,
    errorResponse: object | undefined,
    message: string | undefined,
    headers: Headers | undefined,
  ): APIError {
    if (!status || !headers) {
      return new APIConnectionError({ message, cause: castToError(errorResponse) });
    }

    const error = errorResponse as Record<string, any>;

    switch (status) {
      case 400: return new BadRequestError(status, error, message, headers);
      case 401: return new AuthenticationError(status, error, message, headers);
      case 403: return new PermissionDeniedError(status, error, message, headers);
      case 404: return new NotFoundError(status, error, message, headers);
      case 405: return new MethodNotAllowedError(status, error, message, headers);
      case 409: return new ConflictError(status, error, message, headers);
      case 410: return new GoneError(status, error, message, headers);
      case 415: return new UnsupportedMediaTypeError(status, error, message, headers);
      case 422: return new UnprocessableEntityError(status, error, message, headers);
      case 429: return new RateLimitError(status, error, message, headers);
    }

    if (status >= 500) {
      return new InternalServerError(status, error, message, headers);
    }

    return new APIError(status, error, message, headers);
  }
}

/**
 * Error thrown when a request is aborted by the user.
 */
export class APIUserAbortError extends APIError<undefined, undefined, undefined> {
  constructor({ message }: { message?: string } = {}) {
    super(undefined, undefined, message || 'Request was aborted.', undefined);
  }
}

/**
 * Error thrown when a connection to the API fails.
 */
export class APIConnectionError extends APIError<undefined, undefined, undefined> {
  constructor({ message, cause }: { message?: string; cause?: Error }) {
    super(undefined, undefined, message || 'Connection error.', undefined);
    // @ts-ignore
    if (cause) this.cause = cause;
  }
}

/**
 * Error thrown when a request to the API times out.
 */
export class APIConnectionTimeoutError extends APIConnectionError {
  constructor({ message }: { message?: string } = {}) {
    super({ message: message ?? 'Request timed out.' });
  }
}


export class BadRequestError extends APIError<400, Headers> { }
export class AuthenticationError extends APIError<401, Headers> { }
export class PermissionDeniedError extends APIError<403, Headers> { }
export class NotFoundError extends APIError<404, Headers> { }
export class MethodNotAllowedError extends APIError<405, Headers> { }
export class ConflictError extends APIError<409, Headers> { }
export class GoneError extends APIError<410, Headers> { }
export class UnsupportedMediaTypeError extends APIError<415, Headers> { }
export class UnprocessableEntityError extends APIError<422, Headers> { }
export class RateLimitError extends APIError<429, Headers> { }
export class InternalServerError extends APIError<number, Headers> { }
