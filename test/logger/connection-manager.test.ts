import { ConnectionManager } from '../../src/modules/logger/connection-manager';

jest.useFakeTimers({ legacyFakeTimers: false });


describe('ConnectionManager', () => {
  it('should execute callback after delay', () => {
    const callback = jest.fn();
    const manager = new ConnectionManager();

    manager.scheduleReconnect(callback);
    jest.advanceTimersByTime(1000);

    expect(callback).toHaveBeenCalled();
  });

  it('should apply exponential backoff after decay threshold', () => {
    const callback = jest.fn();
    const manager = new ConnectionManager(10, 2, 8000);

    // Trigger 2 retries to reach decayThreshold
    manager.scheduleReconnect(callback);
    jest.advanceTimersByTime(1000);

    manager.scheduleReconnect(callback);
    jest.advanceTimersByTime(1000);

    // Now the delay should increase
    manager.scheduleReconnect(callback);
    jest.advanceTimersByTime(2000); // doubled delay

    expect(callback).toHaveBeenCalledTimes(3);
  });

  it('should trigger onBackoff after maxAttempts', async () => {
    const onBackoff = jest.fn();
    const callback = jest.fn();
    const manager = new ConnectionManager(3, 1, 8000, onBackoff);

    for (let i = 0; i < 3; i++) {
      manager.scheduleReconnect(callback);
    }

    await jest.runAllTimersAsync();

    expect(callback).toHaveBeenCalledTimes(3);
    expect(onBackoff).toHaveBeenCalledTimes(1);
  });


  it('should reset internal state correctly', () => {
    const manager = new ConnectionManager(5, 1, 8000);

    for (let i = 0; i < 3; i++) {
      manager.scheduleReconnect(() => { });
      jest.advanceTimersByTime(1000);
    }

    manager.reset();

    // Retry again after reset
    const callback = jest.fn();
    manager.scheduleReconnect(callback);
    jest.advanceTimersByTime(1000);

    expect(callback).toHaveBeenCalled();
  });
});
