import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Newsreader } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";

// Self-hosted by next/font: no request to Google at runtime, no layout shift, and the CSP can
// keep its font and style sources to 'self'.
const ui = Instrument_Sans({ subsets: ["latin"], display: "swap", variable: "--font-instrument" });
const serif = Newsreader({ subsets: ["latin"], display: "swap", axes: ["opsz"], variable: "--font-newsreader" });

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
    <html lang="en" suppressHydrationWarning className={`${ui.variable} ${serif.variable}`}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Galley" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* Light, because that is the default. The script below darkens it when
            the resolved theme is actually dark, which a media query cannot know. */}
        <meta name="theme-color" content="#EFEEEA" />
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
