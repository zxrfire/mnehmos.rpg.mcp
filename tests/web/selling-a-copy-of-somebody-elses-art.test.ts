/**
 * Selling a copy of an art that is somebody's - the act, its gate, and what
 * the house does about it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE TWO RULINGS THIS IS THE TEST FOR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The design owner, on a disciple selling a copy of their own house's art:
 *
 *   > if a disciple had the gall to write it out without approval the sect
 *   > would easily punish them - maybe cripple their cultivation so they
 *   > couldn't do it again ... or a dao oath
 *
 * and then, on why that does not need a prohibition anywhere:
 *
 *   > how would you be able to copy these signature arts? You'd have to master
 *   > it, which would mean you are at sect leader or higher - unless you have 2
 *   > people at 44, one is pissed, leaves, copies it, the sect can do nothing.
 *
 * So there are three claims to hold down, and they are what this file asserts:
 *
 *   1. THE ACT IS NEVER FORBIDDEN. Every refusal on the path is about ability -
 *      never taught it, or never took it to the end - and none is about
 *      permission.
 *   2. THE GATE IS MASTERY, so the set of people who can leak a house's
 *      signature is tiny and is drawn from the top of that house.
 *   3. THE HOUSE ANSWERS WHEN IT FINDS OUT, and finding out is `KnowingStage`.
 *      A leak nobody could place opens no account at all.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AND THE DEFECT IT CLOSES, WHICH IS A PREDICATE THAT ANSWERED TWO QUESTIONS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `isCommonlyHeld` was being used as the ownership line. Its first clause
 * returns true for anything with no `cap`, which is every fighting art in the
 * catalog, so `betrayalOfSelling` priced selling a house's signature at zero
 * and `whatIsInTheirHands` marked it freely copyable by whoever held one.
 * Measured on the shipped catalog: 51 techniques taught by fewer than
 * `COMMON_HOUSE_COUNT` houses read as common, 20 of them somebody's own
 * `signatureTechniqueId`.
 */

import { describe, expect, it } from 'vitest';

import {
    betrayalOfSelling,
    couldWriteOutACopy,
    housesTeaching,
    isCommonlyHeld,
    masteryBarFor,
    noHouseCanCallItTheirs,
    unauthorisedPractice,
    whoseArt,
    COMMON_HOUSE_COUNT,
    FULLY_MASTERED
} from '../../src/engine/world/manuals';
import {
    theLeakAsADeed,
    theStageAWitnessReaches,
    WHAT_A_LEAK_COSTS_THE_HOUSE
} from '../../src/engine/social-leverage/selling-a-copy-of-somebody-elses-art';
import { whatItWasWorth } from '../../src/engine/social-leverage/what-a-deed-leaves';
import { canPointAt } from '../../src/engine/social/discovery';
import { whatTheirReferenceAffords } from '../../src/engine/world/recognising-whose-art-you-just-watched';
import { whatThisPersonWouldPartWith } from '../../src/engine/world/what-somebody-standing-here-would-part-with';
import { SECTS } from '../../src/data/cultivation/sects';
import { TECHNIQUES, getTechnique } from '../../src/data/cultivation/techniques';
import { makeGameInWorld, engineCalls } from './harness';

/** The Azure Cloud Pavilion's own sword. One house teaches it. */
const PAVILION = 'sect-azure-cloud-pavilion';
const THE_SWORD = 'void-piercing-sword-domain';

// ─────────────────────────────────────────────────────────────────────────
// THE PREDICATE SPLIT
// ─────────────────────────────────────────────────────────────────────────

describe('whose an art is, and whether a stall stocks it, are different questions', () => {
    it('a house signature is somebody\'s even though a stall would never carry it', () => {
        expect(housesTeaching(THE_SWORD)).toBe(1);
        // The old line, kept visible: this is exactly the answer that made
        // twelve signature arts sellable by anybody.
        expect(isCommonlyHeld(THE_SWORD)).toBe(true);
        expect(noHouseCanCallItTheirs(THE_SWORD)).toBe(false);
        expect(whoseArt(THE_SWORD)).toEqual([PAVILION]);
    });

    it('counts holders and nothing else - not height, not whether it has a cap', () => {
        for (const t of TECHNIQUES as readonly { id: string }[]) {
            const houses = housesTeaching(t.id);
            expect(noHouseCanCallItTheirs(t.id), t.id)
                .toBe(houses === 0 || houses >= COMMON_HOUSE_COUNT);
        }
    });

    /**
     * The measurement that produced the fix, asserted so it cannot come back.
     * Every one of these read as nobody's property before the split.
     */
    it('every signature art taught by one or two houses now prices as theirs', () => {
        const narrow = (SECTS as readonly { id: string; signatureTechniqueId?: string | null }[])
            .filter(s => s.signatureTechniqueId != null)
            .filter(s => {
                const houses = housesTeaching(s.signatureTechniqueId!);
                return houses > 0 && houses < COMMON_HOUSE_COUNT;
            });
        // Not a bare "more than zero": the shipped catalog has twenty, and a
        // content pass that quietly collapsed them would go unnoticed.
        expect(narrow.length).toBeGreaterThanOrEqual(15);
        for (const s of narrow) {
            expect(noHouseCanCallItTheirs(s.signatureTechniqueId!), s.id).toBe(false);
            // Sold by one of their own: the betrayal proper, not a trade.
            expect(betrayalOfSelling({ factionId: s.id }, s.signatureTechniqueId!, s.id), s.id)
                .toBeGreaterThanOrEqual(2);
        }
    });

    /**
     * The other half of the split, and the one that must not move. Narrowing
     * ownership must not narrow what a market stall carries: `COMMON_MANUAL_CAP`
     * exists so an unbacked nobody can own a road.
     */
    it('leaves market stock exactly where it was', () => {
        const primer = (TECHNIQUES as readonly { id: string; class?: string; cap?: number | null }[])
            .find(t => t.class === 'cultivation' && t.cap != null && Number(t.cap) <= 13);
        expect(primer).toBeTruthy();
        expect(isCommonlyHeld(primer!.id)).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE GATE IS MASTERY
// ─────────────────────────────────────────────────────────────────────────

describe('copying takes having mastered it, which is a fact about the holder', () => {
    it('the same art is copyable by one person and not by another', () => {
        const bar = masteryBarFor(THE_SWORD)!;
        expect(bar).toBeGreaterThan(0);
        // The house's own summit. The Pavilion stands at 41.
        expect(couldWriteOutACopy({ realmOrdinal: 41 }, THE_SWORD)).toBe(true);
        // A disciple who has been handed it and is climbing on it.
        expect(couldWriteOutACopy({ realmOrdinal: bar - 1 }, THE_SWORD)).toBe(false);
    });

    it('a per-person mastery figure beats the ordinal proxy in both directions', () => {
        expect(couldWriteOutACopy(
            { realmOrdinal: 44, masteryOfIt: 0.5 }, THE_SWORD
        )).toBe(false);
        expect(couldWriteOutACopy(
            { realmOrdinal: 0, masteryOfIt: FULLY_MASTERED }, THE_SWORD
        )).toBe(true);
    });

    it('leaves a gathering primer copyable by everybody holding one', () => {
        const primer = (TECHNIQUES as readonly { id: string; class?: string; cap?: number | null }[])
            .find(t => t.class === 'cultivation' && t.cap != null && Number(t.cap) <= 13)!;
        expect(couldWriteOutACopy({ realmOrdinal: 0 }, primer.id)).toBe(true);
    });

    /**
     * The market consequence, and the reason `whatMovesIsACopy` had to exist.
     * A fighting art opens and stops at the same rung, so without it a holder
     * who cannot write one out would have been shown offering the art out of
     * their own head - a transaction that does not exist.
     */
    it('somebody who cannot write one out has nothing to offer, and is told why', () => {
        const read = whatThisPersonWouldPartWith(
            { id: 'p', name: 'Somebody', ordinal: 22, spiritStones: 0, factionId: null },
            [{
                id: THE_SWORD,
                name: 'the sword',
                usableFrom: 21,
                usefulUntil: 21,
                listStones: 40,
                awkwardToHold: 1,
                whoWouldWantAWord: PAVILION,
                copyable: false,
                whatMovesIsACopy: true
            }]
        );
        expect(read.offers).toHaveLength(0);
        expect(read.withheld.map(w => w.why)).toEqual(['they_could_not_write_one_out']);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// WHAT A LEAK IS WORTH, AS A NUMBER THAT NEEDED A TEST
// ─────────────────────────────────────────────────────────────────────────

describe('the four rungs land on the four severities', () => {
    const leak = (rung: 1 | 2 | 3) => theLeakAsADeed({
        rung,
        ownerFactionId: PAVILION,
        sellerIsOfTheHouse: false,
        sellerName: 'Somebody',
        artName: 'the sword',
        stones: 10,
        onDay: 0,
        knownTo: [PAVILION],
        witnesses: 1
    })!;

    it.each([
        [1, 'serious'],
        [2, 'grave'],
        [3, 'unforgivable']
    ] as const)('rung %i weighs %s', (rung, severity) => {
        expect(whatItWasWorth(leak(rung))).toBe(severity);
    });

    it('is irreversible at every rung, because once it is out it is out', () => {
        for (const rung of [1, 2, 3] as const) expect(leak(rung).irreversible).toBe(true);
    });

    it('is monotone in the rung, so the two scales cannot cross', () => {
        const costs = [1, 2, 3].map(r => WHAT_A_LEAK_COSTS_THE_HOUSE[r as 1 | 2 | 3]);
        expect(costs).toEqual([...costs].sort((a, b) => a - b));
    });

    it('opens nothing at all where the art is nobody\'s', () => {
        expect(theLeakAsADeed({
            rung: 0, ownerFactionId: null, sellerIsOfTheHouse: false,
            sellerName: 'Somebody', artName: 'a primer', stones: 3, onDay: 0,
            knownTo: [], witnesses: 4
        })).toBeNull();
    });
});

describe('what a witness reaches is short of certainty on purpose', () => {
    it('only a flat reading lets a house point at anybody', () => {
        expect(canPointAt(theStageAWitnessReaches('certain'))).toBe(true);
        // Somebody who has admitted they could not tell a forgery does not get
        // a person crippled.
        expect(canPointAt(theStageAWitnessReaches('consistent'))).toBe(false);
        for (const reading of ['impression', 'nothing'] as const) {
            expect(theStageAWitnessReaches(reading)).toBe('unaware');
        }
    });

    /**
     * The reference ladder, read the way this act reads it. One of the house's
     * own is `known`, which is `certain`, which is what lets them point - and
     * a stranger with nothing gets nowhere however senior they are.
     */
    it('a member of the house recognises their own book and a stranger does not', () => {
        expect(canPointAt(theStageAWitnessReaches(whatTheirReferenceAffords('known')))).toBe(true);
        expect(canPointAt(theStageAWitnessReaches(whatTheirReferenceAffords('encountered')))).toBe(true);
        expect(canPointAt(theStageAWitnessReaches(whatTheirReferenceAffords('unaware')))).toBe(false);
        expect(canPointAt(theStageAWitnessReaches(whatTheirReferenceAffords('named')))).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// AND THE JOIN THAT IS NOT THIS ONE
// ─────────────────────────────────────────────────────────────────────────

describe('unauthorisedPractice answers the buyer\'s question, not the seller\'s', () => {
    it('fires on a house signature now that ownership is counted properly', () => {
        expect(unauthorisedPractice({ factionId: null }, THE_SWORD)).toEqual([PAVILION]);
    });

    /**
     * The reason it is NOT the join for a leak, asserted rather than asserted
     * in a comment: it drops your own house, which is the rung the whole
     * ruling is about.
     */
    it('goes silent about your own house, which is the case a leak cares most about', () => {
        expect(unauthorisedPractice({ factionId: PAVILION }, THE_SWORD)).toBeNull();
        expect(betrayalOfSelling({ factionId: PAVILION }, THE_SWORD, PAVILION)).toBe(2);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// PLAYED
// ─────────────────────────────────────────────────────────────────────────

describe('played: writing one out and selling it', () => {
    /**
     * Arranged, not asserted. The admin surface's own law - *the panel can set
     * preconditions, but it allows me to test outcomes* - applied to a test:
     * everything below arranges a cultivator who holds the art, and the thing
     * under test is what the game does about it.
     */
    async function aSellerOfThePavilionsSword(options: {
        seed: string;
        mastery: number;
        ordinal: number;
        inTheHouse: boolean;
    }): Promise<Awaited<ReturnType<typeof makeGameInWorld>> & { id: string }> {
        const harness = await makeGameInWorld({
            seed: options.seed,
            worldSeed: `world-${options.seed}`
        });
        const created = (await harness.game.newRun('Wen Shuyi')) as never as
            { cultivator: { id: string } };
        const id = created.cultivator.id;
        harness.repos.cultivators.update(id, {
            realmOrdinal: options.ordinal,
            ...(options.inTheHouse ? { sectId: PAVILION, sectName: 'Azure Cloud Pavilion' } : {})
        });
        // A join row can only point at a catalog row that exists, and the
        // `techniques` table is seeded from the data file rather than shipped
        // in the migration.
        harness.repos.techniques.upsert(
            (TECHNIQUES as readonly { id: string }[]).find(t => t.id === THE_SWORD) as never
        );
        const known = harness.repos.techniques.learn(id, THE_SWORD, options.mastery);
        expect(known, 'the arrangement did not take').toBeTruthy();
        return { ...harness, id };
    }

    it('refuses for ability and never for permission', async () => {
        const { game, repos, id } = await aSellerOfThePavilionsSword({
            seed: 'leak-halfway', mastery: 0.4, ordinal: 22, inTheHouse: true
        });
        const said = await game.act('I sell a copy of the Void-Piercing Sword Domain');

        expect(said.narration).toMatch(/write it out|parts in a hundred|end/i);
        // The refusal is about what they hold, not about what they are allowed
        // to do. Nothing anywhere may say they are forbidden.
        expect(said.narration).not.toMatch(/not allowed|forbidden|may not|permission/i);
        const structure = engineCalls(said).map(c => c.summary).join(' ');
        expect(structure + said.narration).toMatch(/couldWriteOutACopy|mastery/i);
        // Nothing was paid and nothing was written.
        expect(repos.cultivators.getById(id)!.spiritStones)
            .toBe(repos.cultivators.getById(id)!.spiritStones);
    }, 200_000);

    it('a leak nobody could place opens no account, and says so', async () => {
        const { game, repos, id, db } = await aSellerOfThePavilionsSword({
            seed: 'leak-unseen', mastery: 1, ordinal: 22, inTheHouse: true
        });
        // Nowhere anybody stands. `move` refuses a name that is not a place,
        // so the row is set directly - a precondition, not an outcome.
        repos.cultivators.update(id, { location: 'The Dead Verge' });

        const before = repos.cultivators.getById(id)!.spiritStones;
        const said = await game.act('I sell a copy of the Void-Piercing Sword Domain');

        // The act came off: months spent, stones paid, the art still theirs.
        expect(repos.cultivators.getById(id)!.spiritStones).toBeGreaterThan(before);
        expect(repos.techniques.knows(id, THE_SWORD)).toBe(true);

        const structure = engineCalls(said).map(c => c.summary).join(' ');
        expect(structure + said.narration).toMatch(/nobody can put a name to it|no account/i);

        // And the ledger is empty, which is the assertion that matters: a
        // grudge is held AGAINST somebody and there is nobody to hold one.
        const rows = db.prepare(
            "SELECT COUNT(*) AS n FROM obligations WHERE subject_id = ?"
        ).get(id) as { n: number };
        expect(rows.n).toBe(0);
    }, 200_000);

    /**
     * Somebody of the Pavilion, standing where the player is. Read off the
     * world rather than invented: the house's own people are where the world
     * put them, and the player is moved to one of them.
     */
    function standWhereOneOfTheirsIs(
        harness: { game: unknown; repos: { cultivators: { update(id: string, patch: object): unknown } } },
        id: string
    ): string {
        const world = (harness.game as { atHand: {
            npcs: { name: string; factionId: string | null; status: string; locationId: string | null }[];
            locations: { id: string; name: string }[];
        } | null }).atHand;
        expect(world, 'the world was never loaded').toBeTruthy();
        const theirs = world!.npcs
            .find(n => n.status === 'alive' && n.factionId === PAVILION && n.locationId);
        expect(theirs, 'the seeded world holds nobody of the Pavilion').toBeTruthy();
        const where = world!.locations.find(l => l.id === theirs!.locationId)!;
        harness.repos.cultivators.update(id, { location: where.name });
        return where.name;
    }

    it('takes the capability off one of their own, when it can reach them', async () => {
        const harness = await aSellerOfThePavilionsSword({
            seed: 'leak-seen', mastery: 1, ordinal: 22, inTheHouse: true
        });
        const { game, id, db } = harness;
        // The world has to be in hand before the square can be read off it.
        await game.act('I look around');
        standWhereOneOfTheirsIs(harness, id);

        const said = await game.act('I sell a copy of the Void-Piercing Sword Domain');
        const structure = engineCalls(said).map(c => c.summary).join(' ');

        expect(structure).toMatch(/whatTheHouseDoesAboutIt|Azure Cloud/i);
        const rows = db.prepare(
            "SELECT cause, severity, tags FROM obligations WHERE subject_id = ? AND status = 'open'"
        ).all(id) as { cause: string; severity: string; tags: string }[];
        expect(rows.length, 'the house knows and holds nothing').toBeGreaterThan(0);
        expect(rows.some(r => r.tags.includes('leaked_an_art'))).toBe(true);
        // Their own house's art, sold by one of their own: the betrayal proper.
        expect(rows.some(r => r.severity === 'grave' || r.severity === 'unforgivable')).toBe(true);

        // The owner's own sentence, arrived at: *maybe cripple their
        // cultivation so they couldn't do it again*. It is a broken status off
        // `WOUND_TYPES` and not a new kind of injury.
        const wounds = db.prepare(
            'SELECT severity, wound_type FROM cultivator_injuries WHERE cultivator_id = ?'
        ).all(id) as { severity: string; wound_type: string | null }[];
        expect(wounds.some(w => w.severity === 'crippling' && w.wound_type)).toBe(true);
    }, 200_000);

    /**
     * The other of the owner's two answers, reached from the same call with no
     * branch: an outsider holds something the house wants back, so keeping them
     * is worth something and it takes the years instead.
     */
    it('holds an outsider to a term of years instead', async () => {
        const harness = await aSellerOfThePavilionsSword({
            seed: 'leak-outsider', mastery: 1, ordinal: 22, inTheHouse: false
        });
        const { game, id, db } = harness;
        await game.act('I look around');
        standWhereOneOfTheirsIs(harness, id);

        const said = await game.act('I sell a copy of the Void-Piercing Sword Domain');
        const structure = engineCalls(said).map(c => c.summary).join(' ');
        expect(structure).toMatch(/term of service|held by/i);

        const rows = db.prepare(
            "SELECT kind, cause, tags FROM obligations WHERE subject_id = ? OR holder_id = ?"
        ).all(id, id) as { kind: string; cause: string; tags: string }[];
        expect(rows.some(r => r.kind === 'oath' && r.cause === 'service_term')).toBe(true);
        // Not their own house's, so not the betrayal proper.
        expect(rows.some(r => r.tags.includes('rung:1'))).toBe(true);
        // And nothing was broken: the house is keeping them, which is the
        // whole reason it did not.
        const wounds = db.prepare(
            "SELECT COUNT(*) AS n FROM cultivator_injuries WHERE cultivator_id = ? AND severity = 'crippling'"
        ).get(id) as { n: number };
        expect(wounds.n).toBe(0);
    }, 200_000);

    /**
     * The case the design owner cares most about, and the reason none of this
     * needed a prohibition:
     *
     *   > unless you have 2 people at 44, one is pissed, leaves, copies it, the
     *   > sect can do nothing
     *
     * Nothing here produces that. `whetherYouAreWorthTheTrouble` does, because
     * the only people who CAN write out a house's signature are the people it
     * has no reprisal against. What the house is left holding is the record,
     * which is standing and rumour and does not settle.
     */
    it('has no answer at all for somebody standing above it, and still opens the account', async () => {
        const harness = await aSellerOfThePavilionsSword({
            seed: 'leak-peak', mastery: 1, ordinal: 45, inTheHouse: true
        });
        const { game, id, db } = harness;
        await game.act('I look around');
        standWhereOneOfTheirsIs(harness, id);

        const said = await game.act('I sell a copy of the Void-Piercing Sword Domain');
        const structure = engineCalls(said).map(c => c.summary).join(' ');

        expect(structure + said.narration)
            .toMatch(/nothing .* could do about it would reach|there is no reprisal/i);
        const rows = db.prepare(
            "SELECT tags FROM obligations WHERE subject_id = ? AND status = 'open'"
        ).all(id) as { tags: string }[];
        expect(rows.some(r => r.tags.includes('takes:nothing'))).toBe(true);
        expect(db.prepare(
            "SELECT COUNT(*) AS n FROM cultivator_injuries WHERE cultivator_id = ? AND severity = 'crippling'"
        ).get(id)).toEqual({ n: 0 });
    }, 200_000);
});
