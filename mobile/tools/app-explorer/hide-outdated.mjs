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

const BOT = 'github-actions[bot]';

function botResults(comments, botLogin) {
  return comments.filter(c => c.author === botLogin).map(c => ({ ...c, version: versionOf(c.body) })).filter(c => c.version);
}

/** Newest app version among this bot's explorer comments, or null. Other authors never count. */
export function newestVersion(comments, botLogin = BOT, floor = null) {
  return botResults(comments, botLogin).reduce((best, c) => (!best || compareVersions(c.version, best) > 0 ? c.version : best), floor);
}

/** Bot comments for releases older than the newest release posted, not already hidden.
 * A collapsed comment starts with the marker, so it has no title and is never selected again. */
export function outdatedComments(comments, botLogin = BOT, floor = null) {
  const newest = newestVersion(comments, botLogin, floor);
  if (!newest) return [];
  return botResults(comments, botLogin).filter(c => compareVersions(c.version, newest) < 0 && !c.isMinimized);
}

export function collapsedBody(body, newest) {
  const [title = ''] = String(body).split('\n');
  const label = `Superseded by app-v${newest.join('.')}`;
  return `${COLLAPSED_MARKER}\n<details><summary>${title} - ${label}</summary>\n\n${body}\n\n</details>`;
}

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const LIST_QUERY = 'query($o:String!,$n:String!,$i:Int!,$endCursor:String){repository(owner:$o,name:$n){issue(number:$i){comments(first:100,after:$endCursor){pageInfo{hasNextPage endCursor}nodes{id databaseId isMinimized body author{login}}}}}}';

function listComments(repo, issue) {
  const [owner, name] = repo.split('/');
  try {
    const pages = JSON.parse(gh('api', 'graphql', '--paginate', '--slurp', '-f', `query=${LIST_QUERY}`, '-F', `o=${owner}`, '-F', `n=${name}`, '-F', `i=${issue}`));
    return pages.flatMap(p => p.data.repository.issue.comments.nodes).map(c => ({ ...c, author: c.author?.login }));
  } catch (err) {
    console.error(`GraphQL comment list refused: ${String(err.message).split('\n')[0]}; using REST`);
    // REST does not expose the minimized state; collapsing is idempotent through the marker.
    return JSON.parse(gh('api', `repos/${repo}/issues/${issue}/comments?per_page=100`, '--paginate', '--slurp')).flat()
      .map(c => ({ id: c.node_id, databaseId: c.id, isMinimized: false, body: c.body, author: c.user?.login }));
  }
}

function minimize(id) {
  const out = JSON.parse(gh('api', 'graphql', '-f', 'query=mutation($id:ID!){minimizeComment(input:{subjectId:$id,classifier:OUTDATED}){minimizedComment{isMinimized}}}', '-F', `id=${id}`));
  if (out.errors?.length || out.data?.minimizeComment?.minimizedComment?.isMinimized !== true) throw new Error('minimizeComment did not minimize');
}

function main(repo, issue, currentTitle = '') {
  const nodes = listComments(repo, issue);
  // The comment just posted may not be in the listing yet; its release still counts as the newest.
  const current = versionOf(currentTitle);
  const stale = outdatedComments(nodes, BOT, current);
  const newest = newestVersion(nodes, BOT, current) ?? [0, 0, 0];
  let hidden = 0;
  let collapsed = 0;
  for (const c of stale) {
    try {
      minimize(c.id);
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
  const [repo, issue, currentTitle] = process.argv.slice(2);
  try { main(repo, issue, currentTitle); } catch (err) { console.error(`hide-outdated skipped: ${String(err.message).split('\n')[0]}`); }
}
