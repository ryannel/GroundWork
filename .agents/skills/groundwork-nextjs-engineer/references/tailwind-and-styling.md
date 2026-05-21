# Tailwind & Theming

## Table of Contents
- [Tailwind v4 CSS-First Architecture](#tailwind-v4-css-first-architecture)
- [globals.css Structure](#globalscss-structure)
- [PostCSS Pipeline](#postcss-pipeline)
- [Dark Mode with @custom-variant](#dark-mode-with-custom-variant)
- [Wiring OKLCH Tokens into Tailwind](#wiring-oklch-tokens-into-tailwind)
- [Animations with tw-animate-css](#animations-with-tw-animate-css)
- [Theme Tokens (Obsidian / Milk)](#theme-tokens-obsidian--milk)
- [Common Mistakes](#common-mistakes)

---

## Tailwind v4 CSS-First Architecture

Tailwind v4 eliminates the JavaScript configuration file. All customisation happens in CSS via `@theme` blocks and CSS custom properties. There is no `tailwind.config.ts` or `tailwind.config.js` in the the Next.js application.

### What Changed from v3

| v3 (Forbidden) | v4 (Required) |
|----------------|---------------|
| `tailwind.config.ts` | No config file — use `@theme` in CSS |
| `@apply` with `theme()` | Direct CSS custom properties |
| `content: ['./app/**/*.tsx']` | Automatic content detection |
| `darkMode: 'class'` | `@custom-variant dark (&:is(.dark *))` |
| `plugins: [require('...')]` | `@plugin` directive in CSS |

---

## globals.css Structure

The `globals.css` file is the central configuration point. It replaces the old `tailwind.config.ts`:

```css
/* app/globals.css */

/* 1. Import Tailwind */
@import "tailwindcss";

/* 2. Custom variant for dark mode */
@custom-variant dark (&:is(.dark *));

/* 3. Theme tokens — extend Tailwind's design system */
@theme {
  /* Colours — OKLCH only */
  --color-accent:           oklch(0.68 0.16 250);
  --color-accent-subtle:    oklch(0.68 0.16 250 / 0.10);
  --color-surface:          oklch(0.98 0.005 250);
  --color-surface-elevated: oklch(0.96 0.005 250);
  --color-text-primary:     oklch(0.15 0 0);
  --color-text-secondary:   oklch(0.45 0 0);
  --color-success:          oklch(0.72 0.10 158);
  --color-error:            oklch(0.65 0.12 15);
  --color-warning:          oklch(0.78 0.12 75);

  /* Typography */
  --font-sans: 'Geist', sans-serif;
  --font-mono: 'Geist Mono', monospace;

  /* Spacing — 8pt grid */
  --spacing-sub:      0.25rem;    /* 4px */
  --spacing-base:     0.5rem;     /* 8px */
  --spacing-standard: 1rem;       /* 16px */
  --spacing-macro:    2rem;       /* 32px */

  /* Radii */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
}

/* 4. Dark theme overrides */
.dark {
  --color-surface:          oklch(0.17 0.005 250);
  --color-surface-elevated: oklch(0.21 0.005 250);
  --color-text-primary:     oklch(0.93 0 0);
  --color-text-secondary:   oklch(0.65 0 0);
}

/* 5. Liquid Glass utility classes */
.glass-surface {
  background: oklch(from var(--color-surface) l c h / 0.72);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid oklch(1 0 0 / 0.08);
  border-radius: var(--radius-lg);
  box-shadow:
    inset 0 1px 0 oklch(1 0 0 / 0.06),
    0 1px 2px oklch(0 0 0 / 0.06),
    0 4px 8px oklch(0 0 0 / 0.04),
    0 12px 24px oklch(0 0 0 / 0.03),
    0 24px 48px oklch(0 0 0 / 0.02);
}

.glass-elevated {
  background: oklch(from var(--color-surface-elevated) l c h / 0.82);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid oklch(1 0 0 / 0.12);
  border-radius: var(--radius-xl);
  box-shadow:
    inset 0 1px 0 oklch(1 0 0 / 0.10),
    0 2px 4px oklch(0 0 0 / 0.08),
    0 8px 16px oklch(0 0 0 / 0.06),
    0 24px 48px oklch(0 0 0 / 0.05),
    0 48px 96px oklch(0 0 0 / 0.03);
}
```

---

## PostCSS Pipeline

Tailwind v4 uses `@tailwindcss/postcss` as its PostCSS plugin:

```js
// postcss.config.js
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

Do not add `autoprefixer` separately — `@tailwindcss/postcss` handles vendor prefixing.

---

## Dark Mode with @custom-variant

The the Next.js application uses class-based dark mode. The `dark` custom variant activates when the `.dark` class is present on an ancestor element.

```css
@custom-variant dark (&:is(.dark *));
```

### Usage in Components

```tsx
// Tailwind utility classes
<div className="bg-[--color-surface] dark:bg-[--color-surface-elevated]">
  <p className="text-[--color-text-primary]">
    Reads from the appropriate CSS variable based on theme
  </p>
</div>
```

Because the colour tokens themselves change in the `.dark` scope (via the CSS overrides in `globals.css`), most components don't need `dark:` variants at all — they inherit the correct colours automatically.

```tsx
// These work in both themes without dark: variants
<div className="bg-[--color-surface]">       {/* Auto-switches */}
<p className="text-[--color-text-primary]">   {/* Auto-switches */}
<span className="text-[--color-accent]">      {/* Same in both themes */}
```

Use `dark:` variants only when the light and dark themes need structurally different styles (different borders, shadows, or opacity values).

---

## Wiring OKLCH Tokens into Tailwind

The `@theme` block in `globals.css` makes CSS custom properties available as Tailwind utilities:

```css
@theme {
  --color-accent: oklch(0.68 0.16 250);
}
```

This enables:
```html
<div class="text-accent bg-accent/10">   <!-- Tailwind utility from @theme -->
<div class="text-[--color-accent]">      <!-- Arbitrary CSS variable -->
```

Both approaches work. Use the shorthand (`text-accent`) for theme-defined colours. Use the arbitrary syntax (`text-[--color-accent]`) when referencing variables not registered in `@theme`.

---

## Animations with tw-animate-css

The the Next.js application uses `tw-animate-css` for utility-based animations. This provides enter/exit animations without custom keyframe definitions.

```tsx
// Fade in on mount
<div className="animate-in fade-in duration-200">
  Content appears smoothly
</div>

// Slide up on mount
<div className="animate-in slide-in-from-bottom-4 duration-300">
  Content slides up from below
</div>

// Exit animation (pair with Radix or shadcn/ui states)
<div className="data-[state=closed]:animate-out data-[state=closed]:fade-out">
  Fades out when state becomes "closed"
</div>

// Combined enter/exit for dialogs
<DialogContent className="animate-in fade-in slide-in-from-bottom-4 duration-300 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:slide-out-to-bottom-4">
  Dialog content
</DialogContent>
```

### Motion Principles

Animations must feel **liquid** — organic easing, not mechanical. Follow these rules from the visual language:

- **Duration:** 150-300ms for micro-interactions, 300-500ms for layout transitions
- **Easing:** Use `ease-out` for entries, `ease-in` for exits. Never `linear`.
- **Scale:** Tactile scale shifts of 2-4% (`scale-[0.97]` on press, `scale-100` on release)
- **Direction:** Elements enter from the direction they were triggered (bottom sheet from bottom, sidebar from left)

---

## Theme Tokens (Obsidian / Milk)

The the Next.js application ships two themes:

| Theme | Class | Description |
|-------|-------|-------------|
| **Obsidian** (dark) | `.dark` on `<html>` | Deep charcoal surfaces, bright text |
| **Milk** (light) | Default (no class) | Near-white surfaces, dark text |

### Theme Switching

```tsx
// lib/contexts.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'obsidian' | 'milk';

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
}>({ theme: 'obsidian', setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('obsidian');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'obsidian') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
```

### Dual-Theme Verification

Every component must be verified in both themes before merging. Watch for:

- Text contrast ratios meeting WCAG AA (4.5:1 for body, 3:1 for large text)
- Shadow visibility (too subtle in light, too dark in dark)
- Border visibility (transparent white borders may vanish in light mode)
- Glass blur effects rendering correctly against both surface backgrounds
- Success/error/warning colours maintaining readability in both modes

---

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|-------------|-----|
| Creating `tailwind.config.ts` | Overrides CSS-first architecture | Use `@theme` in `globals.css` |
| Using `theme()` function in CSS | v3 syntax, not supported | Reference CSS custom properties directly |
| `@apply hover:bg-gray-100` | v3 `@apply` with hover | Use CSS native `:hover` selector |
| Hardcoding `bg-gray-800` | Not using custom palette | Use `bg-[--color-surface]` or `bg-surface` |
| Adding `autoprefixer` to PostCSS | `@tailwindcss/postcss` handles it | Remove `autoprefixer` from config |
| Using `darkMode: 'class'` in config | v3 config syntax | Use `@custom-variant dark` in CSS |
| Importing CSS with `@import url()` | Blocks rendering | Use `@import "module"` syntax (no `url()`) |
