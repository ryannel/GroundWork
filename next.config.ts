import type { NextConfig } from 'next';

// A Node server: every page is drawn on request from the YAML of the workspaces it reads (see Next.js in
// docs/architecture.md).
const basePath = process.env.BASE_PATH;

const config: NextConfig = {
  trailingSlash: true,
  reactStrictMode: true,
  typedRoutes: true,
  images: { unoptimized: true },
  ...(basePath === undefined || basePath === '' ? {} : { basePath }),
};

export default config;
