import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { createAuthClient } from "better-auth/react";
import type { BetterAuthClientPlugin } from "better-auth/client";
import { twoFactorClient } from "better-auth/client/plugins";

export const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

const secureExpoPlugin = expoClient({
  scheme: "idel-os",
  storagePrefix: "idel-os-auth",
  storage: SecureStore,
}) as unknown as BetterAuthClientPlugin;

const client = createAuthClient({
  baseURL: apiBaseUrl,
  plugins: [
    secureExpoPlugin,
    twoFactorClient(),
  ],
});

type AuthResult<T> = Promise<{
  data: T | null;
  error: { message?: string } | null;
}>;

type MobileAuthClient = {
  getCookie(): string;
  useSession(): { data: object | null; isPending: boolean };
  signIn: {
    email(input: { email: string; password: string }): AuthResult<{ twoFactorRedirect?: boolean }>;
  };
  twoFactor: {
    verifyTotp(input: { code: string; trustDevice: boolean }): AuthResult<object>;
  };
};

export const authClient = client as unknown as MobileAuthClient;
