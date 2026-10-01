/** The played surfaces for a body's neighbourhood, elemental stays and the Lid. */
import type { Cultivator, Run } from '../schema/cultivation.js';
import { grantsHeldWith } from '../engine/world/capability.js';
import { brokenStatusesOn } from '../engine/cultivation/what-goes-wrong-at-a-realm-boundary.js';
import { elementalTolerance } from '../engine/world/elemental-tolerance.js';
import { makeElementalWork, expressedElement, neighbourhoodRate } from '../engine/world/elemental-neighbourhood.js';
import { readJsonFlag, writeFlag, listCarriedArtifacts, removeFromPouch } from '../server/consolidated/cultivation-support.js';
import { getArtifact } from '../data/cultivation/artifacts.js';
import { makeObject, transferPossession } from '../engine/world/possessions.js';
import { evaluateLayerCrossing, IMMORTAL_LAYER } from '../engine/world/layers.js';
import { ensureImmortalLayer } from '../engine/world/immortal-world.js';
import { factsForToolResult } from './facts.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

const STAY = 'elemental_stay';
interface Stay { placeId: string | null; enteredOnDay: number }

export function trackElementalStay(game: GameService, me: Cultivator, run: Run): void {
    const here = game.worldPlaceOf(me);
    const place = game.atHand?.locations.find(l => l.id === here);
    const placeId = place && elementalTolerance(me.realmOrdinal, me.injuries, place) !== null ? here : null;
    const old = readJsonFlag<Stay>(game.db, me.id, STAY);
    if (!old && placeId === null) return;
    if (old?.placeId !== placeId) game.db.transaction(() => writeFlag(game.db, me.id, STAY,
        JSON.stringify({ placeId, enteredOnDay: run.elapsedDays })))();
}

export function elementalHostility(game: GameService, me: Cultivator) {
    const place = game.atHand?.locations.find(l => l.id === game.worldPlaceOf(me));
    if (!place) return undefined;
    const tolerance = elementalTolerance(me.realmOrdinal, me.injuries, place);
    if (tolerance === null || tolerance === Infinity) return undefined;
    const run = game.currentRun().run;
    const stay = readJsonFlag<Stay>(game.db, me.id, STAY);
    const spent = stay?.placeId === place.id ? run.elapsedDays - stay.enteredOnDay : 0;
    return { dailyHpFraction: 0.1, inert: false,
        safeDays: Math.max(0, tolerance - spent), reason: `The ${place.hazards.join(', ')} exceeds your body's tolerance.` };
}

export function nearbyPracticeRate(game: GameService, me: Cultivator): number {
    if (!game.atHand) return 1;
    const ids = new Set(game.present(me).map(p => p.id));
    return neighbourhoodRate(me, game.atHand.npcs.filter(n => ids.has(n.id)), me.id, game.atHand.currentDay);
}

export function summitObservations(game: GameService, me: Cultivator): string[] {
    const grants = grantsHeldWith(me.realmOrdinal, brokenStatusesOn(me.injuries));
    const lines: string[] = [];
    if (grants.includes('reads_lid')) lines.push('You perceive the Lid and its seams above this ground.');
    const rate = nearbyPracticeRate(game, me);
    if (rate < 1) lines.push('The presence nearby slows your circulation.');
    if (rate > 1) lines.push('The matching element nearby increases what your practice draws.');
    const hostility = elementalHostility(game, me);
    if (hostility) lines.push(`Your body has ${hostility.safeDays} days of tolerance left here.`);
    const placeId = game.worldPlaceOf(me);
    for (const row of game.atHand?.objects ?? []) if (row.locationId === placeId
        && row.tags.includes('elemental-work') && !row.tags.includes('ruined')
        && (row.data.expiresOnDay === null || Number(row.data.expiresOnDay) > game.atHand!.currentDay)) {
        lines.push(`${row.name} stands on this ground.`);
    }
    return lines;
}

export function craftElementalWork(game: GameService, run: Run, me: Cultivator, target: string | undefined): Execution | null {
    if (!/\belemental\s+(?:work|working|creation)\b/i.test(target ?? '')) return null;
    const element = expressedElement(me.knownTechniques);
    const placeId = game.worldPlaceOf(me);
    const work = element && placeId ? makeElementalWork({ id: `elemental-work:${me.id}:${run.turn}`,
        makerId: me.id, makerName: me.name, locationId: placeId, ordinal: me.realmOrdinal,
        injuries: me.injuries, element, onDay: game.atHand!.currentDay }) : null;
    if (!work) {
        const out = game.freeAction(run, 'craft', factsForToolResult('No elemental work formed.',
            ['Grand Ascension and an elemental art are needed to leave a working on this ground.']));
        out.outcome = 'refused';
        return out;
    }
    game.atHand!.objects.push(work);
    game.theWorldMoved();
    game.repos.runs.incrementTurn(run.id, 0);
    return { facts: factsForToolResult('An elemental work formed.', [
        `${work.name} stands on this ground.`, work.data.expiresOnDay === null
            ? 'It remains after you leave.' : 'The incomplete working lasts one year.'
    ]), events: [], timeSkip: null, breakthrough: null, outcome: 'executed',
        calls: [{ name: 'engine.makeElementalWork', action: 'craft', summary: work.id, ok: true }] };
}

/** The object goes up with its holder. The pressure on the far side still applies. */
export function enforceCarriedCeiling(game: GameService, run: Run, me: Cultivator): Execution | null {
    const world = game.atHand;
    if (!world || world.locations.find(l => l.id === game.worldPlaceOf(me))?.layer === IMMORTAL_LAYER) return null;
    const forbidden = world.objects.filter(o => o.possessorId === me.id && o.kind !== 'manual'
        && !o.tags.includes('ruined') && !evaluateLayerCrossing({ subject: 'object', direction: 'down', ordinal: me.realmOrdinal, power: o.power }).permitted);
    const pouch = listCarriedArtifacts(game.db, me.id).filter(p => {
        const object = getArtifact(p.itemId);
        return object && !evaluateLayerCrossing({ subject: 'object', direction: 'down',
            ordinal: me.realmOrdinal, power: object.power }).permitted;
    });
    if (!forbidden.length && !pouch.length) return null;
    const landing = ensureImmortalLayer(world).landingLocationId;
    for (const p of pouch) {
        const art = getArtifact(p.itemId)!;
        removeFromPouch(game.db, me.id, p.itemId, p.quantity);
        let object = world.objects.find(o => o.id === art.id && !o.tags.includes('ruined'));
        if (object) {
            const moved = transferPossession(object, { toHolderId: me.id, toHolderName: me.name,
                onDay: world.currentDay, how: 'gifted', source: 'carried through the Lid', transfersOwnership: false });
            Object.assign(object, moved);
        } else {
            object = makeObject({ id: art.id, name: art.name, kind: 'artifact', power: art.power,
                significance: art.significance, possessorId: me.id, locationId: landing });
            world.objects.push(object);
        }
        if (!forbidden.some(o => o.id === object!.id)) forbidden.push(object);
    }
    const verdict = evaluateLayerCrossing({ subject: 'person', direction: 'up', ordinal: me.realmOrdinal });
    const place = world.locations.find(l => l.id === landing)!;
    game.repos.cultivators.update(me.id, { location: place.name });
    if (!verdict.permitted) {
        for (const object of forbidden) {
            Object.assign(object, transferPossession(object, { toHolderId: null, toHolderName: 'nobody',
                onDay: world.currentDay, how: 'lost', source: place.name, transfersOwnership: false }));
            object.locationId = landing;
        }
        game.repos.cultivators.markDead(me.id, 'obviously_fatal_choice', run.turn + 1,
            'The carried object forced its holder through the Lid. The pressure ended the body and soul.');
    } else for (const object of forbidden) object.locationId = null;
    const row = world.npcs.find(n => n.id === me.id);
    if (row) { row.layer = IMMORTAL_LAYER; row.locationId = landing; }
    game.theWorldMoved();
    return { facts: factsForToolResult('The carried object forced you through the Lid.', [
        `${forbidden.map(o => o.name).join(', ')} carried you through the Lid.`,
        verdict.permitted ? 'You are on the far side.' : 'The pressure on the far side ended your body and soul.'
    ]), events: [], timeSkip: null, breakthrough: null, outcome: 'executed',
        calls: [{ name: 'engine.evaluateLayerCrossing', action: 'carried_ceiling', summary: verdict.detail, ok: true }] };
}
