/**
 * The structure a member is told on their first day, and its edges.
 *
 * ── THE RULING ───────────────────────────────────────────────────────────
 *
 * Being enrolled means being TOLD: what the ranks are, who leads, who you
 * answer to. That is what joining an institution consists of, and it is true of
 * the newest servant on their first day.
 *
 * So this is not perception and is not built as one. `the-people-you-serve-with
 * .ts` earns names through presence - same roll AND same room - and that rule is
 * right for the people you work beside. **The head is different in kind**: you
 * know the name because it was announced, not because you were ever near them.
 *
 * ── SOURCE `told`, AND IT DOES THE WORK BY ITSELF ────────────────────────
 *
 * The best demonstration in the codebase of why the layer keeps source and stage
 * apart. `stageCeilingFor('told')` is `placed`: you know their name and that
 * they lead. You have NOT met them, cannot read them, and learn nothing further
 * by standing near them later - all of which `witnessed` would imply and none of
 * which is true. The clamp enforces that; nothing here has to remember it.
 *
 * ── THREE EDGES, AND ONLY ONE OF THEM IS A GATE ──────────────────────────
 *
 * THE PROTECTOR IS OUT, at any rung. *"you probably don't know if your sect has
 * a protector and who it is."* A house does not tell its outer disciples whether
 * somebody stands behind it, or who - discretion rather than secrecy, the same
 * discretion `THE_OFFICE` documents throughout. **Stated here rather than left
 * as an absence**, because an absence gets read as an oversight and quietly
 * widened. It is also the version of the genre beat with the most weight in it:
 * the disciple who does not know what stands behind their own sect until it
 * matters. If every member knew, a house's deepest asset would be common
 * knowledge and worth nothing to find out - and a member handed the fact has
 * learned nothing about their house, where somebody who discovers it has.
 *
 * GUESTS ARE OUT, and that edge costs nothing to enforce: *"you're only told who
 * is ON THE LADDER"*. Measured - every one of the catalog's members carries a
 * `rankIndex`, and a guest is not in the roster at all; `GUEST_ELDERS` is a
 * separate table. So a caller passing the house's roll cannot pass a guest by
 * accident, and Lu Sheng, "Guest of the Court", is off this by construction
 * rather than by a filter somebody has to remember.
 *
 * AND THE BOTTOM OF THE LADDER IS NOT A GATE. *"you also wouldn't know or care
 * to know the names of all the guest disciples and servants."* Nobody is
 * withholding a herb boy's name; it simply was not part of what anybody recited
 * to you, and you would not have asked. That is why this grants the TOP of the
 * ladder rather than filtering the bottom out of a roster dump - the shape of
 * the grant is the point, not a rule about servants.
 *
 * ── WHERE IT THINS OUT, AND WHY THERE ─────────────────────────────────────
 *
 * THE TOP TWO OCCUPIED RUNGS. A DECISION, pinned by a test rather than left as
 * a number - and OCCUPIED is the load-bearing word.
 *
 * Every house in the catalog runs five or six ranks and the shape is the same
 * throughout: a menial rung at the bottom (Sword Servant, Herb Boy, Boat Hand,
 * Lamp Novice, Copyist), bands of disciples through the middle, and at the top
 * an elder rung and a single office - Sword Elder and Pavilion Master, Life
 * Elder and Hall Sovereign, Quiet Elder and Abbot. The top rung is the office;
 * the one below it is the body that office is drawn from and the people a member
 * actually answers to. Those are the two anybody is named on arrival.
 *
 * Counting DOWN FROM THE ARRAY was tried first and is wrong, and the catalog
 * proved it within the hour: the Pavilion's ladder grew from six rungs to seven
 * while this was being written, a `Grand Sword Elder` was inserted below
 * `Pavilion Master`, and the top two INDICES stopped covering the three Sword
 * Elders that "the head and the seniors" plainly means. A grant that changes who
 * it names because somebody added a rank title is measuring the array.
 *
 * Occupied rungs do not move like that. It also handles a vacant office for
 * free: a house whose top rank nobody holds is led by whoever is actually at the
 * top of it, and the second rung down is still the seniors rather than being
 * eaten by an empty title.
 *
 * A holder-count derivation was tried and rejected too: the catalog carries one
 * to three members per rank because it is a SAMPLE of each house rather than its
 * roster, so counting holders would have measured the catalog's sampling and not
 * the world - the aggregate-measures-the-seeder trap.
 *
 * PURE. Rows in, a reading out. No I/O, no RNG, no mutation.
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
 * How far down the ladder the introduction reaches, in OCCUPIED rungs.
 *
 * Two: the office and the rung below it - the head, and the seniors that office
 * is drawn from. See the header for why there, and for the two derivations that
 * were tried and are wrong.
 */
export const RUNGS_A_NEW_MEMBER_IS_TOLD = 2;

/**
 * Who a member is told about when they join, top of the ladder first.
 *
 * A house whose roster is empty tells them nobody, which is a real state - two
 * of the catalog's houses have no members at all.
 */
export function whatJoiningTellsYou(
    roll: readonly SomebodyOnTheLadder[],
    ranks: readonly string[]
): SomebodyYouWereToldAbout[] {
    if (ranks.length === 0) return [];

    // The rungs somebody actually stands on, highest first. Empty offices are
    // not counted against the allowance: a house whose top rank is vacant still
    // introduces its seniors.
    const occupied = [...new Set(
        roll.filter(person => ranks[person.rankIndex] !== undefined).map(person => person.rankIndex)
    )].sort((a, b) => b - a);
    if (occupied.length === 0) return [];
    const floor = occupied[Math.min(RUNGS_A_NEW_MEMBER_IS_TOLD, occupied.length) - 1]!;

    const told = roll
        .filter(person => person.rankIndex >= floor && ranks[person.rankIndex] !== undefined)
        // Top first, then by rung, then by id - so a house answers the same way
        // twice rather than depending on roster order.
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
        // The top rung as the roster actually fills it, rather than the last
        // index in `ranks`: a house whose highest office is vacant is led by
        // whoever is actually at the top of it, and saying otherwise would name
        // somebody who is not there.
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
