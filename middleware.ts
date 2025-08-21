import { withAuth } from "next-auth/middleware";

export default withAuth({
	pages: { signIn: "/login?error=AccessDenied" },
	callbacks: {
		authorized: ({ token }) => {
			const requiredRoleId = process.env.DISCORD_REQUIRED_ROLE_ID || "1385216556166025347";
			const roles = (token as any)?.roles as string[] | undefined;
			return Array.isArray(roles) && roles.includes(requiredRoleId);
		},
	},
});

export const config = {
	matcher: ["/members-zone/:path*"],
}; 