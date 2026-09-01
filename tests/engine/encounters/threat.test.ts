/**
 * The second gate, and the regression it exists to stop coming back.
 *
 * A 60-life soak of the wired system reported: 32 of 60 deaths in combat, none
 * at a realm boundary, and the best life reaching ordinal 12 where it had
 * previously reached 40-44. The encounter layer had become the leading cause
 * of death and was capping the ladder five realms below where it was.
 *
 * The cause was one missing filter. `encounters.ts` says an entry answers two
 * questions with two different gate columns -
 *
 *     "is this entry pitched at me"    -> minOrdinal
 *     "what does the thing in it cost" -> threatOrdinal
 *
 * - and the pool was reading only the first. The two are not correlated:
 * `enc-culling-notice-mispriced` is pitched at rung 2 with a threat at rung 9,
 * and that mismatch IS the entry. So a rung-2 cultivator drew fights nine rungs
 * up as a matter of routine, and AGENTS.md is explicit that a four-rank gap is
 * not a hard fight, it is a death.
 */

import { describe, expect, it } from 'vitest';
import {
    THREAT_BAND_WEIGHT,
    encounterPool,
    rollEncounters,
    type EncounterOccurrence,
    type EncounterPlace
} from '../../../src/engine/encounters/index.js';
import { encounterThreatRegard } from '../../../src/data/cultivation/encounters.js';

const road: EncounterPlace = { id: 'r', name: 'the low road', kind: 'wilds', danger: 0.45 };

function who(ordinal: number) {
    return { id: 'c1', realmOrdinal: ordinal, fortune: 1, maxHp: 60, hp: 60, spiritStones: 40 };
}

/** Share of the draw at this rung that sits in each threat band. */
function bandShare(ordinal: number): Record<string, number> {
    const pool = encounterPool({ ordinal, activity: 'travel', place: road });
    const total = pool.reduce((sum, row) => sum + row.weight, 0);
    const out: Record<string, number> = {};
    for (const row of pool) {
        const band = row.threatBand;
        if (!band) continue;
        out[band] = (out[band] ?? 0) + row.weight / total;
    }
    return out;
}

describe('the threat gate', () => {
    it('keeps a hopeless fight rare at every rung', () => {
        for (let ordinal = 0; ordinal <= 30; ordinal++) {
            const share = bandShare(ordinal);
            // A fight that is a death by construction. It must remain possible -
            // the world contains things far above you and discovery.md wants
            // that met - and it must not be the median Tuesday.
            expect(share.unreachable ?? 0, `ordinal ${ordinal}: too many lethal draws`)
                .toBeLessThan(0.04);
            expect(share.overmatched ?? 0, `ordinal ${ordinal}: too many losing draws`)
                .toBeLessThan(0.1);
        }
    });

    it('does not delete them, because they are the texture', () => {
        // Deleting the far-above entries would delete the thing
        // docs/world/discovery.md asks for. They are re-weighted, not cut.
        let sawUnreachable = false;
        let sawOvermatched = false;
        for (let ordinal = 0; ordinal <= 30; ordinal++) {
            const share = bandShare(ordinal);
            if ((share.unreachable ?? 0) > 0) sawUnreachable = true;
            if ((share.overmatched ?? 0) > 0) sawOvermatched = true;
        }
        expect(sawUnreachable).toBe(true);
        expect(sawOvermatched).toBe(true);
    });

    it('leaves an even fight at full catalog weight', () => {
        // The damping is on mismatch only. Anything the cultivator could
        // actually take draws exactly as the catalog authored it.
        expect(THREAT_BAND_WEIGHT.stretch).toBe(1);
        expect(THREAT_BAND_WEIGHT.matched).toBe(1);
        expect(THREAT_BAND_WEIGHT.assured).toBe(1);
        expect(THREAT_BAND_WEIGHT.unreachable).toBeLessThan(THREAT_BAND_WEIGHT.overmatched);
        expect(THREAT_BAND_WEIGHT.overmatched).toBeLessThan(1);
    });

    it('puts most of the fighting at a rung the cultivator can meet', () => {
        for (const ordinal of [0, 2, 4, 8, 12, 20]) {
            const share = bandShare(ordinal);
            const fair = (share.stretch ?? 0) + (share.matched ?? 0) + (share.assured ?? 0);
            const unfair = (share.overmatched ?? 0) + (share.unreachable ?? 0);
            expect(fair, `ordinal ${ordinal}`).toBeGreaterThan(unfair * 3);
        }
    });
});

describe('what a driver is told', () => {
    it('never says a fight nine rungs up is compulsory', () => {
        // The other half of the regression. An `unavoidable` TAG means the
        // event happens to you; it has never meant that fighting is the only
        // option, and reading it that way sent cultivators into fights they
        // could not have.
        const seen: EncounterOccurrence[] = [];
        for (let t = 0; t < 8000; t++) {
            seen.push(...rollEncounters({
                seed: 'driver', startDay: t, days: 1, activity: 'travel',
                cultivator: who(4), place: road
            }).occurrences);
        }

        const fights = seen.filter(o => o.confrontation !== null);
        expect(fights.length).toBeGreaterThan(0);

        for (const o of fights) {
            const c = o.confrontation!;
            if (o.stance !== 'engaged') {
                expect(c.engageable, `${o.entryId} offered an unwinnable fight as engageable`).toBe(false);
                expect(c.avoidable, `${o.entryId} said a hopeless fight was unavoidable`).toBe(true);
            } else {
                expect(c.engageable).toBe(true);
            }
        }
    });

    it('marks every far-above meeting as something to walk away from', () => {
        const seen: EncounterOccurrence[] = [];
        for (let t = 0; t < 12000; t++) {
            seen.push(...rollEncounters({
                seed: 'above2', startDay: t, days: 1, activity: 'travel',
                cultivator: who(6), place: road
            }).occurrences);
        }
        const above = seen.filter(o => o.stance === 'above' && o.confrontation);
        expect(above.length).toBeGreaterThan(0);
        for (const o of above) {
            expect(o.confrontation!.engageable).toBe(false);
            expect(o.confrontation!.avoidable).toBe(true);
            // And the regard band agrees, which is the point: one rule.
            const band = encounterThreatRegard(
                { ...(o as never), threatOrdinal: o.confrontation!.threatOrdinal } as never, 6
            );
            expect(band === null || band.gap <= -4).toBe(true);
        }
    });
});

describe('where you seclude', () => {
    const cave: EncounterPlace = { id: 'c', name: 'a cave', kind: 'cave', danger: 0.3 };

    function peopleShare(locatability: 'known' | 'private' | 'hidden'): number {
        const pool = encounterPool({ ordinal: 10, activity: 'seclusion', place: cave, locatability });
        const total = pool.reduce((sum, r) => sum + r.weight, 0);
        const social = pool
            .filter(r => ['sect_event', 'dao_house', 'rival_cultivator', 'bandits', 'commerce']
                .includes(r.entry.kind))
            .reduce((sum, r) => sum + r.weight, 0);
        return total > 0 ? social / total : 0;
    }

    it('makes being findable the cost and the benefit of belonging', () => {
        const known = peopleShare('known');
        const priv = peopleShare('private');
        const hidden = peopleShare('hidden');
        expect(known).toBeGreaterThan(priv);
        expect(priv).toBeGreaterThan(hidden);
    });

    it('does not make disappearing perfect', () => {
        // Somebody stumbles across a cave now and again. A world where
        // vanishing is airtight is a world where vanishing is always correct.
        expect(peopleShare('hidden')).toBeGreaterThan(0);
    });

    it('leaves the ground exactly as dangerous wherever you hide', () => {
        // The whole point of the asymmetry: nobody can find you, and the
        // landslide was never looking.
        const ground = (loc: 'known' | 'hidden') => {
            const pool = encounterPool({ ordinal: 10, activity: 'seclusion', place: cave, locatability: loc });
            return pool.filter(r => r.entry.kind === 'misfortune' || r.entry.kind === 'spirit_beast')
                .reduce((sum, r) => sum + r.weight, 0);
        };
        expect(ground('hidden')).toBeCloseTo(ground('known'), 6);
    });

    it('stops the house sending for somebody it cannot find', () => {
        function summonses(locatability: 'known' | 'hidden'): number {
            let n = 0;
            for (let s = 0; s < 80; s++) {
                n += rollEncounters({
                    seed: `loc-${s}`, startDay: 400, days: 20 * 360, activity: 'seclusion',
                    cultivator: who(12), place: cave, limit: 32, locatability,
                    membership: {
                        factionId: 'f', factionName: 'Azure Cloud Pavilion',
                        rankIndex: 1, rankCount: 6, contribution: 0
                    }
                }).occurrences.filter(o => o.source === 'summons').length;
            }
            return n;
        }
        const onGround = summonses('known');
        const vanished = summonses('hidden');
        expect(onGround).toBeGreaterThan(0);
        expect(vanished).toBeLessThan(onGround);
    });

    it('does not consult locatability for somebody standing in a market', () => {
        const a = encounterPool({ ordinal: 10, activity: 'abroad', place: cave, locatability: 'hidden' });
        const b = encounterPool({ ordinal: 10, activity: 'abroad', place: cave, locatability: 'known' });
        expect(a.map(r => r.weight)).toEqual(b.map(r => r.weight));
    });
});
