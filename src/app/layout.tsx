import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import Script from "next/script";
import "@/styles/globals.css";
import "@/styles/components.css";
import { Navbar } from "@/components/layout/Navbar";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: "Lumigift — Time-Locked Cash Gifts on Stellar",
    template: "%s | Lumigift",
  },
  description:
    "Send cash gifts that stay hidden until a surprise unlock date. Powered by Stellar blockchain and USDC.",
  keywords: ["gifting", "stellar", "usdc", "blockchain", "nigeria", "surprise gift"],
  openGraph: {
    title: "Lumigift — Time-Locked Cash Gifts",
    description: "Send cash gifts that unlock on a surprise date.",
    url: "https://www.lumigift.com",
    siteName: "Lumigift",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lumigift — Time-Locked Cash Gifts",
    description: "Send cash gifts that unlock on a surprise date.",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Propagate the per-request nonce to Next.js Script components so
            their inline bootstrapping scripts satisfy the strict CSP. */}
        <Script id="__nonce" nonce={nonce} strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: "" }} />
        {/* Prevent flash of wrong theme — runs before paint */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}else if(window.matchMedia('(prefers-color-scheme: light)').matches){document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <Providers>
          <Navbar />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
