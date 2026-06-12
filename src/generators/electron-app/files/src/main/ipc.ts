import { app, ipcMain, shell } from 'electron';
import { z } from 'zod';
import type { AppStatus, CoreHealth, OpenExternalResult } from '../shared/ipc';
import { fetchCoreHealth } from './core-client';
import { isAllowedExternalUrl, isTrustedSender } from './policy';

// Main treats renderer input as untrusted, the same way an API treats the
// public internet. Two checks in every handler: sender validation
// (event.senderFrame — checklist item 17), and zod payload validation for
// anything beyond a trivial getter, because compile-time types vanish at
// runtime and a compromised renderer is not bound by them
// (docs/principles/stack/electron/ipc-contracts.md).

const openExternalPayload = z.string().url();

function assertTrustedSender(
  event: Electron.IpcMainInvokeEvent,
  devServerUrl?: string,
): void {
  if (!isTrustedSender(event.senderFrame?.url, devServerUrl)) {
    throw new Error('IPC call rejected: untrusted sender frame');
  }
}

export function registerIpcHandlers(devServerUrl?: string): void {
  ipcMain.handle('app:get-status', (event): AppStatus => {
    assertTrustedSender(event, devServerUrl);
    return {
      status: 'ok',
      version: app.getVersion(),
      platform: process.platform,
    };
  });

  ipcMain.handle('core:health', async (event): Promise<CoreHealth> => {
    assertTrustedSender(event, devServerUrl);
    return fetchCoreHealth();
  });

  ipcMain.handle(
    'shell:open-external',
    async (event, rawUrl: unknown): Promise<OpenExternalResult> => {
      assertTrustedSender(event, devServerUrl);
      const url = openExternalPayload.parse(rawUrl);
      if (!isAllowedExternalUrl(url)) {
        return { opened: false };
      }
      await shell.openExternal(url);
      return { opened: true };
    },
  );
}
