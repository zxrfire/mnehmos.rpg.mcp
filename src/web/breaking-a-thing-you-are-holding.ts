/**
 * The `destroy` verb: the sentence that reaches the world's breaking primitive.
 *
 * ANYBODY CAN END A THING, and the player is one of them. The rule and the
 * grading live in `a-thing-somebody-ended-is-a-fact.ts`, which a war and a
 * fight call on the same footing; this file is the doorway and nothing else -
 * it resolves what the player named against what they can reach, and hands it
 * over.
 *
 * WHAT WAS MISSING WAS THE DOORWAY. `ruin` has been the destruction primitive
 * since the possessions layer was written and had seven callers, every one of
 * them the world acting on somebody. Measured on `a-xianxia-run`: "I smash the
 * stall" reached the blank look, "I smash the pill" was read as SWALLOWING it,
 * and "I break my sword" was read as swinging it at somebody.
 *
 * WHAT THE PLAYER CAN REACH, which is the only question this file answers:
 * what they are carrying, and what of theirs is standing where they are.
 * `whatIsWithinReachOf` already draws exactly that line for a theft, so the
 * two verbs agree about what a person has by construction rather than by two
 * tables matching.
 *
 * AND WHAT THEY CANNOT. A stall, an inn and a village route here anyway: the
 * sentence has to arrive somewhere that knows what the engine models before
 * anybody can be told, and an honest "there is no rule for that" is worth more
 * than a blank look claiming the sentence was unreadable.
 */

import type { Cultivator, Run } from '../schema/cultivation.js';
import { factsForRefusal, factsForToolResult, placeName } from './facts.js';
import { refused } from './tool-result-prose.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';
import { whatIsWithinReachOf, whichThingTheyMeant } from './object-theft.js';
import { aBreakingEntersTheWorld } from '../engine/world/a-thing-somebody-ended-is-a-fact.js';
import {
    howMuchAGradeIsWorthTracking,
    type ObjectSignificance
} from '../engine/world/possessions.js';
import { removeFromPouch } from '../server/consolidated/cultivation-support.js';
import { getPill } from '../data/cultivation/pills.js';
import { getHerb } from '../data/cultivation/herbs.js';
import { getArtifact } from '../data/cultivation/artifacts.js';
import { matchScore } from './entities.js';
import type Database from 'better-sqlite3';

/**
 * What the engine can make, said once, for the refusal that names the line.
 *
 * `refine` produces pills and `craft` produces conveyances, and both land as
 * one of the two tiers above. Everything else a player can break is something
 * the world put in their hands.
 */
/**
 * The inspector line a breaking writes, as a name rather than a spelling.
 *
 * The scene layer has to know a thing ended here, because `sceneWeight` is
 * otherwise the furthest any BODY moved and a destruction moves nobody - so a
 * treasure smashed in a crowded square priced at zero and the square read as
 * idle. It asks by this constant rather than by matching text, so the two
 * cannot drift apart silently.
 */
export const A_BREAKING_WAS_WRITTEN_DOWN = 'world.aBreakingEntersTheWorld';

export const WHAT_CAN_BE_UNMADE =
    'What you can break is what you are holding, and what of yours is standing where you '
    + 'are. A building is not a thing this engine keeps an account of, so there is no '
    + 'version of burning one that would change anything.';

/** How close a name has to be before it is the thing they meant. */
const CLOSE_ENOUGH = 60;

interface CountedHolding {
    itemId: string;
    name: string;
    significance: ObjectSignificance;
}

/**
 * The counted tier, as names a player could type.
 *
 * Read off the pouch and joined to whichever catalog owns the row, because a
 * pouch row is an id and a quantity and a player types a name.
 */
function countedHoldings(db: Database.Database, cultivatorId: string): CountedHolding[] {
    const rows = db
        .prepare(
            'SELECT item_id, item_kind FROM cultivator_pouch '
            + 'WHERE holder_id = ? AND quantity > 0'
        )
        .all(cultivatorId) as { item_id: string; item_kind: string }[];
    const held: CountedHolding[] = [];
    for (const row of rows) {
        if (row.item_kind === 'pill') {
            const pill = getPill(row.item_id);
            if (pill) {
                held.push({
                    itemId: row.item_id,
                    name: pill.name,
                    significance: howMuchAGradeIsWorthTracking(pill.grade)
                });
            }
            continue;
        }
        if (row.item_kind === 'herb') {
            const herb = getHerb(row.item_id);
            if (herb) {
                held.push({
                    itemId: row.item_id,
                    name: herb.name,
                    significance: howMuchAGradeIsWorthTracking(herb.grade)
                });
            }
            continue;
        }
        const object = getArtifact(row.item_id);
        if (object) {
            held.push({
                itemId: row.item_id,
                name: object.name,
                significance: object.significance
            });
        }
    }
    return held;
}

function whichHoldingTheyNamed(
    held: readonly CountedHolding[],
    said: string
): CountedHolding | null {
    let best: { row: CountedHolding; score: number } | null = null;
    for (const row of held) {
        const score = matchScore(said, row.name);
        if (score >= CLOSE_ENOUGH && (best === null || score > best.score)) {
            best = { row, score };
        }
    }
    return best?.row ?? null;
}

export const destroyVerbs = {
    /**
     * Break a named thing, and put the breaking into the world.
     *
     * Free of the clock on purpose: the act is a moment and what it costs is
     * the thing. See the `destroy` row in `HOW_AN_ACT_CAN_END_BADLY`.
     */
    async destroy(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        target: string | undefined
    ): Promise<Execution> {
        const said = (target ?? '').trim();
        const counted = countedHoldings(this.db, cultivator.id);

        this.atHand = this.atHand ?? await this.loadWorld();
        const world = this.atHand;
        const within = world
            ? whatIsWithinReachOf(world, cultivator.id, cultivator.location)
            : [];

        const reachable = [...within.map(row => row.object.name), ...counted.map(row => row.name)];

        if (said.length < 2) {
            return refused('engine.nothingNamed', 'destroy', factsForRefusal(
                'Nothing named.',
                reachable.length > 0
                    ? 'You get as far as deciding to break something and no further, because you '
                      + `have not said which: ${reachable.join(', ')}.`
                    : 'You have nothing on you worth breaking, and breaking is not a thing you '
                      + 'can do in general.',
                `destroy with no target. Within reach: ${reachable.join(', ') || 'nothing'}.`
            ));
        }

        const tracked = world ? whichThingTheyMeant(within, said) : null;
        const stack = tracked ? null : whichHoldingTheyNamed(counted, said);

        if (!tracked && !stack) {
            return refused('engine.nothingOfYoursIsCalledThat', 'destroy', factsForRefusal(
                `Nothing of yours is called ${said}.`,
                `${WHAT_CAN_BE_UNMADE}`
                + (reachable.length > 0
                    ? ` What you have on you: ${reachable.join(', ')}.`
                    : ' You are carrying nothing.'),
                `destroy: "${said}" matched nothing within reach of ${cultivator.id}. `
                + `Tracked: ${within.length}; counted: ${counted.length}. The verb reaches what `
                + '`ruin` can take and nothing else, which is what keeps the refusal true.'
            ));
        }

        const name = tracked ? tracked.object.name : stack!.name;

        // ── THE WORLD'S OWN PRIMITIVE, WITH THE PLAYER AS THE ACTOR ──────
        //
        // The same call a war makes and a fight makes. Nothing about this
        // branch knows that the actor is the player, which is the point: a
        // heaven-grade thing ending has to be news whoever ended it.
        const gone = world
            ? aBreakingEntersTheWorld(world, {
                actor: { id: cultivator.id, name: cultivator.name, role: 'broke it' },
                ...(tracked ? { object: tracked.object } : {}),
                ...(stack
                    ? {
                        counted: {
                            itemId: stack.itemId,
                            name: stack.name,
                            significance: stack.significance
                        }
                    }
                    : {}),
                day: Math.floor(world.currentDay),
                locationId: this.worldPlaceOf(cultivator),
                place: placeName(cultivator),
                how: 'broken on purpose, by somebody who meant it'
            })
            : null;

        const lines: string[] = [];
        const structure: string[] = [];

        if (tracked) {
            // A row already ruined is a thing that ended once. `destroy` is
            // idempotent by the primitive's own gate rather than by a check
            // here, and there is nothing left to say about it.
            if (world) this.theWorldMoved();
            lines.push(
                `${name} is finished. What is left of it is a record with your name on it, and `
                + 'the record does not go away.'
            );
        } else {
            removeFromPouch(this.db, cultivator.id, stack!.itemId, 1);
            if (world) this.theWorldMoved();
            lines.push(`${name} is gone. There is nothing left of it to put anywhere.`);
            structure.push(
                `pouch row ${stack!.itemId} down one. Counted tier - no world object row exists `
                + 'for it, so nothing survives that anybody could ask about by name.'
            );
        }

        if (gone) {
            lines.push(
                gone.addressable
                    ? 'That was not a quiet thing to do. People who were nowhere near here will '
                      + 'hear which one it was.'
                    : 'The people standing here saw it, and will say so for a while.'
            );
            structure.push(
                `${A_BREAKING_WAS_WRITTEN_DOWN}: ${gone.fact.id} (object_destroyed, ${gone.weight}, `
                + `magnitude ${gone.fact.magnitude.toFixed(2)}, ${gone.fact.visibility}), `
                + `${gone.fact.witnessIds.length} present. ${gone.line}`
            );
        } else {
            structure.push(
                'No world is running, so nothing was written to the record. The pouch moved and '
                + 'nothing else did.'
            );
        }

        const facts = factsForToolResult(`${name}: broken.`, lines);
        facts.structure.push(...structure);
        // A player who is not told has no way to know they have just done
        // something the province will be repeating.
        facts.required = lines.slice();
        return this.freeAction(run, 'destroy', facts);
    }
};
