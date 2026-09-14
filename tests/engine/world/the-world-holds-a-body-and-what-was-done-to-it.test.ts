/**
 * A persistent body state on the world's own people: the seal, and what a body
 * shows to somebody standing in front of it.
 *
 * ── WHAT WAS ACTUALLY MISSING, AND WHAT WAS NOT ──────────────────────────
 *
 * `NpcRecord` has carried `cultivation.injuries` and `cultivation.hp` since the
 * world started fighting, with `carryingWounds` as the one write path and
 * `woundsCarriedBy` / `bodyStandingOn` as the reads, and mental wounds are rows
 * in the same array with `nature: 'mental'` on the catalog row. So wounds were
 * not the gap. Two things were:
 *
 *   THE SEAL     `qiSeal` was a `cultivators` column and nothing else, so a
 *                house could seal only somebody a run was being played through.
 *                The punishment hall reported honestly at runtime that it could
 *                not seal anybody the world merely holds, which is everybody it
 *                ever sentences.
 *   THE READ     every wound row in `wounds.ts` carries a `presentation` -
 *                what somebody with it is LIKE to meet - authored with the
 *                wound and, measured before this landed, read by nothing
 *                anywhere in `src/`. The only thing that ever put a wound in
 *                front of a player was the COUNT, which puts somebody at
 *                `mending`, so a one-armed elder and a man with a bruise read
 *                out identically.
 *
 * ── THE CONSTRAINT THE SHAPE WAS CHOSEN AGAINST ──────────────────────────
 *
 * The world advance is superlinear and most of a roster is dead - measured
 * elsewhere at 539 alive out of 2,905 at year 400 - so nothing added here may
 * cost a per-person-per-day pass, and a dead person's body state must never
 * change on its own. Both halves are written on an event and read on demand: a
 * seal expires by comparing the day against `liftsOnDay`, so no sweep retires
 * one, and the presentation is computed for one person at the moment somebody
 * looks at them. `a seal is not retired by anybody visiting the row` below is
 * the assertion that pins it.
 *
 * RED-CHECKED, every assertion. Returning the stored seal unconditionally from
 * `theSealOn` fails the lift; dropping the seal guard in `readyToStrike` fails
 * the strike; returning the wound's `name` instead of its `presentation` fails
 * the leak check; sorting `theWoundThatShows` by severity alone fails the
 * maiming.
 */

import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../../src/storage/migrations';
import { WorldStateRepository } from '../../../src/storage/repos/world-state.repo';
import { createWorld } from '../../../src/engine/world/world-state';
import {
    createNpc,
    carryingWounds,
    maxBodyOf,
    sealLaidOn,
    sealLifted,
    theSealOn
} from '../../../src/engine/world/npc-state';
import {
    theWoundThatShows,
    whatTheirBodyShows
} from '../../../src/engine/world/what-a-body-shows-when-somebody-walks-up';
import { whatAnEndingLeavesToTheHouse }
    from '../../../src/engine/world/a-house-that-ends-one-of-its-own-keeps-what-they-had';
import { readyToStrike } from '../../../src/engine/world/an-npc-striking-at-the-next-wall';
import { makeObject, transferPossession, ruin } from '../../../src/engine/world/possessions';
import { WOUND_TYPES, getWoundType } from '../../../src/data/cultivation/wounds';
import { DAYS_PER_YEAR } from '../../../src/engine/cultivation/cultivation';
import type { Injury } from '../../../src/schema/cultivation';

const A_DAY = 1_000;

function somebody(id = 'them', ordinal = 12) {
    return createNpc('body-state-seed', {
        id, name: 'Them', bornOnDay: 0, onDay: A_DAY,
        cultivation: { realmOrdinal: ordinal }
    });
}

/**
 * A wound of an authored kind, minted by hand.
 *
 * The key is read OUT of the catalog rather than typed, because a key typed here
 * is a key that goes stale the next time one is retired - which has happened
 * once already and is why `currentWoundKey` exists.
 */
function wound(key: string, over: Partial<Injury> = {}): Injury {
    const row = getWoundType(key)!;
    return {
        id: `w-${key}-${over.sustainedOnTurn ?? 0}`,
        severity: row.severities[row.severities.length - 1],
        source: 'combat',
        description: row.description,
        sustainedOnTurn: 0,
        treated: false,
        cultivationPenalty: 0.25,
        breakthroughPenalty: 0.15,
        woundType: key,
        ...over
    };
}

const A_MAIMING = WOUND_TYPES.find(row => row.permanent && row.nature === 'physical')!;
const HEALS = WOUND_TYPES.find(row => !row.permanent)!;

// ─────────────────────────────────────────────────────────────────────────
// THE SEAL
// ─────────────────────────────────────────────────────────────────────────

describe('a seal is a fact about one of the world\'s own people', () => {
    it('is null on somebody nobody has laid one on', () => {
        expect(somebody().cultivation.seal).toBeNull();
        expect(theSealOn(somebody(), A_DAY)).toBeNull();
    });

    it('goes on, and is read back off the record', () => {
        const held = sealLaidOn(somebody(), {
            liftsOnDay: A_DAY + 365, byId: 'an-elder', note: 'held', sinceDay: A_DAY
        }, A_DAY);
        expect(theSealOn(held, A_DAY)?.byId).toBe('an-elder');
    });

    /**
     * THE WHOLE COST ARGUMENT, AS AN ASSERTION.
     *
     * Nothing visits the row between the day it goes on and the day it lifts.
     * The record is byte-identical on both days and the ANSWER is different,
     * which is what makes a roster of any size free: there is no pass that has
     * to walk the living to expire a term, and therefore none that walks the
     * dead either.
     */
    it('is not retired by anybody visiting the row', () => {
        const held = sealLaidOn(somebody(), {
            liftsOnDay: A_DAY + 365, byId: 'an-elder', note: 'held', sinceDay: A_DAY
        }, A_DAY);
        expect(theSealOn(held, A_DAY + 364)).not.toBeNull();
        expect(theSealOn(held, A_DAY + 365)).toBeNull();
        // The stored row never moved. Only the question did.
        expect(held.cultivation.seal).not.toBeNull();
    });

    it('holds forever where no day was put on it', () => {
        const held = sealLaidOn(somebody(), {
            liftsOnDay: null, byId: 'an-elder', note: 'held', sinceDay: A_DAY
        }, A_DAY);
        expect(theSealOn(held, A_DAY + 1_000_000)).not.toBeNull();
    });

    it('comes off when a hand takes it off', () => {
        const held = sealLaidOn(somebody(), {
            liftsOnDay: null, byId: 'an-elder', note: 'held', sinceDay: A_DAY
        }, A_DAY);
        expect(theSealOn(sealLifted(held, A_DAY + 10), A_DAY + 10)).toBeNull();
    });

    /**
     * A LID AND NOT A WOUND, which is the distinction the seal module states and
     * this is the mechanical half of it. Somebody under one is not climbing, and
     * `settled` stays FALSE - the day it lifts they pick up where they were,
     * which is exactly what a wound would not let them do.
     */
    it('stops somebody climbing, and does not settle them', () => {
        const conditions = {
            ambient: 'normal' as const, rateMultiplier: 1,
            guideOrdinal: null, manualCeiling: 40
        };
        // THE SAME PERSON, sealed and not. A second id would roll a different
        // spirit root and different attributes, and the comparison below would
        // be measuring the roll rather than the seal.
        const free = somebody('under-a-seal');

        // THE DAY THEY WOULD BE READY, asked of the engine rather than typed. A
        // day chosen by hand is a day the rate table can walk away from, and a
        // seal asserted against somebody who was not going to strike anyway
        // asserts nothing - which is how the first cut of this test passed with
        // the guard removed.
        const needed = readyToStrike(free, A_DAY, conditions).yearsNeeded;
        expect(Number.isFinite(needed)).toBe(true);
        const theDay = A_DAY + Math.ceil(needed * DAYS_PER_YEAR) + 1;
        expect(readyToStrike(free, theDay, conditions).ready).toBe(true);

        const held = sealLaidOn(somebody('under-a-seal'), {
            liftsOnDay: theDay + 1, byId: 'an-elder', note: 'held', sinceDay: A_DAY
        }, A_DAY);
        const under = readyToStrike(held, theDay, conditions);
        expect(under.ready).toBe(false);
        expect(under.settled).toBe(false);

        // And the day it lifts they are exactly where they were. Asserted
        // against the UNSEALED person rather than against a number, so the test
        // says "a lifted seal is no seal" instead of pinning a rate.
        expect(readyToStrike(held, theDay + 1, conditions))
            .toEqual(readyToStrike(free, theDay + 1, conditions));
    });
});

/**
 * A FIELD NOTHING PERSISTS READS AS "NOBODY IS SEALED", with complete
 * confidence, and every query over it answers correctly.
 *
 * The same argument `a-status-survives-a-save.test.ts` makes about a status, and
 * it is worse here: a seal that quietly vanished on a reload would give the
 * house's prisoner their pool back overnight and nothing anywhere would report
 * it. Both shapes are round-tripped - a term and a seal with no day on it, which
 * is the one that has to come back as `null` rather than as the string.
 */
describe('a seal survives a save', () => {
    it('round-trips, both with a term on it and without', () => {
        const db = new Database(':memory:');
        db.pragma('foreign_keys = ON');
        migrate(db);
        const repo = new WorldStateRepository(db);

        const state = createWorld({ seed: 'seal-round-trip', regionCount: 1 });
        const where = state.locations[0].id;
        const there = (id: string) => ({ ...somebody(id), locationId: where });
        state.npcs.push(
            sealLaidOn(there('a-term'), {
                liftsOnDay: A_DAY + 365, byId: 'an-elder', note: 'held for a year',
                sinceDay: A_DAY
            }, A_DAY),
            sealLaidOn(there('no-day-on-it'), {
                liftsOnDay: null, byId: null, note: 'no day was put on it', sinceDay: A_DAY
            }, A_DAY),
            there('nobody-touched-them')
        );
        const [held, forever, untouched] = state.npcs.slice(-3);

        repo.saveWorld(state);
        const loaded = repo.loadWorld(state.id)!;
        const back = (id: string) => loaded.npcs.find(npc => npc.id === id)!;
        expect(back(held.id).cultivation.seal).toEqual(held.cultivation.seal);
        // Null and not the string 'null', which is what decides whether the
        // seal ever lifts.
        expect(back(forever.id).cultivation.seal!.liftsOnDay).toBeNull();
        expect(back(forever.id).cultivation.seal!.byId).toBeNull();
        // And somebody nobody sealed comes back carrying nothing rather than
        // undefined, which is the shape every reader dereferences without a
        // guard.
        expect(back(untouched.id).cultivation.seal).toBeNull();

        db.close();
    });
});

// ─────────────────────────────────────────────────────────────────────────
// WHAT A BODY SHOWS
// ─────────────────────────────────────────────────────────────────────────

describe('what a body shows to somebody standing in front of it', () => {
    it('says nothing about a whole person, which is nearly everybody', () => {
        expect(whatTheirBodyShows(somebody())).toBeNull();
        expect(somebody().cultivation.hp).toBe(maxBodyOf(somebody()));
    });

    it('shows the maiming over an open wound of the same weight', () => {
        // Both crippling, and the open one is the OLDER, so severity and age
        // between them would pick the open one. Only permanence picks the
        // maiming, which is the ordering this asserts - the first cut used a
        // milder open wound and passed with the permanence term deleted.
        expect(HEALS.severities).toContain('crippling');
        const hurt = carryingWounds(somebody(), [
            wound(HEALS.key, { severity: 'crippling', sustainedOnTurn: 0 }),
            wound(A_MAIMING.key, { severity: 'crippling', sustainedOnTurn: 9 })
        ], A_DAY);
        expect(theWoundThatShows(hurt.cultivation.injuries)?.woundType).toBe(A_MAIMING.key);
        expect(whatTheirBodyShows(hurt)).toBe(A_MAIMING.presentation);
    });

    it('says nothing about a wound somebody paid to close', () => {
        const mended = carryingWounds(somebody(), [
            wound(HEALS.key, { treated: true })
        ], A_DAY);
        // Scar tissue is priced by `scarTempering` and is not what somebody
        // looks like now.
        expect(whatTheirBodyShows(mended)).toBeNull();
    });

    /**
     * THE PERCEPTION RULE, AS AN ASSERTION.
     *
     * What goes to a scene is the presentation and never the record. A stranger
     * in a square does not learn the wound's name, what grade of pill would
     * answer it, or that it is permanent - those are columns, and no column is
     * on anybody's face.
     */
    it('hands over the manner and never the record', () => {
        const hurt = carryingWounds(somebody(), [wound(A_MAIMING.key)], A_DAY);
        const shown = whatTheirBodyShows(hurt)!;
        expect(shown).not.toContain(A_MAIMING.name);
        expect(shown).not.toContain(A_MAIMING.key);
        expect(shown).not.toContain(A_MAIMING.treatment);
    });

    /**
     * A row reconstructed from a count has no authored wound behind it, and
     * `woundsCarriedBy` says so by leaving `woundType` null. A number is not a
     * thing anybody can look at, and inventing a presentation for one would be
     * the engine reading its own columns aloud in a character's voice.
     */
    it('says nothing for a saved row that holds a count and no list', () => {
        const legacy = somebody();
        legacy.cultivation.untreatedInjuries = 2;
        expect(whatTheirBodyShows(legacy)).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────
// AND WHAT AN EXECUTION LEAVES TO THE HOUSE
// ─────────────────────────────────────────────────────────────────────────

describe('what a house keeps off somebody it ended', () => {
    const held = (id: string, ownerId: string | null = null) => transferPossession(
        makeObject({ id, name: `a thing called ${id}`, kind: 'artifact', ownerId, ownerName: '' }),
        { onDay: 1, toHolderId: 'them', toHolderName: 'Them', how: 'bought' }
    );

    const take = (objects: any[], stones = 0) => whatAnEndingLeavesToTheHouse({
        objects, stones, offenderId: 'them',
        houseId: 'house', houseName: 'The House', onDay: 50, note: 'the room said so'
    });

    it('takes what they were holding, and says how it took it', () => {
        const moved = take([held('a-blade')]).objects;
        expect(moved).toHaveLength(1);
        expect(moved[0].possessorId).toBe('house');
        expect(moved[0].ownerId).toBe('house');
        expect(moved[0].provenance[moved[0].provenance.length - 1].how).toBe('confiscated');
    });

    it('leaves alone what was never in their hands', () => {
        const elsewhere = makeObject({ id: 'elsewhere', name: 'not theirs', kind: 'artifact' });
        expect(take([elsewhere]).objects).toEqual([]);
    });

    /**
     * A sentence is not a way to acquire somebody else's property. The thing
     * moves - it was on the body and the body is gone - and the register stays
     * where it was, so the house that owns it still has a claim to make. This
     * is `transferPossession`'s own default rule about a taking, kept.
     */
    it('moves a third party\'s thing without taking its title', () => {
        const moved = take([held('borrowed', 'another-house')]).objects;
        expect(moved[0].possessorId).toBe('house');
        expect(moved[0].ownerId).toBe('another-house');
    });

    it('does not fill a treasury with wreckage', () => {
        const broken = ruin(held('broken'), { onDay: 2, source: 'a fight' });
        // `ruin` clears the possessor, so this is belt and braces: a ruined row
        // that somehow still names a holder is still not property.
        expect(take([{ ...broken, possessorId: 'them' }]).objects).toEqual([]);
    });

    it('carries the stones across as a number, floored at nothing', () => {
        expect(take([], 40).stones).toBe(40);
        expect(take([], -5).stones).toBe(0);
    });
});
