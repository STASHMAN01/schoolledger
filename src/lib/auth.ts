import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { emailSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rateLimit";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    // JWT sessions: no server-side session table to keep in sync, but
    // that means logout / "log out everywhere" relies on tokenVersion
    // below rather than deleting a row — see the jwt callback.
    strategy: "jwt",
    maxAge: 12 * 60 * 60, // 12 hours — short-lived given this handles financial data
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const emailResult = emailSchema.safeParse(credentials?.email);
        if (!emailResult.success || typeof credentials?.password !== "string") {
          return null;
        }
        const email = emailResult.data;

        // Rate limit by email, not just IP: stops credential-stuffing
        // against one account from behind a shared/rotating IP.
        const { allowed } = rateLimit(`login:${email}`, {
          limit: 10,
          windowMs: 15 * 60 * 1000,
        });
        if (!allowed) return null;

        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await verifyPassword(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          tokenVersion: user.tokenVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.tokenVersion = (user as { tokenVersion: number }).tokenVersion;
      }

      // This revalidation needs Prisma, which cannot run in the Edge
      // runtime that middleware.ts executes in (Prisma needs a real
      // TCP/Node runtime for its Postgres connection). Skip it there —
      // middleware still gets a validly-signed token for its coarse
      // "is there a session at all" redirect check, and every actual
      // page/API request (Node.js runtime, not Edge) still gets full
      // per-request enforcement via requireMembership/requireSession,
      // which call this same callback in a Node context. Without this
      // guard, every middleware-gated request throws trying to reach
      // Postgres from Edge, which surfaces to users as a login that
      // silently fails or immediately bounces back to /login.
      if (process.env.NEXT_RUNTIME === "edge") {
        return token;
      }

      // Invalidate this token if the user's tokenVersion has since been
      // bumped (password change, admin-forced logout, suspected compromise).
      if (typeof token.userId === "string") {
        const current = await db.user.findUnique({
          where: { id: token.userId },
          select: { tokenVersion: true },
        });
        if (!current || current.tokenVersion !== token.tokenVersion) {
          return {};
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (typeof token.userId === "string") {
        session.user.id = token.userId;
      } else {
        // Token was invalidated in the jwt callback above.
        session.user = undefined as unknown as typeof session.user;
      }
      return session;
    },
  },
  // Secure-by-default cookies: httpOnly + sameSite=lax always come from
  // next-auth; `secure` is turned on automatically in production (based on
  // AUTH_URL/NEXTAUTH_URL being https) — do not override this to false.
  trustHost: true,
});
