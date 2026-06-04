import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

// Single, crisp UI typeface — Stripe/Notion-grade. (Display sizes use weight +
// tight tracking rather than a separate serif.)
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: "%s | DocuMind",
    default: "DocuMind — Enterprise Document Intelligence",
  },
  description:
    "Multi-tenant enterprise document intelligence platform powered by RAG. Upload documents and get AI-powered answers with citations.",
  keywords: ["document intelligence", "RAG", "AI search", "enterprise"],
  openGraph: {
    title: "DocuMind",
    description: "Enterprise Document Intelligence Platform",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
