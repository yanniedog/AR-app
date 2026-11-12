#!/usr/bin/env node
/** Self-test for review-thread disposition auto-resolution. */
import { dispositionOf, isTrustedDisposition, threadsToResolve } from './lib/pr-disposition.mjs';

const failures = [];
const check = (name, got, want) => { if (got !== want) failures.push(`${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); };
const reply = (body, extra = {}) => ({ body, authorAssociation: 'OWNER', author: { __typename: 'User', login: 'yanniedog' }, ...extra });
const thread = (last, extra = {}) => ({ id: 't', isResolved: false, comments: { totalCount: 2, nodes: [last] }, ...extra });

check('implemented sha', dispositionOf('implemented in db0b708: strict comparison.'), 'implemented');
check('bold prefix', dispositionOf('**implemented in abc1234**'), 'implemented');
check('deferred dash', dispositionOf('deferred — needs device run'), 'deferred');
check('declined hyphen', dispositionOf('declined - out of scope'), 'declined');
check('declined colon', dispositionOf('declined: out of scope'), 'declined');
check('bare implemented rejected', dispositionOf('implemented.'), null);
check('implemented later rejected', dispositionOf('implemented in a later PR'), null);
check('declined in part rejected', dispositionOf('declined in part: probe stays'), null);
check('declined without reason rejected', dispositionOf('declined —'), null);
check('prose mention rejected', dispositionOf('I think this should be implemented in abc1234'), null);

check('owner reply', isTrustedDisposition(reply('implemented in abc1234')), true);
check('collaborator reply', isTrustedDisposition(reply('declined — no', { authorAssociation: 'COLLABORATOR' })), true);
check('outsider ignored', isTrustedDisposition(reply('implemented in abc1234', { authorAssociation: 'CONTRIBUTOR' })), false);
check('bot type ignored', isTrustedDisposition(reply('implemented in abc1234', { author: { __typename: 'Bot', login: 'sourcery-ai' } })), false);
check('bot login ignored', isTrustedDisposition(reply('implemented in abc1234', { author: { __typename: 'User', login: 'sourcery-ai[bot]' } })), false);
check('bot login without type ignored', isTrustedDisposition(reply('implemented in abc1234', { author: { login: 'x[bot]' } })), false);
check('deleted author ignored', isTrustedDisposition(reply('implemented in abc1234', { author: null })), false);

check('answered thread resolved', threadsToResolve([thread(reply('implemented in abc1234'))]).length, 1);
check('resolved thread skipped', threadsToResolve([thread(reply('implemented in abc1234'), { isResolved: true })]).length, 0);
check('finding alone skipped', threadsToResolve([thread(reply('implemented in abc1234'), { comments: { totalCount: 1, nodes: [reply('implemented in abc1234')] } })]).length, 0);
check('bot after reply keeps open', threadsToResolve([thread(reply('still wrong', { author: { __typename: 'Bot', login: 'codex' } }))]).length, 0);
check('edited-away reply keeps open', threadsToResolve([thread(reply('looking into it'))]).length, 0);

if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('pr-disposition: ok');
