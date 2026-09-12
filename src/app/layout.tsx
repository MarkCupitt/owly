import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { ThemeInit } from "@/components/theme-init";
import { SystemNameInit } from "@/components/system-name-init";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PowerDeck",
  description: "AI-powered customer support system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="h-full">
          <Providers>
            <ThemeInit />
            <SystemNameInit />
            {children}
          </Providers>
        </body>
    </html>
  );
}
