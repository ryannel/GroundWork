'use client';

import { useState } from 'react';

import { Button } from '@/ui/button';

interface CopyButtonProps {
  readonly text: string;
  readonly children: string;
  readonly title?: string;
  readonly variant?: 'default' | 'ghost';
}

/** "Copy as text": puts the text on the clipboard and says so for a moment. */
export function CopyButton({ text, children, title, variant = 'default' }: CopyButtonProps) {
  const [done, setDone] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setDone(true);
      setTimeout(() => {
        setDone(false);
      }, 1500);
    });
  };
  return (
    <Button
      {...(title === undefined ? {} : { label: title })}
      onClick={copy}
      size="sm"
      variant={variant}
    >
      {done ? 'Copied' : children}
    </Button>
  );
}
