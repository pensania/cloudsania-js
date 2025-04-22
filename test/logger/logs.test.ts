import { CloudsaniaLog } from '../../src/modules/logger/logs';
import { LoggingClient } from '../../src/modules/logger/client';
import { APIConnectionTimeoutError, CloudsaniaError } from '../../src/core/errors/error';

jest.mock('../../src/modules/logger/client');
jest.useFakeTimers();

const flushPromises = () => new Promise(setImmediate);

describe('CloudsaniaLog (Unit)', () => {
  let transport: CloudsaniaLog;
  let mockSend: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();

    mockSend = jest.fn();
    (LoggingClient as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }));

    transport = new CloudsaniaLog({ apikey: 'test-api-key', hostname: 'unit-host' });
  });

  it('should throw error if apikey is missing', () => {
    expect(() => new CloudsaniaLog({ apikey: '' })).toThrow('Missing required parameter: apikey');
  });

  it('should emit "logged" event and send log successfully', async () => {
    const loggedSpy = jest.fn();
    const callback = jest.fn();
    mockSend.mockResolvedValueOnce({});

    transport.on('logged', loggedSpy);
    transport.log({ level: 'info', message: 'log success' }, callback);

    await jest.runAllTimersAsync();
    await flushPromises();

    expect(loggedSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'log success' }));
    expect(mockSend).toHaveBeenCalled();
    expect(callback).toHaveBeenCalled();
  });

  it('should buffer log and schedule retry if send fails', async () => {
    const callback = jest.fn();
    const errorSpy = jest.fn();

    mockSend
      .mockRejectedValueOnce(new Error('fail'))  // initial failure
      .mockResolvedValueOnce({});                // retry success

    transport.on('error', errorSpy);

    transport.log({ level: 'info', message: 'should buffer' }, callback);

    await jest.runOnlyPendingTimersAsync();  // wait for retry
    await flushPromises();

    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.any(APIConnectionTimeoutError));
  });

  it('should retry buffered logs on reconnect', async () => {
    const callback = jest.fn();

    mockSend
      .mockRejectedValueOnce(new Error('fail'))  // fail
      .mockResolvedValueOnce({});               // success on retry

    transport.log({ level: 'warn', message: 'retry message' }, callback);

    await jest.runOnlyPendingTimersAsync();
    await flushPromises();

    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('should emit error and disable logging after max retries', async () => {
    mockSend.mockRejectedValue(new Error('fail forever'));

    const errorSpy = jest.fn();
    transport.on('error', errorSpy);

    for (let i = 0; i < 26; i++) {
      transport.log({ level: 'error', message: `msg ${i}` }, jest.fn());
      await jest.runOnlyPendingTimersAsync();
      await flushPromises();
    }

    expect(errorSpy).toHaveBeenCalledWith(expect.any(CloudsaniaError));
    expect((transport as any)._disabled).toBe(true);
  });

  it('should flush buffer and emit "closed" event on close', async () => {
    const closedSpy = jest.fn();
    const callback = jest.fn();

    mockSend.mockRejectedValueOnce(new Error('network down'));
    mockSend.mockResolvedValueOnce({});  // retry succeeds

    transport.on('closed', closedSpy);
    transport.on('error', () => { }); // absorb error

    transport.log({ level: 'info', message: 'test close flush' }, callback);
    await jest.runAllTimersAsync();
    await flushPromises();

    transport.close();
    await jest.runAllTimersAsync();
    await flushPromises();

    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(closedSpy).toHaveBeenCalled();
  });
});
