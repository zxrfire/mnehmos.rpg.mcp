/**
 * Missions: the standing work a house posts on its own board for its own
 * people, each at a rate by the month of the term.
 *
 * A disciple is sent on a mission; a rogue takes a contract (`CONTRACTS` in
 * `rogues.ts`). Neither is a profession, and a house's mission is not paper a
 * stranger may take down: somebody off the roll reads it and is told it is
 * posted to the house's own, which is the refusal every house posting already
 * gives.
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

export const HouseMissionSchema = z.object({
    id: z.string(),
    /** What the board calls it. */
    name: z.string().min(1),
    /** The rung the work is pitched at. */
    minOrdinal: OccupationSchema.shape.minOrdinal,
    /** The rate, in cash per month of the term, paid in stones on completion. */
    cashPerMonth: OccupationSchema.shape.cashPerMonth,
    /** Days a sending on it runs. A term, not a computation. */
    days: z.number().int().min(1),
    /** Where the work is done. */
    settlements: OccupationSchema.shape.settlements,
    risk: OccupationSchema.shape.risk,
    /** What the house must already have to post it. */
    needs: ReasonNeedSchema,
    note: z.string().min(40)
});
export type HouseMission = z.infer<typeof HouseMissionSchema>;

export const HOUSE_MISSIONS: readonly HouseMission[] = [
    { id: 'mission-outer-chores', name: 'Outer disciple chores', minOrdinal: 1, cashPerMonth: 400, days: 30, settlements: ['sect_town'], risk: 'low', needs: 'nothing', note: 'A stipend rather than a wage, plus access to sect ground - which is worth more than the stipend and is why anyone accepts it.' },
    { id: 'mission-vein-warden', name: 'Vein warding', minOrdinal: 21, cashPerMonth: 12_000, days: 90, settlements: ['sect_town', 'city'], risk: 'moderate', needs: 'ground', note: 'Sitting on the house\'s vein so that nothing else draws on it. The pay is nominal; what the house is actually giving is the right to cultivate on the ground being guarded.' },
    { id: 'mission-convoy-escort', name: 'Pill convoy escort', minOrdinal: 23, cashPerMonth: 20_000, days: 30, settlements: ['market_town', 'sect_town', 'city'], risk: 'high', needs: 'nothing', note: 'Finished heaven-grade medicine moves a few times a year - the Cinnabar Crucible Sect moves it four - and nobody moves it without somebody who can survive being ambushed by the people who want it.' },
    { id: 'mission-tide-breaker', name: 'Surge quelling', minOrdinal: 25, cashPerMonth: 45_000, days: 25, settlements: ['village', 'market_town', 'sect_town'], risk: 'lethal', needs: 'ground', note: 'A beast tide is coming at the settlements under the house\'s ground, and the house sends what it has. Paid on the count of what is standing afterwards, which is a payment structure with an obvious defect.' },
    { id: 'mission-formation-keeper', name: 'Formation keeping', minOrdinal: 27, cashPerMonth: 60_000, days: 90, settlements: ['sect_town', 'city'], risk: 'low', needs: 'nothing', note: 'Holding a great formation steady across a season. Dull, safe, extremely well paid, and the standard way a house finds out what one of its own actually knows.' },
    { id: 'mission-tribulation-watch', name: 'Tribulation watch', minOrdinal: 33, cashPerMonth: 400_000, days: 12, settlements: ['sect_town'], risk: 'high', needs: 'nothing', note: 'Standing off a crossing so nothing interferes with it, and being close enough to the lightning that a bad crossing takes the watcher with it. A house pays this without haggling.' },
    { id: 'mission-seal-inspection', name: 'Sigil inspection', minOrdinal: 35, cashPerMonth: 700_000, days: 20, settlements: ['sect_town', 'city'], risk: 'lethal', needs: 'a_containment', note: 'Going down to a seal that has held for two ages and reporting whether it still does. The pay is large because the reporting half is not reliably included.' },
    { id: 'mission-sky-survey', name: 'Sky survey', minOrdinal: 39, cashPerMonth: 2_000_000, days: 60, settlements: ['city'], risk: 'moderate', needs: 'nothing', note: 'Walking the upper air over a region and saying what is up there. Almost nobody can go and look, so almost nobody can check the answer, which is priced in.' }
];

const MISSION_BY_ID: ReadonlyMap<string, HouseMission> = new Map(HOUSE_MISSIONS.map(m => [m.id, m]));

export function getHouseMission(id: string): HouseMission | undefined {
    return MISSION_BY_ID.get(id);
}
