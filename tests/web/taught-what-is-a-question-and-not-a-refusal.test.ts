/**
 * ASKING TO BE TAUGHT, WITHOUT SAYING WHAT.
 *
 * FOUND BY PLAYING. `I ask Han Ronglu to teach me` came back as:
 *
 *     No art called an art.
 *     Refused before the resolver, so no day was spent: "an art" is not an art
 *     anybody was ever taught. 2 arts they are carrying could have been asked
 *     for.
 *
 * and was narrated as *"Teach you what?" Han Ronglu asks.*
 *
 * Two separate failures, and the second is the expensive one.
 *
 * The player's own category word reached the resolver as a NAME. Both readers
 * of a sentence produce one - the pattern table left `n art` behind, a model
 * filled `topic` with `an art` - and every reader downstream treats a non-empty
 * field as something to look up. So a sentence that named nothing was answered
 * as a sentence that named something that does not exist.
 *
 * And the engine DECLINED while the prose ASKED. Those are different events.
 * The engine knew there were two candidates and refused; the narrator, handed a
 * dead end, wrote a question in the NPC's mouth that nothing could answer,
 * because no list had been printed for an answer to point into.
 *
 * ── THE FOUR ANSWERS, AND THE ENGINE PICKS ONE ───────────────────────────
 *
 *   ASKS BACK  willing, and the sentence did not say which road. The arts on
 *              offer, in a fixed order, and a price.
 *   A PRICE    what they would want. A condition, carried on the question.
 *   WILL NOT   they are carrying roads and would pass none of them to this
 *              asker. It stands even though they have arts - willingness is a
 *              decision, not an inventory check.
 *   CANNOT     nothing new to hand on, or the name was not an art.
 *
 * ── WILLING IS NOT KNOWN ─────────────────────────────────────────────────
 *
 * A master who holds five may offer two, and what decides it was already
 * written down: `betrayalOfSelling` for what the leak costs them, and
 * `shelfReach` for how far up its own shelf a house lets a rank read. Measured
 * on the Azure Cloud Pavilion, whose shelf runs four deep: an elder holding the
 * top canon and the working manual under it offers a stranger NOTHING, offers
 * its newest disciple nothing, and offers somebody at the top of the roll the
 * working manual and never the canon.
 *
 * Nothing here bans anything. An art off the offer can still be named outright
 * and is priced as the betrayal it is.
 */

import { describe, expect, it } from 'vitest';

import { ScriptedProvider, makeGameInWorld, type Harness } from './harness.js';
import { parseIntent } from '../../src/web/actions.js';
import { namesAKindRatherThanAThing } from '../../src/web/what-a-request-asks-and-of-whom.js';
import {
    whatItWouldCostThem,
    whatTheyWouldTeachYou
} from '../../src/web/what-asking-this-person-for-this-would-cost-them.js';
import { betrayalOfSelling, manualsOf } from '../../src/engine/world/manuals.js';
import { SECTS, getSect } from '../../src/data/cultivation/sects.js';
import { noHouseCanCallItTheirs } from '../../src/engine/world/manuals.js';
import { TECHNIQUES } from '../../src/data/cultivation/techniques.js';

const WORLD = 'ask-world-1';

interface Played {
    narration?: string;
    toolCalls?: { name: string; summary: string; ok: boolean }[];
    state?: { run: { elapsedDays: number } };
}

/** Whether the turn filed a decline of its own. A question does not. */
function declined(said: Played): boolean {
    return (said.toolCalls ?? []).some(call => !call.ok);
}

/**
 * Somebody standing here with more than one road they would hand on.
 *
 * Asked of the same two reads the verb itself uses rather than hard-coded, so
 * the test survives a reseed: a name this finds is a name the game printed to
 * itself, and the assertions below read the art names back out of the output.
 */
function somebodyWithSeveralOnOffer(
    harness: Harness
): { name: string; offers: string[] } | null {
    const game = harness.game as unknown as {
        currentRun(): { cultivator: { name: string; realmOrdinal: number; knownTechniques: string[] } };
        present(c: unknown): { id: string; name: string; factionId?: string | null }[];
        whatTheyAreCarrying(id: string): string[];
    };
    const { cultivator } = game.currentRun();
    for (const row of game.present(cultivator)) {
        const holds = game.whatTheyAreCarrying(row.id);
        const would = whatTheyWouldTeachYou(
            { id: row.id, name: row.name, ordinal: 10, factionId: row.factionId ?? null, holds },
            {
                name: cultivator.name,
                ordinal: cultivator.realmOrdinal,
                factionId: null,
                holds: cultivator.knownTechniques
            }
        );
        if (would.length >= 2) return { name: row.name, offers: would.map(a => a.name) };
    }
    return null;
}

describe('a category word is not a name', () => {
    it('is recognised however the sentence was read', () => {
        for (const phrase of [
            'an art', 'art', 'a technique', 'some technique', 'your arts',
            'something', 'anything', 'a cultivation method', 'one of his techniques'
        ]) {
            expect(namesAKindRatherThanAThing(phrase), phrase).toBe(true);
        }
        // And it takes nothing out of the catalog with it.
        for (const art of TECHNIQUES.slice(0, 200)) {
            expect(namesAKindRatherThanAThing(art.name), art.name).toBe(false);
        }
    });

    /**
     * The alternation took `a` and stopped, so `an art` left `n art` in `topic`
     * - which then fuzzy-matched a real technique, and the player was quoted a
     * price on an art they had never heard of.
     */
    it('does not leave a fragment behind the article', () => {
        const read = parseIntent('I ask Han Ronglu to teach me an art');
        expect(read.action).toBe('request');
        expect(read.topic ?? '').not.toMatch(/^n /);
        expect(namesAKindRatherThanAThing(read.topic)).toBe(true);
    });
});

describe('willing is not the same set as known', () => {
    it('never volunteers the top of a house shelf, and gates the rest on rank', () => {
        const house = (SECTS as { id: string }[]).find(s => {
            const shelf = manualsOf(s.id);
            return shelf.length >= 2
                && betrayalOfSelling({ factionId: s.id }, shelf[shelf.length - 1]!.id, s.id) === 3
                && shelf.some(m => betrayalOfSelling({ factionId: s.id }, m.id, s.id) === 2);
        });
        expect(house, 'no house in the catalog owns its own top of shelf').toBeDefined();

        const shelf = manualsOf(house!.id);
        const top = shelf[shelf.length - 1]!.id;
        const working = shelf.find(
            m => betrayalOfSelling({ factionId: house!.id }, m.id, house!.id) === 2
        )!;
        const ranks = getSect(house!.id)!.ranks.length;
        const elder = {
            id: 'elder', name: 'Elder', ordinal: 45,
            factionId: house!.id, holds: [top, working.id]
        };
        const nobody = { name: 'Asker', ordinal: 0, holds: [] as string[] };

        const toAStranger = whatTheyWouldTeachYou(elder, { ...nobody, factionId: null });
        const toTheNewest = whatTheyWouldTeachYou(
            elder, { ...nobody, factionId: house!.id, rankIndex: 0 }
        );
        const toTheTop = whatTheyWouldTeachYou(
            elder, { ...nobody, factionId: house!.id, rankIndex: ranks - 1 }
        );

        expect(toAStranger).toEqual([]);
        expect(toTheNewest).toEqual([]);
        expect(toTheTop.map(a => a.id)).toEqual([working.id]);
        // Two arts known, one offered at best, and the canon offered to nobody.
        expect(toTheTop.map(a => a.id)).not.toContain(top);
    });

    /**
     * Holding roads and passing none of them on is a DECISION, and it is not
     * the same event as having nothing to teach. Both refuse; they refuse
     * different things, and the one that can be moved says so.
     */
    it('refuses as a refusal when they hold roads and would offer none', () => {
        const house = (SECTS as { id: string }[]).find(s => {
            const shelf = manualsOf(s.id);
            return shelf.length >= 2
                && betrayalOfSelling({ factionId: s.id }, shelf[shelf.length - 1]!.id, s.id) === 3;
        })!;
        const top = manualsOf(house.id).at(-1)!.id;

        const willNot = whatItWouldCostThem({
            kind: 'teaching',
            asking: { name: 'Asker', ordinal: 0, factionId: null, holds: [] },
            asked: { id: 'e', name: 'Elder', ordinal: 45, factionId: house.id, holds: [top] },
            namedButUnresolved: ''
        });
        const cannot = whatItWouldCostThem({
            kind: 'teaching',
            asking: { name: 'Asker', ordinal: 0, factionId: null, holds: [] },
            asked: { id: 'e', name: 'Elder', ordinal: 45, factionId: house.id, holds: [] },
            namedButUnresolved: ''
        });

        expect(willNot.askBack).toBeNull();
        expect(willNot.refusal).not.toBeNull();
        expect(willNot.refusal!.headline).toMatch(/will not/i);
        expect(cannot.refusal!.headline).toMatch(/nothing to teach/i);
        expect(willNot.refusal!.headline).not.toBe(cannot.refusal!.headline);
        // Neither may read as an invitation: no list was put forward, so there
        // is nothing an answer could point at.
        expect(willNot.lines).toEqual([]);
    });

    /** One candidate is not a choice, so it is taken rather than asked about. */
    it('does not ask about one', () => {
        const free = (TECHNIQUES as { id: string }[])
            .filter(t => noHouseCanCallItTheirs(t.id)).map(t => t.id);
        const one = whatItWouldCostThem({
            kind: 'teaching',
            asking: { name: 'Asker', ordinal: 0, factionId: null, holds: [] },
            asked: { id: 'x', name: 'Them', ordinal: 20, factionId: null, holds: [free[0]!] },
            namedButUnresolved: ''
        });
        expect(one.askBack).toBeNull();
        expect(one.techniqueId).toBe(free[0]);
    });
});

describe('the question, and the price on it', () => {
    it('puts the arts back in a fixed order and carries what they want', () => {
        const free = (TECHNIQUES as { id: string }[])
            .filter(t => noHouseCanCallItTheirs(t.id)).slice(0, 2).map(t => t.id);
        const asked = { id: 'x', name: 'Han Ronglu', ordinal: 20, factionId: null, holds: free };
        const asking = { name: 'Asker', ordinal: 0, factionId: null, holds: [] as string[] };

        const plain = whatItWouldCostThem({ kind: 'teaching', asking, asked, namedButUnresolved: '' });
        expect(plain.refusal, 'an underspecified ask is no longer a refusal').toBeNull();
        expect(plain.askBack).not.toBeNull();
        expect(plain.askBack!.offered).toHaveLength(2);
        expect(plain.askBack!.terms.length).toBeGreaterThan(0);
        // The order is the contract: an ordinal in the next sentence is counted
        // against it, so the same reading twice gives the same order.
        const again = whatItWouldCostThem({ kind: 'teaching', asking, asked, namedButUnresolved: '' });
        expect(again.askBack!.offered.map(a => a.id))
            .toEqual(plain.askBack!.offered.map(a => a.id));
        // Every name it puts forward is on the offer and not merely on the roll.
        for (const art of plain.askBack!.offered) {
            expect(plain.lines.join(' ')).toContain(art.name);
        }

        const owing = whatItWouldCostThem({
            kind: 'teaching', asking, asked, namedButUnresolved: '',
            theyWant: 'the deed to the mill at Six Li'
        });
        expect(owing.askBack!.terms).toContain('the deed to the mill at Six Li');
        expect(owing.askBack!.terms).not.toBe(plain.askBack!.terms);
    });
});

describe('asking to be taught, played', () => {
    /**
     * The played defect, end to end. What the player must get back is a
     * question naming what is on offer, not a parse failure about a word they
     * did not choose.
     */
    it('answers a request that named no art with a question', async () => {
        const harness = await makeGameInWorld({ seed: 'teach-q-1', worldSeed: WORLD });
        await harness.game.newRun('Asker');
        const them = somebodyWithSeveralOnOffer(harness);
        expect(them, 'the pinned world put nobody here with two roads to hand on').not.toBeNull();

        const said = await harness.game.act(`I ask ${them!.name} to teach me`) as Played;
        const text = said.narration ?? '';

        expect(text).not.toMatch(/No art called/i);
        for (const art of them!.offers) expect(text, text).toContain(art);
        // The ruling is a read, not a decline. It is the whole difference the
        // played defect was about, and the only channel that cannot be dressed.
        expect(declined(said)).toBe(false);
    }, 300_000);

    /**
     * The same sentence with the player's own category word in it, which used
     * to be looked up: either reported as an art nobody was ever taught, or -
     * worse - fuzzy-matched onto a real one and a season spent on it.
     */
    it('does not read a category word as an art', async () => {
        const harness = await makeGameInWorld({ seed: 'teach-q-1', worldSeed: WORLD });
        await harness.game.newRun('Asker');
        const them = somebodyWithSeveralOnOffer(harness);
        expect(them).not.toBeNull();

        const before = harness.game.state().run.elapsedDays;
        const said = await harness.game.act(`I ask ${them!.name} to teach me an art`) as Played;
        const text = said.narration ?? '';

        expect(text).not.toMatch(/No art called/i);
        for (const art of them!.offers) expect(text, text).toContain(art);
        expect(declined(said)).toBe(false);
        // A question costs nothing. A word taken for a name reaches the
        // resolver and spends a fortnight.
        expect(said.state!.run.elapsedDays).toBe(before);
    }, 300_000);

    /**
     * And the player can answer it. The ordinal is counted against the order
     * the engine printed, which is what `namedThisTurn` is for - a list this
     * game prints and does not record is a list no ordinal can reach.
     */
    it('takes an ordinal counted against the order it printed', async () => {
        const harness = await makeGameInWorld({ seed: 'teach-q-1', worldSeed: WORLD });
        await harness.game.newRun('Asker');
        const them = somebodyWithSeveralOnOffer(harness);
        expect(them).not.toBeNull();

        await harness.game.act(`I ask ${them!.name} to teach me`);
        const back = await harness.game.act(
            `I ask ${them!.name} to teach me the second one`
        ) as Played;
        const priced = (back.toolCalls ?? [])
            .filter(call => call.name === 'engine.priceTheAsk')
            .map(call => call.summary)
            .join(' ');

        // Settled on the second and not on the first, which is the whole claim:
        // a list nobody wrote down is a list no ordinal can be counted against,
        // and before this the phrase was dropped and the question asked again.
        expect(priced, priced).toContain(them!.offers[1]!);
        expect(priced, priced).not.toContain(them!.offers[0]!);
    }, 300_000);

    /**
     * A narrator that writes past the list does not get to delete it.
     *
     * The prompt carries the rule and a prompt is an instruction, so the list a
     * player has to answer goes on `required` as well - which `withRequiredLines`
     * puts back whatever the prose did. Scripted here with a narration that
     * mentions neither art, which is the failure mode being guarded.
     */
    it('cannot have the arts narrated away', async () => {
        const provider = new ScriptedProvider({
            narrations: ['He looks at you for a while and says nothing you can use.']
        });
        const harness = await makeGameInWorld({
            seed: 'teach-q-1', worldSeed: WORLD, provider
        });
        await harness.game.newRun('Asker');
        const them = somebodyWithSeveralOnOffer(harness);
        expect(them).not.toBeNull();

        const said = await harness.game.act(`I ask ${them!.name} to teach me`) as Played;
        const text = said.narration ?? '';
        for (const art of them!.offers) expect(text, text).toContain(art);
    }, 300_000);
});
