/**
 * Mending a thing you hold that has been holed: the `craft` verb's third half.
 *
 * The owner: items have durability, of the partial-damage kind, and *"every
 * player is an artisan"*. A thing holed in a fight or a siege stands a rung
 * under what it was made at until a hand at that rung closes the hole. The
 * rule is `mend` in `object-damage.ts` (the rung gate is `canUnmake`, the same
 * one that decides who can break it) and nothing here decides it; this file
 * finds the thing, spends the days and writes the row.
 *
 * THE DAYS are what making a thing of that grade takes this hand
 * (`daysAtTheWork`), for one hole. THE MATERIAL is one piece that fills the
 * first slot of its grade's recipe (`whatMendingAHoleTakes`), off their own
 * bench, taken when the hole is closed and checked before a day is spent.
 */

import type { Cultivator, Run } from '../schema/cultivation.js';
import { theGradeItWasMadeAt } from '../engine/world/a-house-mends-what-it-owns.js';
import {
    whatMendingAHoleTakes,
    whatTheRecipeSpends,
    whatWouldFill
} from '../data/cultivation/what-an-artifact-is-made-of.js';
import { takeWhatTheRecipeNames } from './taking-the-materials-off-the-bench.js';
import { theIdsOnTheBench, whatThisPersonHasOnTheBench } from './what-is-on-the-bench.js';
import { daysAtTheWork } from '../engine/social-leverage/commissioning-a-craft.js';
import { isHoled, mend, theConditionItIsIn } from '../engine/world/object-damage.js';
import { factsForRefusal, factsForToolResult } from './facts.js';
import { whatIsWithinReachOf, whichThingTheyMeant, type WithinReach } from './object-theft.js';
import { isRuined } from '../engine/world/possessions.js';
import { listCarriedArtifacts } from '../server/consolidated/cultivation-support.js';
import { refused } from './tool-result-prose.js';
import { BENCH_FOCUS } from './turn-constants.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';
import { MENDING_WORDS } from './mending-phrasings.js';

export async function mendingAThingYouHold(
    service: GameService,
    run: Run,
    cultivator: Cultivator,
    said: string
): Promise<Execution> {
    service.atHand = service.atHand ?? await service.loadWorld();
    const world = service.atHand;
    const reach = whatIsWithinReachOf(world, cultivator.id, service.worldPlaceOf(cultivator));
    // A pouch artifact the world keeps a row for is that row, and it is on them.
    const inThePouch = new Set(listCarriedArtifacts(service.db, cultivator.id).map(entry => entry.itemId));
    const within: WithinReach[] = [
        ...reach,
        ...(world?.objects ?? [])
            .filter(object => inThePouch.has(object.id) && !isRuined(object)
                && !reach.some(row => row.object.id === object.id))
            .map(object => ({ object, because: 'carried' as const }))
    ];
    const holed = within.filter(row => isHoled(row.object));
    const named = said.replace(MENDING_WORDS, '').trim();

    // A sentence naming nothing in particular reaches the one holed thing,
    // where there is exactly one.
    const found = (named.length >= 2 && !/^(?:it|this|that|them)$/i.test(named)
        ? whichThingTheyMeant(within, named)
        : holed.length === 1 ? holed[0]! : null)?.object ?? null;
    if (!found) {
        return refused('engine.whichThingIsHoled', 'craft', factsForRefusal(
            named.length >= 2 ? `Nothing of yours is called ${named}.` : 'Nothing named.',
            holed.length > 0
                ? `What you have that is holed: ${holed.map(row =>
                    `${row.object.name}, ${theConditionItIsIn(row.object)}`).join('; ')}.`
                : 'Nothing you have on you is holed.',
            `mend: "${said}" against ${within.length} tracked row(s), ${holed.length} holed.`
        ));
    }

    // The gate, asked before a day is spent: `mend` is pure and says no with the bar.
    const onDay = Math.floor(run.elapsedDays);
    const asked = mend(found, {
        byOrdinal: cultivator.realmOrdinal, onDay, byId: cultivator.id, byName: cultivator.name
    });
    if (!asked.mended) {
        return refused('object-damage.mend', 'craft', factsForRefusal(
            `${found.name} is not mended.`, asked.account,
            `mend: ${found.id} refused at ordinal ${cultivator.realmOrdinal}.`
        ));
    }

    const grade = theGradeItWasMadeAt(found);
    const recipe = whatMendingAHoleTakes(grade);
    const bench = whatThisPersonHasOnTheBench(service.db, world?.objects ?? [], cultivator.id);
    if (whatTheRecipeSpends(grade, theIdsOnTheBench(bench), recipe) === null) {
        const slot = recipe![0]!;
        const would = whatWouldFill(slot).slice(0, 4).map(row => row.name);
        return refused('object-damage.mendingTakesMaterial', 'craft', factsForRefusal(
            `${found.name} is not mended.`,
            `Closing a hole in ${grade}-grade work takes ${slot.what}, and you carry none. `
            + `${would.join(', ')} would each do.`,
            `mend: ${found.id} at ${grade} grade wants one of ${slot.what}; bench held ${bench.length} piece(s).`
        ));
    }
    const days = daysAtTheWork(grade, cultivator.realmOrdinal);
    const spent = await service.shortSkip(
        run, cultivator, service.ambientFor(cultivator, run), BENCH_FOCUS,
        `Mending ${found.name}`, days
    );
    const after = service.repos.cultivators.getById(cultivator.id) ?? cultivator;
    const lived = spent.timeSkip?.simulatedDays ?? days;

    // The world as the days left it: the row is read again, because the span
    // may have handed back a different state.
    service.atHand = service.atHand ?? await service.loadWorld();
    const rows = service.atHand?.objects ?? [];
    const at = rows.findIndex(o => o.id === found.id);
    if (!after.alive || lived < days || at < 0) {
        const facts = factsForToolResult('The mending stops before it is done.',
            [...spent.facts.lines, `${found.name} is as it was.`]);
        facts.structure.push(`mend: ${lived} of ${days} day(s); nothing written.`);
        return { facts, events: spent.events, timeSkip: spent.timeSkip, breakthrough: null, outcome: 'executed', calls: spent.calls };
    }
    const today = Math.floor(service.repos.runs.getById(run.id)?.elapsedDays ?? onDay + days);
    let done = mend(rows[at]!, { byOrdinal: after.realmOrdinal, onDay: today, byId: after.id, byName: after.name });
    // The material comes off when the hole is closed, and not before.
    const paid = done.mended
        ? takeWhatTheRecipeNames({
            db: service.db,
            objects: rows,
            grade,
            bench: whatThisPersonHasOnTheBench(service.db, rows, after.id),
            onDay: today,
            intoWhat: `mending ${found.name}`,
            recipe
        })
        : null;
    if (done.mended && paid === null) {
        done = { ...done, mended: false, account: `What the mending needed is not on you any more. ${found.name} is as it was.` };
    }
    if (done.mended) {
        rows[at] = done.row;
        service.theWorldMoved();
    }
    const facts = factsForToolResult(`${found.name}: ${done.mended ? 'mended' : 'not mended'}.`, [
        ...spent.facts.lines,
        `${days} day${days === 1 ? '' : 's'} at the work.`,
        ...(paid?.lines ?? []),
        done.account
    ]);
    facts.structure.push(
        `mend: ${found.id}, daysAtTheWork(${grade}, ordinal ${cultivator.realmOrdinal}) `
        + `= ${days}. ${done.account}`,
        ...(paid?.structure ?? [])
    );
    facts.required = [done.account];
    return { facts, events: spent.events, timeSkip: spent.timeSkip, breakthrough: null, outcome: 'executed', calls: spent.calls };
}
