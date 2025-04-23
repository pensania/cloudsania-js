

import Transport from 'winston-transport';
import os from 'os';
import { BufferManager } from './buffer-manager';
import { LoggingClient } from './client';
import { ConnectionManager } from './connection-manager';
import {
  CloudsaniaError,
  APIConnectionError,
  APIConnectionTimeoutError
} from '@/core/errors/error';

/**
 * Configuration options for CloudsaniaLog transport.
 */
interface CloudsaniaOptions extends Transport.TransportStreamOptions {
  /** Your unique API key for Cloudsania */
  apikey: string;

  /** Optional hostname override; defaults to system hostname */
  hostname?: string;
}

/**
 * Allowed Winston log levels supported by Cloudsania.
 */
type LogLevel = 'silly' | 'debug' | 'verbose' | 'info' | 'warn' | 'error';

/**
 * A Winston-compatible transport for sending logs to the Cloudsania platform.
 * Includes buffering, retry logic, exponential backoff, and error propagation.
 *
 * @example
 * const logger = winston.createLogger({
 *   transports: [
 *     new CloudsaniaLog({ apikey: 'your-api-key' })
 *   ]
 * });
 */
export class CloudsaniaLog extends Transport {
  private apikey: string;
  private hostname: string;
  private bufferManager = new BufferManager(1 * 1024 * 1024); // 1MB buffer
  private client = new LoggingClient('https://cloudsanialapi.com/log');
  private connectionManager: ConnectionManager;

  private _shutdown = false;
  private _connecting = false;
  private _erroring = false;
  private loggingEnabled = true;

  /**
   * Creates an instance of the Cloudsania log transport.
   * @param opts - Transport options including `apikey` and optional `hostname`.
   * @throws {Error} If `apikey` is not provided.
   */
  constructor(opts: CloudsaniaOptions) {
    super(opts);

    this.apikey = opts.apikey;
    this.hostname = opts.hostname || os.hostname();

    if (!this.apikey) {
      throw new Error('Missing required parameter: apikey');
    }

    this.connectionManager = new ConnectionManager(
      25, // max attempts
      5,  // decay threshold 
      60000, // max delay
      () => {
        this.loggingEnabled = false;
        this._emitError(new CloudsaniaError('Max retry attempts reached. Logging disabled.'));
      }
    );
  }

  /**
   * Main Winston log handler. Formats and queues logs for delivery.
   * @param info - Winston log info object.
   * @param callback - Completion callback.
   */
  log(
    info: { level: LogLevel; message: any; [key: string]: any },
    callback: () => void
  ): void {
    if (this._shutdown) return callback();

    setImmediate(() => this.emit('logged', info));
    const { level, message, ...meta } = info;

    const formatted = typeof message === 'string' ? message : JSON.stringify(message);

    const payload = {
      api_key: this.apikey,
      hostname: this.hostname,
      log_level: level,
      message: formatted,
      metadata: meta,
    };

    this._send(JSON.stringify(payload), callback);
  }

  /**
   * Internal send handler. Sends message or buffers it on error.
   * @param msg - Stringified log payload.
   * @param callback - Completion callback.
   */
  private _send(msg: string, callback: () => void): void {
    if (!this.loggingEnabled || this._erroring || this._connecting) {
      this.bufferManager.add(msg);
      return callback();
    }

    this.client.send(JSON.parse(msg))
      .then(() => {
        this.connectionManager.reset();
        this.loggingEnabled = true;
        callback();
      })
      .catch(err => {
        this._erroring = true;
        this.bufferManager.add(msg);
        this._emitError(this._transformError(err));
        this._erroring = false;

        this.connectionManager.scheduleReconnect(() => this._flushBuffer());
        callback();
      });
  }

  /**
   * Attempts to resend buffered messages.
   * Retries failed messages with exponential backoff.
   */
  private _flushBuffer(): void {
    if (this._shutdown || this._erroring || this._connecting || this.bufferManager.isEmpty) return;

    const messages = this.bufferManager.flush();
    const promises = messages.map(msg =>
      this.client.send(JSON.parse(msg)).catch(() => {
        this.bufferManager.add(msg);
        return Promise.reject();
      })
    );

    Promise.allSettled(promises).then(results => {
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) {
        this._emitError(new CloudsaniaError(`Failed to resend ${failed} logs`));
        this.connectionManager.scheduleReconnect(() => this._flushBuffer());
      } else {
        this.connectionManager.reset();
        this.loggingEnabled = true;
        this.emit('buffer_cleared');
      }
    });
  }

  /**
   * Normalizes different error types into Cloudsania-specific errors.
   * @param error - Original error.
   * @returns CloudsaniaError
   */
  private _transformError(error: any): CloudsaniaError {
    if (error instanceof CloudsaniaError) return error;
    if (error instanceof Error) {
      return error.message.toLowerCase().includes('timeout')
        ? new APIConnectionTimeoutError({ message: 'Logging service timeout' })
        : new APIConnectionError({ message: 'Connection failure', cause: error });
    }
    return new CloudsaniaError('Unknown logging error');
  }

  /**
   * Emits error event on this transport instance.
   * @param err - Error to emit.
   */
  private _emitError(err: Error): void {
    this.emit('error', err);
  }

  /**
   * Gracefully shuts down the transport.
   * Flushes buffered logs before exit.
   */
  close(): void {
    this._shutdown = true;
    if (!this.bufferManager.isEmpty) this._flushBuffer();
    this.emit('closed');
  }
}
