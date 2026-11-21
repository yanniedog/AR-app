// Hides explorer comments that belong to an older app release than the newest one posted.
// Usage: node hide-outdated.mjs <owner/repo> <issue number>
// Needs GH_TOKEN. Minimizes with GraphQL as OUTDATED; when that is refused, collapses the
// comment body in place with REST so the thread still shrinks.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const TITLE = /^explorer run (\d+) on app-v(\d+)\.(\d+)\.(\d+)/;
export const COLLAPSED_MARKER = '<!-- explorer-collapsed -->';

export function versionOf(body) {
  const m = TITLE.exec(String(body ?? '').trimStart());
  return m ? [Number(m[2]), Number(m[3]), Number(m[4])] : null;
}

export function compareVersions(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/** Comments of this bot for releases older than the newest release seen, not already hidden. */
export function outdatedComments(comments, botLogin = 'github-actions[bot]') {
  const mine = comments
    .filter(c => (c.author ?? c.user?.login) === botLogin || c.author?.login === botLogin)
    .map(c => ({ ...c, version: versionOf(c.body) }))
    .filter(c => c.version);
  if (!mine.length) return [];
  const newest = mine.reduce((best, c) => (compareVersions(c.version, best) > 0 ? c.version : best), mine[0].version);
  return mine.filter(c => compareVersions(c.version, newest) < 0 && !c.isMinimized && !String(c.body).startsWith(COLLAPSED_MARKER));
}

export function collapsedBody(body, newest) {
  const [title = ''] = String(body).split('\n');
  const label = `Superseded by app-v${newest.join('.')}`;
  return `${COLLAPSED_MARKER}\n<details><summary>${title} - ${label}</summary>\n\n${body}\n\n</details>`;
}

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

function main(repo, issue) {
  const [owner, name] = repo.split('/');
  let nodes;
  try {
    const q = 'query($o:String!,$n:String!,$i:Int!){repository(owner:$o,name:$n){issue(number:$i){comments(last:100){nodes{id databaseId isMinimized body author{login}}}}}}';
    nodes = JSON.parse(gh('api', 'graphql', '-f', `query=${q}`, '-F', `o=${owner}`, '-F', `n=${name}`, '-F', `i=${issue}`))
      .data.repository.issue.comments.nodes.map(c => ({ ...c, author: c.author?.login }));
  } catch (err) {
    console.error(`GraphQL comment list refused: ${String(err.message).split('\n')[0]}; using REST`);
    nodes = JSON.parse(gh('api', `repos/${repo}/issues/${issue}/comments?per_page=100`, '--paginate', '--slurp')).flat()
      .map(c => ({ id: c.node_id, databaseId: c.id, isMinimized: false, body: c.body, author: c.user?.login }));
  }
  const stale = outdatedComments(nodes);
  const versions = nodes.map(c => versionOf(c.body)).filter(Boolean);
  const newest = versions.reduce((b, v) => (compareVersions(v, b) > 0 ? v : b), versions[0] ?? [0, 0, 0]);
  let hidden = 0;
  let collapsed = 0;
  for (const c of stale) {
    try {
      gh('api', 'graphql', '-f', 'query=mutation($id:ID!){minimizeComment(input:{subjectId:$id,classifier:OUTDATED}){minimizedComment{isMinimized}}}', '-F', `id=${c.id}`);
      hidden++;
    } catch {
      try {
        gh('api', '-X', 'PATCH', `repos/${repo}/issues/comments/${c.databaseId}`, '-f', `body=${collapsedBody(c.body, newest)}`);
        collapsed++;
      } catch (err) {
        console.error(`Could not hide comment ${c.databaseId}: ${String(err.message).split('\n')[0]}`);
      }
    }
  }
  console.log(`Outdated explorer comments: ${stale.length} found, ${hidden} hidden, ${collapsed} collapsed`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [repo, issue] = process.argv.slice(2);
  try { main(repo, issue); } catch (err) { console.error(`hide-outdated skipped: ${String(err.message).split('\n')[0]}`); }
}
