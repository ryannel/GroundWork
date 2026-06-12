// The typed IPC contract — the single seam between the sandboxed renderer and
// the privileged main process. This module carries TYPES ONLY: runtime code
// never crosses the process boundary through src/shared/
// (docs/principles/stack/electron/process-model.md).
//
// Adding a channel: declare it here, implement the handler in src/main/ipc.ts
// (with sender validation, and zod validation for non-trivial payloads), and
// expose a purpose-named method in src/preload/index.ts. A channel without an
// entry here is an untyped seam that drifts silently
// (docs/principles/stack/electron/ipc-contracts.md).

export type AppStatus = {
  status: 'ok';
  version: string;
  platform: string;
};

export type OpenExternalResult = {
  opened: boolean;
};

export type ThemeInfo = {
  shouldUseDarkColors: boolean;
};

/** Request/response channels, served by ipcMain.handle in src/main/ipc.ts. */
export type IpcContract = {
  'app:get-status': { args: []; result: AppStatus };
  'shell:open-external': { args: [url: string]; result: OpenExternalResult };
};

/** One-way push channels, broadcast main → renderer via webContents.send. */
export type IpcPushContract = {
  'theme:changed': ThemeInfo;
};

/** The narrow, purpose-named bridge preload exposes as `window.api`. Methods
 *  name capabilities, never transport — raw ipcRenderer is never exposed. */
export type RendererApi = {
  getStatus: () => Promise<AppStatus>;
  openExternal: (url: string) => Promise<OpenExternalResult>;
  /** Subscribe to native theme changes; returns an unsubscribe function. */
  onThemeChanged: (callback: (theme: ThemeInfo) => void) => () => void;
};
