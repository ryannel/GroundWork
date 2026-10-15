import type { NextConfig } from 'next';

// Static export: the site is built from the YAML in workspaces/ and served as files (GitHub Pages).
const basePath = process.env.BASE_PATH;

const config: NextConfig = {
  output: 'export',
  trailingSlash: true,
  reactStrictMode: true,
  typedRoutes: true,
  images: { unoptimized: true },
  ...(basePath === undefined || basePath === '' ? {} : { basePath }),
};

export default config;
