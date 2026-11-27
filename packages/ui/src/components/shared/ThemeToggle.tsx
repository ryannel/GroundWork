import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "gw-theme";

function resolveTheme(pref: ThemePreference): "light" | "dark" {
  if (pref === "light" || pref === "dark") return pref;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(pref: ThemePreference): "light" | "dark" {
  const resolved = resolveTheme(pref);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark" || saved === "system") return saved;
    } catch {}
    return "system";
  });

  useEffect(() => {
    applyTheme(preference);
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {}
  }, [preference]);

  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  return { preference, setPreference };
}

/**
 * Crisp 3-way segmented theme control (Light | Dark | System) modeled after Linear / Vercel / Raycast.
 */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  const options: Array<{ id: ThemePreference; label: string; icon: React.ReactNode }> = [
    { id: "light", label: "Light theme", icon: <Sun size={13} /> },
    { id: "dark", label: "Dark theme", icon: <Moon size={13} /> },
    { id: "system", label: "System theme", icon: <Monitor size={13} /> },
  ];

  return (
    <div className="theme-switcher" role="group" aria-label="Theme">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={`theme-btn ${preference === opt.id ? "active" : ""}`}
          onClick={() => setPreference(opt.id)}
          title={opt.label}
          aria-label={opt.label}
          aria-pressed={preference === opt.id}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
}
