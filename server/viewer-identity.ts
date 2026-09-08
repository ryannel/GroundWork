import { configRoot } from './registry.ts'
import { digest, context } from './git.ts'

export const viewerIdentity = async (root?: string) => ({
  service: 'groundwork-viewer', protocol: 1,
  mode: root ? 'standalone' : 'central',
  registry: digest(configRoot()),
  checkoutId: root ? (await context(root)).checkoutId : null,
})

