/**
 * Face, a challenge, and what a duel leaves.
 *
 * The owner's rulings, pinned: face is raised by answering and by public wins
 * and lowered by public defeats and by refusing; a challenge is answered at the
 * challenged person's own house; a death under declared life-and-death terms is
 * sanctioned and every ordinary consequence still follows; somebody present may
 * step in when the killing blow lands, and it costs them face whoever they are;
 * and going for the kill under friendly terms is a murder rather than a duel
 * death.
 */

import { describe, expect, it } from 'vitest';

import { SECTS } from '../../../src/data/cultivation/sects.js';
import { REALM_TIERS } from '../../../src/engine/cultivation/realms.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import {
    AN_EQUAL_IS_WITHIN_REALMS,
    REFUSING_TO_DIE_COSTS,
    holdADuel,
    whatSteppingInCosts,
    type DuelTerms,
    whereADuelIsFought,
    whetherTheyAnswer
} from '../../../src/engine/world/a-challenge-is-answered-on-the-yard.js';
import {
    A_PUBLIC_WIN,
    faceOf,
    theSlightsBetween,
    whatBeingWatchedIsWorth,
    whatWinningIsWorth
} from '../../../src/engine/world/what-a-face-is-worth.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { makeObject } from '../../../src/engine/world/possessions.js';
import { createNpc, setRealm, upsertRelationship, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { createWorld, makeFaction, type WorldState } from '../../../src/engine/world/world-state.js';

const HOUSE = SECTS.find(s => s.id === 'sect-azure-cloud-pavilion')!;
const DAY = 600 * 365;

function person(id: string, ordinal: number, over: Partial<NpcRecord> = {}): NpcRecord {
    const npc = createNpc('duels', { id, bornOnDay: DAY - 365 * 80, onDay: DAY, locationId: 'room-duelling_ground' });
    return { ...setRealm(npc, ordinal, DAY), factionId: HOUSE.id, factionRankIndex: 1, activity: null, ...over };
}

function world(people: NpcRecord[], rooms: string[] = ['duelling_ground', 'practice_yard']): WorldState {
    const state = createWorld({ seed: 'duels', skipPriorAges: true, regionCount: 0 });
    state.currentDay = DAY;
    state.locations.push(makeLocation({ id: 'loc-region', name: 'The Province', kind: 'region' }));
    state.locations.push(makeLocation({ id: 'loc-seat', name: 'The Seat', kind: 'sect_seat', parentId: 'loc-region' }));
    for (const purpose of rooms) {
        state.locations.push(makeLocation({
            id: `room-${purpose}`, name: purpose === 'duelling_ground' ? 'the duelling ground' : 'the practice yard',
            kind: 'hall', parentId: 'loc-seat', data: { factionId: HOUSE.id, purpose }
        }));
    }
    state.factions.push(makeFaction({
        id: HOUSE.id, name: HOUSE.name, ranks: HOUSE.ranks.slice(), seatLocationId: 'loc-seat', foundedOnDay: 0,
        resources: { spirit_stones: 500_000, admission_ordinal: HOUSE.admissionOrdinal, power_ordinal: HOUSE.powerOrdinal }
    }));
    state.npcs.push(...people);
    return state;
}

/** Somebody who holds a pile against the other one. */
function holding(npc: NpcRecord, againstId: string, standing: number): NpcRecord {
    return upsertRelationship(npc, {
        targetId: againstId, targetName: againstId, kind: 'enemy', standing,
        note: 'Years of it.'
    }, DAY);
}

describe('what face is worth', () => {
    it('counts a crowd, and stops counting it somewhere', () => {
        expect(whatBeingWatchedIsWorth(0)).toBeLessThan(whatBeingWatchedIsWorth(5));
        expect(whatBeingWatchedIsWorth(15)).toBeGreaterThan(whatBeingWatchedIsWorth(5));
        expect(whatBeingWatchedIsWorth(10_000)).toBe(whatBeingWatchedIsWorth(1_000));
    });

    it('is worth more against somebody above you than against your own junior', () => {
        const up = whatWinningIsWorth({ winnerOrdinal: 14, loserOrdinal: 22, witnesses: 15 });
        const down = whatWinningIsWorth({ winnerOrdinal: 22, loserOrdinal: 14, witnesses: 15 });
        expect(up).toBeGreaterThan(down);
        expect(down).toBeGreaterThan(0);
    });
});

describe('a challenge, answered or not', () => {
    it('is answered when an equal asks, and the answer is worth face', () => {
        const state = world([
            person('asker', 16),
            person('asked', 16),
            ...Array.from({ length: 12 }, (_, i) => person(`watcher-${i}`, 10))
        ]);
        const said = whetherTheyAnswer({
            challenged: state.npcs[1]!, challenger: state.npcs[0]!, terms: 'to_yield', witnesses: 12
        });
        expect(said.answers).toBe(true);
        const out = holdADuel(state, {
            challenger: state.npcs[0]!, challenged: state.npcs[1]!, terms: 'to_yield',
            where: state.locations.find(l => l.id === 'room-duelling_ground')!, day: DAY
        });
        expect(out.fought).toBe(true);
        // Answering is worth something by itself, whatever the bout then did.
        expect(out.faceMoved.asked).toBeDefined();
        expect(faceOf(state.npcs.find(n => n.id === out.winnerId)!)).toBeGreaterThan(0);
    });

    it('is refused by somebody a realm and more above the asker, and refusing costs face', () => {
        const low = REALM_TIERS[1]!.ordinalStart;
        const high = REALM_TIERS[4]!.ordinalStart;
        const state = world([person('asker', low), person('asked', high)]);
        const out = holdADuel(state, {
            challenger: state.npcs[0]!, challenged: state.npcs[1]!, terms: 'to_yield',
            where: state.locations.find(l => l.id === 'room-duelling_ground')!, day: DAY
        });
        expect(out.fought).toBe(false);
        expect(out.refused?.byId).toBe('asked');
        expect(faceOf(state.npcs.find(n => n.id === 'asked')!)).toBeLessThan(0);
    });

    it('costs less to refuse a life-and-death challenge than a friendly one', () => {
        const low = REALM_TIERS[1]!.ordinalStart;
        const high = REALM_TIERS[4]!.ordinalStart;
        const friendly = whetherTheyAnswer({
            challenged: person('asked', high), challenger: person('asker', low),
            terms: 'to_yield', witnesses: 15
        });
        const toTheDeath = whetherTheyAnswer({
            challenged: person('asked', high), challenger: person('asker', low),
            terms: 'life_and_death', witnesses: 15
        });
        expect(toTheDeath.faceIfRefused).toBeLessThan(friendly.faceIfRefused);
        expect(toTheDeath.faceIfRefused).toBeCloseTo(friendly.faceIfRefused * REFUSING_TO_DIE_COSTS, 2);
        expect(AN_EQUAL_IS_WITHIN_REALMS).toBeGreaterThan(0);
    });

    it('is fought on the house\'s own ground, and its duelling ground before its yard', () => {
        const state = world([person('a', 16)]);
        expect(whereADuelIsFought(state, state.factions[0]!)!.id).toBe('room-duelling_ground');
        const noGround = world([person('a', 16)], ['practice_yard']);
        expect(whereADuelIsFought(noGround, noGround.factions[0]!)!.id).toBe('room-practice_yard');
        const bare = world([person('a', 16)], []);
        expect(whereADuelIsFought(bare, bare.factions[0]!)!.id).toBe('loc-seat');
    });
});

describe('what a duel leaves', () => {
    /**
     * Two Core Formation cultivators with blades, which is where a body is the
     * whole of a person (`killRequirement`) - above Nascent Soul a duel ends
     * with somebody's body destroyed and the person still in it.
     */
    function twoWhoCanKill(pile: number, extra: NpcRecord[] = []): WorldState {
        const state = world([
            holding(person('challenger', REALM_TIERS[2]!.ordinalStart + 2), 'challenged', pile),
            holding(person('challenged', REALM_TIERS[2]!.ordinalStart), 'challenger', pile),
            ...Array.from({ length: 4 }, (_, i) => person(`watcher-${i}`, 8)),
            ...extra
        ]);
        for (const who of ['challenger', 'challenged']) {
            state.objects.push(makeObject({
                id: `blade-${who}`, name: 'a sword', kind: 'artifact', power: 22,
                possessorId: who, ownerId: who, locationId: 'room-duelling_ground'
            }));
        }
        return state;
    }

    function fight(state: WorldState, terms: DuelTerms, seed: string) {
        return holdADuel(state, {
            challenger: state.npcs[0]!, challenged: state.npcs[1]!, terms,
            where: state.locations.find(l => l.id === 'room-duelling_ground')!, day: DAY,
            rng: forStream(seed, 'duel')
        });
    }

    it('settles the estate and opens the accounts, and every duel death is sanctioned', () => {
        let deaths = 0;
        for (let seed = 0; seed < 20; seed++) {
            const kin = upsertRelationship(person('kin', 12, { id: 'kin' }), {
                targetId: 'challenged', targetName: 'challenged', kind: 'kin', standing: 0.8, note: 'Brother.'
            }, DAY);
            const state = twoWhoCanKill(-0.9, [kin]);
            // BOTH ENDS OF THE TIE, and on both fighters: who the dead one
            // leaves is read off their own row, and either of them can be the
            // one on the ground.
            for (const id of ['challenger', 'challenged']) {
                const at = state.npcs.findIndex(n => n.id === id);
                state.npcs[at] = upsertRelationship(state.npcs[at]!, {
                    targetId: 'kin', targetName: 'kin', kind: 'kin', standing: 0.8, note: 'Brother.'
                }, DAY);
            }
            const out = fight(state, 'life_and_death', `seed-${seed}`);
            if (!out.died) continue;
            deaths++;
            expect(state.npcs.find(n => n.id === out.loserId)!.status).not.toBe('alive');
            const fact = state.history.facts.find(f => f.data?.duel === true)!;
            expect(fact.data.sanctioned, 'a death on declared terms is sanctioned').toBe(true);
            expect(fact.data.theTermsWereBroken).toBe(false);
            expect(fact.summary).toContain('life-and-death');
            // AND EVERY ORDINARY CONSEQUENCE: the estate settled, and the death
            // priced as a killing, which is what the people the dead one left
            // hold against the winner.
            expect(fact.data.deedWeight, 'priced like any other killing').toBeDefined();
            expect(state.npcs.find(n => n.id === out.loserId)!.spiritStones).toBe(0);
        }
        expect(deaths, 'life and death means what it says').toBeGreaterThan(0);
    });

    it('lets somebody strong enough step in, and it costs them face', () => {
        let saved = 0;
        for (let seed = 0; seed < 20; seed++) {
            const master = upsertRelationship(
                person('master', REALM_TIERS[4]!.ordinalStart, { id: 'master' }),
                { targetId: 'challenged', targetName: 'challenged', kind: 'master', standing: 0.8, note: 'Theirs.' },
                DAY
            );
            const state = twoWhoCanKill(-0.9, [master]);
            const out = fight(state, 'life_and_death', `seed-${seed}`);
            if (out.savedById === null) continue;
            saved++;
            expect(out.savedById).toBe('master');
            expect(out.died).toBe(false);
            expect(state.npcs.find(n => n.id === out.loserId)!.status).toBe('alive');
            // Always paid, whoever they are.
            expect(faceOf(state.npcs.find(n => n.id === 'master')!)).toBeLessThan(0);
        }
        expect(saved, 'somebody who could get a hand in sometimes does').toBeGreaterThan(0);
        // Status scales what it costs them, and never to nothing.
        expect(whatSteppingInCosts({ rescuerOrdinal: 30, reachedRealm: 2, witnesses: 15 }))
            .toBeLessThan(whatSteppingInCosts({ rescuerOrdinal: 21, reachedRealm: 2, witnesses: 15 }));
        expect(whatSteppingInCosts({ rescuerOrdinal: 45, reachedRealm: 2, witnesses: 15 })).toBeGreaterThan(0);
    });

    it('calls a kill under friendly terms a murder, and charges the winner for it', () => {
        // The terms said yield. What one of them brought to it did not: the pile
        // between them is past the band where there is nothing left but to end
        // it, which is the world's own reading (`whyTheyStoodUp`).
        let broken = 0;
        for (let seed = 0; seed < 20; seed++) {
            const state = twoWhoCanKill(-0.9);
            const out = fight(state, 'to_yield', `seed-${seed}`);
            if (!out.theTermsWereBroken) continue;
            broken++;
            expect(out.died).toBe(true);
            const fact = state.history.facts.find(f => f.data?.duel === true)!;
            expect(fact.data.theTermsWereBroken).toBe(true);
            expect(fact.data.sanctioned, 'this one is a murder').toBe(false);
            expect(faceOf(state.npcs.find(n => n.id === out.winnerId)!)).toBeLessThan(0);
        }
        expect(broken, 'somebody who came to end it ends it').toBeGreaterThan(0);
    });

    it('reads the pile across every kind standing between them, not the defining one', () => {
        // A WIFE HUMILIATED IN PUBLIC BY HER HUSBAND HAS BEEN HUMILIATED IN
        // PUBLIC. Rows are keyed by the pair AND the kind, and they sort with
        // the most defining kind first, so a marriage sits ahead of the slight
        // written beside it. Reading one row answered with the marriage, at a
        // standing above nought, and the pile came back as nothing.
        let wife = person('wife', 16);
        wife = upsertRelationship(wife, {
            targetId: 'husband', targetName: 'husband', kind: 'spouse', standing: 0.8,
            note: 'Married.'
        }, DAY);
        wife = holding(wife, 'husband', -0.7);
        expect(wife.relationships.filter(r => r.targetId === 'husband'),
            'the marriage and the slight both stand').toHaveLength(2);
        expect(wife.relationships.find(r => r.targetId === 'husband')!.kind,
            'and the marriage is the one on top').toBe('spouse');

        expect(theSlightsBetween(wife, 'husband')).toBeCloseTo(0.7, 2);

        // And the challenge read answers off it. Realms apart and no face
        // between them, so the pile is the only thing that can make her answer.
        const said = whetherTheyAnswer({
            challenged: wife, challenger: person('husband', 40), terms: 'to_yield', witnesses: 4
        });
        expect(said.answers).toBe(true);
        expect(said.why, 'and it says how much').toMatch(/0\.70/);
    });

    it('leaves a pile between them where nobody died', () => {
        const state = world([person('a', 16), person('b', 16), person('watcher', 10)]);
        const out = holdADuel(state, {
            challenger: state.npcs[0]!, challenged: state.npcs[1]!, terms: 'to_yield',
            where: state.locations.find(l => l.id === 'room-duelling_ground')!, day: DAY
        });
        if (out.loserId === null) return;
        const loser = state.npcs.find(n => n.id === out.loserId)!;
        expect(theSlightsBetween(loser, out.winnerId!)).toBeGreaterThan(0);
        expect(faceOf(loser)).toBeLessThan(faceOf(state.npcs.find(n => n.id === out.winnerId)!));
        expect(A_PUBLIC_WIN).toBe(1);
    });
});
