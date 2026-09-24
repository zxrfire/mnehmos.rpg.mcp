/**
 * HOW A VEIN CHANGES HANDS, AND HOW OFTEN EACH WAY DOES IT.
 *
 * The design owner, on the annual rival-transfer: *"annual transfer is too soon,
 * this should be a world shaking event."* It is going. This measures what the
 * world has left when it does.
 *
 * Three paths move a vein and all three are event-shaped, which is what the
 * design describes:
 *
 *   conquered   a house sends people, the sending finishes, the place passes
 *   abandoned   a house stops holding it and control goes to nobody
 *   the grant   a patron does not renew, and takes it back
 *
 * `governance-and-water-rights.ts` states the principle they share: an apex's
 * power is measured *"because a grant is only worth something if the granter can
 * take it back: authority over a vein has to be enforceable, or it is a letter."*
 * Control is held on somebody's authority and moves when that authority moves.
 *
 * THE QUESTION THIS ANSWERS, and it must be answered BEFORE the deletion rather
 * than after: if the three real paths almost never fire, removing the fourth
 * leaves veins nearly static - which is very likely why somebody added it. A
 * deletion that silently freezes the most consequential thing in the world is a
 * worse defect than the oscillator it removes.
 *
 * ── WHY IT READS THE CHANGE LOG AND NOT THE EVENTS ───────────────────────
 *
 * `conquered` and `abandoned` are LOCATION CHANGE kinds, not pressure event
 * kinds: `applyLocationChange` appends them to the row's own `changes`. An event
 * walk cannot see them, which is the third shape named in
 * `how-a-mechanism-spreads.probe.ts` - a mechanism that acts without emitting an
 * event. So this reads what the rows themselves record, which is the only place
 * all three paths meet.
 *
 * ── WHAT IT REPORTS ──────────────────────────────────────────────────────
 *
 * Per change kind, on vein rows only: how many, across how many distinct veins,
 * and across how many distinct houses received them. A count without a spread
 * would repeat the mistake this whole line of work exists to correct - 120
 * transfers looked like a busy world until somebody asked whose.
 *
 *     npx vitest run --config vitest.probe.config.ts scripts/how-a-vein-changes-hands.probe.ts
 *
 * Name the file: that config's include is the whole of `scripts`.
 */

import { describe, it } from 'vitest';

import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldForPlay } from '../src/engine/world/driver.js';

const SEEDS = (process.env.VEIN_SEEDS ?? 'vein-a,vein-b').split(',');
const YEARS = Number(process.env.VEIN_YEARS ?? 500);

describe('how a vein changes hands', () => {
    it('counts each path, its spread, and what losing one does to the loser', async () => {
        const catalog = await loadCultivationCatalog();
        for (const seed of SEEDS) {
            const { state } = seedWorld({ seed, catalog });
            const veinIds = new Set(state.locations.filter(l => l.kind === 'vein').map(l => l.id));
            const holderOf = () => new Map(
                state.locations.filter(l => veinIds.has(l.id)).map(l => [l.id, l.controllingFactionId ?? null])
            );
            const rollOf = (id: string) =>
                state.npcs.filter(n => n.status === 'alive' && n.factionId === id).length;

            /** Every loss, caught the year it happened. */
            const losses: { day: number; veinId: string; loserId: string; rollAtLoss: number; veinsLeft: number }[] = [];
            let before = holderOf();

            for (let y = 0; y < YEARS; y++) {
                const from = state.currentDay;
                advanceWorldForPlay(state, { days: 365, stopOnInterrupt: false });
                const after = holderOf();
                for (const [veinId, who] of before) {
                    const now = after.get(veinId) ?? null;
                    if (now === who || who === null) continue;
                    losses.push({
                        day: from,
                        veinId,
                        loserId: who,
                        rollAtLoss: rollOf(who),
                        veinsLeft: [...after.values()].filter(v => v === who).length
                    });
                }
                before = after;
            }

            // ── THE PATHS, off the rows' own change log ──────────────────
            const byKind = new Map<string, { count: number; rows: Set<string>; holders: Set<string> }>();
            for (const row of state.locations) {
                if (!veinIds.has(row.id)) continue;
                for (const change of row.changes) {
                    const seen = byKind.get(change.kind)
                        ?? { count: 0, rows: new Set<string>(), holders: new Set<string>() };
                    seen.count++;
                    seen.rows.add(row.id);
                    const to = (change.patch as { controllingFactionId?: string | null } | undefined)
                        ?.controllingFactionId;
                    if (typeof to === 'string') seen.holders.add(to);
                    byKind.set(change.kind, seen);
                }
            }

            // eslint-disable-next-line no-console
            console.log(`
${seed}: ${veinIds.size} veins, ${YEARS} years, ${state.factions.length} houses`);
            for (const [kind, seen] of [...byKind.entries()].sort((a, b) => b[1].count - a[1].count)) {
                // eslint-disable-next-line no-console
                console.log(
                    `  ${kind.padEnd(12)} ${String(seen.count).padStart(4)} changes  `
                    + `${seen.rows.size} of ${veinIds.size} veins  ${seen.holders.size} distinct holders`
                );
            }
            if (byKind.size === 0) {
                // eslint-disable-next-line no-console
                console.log('  no vein changed hands by any path');
            }

            // ── AND WHAT IT DID TO THE HOUSE THAT LOST ONE ──────────────
            //
            // The owner: *"losing a vein is almost the end of a house."* So the
            // question is not only how often a vein moves but whether the loss
            // means anything afterwards. A house that loses the thing that makes
            // its cultivators and carries on unchanged is a transfer that is
            // weightless in both directions.
            // eslint-disable-next-line no-console
            console.log(`  losses caught: ${losses.length}`);
            for (const loss of losses.slice(0, 8)) {
                const alive = state.factions.some(f => f.id === loss.loserId);
                // eslint-disable-next-line no-console
                console.log(
                    `    day ${loss.day} ${loss.loserId} lost ${loss.veinId}: roll ${loss.rollAtLoss} at the loss, `
                    + `${alive ? rollOf(loss.loserId) : 0} now, ${loss.veinsLeft} veins left, `
                    + `${alive ? 'still standing' : 'GONE'}`
                );
            }
        }
        // eslint-disable-next-line no-console
        console.log(
            '\nRead the spread beside the count, and the consequence beside both. A path that'
            + '\nfires often on one vein between two houses is the defect this started from; a'
            + '\nhouse whose roll is unchanged a century after losing its vein is the other half.'
        );
    }, 6 * 60 * 60_000);
});
