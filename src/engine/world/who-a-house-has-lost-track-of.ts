/**
 * Who a house has lost track of: what a house does not know about one of its own.
 *
 * The design owner: *"they still die of old age unless they advance, and they
 * still die or reappear and can be found dead. Missing people are still somewhere
 * physical, just the sect doesn't know."* So missing is not a state of the person.
 * Somebody the world loses sight of is a living person standing somewhere real,
 * ageing, climbing, dying and walking like anybody; what changed is what their
 * house knows, and that is held on the house.
 *
 * ── TWO MARKS, EACH WHERE IT BELONGS ─────────────────────────────────────
 *
 *   lost sight of   on the person, for one slice at most: a world pass lost
 *                   them (`theWorldLoses`) and has no world in hand to say what
 *                   their house now knows. The absence pass reads it the same
 *                   slice, writes the house's mark and clears this one
 *                   (`whatHousesLearnOfTheirOwn` in
 *                   `when-somebody-does-not-come-back.ts`)
 *   lost track of   on the house: this person is one of ours, and we do not know
 *                   where they are. Their lamp still burns. It comes off when the
 *                   lamp goes out, or when they are back in front of the house
 *
 * This file only reads and writes the two marks. It imports nothing that holds
 * a person, so anything that answers "is this somebody their house has lost?"
 * can ask it.
 */

import type { FactionRecord, WorldState } from './world-state.js';

/** On a person: a world pass has lost sight of them this slice. */
export const THE_WORLD_LOST_SIGHT_OF = 'lost-sight-of|';

/** On a house: one of its own it does not know the whereabouts of. */
export const THE_HOUSE_LOST_TRACK_OF = 'lost-track-of|';

/** The mark a world pass leaves on somebody it has lost sight of. */
export function lostSightOnDay(onDay: number): string {
    return `${THE_WORLD_LOST_SIGHT_OF}${Math.floor(onDay)}`;
}

/** The day a world pass lost sight of this person, or null. */
export function whenTheWorldLostSightOf(person: { tags: readonly string[] }): number | null {
    const tag = person.tags.find(t => t.startsWith(THE_WORLD_LOST_SIGHT_OF));
    if (!tag) return null;
    const day = Number(tag.slice(THE_WORLD_LOST_SIGHT_OF.length));
    return Number.isFinite(day) ? day : null;
}

/** One person a house has lost track of, and since when. */
export interface SomebodyLostTrackOf {
    personId: string;
    sinceDay: number;
}

function fromTag(tag: string): SomebodyLostTrackOf | null {
    if (!tag.startsWith(THE_HOUSE_LOST_TRACK_OF)) return null;
    const [personId, since] = tag.slice(THE_HOUSE_LOST_TRACK_OF.length).split('|');
    const sinceDay = Number(since);
    if (!personId || !Number.isFinite(sinceDay)) return null;
    return { personId, sinceDay };
}

/** Everybody a house has lost track of. */
export function whoTheHouseHasLostTrackOf(house: Pick<FactionRecord, 'tags'>): SomebodyLostTrackOf[] {
    return house.tags.map(fromTag).filter((x): x is SomebodyLostTrackOf => x !== null);
}

/** Since when this house has not known where this person is, or null where it does. */
export function whenTheHouseLostTrackOf(house: Pick<FactionRecord, 'tags'>, personId: string): number | null {
    // The first of this person's own tags that reads, as `fromTag` reads it -
    // without parsing every tag the house carries, which this did for every
    // person the world asked about, against every house.
    if (!personId) return null;
    const theirs = `${THE_HOUSE_LOST_TRACK_OF}${personId}|`;
    for (const tag of house.tags) {
        if (!tag.startsWith(theirs)) continue;
        const sinceDay = Number(tag.slice(theirs.length).split('|')[0]);
        if (Number.isFinite(sinceDay)) return sinceDay;
    }
    return null;
}

/** The house, having lost track of somebody. The earlier day stands where it already had. */
export function theHouseLosesTrackOf<H extends Pick<FactionRecord, 'tags'>>(house: H, personId: string, onDay: number): H {
    if (whenTheHouseLostTrackOf(house, personId) !== null) return house;
    return { ...house, tags: [...house.tags, `${THE_HOUSE_LOST_TRACK_OF}${personId}|${Math.floor(onDay)}`] };
}

/** The house, knowing again what became of somebody. */
export function theHouseKnowsAgain<H extends Pick<FactionRecord, 'tags'>>(house: H, personId: string): H {
    return { ...house, tags: house.tags.filter(t => fromTag(t)?.personId !== personId) };
}

/**
 * Since when anybody has lost track of this person: the world a pass ago, or a
 * house that holds them lost. Null where nobody has. The one read every "missing"
 * question asks.
 */
export function whenTheyWereLastAccountedFor(
    state: Pick<WorldState, 'factions'>,
    person: { id: string; tags: readonly string[] }
): number | null {
    const pending = whenTheWorldLostSightOf(person);
    let earliest: number | null = pending;
    for (const house of state.factions) {
        const since = whenTheHouseLostTrackOf(house, person.id);
        if (since !== null && (earliest === null || since < earliest)) earliest = since;
    }
    return earliest;
}

/** Whether anybody has lost track of this person. */
export function isLostTrackOf(
    state: Pick<WorldState, 'factions'>,
    person: { id: string; tags: readonly string[] }
): boolean {
    return whenTheyWereLastAccountedFor(state, person) !== null;
}
