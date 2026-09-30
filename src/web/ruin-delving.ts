/** Chambers belong to the ruin; the player's position belongs to their sheet. */
import {
    applyLocationChange, evaluateAccess, isOpenOn, nextClosingDay, standingConsequence,
    type LocationRecord
} from '../engine/world/locations.js';
import { resolveOverstay } from '../engine/world/convergence.js';
import {
    ageOf, firstChamberTells, knownAxes, standingOffer, wingsOf, withWings, workWing,
    type RuinWing
} from '../engine/world/provenance.js';
import {
    completeMap, lightBudget, LIGHT_COST_PER_DAY, navigate, noMap, offerPossession,
    routineAt, trueTopology, type SiteMap
} from '../engine/world/ruin-mechanics.js';
import { forStream } from '../engine/cultivation/rng.js';
import { isRuined, transferPossession } from '../engine/world/possessions.js';
import {
    discoverableInsights, integrateInsight, recordAchievement, insightName
} from '../engine/cultivation/understanding.js';
import {
    clearFlag, persistUnderstanding, readJsonFlag, writeFlag
} from '../server/consolidated/cultivation-support.js';
import type { AmbientQi, Cultivator, Run } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';
import type { SiteIntent } from './site-phrasings.js';
import { factsForToolResult } from './facts.js';
import { loosePlaceKey } from './knowledge.js';
import { matchScore, MATCH_THRESHOLD, worldLocationFor } from './entities.js';
import { whatTheStoneworkOfARuinSays } from './ruin-stonework.js';

const POSITION = 'ruin_chamber';
interface ChamberPosition {
    siteId: string;
    chamberId: string;
    enteredOnDay: number;
}

function position(service: GameService, me: Cultivator): ChamberPosition | null {
    const held = readJsonFlag<ChamberPosition>(service.db, me.id, POSITION);
    const site = held && service.atHand?.locations.find(row => row.id === held.siteId);
    return site && loosePlaceKey(site.name) === loosePlaceKey(me.location ?? '') ? held : null;
}

/** Used by ordinary pickup as well as the delve; a shelf behind a door stays there. */
export function ruinChamberHere(service: GameService, me: Cultivator): string | null {
    return position(service, me)?.chamberId ?? null;
}

function looseIn(service: GameService, site: LocationRecord, chamberId: string) {
    return (service.atHand?.objects ?? []).filter(row => !isRuined(row) && row.possessorId === null
        && row.ownerId === null && (row.locationId === site.id || row.locationId === site.name)
        && (row.data.chamberId === chamberId || row.data.chamberId == null && chamberId === wingsOf(site)[0]?.id));
}

/** The current chamber's opportunities feed the ordinary comprehension engine. */
export function ruinComprehensionHere(service: GameService, me: Cultivator): string[] {
    const held = position(service, me);
    const site = held && service.atHand?.locations.find(row => row.id === held.siteId);
    return site ? standingOffer(site, Math.floor(service.atHand!.currentDay)).comprehensible : [];
}

/** Closing the exit does not turn off the ground inside it. */
export function ruinHostilityHere(service: GameService, me: Cultivator) {
    const held = position(service, me);
    const site = held && service.atHand?.locations.find(row => row.id === held.siteId);
    if (!site) return undefined;
    const ground = standingConsequence({ ...site, sealed: false, cycle: null }, { realmOrdinal: me.realmOrdinal });
    return { dailyHpFraction: ground.dailyHpFraction, inert: !ground.canAct, reason: `${site.name} takes` };
}

function say(service: GameService, run: Run, lines: string[], refused = false): Execution {
    const done = service.freeAction(run, 'site', factsForToolResult(lines[0], lines));
    if (refused) done.outcome = 'refused';
    return done;
}

function append(done: Execution, lines: string[]): void {
    done.facts.lines.push(...lines);
    done.facts.prose = [done.facts.prose, ...lines].join('\n');
    (done.facts.required ??= []).push(...lines);
}

function mapFor(service: GameService, me: Cultivator, site: LocationRecord): SiteMap {
    if (knownAxes(site, me).knowsGradient) return completeMap(site, 'your expeditions');
    const held = noMap();
    held.knownChamberIds = wingsOf(site)
        .filter(wing => service.knowledge.isAwareOf(me.id, 'place', wing.id)).map(wing => wing.id);
    if (held.knownChamberIds.length > 0) held.source = 'the chambers you have seen';
    return held;
}

function recordChamber(service: GameService, me: Cultivator, wing: RuinWing, day: number): void {
    service.knowledge.learnIfNew({
        holderId: me.id, kind: 'place', id: wing.id, name: wing.name,
        onDay: day, sourceKind: 'witnessed', sourceNote: 'Walked into the chamber.',
        stance: 'knows', confidence: 1
    });
}

function roomLines(service: GameService, me: Cultivator, site: LocationRecord, wing: RuinWing): string[] {
    const day = Math.floor(service.atHand!.currentDay);
    const lines = [`You are in ${wing.name} of ${site.name}.`];
    if (wing.id === wingsOf(site)[0]?.id) lines.push(firstChamberTells(site).observed);
    const loose = looseIn(service, site, wing.id);
    lines.push(loose.length > 0 ? `Within reach: ${loose.map(row => row.name).join(', ')}.`
        : 'No loose objects are within reach.');
    if (ageOf(site, day) !== 'new' && site.hazards.includes('formation')) {
        const routine = routineAt(site, day).find(row => row.chamberId === wing.id);
        if (routine) lines.push(`${routine.doing}.`, ...(routine.occupied
            ? [Number.isFinite(routine.clearOnDay)
                ? `The round clears this chamber in ${routine.clearOnDay - day} days.`
                : 'The round stays in this chamber.'] : []));
    }
    // The doors are visible; their destinations are not.
    const doors = trueTopology(site).find(row => row.id === wing.id)?.exits.length ?? 0;
    lines.push(`${doors} passage${doors === 1 ? '' : 's'} leave this chamber. The fog hides their destinations.`);
    const map = mapFor(service, me, site);
    const named = wingsOf(site).filter(row => map.knownChamberIds.includes(row.id));
    if (named.length > 0) lines.push(`Your notes name ${named.map(row => row.name).join(', ')}. They record no routes.`);
    for (const row of named) service.nameWhatTheyGot(row.name);
    if (site.environment.climate === 'sunless') {
        const budget = lightBudget({ qi: me.qi, maxQi: me.maxQi, depthDays: wing.depthDays });
        lines.push(`Your qi covers ${budget.daysOfLight} days of light. A round trip to this depth takes `
            + `${Math.round(budget.shareForRoundTrip * 100)} per cent of a full pool.`);
    }
    return lines;
}

function closureLines(service: GameService, me: Cultivator, site: LocationRecord, closed: number): string[] {
    const day = Math.floor(service.atHand!.currentDay);
    const outcome = resolveOverstay(site, closed, {
        realmOrdinal: me.realmOrdinal, bornOnDay: day - me.age * 365,
        physique: me.physique, immortalStatus: me.immortalStatus
    });
    const left = Math.max(0, Math.ceil(((outcome.reopensOnDay ?? day) - day) / 365));
    return [`${site.name} is closed with you inside.`,
        `The next opening is ${left} years away. At the closing you had `
            + (Number.isFinite(outcome.yearsRemaining)
                ? `${outcome.yearsRemaining} years of lifespan left.` : 'an unbounded lifespan.')];
}

/** Any verb can spend the last day of a window, including waiting or cultivation. */
export function reportRuinClosing(service: GameService, beforeDay: number, done: Execution): void {
    const me = service.currentRun().cultivator;
    const held = position(service, me);
    const site = held && service.atHand?.locations.find(row => row.id === held.siteId);
    if (!site?.cycle) return;
    const closed = nextClosingDay(site, beforeDay);
    if (closed === null || closed > service.atHand!.currentDay || closed <= beforeDay) return;
    append(done, closureLines(service, me, site, closed));
    done.calls.push({ name: 'world.resolveOverstay', action: 'site', ok: true,
        summary: `${site.id} closed on day ${closed}; the body remains inside, aging on the ordinary clock.` });
}

/** A move out of a ruin first has to walk back through its chambers. */
export async function leaveRuinBeforeMoving(
    service: GameService, run: Run, me: Cultivator, ambient: AmbientQi
): Promise<{ done: Execution; left: boolean } | null> {
    if (!position(service, me)) return null;
    const done = await delveRuin(service, run, me, ambient, undefined, 'leave');
    return done ? { done, left: position(service, service.currentRun().cultivator) === null } : null;
}

/** A chamber name printed by the delve is also a destination for ordinary movement. */
export async function moveWithinRuin(
    service: GameService, run: Run, me: Cultivator, ambient: AmbientQi, target: string | undefined
): Promise<Execution | null> {
    const held = position(service, me);
    const site = held && service.atHand?.locations.find(row => row.id === held.siteId);
    if (!site || !target || !wingsOf(site).some(row => matchScore(target, row.name) >= MATCH_THRESHOLD)) return null;
    return delveRuin(service, run, me, ambient, target, 'delve');
}

/** Null lets authored trials and graves keep their existing resolver. */
export async function delveRuin(
    service: GameService, run: Run, me: Cultivator, ambient: AmbientQi,
    target: string | undefined, step: SiteIntent
): Promise<Execution | null> {
    const world = service.atHand;
    if (!world) return null;
    const held = position(service, me);
    const here = worldLocationFor(world, me.location);
    const generic = !target || /^(?:(?:the|this|that|my|old|ancient|current)\s+)*(?:ruins?|site|entrance|door|inside|contents|chambers?|(?:ruin )?(?:map|chambers)|notes)$/i.test(target.trim());
    const wingNamed = held && wingsOf(world.locations.find(row => row.id === held.siteId)!)
        .find(row => matchScore(target ?? '', row.name) >= MATCH_THRESHOLD);
    const named = !generic && !wingNamed ? worldLocationFor(world, target ?? null) : null;
    const site = named?.kind === 'ruin' ? named
        : generic || wingNamed || step === 'wear' && held ? here : null;
    if (!site || site.kind !== 'ruin') {
        if (held && (step === 'enter' || step === 'take' || step === 'delve')) {
            const inside = world.locations.find(row => row.id === held.siteId)!;
            return say(service, run, [`You are still inside ${inside.name}. Its outer hall is the way out.`], true);
        }
        return null;
    }
    if (site.id !== here?.id) {
        if (!service.knowledge.isAwareOf(me.id, 'place', site.id)) return null;
        if (step !== 'enter' && step !== 'delve' && step !== 'wear' && step !== 'take') return null;
        return say(service, run, [`${site.name} is elsewhere. You are at ${me.location}.`], true);
    }
    if (step === 'approach' || step === 'outside') {
        if (held) {
            const chamber = wingsOf(site).find(row => row.id === held.chamberId);
            if (chamber) return say(service, run, roomLines(service, me, site, chamber));
        }
        const stone = whatTheStoneworkOfARuinSays(world, site,
            id => service.knowledge.isAwareOf(me.id, 'sect', id));
        return say(service, run, [`${site.name}, from outside.`, ...(stone?.lines ?? []),
            isOpenOn(site, Math.floor(world.currentDay)) ? 'The entrance is open.' : 'The entrance is closed.']);
    }
    const wings = wingsOf(site);
    const current = held ? wings.find(row => row.id === held.chamberId) : null;
    if (step === 'survey') {
        if (!held || !current) return say(service, run, ['You have not entered this ruin.'], true);
        return say(service, run, roomLines(service, me, site, current));
    }
    if (step !== 'enter' && !current) return say(service, run, ['You have not entered this ruin.'], true);
    if (step === 'wear') {
        if (!site.hazards.includes('formation')) return say(service, run,
            ['There is no formation here preserving an old identity.'], true);
        const bodyId = `${site.id}:${current!.id}:past-body`;
        const offer = offerPossession(site, { corpseId: bodyId, onDay: Math.floor(world.currentDay) });
        if (!offer.available || !offer.identity) return say(service, run, [offer.refusal!], true);
        const done = await service.shortSkip(run, me, ambient, 0, 'Wearing an old identity', 1, 'gathering');
        const after = service.currentRun();
        if (done.cutShort || !after.cultivator.alive) return done;
        service.repos.cultivators.update(me.id, {
            identityContinuity: Math.max(0, after.cultivator.identityContinuity - offer.continuityCost)
        });
        const rng = forStream(run.seed, 'ruin-wearing', site.id, bodyId, String(run.turn));
        const achievement = recordAchievement({ kind: 'witnessed_phenomenon',
            onDay: Math.floor(world.currentDay), turn: after.run.turn,
            summary: `Wore an identity from ${site.name} in year ${offer.identity.year}.`
        }, rng);
        persistUnderstanding(service.repos, me.id, [], [achievement]);
        let insights = after.cultivator.insights;
        const learned: string[] = [];
        for (const candidate of discoverableInsights(after.cultivator, {
            locationTags: offer.carriesBack.comprehension, runSeed: run.seed
        }).filter(row => row.access.kind === 'site')) {
            const taken = integrateInsight(insights, candidate, achievement);
            insights = [...insights.filter(row => row.id !== taken.insight.id), taken.insight];
            persistUnderstanding(service.repos, me.id, [taken.insight], [achievement]);
            learned.push(insightName(taken.insight));
        }
        append(done, [`You wore ${offer.identity.name}, in year ${offer.identity.year}.`,
            `The identity answered for ${offer.identity.obligations.join(', ')}.`,
            `Identity continuity fell by ${offer.continuityCost}. No objects crossed back.`,
            ...(learned.length > 0 ? [`Comprehended ${learned.join(', ')}.`] : [])]);
        done.calls.push({ name: 'world.offerPossession', action: 'site', ok: true,
            summary: `${bodyId}: continuity spent and comprehension persisted; no objects granted.` });
        return done;
    }
    if (step === 'take') {
        const day = Math.floor(world.currentDay);
        const assessment = evaluateAccess({ ...site, sealed: false, cycle: null }, { realmOrdinal: me.realmOrdinal });
        if (assessment.level !== 'operational' && assessment.level !== 'mastered') {
            return say(service, run, ['This ground is beyond what you can work.'], true);
        }
        if (ageOf(site, day) !== 'new' && site.hazards.includes('formation')) {
            const round = routineAt(site, day).find(row => row.chamberId === current!.id);
            if (round?.occupied) return say(service, run,
                [`The round is being kept in ${current!.name}.`, Number.isFinite(round.clearOnDay)
                    ? `It clears in ${round.clearOnDay - day} days.` : 'The round stays in this chamber.'], true);
        }
        if (current!.sealed && assessment.level !== 'mastered') {
            return say(service, run, [`${current!.name} is sealed against your cultivation.`], true);
        }
        const done = await service.shortSkip(run, me, ambient, 0, 'Working a ruin chamber', 1, 'gathering');
        const after = service.currentRun();
        if (done.cutShort || !after.cultivator.alive) return done;
        const now = world.locations.find(row => row.id === site.id)!;
        const worked = workWing(now, { wingId: current!.id, onDay: Math.floor(world.currentDay),
            byName: me.name, byId: me.id, unsealed: assessment.level === 'mastered' });
        if (worked) {
            world.locations[world.locations.findIndex(row => row.id === site.id)] = worked.location;
            service.theWorldMoved();
            done.calls.push({ name: 'world.workWing', action: 'site', ok: true, summary: worked.change.summary });
            // The object table is the stock. Working a wing never rolls another prize.
            const loose = looseIn(service, site, current!.id);
            for (const object of loose) {
                const taken = transferPossession(object, { onDay: Math.floor(world.currentDay),
                    toHolderId: me.id, toHolderName: me.name, how: 'found', source: site.name,
                    note: `Recovered while working ${current!.name}.` });
                world.objects[world.objects.findIndex(row => row.id === object.id)] = { ...taken, locationId: null };
            }
            append(done, loose.length > 0
                ? [`You picked up ${loose.map(row => row.name).join(', ')}.`]
                : ['No loose objects were found.']);
            append(done, [`You worked ${current!.name}.`, ...roomLines(service, after.cultivator, worked.location,
                wingsOf(worked.location).find(row => row.id === current!.id)!)]);
        }
        return done;
    }
    const day = Math.floor(world.currentDay);
    if (!isOpenOn(site, day)) {
        const closed = held ? nextClosingDay(site, held.enteredOnDay) : null;
        return say(service, run, closed === null ? [`${site.name} is closed.`]
            : closureLines(service, me, site, closed), true);
    }
    const access = evaluateAccess(site, { realmOrdinal: me.realmOrdinal, onDay: day });
    if (!held && (access.closed || access.level === 'barred')) {
        return say(service, run, [`The entrance to ${site.name} is closed to you.`, access.reason], true);
    }
    const leaving = step === 'leave';
    const destination = leaving || !current ? wings[0]
        : wingNamed ?? wings[wings.findIndex(row => row.id === current.id) + 1];
    if (!destination) return say(service, run, ['There is no further chamber in your notes.'], true);
    if (!leaving && destination.sealed && access.level !== 'mastered') {
        return say(service, run, [`${destination.name} is sealed against your cultivation.`], true);
    }
    const walk = current ? navigate(site, { fromChamberId: current.id, toChamberId: destination.id,
        map: mapFor(service, me, site), mayEnter: (id, elapsed) => {
            const wing = wings.find(row => row.id === id)!;
            if (wing.sealed && access.level !== 'mastered') return false;
            return ageOf(site, day) === 'new' || !site.hazards.includes('formation')
                || !routineAt(site, day + elapsed).find(row => row.chamberId === id)?.occupied;
        } }, forStream(run.seed, 'ruin-navigation', site.id, String(run.turn)))
        : { reached: true, days: destination.depthDays, route: [destination.id], wasted: 0, mapSaved: 0 };
    const requested = Math.max(1, walk.days + (leaving ? wings[0].depthDays : 0));
    const light = lightBudget({ qi: me.qi, maxQi: me.maxQi, depthDays: requested / 2 });
    const lit = site.environment.climate === 'sunless';
    if (lit && light.daysOfLight < 1) return say(service, run,
        [`Your qi covers ${light.daysOfLight} days of light. You cannot see a passage to walk.`], true);
    const closes = nextClosingDay(site, day);
    const days = Math.min(requested, lit ? Math.floor(light.daysOfLight) : requested,
        closes === null ? requested : Math.max(1, closes - day));
    // Entry happens before the span, so a door closing during it catches the entrant.
    if (!held) writeFlag(service.db, me.id, POSITION, JSON.stringify({
        siteId: site.id, chamberId: destination.id, enteredOnDay: day
    }));
    const done = await service.shortSkip(run, me, ambient, 0,
        leaving ? 'Leaving the ruin' : 'Walking ruin chambers', days, 'travel');
    const after = service.currentRun();
    const lived = done.timeSkip?.simulatedDays ?? 0;
    if (lit) service.repos.cultivators.applyDeltas(me.id, {
        qi: Math.min(after.cultivator.qi, Math.max(0, me.qi - Math.ceil(me.maxQi * LIGHT_COST_PER_DAY * lived)))
            - after.cultivator.qi
    });
    if (!after.cultivator.alive) return done;
    const rooms = trueTopology(site);
    const visited = new Set<string>();
    let walked = 0;
    let reached = current?.id ?? destination.id;
    for (let i = 0; i < walk.route.length; i++) {
        if (i > 0) walked += Math.max(1, Math.abs(rooms.find(row => row.id === walk.route[i])!.depthDays
            - rooms.find(row => row.id === walk.route[i - 1])!.depthDays));
        else if (!current) walked += destination.depthDays;
        if (walked > lived) break;
        reached = walk.route[i];
        visited.add(reached);
        recordChamber(service, me, wings.find(row => row.id === reached)!, Math.floor(world.currentDay));
    }
    let latest = world.locations.find(row => row.id === site.id)!;
    const unsealed = wingsOf(latest).filter(wing => wing.sealed && visited.has(wing.id));
    if (unsealed.length > 0 && access.level === 'mastered') {
        const changed = withWings(latest, wingsOf(latest).map(wing =>
            visited.has(wing.id) ? { ...wing, sealed: false } : wing));
        latest = applyLocationChange(changed, { onDay: Math.floor(world.currentDay), kind: 'unsealed',
            summary: `${me.name} opened ${unsealed.map(wing => wing.name).join(', ')} of ${site.name}.`,
            witnessed: true, causeKnown: true, patch: { data: changed.data }
        }).location;
        world.locations[world.locations.findIndex(row => row.id === site.id)] = latest;
        service.theWorldMoved();
    }
    const completed = walk.reached && lived >= requested && !done.cutShort;
    if (!done.cutShort && lived < requested) {
        const darkness = lit && days === Math.floor(light.daysOfLight);
        done.cutShort = { askedDays: requested, livedDays: lived,
            cause: darkness ? 'the_body' : 'the_world',
            what: darkness ? 'the qi available for light ran out' : 'the entrance closed' };
        append(done, [`The walk stopped after ${lived} of ${requested} days: ${done.cutShort.what}.`]);
    }
    if (leaving && completed && isOpenOn(site, Math.floor(world.currentDay))) {
        clearFlag(service.db, me.id, POSITION);
        append(done, [`You left ${site.name} through the outer hall.`]);
    } else {
        writeFlag(service.db, me.id, POSITION, JSON.stringify({
            siteId: site.id, chamberId: reached, enteredOnDay: held?.enteredOnDay ?? day
        }));
        append(done, roomLines(service, service.currentRun().cultivator, latest,
            wingsOf(latest).find(row => row.id === reached)!));
        if (!completed) append(done, ['The walk did not reach its destination.']);
    }
    done.calls.push({ name: 'world.navigate', action: 'site', ok: completed,
        summary: `${site.id}: ${lived} days spent, ${walk.wasted} wandering days; map ${mapFor(service, me, site).source}.` });
    return done;
}
