import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
	const { pathname } = req.nextUrl;
	if (!pathname.startsWith('/members-zone')) return NextResponse.next();

	const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
	const requiredRoleId = process.env.DISCORD_REQUIRED_ROLE_ID || '1385216556166025347';

	// Not signed in → send to clean login page
	if (!token) {
		const url = req.nextUrl.clone();
		url.pathname = '/login';
		url.searchParams.delete('error');
		return NextResponse.redirect(url);
	}

	// Signed in but missing role → send to login with AccessDenied
	const roles = (token as any)?.roles as string[] | undefined;
	if (!Array.isArray(roles) || !roles.includes(requiredRoleId)) {
		const url = req.nextUrl.clone();
		url.pathname = '/login';
		url.searchParams.set('error', 'AccessDenied');
		return NextResponse.redirect(url);
	}

	return NextResponse.next();
}

export const config = {
	matcher: ['/members-zone/:path*'],
}; 