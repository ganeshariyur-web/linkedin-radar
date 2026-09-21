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
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return (
    <header className="px-5 md:px-10 max-w-[1560px] mx-auto">
      <div className="flex items-center justify-between pt-3 pb-2 text-[10.5px]">
        <span className="label">{today}</span>
        <span className="label hidden md:inline">Private · Files stay in your browser</span>
      </div>
      <div className="rule-strong" />
      <div className="flex items-center justify-between gap-6 py-4">
        <div className="flex items-baseline gap-8">
          <Link href="/" className="headline text-[26px] md:text-[30px]">
            LinkedIn <em>Radar</em>
          </Link>
          <nav className="hidden sm:flex items-center gap-6">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={`label transition-colors hover:text-fg ${path === l.href ? "text-fg" : ""}`}>
                {path === l.href && <span className="eyebrow mr-1.5">●</span>}
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <ThemeToggle />
      </div>
      <div className="rule" />
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
