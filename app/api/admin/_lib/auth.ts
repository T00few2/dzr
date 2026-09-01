import { getToken } from 'next-auth/jwt'
import { NextResponse } from 'next/server'

export async function requireAdmin(req: Request) {
  const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (!(token as any).isAdmin) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  }
  return { token }
}
