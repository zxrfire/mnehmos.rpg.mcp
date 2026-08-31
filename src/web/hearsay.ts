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
 * ── Hearing grants the name, not the meaning ──────────────────────────────
 * Everything recorded here lands at the lowest positive stance - `suspects` -
 * with the source attached. The player has the word and nothing else, from one
 * interested party who may be wrong. Whether the Hollow Court is a sect, a
 * court, a person or a joke is not conveyed by having heard of it.
 */

import type { Cultivator, Run } from '../schema/cultivation.js';
import { forStream } from '../engine/cultivation/rng.js';
import { SECTS } from '../data/cultivation/index.js';
import type { RosterEntry } from '../storage/repos/cultivator.repo.js';
import type { CultivationRepos } from '../server/consolidated/cultivation-support.js';
import { npcsAt, type WorldState } from '../engine/world/world-state.js';
import { worldLocationFor } from './entities.js';
import { worldRosterRow } from './view.js';
import type { KnowledgeGate, KnownEntityKind } from './knowledge.js';

/**
 * How far above their own standing a person's working knowledge reaches.
 *
 * A cultivator deals with, competes against and is bullied by things within
 * roughly two realms of themselves, and can name them the way anyone names
 * their own trade.
 */
export const WORKING_KNOWLEDGE_MARGIN = 8;

/**
 * Power at which a thing becomes common currency regardless of who is
 * speaking.
 *
 * This is what makes the register work. A carter has no business knowing
 * anything about Body Integration politics, and still says "Hollow Court
 * business" the way you would say a bank holiday, because some names are simply
 * in the air. The mundane and the enormous sound identical when both are
 * assumed knowledge, and the speaker's tone cannot distinguish them - because
 * to them both are ordinary.
 */
export const COMMON_CURRENCY_ORDINAL = 33;

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
    /** What may be said. Small by design; usually one name. */
    names: SpeakableName[];
    /** Engine-authored provenance, recorded and shown to the narrator. */
    note: string;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT A PERSON COULD PLAUSIBLY NAME
// ─────────────────────────────────────────────────────────────────────────

/**
 * Every faction this speaker could drop into a sentence without thinking.
 *
 * Two sources, and the second is the interesting one: what they deal with, and
 * what everyone deals with. Nothing here consults the PLAYER's knowledge -
 * that is the whole point. The speaker is not adjusting for their audience,
 * because it has not occurred to them that they need to.
 */
export function speakableFor(speakerOrdinal: number): SpeakableName[] {
    return SECTS
        .filter(sect =>
            sect.powerOrdinal <= speakerOrdinal + WORKING_KNOWLEDGE_MARGIN ||
            sect.powerOrdinal >= COMMON_CURRENCY_ORDINAL)
        .map(sect => ({ kind: 'sect' as const, id: sect.id, name: sect.name }));
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

    const present = othersPresent(repos, cultivator, input.world);
    const addressed = input.addressing ?? null;

    // ── Somebody talking to the player ──
    if (addressed) {
        if (!rng.chance(SPOKEN_NAME_CHANCE)) return null;
        const name = pickUnknown(gate, cultivator.id, speakableFor(addressed.realmOrdinal), rng);
        if (!name) return null;
        return {
            mode: 'told',
            speaker: addressed.name,
            names: [name],
            note: `${addressed.name} said it in passing, assuming it needed no explaining.`
        };
    }

    // ── Two people not talking to the player ──
    // Needs at least two of them, because one person alone in a courtyard is
    // not having a conversation, and a monologue for the player's benefit is
    // the exact failure this device exists to avoid.
    if (present.length < 2) return null;
    if (!rng.chance(OVERHEARD_CHANCE)) return null;

    const speaker = present[rng.int(0, present.length - 1)];
    const name = pickUnknown(gate, cultivator.id, speakableFor(speaker.realmOrdinal), rng);
    if (!name) return null;

    return {
        mode: 'overheard',
        speaker: null,
        names: [name],
        note:
            'Overheard from people who did not know they were heard. Acting on it would ' +
            'reveal where this cultivator was standing.'
    };
}

/** A name the speaker holds and the player does not. Null when there is none. */
function pickUnknown(
    gate: KnowledgeGate,
    holderId: string,
    candidates: readonly SpeakableName[],
    rng: { int(min: number, max: number): number }
): SpeakableName | null {
    const unknown = candidates.filter(c => !gate.isAwareOf(holderId, c.kind, c.id));
    if (unknown.length === 0) return null;
    return unknown[rng.int(0, unknown.length - 1)];
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
            confidence: hearing.mode === 'overheard' ? 0.2 : 0.3,
            statement: `${name.name} is a name that got said. What it is remains unknown.`
        });
        if (isNew) learned.push(name);
    }
    return learned;
}
