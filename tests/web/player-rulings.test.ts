/**
 * Gemma play, 2026-10-20, findings 1, 5, 6, 23, 31 and 37: the play log
 * printed the structural account, including calibration and database identities.
 * Rulings carry the resolved facts; the complete structural account stays in
 * the inspector. Changing that audience must not cut the narrator's facts.
 */
import { describe, expect, it } from 'vitest';
import { GameService } from '../../src/web/game';
import { observable } from '../../src/web/facts';
import { composeNarrationUser } from '../../src/web/prompt';
import type { Execution } from '../../src/web/turn-wire-shapes';
import type { LogEntry } from '../../src/web/log';
import { makeGame, makeGameInWorld } from './harness';
import { whatIsWrongWithThisGround } from '../../src/web/ground-status-lines';
import { getPill } from '../../src/data/cultivation/pills';

// Camel case needs a case-sensitive read; ordinary words must remain ordinary.
const INTERNAL_ID_OR_NOTE = /\b(?:npc|price|conv)-[a-z0-9-]+|\bloc-[a-z0-9-]+(?:#[a-z0-9-]+)+|\b[a-z]+[A-Z][a-zA-Z0-9]*\b/;
const CALIBRATION = /\b(?:calibrat\w*|catalog|multiplier|ordinal|gated by realm|knowledge row|resolver|measured over|by seed|run seed|world seed)\b/i;
const offences = (lines: string[]) => lines.filter(line => INTERNAL_ID_OR_NOTE.test(line) || CALIBRATION.test(line));

describe('player rulings and the engine account have different audiences', () => {
    it('recognizes each leak independently and accepts perceived figures', () => {
        for (const line of [
            'npc-90 known', 'loc-region-wide-field#market#the-stalls',
            'price-qi-gathering-pill', 'conv-carriage-mortal',
            'crossToWhoeverTheyNamed: arrived', 'measured over 5 seeds',
            'the region multiplier', '153 gated by realm', 'a knowledge row'
        ]) expect(offences([line]), line).toEqual([line]);
        expect(offences(['The keeper asks 17 spirit stones.', 'A quarter day passed.', 'Two people are here.'])).toEqual([]);
    });

    it('logs resolved facts while leaving the narrator input intact', () => {
        const facts = observable('You reach the stalls.', [
            'A quarter day passed.', 'The pill costs 17 spirit stones.'
        ], 'A quarter day passed.\n\nThe pill costs 17 spirit stones.', [
            'crossToWhoeverTheyNamed: loc-town#street#bridge to loc-town#market#stalls for npc-90.',
            'price-qi-gathering-pill: 1620 cash at the region multiplier.',
            'Calibration measured over 5 seeds.'
        ]);
        const before = JSON.stringify(facts);
        const prompt = composeNarrationUser(facts, { place: 'the stalls', ambient: 'normal' });
        const execution: Execution = { facts, calls: [], events: [], timeSkip: null, breakthrough: null, outcome: 'executed' };
        const boundary = GameService.prototype as unknown as {
            engineEntries(execution: Execution, turn: number): LogEntry[];
        };
        const lines = boundary.engineEntries(execution, 1).map(row => row.text);
        expect(offences(lines)).toEqual([]);
        expect(lines).toEqual([facts.headline, ...facts.lines]);
        expect(JSON.stringify(facts)).toBe(before);
        expect(composeNarrationUser(facts, { place: 'the stalls', ambient: 'normal' })).toBe(prompt);
        for (const line of facts.lines) expect(prompt).toContain(line);
        expect(prompt).toContain(facts.headline);
        for (const line of facts.structure) expect(prompt).not.toContain(line);
    });

    it('keeps private narrator material and voicing instructions outside rulings', () => {
        const facts = observable('Someone is here.', [
            'Secret Star Hall colours are worn here; the player does not know the house.',
            'What they can be heard on: asking a neighbour about a debt.'
        ], 'Someone in unfamiliar colours is here.');
        const boundary = GameService.prototype as unknown as {
            engineEntries(execution: Execution, turn: number): LogEntry[];
        };
        const execution: Execution = { facts, calls: [], events: [], timeSkip: null, breakthrough: null, outcome: 'executed' };
        const lines = boundary.engineEntries(execution, 1).map(row => row.text);
        expect(lines).toEqual([facts.headline, facts.prose]);
        const prompt = composeNarrationUser(facts, { place: 'the stalls', ambient: 'normal' });
        for (const line of facts.lines) expect(prompt).toContain(line);
    });

    it('keeps routine details inspectable through the played read paths', async () => {
        const { game, db } = await makeGameInWorld({ seed: 'player-rulings', worldSeed: 'player-rulings' });
        try {
            await game.newRun('Reader');
            const leaked: string[] = [];
            const account: string[] = [];
            for (const said of ['I look around', 'destinations', 'what is for sale', 'what can I learn', 'what am I carrying', 'hide']) {
                const answer = await game.act(said);
                leaked.push(...offences(answer.state.log.filter(row => row.role === 'engine' && row.turn === answer.state.run.turn).map(row => row.text)));
                account.push(...answer.toolCalls.map(call => call.summary));
            }
            expect(leaked).toEqual([]);
            expect(account.some(line => /gated by realm/.test(line))).toBe(true);
            expect(account.some(line => /knowledge row/.test(line))).toBe(true);
        } finally { db.close(); }
    }, 120_000);

    it('states the actual purchase price and remaining stones instead of price keys', async () => {
        const { game, db } = makeGame({ seed: 'ruling-purchase' });
        try {
            const { cultivator } = await game.newRun('Reader');
            const pill = getPill('pill-qi-gathering')!;
            const answer = await game.act(`I buy ${pill.name}`);
            const paid = cultivator.spiritStones - answer.state.cultivator.spiritStones;
            expect(paid).toBeGreaterThan(0);
            const lines = answer.state.log.filter(row => row.role === 'engine' && row.turn === answer.state.run.turn).map(row => row.text);
            expect(offences(lines)).toEqual([]);
            expect(lines.join('\n')).toContain(pill.name);
            expect(lines.join('\n')).toContain(`${paid} spirit stone`);
            expect(lines.join('\n')).toContain(`${answer.state.cultivator.spiritStones} left`);
            expect(answer.toolCalls.some(call => call.summary.includes('price-qi-gathering-pill'))).toBe(true);
        } finally { db.close(); }
    });

    it('does not claim something is wrong on ordinary ground, even in the account', async () => {
        const { game, db } = await makeGameInWorld({ seed: 'quiet-ruling', worldSeed: 'quiet-ruling' });
        try {
            await game.newRun('Reader');
            const { cultivator } = game.currentRun();
            const world = game.atHand!;
            const reading = whatIsWrongWithThisGround({
                statuses: world.statuses, locations: world.locations,
                locationId: game.worldPlaceOf(cultivator)!, day: Math.floor(world.currentDay),
                heldStage: 'encountered', standingHere: true
            });
            expect(reading.lines).toEqual([]);
            expect(reading.running).toBe(0);
            const answer = await game.act('I look around');
            expect(answer.state.log.filter(row => row.role === 'engine').map(row => row.text).join('\n'))
                .not.toMatch(/Something is wrong with this ground/);
            expect(answer.toolCalls.map(call => call.summary).join('\n'))
                .not.toMatch(/Something is wrong with this ground/);
        } finally { db.close(); }
    }, 120_000);
});
