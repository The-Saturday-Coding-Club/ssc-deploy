import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [
        GitHub({
            clientId: process.env.AUTH_GITHUB_ID,
            clientSecret: process.env.AUTH_GITHUB_SECRET,
            authorization: { params: { scope: "read:user user:email repo" } },
        }),
    ],
    callbacks: {
        async jwt({ token, account, profile }) {
            if (account && profile) {
                // Use GitHub profile ID explicitly (numeric ID as string)
                const githubId = String((profile as any).id);
                token.sub = githubId;
                token.accessToken = account.access_token;

                // Store encrypted token on backend (server-side only)
                try {
                    const response = await fetch(`${API_URL}/user/token`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "X-User-Id": githubId,
                        },
                        body: JSON.stringify({
                            token: account.access_token,
                            username: (profile as any)?.login || "unknown",
                        }),
                    });
                    if (!response.ok) {
                        console.error("Failed to store token on backend:", response.status, await response.text());
                    }
                } catch (e) {
                    console.error("Failed to store token on backend:", e);
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
