/**
 * Names entering the world through the mouths of people who assume you know them.
 *
 * docs/world/discovery.md, "Characters assume you know": the discovery rule
 * governs the NARRATOR'S OWN VOICE and must not gag the people in the world. A
 * cultivator says a name flatly, with no context, because of course you know it
 * - everyone they have ever spoken to did. They are not withholding; it does
 * not occur to them that explanation is required.
 *
 *     "That road's shut. Hollow Court business."
 *
 * That is the primary way names should enter a player's world, and it is better
 * than any deliberate revelation.
 *
 * ── Why the engine picks the name, and not the model ──────────────────────
 * The obvious implementation is to let the narrator drop names and then read
 * them back out of the prose. That is precisely the forbidden move: it takes
 * state out of a model response. So the order is inverted. The engine decides,
 * from real rows, which names a present speaker would plausibly say; it writes
 * the knowledge record itself; and it hands the narrator a short licence of
 * exactly those names. The record exists because the engine created it, and the
 * prose is the dressing on a fact that was already true.
 *
 * A name that never gets picked is never spoken and never recorded, and a name
 * that is picked is recorded whether or not the narration uses it well. Both of
 * those are the correct failure mode.
 *
 * ── Where the names come from ─────────────────────────────────────────────
 * `lore.ts`, which is the whole world rather than the sect catalog. This module
 * used to draw from `SECTS` alone, which meant a player could run a lifetime
 * and never hear that there were ages before this one, that something is sealed
 * under a hall two valleys over, or that the road is shut for reasons with a
 * name. That material existed and was unreachable. It is reachable now by being
 * ACQUIRABLE - said by somebody who assumes you know it - and never by being
 * printed.
 *
 * ── Hearing grants the name, not the meaning ──────────────────────────────
 * Everything recorded here lands at the lowest positive stance - `suspects` -
 * with the source attached. The player has the word and nothing else, from one
 * interested party who may be wrong. Whether the Hollow Court is a sect, a
 * court, a person or a joke is not conveyed by having heard of it.
 */

import type { Cultivator, Run } from '../schema/cultivation.js';
import { forStream } from '../engine/cultivation/rng.js';
// Imported rather than restated as `'player'`, so that grepping
// `PLAYER_ROLL_IDENTITY` finds every stream in the layer that is keyed on the
// run's one player - this module was missed for exactly as long as it was not
// in that list. `encounters.ts` imports `othersPresent` from here, so the two
// modules form a cycle; it is harmless because neither reads the other's
// binding at module scope, and it must not be "fixed" by inlining the string.
import { PLAYER_ROLL_IDENTITY } from './encounters.js';
import type { RosterEntry } from '../storage/repos/cultivator.repo.js';
import type { CultivationRepos } from '../server/consolidated/cultivation-support.js';
import { npcsAt, type WorldState } from '../engine/world/world-state.js';
import { worldLocationFor } from './entities.js';
import {
    whatSomebodyWouldSayAbout,
    whatTheyNowHold,
    whoCouldPointAtAGround
} from './ground-that-teaches-a-road.js';
import { worldRosterRow } from './view.js';
import type { KnowledgeGate, KnownEntityKind } from './knowledge.js';
import type { SourceKind } from '../engine/social/knowledge.js';
import type { KnowingStage } from '../engine/social/discovery.js';
import {
    passingThrough,
    placedStatement,
    travellerProse,
    whisperStatement,
    type Traveller,
    type TravellerPlace
} from '../engine/social/travellers.js';
import {
    COMMON_CURRENCY_ORDINAL,
    OVERHEARD_BAND_WEIGHTS,
    TOLD_BAND_WEIGHTS,
    WORKING_KNOWLEDGE_MARGIN,
    mentionableFor,
    pickWeighted,
    placesInLore,
    regionOfPlace,
    type Locale,
    type Mentionable
} from './lore.js';

/**
 * Re-exported rather than redefined.
 *
 * Both thresholds now live beside the table they filter, in `lore.ts`. They are
 * still surfaced here because this is where the rest of the layer has always
 * read them from - `asked.ts` reads the margin through this module - and moving
 * a constant is not a reason to move a call site.
 */
export { WORKING_KNOWLEDGE_MARGIN, COMMON_CURRENCY_ORDINAL };

/** Chance a qualifying scene actually produces a dropped name. */
export const SPOKEN_NAME_CHANCE = 0.3;
/** Chance a scene with two or more other people present produces an overheard fragment. */
export const OVERHEARD_CHANCE = 0.2;

/**
 * Why this scene is being listened to.
 *
 * The rates above are the AMBIENT ones: a name arriving in a scene the player
 * did not spend anything to reach. Two other things a player can do are
 * deliberate, and a deliberate act that pays off three times in ten is a
 * deliberate act a player learns not to bother with.
 *
 *   ambient    walking through a square, dealing with somebody. Rare.
 *   listening  loitering, waiting, sitting in a market with no business.
 *              The cheapest action a poor cultivator has, and the one the
 *              overheard channel exists for.
 *   asked      the player put a question to somebody. What comes back is
 *              governed by the answer they got, below.
 */
export type HearingIntent = 'ambient' | 'listening' | 'asked';

/**
 * How far an answer got.
 *
 * Structurally identical to `Reach` in `asked.ts` and deliberately NOT imported
 * from it: this module must not depend on the answering layer, and the
 * answering layer must not depend on this one. They meet at the call site,
 * which is the only place that legitimately knows about both.
 */
export type AnswerReach = 'answers' | 'partial' | 'guesses' | 'deflects' | 'blank';

/**
 * Whether a name falls out of an answer, by what kind of answer it was.
 *
 * `asking.md` is the whole of the reasoning here, and every number is a
 * sentence from it:
 *
 *   guesses   the highest, which is the counter-intuitive part and the best
 *             thing in the file. "A carter asked about something above his
 *             stratum is not being cagey - he has never needed the word. He
 *             may guess, confidently and wrongly." Somebody filling a gap
 *             fills it with proper nouns. The name is recorded as `assumed`
 *             and at the lowest confidence in the module, because it very
 *             probably has nothing to do with what was asked - which the
 *             player has no way to tell.
 *   answers   somebody with a reason to talk to you, talking freely. Adjacent
 *             names come with it because they are ordinary to them.
 *   partial   the same person, stopping early.
 *   deflects  low and deliberately NOT zero. "Whether someone who was not
 *             going to help mentions one thing on the way out." That one thing
 *             is this, and it is the entire reason a deflection is worth
 *             sitting through.
 *   blank     nothing. A shrug teaches nothing and must not write a row.
 */
export const REACH_NAME_CHANCE: Record<AnswerReach, number> = {
    answers: 0.85,
    partial: 0.6,
    guesses: 0.9,
    deflects: 0.35,
    blank: 0
};

/**
 * Chance a deliberate listen produces a fragment.
 *
 * High, because the player spent a turn on it and because this is the channel
 * carrying the material `discovery.md` says can only arrive this way - the
 * things there is no way to ask about. Not 1, because two people on the far
 * side of a wall are usually talking about the price of salt, and a market
 * that yields a proper noun every single time is a market handing out its map.
 */
export const LISTENING_OVERHEARD_CHANCE = 0.75;

export interface SpeakableName {
    kind: KnownEntityKind;
    id: string;
    name: string;
    /**
     * How far up the ladder THIS name carries, when it differs from the rest of
     * the hearing.
     *
     * Almost always absent, and absent means the hearing's own default. The one
     * case that needs it is a traveller: where they came from is `placed`,
     * because they said it with a number of days attached, and anything else
     * they mention on the way past is a `whisper` like any other dropped name.
     * Two stages out of one sentence is exactly what actually happens when
     * somebody accounts for the road.
     */
    stage?: KnowingStage;
    /** What the holder ends up holding, when the default sentence will not do. */
    statement?: string;
}

export interface Hearing {
    /**
     * `told` is somebody addressing the player. `overheard` is two people not
     * addressing them, which is the sharper form: the option to ask is gone,
     * and what the player ends up holding is knowledge with compromising
     * provenance - they cannot act on it without revealing where they were
     * standing. `passing` is somebody who came through, said where they had
     * come from, and left - the one channel that reliably brings a name from
     * outside the county to a cultivator who has never been anywhere.
     */
    mode: 'told' | 'overheard' | 'passing';
    /** Who said it. Null when overheard from behind a wall. */
    speaker: string | null;
    /**
     * What may be said. Small by design.
     *
     * One name when somebody is talking to the player. Up to two when they are
     * talking to each other, because that is what makes an overheard exchange a
     * fragment rather than a name-drop: two names, a relationship implied
     * between them, and no way to place either.
     */
    names: SpeakableName[];
    /** Engine-authored provenance, recorded and shown to the narrator. */
    note: string;
    /** How much of a fact this is, for the record. Never reaches a prompt. */
    confidence: number;
    /**
     * How the player came by it, in the knowledge layer's own vocabulary.
     *
     * Carried rather than derived from `mode`, because `told` and `assumed` are
     * both somebody talking to the player and the difference between them is
     * the whole point: one of them was making it up. Never reaches a prompt -
     * the player is not told which they got.
     */
    sourceKind: SourceKind;
    /**
     * The stage every name in this hearing lands at, unless the name overrides
     * it.
     *
     * `whisper` for the two ambient channels, which is discovery.md's own rule
     * for a name said flatly: "They have the word and nothing else."
     */
    stage?: KnowingStage;
    /**
     * Engine-authored prose for the deterministic path, where the composed
     * default will not do. Optional; `hearingProse` falls back to its own.
     */
    prose?: string;
}

// ────────────────────────────────────────────────────────────────────────
// SAYING IT
// ────────────────────────────────────────────────────────────────────────

/**
 * The hearing as engine prose, for the path with no model behind it.
 *
 * Authored here because the engine chose the names, and because the previous
 * version - written at the call site - failed the doc in three ways at once. It
 * DESCRIBED an overheard exchange rather than being one. It said "this
 * cultivator", which is the engine talking about the player in the third
 * person. And it explained the epistemics, telling the player that they could
 * not ask without revealing where they had been standing, which is precisely
 * the thing discovery.md wants them to feel and not be told.
 *
 * What is left says only what happened and what the player now has. It asserts
 * no relationship between the names, on purpose: the engine has not established
 * one, and inventing an implication here would be the deterministic narrator
 * making up a fact about the world. The elliptical exchange discovery.md
 * describes is a narrator's job, and the prompt already carries the rules for
 * writing one - this is the floor, not the ceiling.
 */
export function hearingProse(hearing: Hearing): string {
    const names = hearing.names.map(name => name.name);

    // Authored where the names were chosen, for the same reason the overheard
    // prose is authored here: the sentence is the dressing on a fact that was
    // already written down, and it must not explain any of it.
    if (hearing.prose) return hearing.prose;

    if (hearing.mode === 'overheard') {
        const said = names.length > 1
            ? `One of them says ${names[0]}. A moment later the other says ${names[1]}.`
            : `One of them says ${names[0]}.`;
        return 'Past the wall, two voices, mid-conversation and not lowered for anybody. ' +
            `${said} Neither stops to explain, and then it is the weather again. ` +
            `You have no idea what ${names.length > 1 ? 'either of those was' : 'that was'}.`;
    }

    const speaker = hearing.speaker ?? 'Somebody';
    return `${speaker} says ${names.join(', then ')} the way you would say a weekday, ` +
        'and carries straight on. You do not know what that is, and it does not occur to ' +
        'them that it might need saying.';
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT A PERSON COULD PLAUSIBLY NAME
// ─────────────────────────────────────────────────────────────────────────

/**
 * Every name this speaker could drop into a sentence without thinking.
 *
 * Kept at one argument, and the argument is the SPEAKER's standing. Nothing
 * here consults the player's knowledge - that is the whole point. The speaker
 * is not adjusting for their audience, because it has not occurred to them that
 * they need to.
 *
 * What has changed is the source. This used to be a filter over `SECTS`; it is
 * now a filter over the whole speakable world, with the same rule doing the
 * same work - your own working range, plus whatever is large enough to be in
 * the air regardless of who is speaking.
 */
export function speakableFor(speakerOrdinal: number): SpeakableName[] {
    return mentionableFor({ ordinal: speakerOrdinal, factionId: null }).map(toSpeakable);
}

function toSpeakable(entry: Mentionable): SpeakableName {
    return { kind: entry.kind, id: entry.id, name: entry.name };
}

/**
 * People standing in the same place as the cultivator, alive, not themselves.
 *
 * Two populations, and forgetting the second one is what made a village of
 * nineteen people read as empty. The `cultivators` table holds the player and
 * whoever a run wrote down; the WORLD holds everybody who was already here, and
 * they are the ones a player standing in a square actually sees. A social layer
 * that only knows about the first population has nobody to be social with.
 *
 * The two are keyed differently on purpose and joined here: a cultivator's
 * `location` is free text by design, and a world NPC's is a location id. See
 * `worldLocationFor` for the join, which is by name because the name is what
 * both sides actually agree on.
 */
export function othersPresent(
    repos: CultivationRepos,
    cultivator: Cultivator,
    world?: WorldState | null
): RosterEntry[] {
    const here = (cultivator.location ?? '').trim().toLowerCase();
    if (here.length === 0) return [];

    const stored = repos.cultivators.roster().filter(row =>
        row.id !== cultivator.id &&
        row.alive &&
        (row.location ?? '').trim().toLowerCase() === here);

    if (!world) return oneCrowd(stored, []);

    const place = worldLocationFor(world, cultivator.location);
    if (!place) return oneCrowd(stored, []);

    const inWorld = npcsAt(world, place.id).map(npc => worldRosterRow(npc, world.currentDay));
    return oneCrowd(stored, inWorld);
}

/**
 * Two halves of a crowd, given ONE order.
 *
 * This function is the fix for a reproducibility bug, and the bug is worth
 * stating because the shape of it will recur. `stored` and `inWorld` each sort
 * deterministically on their own, and concatenating them does NOT: which half
 * a given person arrives through is a property of the day rather than of the
 * person, so the last element of `[...stored, ...inWorld]` flips identity
 * without the crowd changing at all.
 *
 * That mattered because callers pick out of this list by POSITION.
 * `somebodyAtHand` answers "the nearest cultivator" with the last element, and
 * `combat_manage.resolve` then seeds its stream on the opponent's id - so the
 * same seed, the same day and the same people produced a different opponent, a
 * different stream and a different wound. `resolveConfrontation` was
 * byte-identical the whole time; the non-determinism was here, in an ordering
 * nobody had stated.
 *
 * The order itself is arbitrary and is deliberately said to be arbitrary -
 * there is no distance in this world model, so "nearest" cannot be computed and
 * must not be pretended at. What is required is that it be TOTAL and depend
 * only on the SET of people present, never on how they got into it. Rank first
 * so the list reads sensibly to anything that renders it, then id, which is
 * stable for the life of a row.
 *
 * Deduplicated by id, keeping the stored row: a person with a real database row
 * and a world entry is one person, and the row is the authority.
 */
export function oneCrowd(
    stored: readonly RosterEntry[],
    inWorld: readonly RosterEntry[]
): RosterEntry[] {
    const byId = new Map<string, RosterEntry>();
    for (const row of inWorld) byId.set(row.id, row);
    for (const row of stored) byId.set(row.id, row);
    return [...byId.values()].sort((a, b) =>
        a.realmOrdinal - b.realmOrdinal ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// ─────────────────────────────────────────────────────────────────────────
// OFFERING A HEARING
// ─────────────────────────────────────────────────────────────────────────

export interface HearingInput {
    repos: CultivationRepos;
    gate: KnowledgeGate;
    cultivator: Cultivator;
    run: Run;
    /** A person the player is dealing with directly, when there is one. */
    addressing?: RosterEntry | null;
    /** Stream discriminator so two different actions on one day differ. */
    occasion: string;
    /** The world, so the people who can speak include the ones who live here. */
    world?: WorldState | null;
    /**
     * Why this scene is being listened to. Defaults to `ambient`, which is the
     * behaviour every existing call site already has.
     */
    intent?: HearingIntent;
    /**
     * How far the answer got, when the player asked somebody something.
     *
     * Read only when `intent` is `asked`. The caller has already run the
     * answering layer by the time it gets here, so this is not a second
     * judgement about the same conversation - it is the first one, arriving.
     */
    reach?: AnswerReach;
}

/**
 * Decide whether a name gets said in this scene, and which.
 *
 * Seeded and therefore replayable: the same run on the same day in the same
 * place hears the same thing. Returns null far more often than not, because a
 * world in which every conversation deposits a proper noun is a world handing
 * out its map, and the value of a dropped name is that it is rare enough to
 * snag on.
 */
export function offerHearing(input: HearingInput): Hearing | null {
    const { repos, gate, cultivator, run, occasion } = input;
    const day = Math.floor(run.elapsedDays);
    // ── WHY THE ROW ID IS NOT IN THIS STREAM ─────────────────────────────
    //
    // It used to be, and it made this module the one stochastic system in the
    // web layer that was NOT reproducible from the run seed. Every cultivator
    // row id in this engine is a `randomUUID()` - `game.ts` mints the player's
    // - so the stream was stable within a process and meaningless across one:
    // the same seed, the same day and the same people overheard different
    // names from one run to the next.
    //
    // It showed up as a test that failed about one run in ten while the code
    // under it never changed, which is the characteristic way this defect
    // reports itself: a rare outcome that moves between processes looks like
    // flakiness in the guard rather than a broken promise in the engine.
    //
    // The constant is the house answer and not a placeholder. The component's
    // job is to stop two cultivators standing in one place drawing alike, and
    // that case cannot arise here - `GameService.hear` is the only caller and
    // it passes the run's player, and a run has exactly one. So the slot stays
    // filled, saying WHO the draw is for, rather than being deleted; deleting
    // it would leave the next person to add a subject reaching for
    // `cultivator.id` again, which is how this arrived twice already.
    const rng = forStream(run.seed, 'web_hearsay', day, occasion, PLAYER_ROLL_IDENTITY);
    const locale: Locale = { regionId: regionOfPlace(cultivator.location) };

    const present = othersPresent(repos, cultivator, input.world);
    const addressed = input.addressing ?? null;
    const intent = input.intent ?? 'ambient';

    // ── Where the ground is that teaches a road ──
    //
    // First, and deliberately: this draw is over a set that EMPTIES, and it
    // competes with a lore table of several hundred rows that never does. Put
    // behind the weighted draw it would have been picked about never, which is
    // how a channel becomes decoration.
    //
    // It stays gated the way everything is gated. Nothing here is listed to the
    // player, nobody is handed a map, and the record is written because a
    // person who goes there said where it was - which is `discovery.md`'s own
    // account of how a name is supposed to arrive.
    const ground = offerGroundSomebodyGoesTo(input, addressed);
    if (ground) return ground;

    // ── Somebody talking to the player ──
    if (addressed) {
        // A deliberate question is not the same event as a name landing in a
        // scene the player walked through, and rolling the ambient rate on it
        // is how a player learns that asking does not work. What comes back is
        // governed by the answer they actually got.
        const chance = intent === 'asked'
            ? REACH_NAME_CHANCE[input.reach ?? 'answers']
            : SPOKEN_NAME_CHANCE;
        if (!rng.chance(chance)) return null;

        const candidates = unknownTo(gate, cultivator.id, heldBy(addressed));
        const name = pickWeighted(candidates, locale, TOLD_BAND_WEIGHTS, rng);
        if (!name) return null;

        const guessing = intent === 'asked' && input.reach === 'guesses';
        return {
            mode: 'told',
            speaker: addressed.name,
            names: [toSpeakable(name)],
            note: toldNote(addressed, intent, input.reach ?? null),
            // A guess is the least reliable thing in the table and is still a
            // real acquisition. The player has the word and no way at all to
            // evaluate it, which is the correct state.
            confidence: guessing ? 0.15 : toldConfidence(addressed, input.reach ?? null),
            sourceKind: guessing ? 'assumed' : 'told'
        };
    }

    // ── Somebody who came through ──
    //
    // Ahead of the overheard channel and independent of who lives here, because
    // this is the one source that works for a cultivator standing alone in a
    // village where nobody has anywhere to be. discovery.md lists the traveller
    // among the scarce sources a step needs; of that list it is the only one
    // available to somebody with no sect, no archive, no money and no reason to
    // have been anywhere.
    //
    // What it delivers is GEOGRAPHY, which the other two channels are bad at:
    // they draw across the whole speakable world and a place name has to win a
    // weighted draw against every sect, elder and dead civilisation in it. A
    // road brings places.
    const traveller = offerTraveller(input, rng, locale);
    if (traveller) return traveller;

    // ── Two people not talking to the player ──
    // Needs at least two of them, because one person alone in a courtyard is
    // not having a conversation, and a monologue for the player's benefit is
    // the exact failure this device exists to avoid.
    if (present.length < 2) return null;
    const overheardChance = intent === 'listening' ? LISTENING_OVERHEARD_CHANCE : OVERHEARD_CHANCE;
    if (!rng.chance(overheardChance)) return null;

    const first = present[rng.int(0, present.length - 1)];
    const others = present.filter(row => row.id !== first.id);
    const second = others[rng.int(0, others.length - 1)];

    // Both speakers' vocabularies, because they are talking to each other and
    // each assumes the other knows. A shared history neither is going to
    // summarise is exactly the thing that produces an unresolvable fragment.
    const candidates = notStandingHere(
        unknownTo(gate, cultivator.id, [...heldBy(first), ...heldBy(second)]),
        present
    );
    const one = pickWeighted(candidates, locale, OVERHEARD_BAND_WEIGHTS, rng);
    if (!one) return null;

    // A second name, from a different catalog where there is one, so the
    // fragment implies a relationship between two things the player cannot
    // place rather than simply handing over a proper noun. Optional: an
    // exchange that yields one name is still an exchange.
    const rest = candidates.filter(entry => entry.id !== one.id && entry.catalog !== one.catalog);
    const two = pickWeighted(rest, locale, OVERHEARD_BAND_WEIGHTS, rng);

    return {
        mode: 'overheard',
        speaker: null,
        names: two ? [toSpeakable(one), toSpeakable(two)] : [toSpeakable(one)],
        note:
            'Overheard from people who did not know they were heard. Acting on it would ' +
            'reveal where this cultivator was standing.',
        confidence: 0.2,
        sourceKind: 'overheard'
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE ROAD
// ─────────────────────────────────────────────────────────────────────────

/**
 * How much of the world goes past this door, 0..1.
 *
 * Read off the location's own links, because a place with four roads out of it
 * is a place people come through and a dead-end valley is not. This module does
 * not own the map and does not go looking for one: when the world is off, the
 * answer is the middle, which is the honest reading of "nobody has said".
 */
function trafficAt(world: WorldState | null | undefined, place: string | null): number {
    if (!world) return 0.5;
    const here = worldLocationFor(world, place);
    if (!here) return 0.5;
    const open = here.links.filter(link => link.open).length;
    return Math.min(1, open / 4);
}

/**
 * Somebody came through, and said where from.
 *
 * The candidate list is places this cultivator cannot already name, drawn from
 * the same table every other channel draws from. Nothing bespoke: a place
 * becoming nameable through a traveller is the same row, acquired the same way,
 * as a place becoming nameable through an elder.
 */
function offerTraveller(
    input: HearingInput,
    rng: { chance(p: number): boolean; int(min: number, max: number): number },
    locale: Locale
): Hearing | null {
    const unknownPlaces: TravellerPlace[] = unknownTo(input.gate, input.cultivator.id, placesInLore())
        .map(entry => ({ id: entry.id, name: entry.name, regionId: entry.regionId }));

    const traveller = passingThrough({
        rng,
        unknownPlaces,
        hereRegionId: locale.regionId,
        traffic: trafficAt(input.world, input.cultivator.location),
        listening: (input.intent ?? 'ambient') === 'listening'
    });
    if (!traveller) return null;

    return travellerHearing(traveller);
}

/**
 * How often somebody here mentions ground that teaches a road.
 *
 * Two rates, because being talked to and standing near a conversation are
 * different events - the same split every other channel in this file makes.
 *
 * Higher than the ambient name draw, and it is not generosity. THE CANDIDATE
 * SET EMPTIES: a province holds one to four of these, a local can point at all
 * of them, and once the player holds the records the channel returns null for
 * the rest of that life. What the rate decides is how long the first year
 * takes, and the fiction is unambiguous about that - the Grinding Ford is the
 * crossing every cart out of the western workings uses, and somebody would have
 * said so.
 *
 * What it is NOT is a way to learn about ground somewhere else. The speaker has
 * to be able to point at it out of their own life, which for open ground means
 * standing in the same province the player is standing in. Provinces stay hands
 * dealt at birth.
 */
export const GROUND_MENTIONED_CHANCE = 0.15;
export const GROUND_MENTIONED_WHEN_ADDRESSED = 0.35;

/**
 * Somebody here says where a road-teaching ground is.
 *
 * THE CHANNEL THAT WAS MISSING. Twenty-three of these are seeded into every
 * world and no source in the game could put one into a player's knowledge, so
 * the discovery gate over them was default-deny across an empty set: correct,
 * and indistinguishable from the places not existing.
 *
 * The speaker is anybody standing here whose own life puts the ground in front
 * of them - `knowsWhereItIs`, never `inReach`. That distinction is the content.
 * A cart driver at the bottom of the ladder has crossed the ford ten thousand
 * times and will never take anything off it, and he is exactly the person who
 * can tell you where it is. Requiring the speaker to be able to READ it would
 * have made a landmark a secret and, measured on a seeded world, would have
 * left every settlement outside one province with nobody who could say a word.
 *
 * `placed`, because they said where it is. That licenses setting out, which is
 * the whole point - and it licenses nothing else. What the ground is for, and
 * whether it will teach this cultivator anything, is not conveyed by having
 * been told where a ford is.
 */
function offerGroundSomebodyGoesTo(
    input: HearingInput,
    addressed: RosterEntry | null
): Hearing | null {
    const world = input.world;
    if (!world) return null;
    const here = worldLocationFor(world, input.cultivator.location);
    if (!here) return null;

    // Whoever is standing here and could point at one, narrowed to the person
    // the player is dealing with when they are dealing with somebody. A name
    // that arrives out of a conversation should have come from the person in
    // the conversation.
    const offers = whoCouldPointAtAGround(world, here.id)
        .filter(offer => !addressed || offer.speaker.id === addressed.id)
        .filter(offer => !input.gate.isAwareOf(input.cultivator.id, 'place', offer.ground.id));
    if (offers.length === 0) return null;

    // ── ITS OWN STREAM, WHICH IS NOT TIDINESS ────────────────────────────
    //
    // A new channel drawing off `web_hearsay` shifts every draw after it, so
    // adding one silently changes what every OTHER channel says in every
    // already-seeded world. Caught by `tests/web/presence.test.ts`, which went
    // red on a shifted overheard draw that had nothing to do with this: the
    // fragment behind the wall picked a different name and the new one belonged
    // to somebody standing in the square. Nothing about this channel was in
    // that sentence.
    //
    // So it gets its own name, and the existing streams are byte-identical to
    // what they were. Same seed, same day, same occasion - a world that never
    // meets a dao ground plays exactly as it did.
    const rng = forStream(
        input.run.seed,
        'web_hearsay_ground',
        Math.floor(input.run.elapsedDays),
        input.occasion,
        input.cultivator.id
    );
    if (!rng.chance(addressed ? GROUND_MENTIONED_WHEN_ADDRESSED : GROUND_MENTIONED_CHANCE)) {
        return null;
    }

    const chosen = offers[rng.int(0, offers.length - 1)];
    // ── AND THE SPEAKER IS ONLY NAMED WHEN THE NAME WAS EARNED ───────────
    //
    // The first build of this channel wrote the speaker's name into the ambient
    // prose, so somebody walking through a square of a hundred strangers got
    // one of them named for free - a second discovery riding along on the
    // first, and a straight leak of the gate `docs/world/discovery.md` sets.
    // Being addressed is a different case: the player resolved that person in
    // order to deal with them, and the `told` branch has always used their
    // name. Ambient talk is a voice, and a voice is not an introduction.
    //
    // Found by reading, not by a test. `tests/web/presence.test.ts` guards
    // exactly this invariant and did not catch it - it went red for an
    // unrelated reason, the stream shift above, and stayed red after this was
    // fixed. Worth saying because the two looked like one bug for a while.
    //
    // Nothing is lost by it. The place is still granted at `placed`, from a
    // real source, recorded honestly.
    const speaker = addressed?.name ?? null;
    return {
        mode: addressed ? 'told' : 'passing',
        speaker,
        names: [{
            kind: 'place',
            id: chosen.ground.id,
            name: chosen.ground.name,
            stage: 'placed',
            statement: whatTheyNowHold(chosen.ground)
        }],
        note:
            `${speaker ?? 'Somebody here'} can point at ${chosen.ground.name} because it is `
            + 'ordinary to them. Whether it is worth anything to the listener did not come up.',
        confidence: 0.7,
        sourceKind: 'told',
        stage: 'placed',
        prose: whatSomebodyWouldSayAbout(chosen.ground, speaker ?? 'Somebody here')
    };
}

/** The traveller, as the hearing the rest of the layer already understands. */
export function travellerHearing(traveller: Traveller): Hearing {
    const names: SpeakableName[] = [
        {
            kind: 'place',
            id: traveller.from.id,
            name: traveller.from.name,
            // The valuable half, and the reason this channel exists. They said
            // where they came from with a number of days on it, which is
            // exactly what `placed` means - "you know where, or who, or when".
            stage: 'placed',
            statement: placedStatement(traveller.from, traveller.daysOnTheRoad)
        },
        ...traveller.mentions.map((place): SpeakableName => ({
            kind: 'place',
            id: place.id,
            name: place.name,
            // And the other half, unchanged from every other dropped name: the
            // word, and nothing else. If the next paragraph says what it is,
            // the moment has been spent for nothing.
            stage: 'whisper',
            statement: whisperStatement(place)
        }))
    ];

    return {
        mode: 'passing',
        speaker: traveller.shape,
        names,
        note: traveller.note,
        confidence: traveller.confidence,
        sourceKind: 'told',
        stage: 'whisper',
        prose: travellerProse(traveller)
    };
}

/** What this speaker holds, given their standing and whatever they belong to. */
function heldBy(speaker: RosterEntry): Mentionable[] {
    return mentionableFor({ ordinal: speaker.realmOrdinal, factionId: speaker.sectId });
}

/** The subset the player has no record of. Ids are unique across the table. */
function unknownTo(
    gate: KnowledgeGate,
    holderId: string,
    candidates: readonly Mentionable[]
): Mentionable[] {
    const seen = new Set<string>();
    const out: Mentionable[] = [];
    for (const entry of candidates) {
        if (seen.has(entry.id)) continue;
        seen.add(entry.id);
        if (gate.isAwareOf(holderId, entry.kind, entry.id)) continue;
        out.push(entry);
    }
    return out;
}

/**
 * The candidates who are not standing in the square.
 *
 * ── WHY THE OVERHEARD CHANNEL NEEDS THIS AND THE OTHERS DO NOT ───────────
 *
 * `heldBy` gives a speaker their own working vocabulary, and a speaker's own
 * vocabulary is full of the people they stand next to all day: at the Azure
 * Cloud Pavilion grounds, Yan Shuling's mentionables include Yan Shuling and
 * three colleagues who were in the square with her. Measured on a seeded
 * world: 1,086 speaker/present-name pairs across the map, so this is a
 * property of how the catalog is placed rather than an unlucky seed.
 *
 * Two people talking to each other about somebody eight feet away is bad
 * writing, and discovery.md is explicit about why it is also bad design: the
 * overheard device exists to hand the player "a fragment they cannot resolve",
 * and "an overheard fragment that is explained a paragraph later was just
 * exposition wearing a costume". A name the player can resolve by turning
 * round is resolved in the same scene, which spends the device for nothing.
 *
 * The `told` and `passing` channels are deliberately NOT filtered. Somebody
 * talking TO the player and nodding at a colleague across the courtyard is an
 * introduction, which is a legitimate and wanted way for a name to arrive; the
 * traveller channel draws places only.
 *
 * ── MATCHED ON NAME AS WELL AS ID, AND THE ID HALF CATCHES NOTHING ───────
 *
 * The two id namespaces do not meet. `lore.ts` keys a catalog person as
 * `member-yan-shuling`; `seeding.ts` instantiates the same person into the
 * world as `npc-member-yan-shuling`. Measured on a seeded world: 203 lore
 * people, 428 world NPCs, and ZERO ids in common.
 *
 * So the id comparison is here for the `cultivators` half of the crowd, which
 * does share ids, and the NAME comparison is the one that does the work - for
 * the reason `personName` in `engine/world/history.ts` gives at length: the
 * knowledge system is keyed by id and everything the player reads is keyed by
 * name. A gate that only compared ids would pass every single one of those
 * 1,086 pairs while looking correct.
 *
 * No draw is added or removed by this: `pickWeighted` spends exactly one band
 * roll and one row roll whatever the candidate list holds, so a scene with
 * nobody nameable present is byte-identical to what it drew before.
 */
function notStandingHere(
    candidates: readonly Mentionable[],
    present: readonly RosterEntry[]
): Mentionable[] {
    if (present.length === 0) return [...candidates];

    const ids = new Set(present.map(row => row.id));
    const names = new Set(present.map(row => row.name.trim().toLowerCase()));

    return candidates.filter(entry =>
        entry.kind !== 'cultivator'
        || !(ids.has(entry.id) || names.has(entry.name.trim().toLowerCase())));
}

/**
 * Who said it, honestly.
 *
 * discovery.md: a name from a drunk carter and a name from a sect archivist are
 * different facts, and the carter's may still be the true one. So the stance is
 * the same for both and this sentence is what separates them - a note the
 * player's own record carries, and which reads differently a hundred turns
 * later when they finally hear the name from somewhere else.
 */
function toldNote(
    speaker: RosterEntry,
    intent: HearingIntent,
    reach: AnswerReach | null
): string {
    const placed = speaker.sectId
        ? `${speaker.sectName ?? 'a sect'}, as ${speaker.sectRank ?? 'a member'}`
        : 'attached to nothing anybody could point at';

    if (intent !== 'asked') {
        return `${speaker.name} said it in passing, assuming it needed no explaining. ` +
            `They are ${placed}.`;
    }

    // The circumstance of an answer is part of the fact. A hundred turns later
    // the difference between "the man was making it up" and "somebody who had
    // no reason to help mentioned it leaving" is what tells the player which of
    // their two names for a thing to trust.
    const circumstance = reach === 'guesses'
        ? 'It came out of somebody filling a gap they had no business filling, at length ' +
          'and with confidence. It may have nothing to do with what was asked.'
        : reach === 'deflects'
            ? 'It was the one thing mentioned on the way out by somebody who had already ' +
              'declined to help.'
            : reach === 'partial'
                ? 'It was said, and then the conversation stopped.'
                : 'It came out of an answer freely given.';

    return `${speaker.name} said it when asked. They are ${placed}. ${circumstance}`;
}

/**
 * How much of a fact this is.
 *
 * Never a gate on anything. It is on the record so that two rows for the same
 * name, acquired from two people, can be told apart later by something other
 * than the day they landed.
 */
function toldConfidence(speaker: RosterEntry, reach: AnswerReach | null): number {
    const base = speaker.sectId ? 0.35 : 0.25;
    // Somebody who had already refused and then said one thing anyway is not
    // giving you their considered position on it.
    return reach === 'deflects' ? base * 0.6 : base;
}

// ─────────────────────────────────────────────────────────────────────────
// RECORDING IT
// ─────────────────────────────────────────────────────────────────────────

/**
 * Write the hearing down, at the lowest stage, with its real source.
 *
 * `suspects` rather than `believes`: the player has a word and no way to
 * evaluate it. A name from a drunk carter and a name from a sect archivist are
 * different facts and the carter's may still be the true one, so the stance
 * stays low for both and the SOURCE is what distinguishes them.
 *
 * Three sources reach this table and they are genuinely different facts:
 * `told` is somebody saying it, `overheard` is somebody not meaning to, and
 * `assumed` is somebody filling a gap with whatever came to hand. The player
 * is never shown which one they got.
 *
 * Returns the names that were genuinely new, which is what the narrator is
 * licensed to have a character say.
 */
export function recordHearing(
    gate: KnowledgeGate,
    cultivator: Cultivator,
    run: Run,
    hearing: Hearing
): SpeakableName[] {
    const learned: SpeakableName[] = [];
    for (const name of hearing.names) {
        const stage = name.stage ?? hearing.stage ?? 'whisper';
        const isNew = gate.learnIfNew({
            holderId: cultivator.id,
            kind: name.kind,
            id: name.id,
            name: name.name,
            onDay: Math.floor(run.elapsedDays),
            sourceKind: hearing.sourceKind,
            sourceNote: hearing.note,
            stage,
            confidence: hearing.confidence,
            statement:
                name.statement
                ?? `${name.name} is a name that got said. What it is remains unknown.`
        });
        if (isNew) learned.push(name);
    }
    return learned;
}
