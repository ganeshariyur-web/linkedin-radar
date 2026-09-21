"use client";
import { useEffect } from "react";
import { useApp } from "@/lib/store";

export function ThemeToggle() {
  const theme = useApp((s) => s.theme);
  const setTheme = useApp((s) => s.setTheme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    try {
      if (theme === "system") localStorage.removeItem("lr:theme");
      else localStorage.setItem("lr:theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  const next = theme === "system" ? "dark" : theme === "dark" ? "light" : "system";
  return (
    <button className="btn ghost" onClick={() => setTheme(next)} title="Toggle theme" aria-label="Toggle theme">
      {theme === "system" ? "Auto" : theme === "dark" ? "Dark" : "Light"}
    </button>
  );
}
