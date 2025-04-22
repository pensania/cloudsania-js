/**
 * BufferManager is responsible for managing in-memory buffering of log messages.
 * It buffers messages as newline-separated strings and ensures the buffer does not exceed the specified max size.
 */
export class BufferManager {
  /** Internal buffer string that stores newline-separated messages */
  private buffer: string = '';

  /** Maximum allowed buffer size in bytes */
  private readonly maxBufferSize: number;

  /**
   * Creates an instance of BufferManager.
   * 
   * @param maxSize - Maximum size (in bytes) the buffer can grow to before rejecting additional logs
   */
  constructor(maxSize: number) {
    this.maxBufferSize = maxSize;
  }

  /**
   * Adds a new log message to the buffer if there is enough space.
   * Each message is appended with a newline for separation.
   * 
   * @param msg - The log message to add to the buffer
   */
  add(msg: string): void {
    if ((this.buffer.length + msg.length) < this.maxBufferSize) {
      this.buffer += msg + '\n';
    }
  }

  /**
   * Flushes the buffer, splitting it into an array of messages and clearing the internal buffer.
   * 
   * @returns An array of buffered log messages
   */
  flush(): string[] {
    const messages = this.buffer.split('\n').filter(Boolean);
    this.buffer = '';
    return messages;
  }

  /**
   * Returns the current buffer size in bytes.
   */
  get size(): number {
    return this.buffer.length;
  }

  /**
   * Indicates whether the buffer is currently empty.
   */
  get isEmpty(): boolean {
    return this.buffer.length === 0;
  }
}
