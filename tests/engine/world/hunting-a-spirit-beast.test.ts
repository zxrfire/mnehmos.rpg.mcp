/**
 * The reader the beast catalog never had.
 *
 * `beasts.ts` was 1113 lines with no consumer anywhere in `src/engine/`,
 * `src/web/` or `src/server/`. These assertions are about the wiring rather
 * than about the content - the catalog has its own tests - so what is checked
 * here is that the gates the data already carried are actually applied:
 *
 *   - `persistence` keeps the impressive things off ordinary ground
 *   - the ladder decides fights, and what is above you is always reported
 *   - `harvestOrdinal` gates cutting separately from killing
 *   - the counted/tracked line follows `items.md` rather than convenience
 *   - a tracked material arrives as an object with a provenance chain
 */

import { describe, it, expect } from 'vitest';

import {
    beastsOnThisGround,
    whatIsOnThisGround,
    whatComesOffTheBody,
    howAMaterialIsStored,
    significanceOf,
    objectForBeastMaterial,
    readsAsSomebody,
    hasACore,
    bandOf,
    abilityAt,
    bloodlineTierForChild
} from '../../../src/engine/world/hunting-a-spirit-beast.js';
import {
    BEASTS,
    BEAST_CHANGE_ORDINAL,
    BEAST_CORE_ORDINAL,
    requireBeast,
    requireBeastMaterial,
    materialsOf
} from '../../../src/data/cultivation/beasts.js';
import { keptAs } from '../../../src/engine/world/possessions.js';

const OPEN = { sealed: false, onAVein: false };
const VEIN = { sealed: false, onAVein: true };
const SEALED = { sealed: true, onAVein: true };

describe('what ground carries what', () => {
    it('keeps the sealed population out of the open world entirely', () => {
        const open = beastsOnThisGround(OPEN);
        expect(open.length).toBeGreaterThan(0);
        for (const b of open) {
            expect(b.persistence, `${b.id} survives on ordinary ground`).not.toBe('sealed_only');
            expect(b.persistence, `${b.id} needs a vein and is on open ground`).not.toBe('vein_only');
        }
    });

    it('opens the vein population on a vein and the sealed one behind a seal', () => {
        const onVein = beastsOnThisGround(VEIN).map(b => b.id);
        const veinOnly = BEASTS.filter(b => b.persistence === 'vein_only');
        expect(veinOnly.length).toBeGreaterThan(0);
        for (const b of veinOnly) expect(onVein).toContain(b.id);
        // A vein is not a seal.
        for (const b of BEASTS.filter(x => x.persistence === 'sealed_only')) {
            expect(onVein).not.toContain(b.id);
            expect(beastsOnThisGround(SEALED).map(x => x.id)).toContain(b.id);
        }
    });

    it('makes richer ground strictly a superset of poorer ground', () => {
        // One-directional, and the reason a sealed pocket carries everything:
        // a seal is what stopped anybody drawing on it.
        const open = new Set(beastsOnThisGround(OPEN).map(b => b.id));
        const vein = new Set(beastsOnThisGround(VEIN).map(b => b.id));
        const sealed = new Set(beastsOnThisGround(SEALED).map(b => b.id));
        for (const id of open) expect(vein.has(id), `${id} is on open ground, not on a vein`).toBe(true);
        for (const id of vein) expect(sealed.has(id), `${id} is on a vein, not behind a seal`).toBe(true);
    });
});

describe('the ladder decides, and what is above you is always said', () => {
    it('never draws anything above the hunter', () => {
        for (const ordinal of [0, 5, 13, 20, 29, 40]) {
            for (const sample of [0, 0.25, 0.5, 0.75, 0.999999]) {
                const found = whatIsOnThisGround(SEALED, ordinal, sample);
                if (found.met) {
                    expect(found.met.ordinal, `drew ${found.met.id} at ordinal ${ordinal}`)
                        .toBeLessThanOrEqual(ordinal);
                }
            }
        }
    });

    it('reports what is above rather than hiding it, and prices the worst of it', () => {
        // The read that keeps people alive. A nobody standing on sealed ground
        // is surrounded, and is entitled to know before walking in.
        const found = whatIsOnThisGround(SEALED, 0, 0.5);
        expect(found.above.length).toBeGreaterThan(5);
        expect(found.worst).not.toBeNull();
        for (const b of found.above) expect(b.ordinal).toBeGreaterThan(0);
        // And at the top of the ladder there is nothing above you.
        expect(whatIsOnThisGround(SEALED, 46, 0.5).above).toEqual([]);
        expect(whatIsOnThisGround(SEALED, 46, 0.5).worst).toBeNull();
    });

    it('takes the caller\'s sample and nothing else, so a hunt replays', () => {
        const a = whatIsOnThisGround(VEIN, 25, 0.4);
        const b = whatIsOnThisGround(VEIN, 25, 0.4);
        expect(a.met?.id).toBe(b.met?.id);
    });
});

describe('the three bands', () => {
    it('sorts every beast by the two constants and nothing else', () => {
        for (const b of BEASTS) {
            const band = bandOf(b);
            if (b.ordinal >= BEAST_CHANGE_ORDINAL) expect(band).toBe('person');
            else if (b.ordinal >= BEAST_CORE_ORDINAL) expect(band).toBe('tracked');
            else expect(band).toBe('counted');
        }
    });

    it('puts a core in the tracked band and nothing in the counted one', () => {
        for (const b of BEASTS) {
            const core = materialsOf(b.id).find(m => m.core);
            if (bandOf(b) === 'counted') {
                expect(core, `${b.id} is counted and carries a core`).toBeUndefined();
                expect(hasACore(b)).toBe(false);
            }
        }
    });

    it('reads speech off the field and never off the ordinal', () => {
        // The floor is real, but so is the set of things above it that say
        // nothing - and those are the worst entries in the catalog.
        for (const b of BEASTS) {
            if (readsAsSomebody(b)) {
                expect(b.ordinal).toBeGreaterThanOrEqual(BEAST_CHANGE_ORDINAL);
            }
        }
        const silentAndHigh = BEASTS.filter(b => b.ordinal >= BEAST_CHANGE_ORDINAL && !readsAsSomebody(b));
        expect(silentAndHigh.length, 'nothing high is silent, so the field is redundant')
            .toBeGreaterThan(0);
    });
});

describe('what comes off the body', () => {
    it('needs a body for a kill and needs none for a shed or a scavenge', () => {
        // The bottom of the trade, and the reason somebody who cannot fight
        // anything still has a route onto this ladder.
        const tiger = requireBeast('beast-white-tiger');
        const noBody = whatComesOffTheBody({ beast: tiger, takerOrdinal: 20, killed: false });
        expect(noBody.taken.map(t => t.material.id)).toEqual(['mat-tiger-fang']);
        expect(noBody.leftBehind.every(l => l.because === 'no_body')).toBe(true);

        const body = whatComesOffTheBody({ beast: tiger, takerOrdinal: 20, killed: true });
        expect(body.taken.map(t => t.material.id).sort())
            .toEqual(['mat-tiger-core', 'mat-tiger-fang', 'mat-tiger-pelt']);
        expect(body.leftBehind).toEqual([]);
    });

    it('gates cutting on realm separately from killing', () => {
        // Killing a thing and being able to cut it are different facts, and
        // this is what stops a lucky kill becoming a windfall.
        const tiger = requireBeast('beast-white-tiger');
        const low = whatComesOffTheBody({ beast: tiger, takerOrdinal: 12, killed: true });
        expect(low.taken.map(t => t.material.id)).toEqual(['mat-tiger-fang']);
        const denied = low.leftBehind.filter(l => l.because === 'realm');
        expect(denied.length).toBe(2);
        for (const row of denied) expect(row.needs).toBe(20);
    });

    it('yields nothing off the ones anybody could actually negotiate with', () => {
        // The negotiable ones carry no material entry, and that is not
        // squeamishness: nobody has taken one, so there is no grade, no price
        // and no assay standard to quote.
        for (const b of BEASTS.filter(x => x.nature === 'intelligent')) {
            expect(readsAsSomebody(b), `${b.id} is intelligent and mute`).toBe(true);
            const got = whatComesOffTheBody({ beast: b, takerOrdinal: 46, killed: true });
            expect(got.taken, `${b.id} has been priced`).toEqual([]);
        }
    });

    it('does price the body of one changed beast, which is the general rule showing', () => {
        // The Sleeper in the Cut Face speaks AND carries a core with a figure
        // on it. That looks like a contradiction and is the thesis: a person's
        // body can be worth money, and what anybody does about that is the
        // ordinary question the world asks about every cultivator - is this
        // person worth more to you alive, or as material.
        //
        // It is left standing rather than tidied away, because tidying it
        // would make "a changed beast is a person" mean "a changed beast is
        // exempt", and no rule in this world works that way. What stops it
        // being farmable is what stops everything: it is behind a seal, its
        // frequency is 1, and taking it needs a realm almost nobody reaches.
        const priced = BEASTS.filter(b => readsAsSomebody(b)
            && whatComesOffTheBody({ beast: b, takerOrdinal: 46, killed: true }).taken.length > 0);
        expect(priced.length, 'a changed beast being priced is the case to preserve').toBe(1);
        for (const b of priced) {
            expect(bandOf(b)).toBe('person');
            expect(b.persistence, `${b.id} is priced and reachable`).toBe('sealed_only');
            expect(b.frequency, `${b.id} is priced and a common draw`).toBeLessThanOrEqual(2);
        }
    });
});

describe('counted or tracked, per items.md', () => {
    it('counts what the population can restock and tracks what it cannot', () => {
        for (const m of BEASTS.flatMap(b => materialsOf(b.id))) {
            const shape = howAMaterialIsStored(m);
            expect(shape).toBe(m.grade === 'mortal' || m.grade === 'earth' ? 'counted' : 'tracked');
        }
    });

    it('tracks every core, and the one heaven-grade plate that is not one', () => {
        // Keyed on GRADE rather than on `core`, which is the tempting reading
        // and is wrong at exactly one row: the Earth Dragon Scale is heaven
        // grade, is not a core, and its own description says nobody sells one
        // without being asked where it came from.
        for (const m of BEASTS.flatMap(b => materialsOf(b.id)).filter(x => x.core)) {
            expect(howAMaterialIsStored(m), `${m.id} is a core and is counted`).toBe('tracked');
        }
        expect(howAMaterialIsStored(requireBeastMaterial('mat-dragon-scale'))).toBe('tracked');
        expect(requireBeastMaterial('mat-dragon-scale').core).toBe(false);
    });

    /**
     * RE-DERIVED, because the old bar asserted the opposite of the test above
     * it. It read `notable` for earth grade - "raises the bookkeeping with the
     * grade" - while `howAMaterialIsStored` two tests up says earth is COUNTED,
     * and `possessions.ts` documents `mundane` as the marker for a thing that
     * gets no provenance at all. So a tiger pelt was a counted thing that
     * `keptAs` and `isTracked` both answered "tracked" about.
     *
     * Bookkeeping does not rise smoothly with grade. It STEPS ONCE, at the
     * counted/tracked line, and then grades within the tracked side - which is
     * exactly the shape `significanceOfPill` and `significanceOfDose` already
     * have, and `significanceOf` now derives from `howAMaterialIsStored` so the
     * two cannot part again.
     */
    it('steps once at the counted line, then grades within the tracked side', () => {
        for (const m of BEASTS.flatMap(b => materialsOf(b.id))) {
            expect(
                keptAs(significanceOf(m)),
                `${m.id} is ${m.grade} and its two answers disagree`
            ).toBe(howAMaterialIsStored(m) === 'counted' ? 'counted' : 'tracked');
        }
        // A pelt off a hare and a pelt off a tiger are both a number in a
        // pouch. Neither is worth a story, and the tiger is not worth one for
        // being a tiger.
        expect(significanceOf(requireBeastMaterial('mat-hare-pelt'))).toBe('mundane');
        expect(significanceOf(requireBeastMaterial('mat-tiger-pelt'))).toBe('mundane');
        expect(significanceOf(requireBeastMaterial('mat-tiger-core'))).toBe('significant');
        expect(significanceOf(requireBeastMaterial('mat-dragon-core'))).toBe('legendary');
    });
});

describe('a core is a real object with a real origin', () => {
    const build = (beastId: string, materialId: string) => objectForBeastMaterial({
        id: 'obj-test-1',
        material: requireBeastMaterial(materialId),
        beast: requireBeast(beastId),
        takerId: 'cult-1',
        takerName: 'Shen Qiaoyu',
        place: 'Nine Peaks',
        onDay: 400
    });

    it('arrives holding a provenance chain rather than appearing in a hand', () => {
        const core = build('beast-white-tiger', 'mat-tiger-core');
        expect(core.possessorId).toBe('cult-1');
        expect(core.ownerId).toBe('cult-1');
        expect(core.provenance.length).toBe(1);
        const [link] = core.provenance;
        expect(link.how).toBe('looted');
        expect(link.onDay).toBe(400);
        expect(link.source).toContain('White Tiger');
        expect(link.source).toContain('Nine Peaks');
        // Nothing held it before, which is the honest answer for a body.
        expect(link.previousHolderId).toBeNull();
    });

    it('is worth a great deal and worth nothing in a fight', () => {
        // `power` is the fight column. A core is not a weapon, and giving it a
        // number here would quietly arm everybody who ever sold one.
        expect(build('beast-white-tiger', 'mat-tiger-core').power).toBeNull();
        expect(build('beast-earth-dragon', 'mat-dragon-core').power).toBeNull();
    });

    it('records whether it came off something that could have answered', () => {
        // The whole enforcement of the ethical half, and it is one sentence in
        // an ordinary field on an ordinary row. No second table, no branch on
        // what kind of thing it was.
        const animal = build('beast-white-tiger', 'mat-tiger-core');
        expect(animal.tags).not.toContain('taken_from_something_that_spoke');
        expect(animal.provenance[0].note).toMatch(/could\s+have\s+answered|Nothing about it/i);
        expect(animal.data.spoke).toBe(false);
    });

    it('carries the source beast on the row, so the chain resolves later', () => {
        const core = build('beast-earth-dragon', 'mat-dragon-core');
        expect(core.data.beastId).toBe('beast-earth-dragon');
        expect(core.data.beastOrdinal).toBe(requireBeast('beast-earth-dragon').ordinal);
        expect(core.tags).toContain('core');
        expect(core.tags).toContain('source:beast-earth-dragon');
        expect(core.kind).toBe('material');
    });
});

describe('the species axis', () => {
    it('gives every species one, so none of them reads as unfinished', () => {
        for (const b of BEASTS) {
            expect(b.ability.name.length, `${b.id} has no ability`).toBeGreaterThan(0);
            expect(b.ability.what.length).toBeGreaterThan(40);
        }
        // And they are distinct things rather than one thing renamed.
        expect(new Set(BEASTS.map(b => b.ability.name)).size).toBe(BEASTS.length);
        expect(new Set(BEASTS.map(b => b.ability.kind)).size).toBeGreaterThanOrEqual(4);
    });

    it('scales on the same two constants and introduces no third threshold', () => {
        for (const b of BEASTS) {
            const at = abilityAt(b);
            const band = bandOf(b);
            expect(at.tier).toBe(
                band === 'person' ? 'final' : band === 'tracked' ? 'grown' : 'latent'
            );
            // The authored line is the final form; the tier is what it amounts to.
            expect(at.what).toBe(b.ability.what);
            expect(at.atThisTier.length).toBeGreaterThan(20);
        }
    });

    it('lets only the final form put the beast shape on and take it off', () => {
        // At the change a beast is human-shaped, so the beast form is a
        // capability rather than a default state.
        for (const b of BEASTS) {
            expect(abilityAt(b).canTakeTheBeastForm).toBe(bandOf(b) === 'person');
        }
        const anyFinal = BEASTS.filter(b => abilityAt(b).tier === 'final');
        expect(anyFinal.length).toBeGreaterThan(0);
    });
});

describe('the bloodline, which is the ability ladder read backwards', () => {
    it('is gone in three generations from one carrier', () => {
        // No dilution constant anywhere. The decay curve IS the ability
        // ladder, stepped down.
        const child = bloodlineTierForChild('final', null);
        expect(child).toBe('grown');
        const grandchild = bloodlineTierForChild(child, null);
        expect(grandchild).toBe('latent');
        const great = bloodlineTierForChild(grandchild, null);
        expect(great).toBeNull();
    });

    it('holds the line when both parents carry, at the better of the two', () => {
        expect(bloodlineTierForChild('final', 'final')).toBe('final');
        expect(bloodlineTierForChild('grown', 'grown')).toBe('grown');
        expect(bloodlineTierForChild('latent', 'latent')).toBe('latent');
        // The better of the two, and the order does not matter.
        expect(bloodlineTierForChild('final', 'latent')).toBe('final');
        expect(bloodlineTierForChild('latent', 'final')).toBe('final');
        expect(bloodlineTierForChild('grown', 'latent')).toBe('grown');
    });

    it('reads both parents and nothing else', () => {
        // There is no `marriedWithinTheLine` flag and there must not be one.
        // A closed clan and two strangers who both happen to carry are the
        // same input and get the same answer, which is what makes the insular
        // clan a consequence rather than a rule.
        expect(bloodlineTierForChild('grown', 'grown'))
            .toBe(bloodlineTierForChild('grown', 'grown'));
        expect(bloodlineTierForChild(null, null)).toBeNull();
        expect(bloodlineTierForChild(null, 'grown')).toBe('latent');
    });

    it('never touches talent, because it cannot reach it', () => {
        // The player is promised that spirit root and the four attributes are
        // rolled once and locked. This function takes two tiers and returns a
        // tier: there is no surface here through which a bloodline could
        // improve either, and that is the guard.
        const returned = ['final', 'grown', 'latent', null];
        for (const a of ['final', 'grown', 'latent', null] as const) {
            for (const b of ['final', 'grown', 'latent', null] as const) {
                expect(returned).toContain(bloodlineTierForChild(a, b));
            }
        }
    });
});
