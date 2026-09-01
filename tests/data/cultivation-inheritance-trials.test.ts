/**
 * Validation for inheritance trials and graves.
 *
 * The load-bearing assertions, in the order they matter:
 *   - the interior is NOT reachable through the outside-view accessor, by type
 *     and by content, for every entry in the catalog
 *   - the three gate kinds are genuinely different in kind: a strength gate
 *     carries an ordinal and refuses workarounds, a talent gate cannot measure
 *     luck, and a fate gate cannot hold a character stat at all
 *   - what a grave holds is decided by how the occupant died, and the two
 *     profiles do not overlap: tribulation graves are short and every item is
 *     proven, intact ones are long and nothing in them has been tested
 *   - everything references the catalogs that already exist rather than a
 *     parallel set of invented dead people
 */

import { describe, it, expect } from 'vitest';

import {
    MAX_ORDINAL,
    REALM_TIERS,
    rankName
} from '../../src/engine/cultivation/realms.js';
import { SPIRIT_ROOTS } from '../../src/engine/cultivation/spirit-roots.js';
import { getSect, getDestroyedDaoHouse } from '../../src/data/cultivation/sects.js';
import { getApexInstitution, getCourt } from '../../src/data/cultivation/hierarchy.js';
import { getTechnique, GRAVE_ONLY_TECHNIQUE_IDS } from '../../src/data/cultivation/techniques.js';
import { getImmortalItem } from '../../src/data/cultivation/immortal-items.js';
import { HELD_INSTRUMENTS, UNOWNED_ANCESTORS } from '../../src/data/cultivation/sealed-ancestors.js';
import {
    INHERITANCE_TRIALS,
    GRAVES,
    SITES,
    SiteSchema,
    InheritanceTrialSchema,
    GraveSchema,
    GateKindSchema,
    SpiritRootGradeSchema,
    MannerOfDeathSchema,
    GRAVE_CONTENTS_BANDS,
    THE_THREE_GATES,
    FATE_IS_NOT_A_STAT,
    WHAT_THE_LIGHTNING_TOOK,
    A_RESTING_PLACE_IS_NOT_A_GRAVE,
    outsideViewOf,
    enterSite,
    getSite,
    requireSite,
    getTrial,
    getGrave,
    sitesWithGateKind,
    trialsGuarding,
    gravesHolding,
    gravesByMannerOfDeath,
    tribulationTouched,
    contentsBandFor,
    provenContents,
    describeOutside,
    type Gate,
    type Site
} from '../../src/data/cultivation/inheritance-trials.js';

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

/** Faction ids may name a living sect, a Dao house, a destroyed house, a court or an apex. */
function factionResolves(id: string): boolean {
    return Boolean(
        getSect(id) ?? getDestroyedDaoHouse(id) ?? getCourt(id) ?? getApexInstitution(id)
    );
}

/** Every string held anywhere inside a site's interior, flattened. */
function interiorStrings(site: Site): string[] {
    const out: string[] = [];
    const walk = (v: unknown): void => {
        if (typeof v === 'string') { out.push(v); return; }
        if (Array.isArray(v)) { v.forEach(walk); return; }
        if (v && typeof v === 'object') { Object.values(v).forEach(walk); }
    };
    walk(site.interior);
    return out.filter(s => s.length > 40);
}

const CORPUS = JSON.stringify(SITES);

// ─────────────────────────────────────────────────────────────────────────
// THE CATALOG
// ─────────────────────────────────────────────────────────────────────────

describe('the catalog', () => {
    it('parses, and every id is unique across trials and graves together', () => {
        expect(INHERITANCE_TRIALS.length).toBeGreaterThanOrEqual(8);
        expect(GRAVES.length).toBeGreaterThanOrEqual(6);
        expect(SITES.length).toBe(INHERITANCE_TRIALS.length + GRAVES.length);

        for (const t of INHERITANCE_TRIALS) {
            expect(() => InheritanceTrialSchema.parse(t), t.id).not.toThrow();
        }
        for (const g of GRAVES) {
            expect(() => GraveSchema.parse(g), g.id).not.toThrow();
        }
        for (const s of SITES) {
            expect(() => SiteSchema.parse(s), s.id).not.toThrow();
        }

        const ids = SITES.map(s => s.id);
        expect(new Set(ids).size, 'duplicate site id').toBe(ids.length);
        // The prefixes are load-bearing for the discriminant being legible.
        for (const t of INHERITANCE_TRIALS) expect(t.id.startsWith('trial-'), t.id).toBe(true);
        for (const g of GRAVES) expect(g.id.startsWith('grave-'), g.id).toBe(true);
    });

    it('resolves by id, by kind, and refuses an unknown one loudly', () => {
        for (const s of SITES) {
            expect(getSite(s.id), s.id).toBeDefined();
            expect(requireSite(s.id).id).toBe(s.id);
        }
        expect(getTrial(INHERITANCE_TRIALS[0]!.id)).toBeDefined();
        expect(getTrial(GRAVES[0]!.id), 'a grave is not a trial').toBeUndefined();
        expect(getGrave(GRAVES[0]!.id)).toBeDefined();
        expect(getGrave(INHERITANCE_TRIALS[0]!.id), 'a trial is not a grave').toBeUndefined();
        expect(getSite('trial-does-not-exist')).toBeUndefined();
        expect(() => requireSite('trial-does-not-exist')).toThrow(/Unknown inheritance site/);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE INTERIOR IS GATED
// The reason this file exists in the shape it does.
// ─────────────────────────────────────────────────────────────────────────

describe('the interior is not reachable from outside', () => {
    it('never returns an interior key through the outside accessor', () => {
        for (const s of SITES) {
            const view = outsideViewOf(s.id)!;
            expect(view, s.id).toBeDefined();
            expect(Object.keys(view), `${s.id} leaked a key`).not.toContain('interior');
            expect(Object.keys(view)).not.toContain('gates');
            expect(Object.keys(view)).not.toContain('contents');
            expect(Object.keys(view)).not.toContain('prize');
        }
    });

    it('leaks no interior text through the outside accessor, for any entry', () => {
        for (const s of SITES) {
            const serialised = JSON.stringify(outsideViewOf(s.id));
            for (const secret of interiorStrings(s)) {
                expect(
                    serialised.includes(secret),
                    `${s.id} leaked interior text through outsideViewOf`
                ).toBe(false);
            }
        }
    });

    it('hands the whole entry back only through enterSite, which is the deliberate call', () => {
        for (const s of SITES) {
            const full = enterSite(s.id)!;
            expect(full.interior, s.id).toBeDefined();
            // And the interior genuinely carries the part the outside does not.
            expect(interiorStrings(s).length, `${s.id} has an empty interior`).toBeGreaterThan(2);
        }
        expect(enterSite('grave-does-not-exist')).toBeUndefined();
    });

    it('withholds the name, the attribution and the rumour below `named`', () => {
        for (const s of SITES) {
            const unaware = outsideViewOf(s.id, 'unaware')!;
            expect(unaware.name, `${s.id} named an unaware cultivator`).toBeNull();
            expect(unaware.outside.attributedTo).toBeNull();
            expect(unaware.outside.rumour).toBe('');
            // A marker is a physical object in a place and survives at every awareness.
            expect(unaware.outside.marker.length).toBeGreaterThan(80);
            // And where the site is attributed at all, `named` gets it back.
            const named = outsideViewOf(s.id, 'named')!;
            expect(named.name).toBe(s.name);
            expect(named.outside.attributedTo).toBe(s.outside.attributedTo);
        }
    });

    it('keeps the occupant name out of every marker, which is what makes withholding possible', () => {
        for (const s of SITES) {
            const attributed = s.outside.attributedTo;
            if (!attributed) continue;
            expect(
                s.outside.marker.includes(attributed),
                `${s.id} put its attribution in the marker, so it cannot be withheld`
            ).toBe(false);
        }
    });

    it('gives every entry both readings of the outside, and they are different', () => {
        for (const s of SITES) {
            expect(s.outside.whatAKnowledgeablePartyReads.length).toBeGreaterThan(120);
            expect(s.outside.whatAnIgnorantPartyConcludes.length).toBeGreaterThan(120);
            expect(s.outside.whatAKnowledgeablePartyReads)
                .not.toBe(s.outside.whatAnIgnorantPartyConcludes);
        }
    });

    it('describes the outside with the manner of death first for a grave', () => {
        const line = describeOutside(outsideViewOf('grave-yun-baiheng')!);
        expect(line).toMatch(/failed crossing/);
        expect(line).toMatch(/90 years ago/);
        // And a trial has no manner of death to lead with.
        expect(describeOutside(outsideViewOf('trial-the-eighth-stone')!)).not.toMatch(/Died:/);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE THREE GATES
// ─────────────────────────────────────────────────────────────────────────

describe('the three gates', () => {
    it('offers exactly three, and states why three rather than three numbers', () => {
        expect(GateKindSchema.options).toEqual(['strength', 'age_and_talent', 'fate']);
        expect(THE_THREE_GATES.principle).toMatch(/not three settings of one dial/i);
        expect(THE_THREE_GATES.whatEachRefuses.length).toBe(3);
        const refusals = THE_THREE_GATES.whatEachRefuses.join(' ');
        expect(refusals).toMatch(/strength: refuses cleverness/i);
        expect(refusals).toMatch(/age_and_talent: refuses power/i);
        expect(refusals).toMatch(/fate: refuses preparation/i);
    });

    it('covers all three kinds in the trials and all three again in the graves', () => {
        for (const kind of GateKindSchema.options) {
            expect(
                INHERITANCE_TRIALS.some(t => t.interior.gates.some(g => g.kind === kind)),
                `no trial carries a ${kind} gate`
            ).toBe(true);
            expect(
                GRAVES.some(g => g.interior.gates.some(x => x.kind === kind)),
                `no grave carries a ${kind} gate`
            ).toBe(true);
            expect(sitesWithGateKind(kind).length).toBeGreaterThanOrEqual(2);
        }
        // And the spread is deliberate rather than incidental.
        for (const kind of GateKindSchema.options) {
            const trials = INHERITANCE_TRIALS.filter(t => t.interior.gates.some(g => g.kind === kind));
            expect(trials.length, `${kind} is under-represented in the trials`).toBeGreaterThanOrEqual(3);
        }
    });

    it('gives every trial at least one gate, and lets an ordinary grave have none', () => {
        for (const t of INHERITANCE_TRIALS) {
            expect(t.interior.gates.length, `${t.id} has no gate`).toBeGreaterThanOrEqual(1);
        }
        const ungated = GRAVES.filter(g => g.interior.gates.length === 0);
        expect(ungated.length, 'an unguarded grave is the ordinary case and must exist')
            .toBeGreaterThanOrEqual(1);
        for (const g of ungated) expect(g.interior.gateOrigin).toBe('none');
        // A grave gate was placed by somebody, grew on the site, or is a fact
        // about the situation rather than about the ground. It is never `none`.
        for (const g of GRAVES.filter(x => x.interior.gates.length > 0)) {
            expect(['placed', 'accreted', 'circumstance'], g.id).toContain(g.interior.gateOrigin);
        }
        // Only a fate gate is allowed to be pure circumstance.
        for (const g of GRAVES.filter(x => x.interior.gateOrigin === 'circumstance')) {
            expect(g.interior.gates.every(x => x.kind === 'fate'), g.id).toBe(true);
        }
    });

    it('expresses a strength gate as an ordinal plus a stated physical test', () => {
        const strength = SITES.flatMap(s => s.interior.gates).filter(g => g.kind === 'strength');
        expect(strength.length).toBeGreaterThanOrEqual(4);
        for (const g of strength) {
            if (g.kind !== 'strength') continue;
            expect(g.ordinal).toBeGreaterThanOrEqual(0);
            expect(g.ordinal).toBeLessThanOrEqual(MAX_ORDINAL);
            expect(g.test.length).toBeGreaterThan(100);
            expect(g.below.length).toBeGreaterThan(100);
            // Cleverness is not a route, and every one of them says so.
            expect(g.noWorkaround.length).toBeGreaterThan(80);
        }
    });

    it('never lets an age-and-talent gate measure luck', () => {
        const talent = SITES.flatMap(s => s.interior.gates).filter(g => g.kind === 'age_and_talent');
        expect(talent.length).toBeGreaterThanOrEqual(4);
        for (const g of talent) {
            if (g.kind !== 'age_and_talent') continue;
            expect(g.requires.length).toBeGreaterThanOrEqual(1);
            expect(g.strengthDoesNotHelp.length).toBeGreaterThan(100);
            for (const r of g.requires) {
                expect(r.note.length).toBeGreaterThan(40);
                if (r.measure === 'attribute') {
                    expect(r.attribute, 'a talent gate must not read fortune').not.toBe('fortune');
                }
            }
        }
        // Enforced by the schema rather than by discipline: the union of the
        // measures never contains a luck term anywhere in the corpus.
        expect(CORPUS).not.toMatch(/"attribute":"fortune"/);
    });

    it('measures things the run accumulated or was dealt, across the whole set', () => {
        const measures = new Set<string>();
        for (const s of SITES) {
            for (const g of s.interior.gates) {
                if (g.kind !== 'age_and_talent') continue;
                for (const r of g.requires) measures.add(r.measure);
            }
        }
        // Years, roots, foundation and comprehension all have to be doing work.
        expect(measures).toContain('years_cultivated');
        expect(measures).toContain('foundation_quality');
        expect(measures).toContain('insight');
        expect(measures).toContain('attribute');
        expect(measures.has('spirit_root') || measures.has('spirit_root_grade')).toBe(true);
    });

    it('refuses to put a character stat behind a fate gate at all', () => {
        const fate = SITES.flatMap(s => s.interior.gates).filter(g => g.kind === 'fate');
        expect(fate.length).toBeGreaterThanOrEqual(4);
        for (const g of fate) {
            if (g.kind !== 'fate') continue;
            expect(g.characterStat, 'a fate gate holds no stat').toBeNull();
            expect(g.worldStateCheck.length).toBeGreaterThan(100);
            // The unfarmability argument is made in the specific, not the abstract.
            expect(g.whyItCannotBeFarmed.length).toBeGreaterThan(150);
            expect(g.whoHasEverPassed.length).toBeGreaterThan(80);
        }
        expect(FATE_IS_NOT_A_STAT.rule).toMatch(/reads world state, never the character sheet/i);
        expect(FATE_IS_NOT_A_STAT.theFarmingTest).toMatch(/could a patient player produce it on purpose/i);
        expect(FATE_IS_NOT_A_STAT.andMostPeopleNeverPass).toMatch(/not content the player is expected to clear/i);
    });

    it('keeps every fate condition off the sheet, in its own words', () => {
        for (const s of SITES) {
            for (const g of s.interior.gates) {
                if (g.kind !== 'fate') continue;
                // No fate condition may be phrased as a threshold on a number.
                expect(g.worldStateCheck, `${s.id} phrased fate as a roll`)
                    .not.toMatch(/\bfortune\b|\bluck\b|\broll\b|at least \d/i);
            }
        }
    });

    it('stacks gates on at least one entry, in the order they are met', () => {
        const stacked = SITES.filter(s => s.interior.gates.length > 1);
        expect(stacked.length, 'nothing in the catalog carries two gates').toBeGreaterThanOrEqual(1);
        expect(THE_THREE_GATES.andTheyStack).toMatch(/more than one/i);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE LIGHTNING TOOK
// ─────────────────────────────────────────────────────────────────────────

describe('what a grave holds is decided by how the occupant died', () => {
    it('states the rule and the inversion once', () => {
        expect(WHAT_THE_LIGHTNING_TOOK.rule).toMatch(/short list/i);
        expect(WHAT_THE_LIGHTNING_TOOK.rule).toMatch(/full inventory that nothing has ever tested/i);
        expect(WHAT_THE_LIGHTNING_TOOK.theInversion).toMatch(/rich crypt is usually the weaker one/i);
        expect(WHAT_THE_LIGHTNING_TOOK.whoKnowsThis).toMatch(/grave-readers/i);
        expect(WHAT_THE_LIGHTNING_TOOK.whoKnowsThis).toMatch(/raiding parties do not/i);
        expect(WHAT_THE_LIGHTNING_TOOK.andAFailedCrossingLeavesNoBody).toMatch(/does not leave remains/i);
    });

    it('keeps the two bands from overlapping, so the profiles are separable', () => {
        const { tribulation, intact } = GRAVE_CONTENTS_BANDS;
        expect(tribulation.maxItems).toBeLessThan(intact.minItems);
        expect(tribulation.allProven).toBe(true);
        expect(intact.allProven).toBe(false);
    });

    it('selects the band by manner of death and by nothing else', () => {
        for (const m of MannerOfDeathSchema.options) {
            const expected = m === 'heavenly_tribulation' || m === 'failed_crossing';
            expect(tribulationTouched(m), m).toBe(expected);
            expect(contentsBandFor(m)).toBe(
                expected ? GRAVE_CONTENTS_BANDS.tribulation : GRAVE_CONTENTS_BANDS.intact
            );
        }
    });

    it('holds a short, wholly proven inventory in every tribulation grave', () => {
        const touched = GRAVES.filter(g => tribulationTouched(g.mannerOfDeath));
        expect(touched.length, 'the rule needs instances').toBeGreaterThanOrEqual(2);
        for (const g of touched) {
            const band = GRAVE_CONTENTS_BANDS.tribulation;
            expect(g.interior.contents.length, `${g.id} is too long for a tribulation grave`)
                .toBeGreaterThanOrEqual(band.minItems);
            expect(g.interior.contents.length, `${g.id} is too long for a tribulation grave`)
                .toBeLessThanOrEqual(band.maxItems);
            for (const c of g.interior.contents) {
                expect(c.proven, `${g.id}: ${c.what} is not proven`).toBe(true);
                expect(c.survived, `${g.id}: proven with nothing survived`).not.toBeNull();
            }
            expect(provenContents(g).length).toBe(g.interior.contents.length);
        }
    });

    it('holds a long, wholly untested inventory in every other grave', () => {
        const intact = GRAVES.filter(g => !tribulationTouched(g.mannerOfDeath));
        expect(intact.length).toBeGreaterThanOrEqual(4);
        for (const g of intact) {
            const band = GRAVE_CONTENTS_BANDS.intact;
            expect(g.interior.contents.length, `${g.id} is too short for an intact burial`)
                .toBeGreaterThanOrEqual(band.minItems);
            expect(g.interior.contents.length).toBeLessThanOrEqual(band.maxItems);
            for (const c of g.interior.contents) {
                expect(c.proven, `${g.id}: ${c.what} claims a warranty it cannot have`).toBe(false);
                expect(c.survived, `${g.id}: untested item claims to have survived something`).toBeNull();
            }
            expect(provenContents(g).length).toBe(0);
        }
    });

    it('keeps the inverse relationship true of the catalog as a whole', () => {
        const touched = GRAVES.filter(g => tribulationTouched(g.mannerOfDeath));
        const intact = GRAVES.filter(g => !tribulationTouched(g.mannerOfDeath));
        const longestTouched = Math.max(...touched.map(g => g.interior.contents.length));
        const shortestIntact = Math.min(...intact.map(g => g.interior.contents.length));
        expect(longestTouched, 'the rich crypt must be the longer list').toBeLessThan(shortestIntact);
        // And the warranty runs the other way entirely.
        expect(touched.every(g => provenContents(g).length > 0)).toBe(true);
        expect(intact.every(g => provenContents(g).length === 0)).toBe(true);
    });

    it('never lets `proven` and `survived` disagree anywhere', () => {
        for (const g of GRAVES) {
            for (const c of g.interior.contents) {
                expect(c.proven, `${g.id}: ${c.what}`).toBe(c.survived !== null);
            }
        }
    });

    it('carries the manner of death on the outside, where a reader can use it', () => {
        for (const g of GRAVES) {
            const view = outsideViewOf(g.id)!;
            expect(view.kind).toBe('grave');
            if (view.kind !== 'grave') return;
            expect(view.mannerOfDeath).toBe(g.mannerOfDeath);
            expect(view.burial).toBe(g.burial);
            // And it survives even when the occupant cannot be named.
            const unaware = outsideViewOf(g.id, 'unaware')!;
            if (unaware.kind !== 'grave') return;
            expect(unaware.mannerOfDeath).toBe(g.mannerOfDeath);
        }
    });

    it('holds the matched pair the world already contains', () => {
        // Died of old age at the top of the ladder without attempting the crossing.
        const shen = getGrave('grave-shen-guyi')!;
        expect(shen.occupantOrdinal).toBe(44);
        expect(shen.mannerOfDeath).toBe('old_age');
        expect(shen.factionIds).toContain('court-third-sill');
        expect(shen.interior.contents.length).toBeGreaterThanOrEqual(GRAVE_CONTENTS_BANDS.intact.minItems);

        // Attempted it and was struck down. No body, and the scar is the site.
        const yun = getGrave('grave-yun-baiheng')!;
        expect(yun.occupantOrdinal).toBe(44);
        expect(yun.mannerOfDeath).toBe('failed_crossing');
        expect(yun.burial).toBe('scar_field');
        expect(yun.factionIds).toContain('court-ninth-face');
        expect(yun.interior.contents.length).toBeLessThanOrEqual(GRAVE_CONTENTS_BANDS.tribulation.maxItems);
        // A failed crossing leaves no body, and the entry says so rather than
        // quietly contradicting `hierarchy.ts`.
        expect(`${yun.interior.scene} ${yun.interior.whatTheDeathDidToTheContents}`)
            .toMatch(/does not leave a body|no body/i);

        // And the contrast is the whole point: the poorer list is the better one.
        expect(yun.interior.contents.length).toBeLessThan(shen.interior.contents.length);
        expect(provenContents(yun).length).toBeGreaterThan(provenContents(shen).length);
    });

    it('finds graves by manner of death', () => {
        expect(gravesByMannerOfDeath('failed_crossing').map(g => g.id)).toContain('grave-yun-baiheng');
        expect(gravesByMannerOfDeath('old_age').map(g => g.id)).toContain('grave-shen-guyi');
        expect(gravesByMannerOfDeath('duel').length).toBeGreaterThanOrEqual(1);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// A RESTING PLACE IS NOT A GRAVE
// ─────────────────────────────────────────────────────────────────────────

describe('a resting place is not a grave', () => {
    it('states the separation and keeps three categories apart', () => {
        expect(A_RESTING_PLACE_IS_NOT_A_GRAVE.rule).toMatch(/holds a live person/i);
        expect(A_RESTING_PLACE_IS_NOT_A_GRAVE.theThreeCategories.length).toBe(3);
        const cats = A_RESTING_PLACE_IS_NOT_A_GRAVE.theThreeCategories.join(' ');
        expect(cats).toMatch(/trial:/);
        expect(cats).toMatch(/grave:/);
        expect(cats).toMatch(/resting place:/);
        expect(A_RESTING_PLACE_IS_NOT_A_GRAVE.howToTell).toMatch(/maintenance|swept|schedule/i);
    });

    it('puts no sealed ancestor in this catalog', () => {
        const sealedIds = new Set([
            ...HELD_INSTRUMENTS.map(h => h.id),
            ...UNOWNED_ANCESTORS.map(u => u.id)
        ]);
        for (const s of SITES) {
            expect(sealedIds.has(s.id), `${s.id} collides with a sealed ancestor`).toBe(false);
        }
        // No entry here describes its occupant as sealed and waiting.
        for (const s of SITES) {
            const body = s.kind === 'grave' ? s.interior.scene : s.interior.chamber;
            expect(body, `${s.id} describes a waking rather than a recovery`)
                .not.toMatch(/wakes with hours|sealed ancestor|dormant years/i);
        }
    });

    it('marks the one entry that shares a wall with a resting place, rather than blurring it', () => {
        expect(A_RESTING_PLACE_IS_NOT_A_GRAVE.theOverlapThatIsRealAnyway).toMatch(/wager/i);
        const xun = getGrave('grave-deep-gleaner-xun')!;
        expect(xun.outside.whatAKnowledgeablePartyReads).toMatch(/two different things/i);
        expect(xun.interior.afterwards).toMatch(/not in this catalog/i);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// REFERENTIAL INTEGRITY
// The trials guard inheritances that already exist. No parallel world.
// ─────────────────────────────────────────────────────────────────────────

describe('referential integrity', () => {
    it('names only factions the world already has', () => {
        for (const s of SITES) {
            expect(s.factionIds.length, `${s.id} names nobody`).toBeGreaterThanOrEqual(1);
            for (const id of s.factionIds) {
                expect(factionResolves(id), `${s.id} names unknown faction ${id}`).toBe(true);
            }
        }
    });

    it('awards only techniques the catalog already holds', () => {
        for (const t of INHERITANCE_TRIALS) {
            for (const id of t.interior.prize.techniqueIds) {
                expect(getTechnique(id), `${t.id} awards unknown technique ${id}`).toBeDefined();
            }
        }
        for (const g of GRAVES) {
            for (const c of g.interior.contents) {
                if (c.techniqueId === null) continue;
                expect(getTechnique(c.techniqueId), `${g.id} holds unknown technique ${c.techniqueId}`)
                    .toBeDefined();
            }
        }
        // Several of them guard the fragments of destroyed houses, which is the
        // whole reason those techniques exist as ruin-only entries.
        expect(trialsGuarding('anchor-nail-of-the-broken-girdle').length).toBeGreaterThanOrEqual(1);
        expect(trialsGuarding('gate-that-was-closed').length).toBeGreaterThanOrEqual(1);
        expect(trialsGuarding('severed-thread-audit').length).toBeGreaterThanOrEqual(1);
        expect(trialsGuarding('nameless-witness-stance').length).toBeGreaterThanOrEqual(1);
        // And the trials guarding a fragment name the house it belonged to.
        const girdle = getTrial('trial-the-eighth-stone')!;
        expect(girdle.factionIds).toContain('house-girdle-of-nine-stones');
        expect(getDestroyedDaoHouse('house-girdle-of-nine-stones')).toBeDefined();
    });

    it('never puts a grave-only art behind a trial door', () => {
        for (const t of INHERITANCE_TRIALS) {
            for (const id of t.interior.prize.techniqueIds) {
                expect(
                    GRAVE_ONLY_TECHNIQUE_IDS.has(id),
                    `${t.id} awards ${id}, which only ever surfaces in a grave`
                ).toBe(false);
            }
        }
    });

    it('never lets a trial hand out something that came down from above', () => {
        // `immortal-items.ts` states the supply exists only as a grave and never
        // as a cache, and a trial is a cache with a door on it.
        for (const t of INHERITANCE_TRIALS) {
            expect(t.interior.prize.immortalItemId, `${t.id} awards an immortal item`).toBeNull();
        }
        const holders = GRAVES.filter(g => g.interior.contents.some(c => c.immortalItemId !== null));
        expect(holders.length, 'the one legitimate route must exist and must be rare').toBe(1);
        for (const g of holders) {
            for (const c of g.interior.contents) {
                if (c.immortalItemId === null) continue;
                expect(getImmortalItem(c.immortalItemId), `${g.id} holds unknown item`).toBeDefined();
            }
            // Remote, unarranged, and indistinguishable from the frauds.
            expect(g.burial).toBe('left_where_they_fell');
            expect(g.interior.arrangedForAFinder).toBe(false);
            expect(g.outside.rumour).toMatch(/forgeries/i);
        }
    });

    it('names only spirit roots and root grades the engine has', () => {
        const rootKeys = new Set(SPIRIT_ROOTS.map(r => r.key));
        const rootGrades = new Set(SPIRIT_ROOTS.map(r => r.grade));
        // The local enum must not drift from the engine table.
        expect(new Set(SpiritRootGradeSchema.options)).toEqual(new Set([...rootGrades]));
        for (const s of SITES) {
            for (const g of s.interior.gates) {
                if (g.kind !== 'age_and_talent') continue;
                for (const r of g.requires) {
                    if (r.measure === 'spirit_root') {
                        for (const k of r.oneOf) {
                            expect(rootKeys.has(k as never), `${s.id} names unknown root ${k}`).toBe(true);
                        }
                    }
                    if (r.measure === 'spirit_root_grade') {
                        for (const grade of r.oneOf) {
                            expect(rootGrades.has(grade as never), `${s.id} names unknown grade ${grade}`)
                                .toBe(true);
                        }
                    }
                }
            }
        }
    });

    it('answers where a technique comes from, from both ends', () => {
        expect(gravesHolding('star-quenching-blade-domain').map(g => g.id))
            .toContain('grave-the-remote-carrier');
        expect(trialsGuarding('does-not-exist')).toEqual([]);
        expect(gravesHolding('does-not-exist')).toEqual([]);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE LADDER
// `realms.ts` moved. Nothing here may name a rank it would render differently.
// ─────────────────────────────────────────────────────────────────────────

describe('rank strings agree with the ladder', () => {
    const ALL_RANKS = new Set(
        Array.from({ length: MAX_ORDINAL + 1 }, (_, i) => rankName(i))
    );
    const ALL_SUBRANKS = new Set(REALM_TIERS.flatMap(t => t.subRanks));

    it('keeps every ordinal in the catalog on the ladder', () => {
        for (const s of SITES) {
            if (s.kind === 'grave') {
                expect(s.occupantOrdinal).toBeLessThanOrEqual(MAX_ORDINAL);
                expect(s.occupantOrdinal).toBeGreaterThanOrEqual(0);
            }
            if (s.outside.advertisedOrdinal !== null) {
                expect(s.outside.advertisedOrdinal).toBeLessThanOrEqual(MAX_ORDINAL);
            }
            for (const g of s.interior.gates) {
                if (g.kind !== 'strength') continue;
                expect(g.ordinal).toBeLessThanOrEqual(MAX_ORDINAL);
            }
        }
    });

    it('never spells a realm and sub-rank combination the ladder would not render', () => {
        for (const tier of REALM_TIERS) {
            const escaped = tier.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(`${escaped} ([A-Za-z]+(?: [A-Za-z]+)?)`, 'g');
            for (const match of CORPUS.matchAll(re)) {
                const two = match[1]!;
                const one = two.split(' ')[0]!;
                const used = ALL_SUBRANKS.has(two) ? two : ALL_SUBRANKS.has(one) ? one : null;
                if (used === null) continue;
                expect(
                    ALL_RANKS.has(`${tier.name} ${used}`),
                    `"${tier.name} ${used}" is not a rank this ladder renders`
                ).toBe(true);
            }
        }
    });

    it('uses none of the four sub-rank names the renamed realms no longer have', () => {
        for (const name of ['Deity Transformation', 'Void Refinement', 'Body Integration', 'Grand Ascension']) {
            for (const stale of ['Early', 'Mid', 'Late', 'Perfection']) {
                expect(CORPUS, `${name} ${stale} is a stale rank string`).not.toContain(`${name} ${stale}`);
            }
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// VOICE
// The house style, asserted where it is cheap to assert.
// ─────────────────────────────────────────────────────────────────────────

describe('house style', () => {
    it('uses no em-dashes or en-dashes anywhere', () => {
        // Escaped rather than literal, because this file is itself scanned by
        // `tests/terminology.test.ts` and a literal dash here is an offence.
        expect(CORPUS).not.toMatch(new RegExp('[\\u2013\\u2014]'));
    });

    it('gives every trial a specific way to fail rather than a mood', () => {
        for (const t of INHERITANCE_TRIALS) {
            expect(t.interior.howItKills.length, t.id).toBeGreaterThan(120);
            expect(t.interior.howItKills, `${t.id} is vague about failure`)
                .not.toMatch(/test of (resolve|will|character)/i);
            expect(t.interior.setBy.length).toBeGreaterThan(120);
            expect(t.interior.afterwards.length).toBeGreaterThan(100);
        }
    });

    it('says what a trial was calibrated for, and it does not adjust', () => {
        const corpus = INHERITANCE_TRIALS.map(t => `${t.interior.setBy} ${t.interior.chamber}`).join(' ');
        expect(corpus).toMatch(/calibrated|does not adjust|its own/i);
    });

    it('says what the death did to the contents of every grave, including nothing', () => {
        for (const g of GRAVES) {
            expect(g.interior.whatTheDeathDidToTheContents.length, g.id).toBeGreaterThan(120);
        }
        // The intact ones say plainly that nothing happened, which is the point.
        const intact = GRAVES.filter(g => !tribulationTouched(g.mannerOfDeath));
        const said = intact.map(g => g.interior.whatTheDeathDidToTheContents).join(' ');
        expect(said).toMatch(/nothing/i);
    });

    it('keeps a grave indifferent unless somebody actually arranged it', () => {
        const arranged = GRAVES.filter(g => g.interior.arrangedForAFinder);
        const indifferent = GRAVES.filter(g => !g.interior.arrangedForAFinder);
        expect(indifferent.length, 'most graves were arranged for nobody')
            .toBeGreaterThan(arranged.length);
        // Anything arranged for a finder is an interment or a clan vault.
        for (const g of arranged) {
            expect(['interred_by_a_sect', 'family_crypt'], g.id).toContain(g.burial);
        }
    });
});
