import {
  formatFiles,
  generateFiles,
  Tree,
} from '@nx/devkit';
import * as path from 'path';

export interface SystemTestRunnerGeneratorSchema {
  projectPrefix?: string;
}

export async function systemTestRunnerGenerator(
  tree: Tree,
  options: SystemTestRunnerGeneratorSchema
) {
  const projectPrefix = options.projectPrefix || 'groundwork';

  // Generate files into the workspace root
  generateFiles(
    tree,
    path.join(__dirname, '..', '..', '..', '..', 'src', 'generators', 'system-test-runner', 'files'),
    '.',
    {
      ...options,
      projectPrefix,
      tmpl: ''
    }
  );

  await formatFiles(tree);
}

export default systemTestRunnerGenerator;
