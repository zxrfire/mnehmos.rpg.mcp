/**
 * The giants, fighting.
 *
 * Every other harness asks whether the game answers. This one asks what happens
 * when the largest named things in the world are put in front of each other,
 * and it exists because those fights are the load-bearing claims of the whole
 * setting and almost none of them had ever been run.
 *
 * Two rules for reading the output, both learned the hard way:
 *
 *   - A zero is not always a loss. `resolveMelee` returns no winner when
 *     neither side finishes inside the exchange budget, and large even sides
 *     stalemate. The `unsettled` column says how often that happened, and a
 *     row with a high one is a fight the engine could not resolve rather than
 *     a fight somebody lost.
 *   - Everybody here is built the same way, legally. `might` caps at 3 and
 *     `insight` at 4; a probe using 5s is not measuring this game. Nobody gets
 *     a bonus for being important, and what makes the big numbers big is the
 *     rung and what is in their hands.
 */

import { resolveMelee, type SideMemberInput, type CombatantInput } from '../src/engine/cultivation/combat.js';
import { forStream } from '../src/engine/cultivation/rng.js';
import { APEX_INSTITUTIONS, COURTS } from '../src/data/cultivation/hierarchy.js';
import { SECTS, sectThreat } from '../src/data/cultivation/sects.js';
import { artifactsOwnedBy } from '../src/data/cultivation/artifacts.js';
import { TECHNIQUES } from '../src/data/cultivation/techniques.js';
import type { Technique } from '../src/schema/cultivation.js';
import {
    rankName, FALSE_IMMORTAL_ORDINAL, TRUE_IMMORTAL_ORDINAL
} from '../src/engine/cultivation/realms.js';

const SEEDS = 200;

const line = (s = '') => console.log(s);
const rule = (t: string) => { line(); line('='.repeat(86)); line('  ' + t); line('='.repeat(86)); };

/**
 * The best art of a given reach that somebody at this rung can actually use.
 *
 * Written as a function after the first run reported something impossible: Lu
 * Sheng with a wide art losing every fight he won with a narrow one. The cause
 * was here rather than in the engine - the widest art in the catalog is one of
 * the forty-sixes Ru Anjing sent down, he stands at forty-five, and the guard
 * below silently gave him nothing at all. He was fighting bare-handed and the
 * table called it "wide".
 */
function bestArt(ordinal: number, wide: boolean): Technique | undefined {
    return TECHNIQUES
        .filter(t => t.category === 'attack')
        .filter(t => (t.requiredOrdinal ?? 0) <= ordinal)
        .filter(t => wide
            ? (t as { reach?: string }).reach === 'field' || (t as { reach?: string }).reach === 'several'
            : ((t as { reach?: string }).reach ?? 'single') === 'single')
        .sort((a, b) => (b.requiredOrdinal ?? 0) - (a.requiredOrdinal ?? 0))[0];
}

interface Build {
    ordinal: number;
    /** A held object's rating, if any. */
    object?: number;
    /** Whether they fight with something that lands on more than one person. */
    wide?: boolean;
}

function one(id: string, build: Build): SideMemberInput {
    const art = bestArt(build.ordinal, build.wide === true);
    const combatant: CombatantInput = {
        id,
        name: id,
        realmOrdinal: build.ordinal,
        // Muddled on purpose, so nothing matches. An earlier run gave everybody
        // a metal root, which matched one of the arts being compared and not
        // the other - the element bonus is 1.9 against 1.2, a bigger swing than
        // reach or damage - and the table appeared to show a strictly stronger
        // wide art losing. Arts at the top of the ladder are elementless by
        // design, so an elemental root quietly stacks the comparison.
        spiritRoot: 'muddled_five_element',
        // The legal maximum. Nobody here is exceptional for being famous.
        attributes: { might: 3, insight: 4, fortune: 3, charm: 3 },
        injuries: [],
        hp: 100,
        maxHp: 100,
        // Enough to pay for anything in the catalog. The widest art at this
        // altitude costs 1020 qi a use and the first run gave everybody 500,
        // so the fighters carrying wide arts could not afford to swing them
        // and the table read as though reach were a handicap.
        qi: 20_000,
        maxQi: 20_000,
        ...(build.object === undefined ? {} : { artifactOrdinal: build.object }),
        ...(art ? { technique: art, techniqueMastery: 1 } : {})
    };
    return { combatant };
}

interface Outcome { a: number; b: number; unsettled: number; }

function fight(left: SideMemberInput[], right: SideMemberInput[], key: string): Outcome {
    let a = 0;
    let b = 0;
    let unsettled = 0;
    for (let i = 0; i < SEEDS; i++) {
        const result = resolveMelee(
            [
                { id: 'a', name: 'a', members: left, intent: { goal: 'kill' } },
                { id: 'b', name: 'b', members: right, intent: { goal: 'kill' } }
            ],
            { rng: forStream('giants', key, i), ambient: 'normal', turn: i, intent: { goal: 'kill' } }
        );
        if (result.winningSideId === 'a') a++;
        else if (result.winningSideId === 'b') b++;
        else unsettled++;
    }
    return { a, b, unsettled };
}

const pct = (n: number) => n === 0 ? '  0%' : n / SEEDS < 0.01 ? ((n / SEEDS) * 100).toFixed(1) + '%' : Math.round((n / SEEDS) * 100) + '%';

function report(label: string, o: Outcome): void {
    line(`  ${label.padEnd(56)}${pct(o.a)}  ${pct(o.b)}  ${pct(o.unsettled)}`);
}

function header(): void {
    line(`  ${'pairing'.padEnd(56)}left  right  unsettled`);
    line('  ' + '-'.repeat(78));
}

// ── the people the world is built around ─────────────────────────────────

function apexHead(id: string, wide = false): SideMemberInput[] {
    const apex = APEX_INSTITUTIONS.find(a => a.id === id)!;
    const object = artifactsOwnedBy(apex.id)[0];
    return [one(apex.name, { ordinal: apex.powerOrdinal, object: object?.power ?? undefined, wide })];
}

function seats(wide = false): SideMemberInput[] {
    const held = artifactsOwnedBy('sect-hollow-court');
    return (sectThreat('sect-hollow-court')?.withdrawn?.seats ?? [])
        .map((s, i) => one(`Seat ${i + 1}`, { ordinal: s.ordinal, object: held[i]?.power ?? undefined, wide }));
}

function main(): void {
    // What each rung is actually holding, so a surprising row can be read.
    line('\n  best art available, by rung:');
    for (const o of [17, 25, 37, 41, 45, 46]) {
        line(`    ${String(o).padStart(2)}  wide: ${(bestArt(o, true)?.name ?? 'none').padEnd(34)}`
            + `narrow: ${bestArt(o, false)?.name ?? 'none'}`);
    }

    // ── 1. the top three, against each other ─────────────────────────────
    rule('1. APEX AGAINST APEX - one head, one object, nobody called');
    header();
    for (const a of APEX_INSTITUTIONS) {
        for (const b of APEX_INSTITUTIONS) {
            if (a.id >= b.id) continue;
            const objA = artifactsOwnedBy(a.id)[0];
            const objB = artifactsOwnedBy(b.id)[0];
            report(
                `${a.name} (${a.powerOrdinal}+${objA?.power ?? 0}) v ${b.name} (${b.powerOrdinal}+${objB?.power ?? 0})`,
                fight(apexHead(a.id), apexHead(b.id), `apex-${a.id}-${b.id}`)
            );
        }
    }

    // ── 2. the man with nothing in his hands ─────────────────────────────
    rule('2. LU SHENG - forty-five, and the only person here holding no object');
    header();
    for (const wide of [false, true]) {
        for (const apex of APEX_INSTITUTIONS) {
            const obj = artifactsOwnedBy(apex.id)[0];
            report(
                `Lu Sheng (45, ${wide ? 'a wide art' : 'a narrow art'}) v ${apex.name} (${apex.powerOrdinal}+${obj?.power ?? 0})`,
                fight([one('Lu Sheng', { ordinal: FALSE_IMMORTAL_ORDINAL, wide })], apexHead(apex.id), `ls-${apex.id}-${wide}`)
            );
        }
    }
    report('Lu Sheng (45, a wide art) v the four Seats',
        fight([one('Lu Sheng', { ordinal: FALSE_IMMORTAL_ORDINAL, wide: true })], seats(), 'ls-seats'));

    // ── 3. somebody comes back down ──────────────────────────────────────
    rule('3. A TRUE IMMORTAL, DESCENDING - fifteen breaths, and what fits in them');
    header();
    for (const wide of [false, true]) {
        for (const apex of APEX_INSTITUTIONS) {
            report(
                `a 46 (${wide ? 'wide' : 'narrow'}) v ${apex.name}, head only`,
                fight([one('the returned', { ordinal: TRUE_IMMORTAL_ORDINAL, object: 46, wide })], apexHead(apex.id), `ti-${apex.id}-${wide}`)
            );
        }
    }
    report('a 46 (wide) v the four Seats, all four objects',
        fight([one('the returned', { ordinal: TRUE_IMMORTAL_ORDINAL, object: 46, wide: true })], seats(), 'ti-seats'));

    // ── 4. the seals ─────────────────────────────────────────────────────
    rule('4. WHAT THE HOUSES KEEP ASLEEP - a woken ancestor against a standing head');
    header();
    const sealed = SECTS
        .map(s => ({ s, t: sectThreat(s.id) }))
        .filter(x => x.t && x.t.wakeCondition !== null && x.t.ceiling > x.t.acting)
        .sort((x, y) => y.t!.ceiling - x.t!.ceiling);
    for (const { s, t } of sealed) {
        for (const apex of APEX_INSTITUTIONS) {
            const obj = artifactsOwnedBy(apex.id)[0];
            const o = fight([one(s.name, { ordinal: t!.ceiling })], apexHead(apex.id), `seal-${s.id}-${apex.id}`);
            if (o.a === 0 && o.unsettled === 0) continue;
            report(`${s.name}'s ${t!.ceiling} v ${apex.name} (${apex.powerOrdinal}+${obj?.power ?? 0})`, o);
        }
    }

    // ── 5. the schism, if it ever stopped being paperwork ────────────────
    rule('5. THE KILN SCHISM - the two halves of one house, if it came to it');
    header();
    const kilnCourt = COURTS.find(c => c.id === 'court-root-sill')!;
    const rootSill = SECTS.find(s => s.id === 'sect-kiln-wardens')!;
    const rootThreat = sectThreat(rootSill.id)!;
    report(
        `${kilnCourt.name} (${kilnCourt.powerOrdinal}) v ${rootSill.name} acting (${rootThreat.acting})`,
        fight([one('kiln', { ordinal: kilnCourt.powerOrdinal })], [one('root', { ordinal: rootThreat.acting })], 'schism-acting')
    );
    report(
        `${kilnCourt.name} (${kilnCourt.powerOrdinal}) v ${rootSill.name} with its ${rootThreat.ceiling} woken`,
        fight([one('kiln', { ordinal: kilnCourt.powerOrdinal })], [one('root-sealed', { ordinal: rootThreat.ceiling })], 'schism-sealed')
    );
    const thirdSill = COURTS.find(c => c.id === 'court-third-sill')!;
    report(
        `${thirdSill.name} (${thirdSill.powerOrdinal}) v ${rootSill.name} acting (${rootThreat.acting})`,
        fight([one('third', { ordinal: thirdSill.powerOrdinal })], [one('root', { ordinal: rootThreat.acting })], 'schism-courts')
    );

    // ── 6. what a wide art is worth, at every height ─────────────────────
    rule('6. REACH - the same fight, with and without an art that lands on more than one');
    line('  One person against a crowd of their own peers. The comparison is the point:');
    line('  the ONLY difference between the two rows is the art in their hands.');
    line();
    header();
    for (const [label, ordinal] of [
        ['Core Formation', 17],
        ['Nascent Soul', 21],
        ['Deity Transformation', 25],
        ['Void Refinement', 29],
        ['Grand Ascension', 37],
        ['Tribulation Transcendence', 41]
    ] as const) {
        for (const count of [3, 6]) {
            const mob = () => Array.from({ length: count }, (_, i) => one(`m${i}`, { ordinal }));
            const narrow = fight([one('solo', { ordinal })], mob(), `r-${ordinal}-${count}-n`);
            const wide = fight([one('solo', { ordinal, wide: true })], mob(), `r-${ordinal}-${count}-w`);
            report(`${label} v ${count} peers - narrow art`, narrow);
            report(`${label} v ${count} peers - WIDE art`, wide);
        }
    }
    line();
}

main();
