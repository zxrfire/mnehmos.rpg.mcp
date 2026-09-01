/**
 * Upkeep - what a practitioner can actually be supplied with, and therefore
 * how far into an art they can get.
 *
 * THIS EXISTS TO MAKE AN NPC RIGHT.
 * ---------------------------------
 * `AncientArt.worldSupplyCeiling` in `data/cultivation/lost-ages.ts` records
 * where the world's remaining supply of a consumed material stops, on the
 * engine's own `mastery` scale of [0, 1]. Until now nothing read it, and the
 * module said so in place: an elder saying "you will not cultivate this past
 * the fifth level, there is not enough of it left on the ground anywhere" was
 * stating a fact the catalog believed and the engine did not produce. A world
 * whose experts are demonstrably wrong is a world whose experts a player learns
 * to stop listening to, which is a worse loss than any single mechanic.
 *
 * THE SHAPE MATTERS MORE THAN THE NUMBER.
 * ---------------------------------------
 * This is an UPKEEP NOBODY CAN MEET, never a rule saying you may not. There is
 * no branch here on who somebody is, what house they belong to, or whether they
 * are entitled. The art works. The practitioner is not refused anything. They
 * simply run out of the thing the practice consumes, at the point the world ran
 * out of it, and stand there holding a book they can read and cannot go further
 * into. Take the material away and nothing else about them changes; supply them
 * and they keep going. That is the whole mechanism.
 *
 * WHICH IS ALSO WHY THE COUNTERPART SURVIVES.
 * -------------------------------------------
 * "You must be somebody" is a design claim this file has to keep true from the
 * other direction. Somebody who IS provisioned - a dead man's stocked cellar, a
 * house spending on them, a remnant nobody knows exists - goes further than the
 * world's ceiling, and goes exactly as far as their supply goes. There are two
 * such provisionings in the world and both are authored in `lost-ages.ts`. This
 * module reads them; it does not add any.
 *
 * WHAT IT DOES NOT DO.
 * --------------------
 * Nothing here decides whether an art is learnable, legal, wise, or worth the
 * years. It answers one question - how far does the supply carry - and the
 * answer is a number between zero and one or `null` for "the world's supply is
 * not what limits this one".
 */

import {
    ANCIENT_ARTS,
    ARCHIVE_COPIES,
    STOCKED_INHERITANCES,
    type AncientArt
} from '../../data/cultivation/lost-ages.js';

/**
 * Who is feeding this practitioner.
 *
 * `world` is the default and the overwhelming case: nobody is, so they buy what
 * anybody can buy, which is what is left on the ground. The other two are the
 * authored exceptions, addressed by the object they came out of rather than by
 * a flag on the cultivator - because that is what they are. A stocked cellar is
 * a place. A remnant is a house's cupboard.
 */
export type Provisioning =
    | { kind: 'world' }
    | { kind: 'stocked_inheritance'; siteId: string }
    | { kind: 'house_remnant'; factionId: string };

/** Nobody is spending anything on you. The ordinary condition. */
export const UNPROVISIONED: Provisioning = { kind: 'world' };

export interface MasteryCeiling {
    techniqueId: string;
    /**
     * Highest `mastery` the supply carries this practitioner to, or `null`
     * where nothing about supply limits them - either the art consumes nothing
     * or they are drawing on a stock whose size nobody has ever declared.
     */
    ceiling: number | null;
    /** The material that runs out, or null where none does. */
    upkeepHerbId: string | null;
    /** Which provisioning produced the figure, for narration and for tests. */
    source: Provisioning['kind'] | 'no_upkeep';
    /**
     * One line a narrator can use, stated as a fact about supply rather than
     * as a refusal. Never phrased as permission.
     */
    note: string;
}

const ANCIENT_BY_TECHNIQUE: ReadonlyMap<string, AncientArt> =
    new Map(ANCIENT_ARTS.map(a => [a.techniqueId, a]));

/** True where practising this art consumes something the world is short of. */
export function hasUpkeep(techniqueId: string): boolean {
    return (ANCIENT_BY_TECHNIQUE.get(techniqueId)?.upkeepHerbId ?? null) !== null;
}

/**
 * How far the supply carries somebody into this art.
 *
 * Ordered so the exceptions can only ever RAISE the figure. A provisioning that
 * turns out not to apply - the wrong site, a house with no remnant - falls
 * through to the world's supply rather than to nothing, so a caller passing a
 * hopeful argument cannot accidentally lift the ceiling.
 */
export function masteryCeilingFor(
    techniqueId: string,
    provisioning: Provisioning = UNPROVISIONED
): MasteryCeiling {
    const ancient = ANCIENT_BY_TECHNIQUE.get(techniqueId);
    const upkeepHerbId = ancient?.upkeepHerbId ?? null;

    if (!ancient || upkeepHerbId === null || ancient.worldSupplyCeiling === null) {
        return {
            techniqueId,
            ceiling: null,
            upkeepHerbId: null,
            source: 'no_upkeep',
            note: 'Nothing about this art runs out. It goes as far as the practitioner does.'
        };
    }

    const world: MasteryCeiling = {
        techniqueId,
        ceiling: ancient.worldSupplyCeiling,
        upkeepHerbId,
        source: 'world',
        note:
            'The practice consumes something the world has very little of left. ' +
            'Past this depth there is nothing to buy at any price, from anybody, ' +
            'and the art still works - there is simply nothing to feed it with.'
    };

    if (provisioning.kind === 'stocked_inheritance') {
        const stock = STOCKED_INHERITANCES.find(
            s => s.siteId === provisioning.siteId && s.techniqueId === techniqueId
        );
        // A stock smaller than the open supply is not a ceiling, it is a
        // contribution, so the figure never falls below what anybody could buy.
        if (stock && stock.carriesToMastery > world.ceiling!) {
            return {
                techniqueId,
                ceiling: stock.carriesToMastery,
                upkeepHerbId,
                source: 'stocked_inheritance',
                note:
                    'Somebody paid for this in advance and decided how far it should go. ' +
                    'Nothing fails at the end of it: the jars are empty, the art still works, ' +
                    'and the practitioner is standing where a dead person decided they should stop.'
            };
        }
        return world;
    }

    if (provisioning.kind === 'house_remnant') {
        const held = ARCHIVE_COPIES.find(
            c =>
                c.factionId === provisioning.factionId &&
                c.techniqueId === techniqueId &&
                c.stock === 'remnant'
        );
        if (held) {
            // Null rather than a number, deliberately. The one house quietly
            // holding the last of a material has never said how much it has,
            // and inventing a figure here would be this engine asserting
            // something the world does not know. What is true is that the open
            // supply is not what binds them. How far it actually goes is the
            // holder's to declare, and nobody has asked.
            return {
                techniqueId,
                ceiling: null,
                upkeepHerbId,
                source: 'house_remnant',
                note:
                    'Somebody is quietly feeding this out of a stock nobody has ever counted. ' +
                    'The world\'s shortage does not bind here, and how far it goes is a question ' +
                    'only the holder can answer.'
            };
        }
        return world;
    }

    return world;
}

/**
 * The practical form: the highest mastery a practise session may reach.
 *
 * Returns 1 where nothing limits the art, so callers can use it as a
 * saturation point without a null check, which is what
 * `Math.min(ceiling - mastery, gain)` wants.
 */
export function practiceCeilingFor(
    techniqueId: string,
    provisioning: Provisioning = UNPROVISIONED
): number {
    return masteryCeilingFor(techniqueId, provisioning).ceiling ?? 1;
}

/**
 * True when a practitioner is at the end of their supply rather than at the end
 * of the art.
 *
 * Worth distinguishing at the point of narration: "there is nothing further to
 * understand" and "there is nothing left to feed it with" are different
 * sentences about the same stalled number, and only one of them is a problem
 * somebody can do something about.
 */
export function isSupplyStalled(
    techniqueId: string,
    mastery: number,
    provisioning: Provisioning = UNPROVISIONED
): boolean {
    const { ceiling } = masteryCeilingFor(techniqueId, provisioning);
    return ceiling !== null && ceiling < 1 && mastery >= ceiling;
}

/**
 * Every art the supply actually stops somebody in, with the figure.
 *
 * For reference tooling and for the register, so the world's own claim about
 * itself can be read off the same function that enforces it rather than off a
 * second table that will drift from it.
 */
export function supplyLimitedArts(
    provisioning: Provisioning = UNPROVISIONED
): MasteryCeiling[] {
    return ANCIENT_ARTS
        .filter(a => a.upkeepHerbId !== null)
        .map(a => masteryCeilingFor(a.techniqueId, provisioning))
        .filter(c => c.ceiling === null || c.ceiling < 1);
}
