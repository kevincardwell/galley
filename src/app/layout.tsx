/* eslint-disable @next/next/no-page-custom-font -- App Router root layout loads fonts for every page */
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: { default: "Galley", template: "%s · Galley" },
  description: "Tasks, copy and media for every website you build.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Galley" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* Light, because that is the default. The script below darkens it when
            the resolved theme is actually dark, which a media query cannot know. */}
        <meta name="theme-color" content="#EFEEEA" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400..600&display=swap"
        />
        {/* Stamps the saved theme before first paint. next/script keeps it out of React's client render. */}
        <Script id="galley-theme" strategy="beforeInteractive">
          {`try{var t=localStorage.getItem('galley-theme');if(t)document.documentElement.dataset.theme=t;` +
            `if(t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)){` +
            `var m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content','#171614')}}catch(e){}`}
        </Script>
      </head>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
