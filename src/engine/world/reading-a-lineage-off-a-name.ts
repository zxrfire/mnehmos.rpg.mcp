/**
 * Reading a lineage off a name.
 *
 * `surnameOf` and `RESERVED_SURNAMES` have both sat in `history.ts` with no
 * consumer anywhere in `src/`. This file is the consumer: it is what makes a
 * name able to CORROBORATE a claim, which is the third row of the hierarchy in
 * `docs/world/trust.md` and the only job a name is entitled to do.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * NAMES SIT LOW, AND THAT IS THE RULE RATHER THAN A DEFECT
 * ═════════════════════════════════════════════════════════════════════════
 *
 *     the arts     what a house IS
 *     the objects  what a house HELD
 *     the names    which lines CONTINUED    <- here
 *     the faces    nothing
 *
 * Three caveats govern everything below, and they are what stop this being
 * naive. Each one is a branch in the code, not a comment beside it:
 *
 *   A COMMON SURNAME PROVES NOTHING. Most surnames are common. Gu and Cao are
 *   house lines AND sit in `SURNAMES`, the pool a stranger is generated from,
 *   so a Gu somewhere is a person called Gu. Only a name nobody else carries
 *   can carry a house on its own, which is why `RESERVED_SURNAMES` is tiny on
 *   purpose. {@link LineageReading} makes `shared` and `reserved` different
 *   answers rather than degrees of the same one.
 *
 *   AN ABSENT NAME IS A QUESTION, NOT A VERDICT. Cultivators have few children
 *   and most of them die on the ladder, so a line going out is ordinary rather
 *   than sinister - and a house can turn over entirely while having been
 *   continuously itself. {@link readTheRollFor} therefore returns
 *   `a_question_to_ask` and never a finding. Reading absence as catastrophe is
 *   the same error as reading a hall of strangers as loss.
 *
 *   IT CORROBORATES; IT DOES NOT SETTLE. Xu is the worked example: Xu Ci lies
 *   under the Anchorhold's datum stone and there are living Xu at the
 *   Anchorhold and at Held Names both, so the name identifies neither.
 *   `settles` is true for exactly one reading and false for every other.
 *
 * ── The roll is the LIVING roll ───────────────────────────────────────────
 *
 * "Which lines continued" is a question about who is standing on the roster
 * now, so the roll here is `MEMBERS` and nothing else. Founders, sealed
 * ancestors and the honoured dead are the thing the roll is compared AGAINST -
 * folding them in would make every ended line look like it continued, which is
 * the exact reading the second caveat forbids.
 *
 * ── What counts as a name at all, and why this reader is deliberately shy ──
 *
 * `surnameOf` splits at the first space, which is exact for what the world's
 * own generator produces (`personName` makes `Surname Given` and nothing else)
 * and wrong for a great deal of the authored roster. Measured over `MEMBERS`
 * at the time of writing: 41 of 186 rows are not of that shape - "The Abbot",
 * "First Seat", "The Storm Tyrant", "Clan Chief Duan Wu", "Nine Boards Qiu" -
 * and `surnameOf` answers "The", "First", "Clan" and "Nine" for them. Left
 * alone, that invents lineages: "The" read as a five-house family, "Second" and
 * "Third" as lines standing on the Hollow Court's roll.
 *
 * So {@link lineageNameOf} accepts only what the generator could have made -
 * exactly two tokens, `Surname Given` - and declines everything else rather
 * than guessing. That loses roughly a dozen real surnames sitting behind
 * titles, and DECLINING IS THE CORRECT FAILURE HERE: a name is worth
 * corroboration at best, so under-reading costs a hint and a wrong reading
 * costs a false lineage. Recovering those dozen wants a surname field on the
 * catalog row, not a cleverer parser - a heuristic that scanned for a known
 * surname anywhere in the string read "Grand Steward Lei Fu" as a Fu.
 */

import { MEMBERS } from '../../data/cultivation/members.js';
import { SECTS } from '../../data/cultivation/sects.js';
import { RESERVED_SURNAMES, SURNAMES, surnameOf } from './history.js';

/**
 * `RESERVED_SURNAMES` names its houses the way a person would say them - "Azure
 * Cloud Pavilion" - and every other index in the engine is keyed by faction id.
 * Resolved here rather than by changing the map, because the map is guarded by
 * `tests/engine/world/reserved-surnames.test.ts` and is read by a human before
 * it is read by anything else.
 *
 * A name that resolves to nothing yields a null id and keeps the name, so a
 * reserved surname pointing at a house that has been renamed degrades to "this
 * name carries a house I cannot place" instead of silently reading as unowned.
 */
const HOUSE_ID_BY_NAME: ReadonlyMap<string, string> = new Map(
    (SECTS as readonly { id: string; name: string }[]).map(s => [s.name, s.id])
);

function houseIdFor(houseName: string): string | null {
    return HOUSE_ID_BY_NAME.get(houseName) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IS A NAME AND WHAT IS A TITLE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Leading words that are never a family name.
 *
 * Only reached for a name that is already two tokens, so the list stays at the
 * articles and ordinals the roster actually opens seats and offices with. It is
 * a guard on a shape, not a catalog of titles: anything longer is declined by
 * the token count before this is consulted.
 */
const NEVER_A_FAMILY = /^(?:the|a|an|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)$/i;

/**
 * The family name in a full name, or null when there is not one to read.
 *
 * Null is a real and frequent answer - a seat, an office, a by-name - and it
 * must not be confused with a name nobody's roll carries. The first is "this is
 * not a lineage name"; the second is "this is a lineage name standing nowhere",
 * and they are different rows of {@link LineageReading}.
 */
export function lineageNameOf(fullName: string): string | null {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length !== 2) return null;
    const surname = surnameOf(fullName);
    if (surname.length === 0 || NEVER_A_FAMILY.test(surname)) return null;
    return surname;
}

// ─────────────────────────────────────────────────────────────────────────
// THE ROLL
// ─────────────────────────────────────────────────────────────────────────

interface RollIndex {
    byHouse: ReadonlyMap<string, readonly string[]>;
    bySurname: ReadonlyMap<string, readonly string[]>;
}

/**
 * Built once from the catalog. The roster is static content, so the index is
 * too, and every reader in a world shares it.
 */
const ROLL: RollIndex = (() => {
    const byHouse = new Map<string, Set<string>>();
    const bySurname = new Map<string, Set<string>>();
    for (const member of MEMBERS) {
        const surname = lineageNameOf(member.name);
        if (!surname) continue;
        let house = byHouse.get(member.factionId);
        if (!house) byHouse.set(member.factionId, (house = new Set()));
        house.add(surname);
        let houses = bySurname.get(surname);
        if (!houses) bySurname.set(surname, (houses = new Set()));
        houses.add(member.factionId);
    }
    const freeze = (m: Map<string, Set<string>>): ReadonlyMap<string, readonly string[]> =>
        new Map([...m].map(([k, v]) => [k, [...v].sort()]));
    return { byHouse: freeze(byHouse), bySurname: freeze(bySurname) };
})();

/** Every family name standing on one house's roll, sorted. */
export function linesOnTheRollOf(factionId: string): readonly string[] {
    return ROLL.byHouse.get(factionId) ?? [];
}

/** Every house with a line of this name standing on its roll, sorted. */
export function housesWithALineNamed(surname: string): readonly string[] {
    return ROLL.bySurname.get(surname) ?? [];
}

/** True when a stranger could simply have been born with this name. */
export function isInTheCommonPool(surname: string): boolean {
    return (SURNAMES as readonly string[]).includes(surname);
}

// ─────────────────────────────────────────────────────────────────────────
// READING ONE NAME
// ─────────────────────────────────────────────────────────────────────────

/**
 *   not_a_lineage_name  a seat, an office or a by-name. Nothing to read.
 *   reserved            nobody else carries it, so it carries a house alone.
 *                       The rare exception the reserved set exists for.
 *   shared              a house line and also a name a stranger may be born
 *                       with, or standing on more than one roll. Worth
 *                       something as corroboration and nothing on its own.
 *   unplaced            a lineage name no roll in the world carries. Not
 *                       suspicious: most people are not on anybody's roster.
 */
export type LineageReading = 'not_a_lineage_name' | 'reserved' | 'shared' | 'unplaced';

export interface NameReading {
    fullName: string;
    /** Null exactly when `reading` is `not_a_lineage_name`. */
    surname: string | null;
    reading: LineageReading;
    /**
     * The house this name carries by itself, as `RESERVED_SURNAMES` says it.
     * Non-null only on `reserved`, and it is the ONLY field on this type that
     * is evidence about a person rather than about a name.
     */
    houseItCarriesOnItsOwn: string | null;
    /** The same house as a faction id, or null if the name resolves to none. */
    houseIdItCarriesOnItsOwn: string | null;
    /** Houses with a line of this name standing. Corroboration, never proof. */
    housesWithThisLine: readonly string[];
    /** A stranger may be born with it. */
    inTheCommonPool: boolean;
    /** Does it answer the question by itself? True on `reserved` and nowhere else. */
    settles: boolean;
    /** Is it worth anything at all beside another check? */
    corroborates: boolean;
}

/**
 * What a name is worth, on its own, to somebody weighing a claim.
 *
 * Pure and unseeded: this is a reading of the catalog and of the name, and
 * nothing about who is reading it. Whether the reader can go and CHECK the roll
 * is a separate and much more expensive question - see the price-of-checking
 * section of `trust.md` - and it is not this function's to answer.
 */
export function readALineageOffAName(fullName: string): NameReading {
    const surname = lineageNameOf(fullName);
    if (!surname) {
        return {
            fullName,
            surname: null,
            reading: 'not_a_lineage_name',
            houseItCarriesOnItsOwn: null,
            houseIdItCarriesOnItsOwn: null,
            housesWithThisLine: [],
            inTheCommonPool: false,
            settles: false,
            corroborates: false
        };
    }

    const reserved = RESERVED_SURNAMES.get(surname) ?? null;
    const houses = housesWithALineNamed(surname);
    const inPool = isInTheCommonPool(surname);

    const reading: LineageReading =
        reserved !== null ? 'reserved'
            : houses.length > 0 ? 'shared'
                : 'unplaced';

    return {
        fullName,
        surname,
        reading,
        houseItCarriesOnItsOwn: reserved,
        houseIdItCarriesOnItsOwn: reserved === null ? null : houseIdFor(reserved),
        housesWithThisLine: houses,
        inTheCommonPool: inPool,
        settles: reading === 'reserved',
        // A shared name still narrows the field, which is the whole of what
        // corroboration means. An unplaced one narrows nothing.
        corroborates: reading === 'reserved' || reading === 'shared'
    };
}

// ─────────────────────────────────────────────────────────────────────────
// READING A CLAIM AGAINST ONE HOUSE
// ─────────────────────────────────────────────────────────────────────────

/**
 * What a name is worth against a house somebody has named.
 *
 *   settles_it           reserved to this house. It carries the claim alone.
 *   contradicts          reserved to a DIFFERENT house, which is the one
 *                        negative a name can deliver on its own.
 *   corroborates         a line of this name stands on that roll. Consistent,
 *                        and consistent with a great many other things too.
 *   a_question_to_ask    a lineage name with no line of it on that roll. Lines
 *                        end innocently, so this is somewhere to start asking
 *                        and never a finding.
 *   nothing              not a lineage name at all.
 */
export type NameAgainstAHouse =
    | 'settles_it'
    | 'contradicts'
    | 'corroborates'
    | 'a_question_to_ask'
    | 'nothing';

export interface RollReading {
    fullName: string;
    surname: string | null;
    factionId: string;
    worth: NameAgainstAHouse;
    /** Family names standing on that roll, so a caller can say what IS there. */
    standingOnThatRoll: readonly string[];
    /**
     * Always false except on `settles_it`. Present so that no caller has to
     * remember which of the five values is the conclusive one.
     */
    settles: boolean;
}

/**
 * Put a name to a house's roll.
 *
 * The check the woken ancestor runs and the check a gate guard runs, and they
 * are the same check - which is the argument that none of this is bespoke.
 */
export function readTheRollFor(fullName: string, factionId: string): RollReading {
    const surname = lineageNameOf(fullName);
    const standing = linesOnTheRollOf(factionId);
    if (!surname) {
        return { fullName, surname: null, factionId, worth: 'nothing', standingOnThatRoll: standing, settles: false };
    }

    const reservedTo = RESERVED_SURNAMES.get(surname) ?? null;
    const reservedId = reservedTo === null ? null : houseIdFor(reservedTo);
    const worth: NameAgainstAHouse =
        reservedId !== null && reservedId === factionId ? 'settles_it'
            // Reserved to somebody else. The one negative a name delivers on
            // its own, and it only fires when the map actually resolves - an
            // unresolvable reserved name is not evidence against anybody.
            : reservedId !== null ? 'contradicts'
                : standing.includes(surname) ? 'corroborates'
                    : 'a_question_to_ask';

    return {
        fullName,
        surname,
        factionId,
        worth,
        standingOnThatRoll: standing,
        settles: worth === 'settles_it'
    };
}
