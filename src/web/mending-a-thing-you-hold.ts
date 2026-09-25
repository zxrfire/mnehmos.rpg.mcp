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
 * (`daysAtTheWork`), for one hole. Mending is the work, not new material.
 */

import type { Cultivator, Run } from '../schema/cultivation.js';
import { gradeForOrdinal } from '../data/cultivation/techniques.js';
import { daysAtTheWork } from '../engine/social-leverage/commissioning-a-craft.js';
import { isHoled, mend, ratedWhole, theConditionItIsIn } from '../engine/world/object-damage.js';
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

    const whole = ratedWhole(found) ?? found.power ?? 0;
    const days = daysAtTheWork(gradeForOrdinal(whole), cultivator.realmOrdinal);
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
    const done = mend(rows[at]!, {
        byOrdinal: after.realmOrdinal,
        onDay: Math.floor(service.repos.runs.getById(run.id)?.elapsedDays ?? onDay + days),
        byId: after.id,
        byName: after.name
    });
    if (done.mended) {
        rows[at] = done.row;
        service.theWorldMoved();
    }
    const facts = factsForToolResult(`${found.name}: ${done.mended ? 'mended' : 'not mended'}.`, [
        ...spent.facts.lines,
        `${days} day${days === 1 ? '' : 's'} at the work.`,
        done.account
    ]);
    facts.structure.push(
        `mend: ${found.id}, daysAtTheWork(${gradeForOrdinal(whole)}, ordinal ${cultivator.realmOrdinal}) `
        + `= ${days}. ${done.account}`
    );
    facts.required = [done.account];
    return { facts, events: spent.events, timeSkip: spent.timeSkip, breakthrough: null, outcome: 'executed', calls: spent.calls };
}
