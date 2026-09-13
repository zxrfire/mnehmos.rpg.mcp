/**
 * The town at a house's gate: everybody who wants something from it and cannot
 * walk in.
 *
 * A compound with nothing outside it leaves a refused visitor standing nowhere.
 * Measured on three pinned worlds before this existed: 38 seated houses each,
 * and `I travel to <house>` reached 0 of them.
 *
 * DERIVED, NEVER AUTHORED. Same shape as `growCompound`: the house's own
 * columns decide how big the town is and what trades in it. A house that
 * recruits has applicants and the people it refused; a house that makes things
 * sells its seconds; a house whose arrays have gone dark is being quietly
 * stripped by the people at its foot. There is no `if (factionId === ...)` here
 * and there must never be one.
 *
 * ── IT IS A READING OF THE SEAT AND NOT A SECOND PLACE, AND THAT WAS MEASURED
 *
 * The first cut seeded one `settlement` row per house, linked to the province on
 * one side and to the gate on the other. It worked, and it halved the world.
 *
 * A world opens with `population: 400` spread over 22 settlements - about
 * eighteen people each - and 38 more places took that to seven. Over eighty
 * years of ordinary births and deaths the tail then dies out, and an empty
 * settlement produces person-free events forever, which is the condition
 * `demography.test.ts` exists to hold. Both arms in one command, one seed, only
 * the towns removed between them:
 *
 *     without the town rows   22 settlements, 0 empty after 80 years
 *     with them               60 settlements, 8 empty
 *
 * Reweighting moved the number and never reached zero: at a village's weight 8
 * were empty, at a market town's 3 were, and two of those were catalog places
 * that had been fine before. **The map got denser and the population did not.**
 * Holding the density would need about 1,090 people, which is 2.7x the world
 * simulation's cost and is not a change to make in passing.
 *
 * So the seat carries it. `seedSectGround` already describes its own row as
 * *gate, forecourt, halls*, the outer precinct of a recruiting house is already
 * open ground with an entry threshold of zero, and what was missing was never a
 * square - it was the market, the standing crowd, and the door saying no. Those
 * are computed on arrival from the house's catalog row, so nothing is stored,
 * nothing drifts, and the world's demography is untouched.
 *
 * **What this does NOT give**, written down as the gap it is: the town is not
 * somewhere with its own road, its own residents in `npcs`, or its own
 * encounters. A player cannot walk down from the gate to the market and back.
 * Closing that needs a world population scaled to the map it is spread over,
 * and that is a decision for whoever owns the simulation's cost.
 *
 * PURE. A catalog row in, a reading out.
 */

import { getSect, type SectEntry } from '../../data/cultivation/sects.js';
import { getProductionTier } from '../../data/cultivation/faction-character.js';

/**
 * The house's own columns, reduced to what the town reads.
 *
 * A narrow input rather than `CompoundInput`, because the town is read at play
 * time from the catalog and the compound is grown once at seeding time from the
 * world's own faction rows. Both shapes satisfy this one.
 */
export interface WhatTheTownIsBelow {
    factionId: string;
    factionName: string;
    alignment: 'righteous' | 'neutral' | 'demonic';
    ranks: readonly string[];
    admissionOrdinal: number;
    powerOrdinal: number;
    recruits: boolean;
    /**
     * 0..1. What it can still reliably produce against what it peaked at, which
     * is `inheritanceGap` read as a fraction. A working house makes a surplus
     * and a house living on what it inherited has little to put on a table.
     */
    stillWorking: number;
    /** 0..1, how much of its own compound still runs. */
    formationIntegrity: number;
    specialities: readonly string[];
}

/** The town's reading of a house, off the catalog. Null for a house nobody has. */
export function whatTheTownIsBelow(factionId: string): WhatTheTownIsBelow | null {
    const house = getSect(factionId);
    return house ? theTownReadingOf(house) : null;
}

/**
 * How much of its own peak a house can still reach, 0..1.
 *
 * `inheritanceGap` is the documented read and this is that gap as a share, so
 * there is no second opinion about what a house can make. A house with no
 * production record has said nothing, and half is the honest reading of
 * nothing.
 */
function stillWorkingShareOf(factionId: string, powerOrdinal: number): number {
    const tier = getProductionTier(factionId);
    if (!tier || powerOrdinal <= 0) return 0.5;
    return Math.max(0, Math.min(1, tier.reliableOrdinal / powerOrdinal));
}

function theTownReadingOf(house: SectEntry): WhatTheTownIsBelow {
    const nodes = house.compound.formationNodesTotal;
    return {
        factionId: house.id,
        factionName: house.name,
        alignment: house.alignment,
        ranks: house.ranks,
        admissionOrdinal: house.admissionOrdinal,
        powerOrdinal: house.powerOrdinal,
        recruits: house.recruits,
        stillWorking: stillWorkingShareOf(house.id, house.powerOrdinal),
        formationIntegrity: nodes > 0 ? house.compound.formationNodesLit / nodes : 0,
        specialities: house.specialities
    };
}

// HOW BIG IT IS

/**
 * How many people live at the gate.
 *
 * Four reasons to be there and each one is a column. The household the compound
 * cannot feed itself is the floor; the rest is what the house draws in.
 */
export function howManyLiveBelow(input: WhatTheTownIsBelow): number {
    const household = Math.max(20, Math.round(input.powerOrdinal * 6));
    // People come to be taken, and most of them are not, and a share of those
    // stay. A house that takes nobody draws none of this.
    const hopefuls = input.recruits ? Math.round(input.powerOrdinal * 9) : 0;
    // What it makes, it sells, and somebody stands outside selling it.
    const trade = Math.round(input.stillWorking * 500);
    // A house whose arrays are dark is a house being stripped, and stripping is
    // work. The gap is the draw, not the integrity.
    const scavenging = Math.round((1 - input.formationIntegrity) * 90);
    return household + hopefuls + trade + scavenging;
}

/** Village, town, city. A gate town is rarely the third. */
export type TownSize = 'village' | 'town' | 'city';

const A_TOWN_RATHER_THAN_A_VILLAGE = 300;
const A_CITY_RATHER_THAN_A_TOWN = 1_100;

export function howBigTheTownBelowIs(input: WhatTheTownIsBelow): TownSize {
    const heads = howManyLiveBelow(input);
    if (heads >= A_CITY_RATHER_THAN_A_TOWN) return 'city';
    return heads >= A_TOWN_RATHER_THAN_A_VILLAGE ? 'town' : 'village';
}

// WHAT TRADES THERE

/** One trade standing at the gate, and why it is standing there. */
export interface ATradeAtTheGate {
    id: string;
    name: string;
    /** Factual. What is on the table. Never a narrator's sentence. */
    what: string;
}

/**
 * What is being sold and done outside the wall.
 *
 * Every row reads a column. The first three are true of any seated house: the
 * compound does not farm, the people it will not admit have to sleep somewhere,
 * and a house that wants anything says so on a wall.
 */
export function whatTradesBelow(input: WhatTheTownIsBelow): ATradeAtTheGate[] {
    const out: ATradeAtTheGate[] = [
        {
            id: 'grain',
            name: 'the grain and salt market',
            what: 'What the compound eats and does not grow, carted up daily.'
        },
        {
            id: 'inn',
            name: 'the inn',
            what: 'Where a cultivator from elsewhere sleeps, not being able to sleep inside.'
        },
        {
            id: 'notice-wall',
            name: 'the notice wall',
            what: 'What the house wants done, posted where somebody not of it can read it.'
        }
    ];

    if (input.recruits) {
        out.push({
            id: 'petition-scribe',
            name: 'the petition scribes',
            what: 'Men who write an application in the wording the gate accepts, for a fee.'
        });
        out.push({
            id: 'root-reader',
            name: 'the root readers',
            what: 'A copper to be told what your root is before the house tells you for nothing.'
        });
    }

    if (input.stillWorking >= 0.4) {
        out.push({
            id: 'seconds',
            name: 'the seconds stalls',
            what: `What the ${input.factionName} made and would not put its own mark on.`
        });
    }

    const specialities = new Set(input.specialities.map(word => word.toLowerCase()));
    if (specialities.has('alchemy') || specialities.has('support') || specialities.has('cultivation')) {
        out.push({
            id: 'pill-stalls',
            name: 'the pill stalls',
            what: 'Low-grade medicine, some of it made here and some of it carried out.'
        });
    }
    if (specialities.has('sword') || specialities.has('offense') || specialities.has('defense')) {
        out.push({
            id: 'smiths',
            name: 'the repair smiths',
            what: 'Edges reground and armour restrapped for people who train all day.'
        });
    }

    if (input.powerOrdinal >= 25) {
        out.push({
            id: 'second-hand-manuals',
            name: 'the second-hand manual tables',
            what: 'What people who came a long way sell when they are told to go home.'
        });
    }

    if (input.formationIntegrity < 0.5) {
        out.push({
            id: 'salvage',
            name: 'the salvage yard',
            what: 'Array stone off the dead nodes, sold by people nobody has stopped.'
        });
    }

    if (input.alignment === 'demonic') {
        out.push({
            id: 'no-questions',
            name: 'the back tables',
            what: 'Goods bought without a question about where they came from.'
        });
    }

    return out;
}

/**
 * Who is permanently standing here and is on nobody's roll.
 *
 * The other half of what makes this a place rather than a market. Same rule:
 * every line is a column, and a house that does not have the column does not
 * get the line.
 */
export function whoWaitsBelow(input: WhatTheTownIsBelow): string[] {
    const out: string[] = [];
    if (input.recruits) {
        out.push('People who were refused at the gate and have not gone home.');
        out.push(`Rogue cultivators waiting on work the ${input.factionName} posts and will not `
            + 'give to one of its own.');
    } else {
        out.push(`People who came to ask the ${input.factionName} for something and were never `
            + 'told which day to come back.');
    }
    // An outer rung is a rung whose people are allowed out, and their families
    // live where they can be visited.
    if (input.ranks.length >= 2) {
        out.push('Families of the outer disciples, who are let out and not let in.');
    }
    out.push('Servants the house retired, who know the inside and are no longer in it.');
    if (input.stillWorking >= 0.4 || input.powerOrdinal >= 25) {
        out.push('Merchants who followed the money and stayed.');
    }
    return out;
}
