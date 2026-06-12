import {
  app,
  BrowserWindow,
  nativeTheme,
  net,
  protocol,
  session,
  shell,
} from 'electron';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { registerIpcHandlers } from './ipc';
import {
  APP_ORIGIN,
  APP_SCHEME,
  isAllowedExternalUrl,
  isContainedPath,
  isTrustedNavigationTarget,
} from './policy';

// Main is an orchestrator and nothing more: window creation, security policy,
// IPC registration, OS integration. CPU-heavy or crash-prone work belongs in a
// utilityProcess with MessagePorts wired renderer↔utility directly — never
// here, where it would starve every window's event loop
// (docs/principles/stack/electron/process-model.md).

// Set by electron-vite during `dev`; absent in built/packaged runs.
const DEV_SERVER_URL = process.env['ELECTRON_RENDERER_URL'];

// Must run before app ready: the bundle protocol needs standard-scheme
// privileges so the renderer keeps ordinary web security semantics.
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);

/** Serve the built renderer over the custom bundle protocol — never file://
 *  (docs/principles/stack/electron/security.md). Paths are resolved against
 *  the renderer output and containment-checked against traversal. */
function registerBundleProtocol(): void {
  const rendererRoot = path.join(__dirname, '../renderer');
  protocol.handle(APP_SCHEME, (request) => {
    const { pathname } = new URL(request.url);
    const requested = pathname === '/' ? '/index.html' : decodeURIComponent(pathname);
    const target = path.resolve(rendererRoot, `.${requested}`);
    if (!isContainedPath(rendererRoot, target, path.sep)) {
      return new Response('Not found', { status: 404 });
    }
    return net.fetch(pathToFileURL(target).toString());
  });
}

/** Global policy, registered before any window exists. */
function applySecurityPolicy(): void {
  // Permission requests (camera, microphone, geolocation, ...) are denied by
  // default — in a desktop app, content that asks unexpectedly is the attack.
  // Grant individual permissions here only as a recorded product decision
  // (docs/principles/stack/electron/security.md).
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => {
      callback(false);
    },
  );

  app.on('web-contents-created', (_event, contents) => {
    // Navigation away from app content is blocked outright.
    contents.on('will-navigate', (event, url) => {
      if (!isTrustedNavigationTarget(url, DEV_SERVER_URL)) {
        event.preventDefault();
      }
    });
    // window.open never creates an Electron window: allowlisted https links
    // are handed to the OS browser; everything else is dropped.
    contents.setWindowOpenHandler(({ url }) => {
      if (isAllowedExternalUrl(url)) {
        void shell.openExternal(url);
      }
      return { action: 'deny' };
    });
  });
}

function broadcastTheme(window: BrowserWindow): void {
  window.webContents.send('theme:changed', {
    shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
  });
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1080,
    height: 720,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      // The hardened quartet. These are Electron's own defaults, restated so
      // no code path, flag, or debugging session ever loosens them — the
      // controls fail as a set, not individually
      // (docs/principles/stack/electron/security.md).
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  window.on('ready-to-show', () => window.show());
  // Initial theme push once the renderer can receive it; updates are
  // broadcast from the nativeTheme listener below.
  window.webContents.on('did-finish-load', () => broadcastTheme(window));

  if (DEV_SERVER_URL) {
    void window.loadURL(DEV_SERVER_URL);
  } else {
    void window.loadURL(`${APP_ORIGIN}/`);
  }
  return window;
}

// Squirrel.Windows ties notifications and shortcuts to the AppUserModelID
// (docs/principles/stack/electron/packaging-and-updates.md).
if (process.platform === 'win32') {
  app.setAppUserModelId('<%= appId %>');
}

void app.whenReady().then(() => {
  if (!DEV_SERVER_URL) {
    registerBundleProtocol();
  }
  applySecurityPolicy();
  registerIpcHandlers(DEV_SERVER_URL);

  // nativeTheme is the source of truth for dark mode; the renderer mirrors it
  // onto <html data-theme> from this broadcast.
  nativeTheme.on('updated', () => {
    for (const window of BrowserWindow.getAllWindows()) {
      broadcastTheme(window);
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
