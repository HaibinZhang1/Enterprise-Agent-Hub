export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = options.kind ?? 'api_error';
    this.status = options.status ?? 0;
    this.payload = options.payload ?? null;
    this.contentType = options.contentType ?? '';
  }
}

export async function classifyResponse(response) {
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();
  const trimmed = text.trim();

  if (contentType.includes('application/json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const payload = trimmed ? JSON.parse(trimmed) : {};
    if (!response.ok || payload.ok === false) {
      const kind =
        response.status === 401
          ? 'unauthenticated'
          : response.status === 403
            ? 'forbidden'
            : 'api_error';
      throw new ApiError(payload.reason || payload.code || `Request failed: ${response.status}`, {
        kind,
        status: response.status,
        payload,
        contentType,
      });
    }
    return payload;
  }

  if (contentType.includes('text/html') || trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')) {
    throw new ApiError('Desktop API base URL returned HTML instead of JSON.', {
      kind: 'html_response',
      status: response.status,
      payload: trimmed.slice(0, 200),
      contentType,
    });
  }

  if (!response.ok) {
    throw new ApiError(`Request failed: ${response.status}`, {
      kind: response.status === 401 ? 'unauthenticated' : response.status === 403 ? 'forbidden' : 'api_error',
      status: response.status,
      payload: trimmed,
      contentType,
    });
  }

  return trimmed;
}

export function createApiClient({ onGlobalError }) {
  async function request(path, options = {}) {
    try {
      const response = await fetch(path, {
        headers: {
          'content-type': 'application/json',
          ...(options.headers ?? {}),
        },
        ...options,
      });
      return await classifyResponse(response);
    } catch (error) {
      if (error instanceof ApiError) {
        onGlobalError?.(error);
        throw error;
      }
      const wrapped = new ApiError(error instanceof Error ? error.message : 'Network request failed.', {
        kind: 'network_error',
      });
      onGlobalError?.(wrapped);
      throw wrapped;
    }
  }

  return Object.freeze({
    request,
  });
}
