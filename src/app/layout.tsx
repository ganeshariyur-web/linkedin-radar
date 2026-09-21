import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Hydrator } from "@/components/Hydrator";

export const metadata: Metadata = {
  title: "LinkedIn Radar",
  description: "Score your LinkedIn connections and invitations against your ICP with TypeSafe Jev. Files never leave your browser.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

const themeScript = `(function(){try{var t=localStorage.getItem('lr:theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-bg text-fg">
        <Hydrator />
        <Nav />
        <main className="px-4 md:px-8 pb-16">{children}</main>
      </body>
    </html>
  );
}
