/**
 * Which wrong the player's telling reaches, and what the hearer ends up holding.
 *
 * `telling-a-wrong.ts` reads the sentence. This reads the world and does the
 * join, and it is the `tell` verb's half of exactly what
 * `asking-what-people-are-saying.ts` is to `news`: it finds the deed, works out
 * who the hearer would open an account on behalf of, and hands both to
 * `whatBeingToldOpens`. It writes nothing - reading the world and writing the
 * ledger are two jobs, and this module has no ledger.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE DEED IS FOUND BY WHO IT WAS DONE TO, NEVER BY WHO IS BEING BLAMED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * This is the single decision the whole file turns on, and taking the obvious
 * other one would delete the design.
 *
 * The player says *"Cao Antao killed your brother"*. If the deed were looked up
 * by Cao Antao, then a player repeating a story that named the wrong man would
 * find nothing and the telling would die - and a wrong name held with complete
 * conviction is the best thing the news layer buys. So the search is over wrongs
 * done to somebody THE HEARER CARRIES FOR, and the name the player used is
 * carried through untouched as the party the account opens against.
 *
 * Nothing here compares the two. `hearing-of-a-wrong.ts` is explicit that a
 * hearer who could tell a true telling from a false one would need
 * `KnowledgeLedger`'s omniscient view, and the engine keeps the ability to say
 * otherwise later through `isGroundless` and `recordAccuracy`.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * A TELLING CARRIES ONLY WHAT THE TELLER HOLDS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The gate, and it is the discovery rule rather than a balance one. Without it,
 * a player could stand in a square saying *"X killed your brother"* to strangers
 * and read off the answers which of them had lost somebody - learning, through
 * the RESULT path, a fact about the world they had no route to. That is the door
 * `docs/world/houses/discovery.md` shuts, arriving through a verb instead of
 * through a lookup.
 *
 * So a telling reaches a deed only where the teller could already point at it:
 * they were in it or standing there, or they can name the person it was done to,
 * which is what somebody who heard the story in a square holds afterwards.
 *
 * **The gate is coarser than it should be, and the reason is a column nobody
 * writes.** `knowledge_records` has a `fact_id` and the only statement that
 * inserts into that table writes NULL into it, every time - so *does this holder
 * hold THIS event* is not a question the knowledge layer can answer today, and
 * being able to name the people in it is the closest available proxy. It admits
 * a teller who knows the victim for unrelated reasons. Writing the column is the
 * fix, and it is not this verb's to make.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHICH SILENCES ARE ONE SILENCE, AND WHICH ARE ANSWERS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The line runs at the gate, and it runs there rather than anywhere else.
 *
 * BEFORE the gate, every way of reaching nothing is ONE answer. A telling that
 * found no deed and a telling the teller had no grounds for must be
 * indistinguishable from outside, or the SHAPE of the answer is the answer and
 * the gate leaks through the thing that was built to hold it. So
 * {@link NothingLanded} folds those two into one value on purpose, and the
 * engine's own account of which it was goes to the inspector.
 *
 * PAST the gate, they are four different answers and should be. Reaching
 * {@link WhatATellingLandsOn.heldBack} at all means the teller could already
 * point at a real wrong done to somebody this hearer carries for - so being
 * told your news is old, or that you have just accused a man to his own face,
 * discloses nothing they were not already carrying. Those are things the hearer
 * DID with what they were told, and a coherent sentence is owed one.
 */

import type { EngineFacts } from './facts.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { HistoricalFact } from '../engine/world/history.js';
import type { NpcRecord } from '../engine/world/npc-state.js';
import type {
    ObligationCause,
    ObligationInput,
    ObligationRecord,
    Severity
} from '../engine/social/grudges.js';
import { SEVERITY_ORDER } from '../engine/social/grudges.js';
import {
    whatBeingToldOpens,
    type TheDeedAsItStands,
    type WhatBeingToldOpens,
    type WhoTheyCarryFor
} from '../engine/social/hearing-of-a-wrong.js';

// ─────────────────────────────────────────────────────────────────────────
// WHO SOMEBODY CARRIES FOR
// ─────────────────────────────────────────────────────────────────────────

/**
 * The ties that make somebody else's loss yours to hold.
 *
 * Blood and the two teaching ties, which is `hearing-of-a-wrong.ts`'s own list -
 * "kin, a chosen disciple, a house's own" - as far as the relationship layer
 * actually goes. Deliberately not `ally`, `rival`, `patron` or `acquaintance`:
 * everybody in the province hears that somebody was killed, and the whole
 * standing test is that the brother is the one who now holds something.
 */
const CARRIED_FOR: ReadonlySet<string> =
    new Set(['kin', 'spouse', 'parent', 'child', 'master', 'disciple']);

/**
 * Who this hearer would open an account on behalf of.
 *
 * Themselves, always, plus whoever they are tied to closely enough to carry.
 * Read off the person's own relationship rows rather than looked up in a table,
 * because `the-ties-an-ordinary-life-produces.ts` is what puts them there and a
 * second opinion about who somebody's family is would drift from it.
 */
export function whoTheyCarryFor(hearerId: string, hearer: NpcRecord | null): WhoTheyCarryFor {
    if (hearer === null) return { hearerId, ids: [hearerId] };
    const relationOf: Record<string, string> = {};
    const ids = [hearerId];
    for (const tie of hearer.relationships) {
        if (!CARRIED_FOR.has(tie.kind)) continue;
        if (ids.includes(tie.targetId)) continue;
        ids.push(tie.targetId);
        relationOf[tie.targetId] = tie.kind;
    }
    return { hearerId, ids, relationOf };
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE TELLING REACHED
// ─────────────────────────────────────────────────────────────────────────

/** Why the telling landed on nothing. Engine-only; see the header. */
export type NothingLanded =
    /** The world is off. Nothing has a history to be about. */
    | 'no world'
    /**
     * No priced deed anywhere in the world's history was done to anybody this
     * hearer carries for - or none the teller could point at.
     *
     * One value covering both on purpose. Splitting them is what would let a
     * player read the gate off the answer.
     */
    | 'nothing they could be told'
    /** The join declined it. `heldBack` carries which of its four reasons. */
    | 'the hearer holds nothing new';

export interface WhatATellingLandsOn {
    /** The row to write, or null. Carries the HELD id where a name attached. */
    opens: ObligationInput | null;
    /** Which of the three transitions, when one happened. */
    did: WhatBeingToldOpens['did'] | null;
    /** Why nothing happened, when nothing did. */
    landed: NothingLanded | null;
    /** The fact the telling was taken to be about, when one was found. */
    factId: string | null;
    /** Who the account is against, as the telling named them. Never checked. */
    againstAsTold: string | null;
    /**
     * The join's own reason, where a deed WAS found and it declined it.
     *
     * Kept separate from {@link NothingLanded} because these four are safe to
     * answer in detail and the others are not. Reaching one of them means the
     * telling got past the gate - the teller could point at a real wrong done to
     * somebody this hearer carries for - so saying what happened to it discloses
     * nothing the player did not already hold. Being told your news is old is an
     * answer; being told nothing is not.
     */
    heldBack: WhatBeingToldOpens['heldBack'];
    /** Engine truth, one line, for the mechanical channel. Never narration. */
    note: string;
}

export interface ATellingPutToSomebody {
    world: WorldState | null;
    /** The person being told, resolved. */
    hearerId: string;
    /** Their world row, for the ties. Null where the world has none for them. */
    hearer: NpcRecord | null;
    /** Who the player is. Their name goes on the row as the teller. */
    tellerId: string;
    /**
     * Who the player put it on, resolved to an id, or null where they named
     * nobody for it.
     *
     * Unchecked, and it is the point. See the header.
     */
    blamedId: string | null;
    /** The run's clock. The account is dated to the day they were told. */
    onDay: number;
    /**
     * Whether the teller could point at this deed at all.
     *
     * Supplied by the caller because it is a question about the knowledge
     * tables, which this module has no handle on. See the header for why the
     * available answer is coarse.
     */
    canPointAt: (fact: HistoricalFact) => boolean;
    /** The account this hearer already carries about that event, or null. */
    heldAbout: (factId: string) => ObligationRecord | null;
}

/**
 * Read a telling against the world and say what the hearer now holds.
 *
 * The order is: who they carry for, what was done to any of them that the teller
 * could point at, the heaviest of those they are not already carrying a named
 * account about - and then the join, which owns every decision about the row.
 */
export function whatATellingLandsOn(input: ATellingPutToSomebody): WhatATellingLandsOn {
    if (input.world === null) return nothing('no world', 'No world loaded; a telling has no history to be about.');

    const carriesFor = whoTheyCarryFor(input.hearerId, input.hearer);
    const theirs = new Set(carriesFor.ids);

    const candidates = input.world.history.facts
        .filter(fact => aPricedWrongDoneTo(fact, theirs))
        .filter(input.canPointAt);
    if (candidates.length === 0) {
        return nothing('nothing they could be told',
            `Nothing in the world's history is a priced deed done to ${input.hearerId} or to `
            + `any of the ${carriesFor.ids.length - 1} people they carry for that this teller `
            + 'could point at.');
    }

    // Heaviest first, then most recent. A person carrying several wrongs is
    // being told about the one that would matter most, which is the only
    // ordering the words the player used could plausibly have meant - and where
    // they already hold that one, the one below it is still news.
    const ordered = [...candidates].sort((a, b) =>
        SEVERITY_ORDER.indexOf(weightOf(b)!) - SEVERITY_ORDER.indexOf(weightOf(a)!)
        || b.day - a.day);

    let lastNote = '';
    let lastHeldBack: WhatBeingToldOpens['heldBack'] = null;
    for (const fact of ordered) {
        const deed = theDeedAsItStands(fact);
        const held = input.heldAbout(fact.id);
        const opened = whatBeingToldOpens({
            telling: {
                hearerId: input.hearerId,
                onDay: input.onDay,
                factId: fact.id,
                blamedId: input.blamedId,
                // Everybody the deed names except whoever the player put it on.
                // The join looks in here for somebody the hearer carries for,
                // and requires that person not be the one being blamed.
                alsoNamedIds: fact.actors
                    .map(actor => actor.id)
                    .filter(id => id !== input.blamedId),
                // A name came through, or it did not. Never `unattributed`: a
                // person standing in front of you saying words is not a
                // consequence that arrived with nothing legible in it.
                form: input.blamedId === null ? 'partial' : 'named',
                // The closed vocabulary's word for a person telling you to your
                // face. Not `witnessed`, which is first hand and would set
                // `fromBelief` false - the hearer did not see this, they were
                // told, and the row has to say so.
                channel: 'friend',
                fromHolderId: input.tellerId
            },
            deed,
            carriesFor,
            held
        });
        lastNote = opened.note;
        lastHeldBack = opened.heldBack;
        if (opened.opens !== null) {
            return {
                opens: opened.opens,
                did: opened.did,
                landed: null,
                factId: fact.id,
                againstAsTold: opened.againstAsTold,
                heldBack: null,
                note: opened.note
            };
        }
    }

    return {
        opens: null,
        did: null,
        landed: 'the hearer holds nothing new',
        // The deed IS named here, unlike every other way of reaching nothing.
        // It got past the gate, so the player already holds it and there is
        // nothing to withhold.
        factId: ordered[ordered.length - 1].id,
        againstAsTold: null,
        heldBack: lastHeldBack,
        note: `${ordered.length} priced wrong(s) matched and none opened anything. ${lastNote}`
    };
}

function nothing(landed: NothingLanded, note: string): WhatATellingLandsOn {
    return {
        opens: null, did: null, landed, factId: null,
        againstAsTold: null, heldBack: null, note
    };
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE PLAYER IS TOLD BACK
// ─────────────────────────────────────────────────────────────────────────

/**
 * The answer, and every branch of it is about the WORLD.
 *
 * The refusal this replaces was *"They look at you the way people look at a
 * sentence with a hole in it"*, produced for a sentence any person would have
 * answered instantly, and produced from the branch where the game had already
 * worked out exactly who the player meant. That is the game saying *I did not
 * understand you* dressed as *the world did not care*, and a player cannot tell
 * the two apart. AGENTS.md's line about a sentence being a plan applies at full
 * strength: a coherent sentence gets a real answer.
 *
 * So there is no branch here that says the sentence was unintelligible. Every
 * one of them says what the person did with what they were told - held it,
 * started looking, put a name on something they had been carrying, or heard it
 * out and had nothing to do with it. Indifference is an answer; not being
 * understood is not.
 *
 * And the last of those is ONE sentence for every way of reaching nothing. See
 * the header: if the shape of the answer changed with the reason, a player could
 * read the knowledge gate off it and learn what the gate exists to withhold.
 */
export function factsForTelling(input: {
    landedOn: WhatATellingLandsOn;
    /** Who was told, by their name, which the player could already say. */
    hearer: string;
    /** Who the player put it on, by the name they used. Null where they named nobody. */
    blamed: string | null;
    /** What the player said, in their own words. */
    claim: string;
}): EngineFacts {
    const { landedOn, hearer, blamed } = input;

    const line = landedOn.did === 'opened against a name'
        ? `${hearer} hears you out, and you can see the moment it lands. `
          + `They hold it against ${blamed ?? 'the name you gave'} from today - not from `
          + 'the day it happened, which they did not have, but from the day somebody told '
          + 'them. Your name is on it as the person who did.'
        : landedOn.did === 'put a name on what they carried'
            ? `${hearer} has been carrying this a long time without a name on it. Now it has `
              + `one. It is the same account at the same weight, and ${blamed ?? 'the name you gave'} `
              + 'is who it is against - because you are who told them.'
            : landedOn.did === 'opened against nobody'
                ? `${hearer} did not know. They do now, and you have given them nobody to put `
                  + 'it on, so what they have is an open account and a reason to go asking. '
                  + 'A name would attach to that same account, whenever one reaches them.'
                : whatTheyDidWithIt(hearer, landedOn.heldBack);

    return {
        headline: landedOn.opens === null
            ? `${hearer} hears it and holds nothing.`
            : `${hearer} holds an account as of today.`,
        lines: [line],
        prose: line,
        // The engine's own account, including which of the several ways of
        // landing on nothing this was. Never in `lines`, because that reaches a
        // narrator and a narrator told which gate stopped it will hint at it.
        structure: [
            `tell: claim "${input.claim}", put to ${hearer}, `
            + `blamed as told ${landedOn.againstAsTold ?? 'nobody'}. `
            + `${landedOn.did ?? `nothing: ${landedOn.landed}`}. `
            + `fact ${landedOn.factId ?? 'none'}. ${landedOn.note}`
        ]
    };
}

// ─────────────────────────────────────────────────────────────────────────
// READING THE FACT
// ─────────────────────────────────────────────────────────────────────────

/**
 * The weight the deed was priced at on the day, or null where nobody priced it.
 *
 * `deedWeight` is stamped by `aDeedEntersTheWorld` and by nothing else, so its
 * presence is exactly the question *did anybody price this as a deed*. A war, a
 * succession or a spirit tide has no answer to that, and a person cannot hold an
 * account about one.
 */
function weightOf(fact: HistoricalFact): Severity | null {
    const weight = fact.data.deedWeight;
    return typeof weight === 'string' && SEVERITY_ORDER.includes(weight as Severity)
        ? weight as Severity
        : null;
}

/** Whether this fact is a priced wrong done to somebody in the set, by somebody else. */
function aPricedWrongDoneTo(fact: HistoricalFact, theirs: ReadonlySet<string>): boolean {
    if (weightOf(fact) === null) return false;
    const doer = doerOf(fact);
    return fact.actors.some(actor => actor.id !== doer && theirs.has(actor.id));
}

/**
 * Which actor the writer said did it.
 *
 * The same three answers `asking-what-people-are-saying.ts` reads, in the same
 * order and for the same reason: `deedNamesNobody` is the honest record for a
 * body found on the low road, `deedDoerId` is the writer saying outright, and
 * absent both, every `aDeedEntersTheWorld` caller already puts the doer first.
 */
function doerOf(fact: HistoricalFact): string | null {
    if (fact.data.deedNamesNobody === true || fact.actors.length === 0) return null;
    const stamped = fact.data.deedDoerId;
    if (typeof stamped === 'string') {
        return fact.actors.some(actor => actor.id === stamped) ? stamped : null;
    }
    return fact.actors[0].id;
}

/**
 * Whether the teller could point at this deed at all.
 *
 * Two ways, and both are things the world already records. They were in it -
 * an actor or a witness, which covers the player confessing to their own deed
 * and the player reporting what they watched happen. Or they can name the
 * person it was done to, which is what somebody who heard the story in a square
 * holds afterwards, because a rumour writes a knowledge record for everybody it
 * named.
 *
 * `knows` is the caller's, because it is a question about the knowledge tables.
 * See the header for why the available form of it is coarser than the question.
 */
export function couldPointAtIt(
    fact: HistoricalFact,
    tellerId: string,
    knows: (personId: string) => boolean
): boolean {
    if (fact.actors.some(actor => actor.id === tellerId)) return true;
    if (fact.witnessIds.includes(tellerId)) return true;
    const doer = doerOf(fact);
    return fact.actors.some(actor => actor.id !== doer && knows(actor.id));
}

/**
 * The deed as the world already holds it.
 *
 * Every field was decided elsewhere and is carried through untouched. Nothing
 * here re-prices anything: finding out late makes a thing held, not heavier.
 */
function theDeedAsItStands(fact: HistoricalFact): TheDeedAsItStands {
    const stamped = fact.data.deedCause;
    return {
        weight: weightOf(fact)!,
        cause: (typeof stamped === 'string' ? stamped : 'other') as ObligationCause,
        kind: 'grudge',
        // Whether a stranger could have done it, which is the one question the
        // middle state turns on. A deed carrying a word given first names its
        // own subject by definition.
        how: { promised: fact.data.deedPromised === true },
        description: fact.summary,
        participants: fact.actors.map(actor => actor.id),
        tags: [`kind:${fact.kind}`, 'told-to-their-face']
    };
}

/**
 * The answer where the telling reached a real wrong and opened nothing.
 *
 * Four of these, and every one of them is a thing the hearer DID with what they
 * were told. That is the whole distinction the last branch turns on: being told
 * your news is old, or that you are telling a man he wronged himself, are
 * answers about the world, and a player can act on either. The fifth line - the
 * one for a telling that reached no wrong at all - says nothing about the hearer
 * because there is nothing that can be said without disclosing what the gate
 * exists to withhold.
 *
 * Safe to be this specific for exactly the reason the field's own note gives:
 * getting here means the teller could already point at the deed, so none of
 * these tells them anything they were not already carrying.
 */
function whatTheyDidWithIt(
    hearer: string,
    heldBack: WhatBeingToldOpens['heldBack']
): string {
    switch (heldBack) {
        case 'they already had it':
            return `${hearer} lets you finish and then tells you they know. Whatever they `
                + 'mean to do about it, they were already going to, and hearing it a second '
                + 'time is not being wronged a second time.';
        case 'it names them':
            return `${hearer} hears you put it on them, to their face, and looks at you `
                + 'rather than at the ground. Nobody opens an account against themselves - '
                + 'what you have done is tell somebody you think they did it.';
        case 'a wrong like this comes with a name':
            return `${hearer} hears you out and says, flatly, that a thing like that is not `
                + 'done by a stranger. Whoever it was, they knew them, and telling it with '
                + 'nobody in it is telling them nothing they had not worked out.';
        default:
            return `${hearer} hears you out to the end and goes back to what they were doing. `
                + 'Nothing in what you said touches anything they have lost, and news only '
                + 'carries as far as you can point at what was done - something you were '
                + 'part of, or something you have actually been told.';
    }
}
