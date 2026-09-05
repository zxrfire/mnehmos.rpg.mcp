/**
 * Design guards on institutional work.
 *
 * The claim under test is not that a summons fires. It is that a member and a
 * rogue live different lives, that the difference is legible, and that none of
 * it is a branch on which house is asking.
 */

import { describe, expect, it } from 'vitest';
import {
    COMMISSION_ENTRIES,
    SUMMONS_ENTRIES,
    boardRefusals,
    callsOn,
    commissionBoard,
    dutyTermsFor,
    isCommission,
    postureFor,
    rollEncounters,
    scaleFor,
    summonable,
    summonsPool,
    type EncounterActivity,
    type EncounterOccurrence,
    type EncounterPlace,
    type Membership
} from '../../../src/engine/encounters/index.js';
import { ENCOUNTERS, requireEncounter } from '../../../src/data/cultivation/encounters.js';
import { MAX_ORDINAL } from '../../../src/engine/cultivation/realms.js';

const village: EncounterPlace = { id: 'v', name: 'Burnt Earth', kind: 'settlement', danger: 0.2 };
const road: EncounterPlace = { id: 'r', name: 'the low road', kind: 'wilds', danger: 0.45 };
const cave: EncounterPlace = { id: 'c', name: 'a cave', kind: 'cave', danger: 0.3 };

function member(rankIndex: number, rankCount = 6): Membership {
    return {
        factionId: 'sect-azure',
        factionName: 'Azure Cloud Pavilion',
        rankIndex,
        rankCount,
        contribution: 0
    };
}

function who(ordinal: number) {
    return { id: 'c1', realmOrdinal: ordinal, fortune: 1, maxHp: 60, hp: 60, spiritStones: 40 };
}

describe('reading the catalog', () => {
    it('finds both shapes without a duty table existing', () => {
        expect(SUMMONS_ENTRIES.length).toBeGreaterThan(0);
        expect(COMMISSION_ENTRIES.length).toBeGreaterThan(0);
        // The user named both of these. They must be readable as calls.
        expect(SUMMONS_ENTRIES.map(e => e.id)).toContain('enc-caravan-under-attack');
        expect(SUMMONS_ENTRIES.map(e => e.id)).toContain('enc-beast-tide');
        expect(SUMMONS_ENTRIES.map(e => e.id)).toContain('enc-sect-war-mobilization');
        expect(COMMISSION_ENTRIES.map(e => e.id)).toContain('enc-sect-mission-board');
    });

    it('keeps a muster and a job disjoint', () => {
        for (const entry of ENCOUNTERS) {
            expect(callsOn(entry) && isCommission(entry)).toBe(false);
        }
    });

    it('reads only tags the catalog already carries', () => {
        // If this fails, somebody has started listing entry ids in duties.ts.
        // The predicate must stay a reading, so an entry opts in by being
        // tagged the way the existing musters are.
        const muster = requireEncounter('enc-sect-war-mobilization');
        expect(muster.tags).toContain('obligation');
        expect(callsOn({ ...muster, tags: muster.tags.filter(t => t !== 'obligation' && t !== 'war') }))
            .toBe(false);
    });
});

describe('who gets asked', () => {
    it('never sends a rogue anywhere, because nobody has them on a list', () => {
        for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal++) {
            expect(summonsPool(ordinal, null)).toHaveLength(0);
        }

        let sent = 0;
        for (let t = 0; t < 2000; t++) {
            sent += rollEncounters({
                seed: 'rogue', startDay: t, days: 1, activity: 'travel',
                cultivator: who(10), place: road
            }).occurrences.filter(o => o.source === 'summons').length;
        }
        expect(sent).toBe(0);
    });

    it('does not send anybody against what the house would send an elder to', () => {
        for (const candidate of summonsPool(4, member(0))) {
            expect(summonable(candidate.terms.regard.band)).toBe(true);
            expect(['unreachable', 'overmatched']).not.toContain(candidate.terms.regard.band);
        }
    });

    it('stops asking once it is beneath them', () => {
        // The whole texture, in one assertion and with no rule about elders:
        // something pitched a long way below somebody stops being put to them.
        const caravan = requireEncounter('enc-caravan-under-attack');
        const low = dutyTermsFor(caravan, 6, member(1), 'summons');
        const high = dutyTermsFor(caravan, 24, member(5), 'summons');
        expect(summonable(low.regard.band)).toBe(true);
        expect(summonable(high.regard.band)).toBe(false);
    });
});

describe('how the ask is put', () => {
    it('scales with the house ladder and not with the house', () => {
        expect(postureFor(member(0, 6))).toBe('told');
        expect(postureFor(member(3, 6))).toBe('assigned');
        expect(postureFor(member(5, 6))).toBe('consulted');

        // A four-rung house and a seven-rung house both produce the range.
        expect(postureFor(member(0, 4))).toBe('told');
        expect(postureFor(member(3, 4))).toBe('consulted');
        expect(postureFor(member(0, 7))).toBe('told');
        expect(postureFor(member(6, 7))).toBe('consulted');
    });

    it('asks a rogue rather than telling them', () => {
        expect(postureFor(null)).toBe('assigned');
    });

    it('says the terms and what refusing is worth', () => {
        const sent = firstSummons('terms', 10, member(0));
        expect(sent).not.toBeNull();
        expect(sent!.duty).not.toBeNull();
        expect(sent!.event.summary).toMatch(/Term: \d+ days/u);
        expect(sent!.event.summary).toMatch(/Declining is recorded as (slight|serious|grave|unforgivable)/u);
    });

    it('never lets a house the cultivator has not heard of give them orders', () => {
        const sent = firstSummons('own-house', 10, member(1));
        expect(sent).not.toBeNull();
        expect(sent!.duty!.factionName).toBe('Azure Cloud Pavilion');
        expect(sent!.event.summary).toContain('Azure Cloud Pavilion');
    });
});

describe('what a summons is worth', () => {
    it('pays contribution only to somebody on a ledger', () => {
        const board = requireEncounter('enc-sect-mission-board');
        const inHouse = dutyTermsFor(board, 10, member(1), 'commission');
        const outside = dutyTermsFor(board, 10, null, 'commission');

        expect(inHouse.contribution).toBeGreaterThan(0);
        expect(outside.contribution).toBe(0);
        // The stones are the same. The ledger is the whole difference.
        expect(outside.stones).toBe(inHouse.stones);
    });

    it('prices a muster more gravely than an errand', () => {
        const muster = dutyTermsFor(requireEncounter('enc-sect-war-mobilization'), 20, member(2), 'summons');
        const errand = dutyTermsFor(requireEncounter('enc-alchemist-commission'), 10, member(2), 'commission');
        expect(muster.refusal.severity).toBe('unforgivable');
        expect(errand.refusal.severity).toBe('slight');
        expect(muster.days).toBeGreaterThan(errand.days);
    });

    it('reserves the worst word in the ledger for desertion', () => {
        const war = requireEncounter('enc-sect-war-mobilization');
        // A member who does not report has deserted. Somebody with no house
        // has merely declined, and the ledger says so.
        expect(dutyTermsFor(war, 20, member(2), 'summons').refusal.severity).toBe('unforgivable');
        expect(dutyTermsFor(war, 20, null, 'summons').refusal.severity).toBe('grave');

        // And nothing short of a war reaches that word.
        for (const entry of SUMMONS_ENTRIES) {
            if (scaleFor(new Set(entry.tags)) === 'total') continue;
            const terms = dutyTermsFor(entry, entry.minOrdinal, member(2), 'summons');
            expect(terms.refusal.severity).not.toBe('unforgivable');
        }
    });

    it('calls refusal a broken oath for a member and not for a stranger', () => {
        const entry = requireEncounter('enc-caravan-under-attack');
        expect(dutyTermsFor(entry, 6, member(1), 'summons').refusal.cause).toBe('broken_oath');
        expect(dutyTermsFor(entry, 6, null, 'summons').refusal.cause).toBe('other');
    });
});

describe('scale', () => {
    it('makes a raided caravan and a war one mechanic with a number on it', () => {
        const caravan = dutyTermsFor(requireEncounter('enc-caravan-under-attack'), 6, member(1), 'summons');
        const tide = dutyTermsFor(requireEncounter('enc-beast-tide'), 16, member(1), 'summons');
        const war = dutyTermsFor(requireEncounter('enc-sect-war-mobilization'), 20, member(1), 'summons');

        expect(caravan.scale).toBe('local');
        expect(tide.scale).toBe('regional');
        expect(war.scale).toBe('total');

        // Everything that differs, differs monotonically along the one axis.
        expect(tide.days).toBeGreaterThan(caravan.days);
        expect(war.days).toBeGreaterThan(tide.days);
        expect(tide.cohort).toBeGreaterThan(caravan.cohort);
        expect(war.cohort).toBeGreaterThan(tide.cohort);
    });

    it('sends nobody alone to a war and nobody in company to a roadside', () => {
        const caravan = dutyTermsFor(requireEncounter('enc-caravan-under-attack'), 6, member(1), 'summons');
        expect(caravan.cohort).toBe(0);
        expect(dutyTermsFor(requireEncounter('enc-sect-war-mobilization'), 20, member(0), 'summons').cohort)
            .toBeGreaterThan(10);
    });

    it('spends its bottom rungs in quantity and its top rungs singly', () => {
        const war = requireEncounter('enc-sect-war-mobilization');
        const low = dutyTermsFor(war, 20, member(0), 'summons').cohort;
        const high = dutyTermsFor(war, 20, member(5), 'summons').cohort;
        expect(low).toBeGreaterThan(high);
    });

    it('gives a rogue no cohort at all, because nobody sent them', () => {
        expect(dutyTermsFor(requireEncounter('enc-sect-war-mobilization'), 20, null, 'summons').cohort)
            .toBe(0);
    });
});

describe('access', () => {
    it('is the half of membership that is not danger', () => {
        // A trial ground and a front are places a rogue cannot go. That is the
        // sect being worth joining, stated in gameplay rather than in prose.
        const realm = requireEncounter('enc-secret-realm-opening');
        expect(callsOn(realm), 'a sect deployment must read as a call').toBe(true);

        const sent = dutyTermsFor(realm, 22, member(1), 'summons');
        expect(sent.access.granted).toBe(true);
        expect(sent.access.note).toContain('Azure Cloud Pavilion');

        const alone = dutyTermsFor(realm, 22, null, 'summons');
        expect(alone.access.granted).toBe(false);
        expect(alone.access.note).toBe('');
    });

    it('grants nothing where there was no gate to open', () => {
        const caravan = dutyTermsFor(requireEncounter('enc-caravan-under-attack'), 6, member(1), 'summons');
        expect(caravan.access.granted).toBe(false);
    });
});

describe('the board', () => {
    it('narrows by rung and says why it refused', () => {
        const offers = commissionBoard(20, member(4));
        const refused = boardRefusals(20, member(4));
        expect(offers).toHaveLength(0);
        expect(refused.length).toBeGreaterThan(0);
        // "An elder is not offered errands at all and gets told so." The
        // telling is regard's own line, which already states the gap.
        for (const row of refused) expect(row.regard.reaction.length).toBeGreaterThan(0);
    });

    it('is not empty for somebody who has just joined', () => {
        expect(commissionBoard(3, member(0)).length).toBeGreaterThan(0);
        expect(commissionBoard(6, member(0)).length).toBeGreaterThan(0);
    });

    it('is open to a rogue, who is simply paid differently', () => {
        const asMember = commissionBoard(6, member(0));
        const asRogue = commissionBoard(6, null);
        expect(asRogue.map(r => r.entry.id)).toEqual(asMember.map(r => r.entry.id));
        for (const row of asRogue) expect(row.terms.contribution).toBe(0);
    });
});

describe('a summons in play', () => {
    it('always stops what the cultivator was doing', () => {
        const seen: EncounterOccurrence[] = [];
        for (let t = 0; t < 3000; t++) {
            seen.push(...rollEncounters({
                seed: 'stops', startDay: t, days: 1, activity: 'abroad',
                cultivator: who(10), place: village, membership: member(1)
            }).occurrences.filter(o => o.source === 'summons'));
        }
        expect(seen.length).toBeGreaterThan(0);
        for (const o of seen) {
            expect(o.interrupts, 'a summons that was slept through is a notification').toBe(true);
            // Being asked is not the engine helping itself to the answer.
            expect(o.deltas).toEqual({ hp: 0, spiritStones: 0, satiety: 0, rations: 0 });
        }
    });

    it('reaches a cave, and does not reach a sealed one', () => {
        let intoSeclusion = 0;
        let intoSealed = 0;
        for (let s = 0; s < 60; s++) {
            const common = {
                seed: `door-${s}`, startDay: 400, days: 20 * 360,
                cultivator: who(12), place: cave, membership: member(1), limit: 32
            };
            intoSeclusion += rollEncounters({ ...common, activity: 'seclusion' as EncounterActivity })
                .occurrences.filter(o => o.source === 'summons').length;
            intoSealed += rollEncounters({ ...common, activity: 'sealed' as EncounterActivity })
                .occurrences.filter(o => o.source === 'summons').length;
        }
        // A house that wants somebody sends somebody to the cave.
        expect(intoSeclusion).toBeGreaterThan(0);
        // The formation holds against the house too. That is the bargain.
        expect(intoSealed).toBe(0);
    });

    it('is deterministic', () => {
        const input = {
            seed: 'fixed', startDay: 900, days: 3600, activity: 'seclusion' as EncounterActivity,
            cultivator: who(12), place: cave, membership: member(2), limit: 32
        };
        expect(rollEncounters(input)).toEqual(rollEncounters(input));
    });
});

function firstSummons(seed: string, ordinal: number, membership: Membership) {
    for (let t = 0; t < 6000; t++) {
        const found = rollEncounters({
            seed, startDay: t, days: 1, activity: 'abroad',
            cultivator: who(ordinal), place: village, membership
        }).occurrences.find(o => o.source === 'summons');
        if (found) return found;
    }
    return null;
}
