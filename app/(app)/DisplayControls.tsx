"use client";

import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";

export function DisplayControls({ initialTheme, initialHidden }: { initialTheme: Theme; initialHidden: boolean }) {
  const [hidden, setHidden] = useState(initialHidden);
  useEffect(() => {
    const theme = (localStorage.getItem("pk_theme") as Theme | null) ?? initialTheme;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.moneyHidden = String(initialHidden);
  }, [initialHidden, initialTheme]);
  function toggle() {
    const next = !hidden;
    setHidden(next);
    localStorage.setItem("pk_hide_values", String(next));
    document.documentElement.dataset.moneyHidden = String(next);
  }
  return <button type="button" className="icon-control" onClick={toggle} aria-pressed={hidden} aria-label={hidden ? "\u25cf" : "\u25cb"} title={hidden ? "\u25cf" : "\u25cb"}>{hidden ? "\u25cf" : "\u25cb"}</button>;
}
