/**
 * The giving/taking gap in the verb surface, measured.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────
 *
 * A sweep of the genre's own tropes against `parseIntent` found the surface
 * badly lopsided: 15 of 20 TAKING sentences reached a verb against 3 of 10
 * GIVING ones, and two of that three were `give` and `oath`. Under this repo's
 * epigraph that is a defect rather than a tone. 天道无情 - a rescue and a
 * killing are the same kind of event, and **a vocabulary that can only say the
 * taking version of an act has taken a side**, whatever the code around it
 * does.
 *
 * ── TWO READERS, BECAUSE A FIGHT HAS ITS OWN ─────────────────────────────
 *
 * `whatTheySaidInTheFight` runs BEFORE the pattern table whenever a fight is
 * standing, and three of the sentences below live there rather than in
 * `parseIntent`. Measuring only the table would have reported `I spare him` as
 * unreachable after it was wired, which is the harness being wrong about the
 * engine rather than a finding.
 *
 * Run: `npx tsx scripts/probe-the-giving-half.ts`
 */
import { parseIntent } from '../src/web/verb-pattern-table.js';
import { whatTheySaidInTheFight } from '../src/web/fight-answers.js';

const TAKING = [
    'I take his purse',
    'I steal the spirit boat from Cao Nuolin',
    'I rob the merchant',
    'I kill him',
    'I attack the nearest cultivator',
    'I force her to marry me',
    'I make him swallow the pill',
    'I make him hand over the manual',
    'I beat him until he submits',
    'I threaten him',
    'I demand he tell me where the tomb is',
    'I search his soul',
    'I humiliate him in front of everyone',
    'I loot the corpse',
    'I take the body',
    'I cripple his cultivation',
    'I seize the cave',
    'I take her as a furnace',
    'I frame him for it',
    'I betray him'
];

const GIVING = [
    'I stand guard while she crosses',
    'I watch over his breakthrough',
    'I protect her while she attempts it',
    'who would stand guard for me',
    'I spare him',
    'I let him go',
    'I repay what I owe him',
    'I take the blame for her',
    'I free him from the seal',
    'I give him my sword',
    'I swear an oath to her'
];

function reached(line: string): string | null {
    const inFight = whatTheySaidInTheFight(line);
    // The table first, and the fight reader only where the table refuses.
    // That is NOT the precedence the game uses - inside a live fight the fight
    // reader wins - and it is the right one for this measurement: "I stand
    // guard while she crosses" is a BLOCK when a fight is standing and 护法
    // when one is not, and reporting only the first would credit the wrong
    // verb with reaching the sentence.
    const plan = parseIntent(line);
    if (plan.action !== 'unclear') {
        return [
            plan.action,
            plan.intent && `intent=${plan.intent}`,
            plan.target && `target=${plan.target}`
        ].filter(Boolean).join(' ');
    }
    return inFight ? `in a fight: ${inFight.kind}` : null;
}

function report(label: string, lines: readonly string[]) {
    let hit = 0;
    for (const line of lines) {
        const where = reached(line);
        if (where !== null) hit++;
        console.log(`  ${where === null ? 'XX' : '  '} ${line.padEnd(46)} -> ${where ?? 'unclear'}`);
    }
    console.log(`  ${label}: ${hit}/${lines.length}\n`);
    return { hit, total: lines.length };
}

console.log('TAKING');
const taking = report('TAKING', TAKING);
console.log('GIVING');
const giving = report('GIVING', GIVING);
console.log(
    `taking ${(100 * taking.hit / taking.total).toFixed(0)}%  `
    + `giving ${(100 * giving.hit / giving.total).toFixed(0)}%`
);
