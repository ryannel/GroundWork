import js from "@eslint/js";
import { fixupPluginRules } from "@eslint/compat";
import nextPlugin from "@next/eslint-plugin-next";
import reactPlugin from "eslint-plugin-react";
import hooksPlugin from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      ".next/",
      "node_modules/",
      "public/",
      "dist/",
      "coverage/",
      "components/ui/"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      react: reactPlugin,
      "react-hooks": hooksPlugin,
      "@next/next": fixupPluginRules(nextPlugin),
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2024,
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs["jsx-runtime"].rules,
      ...hooksPlugin.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      
      "no-console": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/switch-exhaustiveness-check": "warn",
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "@typescript-eslint/restrict-template-expressions": "warn",
      "prefer-const": "warn",
      "no-case-declarations": "warn",
      "no-useless-escape": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/rules-of-hooks": "warn",
      "react/prop-types": "off",

      // Token-conformance gate (visual verification loop, Tier 1). Design values
      // live in the token layer — CSS custom properties in app/globals.css, surfaced
      // as Tailwind token utilities (bg-primary, text-foreground, px-4). A raw colour
      // or length literal in a component bypasses the design system and drifts
      // silently, so it fails lint. globals.css is the token-definition layer and is
      // not linted here (ESLint does not lint CSS). Catches inline-style hex/px,
      // raw gradients, and Tailwind arbitrary values (colour, length, shadow, blur,
      // gradient) — the atmosphere layer (elevation, blur, gradients, surface
      // treatments) is projected from brand-tokens.json into token utilities, so a
      // literal recipe in a component is drift. Token utilities and CSS-variable
      // references pass.
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='style'] Literal[value=/#[0-9a-fA-F]{3,8}\\b/]",
          message: "Raw hex colour in an inline style — use a design token (a Tailwind token utility or a CSS custom property defined in globals.css), not a literal.",
        },
        {
          selector: "JSXAttribute[name.name='style'] Literal[value=/[0-9](px|rem)\\b/]",
          message: "Raw length literal in an inline style — use a spacing/size token from the design system, not a hardcoded px/rem value.",
        },
        {
          selector: "JSXAttribute[name.name='className'] Literal[value=/\\[#[0-9a-fA-F]/]",
          message: "Tailwind arbitrary colour value (e.g. bg-[#3b82f6]) — use a semantic token utility (bg-primary, text-foreground) defined in the token layer.",
        },
        {
          selector: "JSXAttribute[name.name='className'] Literal[value=/\\[[0-9.]+(px|rem)\\]/]",
          message: "Tailwind arbitrary length value (e.g. p-[12px]) — use a spacing-scale utility (p-3, gap-4), not a hardcoded length.",
        },
        {
          selector: "JSXAttribute[name.name='style'] Literal[value=/(radial|linear|conic)-gradient\\(/]",
          message: "Raw CSS gradient in an inline style — use a gradient/surface token (a utility from the token layer), not a literal recipe. Atmosphere lives in the design system, not the component.",
        },
        {
          selector: "JSXAttribute[name.name='className'] Literal[value=/(shadow|drop-shadow)-\\[/]",
          message: "Tailwind arbitrary shadow (e.g. shadow-[0_1px_2px]) — use an elevation token utility (shadow-low/mid/high) projected from brand-tokens.json, not a literal stack.",
        },
        {
          selector: "JSXAttribute[name.name='className'] Literal[value=/(backdrop-blur|blur)-\\[/]",
          message: "Tailwind arbitrary blur (e.g. backdrop-blur-[20px]) — use a blur token utility projected from the design system, not a literal radius.",
        },
        {
          selector: "JSXAttribute[name.name='className'] Literal[value=/\\[(radial|linear|conic)-gradient/]",
          message: "Tailwind arbitrary gradient — use a gradient/surface token utility from the token layer, not a literal recipe.",
        },
      ],
    },
  },
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    extends: [tseslint.configs.disableTypeChecked],
  }
);
