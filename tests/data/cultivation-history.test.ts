/**
 * The deep past: validation for `src/data/cultivation/history.ts`.
 *
 * The assertions that matter here are the ones that keep the past from
 * quietly becoming settled, and the ones that keep it consistent with the
 * present it is supposed to explain:
 *
 *   - qi falls monotonically across the ages and the present is the thinnest
 *   - the ages tile the chronology with no gaps and no overlap
 *   - most of the corpus is `reconstructed` or `unresolved`, and an
 *     `unresolved` claim carries competing answers while an `objective` one
 *     carries none
 *   - every party this file attributes a belief or a holding to actually
 *     exists in the faction catalogs, by id
 *   - the node figures cited for a surviving work match the sect catalog, so
 *     the explanation cannot drift from the compound it explains
 *   - exactly one origin account is refutable and it is the one most of the
 *     world holds
 *   - the Lid is not settled, the fate house and the fixity house disagree,
 *     and every theory has a problem it cannot answer
 *   - the two provincial calendars have different epochs and the offset has
 *     no verified value
 */

import { describe, it, expect } from 'vitest';

import {
    AGES,
    AgeSchema,
    AGE_FIDELITY,
    CALENDARS,
    CalendarSchema,
    ClaimSchema,
    DEAD_CIVILISATIONS,
    DEAD_SCRIPTS,
    DRIVEN_GROUND_AND_THE_NODE,
    DeadCivilisationSchema,
    DeadScriptSchema,
    LID_NON_POSITIONS,
    LID_THEORIES,
    LidTheorySchema,
    ORIGIN_ACCOUNTS,
    OriginAccountSchema,
    PRESENT_YEAR,
    SECT_ARCHIVE,
    THE_CALENDAR_OFFSET,
    THE_FIRST_CULTIVATORS,
    THE_LID,
    WHAT_THE_OFFSET_HIDES,
    WHY_THE_RECONCILIATION_IS_NOT_MADE,
    WHY_ACCOUNTS_DISAGREE,
    ageAtYearsAgo,
    allCitedFactionIds,
    getAge,
    getCalendar,
    getDeadCivilisation,
    getLidTheory,
    getOriginAccount,
    historyEras,
    lidTheoryOf,
    presentAge,
    theWrongOriginAccount,
    unresolvedQuestions,
    type Claim
} from '../../src/data/cultivation/history.js';
import { SECTS, DESTROYED_DAO_HOUSES, getSect } from '../../src/data/cultivation/sects.js';
import { APEX_INSTITUTIONS } from '../../src/data/cultivation/hierarchy.js';
import { REGIONS } from '../../src/data/cultivation/regions.js';

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

/** Every id this world will answer to as a faction. */
const KNOWN_FACTION_IDS = new Set<string>([
    ...SECTS.map(s => s.id),
    ...DESTROYED_DAO_HOUSES.map(h => h.id),
    ...APEX_INSTITUTIONS.map(a => a.id)
]);

/** Every claim in the file, wherever it is nested. */
function allClaims(): { where: string; claim: Claim }[] {
    const out: { where: string; claim: Claim }[] = [];
    for (const a of AGES) out.push({ where: `age ${a.id} howItEnded`, claim: a.howItEnded });
    for (const d of DEAD_CIVILISATIONS) out.push({ where: `dead ${d.id} theEnd`, claim: d.theEnd });
    for (const c of CALENDARS) out.push({ where: `calendar ${c.id} origin`, claim: c.isTheOriginCorrect });
    for (const [i, c] of WHY_ACCOUNTS_DISAGREE.entries()) out.push({ where: `disagreement ${i}`, claim: c });
    out.push({ where: 'THE_LID', claim: THE_LID });
    out.push({ where: 'THE_FIRST_CULTIVATORS', claim: THE_FIRST_CULTIVATORS });
    out.push({ where: 'THE_CALENDAR_OFFSET', claim: THE_CALENDAR_OFFSET });
    out.push({ where: 'DRIVEN_GROUND_AND_THE_NODE', claim: DRIVEN_GROUND_AND_THE_NODE });
    return out;
}

// ─────────────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────────────

describe('the history catalog satisfies its own schemas', () => {
    it('parses every age', () => {
        for (const age of AGES) expect(() => AgeSchema.parse(age), age.id).not.toThrow();
    });

    it('parses every dead civilisation', () => {
        for (const d of DEAD_CIVILISATIONS) expect(() => DeadCivilisationSchema.parse(d), d.id).not.toThrow();
    });

    it('parses every origin account, Lid theory, script and calendar', () => {
        for (const o of ORIGIN_ACCOUNTS) expect(() => OriginAccountSchema.parse(o), o.id).not.toThrow();
        for (const t of LID_THEORIES) expect(() => LidTheorySchema.parse(t), t.id).not.toThrow();
        for (const s of DEAD_SCRIPTS) expect(() => DeadScriptSchema.parse(s), s.id).not.toThrow();
        for (const c of CALENDARS) expect(() => CalendarSchema.parse(c), c.id).not.toThrow();
    });

    it('parses every claim wherever it is nested', () => {
        for (const { where, claim } of allClaims()) {
            expect(() => ClaimSchema.parse(claim), where).not.toThrow();
        }
    });

    it('has unique ids in every collection', () => {
        const unique = (ids: string[]) => expect(new Set(ids).size).toBe(ids.length);
        unique(AGES.map(a => a.id));
        unique(DEAD_CIVILISATIONS.map(d => d.id));
        unique(ORIGIN_ACCOUNTS.map(o => o.id));
        unique(LID_THEORIES.map(t => t.id));
        unique(DEAD_SCRIPTS.map(s => s.id));
        unique(CALENDARS.map(c => c.id));
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE AGES
// ─────────────────────────────────────────────────────────────────────────

describe('the ages', () => {
    it('runs at least four ages before the present', () => {
        expect(AGES.length).toBeGreaterThanOrEqual(4);
        expect(AGES.filter(a => a.endedYearsAgo !== null).length).toBeGreaterThanOrEqual(3);
    });

    it('has exactly one open age, and it is the last one', () => {
        const open = AGES.filter(a => a.endedYearsAgo === null);
        expect(open.length).toBe(1);
        expect(open[0].id).toBe(AGES[AGES.length - 1].id);
        expect(presentAge().id).toBe(open[0].id);
    });

    it('thins monotonically, and the present is the thinnest ground the world has carried', () => {
        for (let i = 1; i < AGES.length; i++) {
            expect(
                AGES[i].qiDensity,
                `${AGES[i].id} is not thinner than ${AGES[i - 1].id}; qi only ever falls`
            ).toBeLessThan(AGES[i - 1].qiDensity);
        }
        const present = presentAge();
        for (const age of AGES) {
            if (age.id === present.id) continue;
            expect(present.qiDensity).toBeLessThan(age.qiDensity);
        }
    });

    it('tiles the chronology with no gaps and no overlap', () => {
        for (let i = 1; i < AGES.length; i++) {
            expect(
                AGES[i].beganYearsAgo,
                `${AGES[i].id} does not begin where ${AGES[i - 1].id} ends`
            ).toBe(AGES[i - 1].endedYearsAgo);
        }
        // Ordered oldest first, and only the oldest may lack a beginning.
        expect(AGES[0].beganYearsAgo).toBeNull();
        for (const age of AGES.slice(1)) expect(age.beganYearsAgo).not.toBeNull();
    });

    it('says for every age whether its people knew they were declining', () => {
        for (const age of AGES) {
            expect(age.didTheyKnow.length, age.id).toBeGreaterThan(200);
            expect(age.whatItBuilt.length, age.id).toBeGreaterThan(200);
            expect(age.livingThere.length, age.id).toBeGreaterThan(200);
        }
    });

    it('lands the present age on the Low Fall calendar it counts in', () => {
        const present = presentAge();
        expect(present.beganYearsAgo).toBe(PRESENT_YEAR);
        const lowFall = CALENDARS.find(c => c.regionId === 'region-low-fall');
        expect(lowFall?.presentYear).toBe(PRESENT_YEAR);
    });

    it('resolves a point in time to the age containing it', () => {
        expect(ageAtYearsAgo(0)?.id).toBe(presentAge().id);
        expect(ageAtYearsAgo(1_000)?.id).toBe(presentAge().id);
        expect(ageAtYearsAgo(50_000)?.id).toBe(AGES[0].id);
        for (const age of AGES) {
            if (age.endedYearsAgo === null) continue;
            const inside = age.endedYearsAgo + 1;
            expect(ageAtYearsAgo(inside)?.id, `${inside} years ago should be in ${age.id}`).toBe(age.id);
        }
    });

    it('has a fidelity for every age, and the record gets worse with depth', () => {
        const order = { lost: 0, rumour: 1, partial: 2, full: 3 } as const;
        for (const age of AGES) expect(AGE_FIDELITY[age.id], age.id).toBeDefined();
        for (let i = 1; i < AGES.length; i++) {
            expect(order[AGE_FIDELITY[AGES[i].id]]).toBeGreaterThanOrEqual(order[AGE_FIDELITY[AGES[i - 1].id]]);
        }
    });

    it('builds engine era records that carry the same shape', () => {
        const eras = historyEras();
        expect(eras.length).toBe(AGES.length);
        for (let i = 0; i < eras.length; i++) {
            expect(eras[i].id).toBe(AGES[i].id);
            expect(eras[i].qiDensity).toBe(AGES[i].qiDensity);
            expect(eras[i].startDay).toBeLessThan(0);
            if (eras[i].endDay !== null) expect(eras[i].endDay!).toBeGreaterThan(eras[i].startDay);
        }
        // The open era is the present, and only it has a null end.
        expect(eras.filter(e => e.endDay === null).length).toBe(1);
        expect(eras[eras.length - 1].endDay).toBeNull();
        // The undateable beginning says so, so nobody quotes it as a date.
        expect(eras[0].note).toMatch(/not dateable/);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// TRUTH DISCIPLINE
// A past the database has settled is a past nobody can discover.
// ─────────────────────────────────────────────────────────────────────────

describe('the engine does not secretly know everything', () => {
    it('prefers reconstructed and unresolved over objective', () => {
        const claims = allClaims().map(c => c.claim);
        const objective = claims.filter(c => c.truth === 'objective').length;
        expect(
            objective / claims.length,
            'too much of the deep past is stated as objective fact'
        ).toBeLessThan(0.5);
    });

    it('leaves genuine gaps: several claims are unresolved', () => {
        expect(unresolvedQuestions().length).toBeGreaterThanOrEqual(5);
        for (const claim of unresolvedQuestions()) expect(claim.truth).toBe('unresolved');
    });

    it('gives an unresolved claim competing answers and no endorsement', () => {
        for (const { where, claim } of allClaims()) {
            if (claim.truth !== 'unresolved') continue;
            expect(claim.claimedOutcomes.length, `${where} is unresolved with no candidates`).toBeGreaterThanOrEqual(2);
        }
    });

    it('gives a resolved claim no candidate answers at all', () => {
        for (const { where, claim } of allClaims()) {
            if (claim.truth === 'unresolved') continue;
            expect(claim.claimedOutcomes, `${where} is settled and still lists candidates`).toEqual([]);
        }
    });

    it('never states a claim without evidence somebody holds', () => {
        for (const { where, claim } of allClaims()) {
            expect(claim.evidence.length, `${where} has no evidence`).toBeGreaterThanOrEqual(1);
            // Only a physically present, engine-known fact may have no knower.
            if (claim.heldBy.length === 0) {
                expect(claim.truth, `${where} has no knower and is not objective`).toBe('objective');
            }
        }
    });

    it('attributes every belief and holding to a faction that exists', () => {
        for (const id of allCitedFactionIds()) {
            expect(KNOWN_FACTION_IDS.has(id), `history.ts cites unknown faction ${id}`).toBe(true);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// DEAD CIVILISATIONS
// ─────────────────────────────────────────────────────────────────────────

describe('the dead civilisations', () => {
    it('has at least two established ones, distinct from the sects that came after', () => {
        const established = DEAD_CIVILISATIONS.filter(d => d.existence === 'established');
        expect(established.length).toBeGreaterThanOrEqual(2);
        for (const d of DEAD_CIVILISATIONS) {
            expect(KNOWN_FACTION_IDS.has(d.id), `${d.id} collides with a living faction id`).toBe(false);
        }
    });

    it('places each one in an age that exists', () => {
        for (const d of DEAD_CIVILISATIONS) {
            expect(getAge(d.ageId), `${d.id} sits in unknown age ${d.ageId}`).toBeDefined();
        }
    });

    it('cites node figures that match the sect catalog exactly', () => {
        let checked = 0;
        for (const d of DEAD_CIVILISATIONS) {
            for (const work of d.survivingWorks) {
                if (!work.nodes || !work.heldByFactionId) continue;
                const sect = getSect(work.heldByFactionId);
                expect(sect, `${d.id} cites unknown holder ${work.heldByFactionId}`).toBeDefined();
                expect(
                    { total: sect!.compound.formationNodesTotal, lit: sect!.compound.formationNodesLit },
                    `${d.id} cites node figures that do not match ${work.heldByFactionId}`
                ).toEqual(work.nodes);
                checked++;
            }
        }
        // The tie to the present is the point; a version of this file that
        // cited nothing would pass the loop above vacuously.
        expect(checked, 'no surviving work is tied to a real compound').toBeGreaterThanOrEqual(4);
    });

    it('explains why each work cannot be replaced rather than saying it is lost', () => {
        for (const d of DEAD_CIVILISATIONS) {
            for (const work of d.survivingWorks) {
                expect(work.whyItCannotBeReplaced.length, `${d.id}: ${work.what}`).toBeGreaterThan(80);
            }
            expect(d.howItIsDiscoverable.length, d.id).toBeGreaterThanOrEqual(3);
        }
    });

    it('keeps the disputed one disputed', () => {
        const disputed = DEAD_CIVILISATIONS.filter(d => d.existence === 'disputed');
        expect(disputed.length).toBeGreaterThanOrEqual(1);
        for (const d of disputed) expect(d.theEnd.truth).toBe('unresolved');
    });

    it('is reachable by id', () => {
        for (const d of DEAD_CIVILISATIONS) expect(getDeadCivilisation(d.id)?.name).toBe(d.name);
        expect(getDeadCivilisation('no-such-civilisation')).toBeUndefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────
// WHERE CULTIVATION CAME FROM
// ─────────────────────────────────────────────────────────────────────────

describe('the origin of cultivation', () => {
    it('offers competing accounts rather than an answer', () => {
        expect(ORIGIN_ACCOUNTS.length).toBeGreaterThanOrEqual(3);
        const holders = new Set(ORIGIN_ACCOUNTS.flatMap(o => o.heldBy));
        expect(holders.size, 'accounts should be spread across institutions').toBeGreaterThanOrEqual(6);
    });

    it('gives every account evidence and a problem it cannot answer', () => {
        for (const o of ORIGIN_ACCOUNTS) {
            expect(o.evidence.length, o.id).toBeGreaterThanOrEqual(2);
            expect(o.theProblem.length, o.id).toBeGreaterThan(150);
            expect(o.whyTheRealmsHaveTheirShape.length, o.id).toBeGreaterThan(150);
        }
    });

    it('has exactly one demonstrably wrong account, and it is the one most of the world holds', () => {
        const wrong = ORIGIN_ACCOUNTS.filter(o => o.demonstrablyWrong !== null);
        expect(wrong.length).toBe(1);
        expect(wrong[0].currency).toBe('most_of_the_world');
        expect(theWrongOriginAccount()?.id).toBe(wrong[0].id);
        // Refutable in principle, and the parties who could do it are named.
        expect(wrong[0].demonstrablyWrong!.whoCouldDemonstrateIt.length).toBeGreaterThanOrEqual(1);
        for (const id of wrong[0].demonstrablyWrong!.whoCouldDemonstrateIt) {
            expect(KNOWN_FACTION_IDS.has(id), `unknown party ${id}`).toBe(true);
        }
        // And there is a stated reason the demonstration has never landed.
        expect(wrong[0].demonstrablyWrong!.whyItIsStillHeld.length).toBeGreaterThan(150);
    });

    it('leaves the first cultivators unresolved', () => {
        expect(THE_FIRST_CULTIVATORS.truth).toBe('unresolved');
        expect(THE_FIRST_CULTIVATORS.claimedOutcomes.length).toBeGreaterThanOrEqual(3);
    });

    it('is reachable by id', () => {
        for (const o of ORIGIN_ACCOUNTS) expect(getOriginAccount(o.id)?.name).toBe(o.name);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE LID
// ─────────────────────────────────────────────────────────────────────────

describe('the Lid', () => {
    it('is not settled, and the engine says so', () => {
        expect(THE_LID.truth).toBe('unresolved');
        expect(THE_LID.claimedOutcomes.length).toBeGreaterThanOrEqual(3);
    });

    it('carries at least three incompatible theories held by serious institutions', () => {
        expect(LID_THEORIES.length).toBeGreaterThanOrEqual(3);
        const holders = LID_THEORIES.map(t => t.heldBy);
        expect(new Set(holders).size, 'two theories share a holder').toBe(holders.length);
        for (const id of holders) expect(KNOWN_FACTION_IDS.has(id), `unknown holder ${id}`).toBe(true);
    });

    it('gives every theory real evidence and a problem it cannot answer', () => {
        for (const t of LID_THEORIES) {
            expect(t.evidence.length, t.id).toBeGreaterThanOrEqual(3);
            expect(t.cannotAnswer.length, t.id).toBeGreaterThan(200);
            expect(t.theirAnswerToThat.length, t.id).toBeGreaterThan(150);
            expect(t.ifItIsTrue.length, t.id).toBeGreaterThan(120);
        }
    });

    it('has the houses disagreeing along their own principles', () => {
        const principles = LID_THEORIES.map(t => t.throughWhichPrinciple);
        expect(new Set(principles).size, 'two houses reason through the same principle').toBe(principles.length);
        // The fate house and the fixity house reach different conclusions.
        const fate = LID_THEORIES.find(t => t.throughWhichPrinciple === 'fate');
        const fixity = LID_THEORIES.find(t => t.throughWhichPrinciple === 'fixity');
        expect(fate, 'no fate-house reading of the Lid').toBeDefined();
        expect(fixity, 'no fixity-house reading of the Lid').toBeDefined();
        expect(fate!.theory).not.toBe(fixity!.theory);
        expect(fate!.heldBy).not.toBe(fixity!.heldBy);
    });

    it('records the bodies that hold no theory', () => {
        expect(LID_NON_POSITIONS.length).toBeGreaterThanOrEqual(2);
        for (const n of LID_NON_POSITIONS) {
            expect(KNOWN_FACTION_IDS.has(n.factionId), `unknown body ${n.factionId}`).toBe(true);
            expect(lidTheoryOf(n.factionId), `${n.factionId} both holds and refuses a theory`).toBeUndefined();
        }
    });

    it('answers which theory a house holds', () => {
        for (const t of LID_THEORIES) {
            expect(lidTheoryOf(t.heldBy)?.id).toBe(t.id);
            expect(getLidTheory(t.id)?.heldBy).toBe(t.heldBy);
        }
        expect(lidTheoryOf('sect-hollow-bell-wanderers')).toBeUndefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────
// TRANSMISSION
// ─────────────────────────────────────────────────────────────────────────

describe('how history is transmitted and lost', () => {
    it('has dead scripts tied to ages, with named readers', () => {
        expect(DEAD_SCRIPTS.length).toBeGreaterThanOrEqual(3);
        for (const s of DEAD_SCRIPTS) {
            expect(getAge(s.ageId), `${s.id} sits in unknown age ${s.ageId}`).toBeDefined();
            for (const id of s.readBy) expect(KNOWN_FACTION_IDS.has(id), `${s.id} unknown reader ${id}`).toBe(true);
            expect(s.whatIsWrittenInIt.length, s.id).toBeGreaterThanOrEqual(2);
        }
    });

    it('says what a sect archive actually holds, and what it does not', () => {
        expect(SECT_ARCHIVE.whatIsActuallyInIt.length).toBeGreaterThanOrEqual(4);
        expect(SECT_ARCHIVE.whatIsNotInIt.length).toBeGreaterThanOrEqual(3);
        expect(SECT_ARCHIVE.theRecopyingProblem.length).toBeGreaterThan(200);
        expect(SECT_ARCHIVE.whoCannotReadIt.length).toBeGreaterThan(150);
    });

    it('gives several independent reasons two honest records disagree', () => {
        expect(WHY_ACCOUNTS_DISAGREE.length).toBeGreaterThanOrEqual(4);
        for (const claim of WHY_ACCOUNTS_DISAGREE) {
            expect(claim.evidence.length).toBeGreaterThanOrEqual(2);
            expect(claim.heldBy.length).toBeGreaterThanOrEqual(1);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE TWO TRADITIONS
// The past has to explain the present, and the present includes a tension the
// catalogs already carry: the Cut Road is nine hundred years old and the Long
// Cut's ancestor crossed from driven ground twenty-six hundred years ago.
// ─────────────────────────────────────────────────────────────────────────

describe('the two traditions follow from the deep past', () => {
    it('reconciles driven ground with the node, without settling it', () => {
        expect(DRIVEN_GROUND_AND_THE_NODE.truth).toBe('reconstructed');
        expect(DRIVEN_GROUND_AND_THE_NODE.claimedOutcomes).toEqual([]);
        expect(DRIVEN_GROUND_AND_THE_NODE.evidence.length).toBeGreaterThanOrEqual(3);
        // Held by exactly the kind of party that would work it out and sit on it.
        expect(DRIVEN_GROUND_AND_THE_NODE.heldBy.length).toBeGreaterThanOrEqual(1);
        for (const id of DRIVEN_GROUND_AND_THE_NODE.heldBy) {
            expect(KNOWN_FACTION_IDS.has(id), `unknown holder ${id}`).toBe(true);
        }
    });

    it('says why nobody says it out loud, from more than one side', () => {
        expect(WHY_THE_RECONCILIATION_IS_NOT_MADE.length).toBeGreaterThanOrEqual(3);
        for (const line of WHY_THE_RECONCILIATION_IS_NOT_MADE) {
            expect(line.length).toBeGreaterThan(150);
        }
    });

    it('grounds the claim in a work that ties back to a real compound', () => {
        const works = DEAD_CIVILISATIONS.flatMap(d => d.survivingWorks);
        const weir = works.find(w => w.heldByFactionId === 'sect-weir-office');
        expect(weir, 'the weir works are the site where both traditions meet').toBeDefined();
        expect(weir!.nodes).not.toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────
// CALENDARS
// ─────────────────────────────────────────────────────────────────────────

describe('calendars and eras', () => {
    it('gives each region its own reckoning, and the two do not agree', () => {
        const territorial = CALENDARS.filter(c => c.regionId !== null);
        expect(territorial.length).toBeGreaterThanOrEqual(2);
        for (const c of territorial) {
            expect(REGIONS.some(r => r.id === c.regionId), `unknown region ${c.regionId}`).toBe(true);
        }
        const years = territorial.map(c => c.presentYear);
        expect(new Set(years).size, 'the provinces agree on the year, which they must not').toBe(years.length);
    });

    it('attributes every reckoning to somebody who keeps it', () => {
        for (const c of CALENDARS) {
            expect(c.keptBy.length, c.id).toBeGreaterThanOrEqual(1);
            for (const id of c.keptBy) expect(KNOWN_FACTION_IDS.has(id), `${c.id} unknown keeper ${id}`).toBe(true);
        }
    });

    it('leaves at least one epoch in doubt, including the one the world counts from', () => {
        const doubtful = CALENDARS.filter(c => c.isTheOriginCorrect.truth === 'unresolved');
        expect(doubtful.length).toBeGreaterThanOrEqual(1);
        const lowFall = CALENDARS.find(c => c.regionId === 'region-low-fall');
        expect(lowFall?.isTheOriginCorrect.truth).toBe('unresolved');
    });

    it('leaves the offset unverifiable and gives it competing values', () => {
        expect(THE_CALENDAR_OFFSET.truth).toBe('unresolved');
        expect(THE_CALENDAR_OFFSET.claimedOutcomes.length).toBeGreaterThanOrEqual(3);
        expect(THE_CALENDAR_OFFSET.heldBy.length).toBeGreaterThanOrEqual(3);
    });

    it('makes the offset load-bearing rather than decorative', () => {
        expect(WHAT_THE_OFFSET_HIDES.length).toBeGreaterThanOrEqual(2);
        for (const line of WHAT_THE_OFFSET_HIDES) expect(line.length).toBeGreaterThan(120);
    });

    it('is reachable by id', () => {
        for (const c of CALENDARS) expect(getCalendar(c.id)?.name).toBe(c.name);
        expect(getCalendar('calendar-that-does-not-exist')).toBeUndefined();
    });
});
