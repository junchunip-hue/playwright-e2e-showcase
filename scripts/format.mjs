// One command for the whole code style (docs/coding-rules.md):
//   npm run format         rewrites: import order (ESLint), layout of TS/JS/JSON/YAML/Gherkin (Prettier), Java (Spotless)
//   npm run format:check   only reports; CI and the pre-push hook run this, and a PR cannot merge while it fails
// Java needs a JDK; without one the Java part is skipped here with a warning (CI still checks it).
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const check = process.argv.includes('--check');
const win = process.platform === 'win32';

function run(label, cmd, args, opts = {}) {
  console.log(`\n▶ ${label}`);
  // One command string through the shell: Windows runs npx and mvnw as .cmd files, which need a shell.
  const line = [cmd, ...args].map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ');
  const r = spawnSync(line, { stdio: 'inherit', shell: true, ...opts });
  return r.status === 0;
}

const hasJava = spawnSync('java -version', { stdio: 'ignore', shell: true }).status === 0;
const results = [
  run('Lint and import order (ESLint)', 'npx', ['eslint', '.', ...(check ? [] : ['--fix'])]),
  run('Layout (Prettier)', 'npx', ['prettier', check ? '--check' : '--write', '.', '--log-level', 'warn']),
];
if (hasJava) {
  results.push(
    run(
      'Java (Spotless)',
      resolve('java', win ? 'mvnw.cmd' : 'mvnw'),
      ['-q', '-B', check ? 'spotless:check' : 'spotless:apply'],
      {
        cwd: 'java',
      },
    ),
  );
} else {
  console.warn('\n⚠ No JDK found: Java formatting skipped here. CI checks it (java/pom.xml, Spotless).');
}

if (results.includes(false)) {
  console.error(
    check
      ? '\n✖ Code style check failed: run "npm run format" and commit the changes.'
      : '\n✖ Some files could not be fixed automatically (see above).',
  );
  process.exit(1);
}
console.log(check ? '\n✔ Code style is clean.' : '\n✔ Formatted.');
