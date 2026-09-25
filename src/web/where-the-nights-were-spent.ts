/**
 * Whether a span's nights were spent under a roof or in the open, and what the open cost the body.
 *
 * The arithmetic is `a-night-in-the-open.ts`. This file decides which nights
 * were outdoors, once, after any verb that spent days (`GameService.execute`
 * calls {@link theWeatherTakesItsShare}), so no verb has to remember to.
 *
 * A roof is: the room at the inn here while it is paid for, the room a house
 * gives you or your own abode while you stand in it, anywhere inside walls or
 * under rock (an interior, a cave, a sealed or secret domain), or an act that is
 * roofed by what it is (a sealed seclusion, a course of care, paid work, a paid
 * seat). A road walked on foot, a hunt and a day on the herb ground are outdoors
 * whatever the place.
 */

import { requireRegion } from '../data/cultivation/regions.js';
import { whatTheNightsInTheOpenCost } from '../engine/cultivation/a-night-in-the-open.js';
import type { WorldState } from '../engine/world/world-state.js';
import { SATIETY_MAX, type Cultivator, type Run } from '../schema/cultivation.js';
import { standingOf } from '../server/consolidated/where-a-cultivator-is-standing.js';
import { howMany } from '../utils/a-count-agrees-with-what-it-counts.js';
import { endTheLodgingOnLeaving, whereTheyAreLodged } from './a-room-at-an-inn.js';
import type { ActionName } from './action-set.js';
import { placeName } from './facts.js';
import { theQuartersThisCultivatorHas } from './leaving-a-thing-in-your-own-room.js';
import { theSeasonOn } from './prompt.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

const OUTDOORS_BY_THE_ACT: ReadonlySet<ActionName> = new Set<ActionName>(['move', 'gather', 'hunt']);
const UNDER_A_ROOF_BY_THE_ACT: ReadonlySet<ActionName> = new Set<ActionName>([
    'seclude', 'treat', 'child', 'work', 'passage'
]);

/** Grounds that make a province hard country to sleep out in. */
const HARD_GROUND = new Set(['glacier', 'high_peak', 'desert']);

const UNDER_ROCK_OR_WALLS = new Set(['cave', 'sealed_domain', 'secret_realm']);

/** Whether where they stand is inside walls, under rock, or a room that is theirs. */
function aRoofOverWhereTheyStand(game: GameService, world: WorldState | null, cultivator: Cultivator): boolean {
    if (!world) return false;
    const at = game.worldPlaceOf(cultivator);
    const theirs = theQuartersThisCultivatorHas(game, world, cultivator);
    if (theirs && theirs.reachedFrom(at)) return true;
    let row = at ? world.locations.find(location => location.id === at) ?? null : null;
    const seen = new Set<string>();
    while (row && !seen.has(row.id)) {
        if (UNDER_ROCK_OR_WALLS.has(row.kind) || row.tags.includes('interior')) return true;
        seen.add(row.id);
        row = row.parentId ? world.locations.find(location => location.id === row!.parentId) ?? null : null;
    }
    return false;
}

/**
 * Charge these run days as nights in the open, and say what they cost.
 *
 * Null when the body lost nothing: Foundation and above, all fair nights, or
 * already as low as weather takes it.
 */
export function chargeTheNightsInTheOpen(
    game: GameService,
    run: Run,
    cultivator: Cultivator,
    nights: readonly number[]
): { line: string; structure: string } | null {
    const grounds = requireRegion(standingOf(cultivator).regionId).grounds;
    const cost = whatTheNightsInTheOpenCost({
        nights,
        seed: run.seed,
        realmOrdinal: cultivator.realmOrdinal,
        hp: cultivator.hp,
        maxHp: cultivator.maxHp,
        hardCountry: grounds.some(ground => HARD_GROUND.has(ground)),
        isWinter: day => theSeasonOn(day).includes('winter')
    });
    if (cost.taken <= 0) return null;
    game.db.transaction(() => {
        game.repos.cultivators.applyDeltas(cultivator.id, { hp: -cost.taken });
    })();
    return {
        // Said as the body, not as a ledger: "cost the body 19" read as bookkeeping.
        line: `${howMany(cost.nights, 'night')} in the open ${cost.nights === 1 ? 'has' : 'have'} worn the body `
            + `down to ${cost.hpAfter} of ${cultivator.maxHp}`
            + (cost.heldAtTheFloor ? ', as low as weather alone brings it.' : '.'),
        structure: `a-night-in-the-open: ${cost.nights} night(s) outdoors below Foundation, `
            + `${cost.rawNights} raw and ${cost.foulNights} foul; ${cost.taken} HP taken`
            + `${cost.heldAtTheFloor ? ', held at the exposure floor' : ''}.`
    };
}

/** Put what the nights cost onto a turn's facts, where the player will read it. */
export function sayWhatTheNightsCost(done: Execution, charged: { line: string; structure: string }): void {
    done.facts.lines.push(charged.line);
    done.facts.prose = done.facts.prose.length > 0 ? `${done.facts.prose}\n\n${charged.line}` : charged.line;
    done.facts.required = [...(done.facts.required ?? []), charged.line];
    done.facts.structure.push(charged.structure);
}

/**
 * After a verb that spent days: charge the nights it spent outdoors, feed the
 * nights spent at the inn, and end a lodging somebody has walked away from.
 *
 * Skipped while a fight stands, because the fight holds the body until it ends.
 */
export function theWeatherTakesItsShare(
    game: GameService,
    action: ActionName,
    run: Run,
    before: Cultivator,
    done: Execution,
    aFightStands: boolean
): void {
    const skip = done.timeSkip;
    const spent = done.outcome === 'executed' && skip && !skip.died ? Math.max(0, skip.simulatedDays) : 0;
    const said = done.nights;
    if (spent > 0 && !aFightStands && said !== 'charged' && said !== 'under_a_roof') {
        const startDay = Math.floor(run.elapsedDays);
        const days = Array.from({ length: spent }, (_, i) => startDay + i);
        const outdoorsByTheAct = said === 'in_the_open' || OUTDOORS_BY_THE_ACT.has(action);
        const lodging = outdoorsByTheAct ? null : whereTheyAreLodged(game, before);
        const roofed = !outdoorsByTheAct
            && (UNDER_A_ROOF_BY_THE_ACT.has(action) || aRoofOverWhereTheyStand(game, game.atHand, before));
        const atTheInn = lodging ? days.filter(day => day < lodging.paidThroughDay) : [];
        const open = roofed ? [] : days.filter(day => !lodging || day >= lodging.paidThroughDay);

        const after = game.repos.cultivators.getById(before.id);
        if (after && atTheInn.length > 0 && after.satiety < SATIETY_MAX) {
            game.db.transaction(() => {
                game.repos.cultivators.applyDeltas(after.id, {
                    satiety: SATIETY_MAX - after.satiety,
                    starvationTurns: -after.starvationTurns
                });
            })();
        }
        const charged = after && open.length > 0 ? chargeTheNightsInTheOpen(game, run, after, open) : null;
        if (charged) sayWhatTheNightsCost(done, charged);
    }
    const now = game.repos.cultivators.getById(before.id);
    if (now) endTheLodgingOnLeaving(game, now.id, placeName(now));
}
