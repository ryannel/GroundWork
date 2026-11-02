import type { Metadata } from 'next';
import { Instrument_Sans, Inter, JetBrains_Mono } from 'next/font/google';
import { connection } from 'next/server';
import type { ReactNode } from 'react';

import './globals.css';

const instrument = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' });

// Applies the stored theme before the first paint, so a chosen theme never flashes the other one.
const themeScript = `try{var t=localStorage.getItem('groundwork.theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export const metadata: Metadata = {
  title: { default: 'Groundwork', template: '%s · Groundwork' },
  description: 'The systems a company runs, and the plans that change them.',
};

// Every page is drawn on request, so an edit to a workspace's YAML shows on the next load; the readers keep what
// they work out until a file changes.
export default async function RootLayout({ children }: { readonly children: ReactNode }) {
  await connection();
  return (
    <html
      className={`${instrument.variable} ${inter.variable} ${jetbrains.variable}`}
      lang="en-GB"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
