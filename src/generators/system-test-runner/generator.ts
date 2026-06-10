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

  // Playwright structure ships only with a graphical UI: the page-object
  // package and the axe-core a11y smoke depend on pytest-playwright, which
  // the pyproject template declares only for graphical-ui.
  if (interfaceMedium !== 'graphical-ui') {
    tree.delete('tests/system/pages');
    tree.delete('tests/system/test_a11y_smoke.py');
  }

  await formatFiles(tree);
}

export default systemTestRunnerGenerator;
