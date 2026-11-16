import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import config from '../../playwright.config';
import { expect, Tag, test } from '../../src/fixtures';
import { filesUnder, findCycle, rel, ROOT } from './repo';

// Architecture rules for the test code: dependency graphs that a runner or a reader follows must be acyclic.

test.describe('Code architecture', { tag: [Tag.smoke, Tag.architecture] }, () => {
  test('N3: Playwright project dependencies exist and are acyclic', () => {
    const projects = config.projects ?? [];
    const names = new Set(projects.map((p) => p.name));
    const missing = projects.flatMap((p) => (p.dependencies ?? []).filter((d) => !names.has(d)).map((d) => `${p.name} → ${d}`));
    const graph = new Map(projects.map((p) => [p.name ?? '', p.dependencies ?? []]));

    expect(missing, 'unknown dependency projects').toEqual([]);
    expect(findCycle(graph), 'project dependency cycle').toBeNull();
  });

  test('N3: npm scripts do not invoke each other in a cycle', () => {
    const scripts: Record<string, string> = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts;
    const graph = new Map(
      Object.entries(scripts).map(([name, cmd]) => [name, [...cmd.matchAll(/npm\s+run\s+(?:-\S+\s+)*([\w:-]+)/g)].map((m) => m[1])]),
    );

    expect(findCycle(graph), 'npm script cycle').toBeNull();
  });

  test('N3: TypeScript imports between src/ and tests/ are acyclic', () => {
    const files = [...filesUnder(join(ROOT, 'src'), (n) => n.endsWith('.ts')), ...filesUnder(join(ROOT, 'tests'), (n) => n.endsWith('.ts'))];
    const resolveImport = (from: string, spec: string): string | null => {
      const base = resolve(dirname(from), spec);
      return [`${base}.ts`, join(base, 'index.ts')].find(existsSync) ?? null;
    };
    const graph = new Map(
      files.map((file) => [
        rel(file),
        [...readFileSync(file, 'utf8').matchAll(/from\s+'(\.{1,2}\/[^']+)'/g)]
          .map((m) => resolveImport(file, m[1]))
          .filter((p): p is string => p !== null)
          .map(rel),
      ]),
    );

    expect(graph.size).toBeGreaterThan(10);
    expect(findCycle(graph), 'import cycle').toBeNull();
  });
});
