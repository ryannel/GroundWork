import {
  formatFiles,
  generateFiles,
  Tree,
} from '@nx/devkit';
import * as path from 'path';

export interface SystemTestRunnerGeneratorSchema {
  projectPrefix?: string;
  interfaceMedium?: 'graphical-ui' | 'cli' | 'agentic-protocol';
}

export async function systemTestRunnerGenerator(
  tree: Tree,
  options: SystemTestRunnerGeneratorSchema
) {
  const projectPrefix = options.projectPrefix || 'groundwork';
  const interfaceMedium = options.interfaceMedium || 'graphical-ui';

  // Generate files into the workspace root
  generateFiles(
    tree,
    path.join(__dirname, '..', '..', '..', '..', 'src', 'generators', 'system-test-runner', 'files'),
    '.',
    {
      ...options,
      projectPrefix,
      interfaceMedium,
      tmpl: ''
    }
  );

  await formatFiles(tree);
}

export default systemTestRunnerGenerator;
