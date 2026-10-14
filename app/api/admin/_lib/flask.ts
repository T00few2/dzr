import { NextResponse } from 'next/server'

type FlaskResult = { status: number; body: any }

/** Call the Flask jobs API with the server-side key. The browser never sees it. */
export async function flaskData(path: string, init?: { method?: string; body?: unknown }): Promise<FlaskResult> {
  const base = process.env.CONTENT_API_BASE_URL
  const key = process.env.CONTENT_API_KEY
  if (!base || !key) {
    return { status: 500, body: { error: 'CONTENT_API_BASE_URL / CONTENT_API_KEY not set' } }
  }
  const res = await fetch(`${base.replace(/\/$/, '')}${path}`, {
    method: init?.method || 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  })
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}

export async function flaskJson(path: string, init?: { method?: string; body?: unknown }) {
  const result = await flaskData(path, init)
  return NextResponse.json(result.body, { status: result.status })
}
