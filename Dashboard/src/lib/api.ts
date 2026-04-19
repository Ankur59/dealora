const jsonHeaders = { 'Content-Type': 'application/json' }

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!text) return {} as T
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error('Invalid JSON response from server')
  }
}

export type ApiSuccess<T> = { success: true; data: T }
export type ApiError = {
  success: false
  message: string
  errors?: unknown
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers =
    init.headers instanceof Headers
      ? Object.fromEntries(init.headers.entries())
      : { ...(init.headers as Record<string, string> | undefined) }

  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      ...jsonHeaders,
      ...headers,
    },
  })
  const body = await parseJson<ApiSuccess<T> | ApiError>(res)
  if (!body || typeof body !== 'object' || !('success' in body)) {
    throw new Error('Unexpected response shape')
  }
  if (!body.success) {
    const err = body as ApiError
    throw new Error(err.message || 'Request failed')
  }
  return (body as ApiSuccess<T>).data
}

export function apiPostJson<T>(path: string, payload: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
