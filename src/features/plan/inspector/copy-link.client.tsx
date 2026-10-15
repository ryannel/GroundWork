'use client';

import { useState } from 'react';

import { Button } from '@/ui/button';

const COPIED_MS = 1600;

/** Puts the address of what is open on the clipboard. */
export function CopyLink({ label }: { readonly label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = (): void => {
    void navigator.clipboard.writeText(globalThis.location.href).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, COPIED_MS);
    });
  };
  return (
    <Button label={label} onClick={copy} size="sm" variant="ghost">
      {copied ? 'Copied' : 'Copy link'}
    </Button>
  );
}
