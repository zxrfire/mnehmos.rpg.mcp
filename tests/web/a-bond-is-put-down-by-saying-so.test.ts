/**
 * Ending a master-disciple bond by saying so, rather than by asking to be let go.
 *
 * ── WHAT WAS THERE BEFORE ────────────────────────────────────────────────
 *
 * The act, with one road to it. `endTheBond` writes both former ties and the
 * broken oath from either end, and the only sentence that reached it was the
 * request shape. Measured through `parseIntent`:
 *
 *     I cast Yun Zhi out                  unclear
 *     I disown my disciple                unclear
 *     I sever my ties with Elder Fang     unclear
 *     I renounce my master                unclear
 *     I am no longer his disciple         unclear
 *     I end our bond                      unclear
 *     I walk out on Elder Fang            move/flee
 *     I ask Elder Fang to end our bond    request/ending_a_bond
 *
 * Nine blank looks, one read as running away, and the one that worked is the
 * one nobody types: nobody ASKS to be cast out, and a master casting somebody
 * out is not asking them for anything.
 *
 * ── WHAT THIS PINS ───────────────────────────────────────────────────────
 *
 *   both directions reach the act from the words a player would use, with the
 *   person named as they named them
 *   nothing refuses it - a bond runs for life, so ending one is a decision -
 *   and what it costs is stated: the former tie at both ends and the broken
 *   oath the other end now holds, at the ledger's own word for how long it stood
 *   with more than one master, "my master" is answered by naming them and
 *   asking which, and nothing is written until the player says
 *   an expulsion from a HOUSE is not this: a sentence naming one stays with the
 *   house's own verb
 *
 * Red-checked, each on its own: with the row taken out of the pattern table
 * five of the six go red, which is every test that types one of these sentences;
 * with the cost line dropped from `endTheBond` only the cost test goes red.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness.js';
import { parseIntent } from '../../src/web/actions.js';
import { recordABondBothWays } from '../../src/web/encounters.js';
import { upsertRelationship } from '../../src/engine/world/npc-state.js';
import { ledgerAbout } from '../../src/storage/repos/obligation.repo.js';

const WORLD = 'a-bond-said-down';

describe('the sentences', () => {
    it('reach ending a bond from either end, with the person named', () => {
        for (const [said, who] of [
            ['I cast Yun Zhi out', 'Yun Zhi'],
            ['I cast out my disciple Yun Zhi', 'Yun Zhi'],
            ['I sever my ties with Elder Fang', 'Elder Fang'],
            ['I renounce my master', 'my master'],
            ['I walk out on Elder Fang', 'Elder Fang'],
            ["I am no longer Elder Fang's disciple", 'Elder Fang'],
            ['I disown my disciple', 'my disciple']
        ] as const) {
            expect(parseIntent(said), said).toMatchObject({
                action: 'request', intent: 'ending_a_bond', target: who
            });
        }
        // Said to somebody's face, naming nobody: still the act, and who is
        // being spoken to is a fact the engine holds.
        expect(parseIntent('I end our bond')).toMatchObject({ action: 'request', intent: 'ending_a_bond' });
        // And the ask it was only reachable by still reaches it.
        expect(parseIntent('I ask Elder Fang to end our bond'))
            .toMatchObject({ action: 'request', intent: 'ending_a_bond', target: 'Elder Fang' });
    });

    it('leave a house striking somebody off its roll where it was', () => {
        expect(parseIntent('I leave the sect')).toMatchObject({ action: 'sect', intent: 'leave' });
        expect(parseIntent('I renounce the Azure Dew Sect')).toMatchObject({ action: 'sect' });
        // And a net is cast out over water without anybody being disowned.
        expect(parseIntent('I cast a net out over the water').intent).not.toBe('ending_a_bond');
    });
});

/** A player standing with somebody they are bound to, at the end given. */
async function aBondAtHand(seed: string, end: 'master' | 'disciple') {
    const harness = await makeGameInWorld({ seed, worldSeed: WORLD });
    const { cultivator } = await harness.game.newRun('Walker');
    // A turn first, so the player's own world row is written and somebody is
    // standing where they are.
    await harness.game.act('I look around');
    const world = harness.game.atHand!;
    const other = harness.game.present(harness.repos.cultivators.getById(cultivator.id)!)[0];
    expect(other, 'nobody is standing where the run opened').toBeTruthy();
    const day = Math.floor(world.currentDay) - 40 * 365;

    // Both stores, the way taking somebody on writes them: the world rows are
    // what the passes and "my master" read, the relationship rows are what the
    // resolver reads.
    const mine = end === 'master' ? 'disciple' : 'master';
    const theirs = end === 'master' ? 'master' : 'disciple';
    const playerAt = world.npcs.findIndex(n => n.id === cultivator.id);
    const otherAt = world.npcs.findIndex(n => n.id === other!.id);
    world.npcs[playerAt] = upsertRelationship(world.npcs[playerAt]!, {
        targetId: other!.id, targetName: other!.name, kind: mine, standing: 0.5, note: ''
    }, day);
    world.npcs[otherAt] = upsertRelationship(world.npcs[otherAt]!, {
        targetId: cultivator.id, targetName: cultivator.name, kind: theirs, standing: 0.5, note: ''
    }, day);
    recordABondBothWays(harness.repos, [
        { fromId: cultivator.id, toId: other!.id, type: mine, strength: 0.5 },
        { fromId: other!.id, toId: cultivator.id, type: theirs, strength: 0.5 }
    ], day, 'They knelt.');

    return { ...harness, cultivator, other: other!, world };
}

describe('saying it', () => {
    it('walks out on a master, and says what it costs rather than refusing it', async () => {
        const h = await aBondAtHand('bond-said-walk-out', 'disciple');

        const turn = await h.game.act(`I walk out on ${h.other.name}`);

        expect(turn.toolCalls.some(c => c.name === 'social.endTheBond' && c.ok)).toBe(true);
        expect(turn.narration.toLowerCase()).toContain('broken oath');
        const held = ledgerAbout(h.db as never, h.cultivator.id).filter(row =>
            row.cause === 'broken_oath' && row.holderId === h.other.id && row.subjectId === h.cultivator.id);
        expect(held, 'the other end holds it against them').toHaveLength(1);
        const mine = h.game.atHand!.npcs.find(n => n.id === h.cultivator.id)!;
        expect(mine.relationships.find(r => r.targetId === h.other.id)!.kind).toBe('former_master');
    }, 120_000);

    it('casts a disciple out, and both ends keep what they were', async () => {
        const h = await aBondAtHand('bond-said-cast-out', 'master');

        const turn = await h.game.act(`I cast ${h.other.name} out`);

        expect(turn.toolCalls.some(c => c.name === 'social.endTheBond' && c.ok)).toBe(true);
        const world = h.game.atHand!;
        expect(world.npcs.find(n => n.id === h.cultivator.id)!.relationships
            .find(r => r.targetId === h.other.id)!.kind).toBe('former_disciple');
        expect(world.npcs.find(n => n.id === h.other.id)!.relationships
            .find(r => r.targetId === h.cultivator.id)!.kind).toBe('former_master');
    }, 120_000);

    // SEVERAL MASTERS IS ORDINARY - the design owner: *"you often have more
    // than one master, and that's okay"* - so a sentence that ends one has to
    // be able to say which, and one that does not has to be answered rather
    // than guessed at.
    it('with two masters, naming one ends that bond and leaves the other standing', async () => {
        const h = await aBondAtHand('bond-said-two-masters', 'disciple');
        const second = h.game.present(h.repos.cultivators.getById(h.cultivator.id)!)
            .find(row => row.id !== h.other.id);
        expect(second, 'only one person is standing here').toBeTruthy();
        const day = Math.floor(h.world.currentDay) - 365;
        const at = h.world.npcs.findIndex(n => n.id === h.cultivator.id);
        h.world.npcs[at] = upsertRelationship(h.world.npcs[at]!, {
            targetId: second!.id, targetName: second!.name, kind: 'master', standing: 0.5, note: ''
        }, day);
        recordABondBothWays(h.repos, [
            { fromId: h.cultivator.id, toId: second!.id, type: 'master', strength: 0.5 }
        ], day, 'They knelt again.');

        await h.game.act(`I walk out on ${second!.name}`);

        const mine = h.game.atHand!.npcs.find(n => n.id === h.cultivator.id)!;
        expect(mine.relationships.find(r => r.targetId === second!.id)!.kind).toBe('former_master');
        expect(mine.relationships.find(r => r.targetId === h.other.id)!.kind, 'the other one stands')
            .toBe('master');
    }, 120_000);

    it('and with two of them and neither at hand, names them and asks which', async () => {
        const h = await aBondAtHand('bond-said-which-master', 'disciple');
        const second = h.game.present(h.repos.cultivators.getById(h.cultivator.id)!)
            .find(row => row.id !== h.other.id);
        expect(second, 'only one person is standing here').toBeTruthy();
        recordABondBothWays(h.repos, [
            { fromId: h.cultivator.id, toId: second!.id, type: 'master', strength: 0.5 }
        ], Math.floor(h.world.currentDay) - 365, 'They knelt again.');
        // Standing where neither of them is: "my master" names two people and
        // nobody here answers to it.
        const away = h.world.locations.find(l => l.kind === 'settlement'
            && !h.world.npcs.some(n => (n.id === h.other.id || n.id === second!.id) && n.locationId === l.id))!;
        h.repos.cultivators.update(h.cultivator.id, { location: away.name });
        const before = ledgerAbout(h.db as never, h.cultivator.id).length;

        const turn = await h.game.act('I renounce my master');

        expect(turn.narration).toContain(h.other.name);
        expect(turn.narration).toContain(second!.name);
        expect(turn.toolCalls.some(c => c.name === 'social.endTheBond')).toBe(false);
        expect(ledgerAbout(h.db as never, h.cultivator.id).length).toBe(before);
    }, 120_000);
});
