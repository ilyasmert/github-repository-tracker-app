import type { Metadata } from "next";
import { Providers } from "./providers";
// @ts-ignore - Next.js handles global CSS imports; IDE TS server may not see the augmentation.
import "./globals.css";

export const metadata: Metadata = {
  title: "Repository Tracker",
  description: "Track GitHub repositories you care about.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <header className="border-b border-slate-200 bg-white">
              <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
                <span className="text-lg font-semibold tracking-tight">
                  Repository Tracker
                </span>
                <span className="text-xs text-slate-500">
                  Watchlist for GitHub repos
                </span>
              </div>
            </header>
            <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
              {children}
            </main>
            <footer className="border-t border-slate-200 bg-white">
              <div className="mx-auto max-w-5xl px-6 py-3 text-xs text-slate-500">
                GitHub Repository Tracker.
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}