import { defineDocs, defineConfig } from 'fumadocs-mdx/config';

export const { docs, meta } = defineDocs({
  // Direct compile-time access to the pristine root docs directory
  dir: '../../docs',
});

export default defineConfig();
