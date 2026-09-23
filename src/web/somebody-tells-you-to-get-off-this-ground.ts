/**
 * The player walks up to ground somebody is already working, and is told to
 * get off it.
 *
 * The rule is `engine/encounters/being-told-to-get-off-this-ground.ts`: who
 * says it, whether anybody says it at all, and what refusing would look like,
 * read off the same distribution the world's own year uses so a scene and a
 * background year cannot disagree about what a fight on this ground is. This
 * file is the doorway, and it is three joins and no new rules:
 *
 *   it is SAID      when the player's place changes onto such ground. The
 *                   demand is DERIVED from who is standing there, so nothing
 *                   stores it and nothing has to expire: walk away and it is
 *                   gone, come back and it is there again
 *   going           is the ordinary walk. What it leaves is the slight the
 *                   engine names ({@link whatGoingCosts}), written when the
 *                   player leaves ground a demand was standing on
 *   refusing        is answered where every other "no" is answered, and hands
 *                   off to the ordinary confrontation. Nothing is refused by
 *                   rule: the engine says what it would look like first, and
 *                   the player answers
 *
 * OFFERING THEM SOMETHING NEEDS NOTHING HERE, which is the point of saying so.
 * "I offer Hu Lan a share" is an attempt to move a person and already goes
 * through `resolveAttempt` by the ordinary road (`interact`, then
 * `pressSomebody`), with a share, stones, a favour or joining forces as the
 * thing put. A second door for it would be a second answer to a question the
 * attempt machinery already answers - so what this file does about it is NAME
 * the speaker in the demand, because a player can only put something to
 * somebody they can type back.
 */

import {
    theyTellYouToLeave,
    whatGoingCosts,
    whatRefusingLooksLike,
    type SomebodyStandingThere,
    type TheDemand,
    type WhatRefusingLooksLike
} from '../engine/encounters/being-told-to-get-off-this-ground.js';
import { isGroundAwayFromEverybody } from '../engine/world/why-one-cultivator-kills-another.js';
import { whoHoldsTheGround } from '../engine/world/ground-holder.js';
import type { LocationRecord } from '../engine/world/locations.js';
import { createGrudge } from '../engine/social/grudges.js';
import { writeOneObligation } from '../storage/repos/obligation.repo.js';
import type { AmbientQi, Cultivator, Run } from '../schema/cultivation.js';
import type { DatabaseHandle } from './encounters.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

export interface TheDemandStanding {
    demand: TheDemand;
    refusing: WhatRefusingLooksLike;
    place: LocationRecord;
}

/** Everybody standing here, as the scene reads a person. */
function asStanding(row: {
    id: string; name: string; realmOrdinal: number; sectId: string | null; sectName: string | null;
}): SomebodyStandingThere {
    return {
        id: row.id,
        name: row.name,
        ordinal: row.realmOrdinal,
        factionId: row.sectId,
        factionName: row.sectName
    };
}

/**
 * The demand standing on the ground this cultivator is on, or null.
 *
 * Derived on every ask rather than kept: the people are the demand, and a scene
 * kept on a flag would go on being answerable after they had gone.
 */
export function theDemandOnThisGround(
    game: Pick<GameService, 'repos' | 'atHand' | 'present' | 'worldPlaceOf'>,
    cultivator: Cultivator
): TheDemandStanding | null {
    const world = game.atHand;
    if (!world || !cultivator.alive) return null;
    const placeId = game.worldPlaceOf(cultivator);
    const place = placeId === null ? null : world.locations.find(l => l.id === placeId) ?? null;
    if (place === null) return null;

    const here = game.present(cultivator).map(asStanding);
    if (here.length === 0) return null;
    const arrival = asStanding({
        id: cultivator.id,
        name: cultivator.name,
        realmOrdinal: cultivator.realmOrdinal,
        sectId: cultivator.sectId ?? null,
        sectName: null
    });
    const holder = whoHoldsTheGround(world.locations, place.id);
    const heldBy = holder.holderFactionId === null
        ? null
        : world.factions.find(f => f.id === holder.holderFactionId && f.dissolvedOnDay === null) ?? null;

    const demand = theyTellYouToLeave({ here, arrival, place, heldBy });
    if (demand === null) return null;

    // The same reading the world's own year takes: somebody else within sight,
    // or ground that is not away from everybody. See
    // `a-year-of-people-acting-on-why-they-would-kill.ts`.
    const theirs = new Set(demand.theirSide.map(p => p.id));
    const peopleNearby = here.some(p => !theirs.has(p.id)) || !isGroundAwayFromEverybody(place);
    return {
        demand,
        refusing: whatRefusingLooksLike({ demand, arrival, place, peopleNearby }),
        place
    };
}

export interface WhatWasSaidToThem {
    lines: string[];
    structure: string;
}

/**
 * The demand, said on the turn the player walks onto the ground, and the slight
 * written on the turn they walk off it. Null on every other turn.
 *
 * Both halves are read off where the player was when the turn began and where
 * they are now, so every way of arriving and leaving reaches them and no list
 * of verbs has to be kept.
 */
export function settleWhoIsAlreadyOnThisGround(
    game: GameService,
    before: Cultivator,
    now: Cultivator
): WhatWasSaidToThem | null {
    const world = game.atHand;
    if (!world) return null;
    const wasAt = game.worldPlaceOf(before);
    const isAt = game.worldPlaceOf(now);
    if (wasAt === isAt) return null;

    // ── WALKED OFF IT: the slight, and nothing else ──────────────────────
    const behind = theDemandOnThisGround(game, before);
    if (behind !== null && wasAt !== null) {
        const cost = whatGoingCosts();
        const said = behind.demand.saidBy;
        writeOneObligation(game.repos.db as unknown as DatabaseHandle, createGrudge({
            holderId: now.id,
            subjectId: said.id,
            cause: 'humiliation',
            severity: 'slight',
            onDay: Math.floor(game.currentRun().run.elapsedDays),
            description: `Told to leave ${behind.place.name} by ${said.name}, and went.`,
            participants: behind.demand.theirSide.map(p => p.id).filter(id => id !== said.id),
            terms: null,
            dueOnDay: null,
            tags: ['told_to_leave']
        }));
        return {
            lines: [
                // ONE SENTENCE, AND THE NUMBER IS ON THE STRUCTURE LINE. This
                // used to close with "That is all it cost, and you are the one
                // who holds it" - a judgement about the size of the cost, and
                // then the grudge's holder said a second time by the line
                // directly underneath, which states it with the figure in it.
                `You are off ${behind.place.name}, and ${said.name} watched you go.`
            ],
            structure:
                `being-told-to-get-off-this-ground: left ${behind.place.id} with the demand standing. `
                + `A slight (${cost.standing}) held by ${now.id} against ${said.id}. Nothing else written.`
        };
    }

    // ── WALKED ONTO IT: the demand, and the three answers ────────────────
    const standing = theDemandOnThisGround(game, now);
    if (standing === null) return null;
    const said = standing.demand.saidBy;
    return {
        lines: [
            standing.demand.line,
            standing.refusing.line,
            `You can go, you can put something to ${said.name} - a share, stones, a favour, or `
            + 'working it together - or you can tell them no and stand where you are.'
        ],
        structure:
            `theyTellYouToLeave: ${said.id} speaks for ${standing.demand.theirSide.length} at `
            + `${standing.place.id}. ${standing.refusing.line} Nothing is stored: the demand is the `
            + 'people standing there.'
    };
}

/**
 * Telling them no, which is the ordinary confrontation with the numbers on the
 * far side. Null where no demand is standing, so the caller can answer whatever
 * else the sentence was about.
 *
 * NOTHING IS REFUSED HERE. The player was told what it would look like before
 * they answered, which is the agency rule's own shape: the bound is a fact
 * about the world, and the decision is theirs.
 */
export async function theyAreToldNo(
    game: GameService,
    run: Run,
    cultivator: Cultivator,
    ambient: AmbientQi
): Promise<Execution | null> {
    const standing = theDemandOnThisGround(game, cultivator);
    if (standing === null) return null;
    const said = standing.demand.saidBy;
    const fight = await game.attack(
        run, cultivator, ambient, said.name, undefined, false, undefined, 'open', 'open'
    );
    const opening = [
        `You tell ${said.name} no, and you do not move. ${standing.refusing.line}`
    ];
    fight.facts.lines.unshift(...opening);
    fight.facts.required = [...opening, ...(fight.facts.required ?? [])];
    fight.facts.structure.push(
        `being-told-to-get-off-this-ground: refused at ${standing.place.id}; `
        + `${standing.demand.theirSide.length} on the far side, speaking through ${said.id}.`
    );
    return fight;
}
