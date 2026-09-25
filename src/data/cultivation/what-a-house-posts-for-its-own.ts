/**
 * Missions: the standing work a house posts on its own board for its own
 * people, each at a rate by the month of the term.
 *
 * A disciple is sent on a mission; a rogue takes a contract (`CONTRACTS` in
 * `rogues.ts`). Neither is a profession. A house's missions hang on a board
 * inside its seat: whoever stands at it reads it, and only the house's own take
 * from it. See `web/the-mission-board-inside-a-house.ts`.
 *
 * EACH IS POSTED TO A RUNG. Outer disciples get chores and errands of days to
 * months; the rungs above get posts of years, and the elders the long standing
 * ones. A rung takes its own missions and every rung's below it. Tasks that
 * exist at two rungs are two rows with two different jobs, not one row with a
 * scaled number. Outer chores are served in one span; everything above is held
 * as a post until its day (`web/holding-a-mission-post.ts`).
 *
 * WHICH HOUSE POSTS WHICH is the sending reasons' own column. `needs` is a
 * `ReasonNeed` and is read by the same `NEED_PREDICATES`, so a house holding no
 * ground posts no vein warden and a house standing over nothing sealed posts no
 * sigil inspection. And a house only posts what somebody on its roll could do:
 * `minOrdinal` against the house's reach, which is the owner's rule that a sect
 * offers only work it has disciples able to reach.
 *
 * No arithmetic here. What a term pays is `dutyTermsAtAMonthlyRate` in
 * `engine/encounters/duties.ts`, off the rate below.
 */

import { z } from 'zod';

import { OccupationSchema } from './mortal-world.js';
import { ReasonNeedSchema } from './why-a-house-puts-a-party-on-the-road.js';

/**
 * The band of a house's ladder a mission is posted to. Which rung of a given
 * ladder is which band is `theBandOfARung`.
 */
export const MissionRungSchema = z.enum(['outer', 'inner', 'core', 'elder']);
export type MissionRung = z.infer<typeof MissionRungSchema>;

/** Lowest first. */
export const MISSION_RUNGS: readonly MissionRung[] = MissionRungSchema.options;

export const HouseMissionSchema = z.object({
    id: z.string(),
    /** What a player calls it. Contained, word for word, in `task`. */
    said: z.string().min(4),
    /**
     * The task as the board words it. Slots: `{house}`, `{place}`, `{realm}`,
     * and `{term}`, which is always `days`. See `aTaskAsPosted`.
     */
    task: z.string().min(1),
    rung: MissionRungSchema,
    /** The realm needed to do the work. */
    minOrdinal: OccupationSchema.shape.minOrdinal,
    /** The rate, in cash per month of the term, paid in stones on completion. */
    cashPerMonth: OccupationSchema.shape.cashPerMonth,
    /** The term. */
    days: z.number().int().min(1),
    /** Where the work is done: the house's seat, or ground it holds. */
    at: z.enum(['the_seat', 'its_ground']),
    /** The first ordinal of the realm a `{realm}` slot names. */
    realmCrossedInto: z.number().int().min(0).optional(),
    settlements: OccupationSchema.shape.settlements,
    risk: OccupationSchema.shape.risk,
    /** What the house must already have to post it. */
    needs: ReasonNeedSchema,
    note: z.string().min(40)
});
export type HouseMission = z.infer<typeof HouseMissionSchema>;

const YEAR = 365;

export const HOUSE_MISSIONS: readonly HouseMission[] = [
    // OUTER: chores and errands, days to months.
    { id: 'mission-outer-chores', said: 'chores', task: 'Do chores for {house} at {place} for the next {term}', rung: 'outer', minOrdinal: 1, cashPerMonth: 400, days: 30, at: 'the_seat', settlements: ['sect_town'], risk: 'low', needs: 'nothing', note: 'A stipend rather than a wage, plus access to sect ground - which is worth more than the stipend and is why anyone accepts it.' },
    // The owner: running the refectory is an outer-disciple posting, and a bowl there is "1 spirit
    // stone (goes into sect treasury)".
    { id: 'mission-refectory', said: 'refectory duty', task: 'Take refectory duty at {place} for {house} for the next {term}', rung: 'outer', minOrdinal: 1, cashPerMonth: 450, days: 30, at: 'the_seat', settlements: ['sect_town'], risk: 'low', needs: 'nothing', note: 'Cooking for the house and taking a stone a bowl off everybody who eats, which goes into the treasury and not to the cook.' },
    { id: 'mission-messages', said: 'messages', task: 'Carry messages for {house} from {place} to the towns below it for the next {term}', rung: 'outer', minOrdinal: 2, cashPerMonth: 600, days: 30, at: 'the_seat', settlements: ['sect_town', 'city'], risk: 'low', needs: 'nothing', note: 'Letters, tallies and summonses down to the towns the house deals with, and their answers back up. Walking, mostly, and the first thing an outer disciple is trusted with outside the gate.' },
    { id: 'mission-lamp-watch', said: 'lamp watch', task: 'Stand the lamp watch at {place} for {house} for the next {term}', rung: 'outer', minOrdinal: 4, cashPerMonth: 700, days: 60, at: 'the_seat', settlements: ['sect_town', 'city'], risk: 'low', needs: 'nothing', note: 'Walking the house\'s halls and yards through the night in turns with a lamp, and sending word up about anything that is where it should not be.' },
    // INNER: posts of months to years.
    { id: 'mission-pass-watch', said: 'pass watch', task: 'Keep the pass watch below {place} for {house} for the next {term}', rung: 'inner', minOrdinal: 6, cashPerMonth: 1_500, days: 5 * YEAR, at: 'the_seat', settlements: ['sect_town', 'city'], risk: 'moderate', needs: 'nothing', note: 'Holding the road up to the house: who comes up it, what they carry, and whether the house hears of them before they reach the gate.' },
    { id: 'mission-vein-warden', said: 'vein warding', task: 'Keep the vein warding at {place} for {house} for the next {term}', rung: 'inner', minOrdinal: 21, cashPerMonth: 12_000, days: 3 * YEAR, at: 'its_ground', settlements: ['sect_town', 'city'], risk: 'moderate', needs: 'ground', note: 'Sitting on the house\'s vein so that nothing else draws on it. The pay is nominal; what the house is actually giving is the right to cultivate on the ground being guarded.' },
    // CORE: posts of years to decades, where the ladder has a core rung.
    { id: 'mission-spirit-paddies', said: 'spirit paddies', task: 'Keep the spirit paddies at {place} for {house} for the next {term}', rung: 'core', minOrdinal: 10, cashPerMonth: 2_500, days: 10 * YEAR, at: 'the_seat', settlements: ['sect_town', 'city'], risk: 'low', needs: 'nothing', note: 'The house\'s planted ground: what is sown, what is ready, and what is taken off it and by whom. Slow work, and whoever keeps it knows the house\'s stores better than its treasurer.' },
    { id: 'mission-convoy-escort', said: 'convoy', task: 'Escort the pill convoy out of {place} for {house} for the next {term}', rung: 'core', minOrdinal: 23, cashPerMonth: 20_000, days: 10 * YEAR, at: 'the_seat', settlements: ['market_town', 'sect_town', 'city'], risk: 'high', needs: 'nothing', note: 'Finished heaven-grade medicine moves a few times a year - the Cinnabar Crucible Sect moves it four - and nobody moves it without somebody who can survive being ambushed by the people who want it.' },
    { id: 'mission-tide-breaker', said: 'surge watch', task: 'Hold the surge watch over the settlements under {place} for {house} for the next {term}', rung: 'core', minOrdinal: 25, cashPerMonth: 45_000, days: 20 * YEAR, at: 'its_ground', settlements: ['village', 'market_town', 'sect_town'], risk: 'lethal', needs: 'ground', note: 'Beast tides come at the settlements under the house\'s ground, and the house keeps somebody there who can meet one. Paid on the count of what is standing afterwards, which is a payment structure with an obvious defect.' },
    { id: 'mission-formation-keeper', said: 'grand formation', task: 'Hold the grand formation at {place} steady for {house} for the next {term}', rung: 'core', minOrdinal: 27, cashPerMonth: 60_000, days: 30 * YEAR, at: 'the_seat', settlements: ['sect_town', 'city'], risk: 'low', needs: 'nothing', note: 'Holding a great formation steady across the years. Dull, safe, extremely well paid, and the standard way a house finds out what one of its own actually knows.' },
    // ELDER: the long standing posts.
    { id: 'mission-scripture-pavilion', said: 'scripture keeping', task: 'Do the scripture keeping in the pavilion at {place} for {house} for the next {term}', rung: 'elder', minOrdinal: 13, cashPerMonth: 3_000, days: 50 * YEAR, at: 'the_seat', settlements: ['sect_town', 'city'], risk: 'none', needs: 'nothing', note: 'Who may read what, and who has been reading what they may not. The keeper is the one person in the house who knows what every disciple has been studying.' },
    { id: 'mission-dao-protector', said: 'dao protector', task: 'Act as dao protector for the outer disciples of {house} crossing into {realm} at {place} for the next {term}', rung: 'elder', minOrdinal: 17, cashPerMonth: 8_000, days: 100 * YEAR, at: 'the_seat', realmCrossedInto: 13, settlements: ['sect_town'], risk: 'high', needs: 'nothing', note: 'Standing off each crossing so nothing interferes with it, and being close enough to it that a bad crossing takes the watcher with it. A house pays this without haggling.' },
    { id: 'mission-seal-inspection', said: 'sigil inspection', task: 'Make the sigil inspection of the seal {house} keeps at {place} for the next {term}', rung: 'elder', minOrdinal: 35, cashPerMonth: 700_000, days: 50 * YEAR, at: 'its_ground', settlements: ['sect_town', 'city'], risk: 'lethal', needs: 'a_containment', note: 'Going down to a seal that has held for two ages and reporting whether it still does. The pay is large because the reporting half is not reliably included.' },
    { id: 'mission-sky-survey', said: 'sky survey', task: 'Walk the sky survey over the province around {place} for {house} for the next {term}', rung: 'elder', minOrdinal: 39, cashPerMonth: 2_000_000, days: 20 * YEAR, at: 'the_seat', settlements: ['city'], risk: 'moderate', needs: 'nothing', note: 'Walking the upper air over a region and saying what is up there. Almost nobody can go and look, so almost nobody can check the answer, which is priced in.' }
];

const MISSION_BY_ID: ReadonlyMap<string, HouseMission> = new Map(HOUSE_MISSIONS.map(m => [m.id, m]));

export function getHouseMission(id: string): HouseMission | undefined {
    return MISSION_BY_ID.get(id);
}
