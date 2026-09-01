/**
 * What a dao protector is worth, what it costs, and who in the world can get one.
 *
 * `data/cultivation/crossings.ts` has said for a long time that a crossing needs
 * a protector, that almost nobody can obtain one, and that everything else about
 * how a crossing is conducted follows from that. This measures whether the
 * mechanic now produces the world the prose describes, against a real seeded
 * world rather than against invented people.
 *
 *   THE TERM      what a watch is worth in the odds breakdown, per wall
 *   WHO STANDS    which of the ties the world actually holds clear the bar
 *   THE COST      what the vigil does to the person standing there
 *   THE ROGUE     whether somebody with no house can be protected
 *
 * Run: npx tsx scripts/probe-what-a-dao-protector-is-worth.ts
 */

import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { computeBreakthroughOdds } from '../src/engine/cultivation/breakthrough.js';
import { rankName, realmForOrdinal } from '../src/engine/cultivation/realms.js';
import {
    foldProtectionIntoOdds,
    protectionBonus,
    protectorWeight,
    standingGuardCost,
    wouldStandGuard,
    type Protector
} from '../src/engine/cultivation/standing-guard-over-somebody-elses-crossing.js';
import type { NpcRecord } from '../src/engine/world/npc-state.js';

const line = (s = '') => console.log(s);
const rule = (t: string) => { line(); line('='.repeat(92)); line('  ' + t); line('='.repeat(92)); };
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const WALLS = [12, 22, 28, 34, 40, 44];

function asSubject(npc: NpcRecord) {
    return {
        realmOrdinal: npc.cultivation.realmOrdinal,
        spiritRoot: npc.cultivation.spiritRoot,
        attributes: npc.cultivation.attributes,
        injuries: npc.cultivation.injuries,
        age: Math.floor((npc.updatedOnDay - npc.identity.bornOnDay) / 365)
    };
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    const seeded = seedWorld({ seed: 'protector-probe', catalog });
    const state = advanceWorldYears(seeded.state, 200, { pressure: { eventsPerYear: 1.2 } }).state;
    const alive = state.npcs.filter(n => n.status === 'alive');
    const byId = new Map(state.npcs.map(n => [n.id, n]));

    line(`seed protector-probe, advanced 200 years, ${alive.length} living`);

    // ── THE TERM ──────────────────────────────────────────────────────────
    rule('THE TERM, PER WALL');
    line('  wall                                        alone   +1 level   +3 level   +1 one realm down');
    for (const ordinal of WALLS) {
        const subject = {
            realmOrdinal: ordinal,
            spiritRoot: 'single_metal' as const,
            attributes: { might: 2, insight: 2, fortune: 2, charm: 2 },
            injuries: []
        };
        const base = computeBreakthroughOdds(subject, { ambient: 'normal', pill: null, manualQuality: null });
        const guard = (n: number, ord: number): { protectors: Protector[] } => ({
            protectors: Array.from({ length: n }, (_, i) => ({
                id: `g${i}`, name: `Guard ${i}`, realmOrdinal: ord, standing: 1
            }))
        });
        const below = Math.max(0, realmForOrdinal(ordinal).ordinalStart - 1);
        const one = foldProtectionIntoOdds(base, guard(1, ordinal), ordinal);
        const three = foldProtectionIntoOdds(base, guard(3, ordinal), ordinal);
        const lower = foldProtectionIntoOdds(base, guard(1, below), ordinal);
        line(
            `  ${rankName(ordinal).padEnd(38)}${pct(base.finalChance).padStart(6)}` +
            `${pct(one.finalChance).padStart(11)}${pct(three.finalChance).padStart(11)}` +
            `${pct(lower.finalChance).padStart(19)}`
        );
    }

    line();
    line('  The breakdown, for one wall, in full:');
    const at44 = computeBreakthroughOdds(
        {
            realmOrdinal: 44, spiritRoot: 'single_metal',
            attributes: { might: 3, insight: 4, fortune: 2, charm: 2 }, injuries: []
        },
        { ambient: 'normal', pill: null, manualQuality: null }
    );
    const watched = foldProtectionIntoOdds(at44, {
        protectors: [
            { id: 'a', name: 'Second Seat', realmOrdinal: 44, standing: 0.8 },
            { id: 'b', name: 'Third Seat', realmOrdinal: 43, standing: 0.8 },
            { id: 'c', name: 'Fourth Seat', realmOrdinal: 42, standing: 0.8 }
        ]
    }, 44);
    for (const m of watched.modifiers) {
        line(`    ${m.source.padEnd(52)} ${(m.delta >= 0 ? '+' : '') + m.delta.toFixed(4)}`);
    }
    line(`    ${'FINAL'.padEnd(52)} ${watched.finalChance.toFixed(4)}`);

    // ── WHO STANDS ────────────────────────────────────────────────────────
    rule('WHO STANDS, OUT OF THE TIES THE WORLD ACTUALLY HOLDS');
    for (const ordinal of WALLS) {
        const candidates = alive.filter(n => n.cultivation.realmOrdinal === ordinal);
        if (candidates.length === 0) continue;
        let asked = 0, couldMatter = 0, willing = 0;
        const reasons = new Map<string, number>();
        const kinds = new Map<string, number>();
        for (const subject of candidates) {
            for (const tie of subject.relationships) {
                const other = byId.get(tie.targetId);
                if (!other || other.status !== 'alive') continue;
                asked++;
                const protector: Protector = {
                    id: other.id, name: other.name,
                    realmOrdinal: other.cultivation.realmOrdinal,
                    standing: tie.standing
                };
                if (protectorWeight(protector.realmOrdinal, ordinal) > 0) couldMatter++;
                const answer = wouldStandGuard(protector, ordinal);
                if (answer.willing) {
                    willing++;
                    kinds.set(tie.kind, (kinds.get(tie.kind) ?? 0) + 1);
                } else {
                    reasons.set(answer.reason!, (reasons.get(answer.reason!) ?? 0) + 1);
                }
            }
        }
        if (asked === 0) continue;
        const bar = wouldStandGuard(
            { id: 'x', name: 'x', realmOrdinal: ordinal, standing: 1 }, ordinal);
        line(
            `  ${rankName(ordinal).padEnd(38)} ${candidates.length} people, ${asked} living ties: ` +
            `${couldMatter} could matter, ${willing} would stand ` +
            `(bar ${bar.standingRequired.toFixed(2)})`
        );
        if (kinds.size > 0) {
            line(`      who: ${[...kinds].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ')}`);
        }
        if (reasons.size > 0) {
            line(`      refused: ${[...reasons].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ')}`);
        }
    }

    // ── THE COST ──────────────────────────────────────────────────────────
    rule('WHAT IT COSTS THE PERSON STANDING THERE');
    line('  wall                                  protector       vigil risk   wound   owed');
    for (const ordinal of WALLS) {
        for (const [label, ord] of [['level', ordinal], ['one realm down',
            Math.max(0, realmForOrdinal(ordinal).ordinalStart - 1)]] as const) {
            const cost = standingGuardCost(
                { id: 'p', name: 'p', realmOrdinal: ord as number, standing: 1 },
                ordinal, 365 * 10
            );
            line(
                `  ${rankName(ordinal).padEnd(38)}${String(label).padEnd(16)}` +
                `${pct(cost.woundChance).padStart(8)}${cost.woundSeverity.padStart(12)}` +
                `${('+' + cost.obligation.standingGain.toFixed(2)).padStart(8)}`
            );
        }
    }

    // ── THE ROGUE ─────────────────────────────────────────────────────────
    rule('CAN SOMEBODY WITH NO HOUSE BE PROTECTED');
    const rogues = alive.filter(n => n.factionId === null && n.cultivation.realmOrdinal >= 12);
    let roguesWithAWatch = 0;
    let housedWithAWatch = 0;
    const housed = alive.filter(n => n.factionId !== null && n.cultivation.realmOrdinal >= 12);
    const hasWatch = (subject: NpcRecord): Protector[] =>
        subject.relationships
            .map(tie => {
                const other = byId.get(tie.targetId);
                if (!other || other.status !== 'alive') return null;
                return {
                    id: other.id, name: other.name,
                    realmOrdinal: other.cultivation.realmOrdinal, standing: tie.standing
                };
            })
            .filter((p): p is Protector => p !== null)
            .filter(p => wouldStandGuard(p, subject.cultivation.realmOrdinal).willing);
    for (const r of rogues) if (hasWatch(r).length > 0) roguesWithAWatch++;
    for (const h of housed) if (hasWatch(h).length > 0) housedWithAWatch++;
    line(`  rogues at ordinal 12+   ${rogues.length}, of whom ${roguesWithAWatch} could raise a watch`);
    line(`  housed at ordinal 12+   ${housed.length}, of whom ${housedWithAWatch} could raise a watch`);

    const example = [...rogues, ...housed].find(n => hasWatch(n).length > 0);
    if (example) {
        const watch = { protectors: hasWatch(example) };
        line();
        line(`  ${example.name}, ${rankName(example.cultivation.realmOrdinal)}, ` +
            `${example.factionId ?? 'no house'}`);
        for (const p of watch.protectors) {
            const tie = example.relationships.find(r => r.targetId === p.id)!;
            line(`    ${p.name} (${rankName(p.realmOrdinal)}) - ${tie.kind} at ${tie.standing.toFixed(2)}: "${tie.note}"`);
        }
        const base = computeBreakthroughOdds(asSubject(example),
            { ambient: 'normal', pill: null, manualQuality: null });
        const withWatch = foldProtectionIntoOdds(base, watch, example.cultivation.realmOrdinal);
        line(`    alone ${pct(base.finalChance)} -> watched ${pct(withWatch.finalChance)} ` +
            `(+${protectionBonus(watch, example.cultivation.realmOrdinal).toFixed(4)})`);
    }
}

main().catch(err => { console.error(err); process.exit(1); });
