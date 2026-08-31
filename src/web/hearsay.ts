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
import type { RosterEntry } from '../storage/repos/cultivator.repo.js';
import type { CultivationRepos } from '../server/consolidated/cultivation-support.js';
import { npcsAt, type WorldState } from '../engine/world/world-state.js';
import { worldLocationFor } from './entities.js';
import { worldRosterRow } from './view.js';
import type { KnowledgeGate, KnownEntityKind } from './knowledge.js';
import {
    COMMON_CURRENCY_ORDINAL,
    OVERHEARD_BAND_WEIGHTS,
    TOLD_BAND_WEIGHTS,
    WORKING_KNOWLEDGE_MARGIN,
    mentionableFor,
    pickWeighted,
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

export interface SpeakableName {
    kind: KnownEntityKind;
    id: string;
    name: string;
}

export interface Hearing {
    /**
     * `told` is somebody addressing the player. `overheard` is two people not
     * addressing them, which is the sharper form: the option to ask is gone,
     * and what the player ends up holding is knowledge with compromising
     * provenance - they cannot act on it without revealing where they were
     * standing.
     */
    mode: 'told' | 'overheard';
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

    if (!world) return stored;

    const place = worldLocationFor(world, cultivator.location);
    if (!place) return stored;

    const inWorld = npcsAt(world, place.id).map(npc => worldRosterRow(npc, world.currentDay));
    return [...stored, ...inWorld];
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
    const rng = forStream(run.seed, 'web_hearsay', day, occasion, cultivator.id);
    const locale: Locale = { regionId: regionOfPlace(cultivator.location) };

    const present = othersPresent(repos, cultivator, input.world);
    const addressed = input.addressing ?? null;

    // ── Somebody talking to the player ──
    if (addressed) {
        if (!rng.chance(SPOKEN_NAME_CHANCE)) return null;
        const candidates = unknownTo(gate, cultivator.id, heldBy(addressed));
        const name = pickWeighted(candidates, locale, TOLD_BAND_WEIGHTS, rng);
        if (!name) return null;
        return {
            mode: 'told',
            speaker: addressed.name,
            names: [toSpeakable(name)],
            note: toldNote(addressed),
            confidence: toldConfidence(addressed)
        };
    }

    // ── Two people not talking to the player ──
    // Needs at least two of them, because one person alone in a courtyard is
    // not having a conversation, and a monologue for the player's benefit is
    // the exact failure this device exists to avoid.
    if (present.length < 2) return null;
    if (!rng.chance(OVERHEARD_CHANCE)) return null;

    const first = present[rng.int(0, present.length - 1)];
    const others = present.filter(row => row.id !== first.id);
    const second = others[rng.int(0, others.length - 1)];

    // Both speakers' vocabularies, because they are talking to each other and
    // each assumes the other knows. A shared history neither is going to
    // summarise is exactly the thing that produces an unresolvable fragment.
    const candidates = unknownTo(gate, cultivator.id, [...heldBy(first), ...heldBy(second)]);
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
        confidence: 0.2
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
 * Who said it, honestly.
 *
 * discovery.md: a name from a drunk carter and a name from a sect archivist are
 * different facts, and the carter's may still be the true one. So the stance is
 * the same for both and this sentence is what separates them - a note the
 * player's own record carries, and which reads differently a hundred turns
 * later when they finally hear the name from somewhere else.
 */
function toldNote(speaker: RosterEntry): string {
    const placed = speaker.sectId
        ? `${speaker.sectName ?? 'a sect'}, as ${speaker.sectRank ?? 'a member'}`
        : 'attached to nothing anybody could point at';
    return `${speaker.name} said it in passing, assuming it needed no explaining. ` +
        `They are ${placed}.`;
}

/**
 * How much of a fact this is.
 *
 * Never a gate on anything. It is on the record so that two rows for the same
 * name, acquired from two people, can be told apart later by something other
 * than the day they landed.
 */
function toldConfidence(speaker: RosterEntry): number {
    return speaker.sectId ? 0.35 : 0.25;
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
        const isNew = gate.learnIfNew({
            holderId: cultivator.id,
            kind: name.kind,
            id: name.id,
            name: name.name,
            onDay: Math.floor(run.elapsedDays),
            sourceKind: hearing.mode === 'overheard' ? 'overheard' : 'told',
            sourceNote: hearing.note,
            stance: 'suspects',
            confidence: hearing.confidence,
            statement: `${name.name} is a name that got said. What it is remains unknown.`
        });
        if (isNew) learned.push(name);
    }
    return learned;
}
