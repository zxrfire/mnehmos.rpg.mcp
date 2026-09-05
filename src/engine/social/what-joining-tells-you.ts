/**
 * The structure a member is told on their first day, and its edges. Being enrolled
 * means being TOLD, so this is not perception: source `told` clamps to stage
 * `placed`, a name and an office and never a face, and the clamp enforces that
 * without this file having to remember it.
 */

/** One member of a house, reduced to what this rule reads. */
export interface SomebodyOnTheLadder {
    id: string;
    name: string;
    /** Index into the house's `ranks`. The office, and the authority here. */
    rankIndex: number;
    realmOrdinal: number;
}

export interface SomebodyYouWereToldAbout {
    id: string;
    name: string;
    /** Their office, off `ranks[rankIndex]`, so the title is never composed. */
    title: string;
    rankIndex: number;
    /** True for the one at the top. The head is the fact everybody has. */
    leadsTheHouse: boolean;
}

/**
 * How far down the ladder the introduction reaches, in OCCUPIED rungs. See the
 * header for why two, and for the two derivations that were tried and are wrong.
 */
export const RUNGS_A_NEW_MEMBER_IS_TOLD = 2;

/**
 * Who a member is told about when they join, top of the ladder first. An empty
 * roster tells them nobody, which is a real state: two catalog houses have no
 * members at all.
 */
export function whatJoiningTellsYou(
    roll: readonly SomebodyOnTheLadder[],
    ranks: readonly string[]
): SomebodyYouWereToldAbout[] {
    if (ranks.length === 0) return [];

    // Empty offices are not counted against the allowance: a house whose top
    // rank is vacant still introduces its seniors.
    const occupied = [...new Set(
        roll.filter(person => ranks[person.rankIndex] !== undefined).map(person => person.rankIndex)
    )].sort((a, b) => b - a);
    if (occupied.length === 0) return [];
    const floor = occupied[Math.min(RUNGS_A_NEW_MEMBER_IS_TOLD, occupied.length) - 1]!;

    const told = roll
        .filter(person => person.rankIndex >= floor && ranks[person.rankIndex] !== undefined)
        // By id last, so a house answers the same way twice rather than
        // depending on roster order.
        .sort((a, b) =>
            b.rankIndex - a.rankIndex
            || b.realmOrdinal - a.realmOrdinal
            || (a.id < b.id ? -1 : 1));

    const top = told[0]?.rankIndex ?? -1;
    return told.map(person => ({
        id: person.id,
        name: person.name,
        title: ranks[person.rankIndex]!,
        rankIndex: person.rankIndex,
        // The top rung as the roster fills it, not the last index in `ranks`:
        // a vacant highest office would otherwise name somebody who is not there.
        leadsTheHouse: person.rankIndex === top
    }));
}

/** What the knowledge row says, in the words a member would have been given. */
export function howBeingToldPutIt(
    houseName: string,
    person: SomebodyYouWereToldAbout
): string {
    return person.leadsTheHouse
        ? `${person.name} is ${person.title} of ${houseName} and leads it. You were told when `
          + 'you joined; you have not met them.'
        : `${person.name} is ${person.title} of ${houseName}. You were told when you joined; `
          + 'you have not met them.';
}
