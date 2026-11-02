import path from 'node:path';

import type { RepositoryReadinessInput } from '@/domain/scan/repository-readiness-types';
import {
  parseReadinessFiles,
  type RepositoryReadinessFiles,
} from '@/infrastructure/scan/readiness-input';
import {
  passArtifactDigest,
  repositoryPassJson,
} from '@/infrastructure/scan/repository-pass-files';

import {
  readinessBenchmark,
  readinessScopeExpectations,
  verifyReadinessBenchmark,
} from './scan-readiness-benchmark';
import { readReadinessInterpretation } from './scan-readiness-interpretation';
import { readReadinessQuestions } from './scan-readiness-questions';
import { verifyReadinessRegression } from './scan-readiness-regression';
import { readinessSource } from './scan-readiness-source';
import { readinessWorkflow } from './scan-readiness-workflow';

const FROZEN_QUESTIONS_SHA = '9653231e9f2163b571334e4b61b71811adb3da1374836d6c14c72b950834befe';

export async function loadReadinessFiles(filename: string): Promise<RepositoryReadinessFiles> {
  const manifest = parseReadinessFiles(await repositoryPassJson(filename));
  const directory = path.dirname(path.resolve(filename));
  return {
    ...manifest,
    repositoryReport: path.resolve(directory, manifest.repositoryReport),
    benchmarkReport: path.resolve(directory, manifest.benchmarkReport),
    questionReview: path.resolve(directory, manifest.questionReview),
    frozenQuestionReview: path.resolve(directory, manifest.frozenQuestionReview),
    catalogue: path.resolve(directory, manifest.catalogue),
    queries: manifest.queries.map((file) => path.resolve(directory, file)),
    workflowTests: path.resolve(directory, manifest.workflowTests),
    regressionReceipt: path.resolve(directory, manifest.regressionReceipt),
    nativeReplay: path.resolve(directory, manifest.nativeReplay),
    interpretation: path.resolve(directory, manifest.interpretation),
    interpretationInputs: path.resolve(directory, manifest.interpretationInputs),
  };
}

export async function loadReadinessEvidence(
  files: RepositoryReadinessFiles,
): Promise<Omit<RepositoryReadinessInput, 'catalogue'>> {
  const frozenDigest = await passArtifactDigest(
    path.dirname(files.frozenQuestionReview),
    path.basename(files.frozenQuestionReview),
  );
  if (frozenDigest !== FROZEN_QUESTIONS_SHA) {
    throw new Error('The independent frozen question/evidence oracle changed.');
  }
  const source = await readinessSource(files.repositoryReport);
  const questions = await readReadinessQuestions({
    review: files.questionReview,
    frozen: files.frozenQuestionReview,
  });
  if (questions.repo !== source.repo || questions.commit !== source.commit) {
    throw new Error('Question review does not belong to the current source pass.');
  }
  await verifyReadinessRegression({
    regression: files.regressionReceipt,
    native: files.nativeReplay,
    source: files.repositoryReport,
  });
  const benchmark = await repositoryPassJson(files.benchmarkReport);
  await verifyReadinessBenchmark(benchmark);
  return {
    expectations: {
      repo: source.repo,
      commit: source.commit,
      scopeChecks: readinessScopeExpectations(),
      questionIds: questions.questionIds,
    },
    questions: questions.questions,
    benchmark: readinessBenchmark(benchmark),
    workflow: readinessWorkflow(await repositoryPassJson(files.workflowTests), files.workflowTests),
    budgetStatus: 'within_bounds',
    sourceUsage: source.usage,
    interpretation: await readReadinessInterpretation(
      files.interpretation,
      files.interpretationInputs,
      path.join(files.catalogue, 'metadata.json'),
    ),
  };
}
