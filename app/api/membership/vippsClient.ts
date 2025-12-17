type VippsEnv = {
  baseUrl: string
  clientId: string
  clientSecret: string
  subscriptionKey: string
  merchantSerialNumber: string
  systemName: string
  systemVersion: string
  pluginName: string
  pluginVersion: string
}

let cachedToken: { token: string; expiresAtMs: number } | null = null

function makeIdempotencyKey(): string {
  const k =
    (globalThis as any)?.crypto?.randomUUID?.() ||
    // Node.js runtime provides crypto.randomUUID(); fall back safely if unavailable.
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return String(k).slice(0, 50)
}

function getVippsEnv(): VippsEnv {
  const baseUrl = (process.env.VIPPS_BASE_URL || 'https://apitest.vipps.no').replace(/\/+$/, '')
  const clientId = String(process.env.VIPPS_CLIENT_ID || '').trim()
  const clientSecret = String(process.env.VIPPS_CLIENT_SECRET || '').trim()
  const subscriptionKey = String(process.env.VIPPS_SUBSCRIPTION_KEY || '').trim()
  const merchantSerialNumber = String(process.env.VIPPS_MERCHANT_SERIAL_NUMBER || '').trim()

  if (!clientId || !clientSecret || !subscriptionKey || !merchantSerialNumber) {
    throw new Error('Vipps/MobilePay is not configured (missing VIPPS_* env vars)')
  }

  return {
    baseUrl,
    clientId,
    clientSecret,
    subscriptionKey,
    merchantSerialNumber,
    systemName: String(process.env.VIPPS_SYSTEM_NAME || 'DZR'),
    systemVersion: String(process.env.VIPPS_SYSTEM_VERSION || '1.0.0'),
    pluginName: String(process.env.VIPPS_PLUGIN_NAME || 'dzr-nextjs'),
    pluginVersion: String(process.env.VIPPS_PLUGIN_VERSION || '1.0.0'),
  }
}

async function getAccessToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAtMs - now > 30_000) {
    return cachedToken.token
  }

  const env = getVippsEnv()
  const resp = await fetch(`${env.baseUrl}/accessToken/get`, {
    method: 'POST',
    headers: {
      'client_id': env.clientId,
      'client_secret': env.clientSecret,
      'Ocp-Apim-Subscription-Key': env.subscriptionKey,
    },
  })

  const data = await resp.json().catch(() => ({} as any))
  if (!resp.ok) {
    throw new Error(data?.error_description || data?.error || `Vipps access token failed (${resp.status})`)
  }

  const token = String(data?.access_token || '').trim()
  const expiresIn = Number(data?.expires_in || 0)
  if (!token || !expiresIn) {
    throw new Error('Vipps access token response missing access_token/expires_in')
  }

  cachedToken = { token, expiresAtMs: now + expiresIn * 1000 }
  return token
}

async function vippsRequest<T>(path: string, init: RequestInit & { headers?: Record<string, string> } = {}): Promise<T> {
  const env = getVippsEnv()
  const token = await getAccessToken()

  const urlPath = path.startsWith('/') ? path : `/${path}`
  const resp = await fetch(`${env.baseUrl}${urlPath}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Ocp-Apim-Subscription-Key': env.subscriptionKey,
      'Merchant-Serial-Number': env.merchantSerialNumber,
      'Vipps-System-Name': env.systemName,
      'Vipps-System-Version': env.systemVersion,
      'Vipps-System-Plugin-Name': env.pluginName,
      'Vipps-System-Plugin-Version': env.pluginVersion,
      ...(init.headers || {}),
    },
  })

  const raw = await resp.text().catch(() => '')
  let data: any = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    data = {}
  }

  if (!resp.ok) {
    const details =
      data?.message ||
      data?.error ||
      data?.error_description ||
      (raw ? raw.slice(0, 2000) : '')
    throw new Error(`Vipps API failed (${resp.status})${details ? `: ${details}` : ''}`)
  }
  return (data || {}) as T
}

async function vippsRequestWithFallback<T>(
  paths: string[],
  init: RequestInit & { headers?: Record<string, string> } = {},
): Promise<T> {
  let lastErr: any = null
  for (const p of paths) {
    try {
      return await vippsRequest<T>(p, init)
    } catch (err: any) {
      lastErr = err
      const msg = String(err?.message || '')
      // Vipps API gateway sometimes returns: "no Route matched with those values" when the path is slightly wrong.
      if (!msg.toLowerCase().includes('no route matched')) {
        throw err
      }
    }
  }
  throw lastErr || new Error('Vipps API failed')
}

export type VippsCreatePaymentRequest = {
  amount: { currency: string; value: number }
  reference: string
  paymentMethod: { type: 'WALLET' | 'CARD'; blockedSources?: string[] }
  returnUrl: string
  userFlow: string
  paymentDescription?: string
  metadata?: Record<string, string>
}

export type VippsCreatePaymentResponse = {
  redirectUrl?: string
  reference?: string
  pspReference?: string
  [k: string]: any
}

export async function vippsCreatePayment(body: VippsCreatePaymentRequest): Promise<VippsCreatePaymentResponse> {
  // Different environments/tenants may expose the resource as /payment or /payments.
  // Idempotency-Key is required by the ePayment API for create-payment operations.
  return await vippsRequestWithFallback<VippsCreatePaymentResponse>(['/epayment/v1/payment', '/epayment/v1/payments'], {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': makeIdempotencyKey(),
    },
    body: JSON.stringify(body),
  })
}

export type VippsGetPaymentResponse = {
  reference?: string
  pspReference?: string
  state?: string
  amount?: { currency?: string; value?: number }
  metadata?: Record<string, string>
  [k: string]: any
}

export async function vippsGetPayment(reference: string): Promise<VippsGetPaymentResponse> {
  const safe = encodeURIComponent(reference)
  return await vippsRequestWithFallback<VippsGetPaymentResponse>(
    [`/epayment/v1/payment/${safe}`, `/epayment/v1/payments/${safe}`],
    { method: 'GET' },
  )
}

export type VippsCapturePaymentRequest = {
  modificationAmount: { currency: string; value: number }
}

export type VippsCapturePaymentResponse = {
  reference?: string
  pspReference?: string
  state?: string | string[]
  amount?: { currency?: string; value?: number }
  [k: string]: any
}

export async function vippsCapturePayment(reference: string, body: VippsCapturePaymentRequest): Promise<VippsCapturePaymentResponse> {
  const safe = encodeURIComponent(reference)
  return await vippsRequestWithFallback<VippsCapturePaymentResponse>(
    [`/epayment/v1/payment/${safe}/capture`, `/epayment/v1/payments/${safe}/capture`],
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': makeIdempotencyKey(),
      },
      body: JSON.stringify(body),
    },
  )
}

export type VippsPaymentEvent = {
  reference?: string
  pspReference?: string
  name?: string
  amount?: { currency?: string; value?: number }
  timestamp?: string
  [k: string]: any
}

export async function vippsGetPaymentEvents(reference: string): Promise<VippsPaymentEvent[]> {
  const safe = encodeURIComponent(reference)
  return await vippsRequestWithFallback<VippsPaymentEvent[]>(
    [
      `/epayment/v1/payment/${safe}/event`,
      `/epayment/v1/payment/${safe}/events`,
      `/epayment/v1/payments/${safe}/event`,
      `/epayment/v1/payments/${safe}/events`,
    ],
    { method: 'GET' },
  )
}

export type VippsCancelPaymentResponse = {
  aggregate?: {
    authorizedAmount?: { currency?: string; value?: number }
    cancelledAmount?: { currency?: string; value?: number }
    capturedAmount?: { currency?: string; value?: number }
    refundedAmount?: { currency?: string; value?: number }
  }
  [k: string]: any
}

export async function vippsCancelPayment(reference: string): Promise<VippsCancelPaymentResponse> {
  const safe = encodeURIComponent(reference)
  return await vippsRequestWithFallback<VippsCancelPaymentResponse>(
    [`/epayment/v1/payment/${safe}/cancel`, `/epayment/v1/payments/${safe}/cancel`],
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': makeIdempotencyKey(),
      },
    },
  )
}


