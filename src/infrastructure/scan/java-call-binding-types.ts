import 'server-only';

import type { JavaMethod, JavaType, JavaUnit } from './java-declarations';
import type { SourceIndex, SyntaxNode } from './source-index-types';

export interface CallBinding {
  readonly kind: 'java_call_binding';
  readonly id: string;
  readonly call: string;
  readonly caller: string | null;
  readonly receiver: string | null;
  readonly receiverType: string | null;
  readonly methodName: string;
  readonly argumentTypes: readonly (string | null)[];
  readonly target: string | null;
  readonly signature: string | null;
  readonly resolution: 'exact' | 'unresolved';
  readonly reason: string;
  readonly guards: readonly string[];
}
export interface ValueBinding {
  readonly kind: 'java_value_binding';
  readonly id: string;
  readonly relation:
    | 'argument_parameter'
    | 'return_call'
    | 'initializer'
    | 'assignment'
    | 'field_projection'
    | 'reference';
  readonly from: string;
  readonly to: string;
  readonly call: string | null;
  readonly guards: readonly string[];
}
export interface JavaBindingContext {
  readonly index: SourceIndex;
  readonly unit: JavaUnit;
  readonly units: readonly JavaUnit[];
}
export interface JavaMethodTarget {
  readonly unit: JavaUnit;
  readonly owner: JavaType;
  readonly method: JavaMethod;
  readonly parameters: readonly string[];
  readonly returnType: string;
}
export interface JavaCallSite {
  readonly node: SyntaxNode;
  readonly receiver: SyntaxNode | null;
  readonly receiverType: string | null;
  readonly methodName: string;
  readonly arguments: readonly SyntaxNode[];
}
