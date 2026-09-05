/**
 * "What news is there?" - and the people who answer it are mostly wrong.
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
import type { HistoricalFact } from '../engine/world/history.js';
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
    type WhatItDid,
    type WhoTheyCarryFor
} from '../engine/social/hearing-of-a-wrong.js';

/**
 * How many people one asking gets answers out of.
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
    /**
     * Accounts that opened because this cultivator was told, ready to write.
     */
    opens: AccountOpenedOnBeingTold[];
}

/** One account, with the engine's own account of why it opened. */
export interface AccountOpenedOnBeingTold {
    row: ObligationInput;
    /**
     * Which transition this was.
     */
    did: WhatItDid;
    /** What the teller said was lost, in their words. For the goal it opens. */
    lost: string;
    /** Who said it. The answer to the question a house asks first. */
    speakerId: string;
    speaker: string;
    /** The engine's line. Never narration. */
    note: string;
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
    /**
     * Who this cultivator would open an account on behalf of.
     */
    carriesFor?: WhoTheyCarryFor;
    /**
     * The account they already carry about this event, if any.
     */
    heldAbout?: (factId: string | null) => ObligationRecord | null;
}

/**
 * What the people here are saying, and who said it.
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
        lines: heard.map(told => `${told.speaker} says: ${told.rumour.text}`),
        opens: accountsOpenedBy(heard, input)
    };
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE ASKING OPENED
// ─────────────────────────────────────────────────────────────────────────

/**
 * Run every telling past the join, and keep the ones that opened something.
 */
function accountsOpenedBy(
    heard: readonly TellingHeard[],
    input: AskAroundInput
): AccountOpenedOnBeingTold[] {
    const world = input.world;
    if (world === null) return [];

    const carriesFor: WhoTheyCarryFor = input.carriesFor
        ?? { hearerId: input.cultivator.id, ids: [input.cultivator.id] };

    const out: AccountOpenedOnBeingTold[] = [];
    for (const told of heard) {
        const deed = deedBehind(world, told.rumour.factId);
        if (deed === null) continue;

        // Who the SENTENCE spoke of, in the fact's own actor order, which is not
        // the same list as `named`: `named` is what the knowledge layer may write a
        // row about and therefore holds only people the world has a row for, and a
        // played cultivator has none. Where the telling was bent, these are the
        // bent names, and that is the point.
        const spoken = told.rumour.spokenOfIds;
        const blamedId = deed.doerAt === null ? null : (spoken[deed.doerAt] ?? null);
        const alsoNamedIds = spoken.filter((_, at) => at !== deed.doerAt);

        const opened: WhatBeingToldOpens = whatBeingToldOpens({
            telling: {
                hearerId: input.cultivator.id,
                // The RUN's clock, not the world's. The rumour draw is on the
                // world day because that is what the ledger is dated in; an
                // obligation is dated in run days everywhere else it is written,
                // and two clocks in one table is a row that cannot be read.
                onDay: Math.floor(input.run.elapsedDays),
                factId: told.rumour.factId,
                blamedId,
                alsoNamedIds,
                // A rumour in a square is never first hand and never fully
                // attributed to somebody who was not there. `partial` is the
                // honest form for it: some names came through, and whether they
                // are the right ones is not a thing the hearer can check.
                form: spoken.length === 0 ? 'unattributed' : 'partial',
                channel: 'market',
                fromHolderId: told.speakerId,
                fidelity: told.rumour.fidelity
            },
            deed,
            carriesFor,
            held: input.heldAbout ? input.heldAbout(told.rumour.factId) : null
        });

        if (opened.opens === null) continue;
        out.push({
            row: opened.opens,
            did: opened.did,
            speakerId: told.speakerId,
            speaker: told.speaker,
            note: opened.note,
            // What was lost, in the words the teller used. The goal an unnamed
            // account opens is written from this rather than from the summary,
            // because the holder never heard the summary.
            lost: told.rumour.text
        });
    }
    return out;
}

/**
 * The deed as the world already holds it, or null where nothing priced one.
 */
function deedBehind(
    world: WorldState,
    factId: string | null
): (TheDeedAsItStands & { doerAt: number | null }) | null {
    if (factId === null) return null;
    const fact: HistoricalFact | undefined = world.history.facts.find(f => f.id === factId);
    if (!fact) return null;
    const weight = fact.data.deedWeight;
    if (typeof weight !== 'string' || !SEVERITY_ORDER.includes(weight as Severity)) return null;
    // The ledger's own word for it. DATA everywhere it goes - `whatADeedLeaves`
    // carries `cause` untouched and never reads it - so the honest answer for a
    // thing heard repeated in a square is the one the writer stamped, and
    // `other` where nobody stamped one. What happened is in the description,
    // written once and read forever; inventing a characterisation off the event
    // kind here would be a second opinion about a field this layer does not own.
    const stamped = fact.data.deedCause;
    // Which actor is the one being blamed.
    const stampedDoer = fact.data.deedDoerId;
    const doerAt = fact.data.deedNamesNobody === true || fact.actors.length === 0
        ? null
        : typeof stampedDoer === 'string'
            ? (at => (at < 0 ? null : at))(fact.actors.findIndex(a => a.id === stampedDoer))
            : 0;
    return {
        doerAt,
        weight: weight as Severity,
        cause: (typeof stamped === 'string' ? stamped : 'other') as ObligationCause,
        kind: 'grudge',
        // Whether this wrong could have been done by a stranger, which is the one
        // question the middle state turns on. `promised` is the deed layer's own
        // field for a word given first, and a word requires somebody to have given
        // it - so a deed carrying one names its own subject and there is no state
        // where the wrong is legible and its author is not. Absent, a stranger
        // could have done it, which is both the common case and the honest default.
        how: { promised: fact.data.deedPromised === true },
        description: fact.summary,
        participants: fact.actors.map(a => a.id),
        tags: [`kind:${fact.kind}`]
    };
}

/**
 * A rumour as a hearing, which is what the knowledge layer already writes.
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
 */
function nobodyToAsk(crowd: number): AskedAround {
    const prose = crowd === 0
        ? 'You listen. There is nobody here to have heard anything, and the world '
        + 'does not send word to people standing on their own.'
        : 'You listen, and there is nothing behind the talk here - no road in, and '
        + 'nobody who has been anywhere.';
    return { heard: [], hearings: [], prose, lines: [prose], opens: [] };
}

/** People, but nothing worth their breath. A young world, or a quiet corner. */
function nothingInTheAir(): AskedAround {
    const prose = 'You ask around. Nobody here has heard anything they think is worth '
        + 'repeating, which mostly means nothing has happened near enough to reach them.';
    return { heard: [], hearings: [], prose, lines: [prose], opens: [] };
}

/**
 * What the narrator is handed, and what the operator is.
 */
/**
 * What a distortion band actually did to the story, in words.
 */
const DISTORTION: Record<string, string> = {
    intact: 'intact - the right people, the right place, the right size',
    stale: 'stale - it happened, and it is being told as though it still were',
    inflated: 'inflated - it happened, and it has grown in the telling',
    misattributed: 'misattributed - it happened, and the wrong person is being named for it',
    misplaced: 'misplaced - it happened, somewhere else',
    invented: 'invented - it did not happen at all'
};

/**
 * What the player is told about what they now hold, and it names a route.
 */
function whatTheyNowCarry(opened: readonly AccountOpenedOnBeingTold[]): string[] {
    return opened.map(account => {
        switch (account.did) {
            case 'opened against nobody':
                return 'You know now that it was done, and nobody has put a name to it. '
                    + 'Names come out of asking, and out of asking somebody better placed '
                    + 'than the people in this square.';
            case 'put a name on what they carried':
                return 'What you have been carrying has a name on it now. It is the name '
                    + 'you were given, which is not the same as the name that earned it.';
            case 'opened against a name':
                return 'That was about you, and you have a name for it now - one name, off '
                    + 'one person.';
            default:
                return '';
        }
    }).filter(line => line.length > 0);
}

export function factsForNews(asked: AskedAround): EngineFacts {
    const headline = asked.heard.length === 0
        ? 'Nothing anybody here can tell you.'
        : `${asked.heard.length} thing${asked.heard.length === 1 ? '' : 's'} being said.`;
    const carried = whatTheyNowCarry(asked.opens);
    return {
        headline,
        lines: [...asked.lines, ...carried],
        prose: [asked.prose, ...carried].join(' '),
        // The speaker's row id is dropped and the FACT id is kept, and the
        // difference is what a reader can do with each. The speaker is already
        // named in the sentence, so `npc-105` beside their name is the same
        // internals leak as a price-board row id. The fact id is the opposite: it
        // is how anybody tells two people repeating ONE story from two people
        // telling two, which is the entire point of a mechanic that counts hands
        // and fidelity.
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
