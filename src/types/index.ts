/**
 * Represents detailed API error data returned from a backend.
 */
export interface ErrorData {
  code?: number;
  documentation_url?: string;
  message?: string;
  source?: {
    pointer?: string;
  };
}

