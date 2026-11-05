import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "./globals.css";
export const metadata: Metadata = {
  title: "The Palace Cinema",
  description:
    "One shared list. Every film you want to watch, and every film you’ve loved.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try { const saved = localStorage.getItem('palace-theme'); document.documentElement.dataset.theme = saved === 'dark' || saved === 'light' ? saved : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } catch {}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
