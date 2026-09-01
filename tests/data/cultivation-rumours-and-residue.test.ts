/**
 * The ambient layer: what people say, what they say it about, and whether it
 * is true.
 *
 * Three catalogs are checked here and they share one purpose - texture that
 * describes what the systems already produce. So the assertions are mostly
 * about REACHABILITY and RESOLUTION rather than about content:
 *
 *   - a saying about a faction nobody can name is unreachable
 *   - a story attached to a place name the generator will never emit is
 *     unreachable
 *   - a fear or a funeral for a settlement kind that does not exist is
 *     unreachable
 *
 * Every one of those is silent at runtime and fails here instead, which is the
 * failure mode `src/web/lore.ts` was written to prevent and the one this
 * material is most likely to reintroduce.
 *
 * The other thing asserted is the property the rumour file exists for: most of
 * it must be WRONG. A hearsay layer that is reliably correct is a briefing.
 */

import { describe, it, expect } from 'vitest';

import {
    RUMOURS,
    RumourSchema,
    WRONG_ACCURACIES,
    getRumour,
    rumoursAbout,
    unattachedRumours,
    rumoursSpeakableBy,
    rumoursThatAreWrong,
    shareOfRumoursThatAreWrong
} from '../../src/data/cultivation/rumours-and-what-they-get-wrong.js';
import {
    LOCAL_RESIDUE,
    LocalResidueSchema,
    residueFor,
    residueOfKind,
    unsettledResidue
} from '../../src/data/cultivation/history.js';
import {
    RUIN_NAMES,
    SCAR_NAMES,
    REGIONS
} from '../../src/data/cultivation/regions.js';
import { SECTS, DESTROYED_DAO_HOUSES } from '../../src/data/cultivation/sects.js';
import { APEX_INSTITUTIONS } from '../../src/data/cultivation/governance-and-water-rights.js';
import {
    SETTLEMENTS,
    SETTLEMENT_FEARS,
    SettlementFearSchema,
    FUNERARY_PRACTICE,
    FuneraryPracticeSchema,
    fearsOf,
    fearsThatFundSomebody,
    funeraryPracticeOf
} from '../../src/data/cultivation/mortal-world.js';
import { MAX_ORDINAL } from '../../src/engine/cultivation/realms.js';

/**
 * Everything a rumour is allowed to point at, by id.
 *
 * The destroyed houses are in here deliberately. A house that is gone is still
 * a name people say, and the stale sayings are precisely the ones attached to
 * one, so excluding them would make a whole failure mode unwritable.
 */
const NAMEABLE: ReadonlySet<string> = new Set<string>([
    ...SECTS.map(s => s.id),
    ...DESTROYED_DAO_HOUSES.map(h => h.id),
    ...APEX_INSTITUTIONS.map(a => a.id),
    ...REGIONS.map(r => r.id)
]);

const RUIN_NAME_SET: ReadonlySet<string> = new Set(RUIN_NAMES.map(n => n.name));
const SCAR_NAME_SET: ReadonlySet<string> = new Set(SCAR_NAMES.map(n => n.name));

describe('rumours', () => {
    it('parses, and every id is unique', () => {
        for (const r of RUMOURS) expect(() => RumourSchema.parse(r), r.id).not.toThrow();
        const ids = new Set(RUMOURS.map(r => r.id));
        expect(ids.size, 'duplicate rumour id').toBe(RUMOURS.length);
    });

    it('points only at things somebody could actually be told the name of', () => {
        for (const r of RUMOURS) {
            if (r.aboutId === null) continue;
            expect(NAMEABLE.has(r.aboutId), `${r.id} is about unknown entity ${r.aboutId}`).toBe(true);
        }
    });

    it('names a faction that exists wherever it claims an insider', () => {
        const factions = new Set<string>([
            ...SECTS.map(s => s.id),
            ...APEX_INSTITUTIONS.map(a => a.id)
        ]);
        for (const r of RUMOURS) {
            if (r.insiderFactionId === null) continue;
            expect(factions.has(r.insiderFactionId), `${r.id} names unknown faction ${r.insiderFactionId}`)
                .toBe(true);
        }
    });

    it('names a region that exists wherever it claims a locality', () => {
        const regions = new Set(REGIONS.map(r => r.id));
        for (const r of RUMOURS) {
            if (r.regionId === null) continue;
            expect(regions.has(r.regionId), `${r.id} sits in unknown region ${r.regionId}`).toBe(true);
        }
    });

    it('is not reliably correct, because a reliable rumour layer is a briefing', () => {
        // Two loose bounds rather than one tight one. An exact fraction would
        // make every addition to the catalog a failure here, and a threshold
        // sitting two points above the current value is the same trap wearing
        // a percentage.
        //
        // The demonstrably-wrong ones must be a large share, and the plainly
        // correct ones must not be a majority - `unresolved` is neither, and
        // is deliberately outside both counts because the catalog does not
        // know the answer either.
        expect(shareOfRumoursThatAreWrong()).toBeGreaterThan(0.4);
        const plainlyTrue = RUMOURS.filter(r => r.accuracy === 'true').length;
        expect(plainlyTrue / RUMOURS.length).toBeLessThan(0.5);
        for (const r of rumoursThatAreWrong()) {
            expect(WRONG_ACCURACIES).toContain(r.accuracy);
        }
    });

    it('carries every failure mode, so no kind of wrongness is theoretical', () => {
        const seen = new Set(RUMOURS.map(r => r.accuracy));
        for (const accuracy of [...WRONG_ACCURACIES, 'true', 'unresolved'] as const) {
            expect(seen.has(accuracy), `nothing in the catalog is ${accuracy}`).toBe(true);
        }
    });

    it('states what is underneath, and it is never the saying again', () => {
        for (const r of RUMOURS) {
            expect(r.underneath, r.id).not.toBe(r.saying);
            expect(r.underneath.length, `${r.id} explains itself too briefly`)
                .toBeGreaterThan(60);
        }
    });

    it('has something reachable by a speaker who knows nothing whatever', () => {
        // Where every run starts. If the bottom of the ladder can say nothing,
        // the discovery channels have no first step.
        const fromTheBottom = rumoursSpeakableBy(0);
        expect(fromTheBottom.length).toBeGreaterThan(8);
        expect(fromTheBottom.some(r => r.aboutId === null)).toBe(true);
    });

    it('lets an insider hold their own house\'s sayings from any standing', () => {
        const insider = RUMOURS.find(r => r.insiderFactionId !== null && r.floorOrdinal > 0);
        expect(insider, 'no rumour is insider-held above the floor').toBeDefined();
        const held = rumoursSpeakableBy(0, insider!.insiderFactionId);
        expect(held.map(r => r.id)).toContain(insider!.id);
    });

    it('keeps every floor inside the ladder the engine actually has', () => {
        for (const r of RUMOURS) {
            expect(r.floorOrdinal, r.id).toBeGreaterThanOrEqual(0);
            expect(r.floorOrdinal, r.id).toBeLessThanOrEqual(MAX_ORDINAL + 20);
        }
    });

    it('joins to a catalog entry, and answers for the unattached ones too', () => {
        const attached = RUMOURS.find(r => r.aboutId !== null)!;
        expect(rumoursAbout(attached.aboutId!).map(r => r.id)).toContain(attached.id);
        expect(rumoursAbout('sect-that-does-not-exist')).toEqual([]);
        expect(unattachedRumours().length).toBeGreaterThan(5);
        expect(unattachedRumours().every(r => r.aboutId === null)).toBe(true);
        expect(getRumour(attached.id)?.id).toBe(attached.id);
        expect(getRumour('nope')).toBeUndefined();
    });

    it('uses no dash the repository has banned', () => {
        for (const r of RUMOURS) {
            const text = `${r.saying} ${r.saidBy} ${r.underneath} ${r.consequence}`;
            expect(/[–—]/.test(text), `${r.id} contains an en- or em-dash`).toBe(false);
        }
    });
});

describe('local residue of the deep past', () => {
    it('parses, and no site carries a contradictory kind', () => {
        for (const r of LOCAL_RESIDUE) {
            expect(() => LocalResidueSchema.parse(r), r.siteName).not.toThrow();
        }
        const seen = new Map<string, string>();
        for (const r of LOCAL_RESIDUE) {
            const prior = seen.get(r.siteName);
            if (prior !== undefined) expect(prior, r.siteName).toBe(r.kind);
            seen.set(r.siteName, r.kind);
        }
    });

    it('attaches every ruin and scar story to a name the generator can emit', () => {
        // The whole point. A story hung on a name that is not in the draw is a
        // story nobody can ever be told, and nothing at runtime would say so.
        for (const r of LOCAL_RESIDUE) {
            if (r.kind === 'ruin') {
                expect(RUIN_NAME_SET.has(r.siteName), `${r.siteName} is not in RUIN_NAMES`).toBe(true);
            }
            if (r.kind === 'scar') {
                expect(SCAR_NAME_SET.has(r.siteName), `${r.siteName} is not in SCAR_NAMES`).toBe(true);
            }
        }
    });

    it('covers both kinds of site and both kinds of siteless residue', () => {
        for (const kind of ['ruin', 'scar', 'road', 'word'] as const) {
            expect(residueOfKind(kind).length, `nothing recorded for ${kind}`).toBeGreaterThan(0);
        }
    });

    it('records a practice for every account, because practice is what survives', () => {
        for (const r of LOCAL_RESIDUE) {
            expect(r.practice.length, `${r.siteName} has no practice attached`).toBeGreaterThan(40);
            expect(r.practice, r.siteName).not.toBe(r.whatTheySay);
        }
    });

    it('leaves most of it unsettled, and never settles it by assertion', () => {
        expect(unsettledResidue().length).toBeGreaterThan(0);
        for (const r of LOCAL_RESIDUE) {
            expect(['objective', 'reconstructed', 'unresolved']).toContain(r.truth);
            expect(r.established, r.siteName).not.toBe(r.whatTheySay);
        }
    });

    it('is reachable by site name', () => {
        const one = LOCAL_RESIDUE[0]!;
        expect(residueFor(one.siteName).map(r => r.siteName)).toContain(one.siteName);
        expect(residueFor('a place with no story')).toEqual([]);
    });

    it('gives a story to the named sites that most obviously imply one', () => {
        // These names were authored with a story behind them and nothing
        // written down. If one drops out of the residue it has gone back to
        // being a label.
        const told = new Set(LOCAL_RESIDUE.map(r => r.siteName));
        for (const name of ['Ninebell', 'Quan\'s Shelf', 'The Warm Gate', 'Coldwell',
            'Halfroof', 'Nothing Grows', 'Cutbank', 'Hemu\'s Rest']) {
            expect(told.has(name), `${name} has no story attached`).toBe(true);
        }
    });

    it('uses no dash the repository has banned', () => {
        for (const r of LOCAL_RESIDUE) {
            const text = `${r.whatTheySay} ${r.heldBy} ${r.practice} ${r.established}`;
            expect(/[–—]/.test(text), `${r.siteName} contains an en- or em-dash`).toBe(false);
        }
    });
});

describe('the mortal world, below the cultivators', () => {
    it('parses the fears and gives every settlement kind at least one', () => {
        for (const f of SETTLEMENT_FEARS) {
            expect(() => SettlementFearSchema.parse(f), f.id).not.toThrow();
        }
        expect(new Set(SETTLEMENT_FEARS.map(f => f.id)).size).toBe(SETTLEMENT_FEARS.length);
        for (const s of SETTLEMENTS) {
            expect(fearsOf(s.kind).length, `${s.kind} is afraid of nothing`).toBeGreaterThan(0);
        }
    });

    it('attaches an expenditure to every fear, because a free fear is a mood', () => {
        for (const f of SETTLEMENT_FEARS) {
            expect(f.spentOnIt.length, f.id).toBeGreaterThan(40);
            expect(f.behindIt, f.id).not.toBe(f.fear);
        }
        // And some of it is somebody's income, which is what makes a fear
        // outlive the thing behind it.
        expect(fearsThatFundSomebody().length).toBeGreaterThan(0);
    });

    it('buries the dead in every settlement kind, and differently in each', () => {
        for (const f of FUNERARY_PRACTICE) {
            expect(() => FuneraryPracticeSchema.parse(f), f.id).not.toThrow();
        }
        for (const s of SETTLEMENTS) {
            const practice = funeraryPracticeOf(s.kind);
            expect(practice, `${s.kind} does nothing with its dead`).toBeDefined();
        }
        const practices = new Set(FUNERARY_PRACTICE.map(f => f.practice));
        expect(practices.size, 'two settlement kinds bury identically').toBe(FUNERARY_PRACTICE.length);
    });

    it('says what changes when the body is a cultivator\'s', () => {
        for (const f of FUNERARY_PRACTICE) {
            expect(f.ifTheyWereACultivator, f.id).not.toBe(f.practice);
            expect(f.ifTheyWereACultivator.length, f.id).toBeGreaterThan(60);
        }
    });

    it('uses no dash the repository has banned', () => {
        for (const f of SETTLEMENT_FEARS) {
            const text = `${f.fear} ${f.behindIt} ${f.spentOnIt} ${f.paidTo ?? ''}`;
            expect(/[–—]/.test(text), `${f.id} contains an en- or em-dash`).toBe(false);
        }
        for (const f of FUNERARY_PRACTICE) {
            const text = `${f.practice} ${f.because} ${f.cost} ${f.ifTheyWereACultivator}`;
            expect(/[–—]/.test(text), `${f.id} contains an en- or em-dash`).toBe(false);
        }
    });
});
