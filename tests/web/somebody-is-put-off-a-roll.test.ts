/**
 * Putting somebody off a house's roll: the words for it, and the house's own
 * rule about who may.
 *
 * ── WHAT WAS THERE BEFORE ────────────────────────────────────────────────
 *
 * `sect/expel` was gated in the PARSER on the word "elder" being in the
 * sentence, on the grounds that the power reaches elders and nothing else. That
 * is the engine's answer, and giving it by shrugging is what AGENTS.md means by
 * the reader taking the engine's job. Measured through `parseIntent`:
 *
 *     I throw him out of the sect          unclear
 *     I have her removed from the house    unclear
 *     I expel Yun Zhi from the sect        unclear
 *     I want him expelled                  unclear
 *     I have him thrown out                unclear
 *     I strike his name off the roll       attack, at "his name off the roll"
 *     I kick her out of the sect           attack, at "her out of the sect"
 *
 * Two of those are the intent corpus's own exemplars for `sect/expel`, and two
 * were worse than blank: a name struck off a register read as a sword swung at
 * a man called "his name off the roll".
 *
 * ── AND WHERE HAVING IT DONE GOES, WHICH WAS THE QUESTION ────────────────
 *
 * "I have her removed" is asking the house rather than doing it, so the obvious
 * place for it is the punishment room. It does not go there, and the reason is
 * worth writing down rather than discovering twice:
 *
 *   the room's ladder has no such rung. `SENTENCES_IN_ORDER` runs no case,
 *   rebuke, fine, what the house gave taken back, years sealed and held, the
 *   capability taken, death. A name struck off a roll is not on it
 *   nothing brings a complaint. `complaintsBroughtTo` and `settleAComplaint`
 *   are read by whoever HOLDS the room; the player has no verb that opens a row
 *   against another member at all, and `reportWhatTheySaw` is the world's own
 *   witnesses
 *
 * So both shapes name the same act, and what separates them - who does it - is
 * answered by the house: the power is an elder's dismissal, held at the top of
 * the ladder, and the refusal names who stands there.
 *
 * Red-checked, each on its own: with the new routing row out, three of the four
 * go red - the routing and both played tests, because nothing reaches the verb;
 * with the who-could lines dropped from the refusal, only the refusal test does.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness.js';
import { parseIntent } from '../../src/web/actions.js';
import { rosterFor } from '../../src/web/encounters.js';
import { ledgerAbout } from '../../src/storage/repos/obligation.repo.js';

const WORLD = 'off-the-roll';

describe('the sentences', () => {
    it('reach the house putting somebody off its roll, both doing it and having it done', () => {
        for (const said of [
            'I throw him out of the sect',
            'I have her removed from the house',
            'I expel Yun Zhi from the sect',
            'I want him expelled',
            'I have him thrown out',
            'I strike his name off the roll',
            'I kick her out of the sect',
            'I expel the disciple',
            'I expel Elder Fang'
        ]) {
            expect(parseIntent(said), said).toMatchObject({ action: 'sect', intent: 'expel' });
        }
        expect(parseIntent('I expel Yun Zhi from the sect').target).toBe('Yun Zhi');
    });

    it('leave a blow a blow, and a bond put down where it was', () => {
        expect(parseIntent('I strike him in the throat').action).toBe('attack');
        expect(parseIntent('I kick him').action).toBe('attack');
        expect(parseIntent('I attack the bandit').action).toBe('attack');
        // Casting your own disciple out is the bond, and it is not this act.
        expect(parseIntent('I cast Yun Zhi out'))
            .toMatchObject({ action: 'request', intent: 'ending_a_bond' });
        expect(parseIntent('I disown my disciple'))
            .toMatchObject({ action: 'request', intent: 'ending_a_bond' });
    });
});

/** A member of a house at the rung they are taken on at. */
async function aMemberOfAHouse(seed: string, rankIndex = 0) {
    const harness = await makeGameInWorld({ seed, worldSeed: WORLD });
    const { cultivator } = await harness.game.newRun('Speaker');
    await harness.game.act('I look around');
    const world = harness.game.atHand!;
    // A house the catalog names people in, so the refusal has somebody to name.
    for (const faction of world.factions) {
        if (faction.dissolvedOnDay === null && harness.repos.sects.getById(faction.id) !== null) {
            harness.repos.sects.addMember(faction.id, cultivator.id, rankIndex);
            const roster = rosterFor(
                { repos: harness.repos, knowledge: harness.game.knowledge, world },
                harness.repos.cultivators.getById(cultivator.id)!
            );
            const sect = harness.repos.sects.getById(faction.id)!;
            if (roster.some(person => person.rankIndex >= sect.ranks.length - 1)) {
                return { ...harness, cultivator, sect, roster };
            }
            harness.repos.sects.removeMember(faction.id, cultivator.id);
        }
    }
    throw new Error('no house in this world names somebody at the top of its ladder');
}

describe('who may', () => {
    it('refuses the bottom rung and names the rung and whoever stands on it', async () => {
        const h = await aMemberOfAHouse('off-the-roll-refused');
        const before = ledgerAbout(h.db as never, h.cultivator.id).length;

        const turn = await h.game.act('I throw him out of the sect');

        expect(turn.toolCalls.some(c => c.action === 'sect' && !c.ok)).toBe(true);
        // The rung the power opens at, in the house's own word for it.
        expect(turn.narration).toContain(h.sect.ranks[h.sect.ranks.length - 1]!);
        // And somebody who stands there, by name.
        const above = h.roster.filter(person => person.rankIndex >= h.sect.ranks.length - 1);
        expect(above.some(person => turn.narration.includes(person.name)), 'named nobody').toBe(true);
        // What the power reaches, so the answer is not only about the asker.
        expect(turn.narration.toLowerCase()).toContain('elder');
        // And nothing was done about it.
        expect(ledgerAbout(h.db as never, h.cultivator.id).length).toBe(before);
        expect(h.repos.sects.getMembership(h.cultivator.id)!.sectId).toBe(h.sect.id);
    }, 120_000);

    it('at the top of the ladder, says a name that is not an elder\'s is not this act', async () => {
        const h = await aMemberOfAHouse('off-the-roll-allowed', 0);
        const sect = h.sect;
        h.repos.sects.addMember(sect.id, h.cultivator.id, sect.ranks.length - 1);

        const turn = await h.game.act('I have the outer disciple removed from the sect');

        expect(turn.narration.toLowerCase()).toContain('not an elder');
        expect(turn.narration.toLowerCase()).not.toContain('does not do that');
    }, 120_000);
});
