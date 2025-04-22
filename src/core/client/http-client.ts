import { request, Agent } from 'undici';

const agent = new Agent({
  keepAliveTimeout: 10_000,
  keepAliveMaxTimeout: 15_000,
  connections: 10,
});

interface RequestOptions {
  headers?: Record<string, string>;
  body?: any;
  queryParams?: Record<string, string | number>;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

function buildUrlWithQuery(url: string, queryParams?: RequestOptions['queryParams']) {
  if (!queryParams) return url;

  const query = new URLSearchParams(
    Object.entries(queryParams).reduce((acc, [k, v]) => {
      acc[k] = String(v);
      return acc;
    }, {} as Record<string, string>)
  ).toString();

  return `${url}?${query}`;
}

async function handleRequest<T>(
  method: HttpMethod,
  url: string,
  { headers = {}, body, queryParams }: RequestOptions = {}
): Promise<T> {
  const fullUrl = buildUrlWithQuery(url, queryParams);
  const isJson = typeof body === 'object' && body !== null;

  
  const res = await request(fullUrl, {
    method,
    headers: {
      ...(isJson ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: isJson ? JSON.stringify(body) : body,
    dispatcher: agent,
  });

  const responseBody = await res.body.text();
  const { statusCode } = res;

  if (statusCode >= 400) {
    throw new Error(`HTTP ${statusCode}: ${responseBody}`);
  }

  try {
    return JSON.parse(responseBody) as T;
  } catch {
    return responseBody as unknown as T;
  }
}

// Exposed methods
export const httpClient = {
  get: <T = unknown>(url: string, options?: RequestOptions) =>
    handleRequest<T>('GET', url, options),

  post: <T = unknown>(url: string, options?: RequestOptions) =>
    handleRequest<T>('POST', url, options),

  put: <T = unknown>(url: string, options?: RequestOptions) =>
    handleRequest<T>('PUT', url, options),

  delete: <T = unknown>(url: string, options?: RequestOptions) =>
    handleRequest<T>('DELETE', url, options),
};
