import { archiveBindingErrors, isArchiveBinding } from './check-scan-archive-bindings';
import { clientBindingOwnership, isClientBinding } from './check-scan-client-bindings';
import { eventBindingErrors, isEventBinding } from './check-scan-event-bindings';
import { isMessageBinding, messageBindingErrors } from './check-scan-message-bindings';
import { scanReference, type ScanRecords } from './scan-records';
import type {
  BindingRecord,
  JavaCallBinding,
  JavaValueBinding,
  OutboundBinding,
  ExceptionHandlerBinding,
  ScanDocument,
} from './scan.generated';

interface Context {
  readonly document: ScanDocument;
  readonly records: ScanRecords;
}
function within(records: ScanRecords, innerId: string, outerId: string | null): boolean {
  const inner = scanReference(records, innerId, 'source');
  const outer = scanReference(records, outerId ?? '', 'source');
  if (!inner || !outer) return false;
  const sameFile =
    inner.repo === outer.repo && inner.commit === outer.commit && inner.path === outer.path;
  return sameFile && inner.lines[0] >= outer.lines[0] && inner.lines[1] <= outer.lines[1];
}
function contained(context: Context, record: BindingRecord) {
  return (inner: string, outer: string | null): string[] =>
    within(context.records, inner, outer)
      ? []
      : [`${record.id}: source ${inner} must be within ${outer ?? 'its declared owner'}`];
}
function callErrors(context: Context, record: JavaCallBinding): readonly string[] {
  const errors: string[] = [];
  if (record.caller !== null) {
    errors.push(...contained(context, record)(record.call, record.caller));
  }
  if (record.receiver !== null) {
    errors.push(...contained(context, record)(record.receiver, record.call));
  }
  for (const guard of record.guards) {
    errors.push(...contained(context, record)(record.call, guard));
    if (record.caller !== null) errors.push(...contained(context, record)(guard, record.caller));
  }
  const exact = record.target !== null && record.signature !== null;
  if ((record.resolution === 'exact') !== exact) {
    errors.push(`${record.id}: call resolution must agree with target and signature`);
  }
  if (record.resolution === 'unresolved' && (record.target !== null || record.signature !== null)) {
    errors.push(`${record.id}: unresolved call must have null target and signature`);
  }
  return errors;
}
function targetCall(context: Context, record: JavaValueBinding): JavaCallBinding | undefined {
  return context.document.bindings?.find(
    (candidate): candidate is JavaCallBinding =>
      candidate.kind === 'java_call_binding' &&
      candidate.call === record.call &&
      candidate.resolution === 'exact',
  );
}
function valueErrors(context: Context, record: JavaValueBinding): readonly string[] {
  if (record.relation === 'field_projection') return projectionErrors(context, record);
  const errors = record.guards.flatMap((guard) => contained(context, record)(record.from, guard));
  if (!['argument_parameter', 'return_call'].includes(record.relation)) {
    if (record.call !== null) errors.push(`${record.id}: local value relation must have null call`);
    return errors;
  }
  const call = targetCall(context, record);
  if (call === undefined) {
    return [...errors, `${record.id}: interprocedural value requires an exact call binding`];
  }
  if (call.target === null) {
    return [...errors, `${record.id}: interprocedural value requires an exact call binding`];
  }
  if (record.relation === 'argument_parameter') {
    return [
      ...errors,
      ...contained(context, record)(record.from, call.call),
      ...contained(context, record)(record.to, call.target),
    ];
  }
  if (record.to !== record.call) {
    errors.push(`${record.id}: returned value must target its call source`);
  }
  return [...errors, ...contained(context, record)(record.from, call.target)];
}
function projectionErrors(context: Context, record: JavaValueBinding): readonly string[] {
  const call = context.document.bindings?.find(
    (candidate) => candidate.kind === 'java_call_binding' && candidate.call === record.call,
  );
  const errors = record.guards.flatMap((guard) => contained(context, record)(record.to, guard));
  if (!call || record.to !== record.call) {
    errors.push(`${record.id}: field projection must target its indexed call source`);
  }
  return errors;
}
function outboundErrors(context: Context, record: OutboundBinding): readonly string[] {
  const inside = contained(context, record);
  const local = [
    record.source,
    record.request.method_source,
    record.request.uri_source,
    ...record.request.argument_sources,
    ...record.request.accept_sources,
    ...record.request.body_sources,
    record.response.body_source,
    ...record.response.return_sources,
    ...record.failure_paths.map((failure) => failure.source),
  ];
  return [
    ...local.flatMap((id) => inside(id, record.owner_source)),
    ...record.request.headers.flatMap((header) => [
      ...inside(header.source, record.owner_source),
      ...header.value_sources.flatMap((id) => inside(id, header.source)),
    ]),
    ...record.failure_paths.flatMap((failure) =>
      failure.thrown_source === null ? [] : inside(failure.thrown_source, failure.source),
    ),
    ...(record.response.type_source === null
      ? []
      : inside(record.response.type_source, record.owner_source)),
  ];
}
function exceptionErrors(
  context: Context,
  record: Extract<BindingRecord, { readonly kind: 'exception_binding' }>,
): readonly string[] {
  return [
    ...contained(context, record)(record.throw_source_id, record.throwing_method_source_id),
    ...record.guard_source_ids.flatMap((id) =>
      contained(context, record)(id, record.throwing_method_source_id),
    ),
    ...record.constructor_argument_source_ids.flatMap((id) =>
      contained(context, record)(id, record.throw_source_id),
    ),
    ...record.enclosing_try_source_ids.flatMap((id) =>
      contained(context, record)(record.throw_source_id, id),
    ),
    ...record.candidates.flatMap((candidate) => [
      ...contained(context, record)(candidate.handler_source_id, candidate.advice_source_id),
      ...candidate.response_return_source_ids.flatMap((id) =>
        contained(context, record)(id, candidate.handler_source_id),
      ),
      ...constructionErrors(context, record, candidate),
    ]),
  ];
}
function constructionErrors(
  context: Context,
  record: BindingRecord,
  candidate: ExceptionHandlerBinding,
): readonly string[] {
  const errors: string[] = [];
  const owners = candidate.response_construction_owners;
  for (const source of candidate.response_construction_source_ids) {
    if (owners.filter((owner) => owner.source_id === source).length !== 1) {
      errors.push(`${record.id}: construction source ${source} needs one method owner`);
    }
  }
  for (const owner of owners) {
    if (!candidate.response_construction_source_ids.includes(owner.source_id)) {
      errors.push(
        `${record.id}: construction owner refers to an unlisted source ${owner.source_id}`,
      );
    }
    errors.push(...contained(context, record)(owner.source_id, owner.owner_method_source_id));
    if (owner.owner_method_source_id !== candidate.handler_source_id) {
      const call = context.document.bindings?.find(
        (binding) =>
          binding.kind === 'java_call_binding' &&
          binding.call === owner.source_id &&
          binding.caller === owner.owner_method_source_id,
      );
      if (!call) {
        errors.push(
          `${record.id}: helper construction source ${owner.source_id} requires its indexed caller binding`,
        );
      }
    }
  }
  return errors;
}
export function bindingOwnershipErrors(context: Context, record: BindingRecord): readonly string[] {
  if (isArchiveBinding(record)) {
    return archiveBindingErrors(record, {
      records: context.records,
      inside: contained(context, record),
    });
  }
  if (isMessageBinding(record)) {
    return messageBindingErrors(record, {
      records: context.records,
      inside: contained(context, record),
    });
  }
  if (isEventBinding(record)) {
    return eventBindingErrors(record, {
      records: context.records,
      inside: contained(context, record),
    });
  }
  if (isClientBinding(record)) {
    return clientBindingOwnership(record, contained(context, record));
  }
  if (record.kind === 'java_call_binding') return callErrors(context, record);
  if (record.kind === 'java_value_binding') return valueErrors(context, record);
  if (record.kind === 'outbound_binding') return outboundErrors(context, record);
  if (record.kind === 'exception_binding') return exceptionErrors(context, record);
  if (record.kind === 'mongo_operation_binding') {
    return record.update_fields.flatMap((field) =>
      contained(context, record)(field.source, record.source),
    );
  }
  return [];
}
