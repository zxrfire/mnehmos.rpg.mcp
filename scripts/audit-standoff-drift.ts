/**
 * Does the balance of the world move when the world does?
 *
 * `playtest-conspiracy.ts` asks whether anybody can kill an apex head, and it
 * asks it OF THE CATALOGS - a fixed board, the arrangement the setting starts
 * in. It answers the same way every time it is run, by construction, and that
 * is correct for what it measures.
 *
 * Nobody has ever asked the second question: what does that board look like
 * three centuries in. This does, and the distinction is the whole point:
 *
 *   EQUILIBRIUM IS THE INITIAL CONDITION, NOT AN INVARIANT.
 *
 * A seeded world at day zero should read the way the setting says it reads. A
 * world that has run forward is expected to read differently, and a tilt that
 * produces a war is the system working rather than a regression. What would be
 * a defect is a figure that moves and nobody can say why - so this reports the
 * CAUSES alongside the number: who is still alive, who still holds a seal, how
 * much ground has stopped being ground.
 *
 * It also guards a specific mistake. If the world-event work fired during
 * seeding or on the first tick, the starting balance would already be wrong
 * before a player ever saw it. The day-zero row catches that immediately.
 *
 * Everything is measured through `resolveMelee` off real people at their real
 * ordinals. No apex branch, no special case, no hardcoded verdict.
 */

import { resolveMelee, type SideMemberInput } from '../src/engine/cultivation/combat.js';
import { forStream } from '../src/engine/cultivation/rng.js';
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { isBelowTheLid } from '../src/engine/world/layers.js';
import { rankName } from '../src/engine/cultivation/realms.js';
import type { WorldState } from '../src/engine/world/world-state.js';
import type { NpcRecord } from '../src/engine/world/npc-state.js';

const SEEDS = 120;
const line = (s = '') => console.log(s);
const rule = (t: string) => { line(); line('='.repeat(94)); line('  ' + t); line('='.repeat(94)); };

function body(id: string, ordinal: number): SideMemberInput {
    return {
        combatant: {
            id, name: id, realmOrdinal: ordinal,
            spiritRoot: 'single_metal',
            // The legal attribute range, not 5/5/5/5. See AGENTS.md.
            attributes: { might: 3, insight: 3, fortune: 2, charm: 2 },
            injuries: [], hp: 100, maxHp: 100, qi: 50, maxQi: 50
        }
    };
}

const alive = (state: WorldState): NpcRecord[] =>
    state.npcs.filter(n => n.status === 'alive' && isBelowTheLid(n));

/** The strongest person alive, and whose they are. */
function apexOf(state: WorldState): { npc: NpcRecord; factionId: string | null } | null {
    let best: NpcRecord | null = null;
    for (const n of alive(state)) {
        if (!best || n.cultivation.realmOrdinal > best.cultivation.realmOrdinal) best = n;
    }
    return best ? { npc: best, factionId: best.factionId } : null;
}

/**
 * Everybody who turns out when that person's life is in question.
 *
 * Read off standing, not off a table: a house that stands positively toward
 * theirs sends its strongest, because everything it holds is held on that name.
 */
function defenders(state: WorldState, apexId: string, factionId: string | null): SideMemberInput[] {
    const head = state.npcs.find(n => n.id === apexId)!;
    const out = [body('head', head.cultivation.realmOrdinal)];
    if (!factionId) return out;
    const theirs = state.factions.find(f => f.id === factionId);
    if (!theirs) return out;

    for (const f of state.factions) {
        if (f.id === factionId || f.dissolvedOnDay !== null || !isBelowTheLid(f)) continue;
        if ((f.standing[factionId] ?? 0) < 0.3) continue;
        const strongest = alive(state)
            .filter(n => n.factionId === f.id)
            .reduce((m, n) => Math.max(m, n.cultivation.realmOrdinal), 0);
        if (strongest > 0) out.push(body(`ally-${f.id}`, strongest));
        // And whatever they still keep asleep, which they break for this.
        const sealed = Number(f.resources.sealed_ceiling_ordinal ?? 0);
        if (sealed > strongest) out.push(body(`sealed-${f.id}`, sealed));
    }
    return out;
}

/** The best move any single hostile house has, and what it is made of. */
function bestMove(
    state: WorldState,
    factionId: string | null
): { members: SideMemberInput[]; note: string } {
    let best: { members: SideMemberInput[]; note: string; weight: number } =
        { members: [], note: 'nobody hostile has anybody', weight: -1 };
    if (!factionId) return best;

    for (const f of state.factions) {
        if (f.id === factionId || f.dissolvedOnDay !== null || !isBelowTheLid(f)) continue;
        if ((f.standing[factionId] ?? 0) > -0.3) continue;
        const strongest = alive(state)
            .filter(n => n.factionId === f.id)
            .reduce((m, n) => Math.max(m, n.cultivation.realmOrdinal), 0);
        const sealed = Number(f.resources.sealed_ceiling_ordinal ?? 0);
        const members = [body(`atk-${f.id}`, strongest)];
        if (sealed > strongest) members.push(body(`atk-sealed-${f.id}`, sealed));
        const weight = strongest + (sealed > strongest ? sealed : 0);
        if (weight > best.weight) {
            best = {
                members,
                weight,
                note: `${f.name}: ${rankName(strongest)} awake`
                    + (sealed > strongest ? ` + ${rankName(sealed)} asleep` : ', nothing asleep')
            };
        }
    }
    return best;
}

function winRate(attackers: SideMemberInput[], defs: SideMemberInput[]): number {
    if (attackers.length === 0) return 0;
    let wins = 0;
    for (let seed = 0; seed < SEEDS; seed++) {
        const r = resolveMelee(
            [
                { id: 'plot', name: 'the plot', members: attackers, intent: { goal: 'kill' } },
                { id: 'house', name: 'the house', members: defs, intent: { goal: 'kill' } }
            ],
            { rng: forStream('standoff-drift', seed), ambient: 'normal', turn: seed, intent: { goal: 'kill' } }
        );
        // A stalemate is NOT a loss for the defender and is not a win for the
        // plot. Counting `winningSideId !== 'plot'` would be the same error
        // AGENTS.md records under "a stalemate is not a loss".
        if (r.winningSideId === 'plot') wins++;
    }
    return wins / SEEDS;
}

const pct = (n: number): string =>
    n === 0 ? '  0%' : n < 0.01 ? (n * 100).toFixed(1) + '%' : Math.round(n * 100) + '%';

/** The causes, so a number that moved has something to point at. */
function causes(state: WorldState): {
    sealsLeft: number; forbidden: number; ruins: number; live: number; apex: number;
} {
    return {
        sealsLeft: state.factions.filter(
            f => f.dissolvedOnDay === null && Number(f.resources.sealed_ceiling_ordinal ?? 0) > 0
        ).length,
        forbidden: state.locations.filter(l => l.tags.includes('forbidden')).length,
        ruins: state.locations.filter(l => l.kind === 'ruin').length,
        live: state.factions.filter(f => f.dissolvedOnDay === null).length,
        apex: apexOf(state)?.npc.cultivation.realmOrdinal ?? 0
    };
}

const ERAS = [0, 50, 200, 500];

async function main(): Promise<void> {
    rule('DOES THE BALANCE OF THE WORLD MOVE WHEN THE WORLD DOES?');
    line('  Equilibrium is the INITIAL CONDITION. Day zero must read the way the setting');
    line('  says it reads; every later row is expected to differ, with the cause named.');
    line();

    const catalog = await loadCultivationCatalog();
    let state = seedWorld({ seed: 'standoff-drift', catalog }).state;
    let elapsed = 0;

    line(`  ${'after'.padEnd(8)}${'apex'.padStart(6)}${'best move'.padStart(11)}`
        + `${'houses'.padStart(8)}${'seals left'.padStart(12)}${'forbidden'.padStart(11)}`
        + `${'ruins'.padStart(7)}   what the move is made of`);
    line('  ' + '-'.repeat(90));

    for (const era of ERAS) {
        if (era > elapsed) {
            state = advanceWorldYears(state, era - elapsed).state;
            elapsed = era;
        }
        const top = apexOf(state);
        if (!top) { line(`  ${String(era).padEnd(8)}  nobody alive`); continue; }

        const move = bestMove(state, top.factionId);
        const rate = winRate(move.members, defenders(state, top.npc.id, top.factionId));
        const c = causes(state);

        line(`  ${(era + 'y').padEnd(8)}${String(c.apex).padStart(6)}${pct(rate).padStart(11)}`
            + `${String(c.live).padStart(8)}${String(c.sealsLeft).padStart(12)}`
            + `${String(c.forbidden).padStart(11)}${String(c.ruins).padStart(7)}   ${move.note}`);
    }

    rule('READING IT');
    line('  A move worth making at 500 years and not at 0 is a WAR THE WORLD PRODUCED, and');
    line('  is the macro behaviour the world-event work exists to create. Watch two things:');
    line();
    line('    TILTED IS FINE, DEGENERATE IS NOT. If a move ever costs nothing - a house');
    line('    that can take everything with no exposure - that is a mechanism failure');
    line('    rather than a consequence.');
    line();
    line('    A WORLD THAT DRIFTED IS NOT A RESOLVER THAT CHANGED. The seals-left and');
    line('    forbidden columns are the causes. If the rate moves while those hold flat,');
    line('    something changed in the combat arithmetic and that is a different finding.');
    line();
}

main().catch(err => { console.error(err); process.exitCode = 1; });
