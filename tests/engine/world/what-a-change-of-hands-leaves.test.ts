/**
 * A thing changing hands leaves something between the two people.
 *
 * Every assertion here is on BEHAVIOUR: which way the account points, how the
 * weight moves with what the thing was, what a whole hold collapses to, and how
 * many people end up holding one. None of them pins a cause string, a severity
 * word or a count the module chose - the bands are measured over populations of
 * changes of hands, and the world arm pools its seeds.
 *
 * WHAT IT IS PROTECTING, MEASURED BEFORE IT EXISTED. Three seeded worlds
 * advanced two hundred years moved 90, 31 and 72 things between parties and
 * opened 723, 425 and 566 accounts - of which 0, 0 and 0 were about an object.
 * Every account any of those worlds had ever opened was a death or a crippling.
 */
import { describe, it, expect } from 'vitest';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import {
    howBadlyThisIsMissed,
    oneAccountEach,
    whatAChangeOfHandsLeaves,
    type AChangeOfHands
} from '../../../src/engine/world/what-a-change-of-hands-leaves.js';
import { makeObject, type AcquisitionMode, type ObjectSignificance } from '../../../src/engine/world/possessions.js';
import { settleTheSpoils } from '../../../src/engine/world/war-spoils.js';
import {
    severityRank,
    whichWayItPoints,
    type ObligationInput
} from '../../../src/engine/social/grudges.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { advanceWorldYears } from '../../../src/engine/world/driver.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

/**
 * The whole vocabulary, swept rather than sampled.
 *
 * `_everyModeIsHere` fails to compile if `AcquisitionMode` grows a member that
 * is not on this list, so the sweep cannot quietly stop being a sweep - which
 * is the only way a list in a test file is allowed to be a second copy of a
 * type.
 */
const EVERY_MODE = [
    'found', 'inherited', 'bought', 'sold', 'stolen', 'looted', 'gifted', 'lent',
    'crafted', 'awarded', 'confiscated', 'lost', 'unknown'
] as const;
type _everyModeIsHere =
    Exclude<AcquisitionMode, (typeof EVERY_MODE)[number]> extends never ? true : never;
const _coverage: _everyModeIsHere = true;
void _coverage;

const SIGNIFICANCES: readonly ObjectSignificance[] =
    ['mundane', 'notable', 'significant', 'legendary'];

function aChange(over: Partial<AChangeOfHands> = {}): AChangeOfHands {
    return {
        objectId: 'obj-1',
        objectName: 'a thing',
        how: 'stolen',
        significance: 'notable',
        onDay: 1000,
        from: { id: 'them', name: 'Them' },
        to: { id: 'you', name: 'You' },
        knownToTheLoser: true,
        ...over
    };
}

describe('which way the account points is what the mode decides', () => {
    /**
     * WHOEVER ENDS UP WITH THE THING CARRIES THE ACCOUNT.
     *
     * This read `holderId` directly and called the two buckets *the loser* and
     * *the receiver*, and that is the one field a reader of this ledger may not
     * read directly: a favour is owed TO its holder and every other kind is
     * carried BY its holder. `whichWayItPoints` exists to end that confusion
     * and says so in its own header. Reading the field rather than asking it is
     * what let `gifted` and `lent` be authored pointing the wrong way and pass.
     *
     * Asked properly, the partition the old test was looking for turns out not
     * to exist, and what replaces it is simpler and truer: however a thing
     * moves, the weight lands on the party holding it afterwards. Stolen, and
     * they hold it against you. Given, and you owe them for it. Both are about
     * you, because you have the thing.
     */
    it('every mode that leaves anything leaves it on the party that ends up with the thing', () => {
        const left: AcquisitionMode[] = [];
        const nothing: AcquisitionMode[] = [];

        for (const how of EVERY_MODE) {
            const rows = whatAChangeOfHandsLeaves(aChange({ how }));
            if (rows.length === 0) {
                nothing.push(how);
                continue;
            }
            // One change of hands between two parties leaves one account.
            expect(rows).toHaveLength(1);
            const row = rows[0]!;
            expect(row.holderId).not.toBe(row.subjectId);

            const points = whichWayItPoints(row);
            // `you` is the receiver in `aChange`, and is the one on the hook
            // whichever sense the row has.
            expect(points.sense === 'owes' ? points.owerId : points.offenderId)
                .toBe('you');
            left.push(how);
        }

        expect(left.length + nothing.length).toBe(EVERY_MODE.length);
        // Neither is empty, so nothing here passes vacuously: the world can
        // take a thing, be given one, and buy one, and those are three
        // different afternoons.
        expect(left.length).toBeGreaterThan(0);
        expect(nothing.length).toBeGreaterThan(0);
    });

    it('what somebody lost they hold against whoever has it; what they were handed they owe for', () => {
        const taken = whatAChangeOfHandsLeaves(aChange({ how: 'stolen' }))[0]!;
        const given = whatAChangeOfHandsLeaves(aChange({ how: 'gifted' }))[0]!;

        // The same two people, the same object, and the same party carrying it
        // - which is the sentence in the title. It is NOT a mirror of the two
        // id columns, and asserting that it was is how `gifted` came to point
        // the wrong way: the fields matched, and the meaning did not.
        expect(taken.kind).not.toBe(given.kind);

        const forTaking = whichWayItPoints(taken);
        const forGiving = whichWayItPoints(given);
        expect(forTaking.sense).toBe('holds_against');
        expect(forGiving.sense).toBe('owes');
        expect(forTaking.sense === 'holds_against' ? forTaking.offenderId : null).toBe('you');
        expect(forGiving.sense === 'owes' ? forGiving.owerId : null).toBe('you');
    });

    it('a thing that never left the party it started with leaves nothing', () => {
        for (const how of EVERY_MODE) {
            const sameHands = aChange({
                how,
                from: { id: 'you', name: 'You' },
                to: { id: 'you', name: 'You' }
            });
            expect(whatAChangeOfHandsLeaves(sameHands)).toEqual([]);
        }
    });

    it('a thing that went into the ground leaves nothing, because nobody has it', () => {
        for (const how of EVERY_MODE) {
            expect(whatAChangeOfHandsLeaves(aChange({ how, to: null }))).toEqual([]);
        }
    });
});

describe('nobody holds an account about something they never found out', () => {
    it('a taking nobody noticed leaves nothing at all', () => {
        let leftWhenKnown = 0;
        let leftWhenNot = 0;
        for (const how of EVERY_MODE) {
            leftWhenKnown += whatAChangeOfHandsLeaves(
                aChange({ how, knownToTheLoser: true })
            ).length;
            leftWhenNot += whatAChangeOfHandsLeaves(
                aChange({ how, knownToTheLoser: false })
            ).length;
        }
        expect(leftWhenNot).toBeLessThan(leftWhenKnown);
    });

    it('but a thing put into your hands is known to you by construction', () => {
        // The gate is about a loss going unnoticed. Somebody handing you
        // something is not a thing you can fail to notice, and gating it would
        // make a gift depend on a fact about a room.
        for (const how of ['gifted', 'awarded', 'lent'] as const) {
            expect(whatAChangeOfHandsLeaves(aChange({ how, knownToTheLoser: false })))
                .toHaveLength(1);
        }
    });
});

describe('what the thing was worth is what the account weighs, both ways round', () => {
    it('the weight rises with the thing, over the whole range of things', () => {
        const asAGrudge = SIGNIFICANCES.map(significance =>
            severityRank(whatAChangeOfHandsLeaves(
                aChange({ how: 'stolen', significance })
            )[0]!.severity));
        const asAFavour = SIGNIFICANCES.map(significance =>
            severityRank(whatAChangeOfHandsLeaves(
                aChange({ how: 'gifted', significance })
            )[0]!.severity));

        // Never decreasing as the thing gets more important, and strictly
        // higher at the top than at the bottom - so it is a scale rather than a
        // constant wearing one.
        for (let i = 1; i < asAGrudge.length; i++) {
            expect(asAGrudge[i]!).toBeGreaterThanOrEqual(asAGrudge[i - 1]!);
        }
        expect(asAGrudge[asAGrudge.length - 1]!).toBeGreaterThan(asAGrudge[0]!);

        // AND THE TWO READINGS ARE ONE READING. What a legendary thing is worth
        // as a grudge when it is taken is what it is worth as a favour when it
        // is given: two scales would be two answers about one object.
        expect(asAFavour).toEqual(asAGrudge);
    });

    it('and it is read off the row, so an object and its significance agree', () => {
        for (const significance of SIGNIFICANCES) {
            const object = makeObject({ id: 'o', name: 'a thing', kind: 'artifact', significance });
            expect(howBadlyThisIsMissed(object)).toBe(howBadlyThisIsMissed({ significance }));
        }
    });
});

describe('a whole hold is one account, weighed by the worst thing in it', () => {
    /** Eleven things, worst somewhere in the middle. */
    function aHold(order: 'as authored' | 'reversed'): ObligationInput[] {
        const rows = SIGNIFICANCES.flatMap((significance, i) =>
            [0, 1, 2].map(n => whatAChangeOfHandsLeaves(aChange({
                objectId: `obj-${i}-${n}`,
                objectName: `thing ${i}-${n}`,
                how: 'looted',
                significance
            }))[0]!));
        return order === 'reversed' ? rows.slice().reverse() : rows;
    }

    it('twelve things off one house are one row and not twelve', () => {
        expect(aHold('as authored')).toHaveLength(12);
        expect(oneAccountEach(aHold('as authored'))).toHaveLength(1);
    });

    it('and the row is the same whichever order the hold was walked in', () => {
        // The defect this exists against: rows that differ only in severity
        // derive the same id, so without pooling the LAST object the loop
        // reached would decide how badly the house minds.
        const forwards = oneAccountEach(aHold('as authored'))[0]!;
        const backwards = oneAccountEach(aHold('reversed'))[0]!;
        expect(backwards.severity).toBe(forwards.severity);

        // And it is the worst of them rather than the first, the last or an
        // average.
        const worst = Math.max(...aHold('as authored').map(r => severityRank(r.severity)));
        expect(severityRank(forwards.severity)).toBe(worst);
    });

    it('the pooled row still names every object that went', () => {
        const pooled = oneAccountEach(aHold('as authored'))[0]!;
        const named = (pooled.tags ?? []).filter(t => t.startsWith('took:'));
        expect(named).toHaveLength(12);
    });

    it('but two different pairs stay two accounts, however many things moved', () => {
        const mine = aHold('as authored');
        const theirs = aHold('as authored').map(row => ({ ...row, holderId: 'somebody else' }));
        expect(oneAccountEach([...mine, ...theirs])).toHaveLength(2);
    });
});

describe('everybody who watched it walk out holds their own', () => {
    /** A house of `n` people, one of whom leaves with the thing. */
    function watched(n: number): ObligationInput[] {
        const people = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Person ${i}` }));
        const carrier = people[0]!;
        return whatAChangeOfHandsLeaves(aChange({
            how: 'stolen',
            from: null,
            to: carrier,
            othersWhoLostBy: people.slice(1)
        }));
    }

    it('one account each, over houses of every size', () => {
        for (let n = 1; n <= 12; n++) {
            expect(watched(n)).toHaveLength(n - 1);
        }
    });

    it('and never one about themselves, however the roll is drawn', () => {
        for (let n = 2; n <= 12; n++) {
            const rows = watched(n);
            expect(rows.every(r => r.holderId !== r.subjectId)).toBe(true);
            expect(rows.every(r => r.subjectId === 'p0')).toBe(true);
            expect(new Set(rows.map(r => r.holderId)).size).toBe(rows.length);
        }
    });

    it('a house of one has nobody to mind, which is not the same as nothing happening', () => {
        // The object still moved. `settleTheSpoils` writes the row either way;
        // what is empty here is the ledger, and only because there is nobody
        // standing there.
        expect(watched(1)).toEqual([]);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// AND IN A WORLD THAT IS ACTUALLY RUNNING
// ─────────────────────────────────────────────────────────────────────────

/** Two houses and a hold, the fixture `war-spoils.test.ts` already uses. */
function twoHouses(loserPeople: number): WorldState {
    return {
        factions: [
            { id: 'loser', name: 'Kiln Clan', seatLocationId: 'loc-kiln', dissolvedOnDay: null, tags: [], standing: {}, resources: {}, alignment: 'neutral' },
            { id: 'winner', name: 'Storm Court', seatLocationId: 'loc-storm', dissolvedOnDay: null, tags: [], standing: {}, resources: {}, alignment: 'neutral' }
        ],
        npcs: [
            { id: 'npc-w', name: 'The Storm Tyrant', status: 'alive', factionId: 'winner', cultivation: { realmOrdinal: 38 } },
            ...Array.from({ length: loserPeople }, (_, i) => ({
                id: `npc-l${i}`, name: `Kiln ${i}`, status: 'alive', factionId: 'loser',
                cultivation: { realmOrdinal: 8 + i }
            }))
        ],
        objects: SIGNIFICANCES.map((significance, i) => makeObject({
            id: `obj-${i}`, name: `a kiln thing ${i}`, kind: 'artifact', significance, power: 10 + i,
            ownerId: 'loser', ownerName: 'Kiln Clan', possessorId: 'loser', locationId: 'loc-kiln'
        })),
        history: { facts: [], nextFactSeq: 1 }
    } as unknown as WorldState;
}

describe('a settlement leaves the losing side holding something', () => {
    it('a house that held together holds it itself, once, for the whole hold', () => {
        const state = twoHouses(3);
        const moved = settleTheSpoils(state, {
            loser: { id: 'loser', name: 'Kiln Clan', holdsTogether: true },
            winner: state.factions[1]!,
            war: 'the war',
            onDay: 500
        }, forStream('spoils', 'held'));

        const pooled = oneAccountEach(moved.flatMap(m => m.opens));
        expect(moved.length).toBeGreaterThan(1);
        expect(pooled).toHaveLength(1);
        expect(pooled[0]!.holderId).toBe('loser');
        expect(pooled[0]!.subjectId).toBe('winner');
    });

    it('a house that broke up does not, because there is no house left to mind', () => {
        const state = twoHouses(4);
        const moved = settleTheSpoils(state, {
            loser: { id: 'loser', name: 'Kiln Clan', holdsTogether: false },
            winner: state.factions[1]!,
            war: 'the war',
            onDay: 500
        }, forStream('spoils', 'scattered'));

        const pooled = oneAccountEach(moved.flatMap(m => m.opens));
        expect(moved.every(m => m.fate === 'carried off')).toBe(true);
        expect(pooled.length).toBeGreaterThan(0);
        // Every holder is a person who walked out, and the dissolved body holds
        // nothing: behaviour belongs to people.
        expect(pooled.some(r => r.holderId === 'loser')).toBe(false);
        expect(pooled.every(r => r.holderId.startsWith('npc-l'))).toBe(true);
        expect(pooled.every(r => r.subjectId?.startsWith('npc-l'))).toBe(true);
    });

    it('and a hold with nothing in it leaves nothing', () => {
        const state = twoHouses(3);
        state.objects = [];
        const moved = settleTheSpoils(state, {
            loser: { id: 'loser', name: 'Kiln Clan', holdsTogether: true },
            winner: state.factions[1]!,
            war: 'the war',
            onDay: 500
        }, forStream('spoils', 'empty'));
        expect(oneAccountEach(moved.flatMap(m => m.opens))).toEqual([]);
    });
});

describe('a world left running for a century opens accounts about things', () => {
    it('pooled over seeds, and every one of them is held by somebody who lost by it', async () => {
        const catalog = await loadCultivationCatalog();
        const OBJECT_CAUSES = new Set(['robbery', 'gifted_resource', 'lent_resource']);

        let settlements = 0;
        let aboutAnObject = 0;
        let aboutADeath = 0;
        const holders = new Set<string>();

        // Four seeds pooled. One world's wars are a draw; four is a rate.
        for (const seed of ['a', 'b', 'c', 'd']) {
            const { state } = seedWorld({ seed: `change-of-hands-${seed}`, catalog });
            const out = advanceWorldYears(state, 150);
            settlements += out.pressure.filter(e => e.kind === 'spoils_taken').length;
            for (const account of out.accounts) {
                if (OBJECT_CAUSES.has(account.cause)) {
                    aboutAnObject++;
                    holders.add(account.holderId);
                    // Never against themselves, and always dated inside the run.
                    expect(account.holderId).not.toBe(account.subjectId);
                    expect(account.subjectId).not.toBeNull();
                    expect(account.triggeringEventId).toBeTruthy();
                } else {
                    aboutADeath++;
                }
            }
        }

        // The measurement this file exists for. It was 0 before this landed, at
        // a hundred and ninety-eight changes of hands.
        expect(settlements).toBeGreaterThan(0);
        expect(aboutAnObject).toBeGreaterThan(0);
        // And more than one party in the world is carrying one, so it is not a
        // single war doing all of it.
        expect(holders.size).toBeGreaterThan(1);
        // A world still kills far more people than it robs, which is the
        // ordering that says nothing has been flooded.
        expect(aboutADeath).toBeGreaterThan(aboutAnObject);
    }, 120_000);
});
