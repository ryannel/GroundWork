import { RootProvider } from 'fumadocs-ui/provider';
import 'fumadocs-ui/style.css';
<% if (branded) { %>import './brand.css';
import './docs.css';
<% } %><% if (bodyFont) { %>import { <%= bodyFont.replace(/[^A-Za-z0-9]/g, '_') %> } from 'next/font/google';
<% } else { %>import { Inter } from 'next/font/google';
<% } %>import type { ReactNode } from 'react';

<% if (bodyFont) { %>const brandFont = <%= bodyFont.replace(/[^A-Za-z0-9]/g, '_') %>({
  subsets: ['latin'],
});
<% } else { %>const inter = Inter({
  subsets: ['latin'],
});
<% } %>
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={<% if (bodyFont) { %>brandFont.className<% } else { %>inter.className<% } %>} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
