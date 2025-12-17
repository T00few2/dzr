/**
 * Vipps MobilePay Checkout API Client
 * 
 * Uses the Checkout API which automatically handles capture.
 * See: https://developer.vippsmobilepay.com/docs/APIs/checkout-api/
 */

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

// ============================================================================
// VIPPS CHECKOUT API
// ============================================================================

export type VippsCheckoutSessionRequest = {
  type: 'PAYMENT'
  reference: string
  transaction: {
    amount: { value: number; currency: string }
    paymentDescription?: string
  }
  merchantInfo: {
    callbackUrl: string
    returnUrl: string
    callbackAuthorizationToken?: string
    termsAndConditionsUrl?: string
  }
  prefillCustomer?: {
    firstName?: string
    lastName?: string
    email?: string
    phoneNumber?: string
  }
  configuration?: {
    customerInteraction?: 'CUSTOMER_PRESENT' | 'CUSTOMER_NOT_PRESENT'
    elements?: 'PaymentOnly' | 'Full'
    countries?: { supported?: string[] }
  }
}

export type VippsCheckoutSessionResponse = {
  token?: string
  checkoutFrontendUrl?: string
  pollingUrl?: string
  [k: string]: any
}

/**
 * Create a Vipps Checkout session.
 * The user will be redirected to checkoutFrontendUrl to complete payment.
 * Capture is handled automatically by Checkout API - no manual capture needed!
 */
export async function vippsCreateCheckoutSession(body: VippsCheckoutSessionRequest): Promise<VippsCheckoutSessionResponse> {
  const env = getVippsEnv()
  return await vippsRequest<VippsCheckoutSessionResponse>('/checkout/v3/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': makeIdempotencyKey(),
      'client_id': env.clientId,
      'client_secret': env.clientSecret,
    },
    body: JSON.stringify(body),
  })
}

export type VippsCheckoutSessionInfo = {
  reference?: string
  sessionState?: 'SessionCreated' | 'PaymentInitiated' | 'SessionExpired' | 'PaymentSuccessful' | 'PaymentTerminated'
  paymentDetails?: {
    amount?: { value?: number; currency?: string }
    state?: 'CREATED' | 'AUTHORIZED' | 'CAPTURED' | 'TERMINATED'
    aggregate?: {
      cancelledAmount?: { value?: number; currency?: string }
      capturedAmount?: { value?: number; currency?: string }
      refundedAmount?: { value?: number; currency?: string }
      authorizedAmount?: { value?: number; currency?: string }
    }
  }
  billingDetails?: {
    firstName?: string
    lastName?: string
    email?: string
    phoneNumber?: string
  }
  [k: string]: any
}

/**
 * Get information about a Checkout session.
 * Use this to check if payment was successful and captured.
 */
export async function vippsGetCheckoutSession(reference: string): Promise<VippsCheckoutSessionInfo> {
  const env = getVippsEnv()
  const safe = encodeURIComponent(reference)
  return await vippsRequest<VippsCheckoutSessionInfo>(`/checkout/v3/session/${safe}`, {
    method: 'GET',
    headers: {
      'client_id': env.clientId,
      'client_secret': env.clientSecret,
    },
  })
}
