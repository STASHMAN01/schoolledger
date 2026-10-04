import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { emailSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { isTokenStillValid } from "@/lib/tokenVersion";
// Must stay import-free: auth.ts runs in the Edge middleware too.
import { parseLoginIdentifier } from "@/lib/loginIdentifier";

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
      async authorize(credentials, request) {
        // One box, two kinds of login: an email for normal accounts, or a
        // username like "dees.butterfly" for a class profile (no email).
        const identifier = parseLoginIdentifier(credentials?.email);
        if (!identifier || typeof credentials?.password !== "string") {
          return null;
        }
        if (identifier.kind === "email" && !emailSchema.safeParse(identifier.value).success) {
          return null;
        }

        // Rate limit on two dimensions, both generic-failure (no "which
        // one tripped" signal to the client): per account (email or
        // username), so credential stuffing against one account from a
        // shared/rotating IP is still capped -- this matters most for
        // profile usernames, which are easy to guess; and per IP, so
        // spraying one password across many accounts from one source
        // doesn't fly under the per-account limit.
        const ip = clientIp(request?.headers);
        const byAccount = rateLimit(`login:${identifier.kind}:${identifier.value}`, {
          limit: 10,
          windowMs: 15 * 60 * 1000,
        });
        const byIp = rateLimit(`login:ip:${ip}`, {
          limit: 20,
          windowMs: 15 * 60 * 1000,
        });
        if (!byAccount.allowed || !byIp.allowed) return null;

        const user =
          identifier.kind === "email"
            ? await db.user.findUnique({ where: { email: identifier.value } })
            : await db.user.findUnique({ where: { username: identifier.value } });
        // A username only ever logs in a profile, and an email never does.
        if (!user || (identifier.kind === "username") !== user.isProfile) return null;

        const valid = await verifyPassword(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email ?? user.username,
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
      // A failed lookup keeps the session -- see src/lib/tokenVersion.ts.
      if (typeof token.userId === "string") {
        const userId = token.userId;
        const valid = await isTokenStillValid(token.tokenVersion, () =>
          db.user.findUnique({ where: { id: userId }, select: { tokenVersion: true } }),
        );
        if (!valid) return {};
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
