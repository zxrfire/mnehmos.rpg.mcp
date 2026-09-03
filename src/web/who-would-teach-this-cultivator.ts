/**
 * WHO STANDS ABOVE THIS CULTIVATOR AND WOULD SAY SOMETHING USEFUL.
 *
 * Progress is designed to slow without a master and stop without a book, so
 * finding people is a core verb - and it was the worst-served question in the
 * game. Measured over the real endpoint by `scripts/playtest-the-drive.mjs`:
 * five plain phrasings of "who can teach me", none answered, and three of the
 * five DEFLECTED, which is the worse failure. "who could guide my cultivation"
 * returned the character sheet. "I look for a master" returned the room
 * description. Both are good answers to some other question and neither says
 * one word about a teacher, so the game appeared to understand and answered
 * nothing.
 *
 * ── EVERY LINE IS A ROW ──────────────────────────────────────────────────
 *
 * Nothing here decides who is a teacher. `members.ts` already carries the
 * answer on every person in the catalog:
 *
 *   `role: 'master'`   what they are TO A PLAYER - "somebody who will teach,
 *                      inside stated limits". The author's word, not a
 *                      threshold this module invented.
 *   `teaching`         the three limits from `asking.md`, and all three apply
 *                      at once: what they genuinely hold (`knows`), what they
 *                      may not say and on whose authority (`mayNotSay`), and
 *                      what a straight answer costs them (`costsThem`).
 *                      Keeping the three separate is what stops a master
 *                      becoming an oracle, so they are never merged here.
 *   `realmOrdinal`     where they stand, against where the player stands.
 *
 * The only arithmetic in this file is subtracting two ordinals to say how many
 * rungs apart two people are.
 *
 * ── THE DISCOVERY CONSTRAINT, WHICH IS THE HARD PART ─────────────────────
 *
 * `docs/world/houses/discovery.md` is emphatic that the game must never name somebody
 * the player has not heard of, and a read like this one is exactly where that
 * rule gets broken by accident: the honest implementation walks a roster and
 * prints it, and a player who has just joined a house is handed a cast list
 * they did not earn.
 *
 * So every person is gated on `isAwareOf`, the same predicate `company()` uses
 * for faces in a room, and the gate is applied per person rather than to the
 * whole answer. That matters, because the shape of what is hidden is itself
 * information the player is entitled to:
 *
 *   NAMED       they hold a record. Say the name, the rank, the gap, and the
 *               three limits on what that person will say.
 *   UNNAMED     they are on the same roll and the player has never met them.
 *               Say that there are two of them and how far above they stand.
 *               A count and an altitude are not an introduction, and a player
 *               who knows their house contains somebody four rungs up has been
 *               told something true and given a reason to go and find them.
 *
 * "Nobody you know of" is a real answer and a good one. It is never a refusal
 * here - the question was understood, and the emptiness IS the reply.
 */

import { rankName } from '../engine/cultivation/realms.js';
import { rungAndOrdinal } from './facts.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE CALLER HAS TO HAVE READ ALREADY
// ─────────────────────────────────────────────────────────────────────────

/**
 * One person who stands above the player, as the records hold them.
 *
 * Deliberately a subset of `ContactPerson` from `encounters.ts` rather than a
 * new shape: this is the same roster read through a narrower window, and a
 * second person-type in the web layer would drift from the first.
 */
export interface SomebodyAbove {
    /** Null when the player holds no record for them. Never invented. */
    name: string | null;
    realmOrdinal: number;
    /** Their seat in their house, when the read has one. */
    rankTitle: string | null;
    /** `members.ts` marked them a master: somebody who will teach. */
    willTeach: boolean;
    /** `teaching.knows` - the bounded thing they hold. Null when not a master. */
    knows: string | null;
    /** `teaching.mayNotSay` - what they may not say, and on whose authority. */
    mayNotSay: string | null;
    /** `teaching.costsThem` - what a straight answer costs them. */
    costsThem: string | null;
    /** Standing in the same place right now, rather than merely on the roll. */
    here: boolean;
    /**
     * The furthest rung anything they are carrying could put this cultivator
     * on, or null where nothing they hold goes past where the asker stands.
     *
     * ── WHY THIS FIELD EXISTS ────────────────────────────────────────────
     *
     * Measured across five seeded worlds, for a cultivator at ordinal 38:
     * SIX people in the whole world hold a road that carries any further, and
     * they stand in exactly two places - five of them on the Hollow Court's
     * ground, and Ru Anwei in a hall she has not left in three hundred and
     * eighty years. That is the top of this ladder working as designed.
     *
     * What was NOT working is that this read never said so. It answered "N
     * stand above you, M of those teach" and stopped, so a player standing in
     * front of the one person in the province who could take them to 41 was
     * told she was above them and nothing else. The ask path has priced this
     * correctly since it was written - `what-asking-this-person-for-this-
     * would-cost-them.ts` reads the same `carriesTo` and prices the leak -
     * and there was no read that pointed anybody at it.
     *
     * `carriesTo` and nothing else: the lower of their own rung and the book's
     * teachable end. Standing above somebody is not the same fact as holding a
     * road, which is the distinction this whole file turns on, and a null here
     * is the honest answer for the large majority of people above you.
     *
     * ── AND IT IS GATED LIKE THE NAME, FOR THE SAME REASON ───────────────
     *
     * Null for anybody the player cannot name. What somebody practises is not
     * legible across a yard, and a stranger's ceiling handed over unasked is
     * the same leak as a stranger's name - `discovery.md` does not have one
     * rule for identities and a looser one for what they are carrying.
     */
    carriesYouTo: number | null;
}

export interface TeacherInput {
    name: string;
    ordinal: number;
    placeName: string;
    /** The house they serve, when they serve one. */
    sectName: string | null;
    /** Everybody above them, from the roster and from the room. Already gated. */
    above: readonly SomebodyAbove[];
    /**
     * Why finding one matters right now, when it does.
     *
     * `techniqueCeiling(...).state`. A master is worth a great deal more to
     * somebody whose book has ended than to somebody halfway through one, and
     * `docs/world/climbing/manuals.md` makes personal transmission the route across a
     * shelf gap: "a house that still holds a living master of the higher manual
     * can bring somebody across; one that has lost its last master cannot."
     */
    manualState: 'no_method' | 'exhausted' | 'teaching';
}

export interface TeacherRead {
    headline: string;
    lines: string[];
    structure: string[];
    /** How many the player could actually name. The inspector's headline figure. */
    nameable: number;
}

// ─────────────────────────────────────────────────────────────────────────
// THE READ
// ─────────────────────────────────────────────────────────────────────────

const rungs = (n: number): string => `${n} rung${n === 1 ? '' : 's'}`;

/**
 * Why the manual axis is worth naming on the engine channel at all.
 *
 * `manualState` decides how much a teacher is WORTH to this cultivator, which
 * is the only reason this read files it. Printed as `manualState=no_method` it
 * says nothing to the person reading the log; said in words it is the whole
 * reason the question was asked.
 */
const WHY_A_TEACHER_MATTERS: Record<TeacherInput['manualState'], string> = {
    no_method: 'No method is practised, so the rate multiplier is zero and nothing '
        + 'accumulates however long they sit. A teacher is one of the two ways out of that.',
    exhausted: 'The manual has stopped carrying them, so the rate multiplier is zero past '
        + 'where it ends. Being taught across is one of the three ways past that.',
    teaching: 'The manual is still carrying them, so a teacher would be an improvement '
        + 'rather than the thing standing between them and any progress at all.'
};

/**
 * One person above, as a sentence rather than three fields.
 *
 * `here` was printed as `here=true` and a boolean is not a reason. What being
 * here MEANS is that they can be approached today; being on the roll and not in
 * the room means finding them is its own piece of work. That is the fact the
 * flag was standing in for, so the line says it.
 */
function mechanicalPerson(person: SomebodyAbove, playerOrdinal: number): string {
    const gap = person.realmOrdinal - playerOrdinal;
    return `${person.name} stands at ${rungAndOrdinal(person.realmOrdinal)}, ${rungs(gap)} `
        + `above ${rungAndOrdinal(playerOrdinal)}. `
        + (person.willTeach
            ? 'Marked a master on the roll: they teach, inside stated limits. '
            : 'Nothing on the roll marks them a teacher. ')
        + (person.carriesYouTo === null
            ? 'Nothing they are carrying goes past where the asker already stands, so what '
              + 'they could hand over is an art and not a road further up. '
            : `carriesTo puts their reach at ${rungAndOrdinal(person.carriesYouTo)}, being the `
              + `lower of their own rung and the teachable end of the deepest thing they hold. `)
        + (person.here
            ? 'They are standing here, so they can be approached today.'
            : 'They are on the roll and not in this place, so reaching them is its own journey.');
}

/**
 * The half-sentence that says a person is a road rather than an altitude.
 *
 * Appended to whatever line already describes them, so the two populations -
 * masters on the roll and everybody else above - get the same fact in the same
 * words. That matters more than it looks: `willTeach` is a catalog role and
 * `carriesYouTo` is arithmetic off what somebody is actually carrying, and the
 * measurement that produced this field found the second one live on people the
 * first one says nothing about. Shen Quan is not marked a master anywhere and
 * is one of the six people in the world who could take a cultivator at 38 any
 * further.
 */
function whatTheyCouldCarryYouTo(person: SomebodyAbove): string {
    if (person.carriesYouTo === null) return '';
    return ` The deepest thing they are carrying could take you to `
        + `${rankName(person.carriesYouTo)}, which is as far as they have stood themselves.`;
}

/**
 * Who could teach this cultivator, said only of people they have heard of.
 *
 * Masters first, then anybody else standing above them, then the count of the
 * ones they cannot name. The ordering is the order of usefulness and nothing
 * else: a master four rungs up is a road, and a stranger four rungs up is a
 * reason to introduce yourself.
 */
export function whoWouldTeach(input: TeacherInput): TeacherRead {
    const standing = rankName(input.ordinal);
    const lines: string[] = [];
    const structure: string[] = [];

    const named = input.above.filter(p => p.name !== null);
    const unnamed = input.above.filter(p => p.name === null);
    const masters = named.filter(p => p.willTeach);
    const others = named.filter(p => !p.willTeach);

    // The number the whole read is actually about, and it is not the headcount.
    // Standing above somebody is common; holding a road past them is not - six
    // people in a seeded world hold one past ordinal 38, and this is the count
    // of how many of those six the asker is looking at.
    const roads = named.filter(p => p.carriesYouTo !== null);

    structure.push(
        `${input.above.length} stand above ${rungAndOrdinal(input.ordinal)} on the roll and `
        + `in the room. ${named.length} can be named, ${masters.length} of those teach, `
        + `${roads.length} are carrying a road that goes past ${rungAndOrdinal(input.ordinal)}, `
        + `and ${unnamed.length} are counted without a name because this cultivator has never `
        + `met them. ${WHY_A_TEACHER_MATTERS[input.manualState]}`
    );

    for (const master of masters) {
        const gap = master.realmOrdinal - input.ordinal;
        lines.push(
            `${master.name} stands at ${rankName(master.realmOrdinal)}`
            + `${master.rankTitle ? `, ${master.rankTitle}` : ''}, ${rungs(gap)} above you at `
            + `${standing}, and teaches.`
            + `${master.here ? ' They are here.' : ''}`
            + whatTheyCouldCarryYouTo(master)
        );
        // The three limits, kept separate. Merging them is how a master becomes
        // an oracle, which is the one thing `asking.md` forbids.
        if (master.knows) lines.push(`  What they hold: ${master.knows}`);
        if (master.mayNotSay) lines.push(`  What they will not say: ${master.mayNotSay}`);
        if (master.costsThem) lines.push(`  What asking costs them: ${master.costsThem}`);
        structure.push(mechanicalPerson(master, input.ordinal));
    }

    for (const person of others) {
        const gap = person.realmOrdinal - input.ordinal;
        lines.push(
            `${person.name} stands at ${rankName(person.realmOrdinal)}`
            + `${person.rankTitle ? `, ${person.rankTitle}` : ''}, ${rungs(gap)} above you. `
            + `Nothing on record says they teach.`
            + `${person.here ? ' They are here.' : ''}`
            // And this is where the field earns itself. Somebody the roll does
            // not mark a teacher, who is nonetheless carrying a road past where
            // you stand, is the most useful person in this answer and used to
            // read as an altitude with a name on it.
            + whatTheyCouldCarryYouTo(person)
        );
        structure.push(mechanicalPerson(person, input.ordinal));
    }

    // The shape of what is hidden, without the names. A count and an altitude
    // are not an introduction, and both are things the player is entitled to.
    if (unnamed.length > 0) {
        const deepest = unnamed.reduce((a, b) => (b.realmOrdinal > a.realmOrdinal ? b : a));
        const gap = deepest.realmOrdinal - input.ordinal;
        const one = unnamed.length === 1;
        const where = input.sectName
            ? `on the roll of ${input.sectName}`
            : `in ${input.placeName}`;
        lines.push(
            `${one ? 'One person' : `${unnamed.length} people`} ${where} stand`
            + `${one ? 's' : ''} above ${standing}, the deepest of them ${rungs(gap)} up, and `
            + `you have never met ${one ? 'them' : 'any of them'}. You have no name to ask `
            + `for, which is the whole of what is stopping you.`
        );
    }

    // Nothing at all, which is an answer rather than a failure. The two arms
    // are exclusive with the block above on purpose: a reply that says "you
    // can name none of them" directly after saying "you have no name for
    // them" has told the player the same thing twice and neither time well.
    if (input.above.length === 0) {
        lines.push(
            `Nobody you know of stands above ${standing}`
            + `${input.sectName ? ` inside ${input.sectName}` : ''}, and nobody in `
            + `${input.placeName} is carrying themselves like somebody who does. `
            + `There is no teacher here to find.`
        );
    }

    // Why it matters now. Read off the manual axis, never asserted.
    if (input.manualState === 'no_method') {
        lines.push(
            `This is the question that matters most to you: you practise no method, so `
            + `nothing accumulates at ${standing} and no amount of sitting changes it. A book `
            + `or a teacher is the only thing that does.`
        );
    } else if (input.manualState === 'exhausted') {
        lines.push(
            `Your own manual has stopped carrying you, and being taught across is one of the `
            + `three ways past that. A house that still holds a living master of the higher `
            + `book can bring somebody across; one that has lost its last master cannot.`
        );
    }

    return {
        headline: masters.length > 0
            ? `${masters.length} who would teach ${input.name}, and what each will not say.`
            : named.length > 0
                ? `Nobody ${input.name} knows of teaches, but ${named.length} stand above them.`
                : `Nobody ${input.name} knows of could teach them.`,
        lines,
        structure,
        nameable: named.length
    };
}
