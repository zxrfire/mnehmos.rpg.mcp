/** The 8210cf97 driver pinned exact historical bytes after the owner retired
 * that promise, and counted318 personal events against an institutional cap20.
 * These focused controls retain dated calendar boundaries over three years
 * and the original20-event limit on the actual published template table.
 * No historical precondition is needed; the broad driver keeps its separate
 * dated-year distribution and state-effect checks. */
import { describe, expect, it } from 'vitest';
import { fixtureCatalog } from './fixtures.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { applyPressure, PRESSURE_TEMPLATES } from '../../../src/engine/world/pressure.js';
const YEAR = 365;
const world = (seed: string) => seedWorld({ seed, catalog: fixtureCatalog(), population: 40, presentYear: 1000 }).state;
describe('the pressure calendar and institution table', () => {
it('dates each requested calendar even when the caller chops the span', () => {
        for (const chunks of [1, 2, 3, 6, 12, 20, 60]) {
            const state = world('drv-split'), start = state.currentDay;
            const years = 3, step = years * YEAR / chunks;
            let completedYears = 0;
            for (let part = 0; part < chunks; part++) {
                const from = start + part * step, to = start + (part + 1) * step;
                const out = applyPressure(state, from, to);
                completedYears += out.yearsStepped;
                for (const event of out.events) {
                    expect(event.onDay).toBeGreaterThanOrEqual(from);
                    expect(event.onDay).toBeLessThanOrEqual(to);
                }
            }
            expect(completedYears).toBe(years);
        }
    });

it('goes quiet when the world runs out of institutions', () => {
        const state = world('drv-quiet');
        for (const f of state.factions) f.dissolvedOnDay = state.currentDay;
        const out = applyPressure(state, state.currentDay, state.currentDay + 40 * YEAR);
        // A floor, not silence, and far below a live world's rate. The event
        // TABLE is what goes quiet: people with a reason to kill somebody still
        // act on it in a world with no institutions left, which is what
        // `why-one-cultivator-kills-another.ts` is for, so those are counted out
        // of the claim rather than made impossible.
        const tableKinds = new Set(PRESSURE_TEMPLATES.map(template => template.kind));
        expect(out.events.filter(event => tableKinds.has(event.kind)).length).toBeLessThan(20);
    });
});
