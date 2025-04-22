import { httpClient } from '../../src/core/client/http-client';
import { LoggingClient } from '../../src/modules/logger/client';

jest.mock('@/core/client/http-client', () => ({
  httpClient: {
    post: jest.fn(),
  },
}));

describe('LoggingClient', () => {
  const mockPost = httpClient.post as jest.Mock;
  const endpoint = 'https://example.com/log';
  const client = new LoggingClient(endpoint);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should send a log payload to the configured endpoint', async () => {
    const payload = { message: 'Test log', level: 'info' };
    mockPost.mockResolvedValueOnce(undefined);

    await client.send(payload);

    expect(mockPost).toHaveBeenCalledWith(endpoint, {
      body: payload,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('should throw an error if httpClient.post fails', async () => {
    const error = new Error('Network error');
    mockPost.mockRejectedValueOnce(error);

    await expect(client.send({ message: 'fail' })).rejects.toThrow('Network error');
  });
});
