import type { Operation } from '@/domain/scan/scan.generated';

import {
  ambiguousControl,
  argumentsMatch,
  branch,
  call,
  compact,
  ordered,
  result,
  returnsValue,
  unresolved,
  type Call,
  type DepthContext,
  type DepthResult,
} from './scan-benchmark-depth-facts';

function equalBranch(context: DepthContext): DepthResult {
  const guard = branch(context, 'updatedCustomer.equals(previousCustomer)');
  if (guard?.kind !== 'control') {
    return result(context, 'failed', {
      evidence: [],
      reason: 'Required structured equality branch is absent.',
    });
  }
  if (ambiguousControl(context, guard)) {
    return unresolved(
      context,
      'Additional control or opaque operations prevent proving branch reachability.',
      [guard],
    );
  }
  const selectedReturn = context.summary?.operations.find(
    (operation) =>
      guard.consequent.includes(operation.id) && returnsValue(operation, 'updatedCustomer'),
  );
  const validate = call(context, 'customerValidatorService.validate');
  const save = call(context, 'customerRepository.save');
  const post = call(context, 'savePostProcessor.postProcess');
  if (!selectedReturn || !validate || !save || !post) {
    return result(context, 'failed', {
      evidence: [guard],
      reason: 'Equality return or changed-customer callsites were omitted.',
    });
  }
  const calls = [validate, save, post];
  if (
    !guard.predicate.polarity ||
    calls.some((operation) => guard.consequent.includes(operation.id)) ||
    !ordered(context, [guard, selectedReturn, ...calls])
  ) {
    return result(context, 'failed', {
      evidence: [guard, selectedReturn, ...calls],
      reason: 'Writes/post-processing must follow the equality branch early return.',
    });
  }
  return result(context, 'supported', {
    evidence: [guard, selectedReturn, ...calls],
    reason: 'Structured equality branch returns before the three later callsites.',
  });
}

function reboundSave(context: DepthContext): DepthResult {
  const validate = call(context, 'customerValidatorService.validate');
  const save = call(context, 'customerRepository.save');
  const post = call(context, 'savePostProcessor.postProcess');
  if (!validate || !save || !post) {
    return result(context, 'failed', {
      evidence: [],
      reason: 'Required validate/save/post-process call missing.',
    });
  }
  const calls = [validate, save, post];
  if (
    !argumentsMatch(validate, ['updatedCustomer']) ||
    !argumentsMatch(save, ['updatedCustomer']) ||
    !argumentsMatch(post, ['previousCustomer', 'updatedCustomer']) ||
    !ordered(context, calls)
  ) {
    return result(context, 'failed', {
      evidence: calls,
      reason: 'Call order or actual arguments differ from the frozen contract.',
    });
  }
  return unresolved(
    context,
    'Actuals and order retained, but no structured assignment/reaching-value relation binds the save result to later updatedCustomer.',
    calls,
  );
}

function invalidReturnPlacement(
  context: DepthContext,
  guard: Extract<Operation, { readonly kind: 'control' }>,
  handled: Operation,
): boolean {
  return (
    guard.consequent.includes(handled.id) ||
    context.summary?.operations.some((operation) => operation.kind === 'throw') === true
  );
}
function returnedHandle(context: DepthContext): Call | undefined {
  const invocation = call(context, 'handler.(commandHandler[C]).Handle');
  return invocation &&
    argumentsMatch(invocation, ['ctx', 'cmd']) &&
    invocation.waiting === 'returned'
    ? invocation
    : undefined;
}

function ordinaryError(context: DepthContext): DepthResult {
  const guard = branch(context, '!ok');
  if (guard?.kind !== 'control') {
    return result(context, 'failed', { evidence: [], reason: 'Missing-key branch is absent.' });
  }
  if (!guard.predicate.polarity) {
    return result(context, 'failed', {
      evidence: [guard],
      reason: 'Missing-key predicate polarity is reversed.',
    });
  }
  if (ambiguousControl(context, guard)) {
    return unresolved(
      context,
      'Additional control or opaque operations prevent proving return reachability.',
      [guard],
    );
  }
  const missing = context.summary?.operations.find(
    (operation) =>
      guard.consequent.includes(operation.id) &&
      returnsValue(operation, 'errors.New("no handler found for command")'),
  );
  const handled = context.summary?.operations.find((operation) =>
    returnsValue(operation, 'handler.(commandHandler[C]).Handle(ctx, cmd)'),
  );
  if (!missing || !handled || invalidReturnPlacement(context, guard, handled)) {
    return result(context, 'failed', {
      evidence: [guard],
      reason: 'Ordinary error returns were omitted or replaced by thrown faults.',
    });
  }
  const invocation = returnedHandle(context);
  if (!invocation) {
    return result(context, 'failed', {
      evidence: [guard, missing, handled],
      reason: 'Returned Handle error invocation/actuals are not preserved.',
    });
  }
  return result(context, 'supported', {
    evidence: [guard, missing, handled, invocation],
    reason: 'Both errors are normal returned values; no business success is inferred.',
  });
}

function sqlBindings(context: DepthContext): DepthResult {
  const invocation = call(context, 'tx.Exec');
  if (!invocation) {
    return result(context, 'failed', { evidence: [], reason: 'INSERT callsite is absent.' });
  }
  const fields = [
    'policyRuleset.Car.Pno12.String()',
    'policyRuleset.Car.ModelYear',
    'policyRuleset.Car.SpecMarket',
    'policyRuleset.Car.LocalEditionCode',
    'policyRuleset.PolicyID',
    'policyRuleset.RulesetPath',
  ];
  if (
    invocation.arguments.length !== 8 ||
    compact(invocation.arguments[0] ?? '') !== 'ctx' ||
    !invocation.arguments
      .slice(2)
      .every((argument, index) => compact(argument) === compact(fields[index] ?? ''))
  ) {
    return result(context, 'failed', {
      evidence: [invocation],
      reason: 'Six SQL actual arguments are missing, reordered or bound to different expressions.',
    });
  }
  return unresolved(
    context,
    'Positional actuals retained; typed SQL column-to-parameter mapping is absent.',
    [invocation],
  );
}

function registry(context: DepthContext): DepthResult {
  const invocation = call(context, 'handler.(commandHandler[C]).Handle');
  if (invocation?.target.state === 'supported') {
    return result(context, 'failed', {
      evidence: [invocation],
      reason: 'A concrete target is asserted without a structured registry/type/context receipt.',
    });
  }
  return unresolved(
    context,
    'Registry mutation, generic key and invocation context bindings are absent.',
    invocation ? [invocation] : [],
  );
}

export function evaluateLegacyDepth(context: DepthContext): DepthResult {
  if (!context.summary) {
    return unresolved(context, 'Named question root has no selected structured local summary.');
  }

  switch (context.id) {
    case 'spring-equal-branch': {
      return equalBranch(context);
    }
    case 'spring-rebound-save-result': {
      return reboundSave(context);
    }
    case 'go-error-not-throw': {
      return ordinaryError(context);
    }
    case 'go-sql-positional-bindings': {
      return sqlBindings(context);
    }
    case 'go-contextual-registry': {
      return registry(context);
    }
    default: {
      return unresolved(
        context,
        'Required action/value/effect/transaction/catch/completion relations are not established by this IR.',
        context.summary.operations,
      );
    }
  }
}
