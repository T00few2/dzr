import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { HOLDKAPTAJN_ROLE_ID, VERIFIED_MEMBER_ROLE_ID } from '@/app/lib/sharedConstants';

export async function middleware(req: NextRequest) {
	const { pathname } = req.nextUrl;
	const isAdminPath = pathname.startsWith('/admin');
	const isMembersPath = pathname.startsWith('/members-zone');
	if (!isAdminPath && !isMembersPath) return NextResponse.next();

	if (pathname === '/members-zone/about') return NextResponse.next();

	const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
	const requiredRoleId = process.env.DISCORD_REQUIRED_ROLE_ID || VERIFIED_MEMBER_ROLE_ID;
	const teamCaptainRoleId = HOLDKAPTAJN_ROLE_ID;

	if (!token) {
		const url = req.nextUrl.clone();
		url.pathname = '/login';
		url.searchParams.delete('error');
		const callback = req.nextUrl.pathname + req.nextUrl.search;
		url.searchParams.set('callbackUrl', callback);
		return NextResponse.redirect(url);
	}

	if (isAdminPath) {
		if (!Boolean((token as any)?.isAdmin)) {
			return new NextResponse('Not Found', { status: 404 });
		}
		return NextResponse.next();
	}

	const roles = (token as any)?.roles as string[] | undefined;
	if (!Array.isArray(roles)) {
		const url = req.nextUrl.clone();
		url.pathname = '/login';
		url.searchParams.set('error', 'AccessDenied');
		const callback = req.nextUrl.pathname + req.nextUrl.search;
		url.searchParams.set('callbackUrl', callback);
		return NextResponse.redirect(url);
	}

	if (pathname.startsWith('/members-zone/racing/team-management')) {
		const isAdmin = Boolean((token as any)?.isAdmin);
		if (!isAdmin && !roles.includes(teamCaptainRoleId)) {
			const url = req.nextUrl.clone();
			url.pathname = '/members-zone';
			url.searchParams.delete('error');
			return NextResponse.redirect(url);
		}
	}

	if (!roles.includes(requiredRoleId)) {
		const url = req.nextUrl.clone();
		url.pathname = '/login';
		url.searchParams.set('error', 'AccessDenied');
		const callback = req.nextUrl.pathname + req.nextUrl.search;
		url.searchParams.set('callbackUrl', callback);
		return NextResponse.redirect(url);
	}

	return NextResponse.next();
}

export const config = {
	matcher: ['/members-zone/:path*', '/admin/:path*'],
};
