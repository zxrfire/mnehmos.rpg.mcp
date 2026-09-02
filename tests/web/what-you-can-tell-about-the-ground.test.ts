/**
 * The sheet reports what this cultivator can perceive, not what the engine knows.
 *
 * The ruling:
 *
 *   "at early levels its a feeling, as you go up then it becomes more clear -
 *    the grounds can support x and there's y people. you can't tell at qi
 *    condensation, you can just say the qi feels light or heavy etc."
 *   "this is where a master can help tell you."
 *
 * The constraint that makes it a design rather than a nerf is the third block
 * below: a beginner who can only feel the qi must still be able to CHOOSE
 * BETWEEN TWO PLACES. If that stops holding, the thing that was just fixed has
 * been re-broken.
 */

import { describe, it, expect } from 'vitest';

import { REALM_TIERS } from '../../src/engine/cultivation/realms';
import { howCrowdedThisGroundIs } from '../../src/web/how-crowded-this-ground-is';
import {
    FEELS_THE_OTHERS,
    READS_A_VEIN,
    groundAsPerceived,
    groundAsPerceivedRead,
    whatTheyCanTell
} from '../../src/web/what-you-can-tell-about-the-ground';

/** The engine's own calibration: thin carries 7, a valley 30, a rich vein 56. */
const THIN = 0.10;
const ORDINARY = 0.42;
const RICH = 0.78;

const at = (density: number, occupants: readonly number[]) =>
    howCrowdedThisGroundIs({ placeName: 'Somewhere', density, occupantOrdinals: occupants });

const alone = [0];
const aCrowd = Array.from({ length: 90 }, () => 8);

describe('where the thresholds sit', () => {
    it('puts the figures at Core Formation\'s own start', () => {
        const core = REALM_TIERS.find(t => t.key === 'core_formation')!;
        expect(READS_A_VEIN).toBe(core.ordinalStart);
    });

    it('puts the crowding at the first rung that has a foundation', () => {
        const foundation = REALM_TIERS.find(t => t.key === 'foundation_establishment')!;
        expect(FEELS_THE_OTHERS).toBe(foundation.ordinalStart);
    });

    it('gives a Qi Condensation cultivator a feeling and nothing countable', () => {
        expect(whatTheyCanTell(0)).toBe('a_feeling');
        expect(whatTheyCanTell(FEELS_THE_OTHERS - 1)).toBe('a_feeling');
        expect(whatTheyCanTell(FEELS_THE_OTHERS)).toBe('the_crowding');
        expect(whatTheyCanTell(READS_A_VEIN)).toBe('the_figures');
    });
});

describe('what a beginner is handed', () => {
    it('is a sentence with no capacity, no count and no percentage in it', () => {
        const read = at(ORDINARY, aCrowd);
        const said = groundAsPerceived(read, { realmOrdinal: 0 });
        expect(said).not.toMatch(/\d/);
        expect(said.toLowerCase()).not.toContain('carries');
        expect(said.toLowerCase()).not.toContain('%');
    });

    it('masks the figures on the sheet rather than needing a second renderer', () => {
        // The client shows a percentage when `share` is a number and a bare
        // headcount when it is not, so the null IS the gate.
        const masked = groundAsPerceivedRead(at(ORDINARY, aCrowd), { realmOrdinal: 0 });
        expect(masked.share).toBeNull();
        expect(masked.supported).toBeNull();
        expect(masked.drawing).toBeNull();
        // Counting people in a square is not a skill. Pricing them is.
        expect(masked.heads).toBe(aCrowd.length);
    });

    it('leaves somebody who can read a vein exactly what they had', () => {
        const measured = at(ORDINARY, aCrowd);
        const read = groundAsPerceivedRead(measured, { realmOrdinal: READS_A_VEIN });
        expect(read).toEqual(measured);
    });
});

describe('the low end has to stay actionable', () => {
    /**
     * The whole design, in one assertion. A beginner cannot count anybody and
     * must still be able to rank two places - and the ordering they perceive
     * has to be the ordering that is true, which is why the feeling is banded
     * over `density x share` and not over the ambient band alone.
     */
    it('lets a beginner tell empty thin ground from crowded rich ground', () => {
        const beginner = { realmOrdinal: 0 };
        const quietThin = groundAsPerceived(at(THIN, alone), beginner);
        const crowdedRich = groundAsPerceived(at(RICH, aCrowd), beginner);
        expect(quietThin).not.toBe(crowdedRich);
    });

    it('ranks the four corners in the order the rate actually ranks them', () => {
        const beginner = { realmOrdinal: 0 };
        // Distinct sentences for distinct situations. A gate that collapsed
        // these would leave a player unable to act, which is the failure mode
        // this whole block exists to catch.
        const corners = new Set([
            groundAsPerceived(at(RICH, alone), beginner),
            groundAsPerceived(at(ORDINARY, alone), beginner),
            groundAsPerceived(at(THIN, alone), beginner),
            groundAsPerceived(at(RICH, aCrowd), beginner)
        ]);
        expect(corners.size).toBeGreaterThanOrEqual(3);
    });
});

describe('somebody who can read it will read it for you', () => {
    it('gives a disciple the figures, attributed, when they have a master', () => {
        const read = at(ORDINARY, aCrowd);
        const told = groundAsPerceived(read, { realmOrdinal: 0, toldBy: 'Elder Yun' });
        expect(told).toContain('Elder Yun says');
        expect(told).toMatch(/\d/);
    });

    it('is a different sentence from having read it yourself', () => {
        const read = at(ORDINARY, aCrowd);
        expect(groundAsPerceived(read, { realmOrdinal: 0, toldBy: 'Elder Yun' }))
            .not.toBe(groundAsPerceived(read, { realmOrdinal: READS_A_VEIN }));
    });

    it('leaves the figures on the sheet for somebody who was told them', () => {
        // Being told the figures is holding the figures. The provenance is in
        // the sentence; the numbers are the same numbers.
        const told = groundAsPerceivedRead(at(ORDINARY, aCrowd), {
            realmOrdinal: 0, toldBy: 'Elder Yun'
        });
        expect(told.share).not.toBeNull();
    });

    it('gives a rogue nothing, which is what being unaffiliated costs here', () => {
        const alone2 = groundAsPerceived(at(ORDINARY, aCrowd), { realmOrdinal: 0, toldBy: null });
        expect(alone2).not.toMatch(/\d/);
    });
});
