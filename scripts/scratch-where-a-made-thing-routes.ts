/**
 * Scratch. Where a sentence about making a thing at your own bench routes today.
 * Run: npx tsx scripts/scratch-where-a-made-thing-routes.ts
 */

import { parseIntent } from '../src/web/verb-pattern-table.js';

const SAID = [
    'I craft a talisman',
    'I craft an earth-grade talisman',
    'I make myself a talisman',
    'I cut a slip',
    'I forge an earth-grade sword',
    'I craft a heaven-grade talisman',
    'I make an earth-grade artifact',
    'I build a carriage',
    'I craft a spirit boat',
    'I refine a pill',
    'what can I craft',
    'I ask my master to cut me an earth-grade talisman',
    'I buy a talisman',
    'I burn the talisman',
    'I sell my earth-grade talisman',
    'what could I build',
    'I make a pill'
];

for (const said of SAID) {
    const plan = parseIntent(said);
    console.log(`${said.padEnd(34)} -> ${plan.action}  target=${JSON.stringify(plan.target ?? null)}`);
}
