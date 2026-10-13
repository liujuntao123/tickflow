import { useSession } from './session';
import type { User } from './types';

export const API_BASE = '/api/backend';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** 401 时是否尝试静默刷新（默认 true）。 */
  retry?: boolean;
  /** 刷新失败时是否跳转登录页（默认 true）。 */
  redirectOn401?: boolean;
  /** query 参数。 */
  query?: Record<string, string | number | boolean | undefined | null>;
}

function buildQuery(query?: RequestOptions['query']): string {
  if (!query) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

let refreshPromise: Promise<string | null> | null = null;

/** 单飞刷新：POST /auth/refresh，web 平台走 httpOnly cookie。 */
export function refreshSession(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: '{}',
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { accessToken?: string; user?: User };
        if (!data.accessToken) return null;
        const store = useSession.getState();
        store.setAccessToken(data.accessToken);
        if (data.user) store.setUser(data.user);
        return data.accessToken;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, retry = true, redirectOn401 = true, query } = options;
  const token = useSession.getState().accessToken;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}${buildQuery(query)}`, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry) {
    const newToken = await refreshSession();
    if (newToken) return apiFetch<T>(path, { ...options, retry: false });
    useSession.getState().clear();
    if (redirectOn401 && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new ApiError(401, 'AUTH_REQUIRED', '登录状态已过期，请重新登录');
  }

  if (!res.ok) {
    let code = 'UNKNOWN';
    let message = `请求失败（HTTP ${res.status}）`;
    let details: unknown;
    try {
      const data = (await res.json()) as { error?: { code?: string; message?: string; details?: unknown } };
      if (data?.error) {
        code = data.error.code ?? code;
        message = data.error.message ?? message;
        details = data.error.details;
      }
    } catch {
      /* 非 JSON 响应 */
    }
    throw new ApiError(res.status, code, message, details);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  // 空响应体（如 GET /focus/sessions/current 无进行中会话）统一返回 undefined
  if (!text.trim()) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(res.status, 'PARSE_ERROR', '响应解析失败');
  }
}