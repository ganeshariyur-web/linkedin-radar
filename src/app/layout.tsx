import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Hydrator } from "@/components/Hydrator";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
  weight: "variable",
  style: ["normal", "italic"],
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "LinkedIn Radar",
  description: "Score your LinkedIn connections and invitations against your ICP with TypeSafe Jev. Files never leave your browser.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

const themeScript = `(function(){try{var t=localStorage.getItem('lr:theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${fraunces.variable} ${inter.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-bg text-fg">
        <Hydrator />
        <Nav />
        <main className="px-5 md:px-10 pb-20 max-w-[1560px] mx-auto">{children}</main>
        <footer className="px-5 md:px-10 py-8 max-w-[1560px] mx-auto rule mt-8 flex flex-wrap justify-between gap-3">
          <span className="label">LinkedIn Radar · Private</span>
          <span className="label">Files stay in your browser · Judgments by Jev (TypeSafe) · Enrichment by Apify</span>
        </footer>
      </body>
    </html>
  );
}
