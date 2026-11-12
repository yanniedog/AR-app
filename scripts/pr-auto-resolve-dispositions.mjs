#!/usr/bin/env node
/**
 * Resolve the review thread a trusted disposition reply answers.
 * Env: GH_TOKEN, GITHUB_REPOSITORY, GITHUB_EVENT_PATH (pull_request_review_comment).
 * Prints "resolved=<true|false>" for the workflow.
 */
import { readFileSync, appendFileSync } from 'node:fs';
import { shouldAutoResolve } from './lib/pr-disposition.mjs';

const out = (line) => {
  console.log(line);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${line}\n`);
};

const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const comment = event.comment;
if (!shouldAutoResolve(comment)) { out('resolved=false'); process.exit(0); }

const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
const number = event.pull_request.number;
async function graphql(query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { authorization: `bearer ${process.env.GH_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(JSON.stringify(json.errors ?? json));
  return json.data;
}

const target = comment.in_reply_to_id;
let after = null, thread = null;
do {
  const data = await graphql(`query($owner:String!,$repo:String!,$number:Int!,$after:String){
    repository(owner:$owner,name:$repo){ pullRequest(number:$number){ reviewThreads(first:100,after:$after){
      pageInfo{ hasNextPage endCursor }
      nodes{ id isResolved comments(first:100){ nodes{ databaseId } } } } } } }`,
  { owner, repo, number, after });
  const page = data.repository.pullRequest.reviewThreads;
  thread = page.nodes.find(t => t.comments.nodes.some(c => c.databaseId === target || c.databaseId === comment.id)) ?? null;
  after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
} while (!thread && after);

if (!thread) { console.log(`No thread found for comment ${comment.id}`); out('resolved=false'); process.exit(0); }
if (!thread.isResolved) {
  await graphql('mutation($id:ID!){ resolveReviewThread(input:{threadId:$id}){ thread{ isResolved } } }', { id: thread.id });
}
out('resolved=true');
