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

function classifyFailureKind(status) {
  if (status === 401) {
    return 'unauthenticated';
  }
  if (status === 403) {
    return 'forbidden';
  }
  return 'business_error';
}

function looksLikeJson(contentType, trimmed) {
  return contentType.includes('application/json') || trimmed.startsWith('{') || trimmed.startsWith('[');
}

function looksLikeHtml(contentType, trimmed) {
  return contentType.includes('text/html') || /^<!doctype/i.test(trimmed) || /^<html/i.test(trimmed);
}

export async function classifyResponse(response) {
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();
  const trimmed = text.trim();

  if (looksLikeJson(contentType, trimmed)) {
    let payload = {};
    try {
      payload = trimmed ? JSON.parse(trimmed) : {};
    } catch (error) {
      throw new ApiError('Desktop API returned invalid JSON payload.', {
        kind: 'non_json_response',
        status: response.status,
        payload: trimmed.slice(0, 200),
        contentType,
      });
    }

    if (!response.ok || payload.ok === false) {
      throw new ApiError(payload.reason || payload.code || `Request failed: ${response.status}`, {
        kind: classifyFailureKind(response.status),
        status: response.status,
        payload,
        contentType,
      });
    }

    return payload;
  }

  if (looksLikeHtml(contentType, trimmed)) {
    throw new ApiError('Desktop API base URL returned HTML instead of JSON.', {
      kind: 'html_response',
      status: response.status,
      payload: trimmed.slice(0, 200),
      contentType,
    });
  }

  if (!response.ok) {
    throw new ApiError(`Request failed: ${response.status}`, {
      kind: classifyFailureKind(response.status),
      status: response.status,
      payload: trimmed,
      contentType,
    });
  }

  throw new ApiError('Desktop API returned non-JSON content.', {
    kind: 'non_json_response',
    status: response.status,
    payload: trimmed.slice(0, 200),
    contentType,
  });
}

export function describeApiError(error) {
  if (!(error instanceof ApiError)) {
    return '发生未知异常，请稍后重试。';
  }

  switch (error.kind) {
    case 'network_error':
      return '服务不可达，请检查桌面代理与内网地址。';
    case 'html_response':
      return '接口返回了 HTML 页面，请检查 API Base URL 是否指向桌面代理。';
    case 'non_json_response':
      return '接口返回了非 JSON 内容，桌面端无法继续解析。';
    case 'unauthenticated':
      return '登录已失效，请重新登录后继续。';
    case 'forbidden':
      return '当前账号权限不足，无法访问该功能。';
    case 'business_error':
      return error.message || '后端返回了业务错误。';
    default:
      return error.message || '请求失败，请稍后重试。';
  }
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

  return Object.freeze({ request });
}
