import { httpClient } from '../../src/core/client/http-client';
import { request } from 'undici';

jest.mock('undici', () => {
  return {
    request: jest.fn(),
    Agent: jest.fn().mockImplementation(() => ({})),
  };
});

const mockedRequest = request as jest.Mock;

describe('httpClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockResponse = (statusCode: number, body: string) => {
    return {
      statusCode,
      body: {
        text: jest.fn().mockResolvedValue(body),
      },
    };
  };

  it('should perform a GET request and parse JSON response', async () => {
    mockedRequest.mockResolvedValueOnce(mockResponse(200, JSON.stringify({ success: true })));

    const result = await httpClient.get<{ success: boolean }>('https://example.com/api');

    expect(mockedRequest).toHaveBeenCalledWith(expect.stringContaining('https://example.com/api'), expect.objectContaining({
      method: 'GET',
    }));
    expect(result).toEqual({ success: true });
  });

  it('should perform a POST request with JSON body', async () => {
    mockedRequest.mockResolvedValueOnce(mockResponse(200, JSON.stringify({ created: true })));

    const result = await httpClient.post<{ created: boolean }>('https://example.com/api', {
      body: { name: 'test' },
    });

    expect(mockedRequest).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ name: 'test' }),
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
      }),
    }));

    expect(result).toEqual({ created: true });
  });

  it('should include query parameters in GET request', async () => {
    mockedRequest.mockResolvedValueOnce(mockResponse(200, JSON.stringify({ items: [] })));

    await httpClient.get('https://example.com/data', {
      queryParams: { page: 1, limit: 10 },
    });

    expect(mockedRequest.mock.calls[0][0]).toBe('https://example.com/data?page=1&limit=10');
  });

  it('should return plain text if response is not JSON', async () => {
    mockedRequest.mockResolvedValueOnce(mockResponse(200, 'OK'));

    const result = await httpClient.get<string>('https://example.com/status');
    expect(result).toBe('OK');
  });

  it('should throw error on HTTP 4xx/5xx responses', async () => {
    mockedRequest.mockResolvedValueOnce(mockResponse(500, 'Internal Server Error'));

    await expect(httpClient.get('https://example.com/fail')).rejects.toThrow(
      'HTTP 500: Internal Server Error'
    );
  });
});
