import { DefaultSession } from "next-auth"

declare module "next-auth" {
    interface Session {
        user: {
            id: string  // GitHub user ID from token.sub
        } & DefaultSession["user"]
        accessToken?: string
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        accessToken?: string
        sub?: string  // GitHub user ID
    }
}
