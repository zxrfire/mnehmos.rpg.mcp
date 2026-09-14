/**
 * A VERDICT YOU CAN REFUSE, AND SOMEBODY FAR ENOUGH UP WHO KNOWS BETTER.
 *
 * The shape the design owner asked for: you are told nothing can be done, you
 * refuse the verdict, and eventually somebody tells you there is a medicine.
 * The verdict was not a lie - the person who gave it did not know.
 *
 * ── WHAT THE ENGINE WAS DOING INSTEAD ────────────────────────────────────
 *
 * Almost all of it already fell out of the knowledge layer. Two things did not,
 * and both told everybody the same thing:
 *
 *   whatWouldCloseThisWound         took `(untreated, realmOrdinal,
 *                                   spiritStones, regionId, groundMultiplier)`
 *                                   and no holder at all, so a Qi Condensation
 *                                   cultivator standing in a village was handed
 *                                   the name, the grade and the barter terms of
 *                                   a medicine refined above the Lid.
 *   theOneMedicineThatWouldReachIt  named the pill for a permanent wound off
 *                                   the catalog, unconditionally. Somebody at
 *                                   the bottom of the ladder, the day they lost
 *                                   an arm, was told by name what grows one
 *                                   back.
 *
 * Between them there was no state in the game in which anybody was honestly
 * told that nothing they could reach would close it. Nobody refuses a verdict
 * they were never given, so the whole shape had no first move.
 *
 * ── THE RULE THIS PINS, AND WHY IT IS NOT A LIST ─────────────────────────
 *
 * Who knows is derived from two numbers the world already stores - the rung
 * somebody stands at, and the height the house on whose roll they stand works
 * at - and nothing anywhere authors a person who knows. The margin is
 * `WORKING_KNOWLEDGE_MARGIN`, which is the same 8 `seedPillStock` uses to
 * decide which houses could have got hold of a barter pill at all: a house
 * working near the height a thing is for is this repo's existing expression of
 * "these are the people who would know".
 *
 * Being on the roll is not enough, and that is deliberate. A hall that refines
 * this medicine is a body that holds the claim; its outer disciples are not, or
 * reaching somebody who knows stops being the hard part.
 *
 * ── AND THE ANSWER IS ALWAYS THE HOLDER'S OWN AWARENESS ──────────────────
 *
 * Nothing below asks a would-they-know function at the moment somebody is
 * asked. Every read goes through `KnowledgeGate`, which composes a stored row
 * with the world reading under `highestStage` - so being told writes a row that
 * wins, and having heard nothing is the absence of one. The last case is the
 * one that makes the trope playable: a row written for a beginner changes what
 * the engine will say to them, permanently.
 */

import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { makeGame } from './harness';
import { KnowledgeGate } from '../../src/web/knowledge';
import { whetherTheyHoldIt } from '../../src/web/asked';
import {
    aMedicineThisHolderCouldName,
    whatToSayAboutTheCure,
    whatWouldCloseThisWound
} from '../../src/web/what-would-close-this-wound';
import {
    WORKING_KNOWLEDGE_MARGIN,
    aThingOnOpenSale,
    whoWouldHaveHeardOfIt
} from '../../src/engine/cultivation/who-has-heard-of-a-thing-past-the-counter';
import {
    whatOneOfTheWorldsOwnPeopleKnows
} from '../../src/engine/world/what-one-of-the-worlds-own-people-knows';
import { makeLocation } from '../../src/engine/world/locations';
import { pillBandOrdinal } from '../../src/engine/cultivation/breakthrough';
import { PILLS, pillThatMends } from '../../src/data/cultivation/pills';
import { medicineNeededFor } from '../../src/engine/cultivation/what-grade-of-medicine-a-wound-needs';
import { HOME_REGION_ID } from '../../src/data/cultivation/regions';
import type { Injury } from '../../src/schema/cultivation';
import type { WorldState } from '../../src/engine/world/world-state';

/**
 * The medicine for a maiming, off the catalog rather than named here. A wound
 * key and the pill that mends it are one fact and this test does not restate
 * it - if the catalog moves the medicine, this follows it.
 */
const THE_MEDICINE = pillThatMends('severed-flesh')!;
const THE_BAND = pillBandOrdinal(THE_MEDICINE.grade);

/** Something a counter sells, for the contrast. Found, never written down. */
const ON_THE_COUNTER = PILLS.find(pill =>
    pill.effect === 'treat_injury' && aThingOnOpenSale(pill))!;

/**
 * A crippling tear, which is what puts a cure past mortal care at every rung.
 * The severity is read back off `medicineNeededFor` in the assertions rather
 * than assumed.
 */
function crippled(): Injury[] {
    return [{
        id: 'wound-1',
        severity: 'crippling',
        source: 'combat',
        turn: 1,
        woundType: 'torn-meridians',
        description: 'A channel opened along its length.',
        treated: false
    } as unknown as Injury];
}

/** A gate over a real schema, with no world attached: the player's own case. */
function gateOverAFreshRun(): { db: Database.Database; gate: KnowledgeGate } {
    const { db } = makeGame({ seed: 'told-nothing-can-be-done' });
    return { db, gate: new KnowledgeGate(db) };
}

describe('who has heard of a thing past the counter', () => {
    it('has nothing to gate about a medicine anybody can buy', () => {
        expect(aThingOnOpenSale(ON_THE_COUNTER)).toBe(true);
        expect(whoWouldHaveHeardOfIt({
            thingId: ON_THE_COUNTER.id, ordinal: 0, house: null
        })).toBe('named');
    });

    it('does not reach somebody standing further below it than their knowledge runs', () => {
        expect(aThingOnOpenSale(THE_MEDICINE)).toBe(false);
        expect(whoWouldHaveHeardOfIt({
            thingId: THE_MEDICINE.id,
            ordinal: THE_BAND - WORKING_KNOWLEDGE_MARGIN - 1,
            house: null
        })).toBe('unaware');
    });

    it('reaches somebody standing within their own working knowledge of it', () => {
        expect(whoWouldHaveHeardOfIt({
            thingId: THE_MEDICINE.id,
            ordinal: THE_BAND - WORKING_KNOWLEDGE_MARGIN,
            house: null
        })).toBe('named');
    });

    /**
     * THE HOUSE HALF, AND THE CONSTRAINT ON IT. A body working near the height
     * the thing is for holds the claim; its juniors do not. Both arms use one
     * house and one rung, so the only thing that differs between them is where
     * the person stands on that house's own ladder.
     */
    it('reaches the seniors of a house that works near the height, and not its juniors', () => {
        const house = { reach: THE_BAND - WORKING_KNOWLEDGE_MARGIN, rankCount: 6 };
        const farBelow = THE_BAND - WORKING_KNOWLEDGE_MARGIN - 1;
        expect(whoWouldHaveHeardOfIt({
            thingId: THE_MEDICINE.id,
            ordinal: farBelow,
            house: { ...house, rankIndex: house.rankCount - 1 }
        })).toBe('named');
        expect(whoWouldHaveHeardOfIt({
            thingId: THE_MEDICINE.id,
            ordinal: farBelow,
            house: { ...house, rankIndex: 0 }
        })).toBe('unaware');
    });

    /**
     * AND THE ASK ROUTES IT. `holdsIt` listed the three kinds that had a gate
     * read, so a question about a medicine was decided entirely by
     * `withinStratum` and no NPC's own awareness was ever consulted about one.
     */
    it('asks the gate about a medicine by the kind the gate uses for it', () => {
        const asked: string[] = [];
        const gate = {
            isAwareOf: (_holder: string, kind: string, id: string) => {
                asked.push(`${kind}:${id}`);
                return true;
            }
        } as unknown as KnowledgeGate;
        expect(whetherTheyHoldIt(gate, 'them', {
            kind: 'pill', id: THE_MEDICINE.id, name: THE_MEDICINE.name, facts: [], structure: []
        })).toBe(true);
        expect(asked).toEqual([`thing:${THE_MEDICINE.id}`]);
        // And a subject with no claim to hold is not asked about at all.
        expect(whetherTheyHoldIt(gate, 'them', {
            kind: 'price', id: 'p', name: 'p', facts: [], structure: []
        })).toBe(false);
        expect(whetherTheyHoldIt(gate, 'them', null)).toBe(false);
    });

    it('says nothing at all about a thing no catalog names', () => {
        expect(whoWouldHaveHeardOfIt({
            thingId: 'pill-that-does-not-exist', ordinal: 40, house: null
        })).toBe('unaware');
    });
});

describe('an NPC answers out of their own awareness', () => {
    /** Two people, one house, and nothing written down for either of them. */
    function world(): WorldState {
        const reach = THE_BAND - WORKING_KNOWLEDGE_MARGIN;
        return {
            id: 'w', seed: 'w', currentDay: 1_000,
            locations: [
                makeLocation({ id: 'province', name: 'Low Fall', kind: 'region' }),
                makeLocation({
                    id: 'village', name: 'Two Wells', kind: 'settlement', parentId: 'province'
                })
            ],
            factions: [{
                id: 'hall', name: 'Cinnabar Step Hall', kind: 'sect', alignment: 'neutral',
                seatLocationId: 'village', controlledLocationIds: [],
                ranks: ['Outer', 'Inner', 'Core', 'Elder'],
                standing: {}, resources: { reliable_ordinal: reach }, description: '',
                foundedOnDay: 0, dissolvedOnDay: null, tags: []
            }],
            npcs: [
                {
                    id: 'sweeper', name: 'sweeper', status: 'alive', locationId: 'village',
                    factionId: 'hall', factionRankIndex: 0,
                    cultivation: { realmOrdinal: 2 }, relationships: [], activity: null,
                    identity: { bornOnDay: 0 }
                },
                {
                    id: 'elder', name: 'elder', status: 'alive', locationId: 'village',
                    factionId: 'hall', factionRankIndex: 3,
                    cultivation: { realmOrdinal: 2 }, relationships: [], activity: null,
                    identity: { bornOnDay: 0 }
                }
            ],
            history: { facts: [] }
        } as unknown as WorldState;
    }

    it('is derived off the world and written down nowhere', () => {
        const knows = whatOneOfTheWorldsOwnPeopleKnows(world());
        expect(knows('elder', 'thing', THE_MEDICINE.id)).toBe('named');
        expect(knows('sweeper', 'thing', THE_MEDICINE.id)).toBe('unaware');
    });

    /**
     * THE SAFETY PROPERTY THIS FILE INHERITS. A holder the world does not hold
     * - which is the player, always - gets `unaware` from this reading, so it
     * can only ever add to what their stored rows say.
     */
    it('says nothing about somebody the world has no row for', () => {
        expect(whatOneOfTheWorldsOwnPeopleKnows(world())(
            'the-player', 'thing', THE_MEDICINE.id
        )).toBe('unaware');
    });
});

describe('what the engine will say about a wound it cannot reach', () => {
    /**
     * The precondition, checked rather than assumed: a crippling tear at the
     * bottom of the ladder wants a grade no counter sells, so the cure named
     * for it is the barter tier and is the case this gate exists for. If the
     * medicine ladder is retuned so a beginner's worst wound is answered by
     * something on a shelf, this test is measuring nothing and says so.
     */
    it('is asking after a cure that is past the cash line', () => {
        const truth = whatWouldCloseThisWound(crippled(), 0, 10_000, HOME_REGION_ID);
        expect(truth, 'nothing answers a crippling tear at ordinal 0').not.toBeNull();
        expect(medicineNeededFor('crippling', 0)).not.toBe('mortal');
        expect(truth!.notForSale, 'the cure for this is on a counter, so nothing is gated')
            .not.toBeNull();
        expect(truth!.stones).toBeNull();
        expect(truth!.heardOf, 'no holder named means the caller asked for the truth').toBe(true);
    });

    it('names nothing to somebody who has never heard of it', () => {
        const { db, gate } = gateOverAFreshRun();
        try {
            const cure = whatWouldCloseThisWound(crippled(), 0, 10_000, HOME_REGION_ID, 1, {
                gate, holderId: 'nobody-has-told-them', realmOrdinal: 0
            })!;
            expect(cure.heardOf).toBe(false);
            const said = whatToSayAboutTheCure(cure);
            expect(said).not.toContain(cure.name);
            expect(said).toMatch(/nothing you can reach/i);
            // The verdict is honest and it is not a nudge. A sentence that
            // gestured at the medicine would be the engine winking, and then
            // refusing the verdict is not something the player chose to do.
            expect(said).not.toMatch(/medicine exists|there is one|somewhere out there/i);
        } finally {
            db.close();
        }
    });

    /**
     * AND HAVING BEEN TOLD, THEY HOLD IT. One ordinary knowledge record, of the
     * kind an elder's answer writes, and the same call now names the thing.
     * This is the half that makes the claim worth having: a player who cannot
     * act on what they were told has been given a sentence rather than a fact.
     */
    it('names it once somebody who knew has said so', () => {
        const { db, gate } = gateOverAFreshRun();
        try {
            const holderId = 'told-by-an-elder';
            const truth = whatWouldCloseThisWound(crippled(), 0, 10_000, HOME_REGION_ID)!;

            gate.learn({
                holderId,
                kind: 'thing',
                id: PILLS.find(pill => pill.name === truth.name)!.id,
                name: truth.name,
                onDay: 3,
                sourceKind: 'told',
                sourceNote: 'An elder said it, unprompted, and did not offer to help.',
                statement: `${truth.name} exists.`
            });

            const cure = whatWouldCloseThisWound(crippled(), 0, 10_000, HOME_REGION_ID, 1, {
                gate, holderId, realmOrdinal: 0
            })!;
            expect(cure.heardOf).toBe(true);
            expect(cure.name).toBe(truth.name);
            const said = whatToSayAboutTheCure(cure);
            expect(said).toContain(truth.name);
            // And it survives: the row is the authority, not the telling.
            expect(gate.isAwareOf(holderId, 'thing', PILLS.find(
                pill => pill.name === truth.name
            )!.id)).toBe(true);
        } finally {
            db.close();
        }
    });

    /**
     * THE LINE THE MAIMING ACTUALLY ARRIVES ON, PLAYED.
     *
     * `theOneMedicineThatWouldReachIt` is the one place the game volunteers a
     * medicine for a wound nothing closes, and it is what a player reads on the
     * turn they lose an arm. Asserted through `act` rather than off the read,
     * because the claim is about what reaches the player.
     */
    it('does not volunteer the medicine for a maiming, and does once they have been told', async () => {
        const { db, game, repos } = makeGame({ seed: 'a-maiming-at-the-bottom' });
        try {
            await game.newRun('Short');
            const id = game.state().cultivator.id;
            repos.cultivators.addInjury(id, {
                severity: 'crippling',
                source: 'other',
                description: 'A part of the body was taken out of it.',
                sustainedOnTurn: 1,
                woundType: 'severed-flesh'
            });

            const before = JSON.stringify(await game.act('what can I do'));
            expect(before, 'a wound nothing closes must still be said').toMatch(/does not close/i);
            expect(before).not.toContain(THE_MEDICINE.name);

            new KnowledgeGate(db).learn({
                holderId: id,
                kind: 'thing',
                id: THE_MEDICINE.id,
                name: THE_MEDICINE.name,
                onDay: 1,
                sourceKind: 'told',
                sourceNote: 'Said by somebody who had seen one, and who would not help further.',
                statement: `${THE_MEDICINE.name} exists.`
            });

            const after = JSON.stringify(await game.act('what can I do'));
            expect(after).toContain(THE_MEDICINE.name);
        } finally {
            db.close();
        }
    });

    /**
     * AND THE TELLING HAS TO LAND SOMEWHERE. `noteEncounter` is the one writer
     * behind every answer that teaches, and it took three kinds and dropped
     * everything else on the floor - so an elder naming the medicine would have
     * written nothing and the player would have woken up never having been
     * told. `EntityKind` says which catalog and `KnownEntityKind` says which
     * claim; this is the one place the two words have to meet.
     */
    it('writes a durable row when an answer teaches a medicine', async () => {
        const { db, game } = makeGame({ seed: 'an-answer-that-teaches' });
        try {
            await game.newRun('Short');
            const service = game as unknown as {
                currentRun(): { run: unknown; cultivator: { id: string } };
                noteEncounter(
                    cultivator: unknown, run: unknown,
                    entity: { kind: string; id: string; name: string },
                    sourceKind: string, note: string
                ): boolean;
            };
            const { run, cultivator } = service.currentRun();
            const gate = new KnowledgeGate(db);
            expect(gate.isAwareOf(cultivator.id, 'thing', THE_MEDICINE.id)).toBe(false);

            expect(service.noteEncounter(
                cultivator, run,
                { kind: 'pill', id: THE_MEDICINE.id, name: THE_MEDICINE.name },
                'told',
                'Said by somebody who had seen one.'
            )).toBe(true);

            expect(gate.isAwareOf(cultivator.id, 'thing', THE_MEDICINE.id)).toBe(true);
            expect(gate.awareness(cultivator.id, 'thing').map(row => row.id))
                .toContain(THE_MEDICINE.id);
        } finally {
            db.close();
        }
    });

    /** A medicine on a counter is never withheld. Nobody has to be told. */
    it('never withholds what a counter sells', () => {
        const { db, gate } = gateOverAFreshRun();
        try {
            expect(aMedicineThisHolderCouldName(ON_THE_COUNTER, {
                gate, holderId: 'a-villager', realmOrdinal: 0
            })).toBe(true);
        } finally {
            db.close();
        }
    });

    /**
     * THE INVARIANT THAT HOLDS THE BLAST RADIUS DOWN, PINNED RATHER THAN
     * ASSERTED IN A COMMENT.
     *
     * A withheld name and a quoted price can never co-occur, so no caller
     * composing a sentence out of `cure.name` and `cure.stones` can be handed a
     * name it must not say - which is why the panel's `I buy a <name>` line
     * needed no gate of its own. It falls out of the cash line being the same
     * line in both directions, and it would stop holding silently if either
     * moved.
     */
    it('never withholds a name and quotes a price for it at once', () => {
        const { db, gate } = gateOverAFreshRun();
        try {
            for (const ordinal of [0, 10, 20, 30, 40]) {
                const cure = whatWouldCloseThisWound(
                    crippled(), ordinal, 10_000, HOME_REGION_ID, 1,
                    { gate, holderId: 'nobody-has-told-them', realmOrdinal: ordinal }
                );
                if (cure === null || cure.heardOf) continue;
                expect(cure.stones, `a price was quoted for a withheld name at ${ordinal}`)
                    .toBeNull();
                expect(cure.notForSale).not.toBeNull();
            }
        } finally {
            db.close();
        }
    });
});
