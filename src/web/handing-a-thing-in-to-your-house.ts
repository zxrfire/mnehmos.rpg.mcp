/**
 * The `sect/hand_in` door: a member hands a thing in to their own house.
 *
 * THE RULE AND THE PRICE ARE NOT HERE. What a house wants, why, and what it
 * credits are `whatTheHouseMakesOf` in `what-a-house-gives-merit-for.ts`, and
 * the move of the row into the house's keeping is `theHouseTakesItIn` beside
 * it, which the world's own people go through too. The owner's rulings, in
 * that file's words: a house credits what it cannot simply buy with its own
 * treasury, the want fills once it holds one, and buying a thing in order to
 * hand it in is allowed.
 *
 * WHAT THIS FILE ANSWERS is only what the player's hand holds and where it
 * goes: the rows the world tracks for them, and the pouch. A pouch stack has
 * no row, so the one handed in is given one at the moment it changes hands -
 * the house has to hold something a later want can find, or the want would
 * never fill for anything a player handed in.
 *
 * AND WHERE IT CAN BE HANDED. To somebody of the house: inside its walls, or
 * to one of its people standing where the player is. Anywhere else there is
 * nobody to take it, and the answer says where the house keeps its stores.
 *
 * MERIT IS THE PLAYER'S CONTRIBUTION. `NpcRecord.merit` is the world's ledger
 * for its own people and the units are the same; the player's is
 * `sect_members.contribution`, and nothing here writes the other.
 */

import type Database from 'better-sqlite3';

import { getPill } from '../data/cultivation/pills.js';
import { getTechnique } from '../data/cultivation/techniques.js';
import { whatAnIngredientIs } from '../engine/cultivation/what-a-cauldron-will-take.js';
import {
    howMuchAGradeIsWorthTracking,
    isRuined,
    makeObject,
    type ObjectRecord
} from '../engine/world/possessions.js';
import {
    theHouseTakesItIn,
    whatTheHouseMakesOf,
    whatThisThingIs,
    type WhatTheHouseMakesOfIt
} from '../engine/world/what-a-house-gives-merit-for.js';
import { theSeatOfTheCompound } from '../engine/world/where-inside-a-house-somebody-is-standing.js';
import type { FactionRecord, WorldState } from '../engine/world/world-state.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import { removeFromPouch } from '../server/consolidated/cultivation-support.js';
import { matchScore } from './entities.js';
import { factsForRefusal, factsForToolResult } from './facts.js';
import { positionIn } from './standing.js';
import { refused } from './tool-result-prose.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

/** How close a name has to be before it is the thing they meant. `destroy`'s figure. */
const CLOSE_ENOUGH = 60;

/** One thing the player could put in the house's hands. */
export interface AThingToHandIn {
    name: string;
    kind: 'manual' | 'material' | 'pill';
    /** Where it came off a beast or out of the ground, for the category words. */
    from: 'a_beast' | 'a_growing_thing' | null;
    /** The world's row for it, where the world tracks this one. */
    tracked: ObjectRecord | null;
    /** The pouch stack it comes off, where it is counted there. */
    pouchItemId: string | null;
    /** The row as a want reads it. The tracked row itself, or one made for the stack. */
    row: ObjectRecord;
}

/** A row for one of a pouch stack, owned by whoever is holding it. */
function aRowForOneOf(
    world: WorldState,
    holder: { id: string; name: string },
    itemId: string,
    pouchKind: string,
    onDay: number
): { row: ObjectRecord; kind: AThingToHandIn['kind']; from: AThingToHandIn['from'] } | null {
    const base = {
        possessorId: holder.id,
        ownerId: holder.id,
        ownerName: holder.name,
        power: null,
        locationId: null
    };
    const id = `handed-in-${holder.id}-${itemId}-${onDay}-${world.objects.length}`;
    if (pouchKind === 'manual') {
        const art = getTechnique(itemId);
        if (!art) return null;
        return {
            kind: 'manual',
            from: null,
            row: makeObject({
                ...base, id, name: art.name, kind: 'manual',
                significance: howMuchAGradeIsWorthTracking(art.grade),
                tags: [`grade:${art.grade}`],
                data: { techniqueId: art.id }
            })
        };
    }
    if (pouchKind === 'pill') {
        const pill = getPill(itemId);
        if (!pill) return null;
        return {
            kind: 'pill',
            from: null,
            row: makeObject({
                ...base, id, name: pill.name, kind: 'pill',
                significance: howMuchAGradeIsWorthTracking(pill.grade),
                tags: ['pill', `grade:${pill.grade}`],
                data: { pillId: pill.id, grade: pill.grade, quantity: 1 }
            })
        };
    }
    if (pouchKind === 'herb') {
        const what = whatAnIngredientIs(itemId);
        if (!what) return null;
        return {
            kind: 'material',
            from: what.from,
            row: makeObject({
                ...base, id, name: what.name, kind: 'material',
                significance: howMuchAGradeIsWorthTracking(what.grade),
                tags: ['material', what.from === 'a_beast' ? 'beast_material' : 'herb', `grade:${what.grade}`],
                data: { materialId: what.id, grade: what.grade, value: what.value, quantity: 1 }
            })
        };
    }
    return null;
}

/**
 * Everything the player is holding that a house could make anything of: the
 * world's rows carried by them, then the pouch. A tracked material keeps a pouch
 * row beside it as its counted half, so a stack is offered only for what is
 * left of it once the tracked ones are taken out.
 */
export function whatTheyCouldHandIn(
    db: Database.Database,
    world: WorldState,
    holder: { id: string; name: string },
    onDay: number
): AThingToHandIn[] {
    const out: AThingToHandIn[] = [];
    const twins = new Map<string, number>();
    for (const object of world.objects) {
        if (object.possessorId !== holder.id || isRuined(object) || object.power !== null) continue;
        if (object.kind !== 'manual' && object.kind !== 'material' && object.kind !== 'pill') continue;
        const thing = whatThisThingIs(object);
        if (thing === null) continue;
        twins.set(thing.kindId, (twins.get(thing.kindId) ?? 0) + 1);
        const ingredient = object.kind === 'material' ? whatAnIngredientIs(thing.kindId) : null;
        out.push({
            name: object.name,
            kind: object.kind,
            from: ingredient?.from ?? null,
            tracked: object,
            pouchItemId: object.kind === 'material' ? thing.kindId : null,
            row: object
        });
    }
    const stacks = db
        .prepare('SELECT item_id, item_kind, quantity FROM cultivator_pouch WHERE holder_id = ? AND quantity > 0')
        .all(holder.id) as { item_id: string; item_kind: string; quantity: number }[];
    for (const stack of stacks) {
        if (stack.quantity - (twins.get(stack.item_id) ?? 0) <= 0) continue;
        const made = aRowForOneOf(world, holder, stack.item_id, stack.item_kind, onDay);
        if (!made) continue;
        out.push({ name: made.row.name, kind: made.kind, from: made.from, tracked: null, pouchItemId: stack.item_id, row: made.row });
    }
    return out;
}

/** The kind a word names when it names a kind rather than a thing. */
const CATEGORY_WORDS: ReadonlyArray<[RegExp, (t: AThingToHandIn) => boolean]> = [
    [/^(?:manual|book|scripture|scroll|volume|text|copy)s?$/, t => t.kind === 'manual'],
    [/^(?:pill|dose|elixir|pellet|medicine)s?$/, t => t.kind === 'pill'],
    [/^(?:herb|plant|root|grass|flower|leaf|leaves|fruit)s?$/, t => t.from === 'a_growing_thing'],
    [/^(?:core|material|hide|pelt|bone|horn|fang|claw|scale|feather|carcass|beast part)s?$/, t => t.from === 'a_beast'],
    [/^(?:thing|things|it|item|items|find|loot|that|this)$/, () => true]
];

export type WhichThingTheyMeant =
    | { found: AThingToHandIn }
    | { several: AThingToHandIn[] }
    | { none: true };

/**
 * The one they named. A name first, the way every other verb in this package
 * reads one; then every word they said inside one name ("the core" against
 * "Frost Wolf Core"); then a kind ("the manual" with one book on them).
 */
export function whichThingTheyMeant(held: readonly AThingToHandIn[], said: string): WhichThingTheyMeant {
    const asked = said.toLowerCase().replace(/^(?:the|a|an|this|that|my)\s+/, '').trim();
    const bare = (name: string) => name.toLowerCase().replace(/^(?:a|an|the)\s+/, '');
    let best: { thing: AThingToHandIn; score: number } | null = null;
    for (const thing of held) {
        const score = matchScore(asked, bare(thing.name));
        if (score >= CLOSE_ENOUGH && (best === null || score > best.score)) best = { thing, score };
    }
    if (best) return { found: best.thing };

    const words = asked.split(/\s+/).filter(w => w.length > 2);
    const containing = words.length === 0 ? [] : held.filter(t => words.every(w => bare(t.name).includes(w)));
    const byKind = CATEGORY_WORDS.find(([word]) => word.test(asked));
    const pool = containing.length > 0 ? containing : byKind ? held.filter(byKind[1]) : [];
    const distinct = [...new Map(pool.map(t => [t.name, t])).values()];
    if (distinct.length === 1) return { found: distinct[0]! };
    if (distinct.length > 1) return { several: distinct };
    return { none: true };
}

/** Why a house wants it or does not, as a fact about the house. */
export function whatTheHouseSaysOfIt(
    house: Pick<FactionRecord, 'name'>,
    thing: Pick<AThingToHandIn, 'name' | 'kind'>,
    made: WhatTheHouseMakesOfIt
): string {
    switch (made.why) {
        case 'nobody_sells_it':
            return thing.kind === 'manual'
                ? `No stall ${house.name} can pay sells it a copy of ${thing.name}, and nobody in its province would write one out for it.`
                : `Nobody sells ${house.name} ${thing.name}: it is not a thing a market restocks.`;
        case 'it_cannot_afford_one':
            return `${house.name} could buy ${thing.name} and its purse is short of what one costs.`;
        case 'it_buys_its_own':
            return thing.kind === 'manual'
                ? `A copy of ${thing.name} is for sale to ${house.name} at a price its purse covers, so it buys its own.`
                : `${thing.name} is on a market at a price ${house.name}'s purse covers, so it buys its own.`;
        case 'it_already_has_one':
            return `${house.name} already holds ${thing.kind === 'manual' ? 'that book' : `a ${thing.name}`}, and wants no second until the one it has is spent, lost or taken.`;
        case 'nothing_it_can_price':
            return `${house.name} has nothing to price ${thing.name} at: nothing is left in it that the house would pay for any other way.`;
        case 'no_such_house':
            return 'There is no house standing to take it.';
    }
}

export const handingInVerbs = {
    /**
     * Hand the named thing in to the player's own house.
     *
     * Free of the clock: the act is putting it in somebody's hands. What it
     * costs is the thing.
     */
    async handItInToTheHouse(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        target: string | undefined
    ): Promise<Execution> {
        const held = positionIn(this.repos, cultivator.id);
        if (!held) {
            // AND THE ROAD, NOT ONLY THE LACK. This said what was missing twice
            // and stopped, which leaves a player holding a thing they cannot
            // hand anywhere and no sentence to type next. The road is the one
            // the stuck-player read already names, in the words it names it
            // with, so the two answers cannot drift apart.
            return refused('engine.handItIn', 'sect', factsForRefusal(
                'You are on no house\'s roll.',
                'There is no house whose ledger has your name on it, so there is nobody to hand a thing in to '
                + 'and nothing for it to be counted against. Handing a thing in is what a member does with '
                + 'what they find; being one comes first. "what sects are there" names the houses, and '
                + '"what is posted here" reads the intakes nailed up on this ground, with the bar and the '
                + 'date on each.',
                'hand_in: no membership. Nothing moved, and the two roads to one were named.'
            ));
        }
        this.atHand = this.atHand ?? await this.loadWorld();
        const world = this.atHand;
        const house = world?.factions.find(f => f.id === held.sectId && f.dissolvedOnDay === null) ?? null;
        if (!world || !house) {
            return refused('engine.handItIn', 'sect', factsForRefusal(
                `${held.sectName} is not standing to take anything.`,
                `There is no ${held.sectName} in the world as it stands to keep a thing for, so nothing is handed in.`,
                `hand_in: world ${world ? 'loaded' : 'off'}, house ${held.sectId} ${house ? 'live' : 'absent or ended'}. Nothing moved.`
            ));
        }
        const today = Math.floor(world.currentDay);
        const said = (target ?? '').trim();
        const holding = whatTheyCouldHandIn(this.db, world, { id: cultivator.id, name: cultivator.name }, today);
        const onThem = [...new Set(holding.map(t => t.name))];

        // ── WHICH THING ──────────────────────────────────────────────────
        const which = said.length >= 2 ? whichThingTheyMeant(holding, said) : { none: true as const };
        if ('several' in which) {
            return refused('engine.handItIn', 'sect', factsForRefusal(
                `More than one thing of yours answers to ${said}.`,
                `You are holding ${which.several.map(t => t.name).join(', ')}, and "${said}" is any of them.`,
                `hand_in: "${said}" matched ${which.several.length} holdings. Nothing moved.`
            ));
        }
        if ('none' in which) {
            return refused('engine.handItIn', 'sect', factsForRefusal(
                said.length >= 2 ? `Nothing you are holding is called ${said}.` : 'Nothing named.',
                onThem.length > 0
                    ? `What you are holding that a house could take in: ${onThem.join(', ')}.`
                    : 'You are holding nothing a house takes in: no book, no dose, nothing off a beast or out of the ground.',
                `hand_in: "${said}" matched none of ${holding.length} holdings. Nothing moved.`
            ));
        }
        const thing = which.found;

        // ── SOMEBODY OF THE HOUSE TO TAKE IT ─────────────────────────────
        const here = this.worldPlaceOf(cultivator);
        const inItsWalls = house.seatLocationId !== null
            && theSeatOfTheCompound(world, here)?.id === house.seatLocationId;
        const ofTheHouseHere = this.present(cultivator)
            .map(p => world.npcs.find(n => n.id === p.id))
            .find(n => n !== undefined && n.status === 'alive' && n.factionId === house.id) ?? null;
        if (!inItsWalls && ofTheHouseHere === null) {
            const seatName = world.locations.find(l => l.id === house.seatLocationId)?.name ?? null;
            return refused('engine.handItIn', 'sect', factsForRefusal(
                `Nobody of ${house.name} is here to take it.`,
                `Nobody of ${house.name} is where you are standing to put ${thing.name} in the hands of`
                + (seatName ? `, and its stores are at ${seatName}.` : '.'),
                `hand_in: not inside ${house.seatLocationId ?? 'no seat'} and no member of ${house.id} present. Nothing moved.`
            ));
        }

        // ── WHAT THE HOUSE MAKES OF IT ───────────────────────────────────
        const made = whatTheHouseMakesOf(world, house.id, thing.row);
        const why = whatTheHouseSaysOfIt(house, thing, made);
        if (!made.wanted) {
            const facts = factsForToolResult(`${house.name} does not want ${thing.name}.`, [
                `${house.name} does not want ${thing.name}, and it stays with you. ${why}`
            ]);
            facts.required = [facts.lines[0]!];
            facts.structure.push(
                `whatTheHouseMakesOf(${house.id}, ${thing.row.id}): wanted=false why=${made.why}. `
                + 'Nothing moved, nothing credited.'
            );
            const execution = this.freeAction(run, 'sect', facts);
            execution.outcome = 'refused';
            execution.calls = [{
                name: 'world.whatTheHouseMakesOf',
                action: 'sect',
                summary: `${thing.name}: not wanted by ${house.name} (${made.why}).`,
                ok: false
            }];
            return execution;
        }

        // ── HANDED IN ────────────────────────────────────────────────────
        const known = thing.kind === 'manual'
            ? this.repos.techniques.getKnown(cultivator.id, String(thing.row.data.techniqueId ?? ''))
            : null;
        const standsAt: { contribution: number | null } = { contribution: null };
        this.db.transaction(() => {
            if (thing.pouchItemId !== null && !removeFromPouch(this.db, cultivator.id, thing.pouchItemId, 1)
                && thing.tracked === null) {
                throw new Error(`The pouch was short of ${thing.name} as it was handed in.`);
            }
            if (thing.tracked === null) world.objects.push(thing.row);
            theHouseTakesItIn(world, {
                giver: { id: cultivator.id, name: cultivator.name },
                houseId: house.id,
                objectId: thing.row.id,
                merit: made.merit,
                onDay: today
            });
            standsAt.contribution = this.repos.sects.addContribution(house.id, cultivator.id, made.merit)?.contribution ?? null;
            this.theWorldMoved();
        })();

        const lines = [
            `You hand ${thing.name} in to ${house.name}, and it is the house's now. ${why}`,
            `${house.name} writes ${made.merit} contribution against your name for it`
            + (standsAt.contribution !== null ? `, which stands at ${standsAt.contribution}.` : '.')
        ];
        if (known) {
            lines.push('What you have of it you keep. The book was the way in, and the house holds it now.');
        }
        const facts = factsForToolResult(`${thing.name}, handed in: ${made.merit} contribution.`, lines);
        facts.required = lines.slice(0, 2);
        facts.structure.push(
            `whatTheHouseMakesOf(${house.id}, ${thing.row.id}): wanted=true why=${made.why} merit=${made.merit}. `
            + `theHouseTakesItIn moved ${thing.tracked ? 'the tracked row' : `a row made for one of pouch ${thing.pouchItemId}`} `
            + `to ${house.id}; sect_members.contribution +${made.merit}.`
        );
        const execution = this.freeAction(run, 'sect', facts);
        execution.calls = [{
            name: 'world.theHouseTakesItIn',
            action: 'sect',
            summary: `${thing.name} handed in to ${house.name} for ${made.merit} contribution (${made.why}).`,
            ok: true
        }];
        return execution;
    }
};
