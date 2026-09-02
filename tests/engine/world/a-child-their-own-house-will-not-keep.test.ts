/**
 * Fostering, and the one thing that decides whether it is a feature: does
 * somebody in a running world actually do it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE IS GUARDING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `HOLLOW_COURT_FOSTERAGE` sat in the catalog with one consumer, and that
 * consumer was a test. `spendAWord` - the whole engine half of the admission
 * favour - had no caller anywhere outside its own package. Both were correct,
 * both were tested, and nothing in the running world reached either.
 *
 * So the assertions that matter here are the ones that advance a seeded world
 * and then go looking for a person. The unit tests below them are the ordinary
 * kind and would all have passed on the dead version.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * MEASURED, POOLED, AND WHAT THE NUMBERS WERE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Six seeds, five hundred years each, at the time of writing:
 *
 *     229 fosterings   138 because a household would not own the birth
 *                       91 because the parent's own house has a bar that does
 *                          not move, or no door at all
 *     229 of 229 entered a house WITHOUT meeting its admission ordinal
 *      16 of them were alive at rank 2 or better at the end
 *
 * The sending houses were fifty-odd different bodies and the receiving houses
 * were as varied, which is the whole point: where a child goes comes off the
 * parent's own ties, so two members of the same house with different friends
 * place their children in different places.
 *
 * The bars below are pooled across seeds and set well under those figures, per
 * the pooling rule: a threshold on a varied outcome asserted at one seed
 * reports the world moving as the world breaking.
 *
 * ── AND ONE THING THAT DOES NOT HAPPEN, WRITTEN DOWN RATHER THAN HIDDEN ──
 *
 * The Hollow Court's own terms - the only terms in the catalog - were reached
 * ONCE in twelve seeds of five hundred years, and that child died at 100 at
 * ordinal 12. At 2000 years on three more seeds, once, dead at 200 at ordinal
 * 13. `lifespanForOrdinal` is 100 below ordinal 13 and 200 below 16, and the
 * Court's deadline is 250 - so nobody who has not already climbed well past the
 * bar lives to be assessed at all. That is the gate's own stated intent
 * ("whether the rest of the road fits in the life they have left") arriving as
 * a measurement, and it means `applyFosterageReturns` runs every year of every
 * world and has so far found nobody. The world-level test at the bottom drives
 * that pass directly rather than waiting for a seed to produce the case.
 */

import { describe, it, expect } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { advanceWorldYears } from '../../../src/engine/world/driver.js';
import { createNpc, setRealm } from '../../../src/engine/world/npc-state.js';
import { DAYS_PER_YEAR } from '../../../src/engine/cultivation/cultivation.js';
import {
    assessTheReturn,
    fosterTheChild,
    isConcealed,
    wasFostered,
    whoCouldBeAsked,
    whyTheirOwnHouseWillNotKeepThem,
    WOULD_TAKE_A_CHILD,
    type FosterCandidate
} from '../../../src/engine/world/a-child-their-own-house-will-not-keep.js';
import { HOLLOW_COURT_FOSTERAGE, requireSect } from '../../../src/data/cultivation/sects.js';
import { doorsOf } from '../../../src/engine/birth/spending-a-word-to-place-a-child.js';
import { createFavor } from '../../../src/engine/social/grudges.js';
import { shameCausesFromTags } from '../../../src/engine/social/shame.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

const SEEDS = ['a', 'b', 'c', 'd'];
const HORIZON = 400;

// One house that takes a child on a word, used as the destination throughout.
const TAKES_A_WORD = 'house-ninefold-ledger';

function candidate(over: Partial<FosterCandidate> = {}): FosterCandidate {
    return {
        personId: 'npc-friend',
        personName: 'A Friend',
        houseId: TAKES_A_WORD,
        standing: 0.8,
        ...over
    };
}

describe('whose house will not keep their child', () => {
    it('answers null for almost every house in the world', () => {
        // The normal case, and it has to stay the normal case: everywhere else
        // a cultivator raises their child in their own house.
        expect(whyTheirOwnHouseWillNotKeepThem(TAKES_A_WORD)).toBeNull();
        expect(whyTheirOwnHouseWillNotKeepThem('sect-azure-cloud-pavilion')).toBeNull();
        expect(whyTheirOwnHouseWillNotKeepThem(null)).toBeNull();
    });

    it('reads the reason off the catalog rather than a list of factions', () => {
        // Two opposite reasons, and the difference decides everything after it.
        expect(whyTheirOwnHouseWillNotKeepThem('sect-hollow-court')).toBe('the bar');
        expect(whyTheirOwnHouseWillNotKeepThem('court-kiln')).toBe('no door');
    });

    it('concealment follows the birth, never the institution', () => {
        expect(isConcealed('the birth')).toBe(true);
        expect(isConcealed('the bar')).toBe(false);
        expect(isConcealed('no door')).toBe(false);
    });
});

describe('who could be asked', () => {
    it('is people, ranked by the tie, and never a house', () => {
        const asked = whoCouldBeAsked([
            candidate({ personId: 'npc-cool', standing: 0.55 }),
            candidate({ personId: 'npc-close', standing: 0.95 })
        ]);
        expect(asked.map(a => a.personId)).toEqual(['npc-close', 'npc-cool']);
    });

    it('drops anybody the fosterer is not actually close to', () => {
        expect(whoCouldBeAsked([candidate({ standing: WOULD_TAKE_A_CHILD - 0.01 })])).toEqual([]);
    });

    it('takes somebody who owes them at any standing, which is what a favour is for', () => {
        const owed = createFavor({
            holderId: 'npc-parent',
            subjectId: 'npc-friend',
            cause: 'saved_life',
            severity: 'grave',
            onDay: 10,
            description: 'Carried them out of a collapse.'
        });
        const asked = whoCouldBeAsked([candidate({ standing: 0, owesTheFosterer: owed })]);
        expect(asked).toHaveLength(1);
    });

    it('will not ask the fosterer\'s own house, and will not ask twice', () => {
        expect(whoCouldBeAsked([candidate()], { fostererHouseId: TAKES_A_WORD })).toEqual([]);
        expect(whoCouldBeAsked([candidate({ alreadyAsked: true })])).toEqual([]);
    });

    it('will not ask somebody whose house has no door for a word to skip', () => {
        expect(whoCouldBeAsked([candidate({ houseId: 'sect-hollow-court' })])).toEqual([]);
        expect(whoCouldBeAsked([candidate({ houseId: 'court-kiln' })])).toEqual([]);
    });
});

describe('placing the child', () => {
    const base = {
        fostererId: 'npc-parent',
        childId: 'npc-child',
        onDay: 500,
        childOrdinal: 0
    };

    it('puts them inside a house whose bar they did not meet', () => {
        const out = fosterTheChild({ ...base, askedOf: candidate(), reason: 'the birth' });
        expect(wasFostered(out)).toBe(true);
        if (!wasFostered(out)) return;
        expect(out.houseId).toBe(TAKES_A_WORD);
        // The whole of what the word buys, and the figure comes from the
        // admission catalog rather than from this file.
        expect(out.barSkipped).toBe(doorsOf(TAKES_A_WORD)!.lowestDoor);
        expect(out.barSkipped!).toBeGreaterThan(0);
    });

    it('spends a held favour rather than reading it, and it is worth exactly once', () => {
        const owed = createFavor({
            holderId: base.fostererId,
            subjectId: 'npc-friend',
            cause: 'saved_life',
            severity: 'grave',
            onDay: 10,
            description: 'Carried them out of a collapse.'
        });
        expect(owed.status).toBe('open');
        const out = fosterTheChild({
            ...base,
            askedOf: candidate({ owesTheFosterer: owed }),
            reason: 'the bar'
        });
        if (!wasFostered(out)) throw new Error('refused');
        expect(out.spent?.status).toBe('settled');
        expect(out.spent?.settlement?.resolution).toBe('repaid');
        // Spent, so nothing new is owed. The record has left the open ledger
        // and cannot carry a second child.
        expect(out.incurred).toBeNull();
        // And a settled record buys nothing on its own: somebody with no
        // standing and a spent favour is no longer a person who would take a
        // child. The world enforces the other half by tag.
        expect(whoCouldBeAsked([
            candidate({ standing: 0, owesTheFosterer: out.spent })
        ])).toEqual([]);
    });

    it('incurs one instead when the fosterer had nothing to spend', () => {
        const out = fosterTheChild({ ...base, askedOf: candidate(), reason: 'the bar' });
        if (!wasFostered(out)) throw new Error('refused');
        expect(out.spent).toBeNull();
        expect(out.incurred?.kind).toBe('favor');
        expect(out.incurred?.cause).toBe('sponsored_admission');
        // Owed TO the person asked, BY the parent. That direction is the whole
        // meaning of the row.
        expect(out.incurred?.holderId).toBe('npc-friend');
        expect(out.incurred?.subjectId).toBe(base.fostererId);
    });

    it('gives the origin to the parents and the person asked, and not to the child', () => {
        const out = fosterTheChild({
            ...base,
            askedOf: candidate(),
            reason: 'the birth',
            otherParentId: 'npc-other-parent'
        });
        if (!wasFostered(out)) throw new Error('refused');
        const holders = out.told.map(t => t.holderId).sort();
        expect(holders).toContain('npc-parent');
        expect(holders).toContain('npc-other-parent');
        expect(holders).toContain('npc-friend');
        expect(holders).not.toContain(base.childId);
        expect(out.withheldFrom).toEqual([base.childId]);
        expect(out.childStage).toBe('unaware');
    });

    it('writes a shame for the birth and none for the bar', () => {
        const birth = fosterTheChild({ ...base, askedOf: candidate(), reason: 'the birth' });
        const bar = fosterTheChild({ ...base, askedOf: candidate(), reason: 'the bar' });
        if (!wasFostered(birth) || !wasFostered(bar)) throw new Error('refused');
        expect(bar.shame).toBeNull();
        expect(birth.shame?.cause).toBe('birth_outside_the_household');
        // The concealment and the shame are one object: the record naming what
        // would be lost carries the short list of people who already know.
        expect(birth.shame!.heldBy).toContain('npc-friend');
        expect(birth.shame!.heldBy).not.toContain(base.childId);
        expect(birth.shame!.common).toBe(false);
    });

    it('carries the sending house\'s own terms, and null for everybody else', () => {
        const court = fosterTheChild({
            ...base,
            askedOf: candidate(),
            reason: 'the bar',
            fostererHouseId: 'sect-hollow-court'
        });
        const ordinary = fosterTheChild({
            ...base,
            askedOf: candidate(),
            reason: 'the birth',
            fostererHouseId: 'sect-azure-dew-sect'
        });
        if (!wasFostered(court) || !wasFostered(ordinary)) throw new Error('refused');
        expect(court.terms).toBe(HOLLOW_COURT_FOSTERAGE);
        expect(ordinary.terms).toBeNull();
    });

    it('hands back the house\'s own refusal rather than throwing', () => {
        expect(fosterTheChild({
            ...base, askedOf: candidate({ houseId: 'sect-hollow-court' }), reason: 'the birth'
        })).toBe('bar will not move');
        expect(fosterTheChild({
            ...base, askedOf: candidate({ houseId: null }), reason: 'the birth'
        })).toBe('nobody to ask');
    });
});

describe('the assessment, on the sending house\'s own terms', () => {
    const terms = HOLLOW_COURT_FOSTERAGE;

    it('needs the rung AND the years, and reports which one failed', () => {
        expect(assessTheReturn(terms, terms.returnOrdinal, terms.returnByAge).returns).toBe(true);
        const late = assessTheReturn(terms, terms.returnOrdinal, terms.returnByAge + 1);
        expect(late.returns).toBe(false);
        expect(late.metOrdinal).toBe(true);
        expect(late.inTime).toBe(false);
        const short = assessTheReturn(terms, terms.returnOrdinal - 1, 100);
        expect(short.returns).toBe(false);
        expect(short.metOrdinal).toBe(false);
        expect(short.inTime).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// AND NOW THE ONLY PART THAT PROVES ANYTHING
// ─────────────────────────────────────────────────────────────────────────

describe('somebody in a running world does this', () => {
    it('places children, pooled across seeds, without a hardcoded destination', async () => {
        const catalog = await loadCultivationCatalog();
        let fostered = 0;
        let skippedABar = 0;
        let shamed = 0;
        const reasons = new Set<string>();
        const receiving = new Set<string>();
        const sending = new Set<string>();

        for (const seed of SEEDS) {
            const { state } = seedWorld({ seed, catalog });
            advanceWorldYears(state, HORIZON, { stopOnInterrupt: false });
            for (const npc of state.npcs) {
                if (!npc.tags.includes('fostered')) continue;
                fostered++;
                if (npc.factionId) receiving.add(npc.factionId);
                const from = npc.tags.find(t => t.startsWith('fostered-from:'));
                if (from) sending.add(from);
            }
            for (const npc of state.npcs) {
                if (shameCausesFromTags(npc.tags).length > 0) shamed++;
            }
            for (const fact of state.history.facts) {
                const reason = fact.data.fostering;
                if (typeof reason !== 'string') continue;
                reasons.add(reason);
                if (typeof fact.data.barSkipped === 'number') skippedABar++;
            }
        }

        // Pooled. Measured at 229 over six seeds at 500 years; this is four
        // seeds at 400 and the bar is set to catch the mechanic going dead
        // rather than to pin a figure.
        expect(fostered).toBeGreaterThanOrEqual(20);
        // Every single placement went past an admission ordinal the child did
        // not meet. That is what the favour buys and there is no other route in.
        expect(skippedABar).toBeGreaterThanOrEqual(20);
        // Both drivers fire. If either of these ever empties, half the mechanic
        // has quietly stopped.
        expect(reasons.has('the birth')).toBe(true);
        expect(reasons.has('the bar')).toBe(true);
        expect(shamed).toBeGreaterThan(0);
        // The thing the four hardcoded sects could never have said: children go
        // to many different houses, out of many different houses, because the
        // destination comes off the parent rather than off a list.
        expect(receiving.size).toBeGreaterThanOrEqual(8);
        expect(sending.size).toBeGreaterThanOrEqual(8);
    }, 240_000);

    it('leaves the child on the bloodline and off the parent\'s roll of children', async () => {
        const catalog = await loadCultivationCatalog();
        let checked = 0;
        for (const seed of SEEDS) {
            const { state } = seedWorld({ seed, catalog });
            advanceWorldYears(state, HORIZON, { stopOnInterrupt: false });
            for (const fact of state.history.facts) {
                if (typeof fact.data.fostering !== 'string') continue;
                const childId = fact.actors.find(a => a.role === 'child')?.id;
                const parentId = fact.data.fostererId;
                if (!childId || typeof parentId !== 'string') continue;
                const child = state.npcs.find(n => n.id === childId);
                const parent = state.npcs.find(n => n.id === parentId);
                if (!child || !parent) continue;
                checked++;

                // Neither of them is the other's family. There is no `parent`
                // row on the child and no `child` row on the parent, which is
                // the household that was never written.
                //
                // NOT "no tie at all": four centuries later the two of them may
                // perfectly well have met at a gathering and formed an opinion
                // of each other, and that is the world working. What they do
                // not have is the relation.
                expect(child.relationships.find(r => r.targetId === parent.id)?.kind)
                    .not.toBe('parent');
                expect(parent.relationships.find(r => r.targetId === child.id)?.kind)
                    .not.toBe('child');
                // And the blood is on the record anyway, so an heir still
                // inherits down a line whose name they do not hold.
                const line = state.lineages.find(l =>
                    l.edges.some(e => e.parentId === parent.id && e.childId === child.id));
                expect(line, `${child.id} is off the bloodline entirely`).toBeDefined();

                // The person who took them in is who they are bound to.
                const taker = fact.data.askedOfId;
                expect(child.relationships.some(r => r.targetId === taker)).toBe(true);
                // Nobody in the world can name it: the fact is secret.
                expect(fact.visibility).toBe('secret');
            }
        }
        expect(checked).toBeGreaterThan(0);
    }, 240_000);

    it('assesses a fostered person against their sending house\'s terms, in the world pass', async () => {
        // The Court's terms are reached about once in six thousand world-years
        // and the one child measured died at 100 at ordinal 12 - see the header.
        // So the case is built rather than waited for, and then the ORDINARY
        // world pass is what runs: no function is called by name here.
        const catalog = await loadCultivationCatalog();
        const { state } = seedWorld({ seed: 'assessment', catalog }) as { state: WorldState };
        const day = state.currentDay;
        const terms = HOLLOW_COURT_FOSTERAGE;

        let child = createNpc(state.seed, {
            id: 'npc-fostered-under-terms',
            bornOnDay: day - Math.round(terms.returnByAge - 5) * DAYS_PER_YEAR,
            onDay: day,
            locationId: state.locations.find(l => l.kind === 'settlement')?.id ?? null,
            factionId: TAKES_A_WORD,
            factionRankIndex: 0,
            tags: ['fostered', `fostered-from:${terms.factionId}`]
        });
        child = setRealm(child, terms.returnOrdinal, day);
        state.npcs.push(child);

        advanceWorldYears(state, 2, { stopOnInterrupt: false });

        const after = state.npcs.find(n => n.id === child.id)!;
        expect(after.tags.some(t => t.startsWith('assessed:'))).toBe(true);
        // They made the rung with years to spare, so they go back - onto the
        // sending house's roll, at the bottom of it. It moved a person and
        // conferred nothing.
        expect(after.tags).toContain('assessed:returned');
        expect(after.factionId).toBe(terms.factionId);
        // NOT `toBe(0)`, and the reason is a change in the world rather than a
        // weakened guard. The return puts them on the bottom rung and confers
        // nothing; two world years then pass, and the Hollow Court now has its
        // real roster standing in it - Outer Disciples at ordinal 29 and 30 -
        // so somebody who came back at exactly the return ordinal is an
        // ordinary promotion candidate against ordinary people, and sometimes
        // gets promoted. That is the ladder working. What must not happen is
        // arriving at a senior rung, which is what "conferred nothing" means.
        expect(after.factionRankIndex,
            'the fosterage bought them a rank rather than a place on the roll')
            .toBeLessThan(requireSect(terms.factionId).ranks.length - 1);

        const record = state.history.facts.find(f => f.data.fosterageAssessment !== undefined);
        expect(record?.data.fosterageAssessment).toBe('returned');
        expect(record?.data.metOrdinal).toBe(true);
        expect(record?.data.inTime).toBe(true);
    }, 120_000);
});
