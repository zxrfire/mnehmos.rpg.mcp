/**
 * What a rung nobody earned costs, and how many people can even give one.
 *
 * Cash used to buy a rung outright: `donate` converted spirit stones into
 * contribution, and contribution is the whole of what a promotion is gated on.
 * That is struck. The road that replaced it runs through a PERSON - the one who
 * holds the room a rung is decided in - and the question this answers is
 * whether that road exists at the bottom of a ladder or only in theory.
 *
 * THREE THINGS, PER PINNED WORLD:
 *
 *   reach       how many people a starting disciple can name at all
 *   the door    whether anybody in that reach holds the room, and if so who
 *   the price   what `whatTheyWillTakeFor` says that person will take
 *
 * The third is the one that decides whether "bribe" is the right word. An ask
 * this heavy sits at `PURSE_REACH` 0.2, which is exactly where money stops
 * being the medium, so the honest answer is expected to be a favour or a
 * service rather than a sum - and a refusal that names that rung is the
 * feature, not a gap.
 *
 * Run:  npx tsx scripts/probe-what-a-rung-costs.ts
 */

import { makeGameInWorld } from '../tests/web/harness.js';
import { KnowledgeGate } from '../src/web/knowledge.js';
import { positionIn } from '../src/web/standing.js';
import { portfoliosIn } from '../src/engine/social-leverage/authority-for-an-order.js';
import { rosterFor } from '../src/web/encounters.js';
import {
    THE_ROOM_A_RUNG_IS_DECIDED_IN,
    whoCouldRaiseYou
} from '../src/engine/social-leverage/a-rung-nobody-earned.js';
import {
    whatTheyWillTakeFor,
    whereTheOfferLanded
} from '../src/engine/social-leverage/what-they-will-take-instead-of-money.js';
import { baseWeightOf } from '../src/web/what-a-request-asks-and-of-whom.js';
import { requiredContributionForRank } from '../src/engine/cultivation/what-each-rung-of-a-house-ladder-requires.js';

const SEEDS = ['rung-a', 'rung-b', 'rung-c', 'rung-d', 'rung-e', 'rung-f'];

interface Row {
    seed: string;
    house: string | null;
    rung: number | null;
    reach: number;
    holderInReach: boolean;
    holderName: string | null;
    theirCallAlone: boolean;
    wants: string | null;
    barForTheNextRung: number | null;
}

async function oneWorld(seed: string): Promise<Row> {
    const { db, game } = await makeGameInWorld({ seed, worldSeed: `${seed}-world` });
    const { cultivator } = await game.newRun('Probe');

    const known = new KnowledgeGate(db).awareness(cultivator.id, 'sect')
        .filter(row => row.sourceKind === 'told');
    if (known.length === 0) {
        return {
            seed, house: null, rung: null, reach: 0, holderInReach: false,
            holderName: null, theirCallAlone: false, wants: null, barForTheNextRung: null
        };
    }
    await game.act(`I join the ${known[0]!.name}`);

    const after = (game as unknown as { repos: Parameters<typeof positionIn>[0] }).repos;
    const held = positionIn(after, cultivator.id);
    if (!held) {
        return {
            seed, house: known[0]!.name, rung: null, reach: 0, holderInReach: false,
            holderName: null, theirCallAlone: false, wants: null, barForTheNextRung: null
        };
    }

    const svc = game as unknown as {
        repos: Parameters<typeof positionIn>[0];
        knowledge: unknown;
        loadWorld(): Promise<unknown>;
    };
    const world = await svc.loadWorld();
    const roster = rosterFor(
        { repos: svc.repos, knowledge: svc.knowledge, world } as never,
        // The cultivator as the run holds it.
        (svc.repos as unknown as { cultivators: { getById(id: string): never } })
            .cultivators.getById(cultivator.id)
    );
    const roll = [
        { id: cultivator.id, rankIndex: held.rankIndex },
        ...roster.map(p => ({ id: p.id, rankIndex: p.rankIndex ?? 0 }))
    ];
    const portfolios = portfoliosIn({
        locations: (world as { locations?: unknown[] })?.locations ?? [],
        sectId: held.sectId,
        roll,
        rankCount: held.rankCount
    });
    const call = whoCouldRaiseYou({
        portfolios, roll, rankCount: held.rankCount, asking: cultivator.id
    });
    const holder = call.holderId
        ? roster.find(p => p.id === call.holderId) ?? null
        : null;

    return {
        seed,
        house: held.sectName,
        rung: held.rankIndex,
        reach: roster.length,
        holderInReach: holder !== null,
        holderName: holder?.name ?? null,
        theirCallAlone: call.theirCallAlone,
        wants: call.holderId
            ? whatTheyWillTakeFor(call.holderId, {
                ask: baseWeightOf('advancement'),
                hasACashPrice: false,
                theyNeedSomethingDone: false
            })
            : null,
        barForTheNextRung: held.rankIndex + 1 < held.rankCount
            ? requiredContributionForRank(held.rankIndex + 1)
            : null
    };
}

async function main(): Promise<void> {
    console.log(`The room a rung is decided in: ${THE_ROOM_A_RUNG_IS_DECIDED_IN}`);
    console.log(`The weight of the ask: ${baseWeightOf('advancement')}`);
    console.log('');

    const rows: Row[] = [];
    for (const seed of SEEDS) {
        try {
            rows.push(await oneWorld(seed));
        } catch (error) {
            console.log(`${seed}: threw - ${(error as Error).message}`);
        }
    }

    console.log('seed      house                          rung  reach  door  holder            wants');
    for (const r of rows) {
        console.log(
            [
                r.seed.padEnd(9),
                (r.house ?? 'none').slice(0, 30).padEnd(30),
                String(r.rung ?? '-').padEnd(5),
                String(r.reach).padEnd(6),
                (r.holderInReach ? 'yes' : 'no').padEnd(5),
                (r.holderName ?? '-').slice(0, 17).padEnd(17),
                r.wants ?? '-'
            ].join(' ')
        );
    }

    const withADoor = rows.filter(r => r.holderInReach).length;
    console.log('');
    console.log(`${withADoor} of ${rows.length} starting disciples could name the person whose call`);
    console.log('a rung is. What each of them will take, read off the same ladder a refusal names:');
    for (const r of rows) {
        if (!r.wants) continue;
        console.log(`  ${r.seed}: ${whereTheOfferLanded(r.wants as never, 'stones').line}`);
    }
    process.exit(0);
}

void main();
