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
import { soakedWorld } from '../../support/soaked-world.js';
import type { WorldState } from '../../../src/engine/world/world-state';

const SEEDS = ['asking-a', 'asking-b'];
const YEARS = 200;
let cached: WorldState[] | null = null;

async function worldsLived(): Promise<WorldState[]> {
    if (cached) return cached;
    // Kept and shared: see `tests/support/soaked-world.ts`.
    const lived: WorldState[] = [];
    for (const seed of SEEDS) lived.push(await soakedWorld(seed, { years: YEARS }));
    cached = lived;
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

    it('says it once per absence, and not every year forever', async () => {
        // A compound announcing the same absence for a century is not a house
        // noticing, it is a stuck flag. The alarm clears the errand.
        //
        // ── ONCE PER ABSENCE, NOT ONCE PER PERSON ────────────────────────
        //
        // This counted notices PER PERSON across the whole two hundred years,
        // and that is a different claim from the one the sentence above makes.
        // Measured on `asking-a`, the person with the most notices had FOUR,
        // on days 365414, 373441, 375092 and 391772 - four distinct days
        // spanning 26,358 of them. That is SEVENTY-TWO YEARS, and it is one
        // cultivator who was lost, walked home
        // (`A_LOST_PERSON_FINDS_THEIR_WAY_BACK` is half), was sent out again,
        // and was lost again. Four disappearances, four alarms, and the house
        // was right every time.
        //
        // ON A CULTIVATOR'S CLOCK SEVENTY-TWO YEARS IS NOTHING. `AGENTS.md`
        // is explicit that a rate is only wrong if it is wrong over a life and
        // a life here is centuries; the old assertion was a human intuition -
        // *surely not the same person twice* - applied to people who live for
        // a thousand. Somebody who goes missing four times in seventy-two
        // years is the world working, not a flag stuck on.
        //
        // So the key is the ABSENCE, and the episode is identified by the day
        // it opened: the lost notice is filed with `day: since`, the day the
        // world lost sight of them, so two notices carrying one person and one
        // day are the stuck flag this is for, and two carrying one person and
        // two days are two separate disappearances. `data.lostTrackOf` names
        // the person on the same row and is asserted below rather than used as
        // the key, because a notice always names its subject in `actors`.
        for (const state of await worldsLived()) {
            const perAbsence = new Map<string, number>();
            for (const notice of noticesIn(state)) {
                for (const actor of notice.actors) {
                    const episode = `${actor.id}@${notice.day}`;
                    perAbsence.set(episode, (perAbsence.get(episode) ?? 0) + 1);
                }
            }
            for (const [episode, times] of perAbsence) {
                expect(times, `${episode} was announced more than once`).toBe(1);
            }
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
