#!/usr/bin/env node
/**
 * Reconcile every review thread on a PR: resolve those whose latest comment is
 * a trusted disposition reply, then re-run the PR head's failed
 * bot-feedback-gate. Reads current comment bodies, so a reply edited before
 * this run is judged as it now stands, and a dropped queued run loses nothing.
 * Env: GH_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, HEAD_SHA.
 */
import { threadsToResolve } from './lib/pr-disposition.mjs';

const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
const number = Number(process.env.PR_NUMBER);
const headSha = process.env.HEAD_SHA;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function request(url, init = {}, attempts = 4) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { authorization: `bearer ${process.env.GH_TOKEN}`, accept: 'application/vnd.github+json', 'content-type': 'application/json', ...init.headers },
      });
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;
      const transient = res.status >= 500 || res.status === 429 || (res.status === 403 && /rate limit/i.test(text));
      if (res.ok && !json?.errors) return json;
      if (!transient || attempt >= attempts) throw new Error(`${res.status} ${text.slice(0, 500)}`);
    } catch (error) {
      if (attempt >= attempts || !(error instanceof TypeError)) throw error;
    }
    await sleep(1_000 * 2 ** attempt);
  }
}
const graphql = async (query, variables) => (await request('https://api.github.com/graphql', {
  method: 'POST', body: JSON.stringify({ query, variables }),
})).data;
const rest = (path, init) => request(`https://api.github.com/repos/${owner}/${repo}${path}`, init);

const threads = [];
let after = null;
do {
  const data = await graphql(`query($owner:String!,$repo:String!,$number:Int!,$after:String){
    repository(owner:$owner,name:$repo){ pullRequest(number:$number){ reviewThreads(first:100,after:$after){
      pageInfo{ hasNextPage endCursor }
      nodes{ id isResolved comments(last:1){ totalCount nodes{ body authorAssociation author{ __typename login } } } }
    } } }
  }`, { owner, repo, number, after });
  const page = data.repository.pullRequest.reviewThreads;
  threads.push(...page.nodes);
  after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
} while (after);

const toResolve = threadsToResolve(threads);
for (const thread of toResolve) {
  await graphql('mutation($id:ID!){ resolveReviewThread(input:{threadId:$id}){ thread{ isResolved } } }', { id: thread.id });
}
console.log(`resolved ${toResolve.length} of ${threads.filter(t => !t.isResolved).length} open threads`);
if (toResolve.length === 0) process.exit(0);

// GitHub emits no event on resolve. Re-run the head's own gate run: it keeps
// the workflow definition the PR event already ran, so no new code gains
// secrets, and its check stays attached to the head commit.
for (let attempt = 0; attempt < 24; attempt++) {
  const runs = await rest(`/actions/workflows/pr-bot-feedback-check.yml/runs?head_sha=${headSha}&per_page=1`);
  const run = runs.workflow_runs?.[0];
  if (!run) { console.log('no gate run for head yet'); break; }
  if (run.status !== 'completed') { await sleep(5_000); continue; }
  if (run.conclusion === 'success') { console.log('gate already green'); break; }
  await rest(`/actions/runs/${run.id}/rerun`, { method: 'POST' });
  console.log(`re-ran gate run ${run.id}`);
  break;
}
