import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      mfaVerified?: true;
      mfaVersion?: number;
    } & DefaultSession["user"];
  }
  interface User {
    mfaVerified?: true;
    mfaVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    mfaVerified?: true;
    mfaVersion?: number;
  }
}
