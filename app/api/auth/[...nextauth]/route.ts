import NextAuth from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { ADMIN_ROLE_ID, COLLECTIONS, DISCORD_GUILD_ID_DEFAULT, VERIFIED_MEMBER_ROLE_ID } from "@/app/lib/sharedConstants";

const DISCORD_GUILD_ID = (process.env.DISCORD_GUILD_ID || DISCORD_GUILD_ID_DEFAULT) as string;
const REQUIRED_ROLE_ID = (process.env.DISCORD_REQUIRED_ROLE_ID || VERIFIED_MEMBER_ROLE_ID) as string;

// Admin determination now uses a specific admin role id from the guild

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AccessDecision = { roles: string[]; paid: boolean; allow: boolean };

async function fetchMemberRoles(accessToken: string): Promise<string[] | null> {
	const res = await fetch(`https://discord.com/api/v10/users/@me/guilds/${DISCORD_GUILD_ID}/member`, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	});
	if (res.status === 404) return [];
	if (!res.ok) {
		console.error(`[auth] discord member lookup failed status=${res.status}`);
		return null;
	}
	const data = await res.json();
	return Array.isArray(data?.roles) ? data.roles : [];
}

async function fetchMemberRolesViaBot(discordId: string): Promise<string[] | null> {
	const botToken = String(process.env.DISCORD_BOT_TOKEN || "").trim();
	if (!botToken || !discordId) return null;
	const res = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${discordId}`, {
		headers: { Authorization: `Bot ${botToken}` },
	});
	if (res.status === 404) return [];
	if (!res.ok) {
		console.error(`[auth] bot member lookup failed status=${res.status}`);
		return null;
	}
	const data = await res.json();
	return Array.isArray(data?.roles) ? data.roles : [];
}

async function discordIdFrom(accessToken: string, profile: unknown): Promise<string> {
	const id = String((profile as { id?: string } | undefined)?.id || "").trim();
	if (id) return id;
	const res = await fetch("https://discord.com/api/v10/users/@me", {
		headers: { Authorization: `Bearer ${accessToken}` },
	});
	if (!res.ok) return "";
	const data = await res.json();
	return String(data?.id || "").trim();
}

async function isPaidMember(discordId: string): Promise<boolean> {
	if (!discordId) return false;
	try {
		const [{ adminDb }, { isPaidClubMember }] = await Promise.all([
			import("@/app/utils/firebaseAdminConfig"),
			import("@/packages/shared/coach/membership"),
		]);
		return isPaidClubMember(
			adminDb,
			{ memberships: COLLECTIONS.memberships, payments: COLLECTIONS.payments },
			discordId
		);
	} catch (err) {
		console.error("[auth] membership lookup failed", err);
		return false;
	}
}

function hasVerifiedRole(roles: string[]): boolean {
	return roles.includes(REQUIRED_ROLE_ID) || roles.includes(VERIFIED_MEMBER_ROLE_ID);
}

async function settle<T>(label: string, task: Promise<T>, fallback: T): Promise<T> {
	try {
		return await task;
	} catch (err) {
		console.error(`[auth] ${label}`, err);
		return fallback;
	}
}

async function resolveAccess(accessToken: string, discordId: string): Promise<AccessDecision> {
	const oauthRoles = await settle("discord role lookup", fetchMemberRoles(accessToken), null);
	let roles = oauthRoles ?? [];
	if (!hasVerifiedRole(roles)) {
		const botRoles = await settle("bot role lookup", fetchMemberRolesViaBot(discordId), null);
		roles = Array.from(new Set([...roles, ...(botRoles ?? [])]));
	}
	const paid = hasVerifiedRole(roles) ? false : await isPaidMember(discordId);
	return { roles, paid, allow: hasVerifiedRole(roles) || paid };
}

const handler = NextAuth({
	session: { strategy: 'jwt' },
	pages: { signIn: '/login', error: '/login' },
	providers: [
		DiscordProvider({
			clientId: process.env.DISCORD_CLIENT_ID as string,
			clientSecret: process.env.DISCORD_CLIENT_SECRET as string,
			// Discord adds iss=https://discord.com on the callback. The OAuth client rejects it unless this matches.
			issuer: "https://discord.com",
			authorization: {
				params: {
					scope: "identify email guilds.members.read",
				},
			},
		}),
	],
	callbacks: {
		async signIn({ account, profile }) {
			try {
				if (!account?.access_token) return false;
				const discordId = await discordIdFrom(account.access_token, profile);
				const access = await resolveAccess(account.access_token, discordId);
				return access.allow;
			} catch (err) {
				console.error("[auth] signIn failed", err);
				return false;
			}
		},
		async jwt({ token, account, profile }) {
			try {
			if (account?.access_token) {
				const discordId = await discordIdFrom(account.access_token, profile);
				if (discordId) token.discordId = discordId;
				const access = await resolveAccess(account.access_token, discordId);
				const roles = access.roles;
				token.roles = roles;
				token.membershipActive = access.paid;
				// Compute isAdmin by presence of the Admin role id
				token.isAdmin = Array.isArray(roles) && roles.includes(ADMIN_ROLE_ID);
			}
			} catch (err) {
				console.error("[auth] jwt failed", err);
			}
			if (profile && (profile as any).id) {
				token.discordId = (profile as any).id;
			}
			if (profile && (profile as any).email) {
				token.email = (profile as any).email as string;
			}
			return token;
		},
		async session({ session, token }) {
			(session as any).user.discordId = (token as any).discordId || null;
			(session as any).user.roles = (token as any).roles || [];
			(session as any).user.isAdmin = Boolean((token as any).isAdmin);
			(session as any).user.email = (token as any).email || (session as any).user?.email || null;
			return session;
		},
	},
	secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST }; 