/**
 * HOW OFTEN, AND ON WHOM.
 *
 * A total says a mechanism fires. Only a distribution says it happens to the
 * world. 120 transfers among three houses is a different world from 120 across
 * forty, and no aggregate can tell you which.
 *
 * This is the second of the two questions `AGENTS.md` names under *How often,
 * and on whom*. `probe-which-passes-ever-fire.probe.ts` answers the first: does
 * this mechanism ever act at all. This one answers the second: when it acts,
 * across how much of the world does it spread. The two defects they catch are
 * the same defect wearing opposite clothes.
 *
 *   INERT       chosen: 0. The mechanism runs every year and acts on nobody.
 *   DEGENERATE  chosen: 120, distinct: 1. It acts every year, on one edge, for
 *               ever, while the rest of the world never sees it.
 *
 * Both run. Both write. Both look alive from the code, and every static check in
 * this repo passes on both.
 *
 * ── WHAT IT CANNOT SEE, WHICH IS A THIRD SHAPE ───────────────────────────
 *
 * It observes what fired from the EVENTS a span returns. A mechanism that acts
 * without emitting an event is invisible to it and will read as inert here
 * while changing the world every year - so a clean report from this probe is
 * not a clean bill of health, it is a clean bill for everything that reports
 * itself. Rewrites in place, standing nudged, a row quietly re-pointed: none of
 * those arrive as events and none of them are counted below.
 *
 * ── IT IS NOT A TEST AND MUST NOT BECOME ONE ─────────────────────────────
 *
 * The first instinct of the next person will be to wire this into the suite.
 * Do not. A world's distribution moves with its seed and its population, and a
 * gate that fails on a world's mood is a gate people learn to override. It
 * lives outside `vitest.config.ts`'s glob for the same reason the passes probe
 * does: it is an instrument somebody runs deliberately and reads.
 *
 *     npx vitest run --config vitest.probe.config.ts scripts/how-a-mechanism-spreads.probe.ts
 *
 * NAME THE FILE, because that config's include is the whole of `scripts`, and
 * running it bare runs every probe in the tree including one built to walk
 * fifteen centuries.
 *
 * ── WHERE THE LIST OF MECHANISMS COMES FROM, AND WHICH OF TWO LISTS ──────
 *
 * `pressureTemplates()`, which is the table itself rather than a copy of it. A
 * list maintained beside a checker drifts and then agrees with itself, which is
 * the defect the passes probe has and the reason this one does not repeat it.
 *
 * THERE ARE TWO LISTS AND THEY ANSWER DIFFERENT QUESTIONS. `pressureTemplates()`
 * is what is WIRED: the kinds that have a template behind them. The union
 * `PressureKind` is what was PROMISED: every kind the type says exists, wired or
 * not. They are one word apart and they give opposite answers on the case that
 * matters, because a kind declared with no template behind it is exactly the
 * defect somebody is hunting - and enumerating from the seam reports all clear
 * on it.
 *
 * THIS PROBE WALKS THE WIRED LIST, on purpose: it measures the spread of things
 * that FIRE, and a kind with no template fires nothing and has no distribution
 * to report. A walk that asks which promised kinds have nothing behind them is a
 * different instrument and should read the declaration at run time instead - see
 * the event-kind walk, which does, and throws if the declaration is not where it
 * looks so that it cannot go quietly short.
 *
 * Point this one at the declaration and it reports noise; point that one at the
 * seam and it reports silence.
 *
 * ── THE ANSWERS THIS WAS TESTED AGAINST, WRITTEN DOWN BEFORE IT RAN ──────
 *
 * A checker that has only ever been run on unknowns has not been tested, it has
 * been trusted. So the expected answers were recorded first, and they test both
 * ends of the instrument:
 *
 *   DEGENERATE  `vein_lost` must come back on ONE PLACE and TWO HOUSES.
 *               Measured by hand: 120 transfers in 120 years, all on one vein,
 *               alternating between the same two houses, the other veins never
 *               moving. If this probe reports it spread across many, the probe
 *               is wrong.
 *
 *               AND THE HAND MEASUREMENT WAS ON THE FIXTURE CATALOG, which is
 *               the catalog `driver.test.ts` seeds with and not the one that
 *               ships. This probe loads the real catalog, where the same kind
 *               fired ONCE across three worlds and 200 years each. Both numbers
 *               are right and they are about different worlds: a fixture holding
 *               three veins and a handful of houses has exactly one pair hostile
 *               enough to contest, and the pass runs on that pair for ever. Say
 *               which catalog any figure came from, or the two will be argued
 *               against each other.
 *   SILENT      `overdue` and `technique_lost` must come back having emitted
 *               nothing. Measured over 1,000 years across two seeds by the
 *               event-kind walk.
 *
 * `technique_lost` is the one worth having. It is NAMED IN THREE SOURCE FILES -
 * the history module, the world pass, and what people are saying - so every
 * static reading of this tree says it is wired, and it never fires. A search
 * would have cleared it. A probe that reports it silent agrees with the world
 * against the whole static picture, which is a stronger pass than agreeing with
 * a grep. `overdue` is the easy half: declared, named only where it is declared,
 * never written, and a grep finds that on its own.
 *
 * WHAT WAS DELIBERATELY NOT USED AS A CASE: the four passes an event walk
 * reported inert. Three of them write rows, ties and obligations and never a
 * fact, so they read as zero whether this probe works or not - a case that
 * cannot tell a working instrument from a broken one tests nothing.
 *
 * ── NO THRESHOLD, ON PURPOSE ─────────────────────────────────────────────
 *
 * Nothing here decides that a share is too high. A bound tuned until today's
 * world passes will pass tomorrow's too, whatever tomorrow's world does. It
 * prints the spread and the top few by share; a reader decides whether one
 * house owning a mechanism is the world or a defect in it.
 */

import { describe, it } from 'vitest';

import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { applyPressure, pressureTemplates } from '../src/engine/world/the-world-changing-on-its-own.js';
import type { PressureEvent } from '../src/engine/world/the-world-changing-on-its-own.js';

const YEAR = 365;
const SEEDS = (process.env.SPREAD_SEEDS ?? 'spread-a,spread-b,spread-c').split(',');
const YEARS = Number(process.env.SPREAD_YEARS ?? 200);

/**
 * Who an event happened TO, as ids.
 *
 * `touched` is the engine's own answer to what an event moved, so this asks the
 * event rather than deciding for it. Factions and locations are the two things a
 * mechanism can concentrate on; people are counted too, because a pass that acts
 * on one person for two centuries is the same defect at a smaller scale.
 */
function whoItLandedOn(event: PressureEvent): { kind: string; ids: string[] }[] {
    return [
        { kind: 'houses', ids: event.touched.factions },
        { kind: 'places', ids: event.touched.locations },
        { kind: 'people', ids: event.touched.npcs }
    ];
}

function share(counts: Map<string, number>, total: number): string {
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id, n]) => `${id} ${Math.round((100 * n) / total)}%`)
        .join(', ');
}

describe('how a mechanism spreads', () => {
    it('reports every pressure kind by count and by spread', async () => {
        const catalog = await loadCultivationCatalog();
        const kinds = pressureTemplates().map(t => t.kind);
        // The derived list has to fail when its source moves. An empty table
        // here would print a clean report about nothing, which is the shape of
        // defect this probe exists to find.
        if (kinds.length === 0) {
            throw new Error('pressureTemplates() returned nothing: the table moved, and this probe is blind.');
        }
        const fired = new Map<string, number>();
        const targets = new Map<string, Map<string, number>>();
        for (const kind of kinds) {
            fired.set(kind, 0);
            targets.set(kind, new Map());
        }

        for (const seed of SEEDS) {
            const { state } = seedWorld({ seed, catalog });
            for (let y = 0; y < YEARS; y++) {
                const from = state.currentDay;
                const out = applyPressure(state, from, from + YEAR);
                for (const event of out.events) {
                    fired.set(event.kind, (fired.get(event.kind) ?? 0) + 1);
                    for (const { kind, ids } of whoItLandedOn(event)) {
                        const key = `${event.kind}|${kind}`;
                        const seen = targets.get(key) ?? new Map<string, number>();
                        for (const id of ids) seen.set(id, (seen.get(id) ?? 0) + 1);
                        targets.set(key, seen);
                    }
                }
            }
        }

        // ── SPREAD IS COUNTED PER TARGET KIND, NOT IN ONE BAG ────────────
        //
        // The first cut merged houses, places and people into a single set, so
        // the number was diluted by the ARITY of the event: a mechanism that
        // always touches one place and two houses read as "3 distinct" and
        // could never look concentrated however degenerate it was. Caught by
        // running it on a known answer - `vein_lost`, measured by hand as one
        // vein between two houses, came back as 3 and the probe was wrong.
        //
        // A merged count answers *how many things were touched*. The question
        // is *how many of each kind*, which is a different question wearing the
        // same number.
        const spread = (kind: string, of: string) =>
            targets.get(`${kind}|${of}`) ?? new Map<string, number>();
        const rows = kinds.map(kind => {
            const count = fired.get(kind) ?? 0;
            const houses = spread(kind, 'houses');
            const places = spread(kind, 'places');
            const people = spread(kind, 'people');
            const widest = Math.max(houses.size, places.size, people.size);
            const narrowest = Math.min(
                ...[houses, places, people].filter(m => m.size > 0).map(m => m.size),
                Number.POSITIVE_INFINITY
            );
            return { kind, count, houses, places, people, widest, narrowest };
        }).sort((a, b) => a.widest - b.widest || b.count - a.count);

        // eslint-disable-next-line no-console
        console.log(`${SEEDS.length} worlds, ${YEARS} years each\n`);
        // eslint-disable-next-line no-console
        console.log('fired  houses  places  people  kind');
        for (const row of rows) {
            const narrow = row.count > 0 && row.narrowest <= 2 && row.narrowest !== Number.POSITIVE_INFINITY;
            const busiest = [...row.houses.entries(), ...row.places.entries()];
            const landings = busiest.reduce((n, [, v]) => n + v, 0);
            // eslint-disable-next-line no-console
            console.log(
                `${String(row.count).padStart(5)}  ${String(row.houses.size).padStart(6)}  `
                + `${String(row.places.size).padStart(6)}  ${String(row.people.size).padStart(6)}  ${row.kind}`
                + (narrow && landings > 0 ? `  <- ${share(new Map(busiest), landings)}` : '')
            );
        }

        const inert = rows.filter(r => r.count === 0).map(r => r.kind);
        const oneEdge = rows
            .filter(r => r.count > 0 && r.narrowest <= 2 && r.narrowest !== Number.POSITIVE_INFINITY)
            .map(r => r.kind);
        // THE HEADING SAYS WHAT WAS MEASURED, NOT WHAT HAPPENED. An event walk
        // on this engine reported four passes as inert and three of them were
        // busy: they write rows, ties, obligations and closures, and never a
        // fact, so anything counting events must report zero for them however
        // much they do. A list headed NEVER FIRED gets read as a census within
        // the hour. This one says what it actually knows.
        // eslint-disable-next-line no-console
        console.log(
            `\nEMITTED NO EVENT (${inert.length}): ${inert.join(', ') || 'none'}`
            + '\n  Not the same as never acted. A mechanism that writes rows, ties or'
            + '\n  obligations and no fact is invisible here while changing the world every'
            + '\n  year. Confirm against the mechanism before calling anything inert.'
            + `\n\nLANDED ON AT MOST TWO THINGS (${oneEdge.length}): ${oneEdge.join(', ') || 'none'}`
            + '\n\nNeither list is a verdict. A mechanism with one target may be correct - some'
            + '\nthings in this world can only happen to one house - and a mechanism with many'
            + '\nmay still be wrong. Read the shares, then read the mechanism.'
        );
    }, 6 * 60 * 60_000);
});
