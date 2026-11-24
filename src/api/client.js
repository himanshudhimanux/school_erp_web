/**
 * API client. The access token lives only in memory; the refresh token is an httpOnly cookie
 * scoped to /api/v1/auth. A 401 TOKEN_EXPIRED triggers one refresh (serialized: only one refresh
 * request is ever in flight, as the API requires) and the original request is retried once.
 */
const BASE = '/api/v1';

let accessToken = null;
let refreshing = null;
let onSessionLost = () => {};

export const setAccessToken = (t) => {
  accessToken = t;
};
export const setSessionLostHandler = (fn) => {
  onSessionLost = fn;
};

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || `Request failed (${status})`);
    this.status = status;
    this.code = body?.error?.code || 'REQUEST_FAILED';
    this.details = body?.error?.details;
  }

  /** Field errors from a 422 as { fieldName: message } (strips the body./query. prefix). */
  fieldErrors() {
    if (!Array.isArray(this.details)) return {};
    return Object.fromEntries(this.details.filter((d) => d.field).map((d) => [d.field.replace(/^(body|query|params)\./, ''), d.message]));
  }
}

export function refreshSession() {
  if (!refreshing) {
    refreshing = fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client: 'web' }) })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new ApiError(res.status, body);
        accessToken = body.data.accessToken;
        return body.data;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

function toQuery(params) {
  if (!params) return '';
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : '';
}

async function request(method, path, { body, params, retry = true } = {}) {
  const res = await fetch(`${BASE}${path}${toQuery(params)}`, {
    method,
    credentials: 'include',
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.status === 401 && retry && json?.error?.code === 'TOKEN_EXPIRED') {
    try {
      await refreshSession();
    } catch {
      onSessionLost();
      throw new ApiError(401, json);
    }
    return request(method, path, { body, params, retry: false });
  }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login')) onSessionLost();
    throw new ApiError(res.status, json);
  }
  return json;
}

/** Returns `data` (and `meta` for lists via `list`). */
export const api = {
  get: async (path, params) => (await request('GET', path, { params })).data,
  list: async (path, params) => {
    const r = await request('GET', path, { params });
    return { items: r.data, meta: r.meta };
  },
  post: async (path, body = {}) => (await request('POST', path, { body })).data,
  postFull: (path, body = {}) => request('POST', path, { body }),
  put: async (path, body = {}) => (await request('PUT', path, { body })).data,
  patch: async (path, body = {}) => (await request('PATCH', path, { body })).data,
  del: async (path) => (await request('DELETE', path)).data,
  download,
};

/**
 * Downloads a file (e.g. a CSV report) with the current session and saves it under the name the
 * server sends. Refreshes an expired access token once, like `request`.
 */
async function download(path, params, retry = true) {
  const res = await fetch(`${BASE}${path}${toQuery(params)}`, { credentials: 'include', headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    if (res.status === 401 && retry && json?.error?.code === 'TOKEN_EXPIRED') {
      await refreshSession();
      return download(path, params, false);
    }
    throw new ApiError(res.status, json);
  }
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || 'download';
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}
