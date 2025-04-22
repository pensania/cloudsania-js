import { BufferManager } from '../../src/modules/logger/buffer-manager';

describe('BufferManager', () => {
  const MAX_SIZE = 100;

  it('should add messages within max buffer size', () => {
    const buffer = new BufferManager(MAX_SIZE);
    buffer.add('Hello');
    buffer.add('World');

    expect(buffer.size).toBeGreaterThan(0);
    expect(buffer.isEmpty).toBe(false);
  });

  it('should not add message if it exceeds max buffer size', () => {
    const buffer = new BufferManager(10);
    buffer.add('123456789'); // 9 chars
    buffer.add('abc'); //  exceeds 10 with newline

    const messages = buffer.flush();
    expect(messages.length).toBe(1);
    expect(messages[0]).toBe('123456789');
  });

  it('should flush all buffered messages and clear buffer', () => {
    const buffer = new BufferManager(MAX_SIZE);
    buffer.add('Message 1');
    buffer.add('Message 2');

    const messages = buffer.flush();

    expect(messages).toEqual(['Message 1', 'Message 2']);
    expect(buffer.isEmpty).toBe(true);
    expect(buffer.size).toBe(0);
  });

  it('should handle flush when buffer is empty', () => {
    const buffer = new BufferManager(MAX_SIZE);
    const messages = buffer.flush();

    expect(messages).toEqual([]);
    expect(buffer.isEmpty).toBe(true);
  });
});
