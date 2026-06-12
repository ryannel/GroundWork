import js from "@eslint/js";
import hooksPlugin from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import globals from "globals";

// Node built-ins that must never reach the sandboxed renderer or the shared
// contract types. The list backs the lint-enforced process boundary — the
// Slack pattern: the folder split is physical, and a rule fails the build when
// it erodes (docs/principles/stack/electron/process-model.md).
const nodeBuiltinPatterns = ["node:*", "fs", "path", "os", "child_process", "crypto", "net", "http", "https"];

export default tseslint.config(
  {
    ignores: ["out/", "dist/", "node_modules/", "coverage/", "playwright-report/", "test-results/"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2024,
      },
    },
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // The renderer is a normal web app: browser globals, React hooks rules,
    // and a hard boundary — no Electron, no Node. Its only platform surface
    // is the preload-exposed window.api bridge.
    files: ["src/renderer/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": hooksPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2024,
      },
    },
    rules: {
      ...hooksPlugin.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "electron",
              message:
                "The renderer is sandboxed and Node-free; talk to main through window.api (docs/principles/stack/electron/process-model.md).",
            },
          ],
          patterns: [
            {
              group: nodeBuiltinPatterns,
              message:
                "Node built-ins do not exist in the sandboxed renderer; move the capability behind the IPC bridge.",
            },
          ],
        },
      ],
    },
  },
  {
    // Shared code crosses the process boundary as types only.
    files: ["src/shared/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "electron",
              message:
                "src/shared/ carries the IPC contract types only — no runtime, no Electron (docs/principles/stack/electron/process-model.md).",
            },
          ],
          patterns: [
            {
              group: nodeBuiltinPatterns,
              message:
                "src/shared/ carries the IPC contract types only — no runtime, no Node.",
            },
          ],
        },
      ],
    },
  },
);
