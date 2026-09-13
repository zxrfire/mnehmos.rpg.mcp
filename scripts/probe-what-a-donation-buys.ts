/**
 * What a hundred spirit stones buy against the rung they are being spent on.
 *
 * `donate` prices contribution off the board's own exchange rate, which is the
 * right rule and was reading the wrong span: the MEDIAN of whatever happened to
 * be posted to the reader. Two new `regional` sending reasons moved that median
 * from 60 days to 90 and repriced every donation in the game.
 *
 * BOTH ARMS IN ONE RUN, over one seeded world per seed:
 *
 *   median   the span `donate` used to read off the board
 *   errand   the span of an ordinary errand, `ORDINARY_DUTY_DAYS`
 *
 * The comparison that matters is against a PROMOTION, because that is what
 * contribution is for: `requiredContributionForRank` is the bar, and a hundred
 * stones buying more than the bar is somebody buying a rung by accident.
 *
 * The board is rebuilt the way `sectBoardFor` builds it - the catalogue pool
 * plus the house's own postings, minus what reaches by word of mouth and what
 * this reader could not take off a wall - so the spans read here are the spans
 * `donate` read.
 *
 *   node --loader ts-node/esm scripts/probe-what-a-donation-buys.ts
 *   PROBE_SEEDS=a,b,c node --loader ts-node/esm scripts/probe-what-a-donation-buys.ts
 */

import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { isBelowTheLid } from '../src/engine/world/layers.js';
import { circleCandidatesFor } from '../src/engine/world/gatherings.js';
import {
    aFindThisHouseCouldSendFor,
    forbiddenGroundInTheProvinceOf,
    whatStandingOnItGives,
    whatAHousesOwnErrandsBringBack,
    whereTheOpenGroundIs,
    type WhereTheOpenGroundIs,
    type HouseAsItStands
} from '../src/engine/world/who-goes-out-for-a-house-and-what-comes-back.js';
import {
    commissionBoard,
    contributionPerStoneOverDays,
    dutyTermsFor,
    takeableOffAWall,
    ORDINARY_DUTY_DAYS
} from '../src/engine/encounters/duties.js';
import { whatAHouseHasOnItsBoard } from '../src/engine/encounters/what-a-house-has-on-its-board.js';
import { howAnAskReaches } from '../src/engine/encounters/how-an-ask-reaches-somebody.js';
import { requiredContributionForRank } from '../src/engine/cultivation/what-each-rung-of-a-house-ladder-requires.js';
import { MAX_ORDINAL } from '../src/engine/cultivation/realms.js';
import { stipendForRank } from '../src/data/cultivation/sects.js';
import type { Membership } from '../src/engine/encounters/types.js';
import type { WorldState, FactionRecord } from '../src/engine/world/world-state.js';
import type { KnowingStage } from '../src/engine/social/discovery.js';

/** The same fraction `donate` applies. */
const DONATION_DISCOUNT = 1 / 3;
/** The sum the finding was reported in. */
const PURSE = 100;

function line(s = ''): void {
    process.stdout.write(s + '\n');
}

/**
 * Two of the three readings of what a house knows of the ground near it. The
 * third is what the province is saying, which needs a teller's standing per NPC
 * and is the expensive half; leaving it out can only UNDERSTATE `hasAFind`, and
 * a find is a `regional` posting, so the median-span arm read here is a floor on
 * how far the old anchor moved rather than a ceiling.
 */
function houseAsItStands(
    state: WorldState,
    faction: FactionRecord,
    openGround: WhereTheOpenGroundIs,
    standingOnIt: (holderId: string, locationId: string) => KnowingStage,
    cameBack: (factionId: string, locationId: string) => KnowingStage
): HouseAsItStands {
    return {
        id: faction.id,
        name: faction.name,
        holdsGround: faction.controlledLocationIds.length > 0,
        standing: faction.standing,
        hasAFind: aFindThisHouseCouldSendFor({
            ground: openGround,
            houseId: faction.id,
            seatLocationId: faction.seatLocationId,
            roll: state.npcs
                .filter(npc => npc.factionId === faction.id && npc.status === 'alive')
                .map(npc => ({ id: npc.id, rankIndex: npc.factionRankIndex })),
            rankCount: faction.ranks.length,
            stageFor: standingOnIt,
            errands: cameBack
        }) !== null,
        sitsDownWith: circleCandidatesFor(state, faction).map(f => f.id),
        standsNearForbiddenGround:
            forbiddenGroundInTheProvinceOf(state.locations, faction.seatLocationId)
    };
}

/** The spans on the board a member of this house standing here would read. */
function spansOnTheBoard(input: {
    house: HouseAsItStands;
    ordinal: number;
    membership: Membership;
    reach: number;
    reachOfTheRest: number;
}): number[] {
    const spans = commissionBoard(input.ordinal, input.membership).map(o => o.terms.days);
    for (const entry of whatAHouseHasOnItsBoard({
        house: input.house,
        ordinal: input.ordinal,
        reachOfTheHouse: input.reach,
        reachOfTheRest: input.reachOfTheRest
    })) {
        const terms = dutyTermsFor(entry, input.ordinal, input.membership, 'commission');
        const reaches = howAnAskReaches({
            pitchOrdinal: terms.pitchOrdinal,
            reachOfTheHouse: input.reach
        });
        if (reaches === 'word_of_mouth') continue;
        if (!takeableOffAWall(terms.regard.band)) continue;
        spans.push(terms.days);
    }
    return spans.sort((a, b) => a - b);
}

interface Reading {
    house: string;
    band: 'bottom' | 'middle' | 'top';
    ordinal: number;
    rankIndex: number;
    offers: number;
    median: number;
    boughtOld: number;
    boughtNew: number;
    promotion: number;
    stipend: number;
    /** What one ordinary errand at this rung pays, per day it takes. */
    errandStonesPerDay: number;
}

const BANDS = ['bottom', 'middle', 'top'] as const;

/**
 * What one ordinary errand pitched at somebody's own rung pays them, per day.
 *
 * Priced by `dutyTermsFor` off a row carrying no scale tag, so the span is the
 * ordinary one and the regard is level: the engine's own arithmetic rather than
 * the formula retyped here.
 */
function errandPayPerDay(ordinal: number, membership: Membership): number {
    const terms = dutyTermsFor(
        {
            id: 'probe-ordinary-errand',
            name: 'An errand',
            kind: 'opportunity',
            simEventKind: 'opportunity',
            weight: 1,
            minOrdinal: 0,
            maxOrdinal: MAX_ORDINAL,
            interrupts: false,
            threatOrdinal: ordinal,
            summaryTemplate: 'An errand',
            tokens: [],
            tags: []
        },
        ordinal,
        membership,
        'commission'
    );
    return terms.stones / terms.days;
}

function readOneWorld(state: WorldState): Reading[] {
    const standingOnIt = whatStandingOnItGives(state.history.facts);
    const cameBack = whatAHousesOwnErrandsBringBack(state.history.facts);
    const openGround = whereTheOpenGroundIs(state.locations);
    const roll = new Map<string, { id: string; rankIndex: number; realmOrdinal: number }[]>();
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || npc.factionId === null || !isBelowTheLid(npc)) continue;
        const row = {
            id: npc.id,
            rankIndex: Math.max(0, npc.factionRankIndex),
            realmOrdinal: npc.cultivation.realmOrdinal
        };
        const bucket = roll.get(npc.factionId);
        if (bucket) bucket.push(row); else roll.set(npc.factionId, [row]);
    }

    const out: Reading[] = [];
    for (const faction of state.factions) {
        if (faction.dissolvedOnDay !== null || !isBelowTheLid(faction)) continue;
        const roster = (roll.get(faction.id) ?? [])
            .slice()
            .sort((a, b) => a.realmOrdinal - b.realmOrdinal || (a.id < b.id ? -1 : 1));
        if (roster.length < 3) continue;
        const house = houseAsItStands(state, faction, openGround, standingOnIt, cameBack);

        // Three readers per house: the lowest on the roll, the middle of it and
        // the highest. Early, middle and late are three different games and a
        // pooled figure hides exactly the defects height causes.
        const picks = [
            roster[0]!,
            roster[Math.floor(roster.length / 2)]!,
            roster[roster.length - 1]!
        ];
        picks.forEach((reader, at) => {
            const rest = roster.filter(p => p.id !== reader.id);
            const reachOfTheRest = rest.reduce((n, p) => Math.max(n, p.realmOrdinal), 0);
            const reach = Math.max(reachOfTheRest, reader.realmOrdinal);
            const membership: Membership = {
                factionId: faction.id,
                factionName: faction.name,
                rankIndex: reader.rankIndex,
                rankCount: Math.max(2, faction.ranks.length),
                contribution: 0
            };
            const spans = spansOnTheBoard({
                house,
                ordinal: reader.realmOrdinal,
                membership,
                reach,
                reachOfTheRest
            });
            const median = spans.length > 0
                ? spans[Math.floor(spans.length / 2)]!
                : ORDINARY_DUTY_DAYS;
            out.push({
                house: faction.name,
                band: BANDS[at]!,
                ordinal: reader.realmOrdinal,
                rankIndex: reader.rankIndex,
                offers: spans.length,
                median,
                boughtOld: PURSE * contributionPerStoneOverDays(median) * DONATION_DISCOUNT,
                boughtNew: PURSE * contributionPerStoneOverDays(ORDINARY_DUTY_DAYS)
                    * DONATION_DISCOUNT,
                promotion: requiredContributionForRank(reader.rankIndex + 1),
                stipend: stipendForRank(faction.id, reader.rankIndex),
                errandStonesPerDay: errandPayPerDay(reader.realmOrdinal, membership)
            });
        });
    }
    return out;
}

function quantiles(values: readonly number[]): { lo: number; mid: number; hi: number } {
    const sorted = [...values].sort((a, b) => a - b);
    const at = (q: number): number => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
    return { lo: at(0), mid: at(0.5), hi: at(0.999) };
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    const seeds = process.env.PROBE_SEEDS?.split(',')
        ?? Array.from({ length: 6 }, (_, i) => `donation-${i}`);

    const rows: Reading[] = [];
    for (const seed of seeds) {
        const { state } = seedWorld({ seed, catalog, population: 250 });
        rows.push(...readOneWorld(state));
    }

    line();
    line(`WHAT ${PURSE} SPIRIT STONES BUY   ${seeds.length} pinned worlds, ${rows.length} readers`);
    line();
    line('band     readers  offers  median span      bought: median anchor    errand anchor'
        + '   promotion');
    for (const band of BANDS) {
        const here = rows.filter(r => r.band === band);
        if (here.length === 0) continue;
        const spans = quantiles(here.map(r => r.median));
        const old = quantiles(here.map(r => r.boughtOld));
        const now = quantiles(here.map(r => r.boughtNew));
        const rung = quantiles(here.map(r => r.promotion));
        line(
            band.padEnd(9)
            + String(here.length).padStart(7)
            + String(Math.round(quantiles(here.map(r => r.offers)).mid)).padStart(8)
            + `${spans.lo}-${spans.hi} (${spans.mid})`.padStart(16)
            + `${old.lo.toFixed(0)}-${old.hi.toFixed(0)} (${old.mid.toFixed(0)})`.padStart(24)
            + `${now.mid.toFixed(0)}`.padStart(16)
            + `${rung.lo}-${rung.hi}`.padStart(12)
        );
    }

    line();
    line('AGAINST THE RUNG BEING CLIMBED - bought / what the promotion costs');
    line('band     median anchor          errand anchor       over 1.0 (a rung bought outright)');
    for (const band of BANDS) {
        const here = rows.filter(r => r.band === band);
        if (here.length === 0) continue;
        const oldRatio = quantiles(here.map(r => r.boughtOld / r.promotion));
        const newRatio = quantiles(here.map(r => r.boughtNew / r.promotion));
        const overOld = here.filter(r => r.boughtOld >= r.promotion).length;
        const overNew = here.filter(r => r.boughtNew >= r.promotion).length;
        line(
            band.padEnd(9)
            + `${oldRatio.lo.toFixed(2)}-${oldRatio.hi.toFixed(2)} (${oldRatio.mid.toFixed(2)})`.padEnd(23)
            + `${newRatio.lo.toFixed(2)}-${newRatio.hi.toFixed(2)} (${newRatio.mid.toFixed(2)})`.padEnd(20)
            + `${overOld} -> ${overNew}`
        );
    }

    line();
    line('HOW FAR THE MEDIAN ANCHOR MOVED BETWEEN HOUSES AT ONE RUNG');
    const bottom = rows.filter(r => r.band === 'bottom');
    const distinct = new Map<number, number>();
    for (const row of bottom) distinct.set(row.median, (distinct.get(row.median) ?? 0) + 1);
    line([...distinct.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([span, n]) => `${span}d x${n}`)
        .join('   '));

    line();
    line('AND THE STIPEND, WHICH IS A RETAINER AND NOT A WAGE');
    line('  the other candidate anchor: what the house pays per day. Read against what one');
    line('  ordinary errand pays per day at the same rung, which is the money contribution is');
    line('  already priced in.');
    for (const band of BANDS) {
        const here = rows.filter(r => r.band === band);
        if (here.length === 0) continue;
        const month = quantiles(here.map(r => r.stipend));
        const share = quantiles(here.map(r => (r.stipend / 30) / r.errandStonesPerDay));
        line(
            `  ${band.padEnd(8)}stipend ${`${month.lo}-${month.hi} (${month.mid})`.padEnd(16)}`
            + `a month, which is ${share.lo.toFixed(2)}-${share.hi.toFixed(2)} `
            + `(${share.mid.toFixed(2)}) of errand pay a day`
        );
    }

    line();
    line('A SPREAD OF HOUSES AND RUNGS, one row per house at each band');
    line('house                              band    rung  offers  median  bought  ->  bought'
        + '   promotion');
    const seen = new Set<string>();
    for (const row of rows) {
        const key = `${row.house}:${row.band}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (seen.size > 24) break;
        line(
            row.house.slice(0, 34).padEnd(35)
            + row.band.padEnd(8)
            + String(row.ordinal).padStart(4)
            + String(row.offers).padStart(8)
            + String(row.median).padStart(8)
            + row.boughtOld.toFixed(0).padStart(8)
            + row.boughtNew.toFixed(0).padStart(12)
            + String(row.promotion).padStart(12)
        );
    }
    line();
}

main().catch(err => {
    process.stderr.write(String(err?.stack ?? err) + '\n');
    process.exit(1);
});
