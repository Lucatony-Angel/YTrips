import { useState, useEffect } from "react";

export default function useDarkMode() {
  const [dark, setDark] = useState(
    () => localStorage.getItem("theme") === "dark"
  );

  useEffect(() => {
    const html = document.documentElement;
    // Add transition class so the switch animates smoothly
    html.classList.add("theme-transitioning");
    if (dark) {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
    localStorage.setItem("theme", dark ? "dark" : "light");
    // Remove transition class after animation completes
    const t = setTimeout(() => html.classList.remove("theme-transitioning"), 350);
    return () => clearTimeout(t);
  }, [dark]);

  const toggle = () => setDark((v) => !v);
  return [dark, toggle];
}
