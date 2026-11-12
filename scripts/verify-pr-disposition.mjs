#!/usr/bin/env node
/** Self-test for review-thread disposition auto-resolution. */
import { dispositionOf, shouldAutoResolve } from './lib/pr-disposition.mjs';

const failures = [];
const check = (name, got, want) => { if (got !== want) failures.push(`${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); };
const reply = (body, extra = {}) => ({ id: 2, in_reply_to_id: 1, body, author_association: 'OWNER', user: { login: 'yanniedog', type: 'User' }, ...extra });

check('implemented sha', dispositionOf('implemented in db0b708: strict comparison.'), 'implemented');
check('implemented bare', dispositionOf('Implemented.'), 'implemented');
check('deferred dash', dispositionOf('deferred — needs device run'), 'deferred');
check('declined hyphen', dispositionOf('declined - out of scope'), 'declined');
check('declined in part', dispositionOf('declined in part: probe stays'), 'declined');
check('bold prefix', dispositionOf('**implemented in abc1234**'), 'implemented');
check('prose mention', dispositionOf('I think this should be implemented in a later PR'), null);
check('question', dispositionOf('why was this declined?'), null);

check('owner reply resolves', shouldAutoResolve(reply('implemented in abc1234')), true);
check('collaborator reply resolves', shouldAutoResolve(reply('declined — no', { author_association: 'COLLABORATOR' })), true);
check('top-level comment ignored', shouldAutoResolve(reply('implemented in abc1234', { in_reply_to_id: null })), false);
check('outsider ignored', shouldAutoResolve(reply('implemented in abc1234', { author_association: 'CONTRIBUTOR' })), false);
check('bot ignored', shouldAutoResolve(reply('implemented in abc1234', { user: { login: 'sourcery-ai[bot]', type: 'Bot' } })), false);
check('no disposition ignored', shouldAutoResolve(reply('looking into it')), false);

if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('pr-disposition: ok');
