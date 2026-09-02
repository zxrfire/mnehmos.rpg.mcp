/**
 * Dying, and what is left afterwards.
 *
 * The game's two central promises are that death is permanent and that the
 * world keeps running without you. Both are claims about what happens AFTER a
 * run, and almost nothing exercises that - every other harness stops at the
 * interesting part of a life.
 *
 * So this one kills people, five different ways, and then asks what the world
 * has to say about it:
 *
 *   - does each documented cause actually fire, from state a player can reach
 *   - does a closed run refuse to continue, and say why
 *   - does the ledger keep them
 *   - does the next run start clean, in a world that is not reset
 *
 * The five causes are the ones `evaluateDeathConditions` can return. If one of
 * them cannot be produced from reachable state, it is decoration.
 */

import { makeGame } from '../tests/web/harness.js';
import {
    evaluateDeathConditions, describeDeath, bleedStateOf, isBleedingOut
} from '../src/engine/cultivation/survival.js';
import {
    STARVATION_TURNS, CRIPPLING_UNTREATED_INJURIES, BLEED_OUT_TURNS
} from '../src/schema/cultivation.js';
import { rankName } from '../src/engine/cultivation/realms.js';

const line = (s = '') => console.log(s);
const rule = (t: string) => { line(); line('='.repeat(80)); line('  ' + t); line('='.repeat(80)); };

type Kind = 'works' | 'friction' | 'broken';
const notes: { kind: Kind; text: string }[] = [];
const note = (kind: Kind, text: string) => notes.push({ kind, text });

type Game = ReturnType<typeof makeGame>['game'];
const cur = (game: Game): any => { const s: any = (game as any).state(); return s.cultivator ?? s; };

async function say(game: Game, text: string): Promise<string> {
    try {
        const r: any = await (game as any).act(text);
        return typeof r === 'string' ? r : String(r?.narration ?? '');
    } catch (error) {
        return 'THREW: ' + (error as Error).message;
    }
}

/** A body in whatever state the caller wants to test the gate with. */
function body(over: Record<string, unknown> = {}): any {
    return {
        hp: 100, maxHp: 100, satiety: 100, starvationTurns: 0, age: 20,
        realmOrdinal: 10, yearsAtCurrentRealm: 0, injuries: [], alive: true,
        bleedingTurns: 0,
        ...over
    };
}

function threeOpenWounds(): unknown[] {
    return [0, 1, 2].map(i => ({
        id: `00000000-0000-4000-8000-00000000000${i}`,
        severity: 'serious', source: 'qi_deviation',
        description: 'a torn meridian', sustainedOnTurn: 0, treated: false,
        cultivationPenalty: 0.1, breakthroughPenalty: 0.05
    }));
}

// ─────────────────────────────────────────────────────────────────────────
// 1. EVERY DOCUMENTED WAY TO DIE
// ─────────────────────────────────────────────────────────────────────────

function everyDeath(): void {
    rule('1. EVERY WAY THE ENGINE WILL KILL YOU');
    line(`  ${'cause'.padEnd(24)}${'from'.padEnd(44)}fires`);
    line('  ' + '-'.repeat(76));

    const cases: [string, string, any, Record<string, unknown>][] = [
        ['combat_defeat', 'hp at zero', body({ hp: 0 }), {}],
        ['starvation', `${STARVATION_TURNS} turns at empty`,
            body({ satiety: 0, starvationTurns: STARVATION_TURNS }), {}],
        // The two `untreated_injuries` rows that stood here are gone with the
        // cause. A torn meridian is a torn muscle - see docs/world/climbing/injuries.md.
        // What replaces them is the negative check in section 2.
        ['obviously_fatal_choice', 'almost no hp, and starting a fight anyway',
            body({ hp: 2 }), { forcingCombat: true }],
        ['lifespan_exhausted', 'a hundred years old at Qi Condensation',
            body({ age: 200 }), {}],
        ['stagnation_aging', 'fifty years without moving a rung',
            body({ yearsAtCurrentRealm: 200 }), {}]
    ];

    const fired = new Set<string>();
    for (const [expected, from, subject, ctx] of cases) {
        const got = evaluateDeathConditions(subject, ctx);
        const ok = got === expected;
        if (ok) fired.add(expected);
        line(`  ${expected.padEnd(24)}${from.padEnd(44)}${ok ? 'yes' : 'NO (' + got + ')'}`);
        if (!ok) {
            note('broken', `${expected} does not fire from ${from} - got ${got ?? 'nothing'}.`);
        }
    }

    // And every cause the engine can name should have prose for it.
    for (const cause of fired) {
        const said = describeDeath(cause as never, { name: 'Somebody', realmOrdinal: 10, age: 40 });
        if (!said || said.length < 20) {
            note('friction', `${cause} has no description worth showing a player.`);
        }
    }
    note('works', `${fired.size} distinct death causes fire from state a player can reach, `
        + 'each with prose to show for it.');
}

// ─────────────────────────────────────────────────────────────────────────
// 2. THE BLEED CLOCK, AS A LIFE
// ─────────────────────────────────────────────────────────────────────────

function theBleedClock(): void {
    rule('2. OPEN CHANNELS - and that they do NOT kill');

    // This section used to check that the bleed clock fired on exactly day
    // ninety. It checks the opposite now, because the design owner reversed the
    // decision: "torn meridians should not kill, they don't make you bleed out.
    // it should be the same as a torn muscle irl. very VERY annoying, but you
    // don't die." A probe that still asserted the death would report a working
    // engine as broken. See docs/world/climbing/injuries.md.
    const wounded = body({ injuries: threeOpenWounds() });
    line(`  crippled at ${CRIPPLING_UNTREATED_INJURIES} untreated:  ${isBleedingOut(bleedStateOf(wounded).untreatedInjuries)}`);
    line(`  and at two:                    ${isBleedingOut(bleedStateOf(body({ injuries: threeOpenWounds().slice(0, 2) })).untreatedInjuries)}`);

    const onTheDay = evaluateDeathConditions(
        body({ injuries: threeOpenWounds(), bleedingTurns: BLEED_OUT_TURNS }), {});
    const longAfter = evaluateDeathConditions(
        body({ injuries: threeOpenWounds(), bleedingTurns: BLEED_OUT_TURNS * 40 }), {});
    const fighting = evaluateDeathConditions(
        body({ injuries: threeOpenWounds() }), { forcingCombat: true });
    line(`  day ${BLEED_OUT_TURNS} carrying three:      ${onTheDay ?? 'alive'}`);
    line(`  ten years carrying three:      ${longAfter ?? 'alive'}`);
    line(`  and forcing a fight with them: ${fighting ?? 'alive'}`);

    if (onTheDay === null && longAfter === null && fighting === null) {
        note('works', 'Open channels never end a run, on any of the three routes that used to '
            + 'produce `untreated_injuries`. They are an impairment - rate, odds, and what a '
            + 'blow lands - and not a clock.');
    } else {
        note('broken', 'A channel wound is still killing somebody: '
            + `day ${BLEED_OUT_TURNS} gives ${onTheDay}, ten years gives ${longAfter}, `
            + `forcing a fight gives ${fighting}.`);
    }

    // Treating one of three has to stop nothing.
    const partly = threeOpenWounds();
    (partly[0] as any).treated = true;
    const stillBleeding = isBleedingOut(bleedStateOf(body({ injuries: partly })).untreatedInjuries);
    line(`  after treating one of three:   ${stillBleeding ? 'still bleeding' : 'stopped'}`);
    if (stillBleeding) {
        note('works', 'Treating one wound out of three does not stop the clock - the threshold is the '
            + 'threshold, and a partial answer is not an answer.');
    }
}

// ─────────────────────────────────────────────────────────────────────────
// 3. WHAT A CLOSED RUN DOES
// ─────────────────────────────────────────────────────────────────────────

async function afterTheEnd(): Promise<void> {
    rule('3. AFTER THE END - the ledger, and the next life');

    const { game, repos } = makeGame({ seed: 'mortality', worldEnabled: true });
    await (game as any).newRun('The First');
    const first = cur(game);
    line(`  run one: ${first.name}, ${rankName(first.realmOrdinal)}`);

    // Kill them the way the world actually does it.
    repos.cultivators.update(first.id, { hp: 0 } as any);
    // A bare hp write is not a death - the gate runs when a turn resolves, so
    // the honest test is to take a turn-consuming action and see what happens.
    await say(game, 'I cultivate for a month');
    const dead = await say(game, 'I look around');
    const refused = /dead|ended|no continuation|ledger/i.test(dead);
    line(`  a closed run refuses:     ${refused ? 'yes' : 'NO'}`);
    line(`  what it says:             ${dead.slice(0, 96)}`);

    if (!refused) {
        note('friction', 'A run whose cultivator is at zero hp still answers ordinary actions. '
            + 'Death should be the end of the conversation, not a stat.');
    } else {
        note('works', 'A closed run refuses to continue and says so rather than silently doing nothing.');
    }

    // The ledger keeps them.
    const ledger = repos.runs.deathLedger(10) ?? [];
    line(`  in the ledger:            ${ledger.length} entr${ledger.length === 1 ? 'y' : 'ies'}`);
    if (ledger.length > 0) {
        note('works', 'The run is in the death ledger after it closes - the only thing that persists.');
    } else {
        note('friction', 'Nothing reached the death ledger, so a finished life leaves no trace at all.');
    }

    // A second life, in the same world.
    await (game as any).newRun('The Second');
    const second = cur(game);
    line(`\n  run two: ${second.name}, ${rankName(second.realmOrdinal)}, ` +
        `${second.spiritStones ?? 0} stones`);
    const clean = second.id !== first.id
        && (second.realmOrdinal ?? 0) === 0
        && (second.injuries ?? []).length === 0;
    line(`  starts clean:             ${clean ? 'yes' : 'NO'}`);

    const world: any = await (game as any).loadWorld();
    line(`  the world persisted:      ${world ? `${world.locations?.length ?? 0} places, day ${world.currentDay}` : 'NO WORLD'}`);

    if (clean && world) {
        note('works', 'The next life starts at the bottom with nothing carried over, in a world that '
            + 'was not reset with it - which is the whole of what the ledger is for.');
    } else if (!clean) {
        note('broken', 'A new run inherited something from the last one.');
    }
}

async function main(): Promise<void> {
    everyDeath();
    theBleedClock();
    await afterTheEnd();

    rule('FINDINGS');
    for (const kind of ['broken', 'friction', 'works'] as Kind[]) {
        const hits = notes.filter(n => n.kind === kind);
        if (hits.length === 0) continue;
        line(`\n  ${kind.toUpperCase()} (${hits.length})`);
        for (const h of hits) line(`    ${h.text}`);
    }
    line();
}

main().catch(error => { console.error(error); process.exit(1); });
