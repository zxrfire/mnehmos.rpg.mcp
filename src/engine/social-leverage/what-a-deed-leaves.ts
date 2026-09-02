/**
 * What a deed leaves behind, in both directions, priced by what it was worth
 * rather than by what it was called.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE ONE IDEA
 * ═════════════════════════════════════════════════════════════════════════
 *
 *   KINDNESS AND HARM ARE THE SAME MACHINERY POINTED TWO WAYS.
 *
 * Somebody gave a thing away, taught a stranger for nothing, stood between
 * a person and what was coming for them. Somebody else took a thing, broke a
 * body, killed a house's daughter. Those are not two systems. They are one
 * transfer with the sign flipped:
 *
 *   SOMETHING WAS TAKEN OUT OF ONE PERSON AND ENDED UP WITH ANOTHER, AND THE
 *   LEDGER RECORDS WHO IS NOW OWED.
 *
 * So there is exactly one scoring function in this file and both directions
 * run through it. A favour owed and a grudge held are the same weight computed
 * the same way, which is the design owner's own framing and the reason charity
 * is worth doing at all: above the cash line what moves people is a favour
 * owed, so accumulating them is the most valuable thing a poor cultivator can
 * do with their time.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * NOTHING IN HERE BRANCHES ON WHAT THE DEED WAS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * AGENTS.md, *what NPCs do is emergent, never enumerate it*: **a tenth kind of
 * wrong must need no new branch.** So `cause` is carried through this file
 * untouched, straight onto the record, and is never read. Grep it: there is no
 * `switch (cause)` and no table keyed on one. What the engine reads is three
 * facts that are true of any deed whatsoever:
 *
 *   WHO PAID          {@link Deed.paidBy}. The whole of the direction.
 *   WHAT IT COST      {@link Deed.cost}, against what the payer had.
 *   WHETHER IT COMES  {@link Deed.irreversible}, and whether a word was given
 *   BACK              first ({@link Deed.promised}).
 *
 * A theft of somebody's last stone and a theft of a rich house's spare cart
 * are the same cause and different weights, which is the correct answer and is
 * unreachable from a table of crimes. A wrong nobody has thought of yet is
 * priced the day somebody supplies its cost.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * A PERSONAL WRONG BECOMES AN INSTITUTIONAL ONE, AND WHO IT REACHES DEPENDS
 * ON WHO DID IT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The design owner's case: a wrong done to a weak member of a strong house
 * opens an account BETWEEN HOUSES, and which houses depends on who did it. A
 * house wronged by a nobody and a house wronged by somebody nothing it has can
 * reach are in completely different situations, and the difference is not how
 * angry anybody is.
 *
 * {@link Reach} is that fact, and it is deliberately not a ladder. This file
 * imports no realm, no ordinal and no power, exactly like the two modules it
 * sits beside. The caller knows whether the actor is answerable; the engine
 * only asks. What the answer changes:
 *
 *   UNBACKED    They answer to nobody. The house can simply act, and what it
 *               holds is an ordinary account that a settlement can close.
 *   ANSWERABLE  They answer to a body the house deals with. Both houses end up
 *               on the record and the account is now between institutions.
 *   BEYOND      Nobody alive can be made to answer. The account is written as
 *               something to be CARRIED - `blood_feud`, the ledger's own kind
 *               for a thing held between lines and expected to be inherited -
 *               because there is no settlement available to the people it
 *               happened to.
 *
 * That last one is the long tail the whole obligation ledger exists for: a
 * wrong nobody could answer becomes a family's history rather than an event,
 * and reaches a descendant who never met the wronged party through
 * `inheritOnDeath`'s provenance chain, unchanged.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * REGISTER
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `docs/world/writing/tone.md` governs and this file obeys it the way every surface
 * around it does: it reports the record, the weight, who now carries it and
 * what a witness would say. It does not depict anything. That is not a special
 * dispensation for the grave causes - it is the same discipline the engine
 * already applies to a wound, a killing and a bout that went further than was
 * agreed, and the grave causes get no different treatment because they need
 * none.
 *
 * Pure. No state, no rolls, no I/O, no ladder. Same inputs, same answer.
 */

import type { SectAlignment } from '../../schema/cultivation.js';
import type { DayIndex } from '../social/common.js';
import type {
    InheritanceRelation,
    ObligationCause,
    ObligationInput,
    ObligationKind,
    Severity
} from '../social/grudges.js';
import { SEVERITY_ORDER } from '../social/grudges.js';
import type { ShameInput } from '../social/shame.js';
import { severityWithHouse, whenItIsDoneToOneOfOurs } from './what-a-house-will-do-about-it.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT A DEED IS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Which side of it paid.
 *
 * The entire direction of the system, in one field, and it is a fact the
 * caller always has: whoever is writing this knows whether their character
 * gave something up or took something away.
 *
 *   `actor`    The actor paid and the subject has it. A kindness. The actor
 *              ends up holding a favour the subject owes.
 *   `subject`  The actor took it out of the subject. A wrong. The subject ends
 *              up holding a grudge about the actor.
 *
 * Note that "paid" is not "meant well". Somebody who hands over a fortune to
 * buy a person's loyalty has still paid, and the record still says so - what
 * they were doing it FOR is `an-attempt-to-move-somebody.ts`'s question and the
 * grudge that opens when it is worked out is `when-somebody-works-out-what-you-
 * did.ts`'s. This file prices the transfer.
 */
export type WhoPaid = 'actor' | 'subject';

/**
 * How far the wronged side can actually get at the person who did it.
 *
 * Not a rank and not a judgement about anybody's strength - a fact about
 * whether there is anybody to take it to. The caller derives it from whatever
 * it holds; this file only reads the answer, which is what keeps the ladder out
 * of the consequence layer entirely.
 */
export type Reach =
    /** They answer to nobody. Whatever is done about it can be done directly. */
    | 'unbacked'
    /** They answer to a body the aggrieved side deals with. It goes between houses. */
    | 'answerable'
    /** There is nobody who could be made to answer for it, now or soon. */
    | 'beyond';

/** Who somebody is, for the purpose of deciding who else ends up carrying this. */
export interface Party {
    id: string;
    name: string;
    /** The house they answer to, or null for somebody who answers to nobody. */
    houseId: string | null;
    houseName: string | null;
    alignment: SectAlignment | null;
    /**
     * Whether the house has anything invested in them.
     *
     * `whenItIsDoneToOneOfOurs`'s own word, and for the reason it gives: a
     * house has an interest in the people it has spent something on and very
     * little in the people it pays by the season. THE WEAK MEMBER OF A STRONG
     * HOUSE IS STILL RANKED - being low is not being nothing - which is why the
     * owner's case works at all.
     */
    ranked: boolean;
    /**
     * Blood and household. Who carries it when the principal cannot.
     *
     * The relation is the ledger's own {@link InheritanceRelation}, so a record
     * opened here and a record inherited by `inheritOnDeath` describe the same
     * kind of connection in the same word.
     */
    kin?: readonly { id: string; relation: InheritanceRelation }[];
    /** Houses this party's house stands with. Named on the record, never holders. */
    alliedHouseIds?: readonly string[];
}

/**
 * One thing somebody did to somebody.
 *
 * Everything the engine reads is here and none of it is the deed's name.
 */
export interface Deed {
    /**
     * WHO the two of them are is NOT here.
     *
     * It is on the two {@link Party} objects, once, and it was on both for
     * about ten minutes: a deed carrying its own copy of the ids is a deed that
     * can disagree with the parties it is handed alongside, and it did. A
     * record whose holder is one person and whose description names another is
     * unreadable in forty years, which is the whole thing this ledger exists to
     * prevent.
     */
    /**
     * The ledger's own word for it. DATA. Carried onto the record and never
     * read by anything in this file.
     */
    cause: ObligationCause;
    paidBy: WhoPaid;
    /**
     * What it cost the payer, 0..1, AGAINST WHAT THEY HAD.
     *
     * Relative rather than absolute on purpose, and it is the field that makes
     * the model fair in both directions. A hundred stones off a beggar and a
     * hundred stones off a house treasury are not the same deed, in either
     * sign: the first is most of a life and the second is a rounding error, and
     * the same is true of the hundred stones given away.
     */
    cost: number;
    /**
     * True when what was taken or given does not come back.
     *
     * A life, a crippling, a road closed for good, a manual that was the last
     * copy. On the kindness side, a thing the giver will not have again.
     */
    irreversible?: boolean;
    /** True when a word was given first and not kept. Weighs one step. */
    promised?: boolean;
    onDay: DayIndex;
    /** Plain words for the ledger. Written by the caller; never parsed. */
    description: string;
    /**
     * Who knows a deed happened at all. Omit and everybody involved does.
     *
     * THE FIELD THAT MAKES DENIABILITY WORK, and it is not the same field as
     * how many people were standing there. A cultivation quietly poisoned reads
     * as a qi deviation; a junior left somewhere dangerous reads as bad luck; a
     * false pill reads as a body that could not take the medicine. In every one
     * of them something certainly happened and the person it happened to may
     * never have any idea there was anybody behind it.
     *
     * So: a principal who is not on this list opens NO ACCOUNT. They cannot -
     * a grudge is held against somebody, and they have no name to put on it.
     * What still exists is whatever the people who WERE there carry, which is
     * `truth depends on proximity` in its bluntest form and needs no separate
     * mechanism to say it.
     *
     * It also produces the ugliest thing in the model without anybody writing
     * it: when this list is short and shrinking, the cheapest way to keep it
     * short is another deed. Nothing here does that. It is simply what the
     * arithmetic already says, which is the test for whether a system is
     * modelling behaviour rather than listing it.
     */
    knownTo?: readonly string[];
    /** How many people could see it. Carried as a tag, never as a weight. */
    witnesses?: number;
    /** Anybody else the event touched, so the record is findable from them. */
    participants?: readonly string[];
    /** Free handles on top of the ones this file adds. */
    tags?: readonly string[];
    /** Ground-truth fact id, when the caller has one. */
    triggeringEventId?: string | null;
    /** True when the record rests on a belief rather than a confirmed fact. */
    fromBelief?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IT WAS WORTH
// ─────────────────────────────────────────────────────────────────────────

/**
 * The cost band at which a deed stops being an inconvenience.
 *
 * Two thresholds and nothing else, so that the whole scale is legible: below
 * the first it is a nuisance, above the second it is most of what somebody had.
 */
const A_REAL_COST = 0.4;
const MOST_OF_WHAT_THEY_HAD = 0.75;

/**
 * How heavy a record this deed deserves, in the ledger's own four words.
 *
 * A monotone walk up {@link SEVERITY_ORDER} with one step per fact that is
 * true, and that shape is the point: adding a fifth consideration later is
 * adding a step, not editing a table, and adding a tenth KIND of deed is adding
 * nothing at all.
 *
 * `grudges.ts` requires that severity be decided exactly once, at creation.
 * This is that decision. Nothing downstream recomputes it and nothing ages it.
 */
export function whatItWasWorth(deed: Deed): Severity {
    let steps = 0;
    if (deed.cost >= A_REAL_COST) steps++;
    if (deed.cost >= MOST_OF_WHAT_THEY_HAD) steps++;
    if (deed.irreversible) steps++;
    // A word given first is worth a step in both directions, which is not
    // symmetry for its own sake. Somebody who promised to help and did is owed
    // more than somebody who happened to; somebody who promised not to hurt you
    // and did is worse than somebody who never said anything.
    if (deed.promised) steps++;

    // ── AND A KINDNESS NOBODY WOULD HAVE KNOWN ABOUT IS WORTH MORE ───────
    //
    // The one place the two directions are not symmetric, and it is deliberate
    // rather than an oversight. Public virtue is cheap because reputation
    // already pays for it: helping somebody while five people watch buys
    // standing whether or not you meant any of it. Helping them where nobody
    // would ever have known you left them buys nothing at all, which is exactly
    // why it tells the recipient something no amount of public generosity
    // could - and it should therefore be worth more to them.
    //
    // The harm side needs no mirror of this and must not have one. It already
    // gets its version from `knownTo`, which is a stronger effect pointing the
    // other way: a wrong nobody saw opens NO ACCOUNT, because there is nobody
    // to hold one. So as the witnesses fall away a wrong gets cheaper and a
    // kindness gets dearer, off the same number, and by the time a party is
    // down to two people both are worth more than anything either of them
    // could have done in a town.
    if (deed.paidBy === 'actor' && (deed.witnesses ?? 0) === 0) steps++;

    return SEVERITY_ORDER[Math.min(steps, SEVERITY_ORDER.length - 1)];
}

/** True at `grave` and above. The band at which other people start carrying it. */
export function isHeavy(severity: Severity): boolean {
    return SEVERITY_ORDER.indexOf(severity) >= SEVERITY_ORDER.indexOf('grave');
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IT LEAVES
// ─────────────────────────────────────────────────────────────────────────

/**
 * How far past the two of them it got.
 *
 * Three words, and they describe WHO IS CARRYING IT rather than what anybody
 * intends to do. What a house does about a thing it is carrying is the
 * narrator's to answer from the record, which is the rule the whole social
 * layer runs on.
 */
export type HowFarItReached =
    /**
     * Something happened and nobody who could open an account knows it did.
     *
     * The deniable case, and it is not "nothing happened": the shame exists,
     * held by whoever was actually there, and the day somebody works it out is
     * a dated event with its own consequences -
     * `when-somebody-works-out-what-you-did.ts` is the worked example and its
     * whole argument is that the delay makes it worse rather than cheaper.
     */
    | 'nobody has worked it out'
    | 'the two of them'
    | 'their people'
    | 'the houses';

export interface WhatADeedLeaves {
    weight: Severity;
    /**
     * Every record the deed opens, holder-first.
     *
     * `[0]` is always the principal's own - the person it happened to, or their
     * nearest kin where they are no longer in a position to hold anything.
     */
    opens: ObligationInput[];
    /**
     * What the actor now carries that the people near them know, or null.
     *
     * Written only for a heavy wrong, and `heldBy` is deliberately the short
     * list rather than the world: this is the mechanism by which somebody can
     * be exactly what their own house knows them to be and perfectly
     * respectable two provinces away. `shame.ts` owns the rest of it.
     */
    shame: ShameInput | null;
    reached: HowFarItReached;
    /**
     * True when nobody involved can settle it and it is written to descend.
     *
     * The long tail, stated as a flag so a caller can say so rather than
     * inferring it from the kind.
     */
    willDescend: boolean;
    /** One factual line for the mechanical channel. Never narration. */
    note: string;
}

/**
 * Read a deed and say what the world now holds about it.
 *
 * The order is the order of the argument: what it was worth, who holds the
 * personal account, who else ends up carrying it, and whether there is anybody
 * it could be settled with.
 */
export function whatADeedLeaves(input: {
    deed: Deed;
    actor: Party;
    subject: Party;
    /** How far the aggrieved side can get at the actor. Ignored for a kindness. */
    reach?: Reach;
    /**
     * True when the principal is in no position to hold anything themselves -
     * dead, or gone. Their people hold it instead, from day one, rather than
     * inheriting it later.
     */
    principalCannotHoldIt?: boolean;
}): WhatADeedLeaves {
    const { deed, actor, subject } = input;
    const aKindness = deed.paidBy === 'actor';
    const personal = whatItWasWorth(deed);

    // Who ends up on which side of the row. A kindness is held BY the person
    // who paid for it ABOUT the person who has it - `grudges.ts`: "a favour is
    // owed to [the holder]". A wrong is held by the person it was done to.
    // One expression, both directions, and that is the whole symmetry.
    const principal = aKindness ? actor : subject;
    const other = aKindness ? subject : actor;

    // The house's own reading, from the module that already answers it. A
    // kindness done to somebody a house has invested in is a thing the house
    // notices for exactly the reasons a wrong is, so the same verdict runs.
    const verdict = whenItIsDoneToOneOfOurs({
        alignment: (aKindness ? subject : subject).alignment,
        ranked: subject.ranked,
        wasAnAttachment: false,
        ask: isHeavy(personal) ? 'against_their_interest' : 'a_courtesy'
    });

    // A house only imposes a floor on a wrong. It has no floor to impose on a
    // gift: a house cannot decide that its member is MORE grateful than they
    // are, and a favour whose weight the recipient's house inflated would be
    // the institution manufacturing a debt nobody incurred.
    const weight = aKindness ? personal : severityWithHouse(personal, verdict.severityFloor);

    const reach: Reach = aKindness ? 'unbacked' : (input.reach ?? 'unbacked');
    const heavy = isHeavy(weight);
    const houseIsAParty = subject.ranked && subject.houseId !== null
        && (heavy || verdict.houseIsAParty);
    // Nobody can be made to answer, and the account was worth carrying. That is
    // the one combination the ledger has a separate kind for.
    const willDescend = !aKindness && heavy && reach === 'beyond';

    const baseTags = [
        `deed:${aKindness ? 'given' : 'taken'}`,
        `cost:${bandOf(deed.cost)}`,
        ...(deed.irreversible ? ['irreversible'] : []),
        ...(deed.promised ? ['promised'] : []),
        ...((deed.witnesses ?? 0) > 0 ? ['witnessed'] : []),
        ...(aKindness ? [] : [`reach:${reach}`]),
        ...(deed.tags ?? [])
    ];

    const commonToAll = {
        cause: deed.cause,
        onDay: deed.onDay,
        triggeringEventId: deed.triggeringEventId ?? null,
        fromBelief: deed.fromBelief ?? false
    };

    const opens: ObligationInput[] = [];
    const kin = principal.kin ?? [];
    const carriedForThem = Boolean(input.principalCannotHoldIt);

    // ── WHETHER ANYBODY KNOWS THERE WAS A DEED AT ALL ────────────────────
    //
    // Nobody opens an account against a name they have not got. A poisoning
    // that reads as a deviation, a junior left somewhere that reads as bad
    // luck, a false pill that reads as a body which could not take the
    // medicine - in every one of them the harm is real, the ledger is empty,
    // and what exists instead is a short list of people who were there.
    const knows = (id: string): boolean =>
        deed.knownTo === undefined || deed.knownTo.includes(id);

    // ── THE PERSONAL ACCOUNT ─────────────────────────────────────────────
    //
    // Held by the person it happened to, unless they are in no position to hold
    // anything - in which case their nearest people hold it from day one. The
    // dead hold nothing, which is the resolver's own observation and the reason
    // a killing used to fall out of the ledger entirely.
    if (!carriedForThem && knows(principal.id)) {
        opens.push({
            ...commonToAll,
            kind: kindFor(aKindness, willDescend),
            holderId: principal.id,
            subjectId: other.id,
            severity: weight,
            description: deed.description,
            participants: dedupe([
                ...(deed.participants ?? []),
                ...(houseIsAParty && subject.houseId ? [subject.houseId] : [])
            ]),
            tags: baseTags
        });
    }

    // ── AND WHO ELSE CARRIES IT ──────────────────────────────────────────
    //
    // Kin, at the same weight, when it was heavy enough to be a thing the
    // family has rather than a thing one person has. `grudges.ts` is explicit
    // that inheritance does not discount, and neither does this: the brother
    // holds what the brother holds.
    if (heavy || carriedForThem) {
        for (const relative of kin) {
            if (relative.id === other.id) continue;
            if (!knows(relative.id)) continue;
            opens.push({
                ...commonToAll,
                kind: kindFor(aKindness, willDescend),
                holderId: relative.id,
                subjectId: other.id,
                severity: weight,
                description: `${deed.description} ${principal.name} was theirs.`,
                participants: dedupe([
                    principal.id,
                    ...(deed.participants ?? []),
                    ...(houseIsAParty && subject.houseId ? [subject.houseId] : [])
                ]),
                tags: [...baseTags, `carried:${relative.relation}`]
            });
        }
    }

    // ── AND WHAT THE HOUSE ENDS UP HOLDING ───────────────────────────────
    //
    // This is the escalation the owner asked for, and the only thing that
    // decides how far it goes is standing on the two sides: whether the house
    // had anything invested in the person, and whether there is anybody to take
    // it to. A house does not need to be told it is angry.
    if (houseIsAParty && subject.houseId && knows(subject.houseId)) {
        const actorsHouse = reach === 'answerable' && actor.houseId && actor.houseId !== subject.houseId
            ? [actor.houseId]
            : [];
        opens.push({
            ...commonToAll,
            kind: kindFor(aKindness, willDescend),
            holderId: subject.houseId,
            // Where the actor answers to a house, the account names the house
            // and not only the person. That is what "between houses" means and
            // it is why which houses depends on who did it.
            subjectId: aKindness ? actor.id : (actorsHouse[0] ?? actor.id),
            severity: weight,
            description:
                `${deed.description} ${subject.name} was ${subject.houseName ?? 'the house'}'s.`,
            participants: dedupe([
                actor.id,
                subject.id,
                ...actorsHouse,
                // Allies are named, never made holders. A house that stands
                // with another can find this record from its own side without
                // the engine having decided on its behalf that it cares.
                ...(subject.alliedHouseIds ?? [])
            ]),
            tags: [...baseTags, 'institutional']
        });
    }

    const reached: HowFarItReached = opens.length === 0
        ? 'nobody has worked it out'
        : opens.some(o => o.holderId === subject.houseId)
            ? 'the houses'
            : opens.length > 1 || carriedForThem
                ? 'their people'
                : 'the two of them';

    return {
        weight,
        opens,
        shame: aKindness ? null : shameFor(deed, actor, weight, subject),
        reached,
        willDescend,
        note: noteFor({ aKindness, weight, reached, willDescend, reach, actor, subject, verdict })
    };
}

/**
 * Which of the ledger's kinds this is.
 *
 * Three of the five, and the third is not a heavier grudge. `grudges.ts` keeps
 * `blood_feud` separate because it runs between lines, is expected to be
 * inherited, and everyone involved knows it is running - all three of which are
 * true of a grave wrong nobody can be made to answer for, and of nothing else
 * this function produces.
 */
function kindFor(aKindness: boolean, willDescend: boolean): ObligationKind {
    if (aKindness) return 'favor';
    return willDescend ? 'blood_feud' : 'grudge';
}

/**
 * What the actor now carries among the people near them, or null.
 *
 * The join to `shame.ts`, and the two fields it turns on are deliberately
 * different fields:
 *
 *   WHO HOLDS IT   `heldBy` - the short list. Concealment lives here, and a
 *                  wrong three people hold is a wrong nobody says anything
 *                  about in either direction.
 *   WHAT IS SAID   nowhere in this file. Praise and slander are speech, they
 *                  travel through the gossip layer, and they are NOT this
 *                  record. `what-is-said-about-somebody.ts` keeps them apart
 *                  on purpose: a hidden wrong nobody discusses and a man
 *                  admired for things he did not do are different situations
 *                  and one field could not carry both.
 *
 * Only for a heavy wrong. A slight one is an unpleasantness rather than a thing
 * that lowers somebody every time it is remembered, and writing one for every
 * petty theft would make the module into the morality score it says it is not.
 */
function shameFor(
    deed: Deed,
    actor: Party,
    weight: Severity,
    subject: Party
): ShameInput | null {
    if (!isHeavy(weight)) return null;
    return {
        subjectId: actor.id,
        cause: 'known_for_a_grave_deed',
        severity: weight,
        onDay: deed.onDay,
        description: deed.description,
        // The people who were actually there, plus the person it was done to.
        // Nothing here widens it: somebody has to tell somebody, and that is
        // the gossip layer's business rather than this one's.
        heldBy: dedupe([subject.id, ...(deed.participants ?? [])]),
        // A thing a crowd saw is not a thing a short list holds. The list has
        // stopped meaning anything, and `shame.ts` keeps that separate from the
        // list's length for exactly this reason.
        common: (deed.witnesses ?? 0) >= A_CROWD
    };
}

/** The point at which a room stops being a list of people who were there. */
const A_CROWD = 6;

function noteFor(input: {
    aKindness: boolean;
    weight: Severity;
    reached: HowFarItReached;
    willDescend: boolean;
    reach: Reach;
    actor: Party;
    subject: Party;
    verdict: ReturnType<typeof whenItIsDoneToOneOfOurs>;
}): string {
    if (input.aKindness) {
        return input.reached === 'the houses'
            ? `${input.subject.houseName ?? 'The house'} is owed something on behalf of one of `
              + 'its own, and a house that is owed something is a door that opens without a '
              + 'price on it.'
            : input.reached === 'their people'
                ? 'It is not only theirs. The people around them hold it too, and they will '
                  + 'still hold it when the person it was done for is gone.'
                : 'One person owes another person something. That is worth more than money in '
                  + 'this world and it is not written anywhere they can see.';
    }
    if (input.willDescend) {
        return 'There is nobody who can be made to answer for it, so it is not written down as '
            + 'a thing to be settled. It is written down as a thing to be carried, and it will '
            + 'reach people who were not born when it happened.';
    }
    if (input.reached === 'the houses') {
        return input.reach === 'answerable'
            ? `It stopped being between two people. ${input.subject.houseName ?? 'The house'} `
              + 'holds it, and the name on it is a house rather than a person. ' + input.verdict.note
            : `${input.subject.houseName ?? 'The house'} holds it, and the name on it is the `
              + 'person who did it, who answers to nobody. ' + input.verdict.note;
    }
    return input.reached === 'their people'
        ? 'They are in no position to hold it themselves. The people nearest them hold it '
          + 'instead, from the day it happened rather than from the day they died.'
        : 'It stays between the two of them. Nobody else has been told and nobody else is '
          + 'carrying it.';
}

function bandOf(cost: number): string {
    if (cost >= MOST_OF_WHAT_THEY_HAD) return 'most_of_what_they_had';
    if (cost >= A_REAL_COST) return 'real';
    return 'small';
}

function dedupe(ids: readonly string[]): string[] {
    return [...new Set(ids.filter(id => id.length > 0))];
}

/** Exported so a probe can print the bands without restating them. */
export const DEED_CONSTANTS = Object.freeze({
    A_REAL_COST,
    MOST_OF_WHAT_THEY_HAD,
    A_CROWD
});
