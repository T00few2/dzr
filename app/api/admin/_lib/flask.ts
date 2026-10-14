import { NextResponse } from 'next/server'

/** Call the Flask jobs API with the server-side key. The browser never sees it. */
export async function flaskJson(path: string, init?: { method?: string; body?: unknown }) {
  const base = process.env.CONTENT_API_BASE_URL
  const key = process.env.CONTENT_API_KEY
  if (!base || !key) {
    return NextResponse.json({ error: 'CONTENT_API_BASE_URL / CONTENT_API_KEY not set' }, { status: 500 })
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
  return NextResponse.json(body, { status: res.status })
}
