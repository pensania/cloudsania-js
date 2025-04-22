import { httpClient } from '@/core/client/http-client';

/**
 * LoggingClient is a lightweight wrapper around the HTTP client.
 * It handles sending log payloads to a configured logging endpoint.
 */
export class LoggingClient {
  /** The URL endpoint where logs will be sent */
  private endpoint: string;

  /**
   * Creates a new instance of LoggingClient.
   *
   * @param endpoint - The remote logging API endpoint (e.g., https://example.com/log)
   */
  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  /**
   * Sends a log payload to the configured logging service.
   *
   * @param payload - A structured log object that will be serialized and sent as JSON
   * @throws Error if the request fails (httpClient should throw)
   */
  async send(payload: Record<string, any>): Promise<void> {
    await httpClient.post(this.endpoint, {
      body: payload,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
