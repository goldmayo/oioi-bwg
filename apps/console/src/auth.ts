import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { authenticateConsole } from "@/server/auth/authenticate-console";
import { reportAuthError } from "@/server/observability/auth-error-reporter";

import { consoleCookies, getConsoleRuntimeConfig } from "@/shared/config/console-runtime";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const { auth, handlers, signIn, signOut } = NextAuth(() => {
  const config = getConsoleRuntimeConfig();
  return {
    secret: config.secret,
    trustHost: true,
    cookies: consoleCookies,
    pages: { signIn: "/admin-login" },
    logger: { error: reportAuthError },
    providers: [
      Credentials({
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          const parsed = credentialsSchema.safeParse(credentials);
          if (!parsed.success) return null;

          return authenticateConsole(parsed.data.email, parsed.data.password);
        },
      }),
    ],
    session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
    callbacks: {
      redirect({ url }) {
        const target = new URL(url, config.origin);
        return target.origin === config.origin ? target.href : config.origin;
      },
      jwt({ token, user }) {
        const userId = user?.id ?? token.sub;
        return userId ? { sub: userId } : {};
      },
      session({ session, token }) {
        if (token.sub) session.user.id = token.sub;
        return session;
      },
    },
  };
});
