import NextAuth from "next-auth";

// The slice of the auth setup that src/middleware.ts needs: decode the
// session cookie and say whether there is a session at all. Nothing else.
//
// Kept separate from src/lib/auth.ts so the Edge middleware never bundles
// the database client, the field encryption (Node's crypto) or the mail
// library -- Node-only code in the middleware takes down every page (4 Oct
// 2026). Every real permission check still happens in the Node runtime
// through auth.ts (requireMembership, requirePlatformAdmin), which also
// re-checks tokenVersion against the database.
//
// Session settings must match auth.ts exactly (same JWT strategy and
// lifetime), or the two would disagree about the same cookie.
export const { auth: edgeAuth } = NextAuth({
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token }) {
      return token;
    },
    session({ session, token }) {
      if (typeof token.userId === "string") {
        session.user.id = token.userId;
      } else {
        session.user = undefined as unknown as typeof session.user;
      }
      return session;
    },
  },
  trustHost: true,
});
