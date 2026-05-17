import {
  formatFiles,
  generateFiles,
  Tree,
} from '@nx/devkit';
import * as path from 'path';

export interface WorkspaceDevCliGeneratorSchema {
  appName?: string;
  primaryColor?: string;
  hexColor?: string;
}

export default async function (tree: Tree, options: WorkspaceDevCliGeneratorSchema) {
  const projectRoot = '.';

  const templateOptions = {
    ...options,
    appName: options.appName || 'Workspace',
    primaryColor: options.primaryColor || 'BLUE',
    hexColor: options.hexColor || '',
    tmpl: ''
  };

  generateFiles(
    tree,
    path.join(__dirname, '..', '..', '..', '..', 'src', 'generators', 'workspace-dev-cli', 'files'),
    projectRoot,
    templateOptions
  );

  // Make the dev script executable if we can
  if (!tree.exists('dev')) {
    // This is handled by file generation, but we might need to set permissions
    // Nx tree doesn't directly support chmod, but it preserves permissions of the template
    // We will instruct the user to ensure the template is executable.
  }

  await formatFiles(tree);
}
