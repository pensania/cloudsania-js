// core/connection/connection-manager.ts
export class ConnectionManager {
  private retryCount = 0;
  private totalRetries = 0;
  private delay = 1000;

  constructor(
    private readonly maxAttempts: number = 25,
    private readonly decayThreshold: number = 5,
    private readonly maxDelay: number = 60000,
    private onBackoff: () => void = () => {}
  ) {}

  scheduleReconnect(callback: () => void): void {
    setTimeout(() => {
      this.retryCount++;
      this.totalRetries++;

      if (this.retryCount >= this.decayThreshold && this.delay < this.maxDelay) {
        this.delay *= 2;
        this.retryCount = 0;
      }

      if (this.totalRetries >= this.maxAttempts) {
        this.onBackoff();
      }

      callback();
    }, this.delay);
  }

  reset(): void {
    this.retryCount = 0;
    this.totalRetries = 0;
    this.delay = 1000;
  }
}
