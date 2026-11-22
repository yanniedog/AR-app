// Archives explorer comments for APK releases older than the current published APK.
// Usage: node hide-outdated.mjs <owner/repo> <issue number> [published APK tag] [just-posted comment ID]
// Needs GH_TOKEN. Minimizes with GraphQL as OUTDATED; when that is refused, collapses the
// comment body in place with REST so the thread still shrinks.
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const TITLE = /^explorer run \d+ on (app-v\d+\.\d+\.\d+)(?=\s|$)/;
export const COLLAPSED_MARKER = '<!-- explorer-collapsed -->';

export function versionOf(body) {
  const m = TITLE.exec(String(body ?? '').trimStart());
  return m ? releaseVersion(m[1]) : null;
}

export function compareVersions(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

const BOT = 'github-actions[bot]';
const loginKey = login => String(login ?? '').replace(/\[bot\]$/i, '').toLowerCase();

function releaseVersion(tag) {
  const match = /^app-v(\d+)\.(\d+)\.(\d+)$/.exec(tag);
  return match ? match.slice(1).map(Number) : null;
}

export function outdatedComments(comments, current, botLogin = BOT) {
  if (!current) return [];
  return comments.filter(c => {
    if (loginKey(c.author) !== loginKey(botLogin) || c.isMinimized) return false;
    const version = versionOf(c.body);
    return version !== null && compareVersions(version, current) < 0;
  });
}

export function collapsedBody(body, newest) {
  const [title = ''] = String(body).split('\n');
  const label = `Superseded by app-v${newest.join('.')}`;
  return `${COLLAPSED_MARKER}\n<details><summary>${title} - ${label}</summary>\n\n${body}\n\n</details>`;
}

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const LIST_QUERY = 'query($o:String!,$n:String!,$i:Int!,$endCursor:String){repository(owner:$o,name:$n){issue(number:$i){comments(first:100,after:$endCursor){pageInfo{hasNextPage endCursor}nodes{id databaseId isMinimized body author{login}}}}}}';

function restComment(c) {
  return { id: c.node_id, databaseId: c.id, isMinimized: false, body: c.body, author: c.user?.login };
}

function listComments(repo, issue) {
  const [owner, name] = repo.split('/');
  try {
    const pages = JSON.parse(gh('api', 'graphql', '--paginate', '--slurp', '-f', `query=${LIST_QUERY}`, '-F', `o=${owner}`, '-F', `n=${name}`, '-F', `i=${issue}`));
    return pages.flatMap(p => p.data.repository.issue.comments.nodes).map(c => ({ ...c, author: c.author?.login }));
  } catch (err) {
    console.error(`GraphQL comment list refused: ${String(err.message).split('\n')[0]}; using REST`);
    // REST does not expose the minimized state; collapsing is idempotent through the marker.
    return JSON.parse(gh('api', `repos/${repo}/issues/${issue}/comments?per_page=100`, '--paginate', '--slurp')).flat()
      .map(restComment);
  }
}

function minimize(id) {
  const out = JSON.parse(gh('api', 'graphql', '-f', 'query=mutation($id:ID!){minimizeComment(input:{subjectId:$id,classifier:OUTDATED}){minimizedComment{isMinimized}}}', '-F', `id=${id}`));
  if (out.errors?.length || out.data?.minimizeComment?.minimizedComment?.isMinimized !== true) throw new Error('minimizeComment did not minimize');
}

function currentApkTag(repo) {
  return gh('api', `repos/${repo}/releases?per_page=100`, '--paginate', '--jq',
    '.[] | select(.draft|not) | select(.tag_name|test("^app-v[0-9]+[.][0-9]+[.][0-9]+$")) | select(any(.assets[]; .name=="app-preview.apk")) | .tag_name').trim().split('\n', 1)[0];
}

async function main(repo, issue, publishedTag = '', justPostedId = '') {
  const published = releaseVersion(publishedTag);
  if (publishedTag && !published) return;
  let tag = currentApkTag(repo);
  let current = releaseVersion(tag);
  // GitHub can deliver release.published before the APK upload completes.
  for (let retry = 0; published && (!current || compareVersions(current, published) < 0); retry += 1) {
    if (retry === 9) {
      console.log(`APK for ${publishedTag} is not visible yet; the scheduled sweep will retry`);
      return;
    }
    await delay(10000);
    tag = currentApkTag(repo);
    current = releaseVersion(tag);
  }
  if (!current) {
    console.log('No published APK release found');
    return;
  }
  const comments = listComments(repo, issue);
  if (justPostedId && !comments.some(c => c.databaseId === Number(justPostedId))) {
    const posted = JSON.parse(gh('api', `repos/${repo}/issues/comments/${justPostedId}`));
    comments.push(restComment(posted));
  }
  const stale = outdatedComments(comments, current);
  let hidden = 0;
  let collapsed = 0;
  for (const c of stale) {
    try {
      minimize(c.id);
      hidden++;
    } catch {
      try {
        gh('api', '-X', 'PATCH', `repos/${repo}/issues/comments/${c.databaseId}`, '-f', `body=${collapsedBody(c.body, current)}`);
        collapsed++;
      } catch (err) {
        console.error(`Could not hide comment ${c.databaseId}: ${String(err.message).split('\n')[0]}`);
      }
    }
  }
  console.log(`Outdated explorer comments for ${tag}: ${stale.length} found, ${hidden} hidden, ${collapsed} collapsed`);
  if (hidden + collapsed !== stale.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [repo, issue, publishedTag, justPostedId] = process.argv.slice(2);
  await main(repo, issue, publishedTag, justPostedId);
}
