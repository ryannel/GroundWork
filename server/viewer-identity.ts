import { configRoot } from './registry.ts'
import { digest } from './git.ts'

export const viewerIdentity = async () => ({
  service: 'groundwork-viewer', protocol: 1, mode: 'central', registry: digest(configRoot()),
})
