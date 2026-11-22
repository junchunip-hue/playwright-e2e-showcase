// Posts a Markdown file as a PR comment, or updates the comment it posted before, so each analysis keeps exactly
// one comment that always shows the latest push. The file's first line is its marker (an HTML comment, e.g.
// <!-- pr-impact:scenarios -->), which finds the earlier comment.
//
// Usage: node scripts/pr-comment.mjs <file.md>   (env: GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER)
import { readFileSync } from 'node:fs';

const [file] = process.argv.slice(2);
const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo, PR_NUMBER: pr } = process.env;
if (!file || !token || !repo || !pr) {
  console.error('Usage: node scripts/pr-comment.mjs <file.md> (env GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER)');
  process.exit(2);
}
const LIMIT = 65_000; // GitHub's limit is 65,536 characters
let body = readFileSync(file, 'utf8');
if (body.length > LIMIT) body = `${body.slice(0, LIMIT)}\n\n… (cut: the full text is in the run's summary)`;
const marker = body.split('\n')[0];

const api = async (method, path, data) => {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return res.json();
};

let existing = null;
for (let page = 1; page <= 10 && !existing; page++) {
  const comments = await api('GET', `/repos/${repo}/issues/${pr}/comments?per_page=100&page=${page}`);
  existing = comments.find((c) => c.user?.type === 'Bot' && c.body?.startsWith(marker));
  if (comments.length < 100) break;
}
if (existing) {
  await api('PATCH', `/repos/${repo}/issues/comments/${existing.id}`, { body });
  console.log(`Updated ${existing.html_url}`);
} else {
  const created = await api('POST', `/repos/${repo}/issues/${pr}/comments`, { body });
  console.log(`Posted ${created.html_url}`);
}
