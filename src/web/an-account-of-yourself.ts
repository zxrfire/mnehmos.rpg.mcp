/**
 * Giving an account of yourself, and the two rows it leaves behind.
 *
 * `SourceKind` has carried `fabricated` since the knowledge layer was written
 * and nothing wrote one, so a cover story did not exist - and neither did the
 * only thing that can ever catch a false name, which is a claim somebody holds
 * that is known to be untrue.
 *
 * ── IT IS WRITTEN AT BOTH ENDS ───────────────────────────────────────────
 *
 * The hearer holds a claim about the speaker. The speaker holds a record of
 * having given it. Without the second half nothing in the world can ask what
 * account this person has been giving, and a lie with no author is a lie
 * nobody can be caught in. Both rows sit on the same claim key, so
 * {@link KnowledgeGate.provenanceOf} reaches either from the other end.
 *
 * ── THE ENGINE DECIDES WHETHER IT IS SO, AND NEVER SAYS ──────────────────
 *
 * Which parts of an account are not so is a comparison against the speaker's
 * own row - their name, the house they are on the roll of, the rung they
 * stand at - and not a reading of the words. So the same sentence is `told`
 * from somebody who is who they say they are and `fabricated` from somebody
 * who is not, with nothing in the shape of either to tell them apart.
 *
 * The player-facing answer says what the hearer now holds and never says
 * whether it was true. A player who made it up already knows; a player who was
 * lied to has no way to find out except the way anybody does, by meeting
 * somebody who holds the other account.
 */

import {
    A_REALM_ANSWERS_TO,
    REALM_TIERS,
    realmForOrdinal,
    type RealmKey
} from '../engine/cultivation/realms.js';
import type { EngineFacts } from './facts.js';
import type { KnowledgeGate } from './knowledge.js';
import { aTellingPutToSomebody, type ATelling } from './telling-a-wrong.js';
import {
    A_HOUSE_BY_NAME,
    A_HOUSE_TYPE_NOUN_ALONE_OR_PLURAL
} from './what-a-house-is-called.js';

/** The three things an account of oneself is made of. */
export type PartOfAnAccount = 'name' | 'house' | 'rung';

/**
 * What somebody said they were. Every field is words, unchecked.
 */
export interface AnAccountOfThemselves {
    /** The name they gave, where they gave one. */
    name: string | null;
    /** Null where the account attached them to nothing. */
    house: string | null;
    /** The rung they claimed, resolved to a realm and no finer. */
    rung: RealmKey | null;
}

/** What is actually so of them, off their own row. */
export interface WhatIsSoOfThem {
    name: string;
    /** The house they are on the roll of. Null for somebody of none. */
    house: string | null;
    realmOrdinal: number;
}

// ─────────────────────────────────────────────────────────────────────────
// READING THE SENTENCE
// ─────────────────────────────────────────────────────────────────────────

/**
 * The claim has to be about the speaker.
 *
 * Without it "I tell him that the Hollow Court took his brother" reads as an
 * account of the speaker on the strength of the house name in it.
 */
const THE_SPEAKER_IS_THE_SUBJECT = /\b(?:i|i'm|im|my|me|myself)\b/i;

/** The ways somebody offers a name for themselves. */
const A_NAME_GIVEN =
    /\b(?:my name is|they call me|i am called|i'?m called|i go by)\s+([a-z][a-z' -]{1,40})/i;

/**
 * The house, as the phrase that attaches somebody to one.
 *
 * Both halves of `what-a-house-is-called.ts`, in its own order: a catalog name
 * first, because `Verdant Spring Valley` ends in a word this world puts on
 * ground, and a name in front of a type noun that can only be a house second.
 * Reading the full list of type nouns here would take "I am from the valley"
 * for a house, which is the exact ambiguity that module's split exists for.
 */
const A_HOUSE_CLAIMED = new RegExp(
    String.raw`\b(?:of|from|with|belongs?\s+to)\s+(?:the\s+)?`
    + String.raw`(${A_HOUSE_BY_NAME}`
    + String.raw`|[a-z][a-z' -]{2,40}?\s(?:${A_HOUSE_TYPE_NOUN_ALONE_OR_PLURAL}))\b`,
    'i'
);

/**
 * Realm names, longest first, and never the one-word one.
 *
 * `Immortal` is an ordinary adjective in this setting and would take phrases
 * that are not about the ladder - the same exclusion
 * `a-target-can-be-a-description.ts` makes, for the same reason.
 */
const REALMS_BY_NAME: readonly (readonly [string, RealmKey])[] = [
    ...REALM_TIERS.map(tier => [tier.name.toLowerCase(), tier.key] as const),
    ...Object.entries(A_REALM_ANSWERS_TO).map(([name, key]) => [name, key] as const)
]
    .filter(([name]) => name.split(' ').length > 1)
    .sort((a, b) => b[0].length - a[0].length);

function theRungClaimed(said: string): RealmKey | null {
    const lower = said.toLowerCase();
    for (const [name, key] of REALMS_BY_NAME) {
        if (lower.includes(name)) return key;
    }
    return null;
}

/**
 * What this claim says the speaker is, or null where it says nothing about them.
 */
export function whatAccountWasGiven(said: string): AnAccountOfThemselves | null {
    if (!THE_SPEAKER_IS_THE_SUBJECT.test(said)) return null;

    const name = A_NAME_GIVEN.exec(said)?.[1]?.trim() ?? null;
    const house = A_HOUSE_CLAIMED.exec(said)?.[1]?.trim() ?? null;
    const rung = theRungClaimed(said);

    if (name === null && house === null && rung === null) return null;
    return { name, house, rung };
}

/**
 * "I introduce myself to the gate guard as an inner disciple of X."
 *
 * Its own head because the frame, not the clause, is what makes the account
 * about the speaker - so the clause is put back into the first person before
 * anything reads it, and every consumer downstream has one rule rather than two.
 */
const I_INTRODUCE_MYSELF = new RegExp(
    String.raw`^\s*(?:i\s+|i'?ll\s+|i\s+will\s+)?`
    + String.raw`(?:introduce|present|announce)\s+myself\s+to\s+(.+?)\s+as\s+(.+)$`,
    'i'
);

/**
 * "I tell her my name is Shen Wuyi" - an account with no hinge word in front.
 *
 * The shared split needs `that`, `about` or a wh-word to know where the
 * addressee stops, and this is how somebody actually says it. Tried only after
 * the shared one, because on "I tell him that I am of the Hollow Court" the
 * lookahead would take `him that` for the addressee.
 */
const A_TELLING_WHO_I_AM = new RegExp(
    String.raw`^\s*(?:i\s+|i'?ll\s+|i\s+will\s+)?(?:tells?|telling|informs?|informing)\s+(.+?)\s+`
    + String.raw`(?=(?:my\s+name\s+is|i\s+am\b|i'?m\b|they\s+call\s+me|i\s+go\s+by)\b)(.+)$`,
    'i'
);

/** A person and a claim, where both came out whole and the claim is an account. */
function anAccountPutTo(rawPerson: string, rawClaim: string): ATelling | null {
    const person = rawPerson.replace(/\s+/g, ' ').trim();
    const claim = rawClaim.replace(/[,;:.!?]+$/, '').replace(/\s+/g, ' ').trim();
    if (person.length < 2 || whatAccountWasGiven(claim) === null) return null;
    return { person: person.slice(0, 80), claim: claim.slice(0, 120) };
}

/**
 * Whether this sentence is somebody giving an account of themselves, and to whom.
 *
 * Shares {@link aTellingPutToSomebody} with the wrong-telling reader, so the two
 * cannot disagree about where an addressee stops and a claim starts.
 */
export function whatIsBeingGivenAsAnAccount(input: string): ATelling | null {
    const trimmed = input.trim();

    const introduced = I_INTRODUCE_MYSELF.exec(trimmed);
    if (introduced !== null) {
        return anAccountPutTo(introduced[1], `I am ${introduced[2]}`);
    }

    const telling = aTellingPutToSomebody(trimmed);
    if (telling !== null) {
        return whatAccountWasGiven(telling.claim) === null ? null : telling;
    }

    const plain = A_TELLING_WHO_I_AM.exec(trimmed);
    return plain === null ? null : anAccountPutTo(plain[1], plain[2]);
}

// ─────────────────────────────────────────────────────────────────────────
// WHETHER IT IS SO
// ─────────────────────────────────────────────────────────────────────────

/** Two ways of writing one name are one name. Never stored - comparison only. */
function plainly(words: string): string {
    return words
        .toLowerCase()
        .replace(/[.,!?;:'"]/g, '')
        .replace(/^the\s+/, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Which parts of the account are not so. Empty means every word of it was.
 *
 * ENGINE ONLY. No character-facing path may call this: it is the omniscient
 * comparison the whole knowledge layer exists to keep away from the people in
 * the world, and what it decides is which SourceKind the row is written with.
 */
export function whereTheAccountIsNotSo(
    given: AnAccountOfThemselves,
    so: WhatIsSoOfThem
): PartOfAnAccount[] {
    const wrong: PartOfAnAccount[] = [];
    if (given.name !== null && plainly(given.name) !== plainly(so.name)) wrong.push('name');
    if (given.house !== null
        && (so.house === null || plainly(given.house) !== plainly(so.house))) {
        wrong.push('house');
    }
    if (given.rung !== null && given.rung !== realmForOrdinal(so.realmOrdinal).key) {
        wrong.push('rung');
    }
    return wrong;
}

/** The realm as it is printed, off the ladder rather than off the key. */
function realmNamed(key: RealmKey): string {
    return REALM_TIERS.find(tier => tier.key === key)?.name ?? key.replace(/_/g, ' ');
}

/** The account as its own clause: "of the X Sect, at Core Formation". */
function theAccountsClauses(given: AnAccountOfThemselves): string {
    const clauses: string[] = [];
    if (given.house !== null) clauses.push(`of the ${plainlyCased(given.house)}`);
    if (given.rung !== null) clauses.push(`at ${realmNamed(given.rung)}`);
    return clauses.join(', ');
}

/** The house as said, with a leading article taken off the front. */
function plainlyCased(house: string): string {
    return house.replace(/^the\s+/i, '').trim();
}

/**
 * The account as the hearer would hold it.
 *
 * Never names the holder - a statement is quoted verbatim by `recall` and by
 * the opening recap, and a row that puts its own holder into its prose gets
 * read aloud to them in the third person.
 */
export function theAccountAsAStatement(
    given: AnAccountOfThemselves,
    fallbackName: string
): string {
    const who = given.name ?? fallbackName;
    const clauses = theAccountsClauses(given);
    return clauses.length === 0
        ? `${who} is the name they gave for themselves.`
        : `${who} is ${clauses}.`;
}

// ─────────────────────────────────────────────────────────────────────────
// WRITING IT DOWN, BOTH WAYS
// ─────────────────────────────────────────────────────────────────────────

export interface AnAccountGivenToSomebody {
    /** Who gave it. */
    tellerId: string;
    /** Who heard it. */
    hearerId: string;
    /** The name the hearer now has for them: the one given, or the one they have. */
    nameForThem: string;
    onDay: number;
    account: AnAccountOfThemselves;
    /**
     * Which parts of it are not so. Empty writes `told`; anything in it writes
     * `fabricated`. Decided by {@link whereTheAccountIsNotSo} and never here.
     */
    notSo: readonly PartOfAnAccount[];
    /** Where it was said, for both notes. */
    where: string;
    /** Who heard it, by name, for the teller's own note. */
    hearerName: string;
}

export interface AnAccountRecorded {
    /** `fabricated` where any part of it was not so, `told` where none was. */
    sourceKind: 'told' | 'fabricated';
    /** What the hearer now holds. */
    statement: string;
}

/**
 * Write the account into the hearer's head and into the teller's own record.
 *
 * ONE WRITER, BOTH ROWS. A caller that could write the hearer's half alone
 * would leave an account with no author, which is the state nothing can ever
 * catch somebody in.
 */
export function recordAnAccountGiven(
    gate: KnowledgeGate,
    given: AnAccountGivenToSomebody
): AnAccountRecorded {
    const sourceKind = given.notSo.length === 0 ? 'told' : 'fabricated';
    const statement = theAccountAsAStatement(given.account, given.nameForThem);

    gate.learn({
        holderId: given.hearerId,
        kind: 'cultivator',
        id: given.tellerId,
        name: given.account.name ?? given.nameForThem,
        onDay: given.onDay,
        sourceKind,
        fromHolderId: given.tellerId,
        // Identical either way. The hearer was told something about somebody
        // standing in front of them and has no other information about it; a
        // note that read differently for a lie would be the engine telling them.
        sourceNote: `Said of themselves at ${given.where}.`,
        statement,
        // Aimed at `placed` and clamped by the source, which is the whole of the
        // mechanic: `stageCeilingFor` puts a fabricated acquisition at `whisper`
        // and a told one at `placed`, and nothing here restates either figure.
        stage: 'placed'
    });

    gate.learn({
        holderId: given.tellerId,
        kind: 'cultivator',
        id: given.tellerId,
        name: given.account.name ?? given.nameForThem,
        onDay: given.onDay,
        sourceKind,
        // The note names the hearer and never the holder, for the reason in
        // `theAccountAsAStatement`.
        sourceNote: `Given to ${given.hearerName} at ${given.where}.`,
        statement: `An account given to ${given.hearerName}: ${statement}`,
        stage: 'placed'
    });

    return { sourceKind, statement };
}

// ─────────────────────────────────────────────────────────────────────────
// AND THE WORLD'S OWN PEOPLE DO IT
// ─────────────────────────────────────────────────────────────────────────

/**
 * How often a stranger giving their name gives somebody else's house with it.
 *
 * A rate and not a simulation. Nothing models why this person is travelling
 * under another house's name, and nothing should: the world's people are
 * resolved cheaply, and a pass that worked out each one's reason for lying
 * would cost a thousand decisions a turn to produce the same row this does.
 *
 * Low enough that a player who asks a hundred strangers their name meets a
 * handful, which is roughly what the genre does with it.
 */
export const A_STRANGER_GIVES_A_HOUSE_NOT_THEIRS = 0.04;

/**
 * The house this stranger claims instead of their own, or null for the ordinary
 * case where they simply say who they are.
 *
 * Drawn off the houses whose names are in circulation rather than off a table of
 * liars: a name worth borrowing is one the person hearing it might have heard
 * of, and the world already holds that list.
 */
export function whatHouseTheyClaimInstead(input: {
    rng: { chance(p: number): boolean; int(min: number, max: number): number };
    /** The house they are on the roll of, by name. Null for somebody of none. */
    theirOwn: string | null;
    /** Houses in circulation, by name. */
    houses: readonly string[];
}): string | null {
    if (!input.rng.chance(A_STRANGER_GIVES_A_HOUSE_NOT_THEIRS)) return null;
    const others = input.houses.filter(house =>
        house.trim().length > 0
        && (input.theirOwn === null || plainly(house) !== plainly(input.theirOwn)));
    if (others.length === 0) return null;
    return others[input.rng.int(0, others.length - 1)];
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE PLAYER IS TOLD BACK
// ─────────────────────────────────────────────────────────────────────────

/**
 * The answer, and it says only what the hearer now holds.
 *
 * Whether the account was so is in `structure`, which reaches the inspector and
 * not the narrator. A player who made it up knows already, and a narrator told
 * that a claim is false will write the scene as though the hearer could tell.
 */
export function factsForAnAccountGiven(input: {
    hearer: string;
    recorded: AnAccountRecorded;
    notSo: readonly PartOfAnAccount[];
    /** What the player said, in their own words. */
    claim: string;
}): EngineFacts {
    const line = `${input.hearer} hears you out. What they have of you from today is what you `
        + `said: ${input.recorded.statement}`;
    return {
        headline: `${input.hearer} has your account of yourself.`,
        lines: [line],
        prose: line,
        structure: [
            `account: said "${input.claim}" to ${input.hearer}. `
            + `Written into their records as ${input.recorded.sourceKind}. `
            + (input.notSo.length === 0
                ? 'Every part of it is so.'
                : `Not so: ${input.notSo.join(', ')}.`)
            + ' The same row is written on the speaker, so what they have been saying about '
            + 'themselves can be asked.'
        ]
    };
}
