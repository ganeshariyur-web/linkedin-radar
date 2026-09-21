"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

const links = [
  { href: "/", label: "Radar" },
  { href: "/studio", label: "Classifier Studio" },
  { href: "/methods", label: "Methods" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="px-4 md:px-8 pt-5 pb-3 flex items-center justify-between gap-4 border-b border-line">
      <div className="flex items-baseline gap-6">
        <Link href="/" className="headline text-xl md:text-2xl">
          LinkedIn Radar
        </Link>
        <nav className="hidden sm:flex items-center gap-5">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={`label hover:text-fg ${path === l.href ? "text-fg" : ""}`}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <span className="label hidden md:inline">Private · files stay in your browser</span>
        <ThemeToggle />
      </div>
      <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-bg border-t border-line flex justify-around py-3 z-20">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={`label ${path === l.href ? "text-fg" : ""}`}>
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
