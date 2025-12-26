import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// Optional: Restrict access to specific GitHub user IDs
const ALLOWED_GITHUB_IDS = process.env.ALLOWED_GITHUB_IDS
    ? process.env.ALLOWED_GITHUB_IDS.split(',').map(id => id.trim())
    : null; // null means all users allowed

export const { handlers, auth, signIn, signOut } = NextAuth({
    trustHost: true,
    providers: [
        GitHub({
            clientId: process.env.AUTH_GITHUB_ID,
            clientSecret: process.env.AUTH_GITHUB_SECRET,
            authorization: { params: { scope: "read:user user:email repo" } },
        }),
    ],
    callbacks: {
        async signIn({ profile }) {
            // If whitelist is configured, check if user is allowed
            if (ALLOWED_GITHUB_IDS && ALLOWED_GITHUB_IDS.length > 0) {
                const githubId = String((profile as any)?.id);
                if (!ALLOWED_GITHUB_IDS.includes(githubId)) {
                    console.log(`Access denied for GitHub user ID: ${githubId}`);
                    return false; // Deny sign-in
                }
            }
            return true; // Allow sign-in
        },
        async jwt({ token, account, profile }) {
            if (account && profile) {
                // Use GitHub profile ID explicitly (numeric ID as string)
                const githubId = String((profile as any).id);
                token.sub = githubId;
                token.accessToken = account.access_token;

                // Store encrypted token on backend (server-side only, non-blocking)
                // This is fire-and-forget - don't let it block auth
                if (API_URL && API_URL !== "http://localhost:3001") {
                    fetch(`${API_URL}/user/token`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "X-User-Id": githubId,
                        },
                        body: JSON.stringify({
                            token: account.access_token,
                            username: (profile as any)?.login || "unknown",
                        }),
                    }).catch(e => console.error("Failed to store token on backend:", e));
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user && token.sub) {
                session.user.id = token.sub;
            }
            session.accessToken = token.accessToken as string | undefined;
            return session;
        },
    },
})
