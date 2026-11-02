import { describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import { extractLocalFacts } from '@/infrastructure/scan/local-facts';
import { indexSource } from '@/infrastructure/scan/source-index';

import { evaluateGoDepth } from './scan-depth-go';
import { evaluateSpringDepth } from './scan-depth-spring';
import { namedFunction, semanticGraph } from './scan-semantic-query';

vi.mock(import('server-only'), () => ({}));
const JAVA = process.env.GROUNDWORK_TEST_JAVA ?? 'java';

function graphOf(content: string, language: 'java' | 'go') {
  const index = indexSource({
    content,
    language,
    path: language === 'java' ? 'A.java' : 'a.go',
    java: JAVA,
  });
  expect(index.diagnostics).toEqual([]);
  const facts = extractLocalFacts(index, {
    host: 'host:test',
    repo: 'fixture/repo',
    commit: 'a'.repeat(40),
  });
  return semanticGraph({
    ...scanFixture(),
    semantic: [...(facts.semantic ?? [])],
    summaries: [...facts.summaries],
    sources: [...facts.sources],
  });
}

function spring(content: string, id: string) {
  const graph = graphOf(content, 'java');
  return evaluateSpringDepth(graph, namedFunction(graph, 'saveAndPostProcess')?.owner ?? '', id);
}

function go(content: string, id: string, symbol = 'create') {
  const graph = graphOf(content, 'go');
  return evaluateGoDepth(graph, namedFunction(graph, symbol)?.owner ?? '', id);
}

describe.runIf(process.env.GROUNDWORK_NATIVE_PARSERS === '1')(
  'independent native semantic acceptance',
  () => {
    it('requires actual rebound save values at post-processing and return', () => {
      const source =
        'class A { Object saveAndPostProcess(Object previousCustomer, Object updatedCustomer) { customerValidatorService.validate(updatedCustomer); updatedCustomer = customerRepository.save(updatedCustomer); savePostProcessor.postProcess(previousCustomer, updatedCustomer); return updatedCustomer; } }';
      expect(spring(source, 'spring-rebound-save-result')?.status).toBe('supported');
      const changed = source.replace(
        'updatedCustomer = customerRepository',
        'other = customerRepository',
      );
      expect(spring(changed, 'spring-rebound-save-result')?.status).toBe('failed');
    }, 30_000);

    it('rejects typed SQL column binding swaps even when the literal remains present', () => {
      const source =
        'package a; func create(ctx Ctx, tx Tx, policyRuleset Row) error { _,err := tx.Exec(ctx, `INSERT INTO policy_rulesets (pno12,model_year,spec_market,local_edition_code,policy_id,rule_set_path) VALUES ($1,$2,$3,$4,$5,$6)`, policyRuleset.Car.Pno12.String(),policyRuleset.Car.ModelYear,policyRuleset.Car.SpecMarket,policyRuleset.Car.LocalEditionCode,policyRuleset.PolicyID,policyRuleset.RulesetPath); return err }';
      expect(go(source, 'go-sql-positional-bindings')?.status).toBe('supported');
      const graph = graphOf(source, 'go');
      const changedEdges = (graph.document.semantic ?? []).map((record) =>
        record.kind === 'semantic_edge' &&
        record.relation === 'column_binding' &&
        record.position === 1
          ? { ...record, position: 2 }
          : record,
      );
      const changed = semanticGraph({ ...graph.document, semantic: changedEdges });
      expect(
        evaluateGoDepth(
          changed,
          namedFunction(changed, 'create')?.owner ?? '',
          'go-sql-positional-bindings',
        )?.status,
      ).toBe('failed');
    }, 30_000);

    it('rejects a changed typed guard while the original syntax is retained', () => {
      const graph = graphOf(
        'class A { Object publishAnalyticsEvent(Object previous, Object updated) { if (kafkaTemplate == null || !settings.enabled()) return CompletableFuture.completedFuture(null); return kafkaTemplate.send(message); } }',
        'java',
      );
      const owner = namedFunction(graph, 'publishAnalyticsEvent')?.owner ?? '';
      expect(evaluateSpringDepth(graph, owner, 'spring-disabled-publication')?.status).toBe(
        'supported',
      );
      const semantic = (graph.document.semantic ?? []).map((record) =>
        record.kind === 'semantic_node' && record.nodeKind === 'binary' && record.operator === '||'
          ? { ...record, operator: '&&' }
          : record,
      );
      expect(
        evaluateSpringDepth(
          semanticGraph({ ...graph.document, semantic }),
          owner,
          'spring-disabled-publication',
        )?.status,
      ).toBe('failed');
    }, 30_000);

    it('rejects discarded Begin and InsertTx errors even when err guards remain', () => {
      const source =
        'package a; func Enqueue(ctx Ctx, job Job) error { tx,err := c.dbPool.GetPgxPool().Begin(ctx); if err != nil { return err }; defer rollback(ctx,tx,c.logger); if _,err := c.client.InsertTx(ctx,tx,job,nil); err != nil {return err}; return tx.Commit(ctx) }';
      const check = 'go-insert-before-commit';
      expect(go(source, check, 'Enqueue')?.status).toBe('supported');
      const beginDiscarded = source.replace(
        'tx,err := c.dbPool.GetPgxPool().Begin(ctx);',
        'tx,_ := c.dbPool.GetPgxPool().Begin(ctx); err := error(nil);',
      );
      expect(go(beginDiscarded, check, 'Enqueue')?.status).toBe('failed');
      const insertDiscarded = source.replace(
        'if _,err := c.client.InsertTx',
        'if _,_ = c.client.InsertTx',
      );
      expect(go(insertDiscarded, check, 'Enqueue')?.status).toBe('failed');
    }, 30_000);

    it('requires wrapped Commit errors to retain the guarded actual binding', () => {
      const source = `package a;
      func create(ctx Ctx, tx Tx, policyRuleset Row) error { _,err := tx.Exec(ctx, "INSERT"); if err != nil { return errors.Wrap(err,0) }; return nil }
      func update(ctx Ctx, tx Tx, policyRuleset Row) error { _,err := tx.Exec(ctx, "UPDATE"); if err != nil { return errors.Wrap(err,0) }; return nil }
      func Upsert(ctx Ctx, policyRuleset Row) error { tx,err := r.pool.Begin(ctx); if err != nil {return err}; if err := r.upsert(ctx,tx,policyRuleset); err != nil {return err}; if err := tx.Commit(ctx); err != nil {return errors.Wrap(err,0)}; return nil }
    `;
      const check = 'go-staged-versus-committed';
      expect(go(source, check)?.status).toBe('supported');
      const changed = source.replace(
        'if err := tx.Commit(ctx); err != nil {return errors.Wrap(err,0)}',
        'if err := tx.Commit(ctx); err != nil {err := error(nil); return errors.Wrap(err,0)}',
      );
      expect(go(changed, check)?.status).toBe('failed');
    }, 30_000);

    it('requires defer after the Begin error branch and an actual returned Commit result', () => {
      const source =
        'package a; func Enqueue(ctx Ctx, job Job) error { tx,err := c.dbPool.GetPgxPool().Begin(ctx); if err != nil { return err }; defer rollback(ctx,tx,c.logger); if _,err := c.client.InsertTx(ctx,tx,job,nil); err != nil {return err}; return tx.Commit(ctx) }';
      expect(go(source, 'go-insert-before-commit', 'Enqueue')?.status).toBe('supported');
      const changed = source.replace(
        'if err != nil { return err }; defer rollback(ctx,tx,c.logger);',
        'defer rollback(ctx,tx,c.logger); if err != nil { return err };',
      );
      expect(go(changed, 'go-insert-before-commit', 'Enqueue')?.status).toBe('failed');
    }, 30_000);
  },
);
