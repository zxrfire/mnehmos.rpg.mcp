/**
 * Upkeep - what a practitioner can actually be supplied with, and therefore how far
 * into an art they can get.
 */

import {
    ANCIENT_ARTS,
    ARCHIVE_COPIES,
    STOCKED_INHERITANCES,
    type AncientArt
} from '../../data/cultivation/lost-ages.js';

/**
 * Who is feeding this practitioner.
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
 */
export function practiceCeilingFor(
    techniqueId: string,
    provisioning: Provisioning = UNPROVISIONED
): number {
    return masteryCeilingFor(techniqueId, provisioning).ceiling ?? 1;
}

/**
 * True when a practitioner is at the end of their supply rather than at the end of
 * the art.
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
 */
export function supplyLimitedArts(
    provisioning: Provisioning = UNPROVISIONED
): MasteryCeiling[] {
    return ANCIENT_ARTS
        .filter(a => a.upkeepHerbId !== null)
        .map(a => masteryCeilingFor(a.techniqueId, provisioning))
        .filter(c => c.ceiling === null || c.ceiling < 1);
}
