import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
	const { pathname } = req.nextUrl;
	if (!pathname.startsWith('/members-zone')) return NextResponse.next();

	const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
	const requiredRoleId = process.env.DISCORD_REQUIRED_ROLE_ID || '1385216556166025347';
	const teamCaptainRoleId = '1195878349617250405'; // Holdkaptajn role

	// Not signed in → send to clean login page
	if (!token) {
		const url = req.nextUrl.clone();
		url.pathname = '/login';
		url.searchParams.delete('error');
		return NextResponse.redirect(url);
	}

	// Signed in but missing role → checks
	const roles = (token as any)?.roles as string[] | undefined;
	if (!Array.isArray(roles)) {
		const url = req.nextUrl.clone();
		url.pathname = '/login';
		url.searchParams.set('error', 'AccessDenied');
		return NextResponse.redirect(url);
	}

	// Extra restriction: team management requires Holdkaptajn role OR admin
	if (pathname.startsWith('/members-zone/team-management')) {
		const isAdmin = Boolean((token as any)?.isAdmin);
		if (!isAdmin && !roles.includes(teamCaptainRoleId)) {
			const url = req.nextUrl.clone();
			url.pathname = '/members-zone';
			url.searchParams.delete('error');
			return NextResponse.redirect(url);
		}
	}

	// General members-zone access requires the Verified Member role (or configured env)
	if (!roles.includes(requiredRoleId)) {
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