import { describe, expect, it, vi } from 'vitest';

import { javaDeclarations } from '@/infrastructure/scan/java-declarations';
import { indexSource } from '@/infrastructure/scan/source-index';

vi.mock(import('server-only'), () => ({}));
const NATIVE = process.env.GROUNDWORK_NATIVE_PARSERS === '1';

describe.skipIf(!NATIVE)('native Java declaration projection', () => {
  it('uses compiler declaration fields for inheritance, annotations, generics and invocations', () => {
    const content = `package fixture;
      import org.springframework.web.bind.annotation.*;
      import jakarta.validation.constraints.NotNull;
      interface Api extends Parent<String> { @PostMapping(path="/things") Box<Thing> create(@RequestBody @NotNull Thing thing); }
      class Box<T> { T value; }
      class Thing { @NotNull String id; }
      class Views { interface Default {} interface Create extends Default {} }
      class Impl implements Api { static final String HEADER="X-Token"; public Box<Thing> create(Thing thing) { if (thing != null) send(thing); return null; } }
      @interface GetMapping {}`;
    const index = indexSource({ path: 'Api.java', language: 'java', content });
    expect(index.diagnostics).toEqual([]);
    const unit = javaDeclarations(index);
    expect(unit?.imports).toContain('org.springframework.web.bind.annotation.*');
    const api = unit?.types.find((type) => type.name === 'Api');
    expect(api?.extends).toEqual(['Parent<String>']);
    expect(api?.methods[0]).toMatchObject({
      returnType: 'Box<Thing>',
      annotations: [
        {
          name: 'org.springframework.web.bind.annotation.PostMapping',
          arguments: { path: '"/things"' },
        },
      ],
      parameters: [
        {
          name: 'thing',
          type: 'Thing',
          annotations: [
            { name: 'org.springframework.web.bind.annotation.RequestBody' },
            { name: 'jakarta.validation.constraints.NotNull' },
          ],
        },
      ],
    });
    expect(unit?.types.find((type) => type.name === 'Box')?.typeParameters).toEqual(['T']);
    expect(unit?.types.find((type) => type.name === 'Create')).toMatchObject({
      qualifiedName: 'fixture.Views.Create',
      extends: ['Default'],
    });
    const implementation = unit?.types.find((type) => type.name === 'Impl');
    expect(implementation?.fields[0]?.modifiers).toContain('static');
    expect(implementation?.methods[0]?.calls).toEqual([
      expect.objectContaining({ callee: 'send', arguments: ['thing'], conditional: true }),
    ]);
  }, 30_000);

  it('keeps fake explicit annotation namespaces and rejects compiler recovery as binding input', () => {
    const index = indexSource({
      path: 'Fake.java',
      language: 'java',
      content:
        'package fixture; import custom.GetMapping; class Fake { @GetMapping("/fake") void get() {} }',
    });
    expect(javaDeclarations(index)?.types[0]?.methods[0]?.annotations[0]?.name).toBe(
      'custom.GetMapping',
    );
    expect(javaDeclarations({ ...index, diagnostics: ['parse error'] })).toBeNull();
  }, 30_000);
  it('keeps a same-file annotation declaration local despite a conflicting explicit import', () => {
    const index = indexSource({
      path: 'Local.java',
      language: 'java',
      content:
        'package fixture; import org.springframework.web.bind.annotation.GetMapping; @interface GetMapping {} class Local { @GetMapping void get() {} }',
    });
    expect(index.diagnostics).toEqual([]);
    const local = javaDeclarations(index)?.types.find((type) => type.name === 'Local');
    expect(local?.methods[0]?.annotations[0]?.name).toBe('fixture.GetMapping');
  }, 30_000);

  it('does not assume a known wildcard wins over an unavailable wildcard namespace', () => {
    const index = indexSource({
      path: 'Ambiguous.java',
      language: 'java',
      content:
        'package fixture; import org.springframework.web.bind.annotation.*; import unavailable.vendor.*; class Ambiguous { @GetMapping void get() {} }',
    });
    expect(index.diagnostics).toEqual([]);
    expect(javaDeclarations(index)?.types[0]?.methods[0]?.annotations[0]?.name).toBe(
      'fixture.GetMapping',
    );
  }, 30_000);
});
