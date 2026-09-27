import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AutoSocial — Social Media Automation Agent",
  description:
    "Production-ready social media automation agent: AI captions, optimal-time scheduling, drag-and-drop uploads, realtime upload progress and analytics.",
  keywords: [
    "AutoSocial",
    "social media",
    "automation",
    "AI scheduling",
    "Next.js",
    "Prisma",
    "socket.io",
  ],
  authors: [{ name: "AutoSocial" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "AutoSocial — Social Media Automation Agent",
    description:
      "AI-powered social media scheduling, captions and analytics.",
    siteName: "AutoSocial",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply persisted theme before React hydrates to avoid a flash.
            Safe: this script reads from localStorage and only adds/removes a class. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('autosocial-app-store');if(s){var t=(JSON.parse(s).state||{}).theme;if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}}}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
