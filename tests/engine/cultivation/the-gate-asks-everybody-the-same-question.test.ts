/**
 * THE DAO GATE ASKS ONE QUESTION AND THERE IS ONE ANSWER TO IT.
 *
 * This file exists because for a long time there were two, and the two did not
 * even resemble each other.
 *
 *   THE PLAYER  `roadsWalked(cultivator.insights)`. An insight formed in three
 *               places, all in `time-skip.ts`, whose own docblock says there is
 *               "no path into this function that a cultivator can reach by
 *               spending time or stones": a survived tribulation, a survived
 *               CRIPPLING qi deviation, and a meditative state checked once a
 *               year. Measured across the whole space at Insight 3, that state
 *               ran 0.6% a year on thin ground and 3.4% with everything
 *               favourable - one road per 35 years at the best, one per 165
 *               doing the ordinary thing. Every completed playtest run ended
 *               with `insights: []`.
 *   EVERYBODY   `roadsWalkedBy(npc)` SYNTHESISED an insight per distinct domain
 *   ELSE        among the arts they held, at degree 1, DATED TO THE DAY THEY
 *               WERE BORN, with the account "Practised X for long enough that
 *               it taught them something." `roadsInReachOf` then added one for
 *               every dao ground they could get at and every material ever
 *               spent on them, also free and also instant.
 *
 * So an NPC was handed a road for HOLDING an art and a player had to survive
 * something extraordinary for the same road. At 800 years over three seeds an
 * NPC standing in Nascent Soul held 2.09 roads and a player held none, ever.
 * The design owner's instruction was blunt: "npcs have to be the same as the
 * player. not different, the same."
 *
 * The rule is now `what-a-road-in-reach-costs-to-walk.ts`: ACCESS PUTS A ROAD
 * IN REACH, YEARS ARE WHAT WALK IT, and an insight that actually happened
 * counts free because the event was the price.
 *
 * THE FIRST TEST BELOW IS THE ONE THAT MUST NEVER GO RED AGAIN. A player and an
 * NPC with identical arts, identical age and identical standing answer the gate
 * identically - not because two functions were written to agree, but because
 * there is one function and they both go through it.
 */

import { describe, expect, it } from 'vitest';

import {
    canAttemptBreakthrough,
    daoRequirementFor,
    roadsWalked,
    roadsWalkedIncludingExposure
} from '../../../src/engine/cultivation/breakthrough.js';
import {
    CULTIVATION_BEGINS_AT_AGE,
    YEARS_A_ROAD_COSTS,
    roadsTaughtByPractice,
    roadsWalkedBy,
    type RoadWithinReach
} from '../../../src/engine/cultivation/what-a-road-in-reach-costs-to-walk.js';
import { progressRequiredForOrdinal } from '../../../src/engine/cultivation/realms.js';
import { strikeAtTheWall } from '../../../src/engine/world/an-npc-striking-at-the-next-wall.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import { DAYS_PER_YEAR } from '../../../src/engine/cultivation/cultivation.js';
import { CultivationRNG } from '../../../src/engine/cultivation/rng.js';
import { makeCultivator } from './fixtures.js';

/** One art per domain, so a fixture can hold a road without inventing a catalog. */
const SWORD = 'clear-terrace-ascension-canon';   // weapon
const BODY = 'foundation-tempering-scripture';   // body
const ARRAY = 'mountain-vein-devouring-canon';   // formation

/** The crossing into Nascent Soul, which is where the gate starts asking. */
const NASCENT_SOUL_CROSSING = 20;

/** Ground standing open in the province, teaching alchemy - no art teaches it. */
const A_CLIFF: RoadWithinReach = {
    domain: 'alchemy',
    subject: 'the ninefold reversion',
    sourceId: 'loc-a-cliff',
    sourceName: 'A Cliff With Nine Ledges',
    how: 'ground_open'
};

// ═══════════════════════════════════════════════════════════════════════════
// THE TEST THIS FILE IS FOR
// ═══════════════════════════════════════════════════════════════════════════

describe('a player and an NPC with the same life answer the gate the same way', () => {
    /**
     * Same arts, same age, same standing, same ground under their feet. One is
     * a row in the player's database and the other is a record in `WorldState`,
     * and that is the ONLY difference between them.
     */
    function bothOf(age: number, arts: readonly string[], reach: readonly RoadWithinReach[]) {
        const player = makeCultivator({
            realmOrdinal: NASCENT_SOUL_CROSSING,
            cultivationProgress: progressRequiredForOrdinal(NASCENT_SOUL_CROSSING) ?? 0,
            knownTechniques: [...arts],
            insights: [],
            age
        });
        const npc = createNpc('symmetry', {
            id: 'the-same-person',
            name: 'The Same Person',
            bornOnDay: 0,
            onDay: Math.round(age * DAYS_PER_YEAR),
            cultivation: {
                realmOrdinal: NASCENT_SOUL_CROSSING,
                techniqueIds: [...arts]
            }
        });
        return {
            player: canAttemptBreakthrough({ ...player, roadsWithinReach: reach }),
            npc: canAttemptBreakthrough({
                realmOrdinal: npc.cultivation.realmOrdinal,
                cultivationProgress: progressRequiredForOrdinal(NASCENT_SOUL_CROSSING) ?? 0,
                alive: true,
                spiritRoot: npc.cultivation.spiritRoot,
                insights: [],
                knownTechniques: npc.cultivation.techniqueIds,
                roadsWithinReach: reach,
                age
            })
        };
    }

    it('holds at every age, with every combination of arts and ground', () => {
        const arts: string[][] = [[], [SWORD], [SWORD, BODY], [SWORD, BODY, ARRAY]];
        const reaches: RoadWithinReach[][] = [[], [A_CLIFF]];
        // Ages spanning the whole interesting range: before anybody is
        // cultivating at all, through the years where each price is met one at
        // a time, and out to an age where nothing is left unpaid.
        const ages = [0, 8, CULTIVATION_BEGINS_AT_AGE, 20, 40, 55, 60, 90, 120, 400, 3000];

        for (const art of arts) {
            for (const reach of reaches) {
                for (const age of ages) {
                    const { player, npc } = bothOf(age, art, reach);
                    const where = `age ${age}, arts [${art.join()}], reach ${reach.length}`;
                    expect(npc.daoHeld, `roads held: ${where}`).toBe(player.daoHeld);
                    expect(npc.daoRequired, `roads asked: ${where}`).toBe(player.daoRequired);
                    expect(npc.eligible, `eligible: ${where}`).toBe(player.eligible);
                    expect(npc.reason, `reason: ${where}`).toBe(player.reason);
                }
            }
        }
    });

    it('and the answer is not trivially zero for both, which would prove nothing', () => {
        const { player, npc } = bothOf(400, [SWORD, BODY], [A_CLIFF]);
        expect(player.daoHeld).toBeGreaterThan(0);
        expect(npc.daoHeld).toBe(player.daoHeld);
    });

    it('down the path the world actually takes, which is `strikeAtTheWall`', () => {
        // Not the shape of a subject built for a test: the real world entry
        // point, whose subject construction is where the birth-dated insights
        // used to be injected.
        const npc = createNpc('symmetry', {
            id: 'the-same-person',
            name: 'The Same Person',
            bornOnDay: 0,
            onDay: 400 * DAYS_PER_YEAR,
            cultivation: {
                realmOrdinal: NASCENT_SOUL_CROSSING,
                techniqueIds: [SWORD, BODY]
            }
        });
        const player = makeCultivator({
            realmOrdinal: NASCENT_SOUL_CROSSING,
            knownTechniques: [SWORD, BODY],
            insights: [],
            age: 400
        });
        // `strikeAtTheWall` refuses or attempts; either way the roads it
        // counted are the roads the player's own gate counts.
        expect(
            roadsWalkedIncludingExposure({
                knownTechniques: npc.cultivation.techniqueIds,
                insights: [],
                age: 400
            })
        ).toBe(roadsWalkedIncludingExposure(player));
        // And the call is legal, which is what proves the path was exercised.
        expect(() =>
            strikeAtTheWall(
                { ...npc, cultivation: { ...npc.cultivation, accumulatingSinceDay: 0 } },
                400 * DAYS_PER_YEAR,
                { yearsNeeded: 1, yearsAccumulated: 1, yearsStood: 1, ready: true, settled: false },
                new CultivationRNG('symmetry-strike'),
                'normal'
            )
        ).not.toThrow();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// WHAT THE RULE COSTS, WHICH IS THE HALF THAT USED TO BE FREE
// ═══════════════════════════════════════════════════════════════════════════

describe('a road in reach is not a road walked', () => {
    it('costs years, and a child holds nothing however many arts are in their hands', () => {
        const arts = [SWORD, BODY, ARRAY];
        expect(roadsTaughtByPractice(arts)).toHaveLength(3);
        // THE DEFECT, STATED AS A TEST. This used to be 3, at birth, free.
        expect(roadsWalkedIncludingExposure({ knownTechniques: arts, age: 14 })).toBe(0);
    });

    it('and arrives one road at a time as the years are actually served', () => {
        const arts = [SWORD, BODY, ARRAY];
        const price = YEARS_A_ROAD_COSTS.practice;
        const at = (age: number) => roadsWalkedIncludingExposure({ knownTechniques: arts, age });
        expect(at(CULTIVATION_BEGINS_AT_AGE + price - 1)).toBe(0);
        expect(at(CULTIVATION_BEGINS_AT_AGE + price)).toBe(1);
        expect(at(CULTIVATION_BEGINS_AT_AGE + price * 2)).toBe(2);
        expect(at(CULTIVATION_BEGINS_AT_AGE + price * 3)).toBe(3);
        // And it stops at what is actually in reach. Years do not invent access.
        expect(at(CULTIVATION_BEGINS_AT_AGE + price * 40)).toBe(3);
    });

    it('is charged cumulatively, because nobody is in two places at once', () => {
        const bearer = { knownTechniques: [SWORD], roadsWithinReach: [A_CLIFF] };
        const both = YEARS_A_ROAD_COSTS.practice + YEARS_A_ROAD_COSTS.ground_open;
        expect(
            roadsWalkedIncludingExposure({ ...bearer, age: CULTIVATION_BEGINS_AT_AGE + both - 1 })
        ).toBe(1);
        expect(
            roadsWalkedIncludingExposure({ ...bearer, age: CULTIVATION_BEGINS_AT_AGE + both })
        ).toBe(2);
    });

    it('never dates a road to somebody\'s birthday, because that is not an event', () => {
        const walked = roadsWalkedBy({ knownTechniques: [SWORD], age: 500 }, 0);
        expect(walked).toHaveLength(1);
        expect(walked[0].provenance.onDay).toBeGreaterThan(0);
        // The day the years ran out, not the day they were born.
        expect(walked[0].provenance.onDay).toBe(
            Math.round((CULTIVATION_BEGINS_AT_AGE + YEARS_A_ROAD_COSTS.practice) * DAYS_PER_YEAR)
        );
    });

    it('leaves an insight that actually happened uncharged and untouched', () => {
        const survived = makeCultivator({ realmOrdinal: NASCENT_SOUL_CROSSING });
        const held = roadsWalked(survived.insights);
        // Whatever the fixture handed them for their rung, exposure adds to it
        // and never replaces it - and a child who survived something holds it.
        const asAChild = roadsWalkedBy({ insights: survived.insights, age: 0 });
        expect(roadsWalked(asAChild)).toBe(held);
        for (const insight of survived.insights) {
            expect(asAChild).toContainEqual(insight);
        }
    });

    it('does not pay twice for a domain an insight already covers', () => {
        const walked = roadsWalkedBy({
            insights: [
                {
                    id: 'i-1',
                    domain: 'weapon',
                    subject: 'the edge',
                    degree: 3,
                    provenance: {
                        achievementId: 'a-1',
                        achievementKind: 'survived_extraordinary',
                        onDay: 10,
                        deepenedBy: [],
                        account: 'Stood under it.'
                    }
                }
            ],
            knownTechniques: [SWORD],
            age: 5000
        });
        expect(walked).toHaveLength(1);
        // The real one, at the degree the event earned - not overwritten by a
        // shallow exposure road for the same domain.
        expect(walked[0].degree).toBe(3);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// AND THE GATE STILL BITES
// ═══════════════════════════════════════════════════════════════════════════

describe('the gate is still a gate', () => {
    it('refuses the Nascent Soul crossing to somebody who has walked nothing', () => {
        expect(daoRequirementFor(NASCENT_SOUL_CROSSING)).toBeGreaterThan(0);
        const check = canAttemptBreakthrough(
            makeCultivator({
                realmOrdinal: NASCENT_SOUL_CROSSING,
                cultivationProgress: progressRequiredForOrdinal(NASCENT_SOUL_CROSSING) ?? 0,
                knownTechniques: [],
                insights: [],
                age: 200
            })
        );
        expect(check.daoHeld).toBe(0);
        expect(check.eligible).toBe(false);
    });

    it('and asks nothing at all below it, which is what keeps the bottom soloable', () => {
        for (const ordinal of [4, 8, 12, 16]) {
            expect(daoRequirementFor(ordinal)).toBe(0);
        }
    });
});
