import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";

export const metadata: Metadata = {
  title: "walquest",
  description: "Walk it. Claim it. Defend it. Bengaluru's territory game.",
  // Declared explicitly so Next.js treats this as static metadata, not
  // file-based metadata - app/favicon.ico would trigger dynamic metadata
  // processing which breaks unstable_instant validation.
  icons: { icon: "/favicon.ico", apple: "/icon-192.png" },
};

export const viewport: Viewport = {
  // Browser chrome / status bar colour, matching the app background
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2EDDC" }, // Parchment
    { media: "(prefers-color-scheme: dark)", color: "#3A3D33" }, // Olivewood
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
