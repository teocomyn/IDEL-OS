import type { Metadata } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "IDEL OS",
  description: "Le copilote administratif des infirmiers libéraux.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  await connection();
  return <html lang="fr"><body>{children}</body></html>;
}
