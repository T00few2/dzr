import NextAuth from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID as string;
const REQUIRED_ROLE_ID = (process.env.DISCORD_REQUIRED_ROLE_ID || "1385216556166025347") as string;

async function fetchMemberRoles(accessToken: string): Promise<string[]> {
	const res = await fetch(`https://discord.com/api/v10/users/@me/guilds/${DISCORD_GUILD_ID}/member`, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	});
	if (!res.ok) {
		return [];
	}
	const data = await res.json();
	return Array.isArray(data?.roles) ? data.roles : [];
}

const handler = NextAuth({
	session: { strategy: 'jwt' },
	pages: { signIn: '/login', error: '/login' },
	providers: [
		DiscordProvider({
			clientId: process.env.DISCORD_CLIENT_ID as string,
			clientSecret: process.env.DISCORD_CLIENT_SECRET as string,
			authorization: {
				params: {
					scope: "identify email guilds.members.read",
				},
			},
		}),
	],
	callbacks: {
		async signIn({ account }) {
			if (!account?.access_token) return false;
			const roles = await fetchMemberRoles(account.access_token as string);
			return roles.includes(REQUIRED_ROLE_ID);
		},
		async jwt({ token, account, profile }) {
			if (account?.access_token) {
				const roles = await fetchMemberRoles(account.access_token as string);
				token.roles = roles;
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
			(session as any).user.email = (token as any).email || (session as any).user?.email || null;
			return session;
		},
	},
	secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST }; 