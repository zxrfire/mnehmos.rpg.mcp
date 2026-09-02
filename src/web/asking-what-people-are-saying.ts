/**
 * "What news is there?" - and the people who answer it are mostly wrong.
 *
 * `hearsay.ts` is how a NAME reaches the player: somebody says it flatly and
 * the engine writes the record. This is the other half, and it did not exist.
 * A name is a word; what a player actually wants in a market is an EVENT - who
 * opened what, who refused whom, who fought over it - and there was no verb for
 * asking. "what news is there", "what is happening in the world" and "I listen
 * for rumours" all resolved to a listing of names the cultivator already held,
 * which is a perfectly composed answer to a question nobody asked.
 *
 * ── The three properties, and where each one lives ───────────────────────
 *
 *   SCALE          `what-people-are-saying.ts`. The engine weights a fact up
 *                  for the standing of the people in it, so a market talks
 *                  about the top of the world rather than about itself.
 *   TRUTH SPECTRUM `what-people-are-saying.ts`. Fidelity and a named
 *                  distortion, never a boolean.
 *   ATTRIBUTION    here. A rumour arrives as a `Hearing` with a speaker on it,
 *                  and the statement it writes into `knowledge_records` is the
 *                  RUMOUR'S OWN SENTENCE rather than the ledger's.
 *
 * That last point is the whole of why this module is thin. The knowledge layer
 * already stores several incompatible accounts of one thing without ranking or
 * merging them - `src/web/README.md`, "Fragments are never joined up" - so
 * hearing the same night off two people and then typing "what do I know of
 * her" gives back both versions, unreconciled, with the engine saying outright
 * that whether they are the same event is not something the holder knows.
 * Checking a rumour is therefore not a mechanic anybody had to build. It is
 * asking a second person and reading what you end up holding.
 *
 * ── Nobody here means no news, and that is the honest answer ─────────────
 *
 * The refusal is content. A cultivator who has spent forty years in a cave
 * asking what is happening in the world is asking a wall, and the engine says
 * so rather than producing a wire service. It is also the one thing that makes
 * the verb worth spending a turn on where there ARE people: news is a property
 * of standing somewhere with other people in it.
 */

import type { Cultivator, Run } from '../schema/cultivation.js';
import { forStream } from '../engine/cultivation/rng.js';
import type { RosterEntry } from '../storage/repos/cultivator.repo.js';
import type { WorldState } from '../engine/world/world-state.js';
import {
    whatTheySay,
    regionOf,
    type Rumour,
    type TellerStanding
} from '../engine/world/what-people-are-saying.js';
import { worldLocationFor } from './entities.js';
import { rungAndOrdinal, type EngineFacts } from './facts.js';
import type { Hearing, SpeakableName } from './hearsay.js';
import type { KnownEntityKind } from './knowledge.js';

/**
 * How many people one asking gets answers out of.
 *
 * Two, not the whole square. One version of a night is a rumour and two
 * versions of it are a question, and beyond that it stops being a conversation
 * and starts being a survey.
 */
export const PEOPLE_WORTH_ASKING = 2;

export interface AskedAround {
    /** One entry per person who said something, in the order they said it. */
    heard: TellingHeard[];
    /** Everything to write down, as hearings the knowledge layer already takes. */
    hearings: Hearing[];
    /** Engine prose for the deterministic path. Never empty. */
    prose: string;
    /** Flat statements for the narrator. Facts only - no distortion is named. */
    lines: string[];
}

export interface TellingHeard {
    speakerId: string;
    speaker: string;
    rumour: Rumour;
}

export interface AskAroundInput {
    cultivator: Cultivator;
    run: Run;
    /** Everybody standing here, from `othersPresent`. */
    present: readonly RosterEntry[];
    world: WorldState | null;
    /** Stream discriminator, so asking twice on one day is not two draws. */
    occasion: string;
}

/**
 * What the people here are saying, and who said it.
 *
 * Deterministic on (run seed, day, occasion): the same market on the same
 * afternoon gives the same answers, and the per-teller draw underneath is
 * stable for that teller for ever. So a player can go back to the same carter
 * next year and hear the same story, which is the difference between a rumour
 * that can be weighed and a slot machine.
 */
export function askAround(input: AskAroundInput): AskedAround {
    const { cultivator, run, present, world, occasion } = input;

    if (world === null || present.length === 0) return nobodyToAsk(present.length);

    const day = Math.floor(world.currentDay);
    const here = worldLocationFor(world, cultivator.location);
    const region = regionOf(world, here?.id ?? null);

    // Whoever is here, best-informed first. Standing is the only proxy the
    // world has for how far up the chain somebody sits, and it is the right
    // one: the people who hear things first are the people the people who were
    // there talk to.
    const askable = [...present].sort((a, b) =>
        b.realmOrdinal - a.realmOrdinal || (a.id < b.id ? -1 : 1));

    const rng = forStream(run.seed, 'asking-around', Math.floor(run.elapsedDays), occasion);
    const heard: TellingHeard[] = [];
    const said = new Set<string>();

    for (const person of askable) {
        if (heard.length >= PEOPLE_WORTH_ASKING) break;
        // Not everybody answers a stranger. The draw is on the day rather than
        // on the person, so walking away and coming back is not a reroll.
        if (askable.length > PEOPLE_WORTH_ASKING && !rng.chance(0.7)) continue;

        const teller: TellerStanding = {
            id: person.id,
            name: person.name,
            realmOrdinal: person.realmOrdinal,
            regionId: region,
            factionId: person.sectId
        };
        for (const rumour of whatTheySay(world, teller, day, 1)) {
            if (said.has(rumour.text)) continue;
            said.add(rumour.text);
            heard.push({ speakerId: person.id, speaker: person.name, rumour });
        }
    }

    if (heard.length === 0) return nothingInTheAir();

    return {
        heard,
        hearings: heard.map(toHearing),
        prose: heard.map(told => `${told.speaker} says: ${told.rumour.text}`).join(' ')
            + ' You have no way to weigh any of it beyond who said it.',
        // The distortion never reaches this list, and must not. The narrator is
        // told what was said and by whom; whether it was true is not a fact the
        // engine has handed the player.
        lines: heard.map(told => `${told.speaker} says: ${told.rumour.text}`)
    };
}

/**
 * A rumour as a hearing, which is what the knowledge layer already writes.
 *
 * `statement` is the rumour's own sentence rather than the composed default, so
 * what the holder ends up carrying about a name is WHAT THEY WERE TOLD. That is
 * the whole of checkability: two tellings of one night land as two records on
 * the same name, and `recall` hands both back without ranking them.
 *
 * `confidence` is the fidelity, so the record's own number is honest even
 * though nothing ever shows it to the player - a distinction the knowledge
 * layer already draws for every other source.
 *
 * `sourceKind` is `fabricated` for the bottom of the spectrum and `told` for
 * everything else. Both are existing vocabulary; neither is shown.
 */
function toHearing(told: TellingHeard): Hearing {
    const names: SpeakableName[] = told.rumour.named.map(named => ({
        kind: kindOf(named.kind),
        id: named.id,
        name: named.name,
        stage: 'whisper' as const,
        statement: told.rumour.text
    }));

    return {
        mode: 'told',
        speaker: told.speaker,
        names,
        note: `Repeated by ${told.speaker}, ${handsPhrase(told.rumour.hands)}.`,
        confidence: told.rumour.fidelity,
        sourceKind: told.rumour.distortion === 'invented' ? 'fabricated' : 'told',
        stage: 'whisper',
        prose: `${told.speaker} says: ${told.rumour.text}`
    };
}

function kindOf(kind: Rumour['named'][number]['kind']): KnownEntityKind {
    return kind === 'person' ? 'cultivator' : kind === 'faction' ? 'sect' : 'place';
}

/** Provenance, for the record. Never reaches the player. */
function handsPhrase(hands: number): string {
    return hands <= 1 ? 'who was there' : `at ${hands} removes from whoever was`;
}

/**
 * Nobody here.
 *
 * Two different silences, and they are not the same fact: an empty road has
 * nobody to ask, and a world that is switched off has no ledger to ask about.
 * Both refuse; only the first is about the cultivator's situation.
 */
function nobodyToAsk(crowd: number): AskedAround {
    const prose = crowd === 0
        ? 'You listen. There is nobody here to have heard anything, and the world '
        + 'does not send word to people standing on their own.'
        : 'You listen, and there is nothing behind the talk here - no road in, and '
        + 'nobody who has been anywhere.';
    return { heard: [], hearings: [], prose, lines: [prose] };
}

/** People, but nothing worth their breath. A young world, or a quiet corner. */
function nothingInTheAir(): AskedAround {
    const prose = 'You ask around. Nobody here has heard anything they think is worth '
        + 'repeating, which mostly means nothing has happened near enough to reach them.';
    return { heard: [], hearings: [], prose, lines: [prose] };
}

/**
 * What the narrator is handed, and what the operator is.
 *
 * The split is the whole discipline of `facts.ts` applied here. `lines` is what
 * was said and by whom, which is everything a person in the square would have.
 * `structure` carries the fidelity and the distortion, which is the ENGINE'S
 * account of the same conversation - and it is engine-only for the same reason
 * a category never reaches a prompt: a narrator told that a rumour is
 * misattributed will write a sentence that hints at it, and the player will
 * have been handed the answer for the price of a question.
 */
/**
 * What a distortion band actually did to the story, in words.
 *
 * The band names are the engine's and they are exact; printed bare they read as
 * a field value, and three of the five do not say what they mean to somebody
 * who has not read the enum. Saying what happened to the story keeps the band's
 * precision and stops the line being a lookup key.
 */
const DISTORTION: Record<string, string> = {
    intact: 'intact - the right people, the right place, the right size',
    stale: 'stale - it happened, and it is being told as though it still were',
    inflated: 'inflated - it happened, and it has grown in the telling',
    misattributed: 'misattributed - it happened, and the wrong person is being named for it',
    misplaced: 'misplaced - it happened, somewhere else',
    invented: 'invented - it did not happen at all'
};

export function factsForNews(asked: AskedAround): EngineFacts {
    const headline = asked.heard.length === 0
        ? 'Nothing anybody here can tell you.'
        : `${asked.heard.length} thing${asked.heard.length === 1 ? '' : 's'} being said.`;
    return {
        headline,
        lines: asked.lines,
        prose: asked.prose,
        // The speaker's row id is dropped and the FACT id is kept, and the
        // difference is what a reader can do with each. The speaker is already
        // named in the sentence, so `npc-105` beside their name is the same
        // internals leak as a price-board row id. The fact id is the opposite:
        // it is how anybody tells two people repeating ONE story from two
        // people telling two, which is the entire point of a mechanic that
        // counts hands and fidelity.
        structure: asked.heard.map(told =>
            `${told.speaker} is passing on `
            + `${told.rumour.factId ? `fact ${told.rumour.factId}` : 'something with no fact behind it'}`
            + `, which has been through ${told.rumour.hands} `
            + `hand${told.rumour.hands === 1 ? '' : 's'} and arrives `
            + `${DISTORTION[told.rumour.distortion] ?? told.rumour.distortion}. It reaches `
            + `this cultivator at fidelity ${told.rumour.fidelity.toFixed(2)}, where 1.00 is `
            + `the event as it happened. `
            + `Whoever it is about stands at ${rungAndOrdinal(told.rumour.subjectOrdinal)}.`)
    };
}
