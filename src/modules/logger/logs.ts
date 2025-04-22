// import { httpClient } from '@/core/client/http-client';
// import { 
//   APIError, 
//   CloudsaniaError, 
//   APIConnectionError, 
//   APIConnectionTimeoutError 
// } from '../../core/errors/error';
// import { castToError } from '../../core/utils/index';
// import Transport from 'winston-transport';
// import os from 'os';

// interface CloudsaniaOptions extends Transport.TransportStreamOptions {
//   apikey: string;
//   hostname?: string;
// }

// export class CloudsaniaTransport extends Transport {
//   private apikey: string;
//   private hostname: string;
//   private endpoint: string = 'https://cloudsanialapi.com/log';
  
//   // Buffer management
//   private buffer: string = '';
//   private loggingEnabled: boolean = true;
//   private currentRetries: number = 0;
//   private totalRetries: number = 0;
//   private connectionDelay: number = 1000;
//   private maxBufferSize: number = 1 * 1024 * 1024; // Default 1MB
  
//   // Retry settings
//   private attemptsBeforeDecay: number = 5;
//   private maximumAttempts: number = 25;
//   private maxDelayBetweenReconnection: number = 60000;
  
//   // Flags
//   private _shutdown: boolean = false;
//   private _connecting: boolean = false;
//   private _erroring: boolean = false;

//   constructor(opts: CloudsaniaOptions) {
//     super(opts);
    
//     this.apikey = opts.apikey;
//     this.hostname = opts.hostname || os.hostname();
    
//     // Error out if we don't have an API key
//     if (!this.apikey) {
//       throw new Error('Missing required parameter: apikey');
//     }
//   }

//   /**
//    * Transforms any error into a CloudsaniaError type
//    */
//   private transformError(error: unknown): CloudsaniaError {
//     if (error instanceof CloudsaniaError) {
//       return error;
//     }

//     if (error instanceof Error) {
//       const errorMessage = error.message.toLowerCase();
      
//       if (errorMessage.includes('timeout')) {
//         return new APIConnectionTimeoutError({ 
//           message: 'Logging service connection timed out'
//         });
//       }
      
//       return new APIConnectionError({ 
//         message: 'Error connecting to logging service', 
//         cause: error 
//       });
//     }

//     return new CloudsaniaError('Unknown logging error occurred');
//   }

//   /**
//    * Emits errors safely without crashing the application
//    */
//   private _silentErrorEmitter(err: Error): void {
//     const count = this.listeners('error').length;
//     if (count > 0) {
//       this.emit('error', err);
//     } else {
//       // Silent handling to prevent crashes
//     }
//   }

//   /**
//    * Schedules reconnection with exponential backoff
//    */
//   private scheduleReconnect(): void {
//     if (this._shutdown || this._connecting) {
//       return;
//     }

//     this._connecting = true;
    
//     setTimeout(() => {
//       this.currentRetries++;
//       this.totalRetries++;

//       if ((this.connectionDelay < this.maxDelayBetweenReconnection) &&
//           (this.currentRetries >= this.attemptsBeforeDecay)) {
//         this.connectionDelay = this.connectionDelay * 2;
//         this.currentRetries = 0;
//       }

//       if (this.loggingEnabled && (this.totalRetries >= this.maximumAttempts)) {
//         this.loggingEnabled = false;
//         this._silentErrorEmitter(new CloudsaniaError('Max connection attempts reached, disabling log buffering'));
//       }

//       this._connecting = false;
//       this.processBuffer();

//     }, this.connectionDelay);
//   }

//   /**
//    * Core logging method exposed to Winston
//    */
//   log(info: any, callback: () => void): void {
//     if (this._shutdown) {
//       callback();
//       return;
//     }

//     setImmediate(() => this.emit('logged', info));

//     const { level, message, ...meta } = info;
    
//     // Format the log message
//     let formattedMessage = typeof message === 'string' ? message : JSON.stringify(message);
    
//     const payload = {
//       api_key: this.apikey,
//       hostname: this.hostname,
//       log_level: level,
//       message: formattedMessage,
//       metadata: meta
//     };

//     this.sendMessage(payload, callback);
//   }

//   /**
//    * Sends a message to the Cloudsania logging service
//    */
//   private sendMessage(payload: Record<string, any>, callback: () => void): void {
//     if (!this.loggingEnabled) {
//       callback();
//       return;
//     }

//     const msg = JSON.stringify(payload);

//     // Try to send immediately, or buffer for later
//     this.attemptSend(msg, callback);
//   }

//   /**
//    * Attempts to send the message, or buffers it if sending fails
//    */
//   private attemptSend(msg: string, callback: () => void): void {
//     if (this._erroring || this._connecting) {
//       this.bufferMessage(msg);
//       callback();
//       return;
//     }

//     httpClient
//       .post(this.endpoint, {
//         body: JSON.parse(msg),
//         headers: { 'Content-Type': 'application/json' }
//       })
//       .then(() => {
//         // Reset retry counts on successful send
//         this.currentRetries = 0;
//         this.totalRetries = 0;
//         this.connectionDelay = 1000;
//         this.loggingEnabled = true;
        
//         callback();
//       })
//       .catch((err) => {
//         // On error, buffer the message and schedule reconnect
//         this._erroring = true;
//         this.bufferMessage(msg);
//         this._silentErrorEmitter(this.transformError(err));
//         this._erroring = false;
        
//         this.scheduleReconnect();
//         callback();
//       });
//   }

//   /**
//    * Adds a message to the buffer if there's space
//    */
//   private bufferMessage(msg: string): void {
//     if (this.loggingEnabled && (this.buffer.length + msg.length) < this.maxBufferSize) {
//       this.buffer += msg + '\n';
//     }
//   }

//   /**
//    * Processes any buffered messages
//    */
//   private processBuffer(): void {
//     if (!this.buffer.length || this._erroring || this._connecting || this._shutdown) {
//       return;
//     }

//     const currentBuffer = this.buffer;
//     this.buffer = '';

//     const messages = currentBuffer.split('\n').filter(Boolean);
    
//     const sendPromises = messages.map(msg => {
//       return httpClient
//         .post(this.endpoint, {
//           body: JSON.parse(msg),
//           headers: { 'Content-Type': 'application/json' }
//         })
//         .catch(err => {
//           this.bufferMessage(msg);
//           return Promise.reject(err);
//         });
//     });

//     Promise.allSettled(sendPromises)
//       .then(results => {
//         const failedCount = results.filter(r => r.status === 'rejected').length;
        
//         if (failedCount > 0) {
//           this._silentErrorEmitter(
//             new CloudsaniaError(`Failed to send ${failedCount} of ${messages.length} buffered logs`)
//           );
//           this.scheduleReconnect();
//         } else if (messages.length > 0) {
//           // Reset counters on success
//           this.currentRetries = 0;
//           this.totalRetries = 0;
//           this.connectionDelay = 1000;
//           this.loggingEnabled = true;
          
//           this.emit('buffer_cleared');
//         }
//       });
//   }

//   /**
//    * Closes the transport
//    */
//   close(): void {
//     this._shutdown = true;
    
//     // Try to send remaining logs
//     if (this.buffer.length) {
//       this.processBuffer();
//     }
    
//     this.emit('closed');
//   }
// }



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
