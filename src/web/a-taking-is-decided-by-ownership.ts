/**
 * Whose the thing is, asked of the world, before anything calls it a theft.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE RULING
 * ═════════════════════════════════════════════════════════════════════════
 *
 *   Saying "take" about something that is not yours - and is not genuinely
 *   free, like an apple in the middle of nowhere - is stealing.
 *
 * Measured against ollama/gemma4:31b on politely-worded takings, and again
 * against the deterministic table, which was worse in a different direction:
 *
 *   "I relieve him of his purse"              give / unclear
 *   "I collect what I am owed from his rooms" sect
 *   "I pick up the manual on my way out"      buy / learn_technique
 *   "I help myself to what is on the rack"    interact / site
 *
 * The first is the worst thing the reading layer can produce: the player tried
 * to rob somebody and the engine was told they handed something over.
 * `narrator.ts` guards a MODEL against turning a gift into a theft because the
 * two have opposite signs on every consequence; this is the same failure
 * running the other way, through a table nobody was watching.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY THERE IS NO VOCABULARY IN THIS FILE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * There is no hostile word in any of those sentences. "Take", "collect", "pick
 * up" and "help myself" are the ordinary words for handling your own
 * possessions and have to keep working when the thing IS yours. A list of
 * polite theft verbs is the treadmill: the next player writes "I make free
 * with", and the list grows forever while the class stays open.
 *
 * So the sentence is read for one thing only - **whether it says whose it is**
 * - and the answer is then checked against the world, which is the only thing
 * that knows. `whoTheSentenceSaysItIs` is that read and it is three lines long
 * on purpose.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THREE STATES, AND ONLY THE MIDDLE ONE IS A THEFT
 * ═════════════════════════════════════════════════════════════════════════
 *
 *   yours     nothing happened. It is already in your hands.
 *   theirs    a taking, and everything that already follows one.
 *   nobody's  a find. The apple in the middle of nowhere stays free, or the
 *             world becomes a museum where nothing may be picked up.
 *
 * Nothing here decides what a taking COSTS, whether it came off, who is owed
 * what or what they do about it. `resolveAttempt`, `whatTheyDoAboutBeingWronged`
 * and `createObligation` already own all four, and this file's whole job is to
 * hand them a taking they would otherwise never have seen.
 *
 * ── AND THE ORDER OF EVIDENCE IS THE DESIGN ──────────────────────────────
 *
 * The world's own rows are asked FIRST and the sentence second, because a row
 * is a fact and a possessive is a claim. Somebody who says "his sword" while
 * holding their own is holding their own. The sentence is consulted only where
 * the world has no row to answer with - a purse is not an object row and never
 * will be - and even then it supplies only *somebody else's*, never who: who is
 * whoever the world says is standing here.
 */

import {
    describeObject,
    isRuined,
    isTracked,
    transferPossession,
    type ObjectRecord
} from '../engine/world/possessions.js';
import {
    whatIsWithinReachOf,
    whichThingTheyMeant,
    type WithinReach
} from './object-theft.js';
import { A_PORTABLE_THING } from './verb-pattern-table.js';
import { factsForRefusal } from './facts.js';
import { othersPresent } from './hearsay.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { Execution } from './turn-wire-shapes.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { GameService } from './turn-engine.js';

/** Who the world says holds it. */
export interface Holder {
    id: string;
    name: string;
}

export type TakingState = 'yours' | 'theirs' | 'nobodys';

/**
 * Why the answer is the answer.
 *
 * Carried because the two `nobodys` cases are genuinely different situations
 * and a report that collapsed them would be lying about one of them: a free
 * row here is a find, and nothing of that description belonging to anybody is
 * nothing to take.
 */
export type TakingGround =
    | 'in-your-hands'
    | 'carried'
    | 'moored'
    | 'the-sentence-says-somebody-elses'
    | 'standing-free'
    | 'nobody-holds-it';

export interface WhoseThing {
    state: TakingState;
    /** What was named, as the player named it. */
    thing: string;
    /** Set for `theirs`, and only then. */
    holder: Holder | null;
    /** The row, where the world has one. A purse has none and never will. */
    object: ObjectRecord | null;
    ground: TakingGround;
}

/**
 * What everybody standing here has within reach, the taker included.
 *
 * A separate type from `WithinReach` because the question this file asks is
 * *whose*, and a reach with no holder on it cannot answer it.
 */
export interface ReachableFrom {
    holder: Holder;
    within: readonly WithinReach[];
}

export interface TakingEvidence {
    /** The words for the thing. Read by the matcher; never read for ownership. */
    said: string;
    /** Everything the taker already has. */
    yours: readonly WithinReach[];
    /** Everybody else here, and what each of them has within reach. */
    theirs: readonly ReachableFrom[];
    /** Tracked rows standing here that nobody holds and nobody owns. */
    free: readonly ObjectRecord[];
    /** The one read taken off the player's sentence. */
    saysItIs: WhoTheSentenceSaysItIs;
}

// ─────────────────────────────────────────────────────────────────────────
// THE ONE THING THE SENTENCE IS ASKED
// ─────────────────────────────────────────────────────────────────────────

/**
 * Whether the player said whose it is. Not whether they said anything hostile.
 *
 * Three answers and no verb list. `unsaid` is by far the commonest and is not a
 * failure - "I pick up the manual" says nothing about whose manual it is, which
 * is exactly why the world has to be asked.
 */
export type WhoTheSentenceSaysItIs = 'mine' | 'somebody-elses' | 'unsaid';

/**
 * A possessive standing in front of something.
 *
 * `my` is required to be in front of a PORTABLE THING rather than in front of
 * anything, because "on my way out" is in one of the measured sentences and it
 * is not a claim of ownership over a way. The other possessives are admitted in
 * front of any noun: "from his rooms" is the whole of what makes that sentence
 * a taking, and rooms are not portable.
 */
const MINE = new RegExp(
    `\\b(?:my own\\s+\\w+|my\\s+(?:own\\s+)?(?:${A_PORTABLE_THING})|mine)\\b`, 'i'
);
const SOMEBODY_ELSES = new RegExp(
    "\\b(?:his|her|their|its|hers|theirs|somebody(?: else)?'s|someone(?: else)?'s"
    + "|[a-z]+(?:'s|s'))\\s+\\w+", 'i'
);

export function whoTheSentenceSaysItIs(said: string): WhoTheSentenceSaysItIs {
    if (MINE.test(said)) return 'mine';
    if (SOMEBODY_ELSES.test(said)) return 'somebody-elses';
    return 'unsaid';
}

// ─────────────────────────────────────────────────────────────────────────
// THE DECISION
// ─────────────────────────────────────────────────────────────────────────

/**
 * Which of the three it is.
 *
 * Pure: evidence in, an answer out. No I/O, no world mutation, nothing rolled -
 * there is nothing here for a seed to decide, because whose a thing is is not a
 * matter of chance.
 */
export function whoseThingIsThis(evidence: TakingEvidence): WhoseThing {
    const thing = evidence.said.trim();
    const nothing = (state: TakingState, ground: TakingGround): WhoseThing =>
        ({ state, thing, holder: null, object: null, ground });

    // ── THE WORLD'S OWN ROWS, IN THE ONLY ORDER THAT IS NOT A GUESS ─────
    //
    // Yours first. Somebody who says "his sword" over a sword they are already
    // holding is holding their own, and a reader that took the possessive for
    // an answer would open an account against a bystander over it.
    const own = whichThingTheyMeant(evidence.yours, thing);
    if (own) {
        return {
            state: 'yours', thing, holder: null,
            object: own.object, ground: 'in-your-hands'
        };
    }

    // Free before held, because a thing nobody holds and nobody owns is not
    // anybody's to lose however many people are standing near it.
    const loose = whichThingTheyMeant(
        evidence.free.map(object => ({ object, because: 'carried' as const })), thing
    );
    if (loose) {
        return {
            state: 'nobodys', thing, holder: null,
            object: loose.object, ground: 'standing-free'
        };
    }

    for (const row of evidence.theirs) {
        const hit = whichThingTheyMeant(row.within, thing);
        if (hit) {
            return {
                state: 'theirs', thing, holder: row.holder,
                object: hit.object,
                ground: hit.because === 'moored' ? 'moored' : 'carried'
            };
        }
    }

    // ── AND ONLY NOW THE SENTENCE, FOR THE THINGS THE WORLD HAS NO ROW FOR ─
    //
    // A purse is a number on a person and has no object row; so is a pouch, so
    // are the stones in it. `whatALiftTook` has moved them since the pressure
    // model was wired and it is the path this hands them to. What the sentence
    // supplies is *somebody else's* and nothing more - WHO is whoever the world
    // says is standing here, which is what `interact` with no target has always
    // meant.
    if (evidence.saysItIs === 'mine') return nothing('yours', 'in-your-hands');
    if (evidence.saysItIs === 'somebody-elses' && evidence.theirs.length > 0) {
        return {
            state: 'theirs', thing,
            holder: evidence.theirs[evidence.theirs.length - 1].holder,
            object: null, ground: 'the-sentence-says-somebody-elses'
        };
    }

    // Nothing of that description is anybody's, here. Not a permission, and the
    // report must not read as one: there is no record of it.
    return nothing('nobodys', 'nobody-holds-it');
}

// ─────────────────────────────────────────────────────────────────────────
// GATHERING THE EVIDENCE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Tracked rows standing where you are that nobody holds and nobody owns.
 *
 * The apple in the middle of nowhere, as the world actually stores one. All
 * three conditions are required and the third is the one that matters: a hull
 * moored at a dock with an owner on it is somebody's, and a rule that read only
 * `possessorId` would have made every unattended boat in the world free.
 */
export function whatIsStandingFreeAt(
    world: WorldState | null,
    here: string | null
): ObjectRecord[] {
    if (!world || here === null) return [];
    return world.objects.filter(object =>
        isTracked(object)
        && !isRuined(object)
        && object.possessorId === null
        && object.ownerId === null
        && (object.locationId === here || object.data?.mooredAt === here)
    );
}

/**
 * Everything within reach of everybody standing here.
 *
 * `whatIsWithinReachOf` per person rather than one sweep of the object table,
 * so the answer carries WHOSE each row is. That is the whole question.
 */
export function whatEverybodyHereHasWithinReach(
    world: WorldState | null,
    here: string | null,
    people: readonly Holder[]
): ReachableFrom[] {
    return people.map(holder => ({
        holder,
        within: whatIsWithinReachOf(world, holder.id, here)
    }));
}

// ─────────────────────────────────────────────────────────────────────────
// THE PLAYED EDGE
// ─────────────────────────────────────────────────────────────────────────

export const takingVerbs = {
    /**
     * Ask the world whose it is.
     *
     * Every piece of evidence comes off a row: who is standing here
     * (`othersPresent`, the same roster every other verb in this package reads),
     * what each of them has within reach (`whatIsWithinReachOf`, which is
     * `object-theft.ts`'s own answer and not a second one), and what is standing
     * free. The sentence contributes one enum.
     */
    whoseThingIsBeingTaken(
        this: GameService,
        cultivator: Cultivator,
        said: string,
        /**
         * The sentence as typed.
         *
         * Read for one enum and nothing else. It has to be the whole sentence
         * rather than the topic, because the reader strips the owner off the
         * topic on the way in - "what I am owed from his rooms" arrives as
         * "what I am owed" - and `his` is the half that says whose it is.
         */
        sentence = ''
    ): WhoseThing {
        const here = cultivator.location;
        const others = othersPresent(this.repos, cultivator, this.atHand)
            .filter(person => person.alive)
            .map(person => ({ id: person.id, name: person.name }));
        return whoseThingIsThis({
            // The possessive comes off before the matcher sees it. "my own
            // plain iron sword" and "his jade pendant" name a row and say whose
            // it is in one phrase, and only the first half is a name -
            // `matchScore` reads the second half as three words that are not in
            // it and drops below the threshold. Whose it is has already been
            // read, off the whole sentence, by `whoTheSentenceSaysItIs`.
            said: withoutThePossessive(said),
            yours: whatIsWithinReachOf(this.atHand, cultivator.id, here),
            theirs: whatEverybodyHereHasWithinReach(this.atHand, here, others),
            free: whatIsStandingFreeAt(this.atHand, here),
            saysItIs: whoTheSentenceSaysItIs(sentence.trim().length > 0 ? sentence : said)
        });
    },

    /**
     * The two answers that are not a taking.
     *
     * Neither may read as moral, and neither is a permission. The world has no
     * opinion about any of this; it has a record of who holds what, and both
     * reports are that record read back. `theirs` never reaches here - it goes
     * to the theft path in `interact`, unchanged.
     */
    aTakingThatWasNotOne(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        decided: WhoseThing
    ): Execution {
        const onDay = Math.floor(run.elapsedDays);

        if (decided.state === 'yours') {
            const what = decided.object?.name ?? decided.thing;
            return this.freeAction(run, 'interact', factsForRefusal(
                `${what}: already yours.`,
                `You reach for ${theArticleIsAlreadyOnIt(what)} and find it where you left `
                + 'it, which is on you.',
                `Taking refused as a no-op: the row's possessor is already ${cultivator.id}. `
                + 'Nothing moved, no day passed, and no account opened.'
            ));
        }

        // ── A FIND, WHICH IS THE CASE THE RULING NAMES ──────────────────
        //
        // The apple in the middle of nowhere. Nobody holds it, nobody owns it,
        // and it is standing where you are - so it comes off the ground for
        // free, through `transferPossession` with `how: 'found'`, which is the
        // acquisition mode that has been in `possessions.ts` since it was
        // written. Ownership is deliberately not moved: this is possession, the
        // same as every other route into somebody's hands, and if a claim ever
        // surfaces the provenance says exactly where it was picked up.
        if (decided.object) {
            const found = transferPossession(decided.object, {
                onDay,
                toHolderId: cultivator.id,
                toHolderName: cultivator.name,
                how: 'found',
                source: cultivator.location ?? '',
                note: `Picked up at ${cultivator.location ?? 'nowhere in particular'}. `
                    + 'Nobody held it and nobody owned it.'
            });
            const at = (this.atHand?.objects ?? []).findIndex(row => row.id === found.id);
            if (at >= 0 && this.atHand) {
                this.atHand.objects[at] = { ...found, locationId: null };
                this.worldDirty = true;
            }
            const execution = this.freeAction(run, 'interact', factsForRefusal(
                `${found.name}: picked up.`,
                `Nobody is holding ${theArticleIsAlreadyOnIt(found.name)} and nobody has a `
                + 'name on it. It goes with you.',
                describeObject(found, onDay)
            ));
            execution.calls = [{
                name: 'possessions.transferPossession',
                action: 'found',
                summary:
                    `${found.id} -> ${cultivator.id} as 'found'. Possessor and owner were both `
                    + 'null, so no account opened and no ownership moved.',
                ok: true
            }];
            return execution;
        }

        // Nothing of that description belongs to anybody standing here. Said as
        // a fact about the record rather than as a rule about what may be done -
        // and it names what IS here, because a refusal is finished when it names
        // the thing that would work.
        const holding = whatIsHere(this, cultivator);
        return this.freeAction(run, 'interact', factsForRefusal(
            `${decided.thing}: nothing of the sort is anybody's here.`,
            holding.length > 0
                ? `You look for ${theArticleIsAlreadyOnIt(decided.thing)}. What is here to be `
                    + `had is ${holding.join(', ')}.`
                : `You look for ${theArticleIsAlreadyOnIt(decided.thing)} and there is nothing `
                    + 'of the sort within reach of anybody standing here.',
            `Taking unresolved: "${decided.thing}" matched no row held by, owned by or standing `
            + `free at ${cultivator.location ?? 'nowhere'}. No time passed and nothing moved.`
        ));
    }
};

function withoutThePossessive(said: string): string {
    return said
        .trim()
        .replace(/^(?:my own|my|his|her|their|its|the)\s+/i, '')
        .replace(/^[a-z]+(?:'s|s')\s+/i, '')
        .trim();
}

/** What could actually be taken here, named the way the game printed it. */
function whatIsHere(service: GameService, cultivator: Cultivator): string[] {
    const here = cultivator.location;
    const names: string[] = [];
    for (const person of othersPresent(service.repos, cultivator, service.atHand)) {
        if (!person.alive) continue;
        for (const row of whatIsWithinReachOf(service.atHand, person.id, here)) {
            names.push(`${row.object.name} (${person.name}'s)`);
        }
    }
    for (const row of whatIsStandingFreeAt(service.atHand, here)) names.push(row.name);
    return names.slice(0, 6);
}

/**
 * The catalog writes its own articles - "A spirit boat" - and a sentence puts
 * one in front of whatever it is given, so a line reads "you reach for a A
 * spirit boat" unless one side gives way.
 */
function theArticleIsAlreadyOnIt(name: string): string {
    // And a player's own words often carry a determiner of their own, or are
    // not a noun phrase at all: "what is on the rack" came back as "the what is
    // on the rack" the first time this was played.
    if (/^(?:an?|the|my|his|her|their|some|any|one|two|what|whatever)\b/i.test(name)) {
        return name.replace(/^A(?=\s)/, 'a');
    }
    return `the ${name}`;
}
