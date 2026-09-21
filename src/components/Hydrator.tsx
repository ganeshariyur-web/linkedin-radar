"use client";
import { useEffect } from "react";
import { useApp } from "@/lib/store";

export function Hydrator() {
  const hydrate = useApp((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
  return null;
}
