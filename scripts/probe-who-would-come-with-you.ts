/**
 * HOW MANY PEOPLE IN A STARTING PLAYER'S REACH WOULD ACTUALLY COME.
 *
 * `company` was added as a `RequestKind` so a player can ask somebody to travel
 * with them, and its whole design is one choice - the weight is `a_real_favour`
 * rather than `against_their_interest`, which is what lets a purse reach it and
 * what puts an open-handed person's disposition at full strength. Nothing
 * anywhere decides who would say yes; the resolver was already computing every
 * term of it. This is the instrument that says what that comes to.
 *
 * It resolves NOTHING. `oddsOf` is the read half of the same function
 * `resolveAttempt` calls, so this prices the ask over and over without spending
 * a day or rolling a die, which is the only way to price a whole square.
 *
 *     npx tsx scripts/probe-who-would-come-with-you.ts [out.json]
 *
 * Five arrangements per person, and the differences between them are the
 * answer to "what does it take":
 *
 *     cold        a stranger asks, with nothing on the table
 *     a purse     a year of that person's own income, offered
 *     a purse x10 ten years of it, to show where money stops
 *     an afternoon  one courtesy already paid - a tie at the strength one
 *                   buys, which is the cheapest lever in the game
 *     both        the tie and the year's purse together
 *
 * Bands are reported apart rather than pooled, because a starting player is at
 * the bottom of the ladder and the standing term is the dominant one: a figure
 * that mixes the two heights says nothing about either.
 */

import { writeFileSync } from 'node:fs';

import { oddsOf, type AttemptInput } from '../src/engine/social-leverage/an-attempt-to-move-somebody.js';
import { openHandednessOf } from '../src/engine/social-leverage/how-freely-somebody-parts-with-what-they-have.js';
import { earningsPerYear } from '../src/engine/cultivation/origin.js';
import { baseWeightOf } from '../src/web/what-a-request-asks-and-of-whom.js';
import { makeGameInWorld } from '../tests/web/harness.js';

const WORLDS = [
    'who-would-come-a', 'who-would-come-b', 'who-would-come-c',
    'who-would-come-d', 'who-would-come-e'
] as const;

/** Where a request stops being a coin flip and starts being a plan. */
const WORTH_TRYING = 0.25;

interface Arrangement {
    name: string;
    tie: number;
    purseYears: number;
}

const ARRANGEMENTS: readonly Arrangement[] = [
    { name: 'cold', tie: 0, purseYears: 0 },
    { name: 'a purse (one year of theirs)', tie: 0, purseYears: 1 },
    { name: 'a purse (ten years of theirs)', tie: 0, purseYears: 10 },
    // What one courtesy leaves. `recordTie` moves the subject's side to 0.1 on
    // a taken approach, which is the figure a played turn actually produced.
    { name: 'an afternoon already spent', tie: 0.1, purseYears: 0 },
    { name: 'both', tie: 0.1, purseYears: 1 }
];

function priceIt(
    player: { id: string; name: string; ordinal: number; charm: number },
    them: { id: string; name: string; ordinal: number; factionId: string | null },
    how: Arrangement
): number {
    const offered = Math.round(earningsPerYear(Math.max(0, them.ordinal)) * how.purseYears);
    const input = {
        actor: {
            id: player.id,
            name: player.name,
            ordinal: player.ordinal,
            charm: player.charm,
            factionId: null,
            alignment: null,
            ranked: false
        },
        subject: {
            id: them.id,
            name: them.name,
            ordinal: them.ordinal,
            factionId: them.factionId,
            alignment: null,
            ranked: them.factionId !== null,
            openHandedness: openHandednessOf(them.id)
        },
        onDay: 0,
        ask: baseWeightOf('company'),
        theirTie: how.tie > 0 ? { active: true, strength: how.tie } : null,
        ledger: [],
        ...(offered > 0
            ? { stonesOffered: offered, approach: { intent: 'come with me', leverage: 'coin' } }
            : {}),
        rng: () => 0.5
    } as unknown as AttemptInput;
    return oddsOf(input).odds;
}

async function main(): Promise<void> {
    const rows: Record<string, unknown>[] = [];

    for (const world of WORLDS) {
        const harness = await makeGameInWorld({ seed: `ask-${world}`, worldSeed: world });
        const { cultivator } = await harness.game.newRun('Asker');
        const game = harness.game as unknown as {
            atHand: { npcs: readonly any[] } | null;
            present: (c: unknown) => readonly { id: string; name: string }[];
        };

        const here = new Set(game.present(cultivator).map(row => row.id));
        const reachable = (game.atHand?.npcs ?? []).filter(
            npc => npc.status === 'alive' && here.has(npc.id)
        );

        const player = {
            id: cultivator.id,
            name: cultivator.name,
            ordinal: cultivator.realmOrdinal,
            charm: cultivator.attributes.charm
        };

        for (const npc of reachable) {
            const them = {
                id: npc.id,
                name: npc.name,
                ordinal: npc.cultivation.realmOrdinal,
                factionId: npc.factionId ?? null
            };
            const odds: Record<string, number> = {};
            for (const how of ARRANGEMENTS) odds[how.name] = priceIt(player, them, how);
            rows.push({
                world,
                playerOrdinal: player.ordinal,
                playerCharm: player.charm,
                who: npc.name,
                theirOrdinal: them.ordinal,
                gap: them.ordinal - player.ordinal,
                openHandedness: Number(openHandednessOf(npc.id).toFixed(3)),
                alreadyOut: npc.activity?.kind === 'out_with_a_party',
                odds
            });
        }
    }

    const worthIt = (how: string) =>
        rows.filter(row => (row.odds as Record<string, number>)[how] >= WORTH_TRYING).length;

    const best = (how: string) =>
        rows.reduce((top, row) => Math.max(top, (row.odds as Record<string, number>)[how]), 0);

    const mean = (how: string) =>
        rows.reduce((sum, row) => sum + (row.odds as Record<string, number>)[how], 0)
        / Math.max(1, rows.length);

    process.stdout.write(
        `\n${rows.length} people in reach of a starting player, over `
        + `${WORLDS.length} pinned worlds.\n`
        + `Already out with somebody and so unaskable: `
        + `${rows.filter(row => row.alreadyOut).length}\n\n`
        + 'arrangement'.padEnd(32) + 'mean   best   at or over 25%\n'
    );
    for (const how of ARRANGEMENTS) {
        process.stdout.write(
            how.name.padEnd(32)
            + `${(mean(how.name) * 100).toFixed(1)}%`.padEnd(7)
            + `${(best(how.name) * 100).toFixed(1)}%`.padEnd(7)
            + `${worthIt(how.name)} of ${rows.length}\n`
        );
    }
    process.stdout.write('\n');

    // AND THE TERM THAT DOMINATES ALL OF THEM. `PER_RUNG` is the largest thing
    // in the sum and it runs against a starting player at every rung of the
    // gap, so a pooled figure says nothing about what a player should DO.
    const bands: readonly [string, (gap: number) => boolean][] = [
        ['at or below the asker', (gap: number) => gap <= 0],
        ['one or two rungs above', (gap: number) => gap >= 1 && gap <= 2],
        ['three or more above', (gap: number) => gap >= 3]
    ];
    process.stdout.write('by the gap in standing      people      cold    a year offered\n');
    for (const [label, inBand] of bands) {
        const band = rows.filter(row => inBand(row.gap as number));
        if (band.length === 0) {
            process.stdout.write(`${label.padEnd(28)}nobody in reach\n`);
            continue;
        }
        const at = (how: string) =>
            band.reduce((sum, row) => sum + (row.odds as Record<string, number>)[how], 0)
            / band.length;
        process.stdout.write(
            label.padEnd(28)
            + `${band.length}`.padEnd(12)
            + `${(at('cold') * 100).toFixed(1)}%`.padEnd(8)
            + `${(at('a purse (one year of theirs)') * 100).toFixed(1)}%\n`
        );
    }
    process.stdout.write('\n');

    const out = process.argv[2];
    if (out) {
        writeFileSync(out, JSON.stringify({ rows }, null, 2));
        process.stdout.write(`Rows written to ${out}\n`);
    }
    process.exit(0);
}

void main();
