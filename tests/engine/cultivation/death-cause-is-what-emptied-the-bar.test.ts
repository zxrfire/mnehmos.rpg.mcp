/**
 * What the ledger says a cultivator died of.
 *
 * In a permadeath game the ledger is the only surviving account of a run, so a
 * cause that is merely plausible is a lie with a permanent home. Found by
 * playing: a cultivator who sat down for a seclusion, took three qi deviations
 * and died of them was written into the ledger as `combat_defeat` - "killed in
 * combat" - in a run in which no combat occurred at any point.
 *
 * The bug was that an empty HP bar had exactly one story. It is a state, not a
 * story: whoever watched the last point go is the only party that can say what
 * took it, and `hpDepletedBy` is how they say so.
 */

import { evaluateDeathConditions, describeDeath } from '../../../src/engine/cultivation/survival.js';
import { simulateTimeSkip } from '../../../src/engine/cultivation/time-skip.js';
import { makeCultivator, makeInjuries } from './fixtures.js';

describe('an empty HP bar names what emptied it', () => {
    it('still reads as combat when nobody says otherwise', () => {
        const cause = evaluateDeathConditions(makeCultivator({ hp: 0 }));
        expect(cause).toBe('combat_defeat');
    });

    it('reads as qi deviation when the caller that watched it says so', () => {
        const cause = evaluateDeathConditions(
            makeCultivator({ hp: 0 }),
            { hpDepletedBy: 'qi_deviation' }
        );
        expect(cause).toBe('qi_deviation');
        expect(describeDeath(cause!, makeCultivator({ hp: 0 }))).toContain('qi deviation');
        expect(describeDeath(cause!, makeCultivator({ hp: 0 }))).not.toContain('combat');
    });

    /**
     * The stated cause outranks the default only for the bar itself. A
     * cultivator who is out of lifespan and still standing dies of the lifespan,
     * whatever the caller thinks took their HP - the gate is ordered
     * most-immediate-first and this must not reorder it.
     */
    it('does not reach past the HP check to relabel another cause', () => {
        const cause = evaluateDeathConditions(
            makeCultivator({ hp: 10, age: 500, realmOrdinal: 0 }),
            { hpDepletedBy: 'qi_deviation' }
        );
        expect(cause).toBe('lifespan_exhausted');
    });
});

describe('a seclusion that kills nobody by violence records nobody as killed by violence', () => {
    /**
     * The whole point, end to end. Nothing in `simulateTimeSkip` is a fight, so
     * whatever this reports, `combat_defeat` is the one answer that cannot be
     * right when the HP went to a deviation.
     *
     * Seeded and long enough that the deviation grid is certain to fire on a
     * cultivator who starts one hit from zero and is already carrying open
     * meridians, which is what pushes the deviation risk up.
     */
    it('does not write combat_defeat over a death in a sealed cave', () => {
        // At the lethal untreated count on purpose. Below it the body now mends
        // ambiently, so a cultivator sitting at 1 HP simply heals up and lives -
        // which is the point of that change and makes this a poor place to
        // measure a death. At the threshold, mending is off, which is the
        // owner's own exception: "unless you are so injured you are slowly
        // dying."
        const cultivator = makeCultivator({
            hp: 1,
            maxHp: 50,
            injuries: makeInjuries(3, 'serious', 'qi_deviation')
        });

        const skip = simulateTimeSkip(cultivator, 3650, {
            seed: 'death-cause-in-seclusion',
            rollIdentity: 'player',
            locationId: 'nowhere',
            turn: 1,
            startDay: 0,
            randomEvents: false,          // nothing may wander in and hit anybody
            autoBreakthrough: false,
            grainAbstinence: true         // and nobody may starve, which has its own cause
        });

        expect(skip.died).toBe(true);
        expect(skip.deathCause).not.toBe('combat_defeat');
        expect(describeDeath(skip.deathCause!, cultivator)).not.toContain('killed in combat');
    });
});
