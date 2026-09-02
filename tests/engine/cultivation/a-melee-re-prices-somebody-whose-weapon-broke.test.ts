/**
 * A melee re-prices somebody the moment their weapon goes.
 *
 * ── The gap this closes ──────────────────────────────────────────────────
 *
 * `resolveConfrontation` has always re-assessed a combatant after their object
 * broke - its own comment calls that the whole content of "bring a bad weapon
 * and you brought nothing", and says a weapon lost on the first swing of a
 * round is already gone on the second. `resolveMelee` did not. It priced every
 * member once at the top and carried that `CombatantPower` through the round
 * loop, so somebody who lost a blade in round one went on being priced as
 * though they were holding it for every round after.
 *
 * It was documented in place on `MeleeResult.exchanges` as a known gap that
 * cost nothing, on the correct grounds that no caller in `src/` builds a melee
 * with a weapon in it. That is still true. What it also produced, and what is
 * asserted below, is a second symptom that is visible without any caller at
 * all: the SAME blade breaking on every single strike, because the object was
 * never taken off the person swinging it.
 *
 * ── How the fixture forces a break ───────────────────────────────────────
 *
 * No magic seed and no threshold. `weaponExposure` is certain rather than
 * probabilistic at two realms and up, so an object rated near the bottom of the
 * ladder swung into a body high on it breaks as a matter of physics on the
 * first strike that lands - `chance` reaches 1 and nothing is rolled. Both
 * sides are otherwise identical, which is `AGENTS.md`'s rule about giving both
 * sides the same treatment: the only difference anywhere in this fixture is who
 * is carrying the doomed object.
 */

import { describe, it, expect } from 'vitest';
import {
    assessPower,
    resolveMelee,
    type CarriedObject,
    type CombatantInput
} from '../../../src/engine/cultivation/combat.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';

/** Rated far enough under what it will meet that breaking is not a roll. */
const DOOMED: CarriedObject = { id: 'obj-notched-sabre', name: 'a notched sabre', power: 2 };

/**
 * Both sides stand here, and the distance from the sabre's rung to this one is
 * the whole of the fixture. `weaponExposure` measures realms as the log of a
 * ratio of standings, so what makes a break certain is the DISTANCE between the
 * object and what it is swung into, not either number on its own - and putting
 * both fighters at the same rung keeps the fight itself even while that
 * distance is enormous.
 */
const ORDINAL = 30;

function body(id: string, weapon: CarriedObject | null): CombatantInput {
    const hp = 20 + ORDINAL * 12;
    return {
        id,
        name: id,
        realmOrdinal: ORDINAL,
        spiritRoot: 'muddled_five_element',
        attributes: { might: 2, insight: 2, fortune: 1, charm: 2 },
        injuries: [],
        hp,
        maxHp: hp,
        qi: hp,
        maxQi: hp,
        artifactGrade: 0,
        battlesSurvived: 0,
        technique: null,
        techniqueMastery: 0,
        weapon
    };
}

function fight(seed: string) {
    return resolveMelee(
        [
            { id: 'a', name: 'a', members: [body('armed', DOOMED)] },
            { id: 'b', name: 'b', members: [body('bare', null)] }
        ],
        {
            rng: forStream(seed, 'melee', 1),
            ambient: 'normal',
            turn: 1,
            intent: { goal: 'kill' }
        }
    );
}

/** Ten seeds, because one seed proving a categorical claim is still one seed. */
const SEEDS = Array.from({ length: 10 }, (_, i) => `melee-weapon-${i}`);

describe('a blade that breaks, breaks once', () => {
    it('reports the breakage on exactly one strike, not on every strike after', () => {
        for (const seed of SEEDS) {
            const result = fight(seed);
            const swings = result.exchanges.filter(e => e.attackerId === 'armed');
            const broke = swings.filter(e => e.result.weapon?.broke);

            // The fixture is only worth anything if the object actually went.
            expect(broke.length, `${seed}: nothing broke, fixture is wrong`).toBe(1);
            // And nothing was at risk afterwards, because there was nothing to
            // put at risk. Before the fix every subsequent swing re-broke the
            // same sabre.
            const after = swings.slice(swings.indexOf(broke[0]) + 1);
            for (const swing of after) {
                expect(swing.result.weapon, `${seed}: a second breakage`).toBeNull();
            }
        }
    });

    it('prices the rest of the fight without it', () => {
        for (const seed of SEEDS) {
            const result = fight(seed);
            const armed = result.combatants.find(c => c.id === 'armed')!;
            const unarmed = assessPower(body('armed', null), { ambient: 'normal' });

            // Reported at what they are now, which is what they would have been
            // priced at had they never picked it up.
            expect(armed.power.total, seed).toBeCloseTo(unarmed.total, 6);
            expect(armed.power.weapon, seed).toBeNull();
        }
    });

    it('leaves somebody who never carried one exactly where they were', () => {
        // The control arm. If the re-price reached anybody it should not, this
        // is where it shows, and it is one line rather than an argument.
        for (const seed of SEEDS) {
            const result = fight(seed);
            const bare = result.combatants.find(c => c.id === 'bare')!;
            const priced = assessPower(body('bare', null), { ambient: 'normal' });
            expect(bare.power.total, seed).toBeCloseTo(priced.total, 6);
        }
    });
});
