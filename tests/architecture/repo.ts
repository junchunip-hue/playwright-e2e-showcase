import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { parse } from 'yaml';

/** Helpers for the architecture tests: read pipeline/source files and find cycles. No browser, no network. */

export const ROOT = resolve(__dirname, '..', '..');

export const rel = (path: string): string => relative(ROOT, path).replace(/\\/g, '/');

export function filesUnder(dir: string, match: (name: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : filesUnder(path, match);
    return match(entry.name) ? [path] : [];
  });
}

export interface Step {
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, unknown>;
}

export interface Job {
  'timeout-minutes'?: number;
  if?: string;
  permissions?: Record<string, string>;
  steps?: Step[];
}

export interface Workflow {
  file: string;
  name: string;
  on: Record<string, unknown>;
  concurrency?: { group?: string; 'cancel-in-progress'?: boolean };
  jobs: Record<string, Job>;
}

export interface CompositeAction {
  file: string;
  /** Path as referenced from a workflow, e.g. ./.github/actions/toolshop-start */
  ref: string;
  steps: Step[];
}

export function workflows(): Workflow[] {
  return filesUnder(join(ROOT, '.github', 'workflows'), (n) => /\.ya?ml$/.test(n)).map((file) => {
    const doc = parse(readFileSync(file, 'utf8'));
    // `on: push` (string) and `on: [a, b]` (list) are normalised to an object.
    const on = typeof doc.on === 'string' ? { [doc.on]: {} } : Array.isArray(doc.on) ? Object.fromEntries(doc.on.map((e: string) => [e, {}])) : doc.on ?? {};
    return { file: rel(file), name: doc.name ?? rel(file), on, concurrency: doc.concurrency, jobs: doc.jobs ?? {} };
  });
}

export function compositeActions(): CompositeAction[] {
  return filesUnder(join(ROOT, '.github', 'actions'), (n) => n === 'action.yml' || n === 'action.yaml').map((file) => {
    const doc = parse(readFileSync(file, 'utf8'));
    return { file: rel(file), ref: `./${rel(dirname(file))}`, steps: doc.runs?.steps ?? [] };
  });
}

/** Every step of every job and composite action, with where it lives. */
export function allSteps(): { where: string; step: Step }[] {
  return [
    ...workflows().flatMap((w) =>
      Object.entries(w.jobs).flatMap(([id, job]) => (job.steps ?? []).map((step) => ({ where: `${w.file} › ${id}`, step }))),
    ),
    ...compositeActions().flatMap((a) => a.steps.map((step) => ({ where: a.file, step }))),
  ];
}

/**
 * Ways a workflow that pushes commits could re-trigger itself. Empty when safe:
 * - only triggers a push cannot fire (no push / workflow_run / repository_dispatch),
 * - checkout keeps GITHUB_TOKEN (its pushes never start workflow runs; a personal token's would),
 * - a label-triggered job removes its own label (otherwise every label event runs it again),
 * - a concurrency group, so two runs never push to the same branch at once.
 */
export function pushesCommits(w: Workflow): boolean {
  return Object.values(w.jobs).some((j) => (j.steps ?? []).some((s) => /\bgit\s+push\b/.test(s.run ?? '')));
}

export function selfTriggerRisks(w: Workflow): string[] {
  if (!pushesCommits(w)) return [];
  const steps = Object.values(w.jobs).flatMap((j) => j.steps ?? []);

  const problems: string[] = [];
  const loopingTriggers = Object.keys(w.on).filter((t) => ['push', 'workflow_run', 'repository_dispatch'].includes(t));
  if (loopingTriggers.length) problems.push(`${w.file}: pushes but is triggered by ${loopingTriggers.join(', ')}`);

  for (const s of steps.filter((s) => s.uses?.startsWith('actions/checkout'))) {
    if (String(s.with?.token ?? '').includes('secrets.')) problems.push(`${w.file}: checkout uses a custom token`);
  }

  const labelTypes = (w.on.pull_request as { types?: string[] } | undefined)?.types ?? [];
  if (labelTypes.includes('labeled')) {
    for (const [id, job] of Object.entries(w.jobs)) {
      const label = /label\.name\s*==\s*'([^']+)'/.exec(job.if ?? '')?.[1];
      if (!label) problems.push(`${w.file} › ${id}: labeled trigger without a label filter`);
      else if (!(job.steps ?? []).some((s) => (s.run ?? '').includes(`--remove-label ${label}`))) {
        problems.push(`${w.file} › ${id}: does not remove its trigger label "${label}"`);
      }
    }
  }

  if (!w.concurrency?.group) problems.push(`${w.file}: pushes without a concurrency group`);
  return problems;
}

/** Returns one cycle (as a node path ending where it started) or null. Depth-first search with colouring. */
export function findCycle(graph: Map<string, string[]>): string[] | null {
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];

  const visit = (node: string): string[] | null => {
    if (state.get(node) === 'done') return null;
    if (state.get(node) === 'visiting') return [...stack.slice(stack.indexOf(node)), node];
    state.set(node, 'visiting');
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    stack.pop();
    state.set(node, 'done');
    return null;
  };

  for (const node of graph.keys()) {
    const cycle = visit(node);
    if (cycle) return cycle;
  }
  return null;
}
