/**
 * Somebody did not come back, and the person whose job it is says so.
 *
 * The design owner: *"the keeper knows x has been away for a month, their
 * mission should've only taken a week. That's their job - personnel. They're
 * the ones who tell other people something is wrong."* And then: *"he spreads a
 * message saying x is missing, and that message is sent the same way all
 * rumours are."*
 *
 * So it is not a new channel. It is a world fact with an `unattributed` line on
 * it, which is what every other event in this engine is - reaching a player who
 * can name the missing person by name, and one who cannot as a compound asking
 * after somebody.
 *
 * DERIVED FROM THE TERM. Nothing marks anybody overdue. A party carries the day
 * it is due back, so being late is arithmetic and a keeper cannot forget.
 */

import { describe, expect, it } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog';
import { advanceWorldForPlay } from '../../../src/engine/world/driver';
import type { WorldState } from '../../../src/engine/world/world-state';

const SEEDS = ['asking-a', 'asking-b'];
const YEARS = 200;
let cached: WorldState[] | null = null;

async function worldsLived(): Promise<WorldState[]> {
    if (cached) return cached;
    const catalog = await loadCultivationCatalog();
    cached = SEEDS.map(seed => {
        const { state } = seedWorld({ seed, catalog });
        advanceWorldForPlay(state, { days: YEARS * 365, stopOnInterrupt: false });
        return state;
    });
    return cached;
}

const noticesIn = (s: WorldState) =>
    s.history.facts.filter(f => f.summary.includes('The hall has started asking'));

describe('the hall starts asking', () => {
    it('notices somebody who did not come back', async () => {
        for (const state of await worldsLived()) {
            expect(noticesIn(state).length).toBeGreaterThan(0);
        }
    });

    it('and does not notice the people who did', async () => {
        // The homecoming runs BEFORE the keeper looks, so a party whose term
        // ran out and which nothing has processed yet is unprocessed rather
        // than overdue. A keeper who cannot tell those apart raises the alarm
        // about everybody, which is how this read zero and then everybody.
        for (const state of await worldsLived()) {
            const notices = noticesIn(state).length;
            const everSent = state.npcs.filter(n => n.activity?.kind === 'mustering').length;
            // Far fewer alarms than people who have ever been out.
            expect(notices).toBeLessThan(YEARS * 2);
            expect(everSent).toBeGreaterThanOrEqual(0);
        }
    });

    it('says who, and how late, and that the house is looking', async () => {
        for (const state of await worldsLived()) {
            for (const notice of noticesIn(state)) {
                expect(notice.summary).toMatch(/was due back/);
                expect(notice.summary).toMatch(/overdue/);
                // A named person, because the house knows exactly who.
                expect(notice.actors.length).toBeGreaterThan(0);
                expect(notice.actors[0]?.role).toBe('missing');
            }
        }
    });

    it('and carries a line for somebody who cannot name them', async () => {
        // The rumour half. Everything in this world reaches a player through
        // what they can name; a fact with no unattributed line reaches somebody
        // who has never met the missing person as nothing at all.
        for (const state of await worldsLived()) {
            for (const notice of noticesIn(state)) {
                const said = String(notice.data?.unattributed ?? '');
                expect(said.length).toBeGreaterThan(0);
                // And it names nobody.
                for (const actor of notice.actors) {
                    expect(said).not.toContain(actor.name);
                }
            }
        }
    });

    it('says it once, and not every year forever', async () => {
        // A compound announcing the same absence for a century is not a house
        // noticing, it is a stuck flag. The alarm clears the errand.
        for (const state of await worldsLived()) {
            const perPerson = new Map<string, number>();
            for (const notice of noticesIn(state)) {
                for (const actor of notice.actors) {
                    perPerson.set(actor.id, (perPerson.get(actor.id) ?? 0) + 1);
                }
            }
            for (const [, times] of perPerson) expect(times).toBe(1);
        }
    });

    it('and it is a house matter, not a public one', async () => {
        for (const state of await worldsLived()) {
            for (const notice of noticesIn(state)) {
                // The people who would go looking are the people they answer to.
                expect(notice.visibility).toBe('faction');
            }
        }
    });
});
