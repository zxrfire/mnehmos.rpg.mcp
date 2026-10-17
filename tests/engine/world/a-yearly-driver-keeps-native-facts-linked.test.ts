/** The 8210cf97 invariant and driver walks first reported five appointments
 * absent from their subjects' careers. Appointment and service unit controls
 * isolate the stale writes; this single ordinary year checks their composition
 * with the yearly driver, without another eighty-year setup walk. A person
 * explicitly absent from a historical mention is not a present participant. */
import { expect, it } from 'vitest';
import { missingNativeFactLinks } from '../../support/native-fact-links.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { advanceWorldForPlay } from '../../../src/engine/world/driver.js';
import { fixtureCatalog } from './fixtures.js';

it('keeps each present participant’s own fact through the native year', () => {
    const world = seedWorld({ seed: 'one-year-native-links', catalog: fixtureCatalog(), population: 40 }).state;
    advanceWorldForPlay(world, { days: 365, stopOnInterrupt: false });
    expect(missingNativeFactLinks(world)).toEqual([]);
});
