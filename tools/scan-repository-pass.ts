import path from 'node:path';

import { saveRepositoryPassState } from '@/infrastructure/scan/repository-pass-files';
import type {
  RepositoryPassPlan,
  RepositoryPassState,
} from '@/infrastructure/scan/repository-pass-state';
import type { ScanScope } from '@/infrastructure/scan/scan-scope';

import { repositoryPassArguments } from './scan-repository-pass-args';
import {
  passAnalysisDigest,
  prepareRepositoryPass,
  type PassInput,
} from './scan-repository-pass-plan';
import { passFileExists } from './scan-repository-pass-presence';
import {
  publishRepositoryPassReport,
  resumeRepositoryPass,
} from './scan-repository-pass-publication';
import { runRepositoryPassTask } from './scan-repository-pass-task';

async function checkpointTask(input: {
  readonly run: PassInput;
  readonly plan: RepositoryPassPlan;
  readonly state: RepositoryPassState;
  readonly scope: ScanScope;
}): Promise<RepositoryPassState> {
  let state: RepositoryPassState = { ...input.state, status: 'running', failure: null };
  await saveRepositoryPassState(input.run.output, state);
  try {
    if (passAnalysisDigest(input.plan, input.run) !== input.plan.analysisDigest) {
      throw new Error('Analysis changed during the pinned pass. Start a new immutable run.');
    }
    const task = await runRepositoryPassTask({
      plan: input.plan,
      scope: input.scope,
      run: input.run,
    });
    state = { ...state, completed: [...state.completed, task] };
    await saveRepositoryPassState(input.run.output, state);
    return state;
  } catch (error) {
    state = {
      ...state,
      status: 'failed',
      failure: {
        scope: input.scope.id,
        message: error instanceof Error ? error.message : 'Source task failed.',
        code: errorCode(error),
      },
    };
    await saveRepositoryPassState(input.run.output, state);
    throw error;
  }
}
function errorCode(error: unknown): string | null {
  return error instanceof Error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : null;
}

/** One pinned repository, one deterministic source pass; interpretation and acceptance are separate. */
export async function scanRepositoryPass(args: readonly string[]): Promise<void> {
  const input = repositoryPassArguments(args);
  const loaded =
    input.values.resume === true
      ? await resumeRepositoryPass(input)
      : await prepareRepositoryPass(input.run);
  const { plan } = loaded;
  let state = loaded.state;
  let executed = 0;
  for (const scope of plan.scopes.slice(state.completed.length)) {
    if (
      executed >= input.stopAfter ||
      (await passFileExists(path.join(input.run.output, 'STOP')))
    ) {
      state = { ...state, status: 'stopped', failure: null };
      await saveRepositoryPassState(input.run.output, state);
      console.log(
        JSON.stringify({
          status: 'stopped',
          completed: state.completed.length,
          remaining: plan.scopes.length - state.completed.length,
        }),
      );
      return;
    }
    state = await checkpointTask({ run: input.run, plan, state, scope });
    executed += 1;
  }
  if (passAnalysisDigest(plan, input.run) !== plan.analysisDigest) {
    throw new Error('Analysis changed before aggregate publication.');
  }
  const reportDigest = await publishRepositoryPassReport({ run: input.run, plan, state });
  await saveRepositoryPassState(input.run.output, {
    ...state,
    status: 'source_complete',
    reportDigest,
    failure: null,
  });
  console.log(
    JSON.stringify({
      status: 'source_complete',
      semanticAcceptance: 'not_established',
      interpretation: 'pending',
      repo: plan.repo,
      commit: plan.commit,
    }),
  );
}

if (process.argv[1] === import.meta.filename) await scanRepositoryPass(process.argv.slice(2));
