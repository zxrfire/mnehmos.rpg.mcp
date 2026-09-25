/**
 * A year of people acting on why they would kill somebody, written into the
 * world through the paths that already exist.
 *
 * The factors are `why-one-cultivator-kills-another.ts`. This is the draw and the
 * write: for every pair with a reason this year, once whether it comes to blows,
 * once what the fight comes to, and then the rows.
 *
 *   killed       the victim ends (`theWorldEnds`), their death is settled, and
 *                the killing is an open fact with the deed priced off whoever
 *                they leave - the victim's own tie on the killer written first,
 *                so the heir inherits it.
 *   hidden       the victim ends under an ordinary cause, and the killing itself
 *                enters the world as a deed nobody has worked out
 *                (`aDeedEntersTheWorld` with `workedOut: false`), which the world
 *                holds and the discovery machinery can find. Nothing marks the
 *                killer until then.
 *   shakedown    what the victim carries goes to the attackers, stolen; the
 *                victim lives and knows who.
 *   bothWounded, fled, brokeOff
 *                nobody dies; the one attacked holds it against the attacker.
 *   publicBrawl  the victim ran somewhere with people in it: everybody there saw
 *                who came for them, and the attacker holds it against them back.
 *
 * And the demand to leave that nobody fought over: a group on a piece of ground
 * tells somebody weaker to go, and they go. That is common and is a small slight
 * held by the one sent away, and nothing else.
 *
 * ── WHAT A FIGHT COMES TO, MEASURED ──────────────────────────────────────
 *
 * On `afford-a` at 2,500 years, the outcome of every attempt the world drew:
 * hidden 365, killed in the open 253, broke off 218, both wounded 166, the
 * target fled 99, a public brawl 69, a shakedown 43, terms struck 2, told to
 * leave 5. So three in five killings are disguised, and rather more than half of
 * all attempts end with nobody dead. By who went at whom: rogue on rogue and
 * senior on senior are the two heaviest cells, junior on junior is real, and
 * junior on senior is almost entirely fled, broke off or hidden.
 *
 * AND THE TIE GATE IS WHY {@link A_YEAR_LEAVES_A_MARK} IS 0.05. Without it every
 * pair of strangers who stood on one piece of ground for a year left a row on
 * each other, and `the-ties-an-ordinary-life-produces.test.ts` went to 23 to 27
 * live ties a head against a limit of 6.
 */

import { forStream } from '../cultivation/rng.js';
import { assessPromotions } from './promotion-inside-a-house.js';
import { aDeedEntersTheWorld, aPricedDeed } from './a-deed-enters-the-world-as-a-fact.js';
import type { LocationRecord } from './locations.js';
import { carryingWounds, theWorldEnds, upsertRelationship, relationshipWith, type NpcRecord } from './npc-state.js';
import { andTheOtherEnd } from './a-tie-has-two-ends.js';
import { createInjury } from '../cultivation/injuries.js';
import { ordinaryWoundFor } from '../cultivation/which-wound-an-ordinary-injury-is.js';
import { transferPossession } from './possessions.js';
import { settleNpcDeath, type DeathHandoff } from './time.js';
import { whatAKillingLeaves } from './the-wrongs-a-world-opens-holding.js';
import { whoTheyLeave } from './who-is-left-when-somebody-dies.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { makeFact, type HistoricalFact } from './history.js';
import { theWakeOfADeath, whatADeathIsWorth, whatTheyHeldUp } from './what-a-death-at-this-height-is-worth.js';
import { theirFaceMoves } from './what-a-face-is-worth.js';
import {
    drawTheOutcome,
    everybodyWithAReasonThisYear,
    isGroundAwayFromEverybody,
    theirHeight,
    whatPunchingDownCostsInFace,
    whatTheFightComesTo,
    type AReasonThisYear,
    type Motive
} from './why-one-cultivator-kills-another.js';
import { indexById, type WorldState } from './world-state.js';

/** How much an obeyed demand to leave costs the one sent away, in standing. The lowest slight there is. */
export const BEING_TOLD_TO_LEAVE = 0.05;

/**
 * Of the times two people on one piece of ground do not come to blows, how often
 * they strike terms instead - a share of what is inside, stones, a favour - and
 * how often, of those, they come away friends.
 */
export const THEY_STRIKE_TERMS = 0.15;
/**
 * How often a year of standing on the same ground leaves any mark at all between
 * two people who did not fight. Most of it is people passing each other, and a
 * row for every one of those is a ledger nobody can read: `the-ties-an-ordinary-
 * life-produces.ts` holds the line at a handful of live ties a head.
 */
export const A_YEAR_LEAVES_A_MARK = 0.05;
export const AND_COME_AWAY_FRIENDS = 0.2;
/** What a deal struck warms two people by, and what coming away friends does. */
export const A_DEAL_STRUCK = 0.1;
export const MET_A_FRIEND_ON_THE_ROAD = 0.45;

export type AnOutcome = ReturnType<typeof drawTheOutcome> | 'told to leave';

/** What the year did, for a caller that counts. */
export interface AYearOfIt {
    attempts: Record<Motive, number>;
    outcomes: Record<string, number>;
    /** Deaths and facts, for the pass that folds them into its events. */
    written: { fact: HistoricalFact; deaths: DeathHandoff[]; npcs: string[] }[];
}

/**
 * Every outcome the pass has come to since the process started, by motive and
 * outcome, for a probe to read. Nothing in the world reads it.
 */
export const WHAT_IT_HAS_COME_TO: Record<string, number> = {};

/** Everybody a house holds back who could take a seat off somebody: the blocked, and whoever holds the rung. */
export function seatsThePeopleHeldBackWant(state: WorldState): Map<string, Set<string>> {
    const out = new Map<string, Set<string>>();
    const { blocked } = assessPromotions(state);
    // Everybody alive by house and rung, once, in roster order - this filtered
    // the whole world for every person held back.
    const onRung = new Map<string, NpcRecord[]>();
    for (const n of state.npcs) {
        if (n.status !== 'alive') continue;
        const key = `${n.factionId}|${n.factionRankIndex}`;
        const list = onRung.get(key);
        if (list) list.push(n); else onRung.set(key, [n]);
    }
    for (const b of blocked) {
        if (b.reason !== 'no_seat' && b.reason !== 'outranked') continue;
        const holders = (onRung.get(`${b.factionId}|${b.atRank}`) ?? []).filter(n => n.id !== b.npcId);
        if (holders.length > 0) out.set(b.npcId, new Set(holders.map(h => h.id)));
    }
    return out;
}

function hold(state: WorldState, holderId: string, against: NpcRecord, by: number, note: string, day: number, factId: string | null): void {
    const at = indexById(state.npcs, holderId);
    if (at < 0) return;
    const row = state.npcs[at]!;
    const was = relationshipWith(row, against.id)?.standing ?? 0;
    const standing = Math.max(-1, was - by);
    state.npcs[at] = upsertRelationship(row, {
        targetId: against.id,
        targetName: against.name,
        kind: standing <= -0.4 ? 'enemy' : 'rival',
        standing,
        note,
        ...(factId ? { factIds: [factId] } : {})
    }, day);
    andTheOtherEnd(state.npcs, row, { targetId: against.id, kind: 'rival', standing }, day);
}

function warm(state: WorldState, holderId: string, toward: NpcRecord, by: number, note: string, day: number): void {
    const at = indexById(state.npcs, holderId);
    if (at < 0) return;
    const row = state.npcs[at]!;
    const was = relationshipWith(row, toward.id);
    const standing = Math.min(1, (was?.standing ?? 0) + by);
    state.npcs[at] = upsertRelationship(row, {
        targetId: toward.id,
        targetName: toward.name,
        kind: was !== null && was.kind !== 'rival' && was.kind !== 'enemy' ? was.kind : standing > 0 ? 'ally' : 'rival',
        standing,
        note
    }, day);
}

function placeName(place: LocationRecord | null): string {
    return place?.name ?? 'somewhere nobody names';
}

/**
 * The cause a hidden killing wears, off where it happened.
 *
 * NOT THE ENGINE GUESSING, though it reads like it. *"a beast, by the look of
 * it"* is an inference in anybody else's mouth and is a fact in this one: what
 * is being recorded is the APPEARANCE the killing was given, which is the thing
 * the world holds until somebody works out otherwise. A prose sweep flagged it
 * once and it was cleared; leave the hedging words in, because here they are
 * what is true.
 */
export function whatItWasMadeToLookLike(place: LocationRecord | null): string {
    if (place === null) return 'Died on the road, and nobody saw how.';
    if (place.kind === 'ruin' || place.kind === 'secret_realm' || place.kind === 'forbidden_zone') {
        return `Went into ${place.name} and did not come out.`;
    }
    if (place.kind === 'wilds' || place.kind === 'cave') return `Died in ${place.name}; a beast, by the look of it.`;
    return `Died at ${place.name}, and nobody saw how.`;
}

/** One year of it. */
export function peopleActOnWhyTheyWouldKill(
    state: WorldState,
    year: number,
    day: number,
    /** The seats already read this year, where a caller has them. */
    seatsTheyWant?: ReadonlyMap<string, ReadonlySet<string>>
): AYearOfIt {
    const out: AYearOfIt = {
        attempts: { greed: 0, 'a grudge': 0, 'a place': 0, 'a seat': 0 },
        outcomes: {},
        written: []
    };
    const reasons = everybodyWithAReasonThisYear(state, seatsTheyWant ?? seatsThePeopleHeldBackWant(state));
    const spent = new Set<string>();
    const count = (k: string) => { out.outcomes[k] = (out.outcomes[k] ?? 0) + 1; WHAT_IT_HAS_COME_TO[k] = (WHAT_IT_HAS_COME_TO[k] ?? 0) + 1; };

    for (const r of reasons) {
        if (spent.has(r.killer.id) || spent.has(r.victim.id)) continue;
        const rng = forStream(state.seed, 'a-reason-to-kill', year, r.killer.id, r.victim.id);
        const comesToBlows = rng.chance(r.chance);
        if (!comesToBlows) {
            // TOLD TO GET OUT, AND GOES. First there on ground worth being on,
            // and the other is weaker or outnumbered.
            if (!rng.chance(A_YEAR_LEAVES_A_MARK)) continue;
            if (r.stakes.motive === 'a place' && rng.chance(r.relation.value)
                && theirHeight(r.attackers) > r.victim.cultivation.realmOrdinal) {
                hold(state, r.victim.id, r.killer, BEING_TOLD_TO_LEAVE, `Told to get out of ${placeName(r.place)}, and went.`, day, null);
                count('told to leave');
            } else if (r.stakes.motive === 'a place' && r.killer.id < r.victim.id && rng.chance(THEY_STRIKE_TERMS * (1 - r.relation.value))) {
                // OR THEY STRIKE TERMS, and now and again come away friends. Read
                // off the one pair, once, so two people do not do it twice.
                const friends = rng.chance(AND_COME_AWAY_FRIENDS);
                const by = friends ? MET_A_FRIEND_ON_THE_ROAD : A_DEAL_STRUCK;
                const note = friends ? `Met at ${placeName(r.place)}, and came away friends.` : `Struck terms at ${placeName(r.place)}.`;
                warm(state, r.killer.id, r.victim, by, note, day);
                warm(state, r.victim.id, r.killer, by, note, day);
                count(friends ? 'came away friends' : 'struck terms');
            }
            continue;
        }
        const killerAt = indexById(state.npcs, r.killer.id);
        const victimAt = indexById(state.npcs, r.victim.id);
        const killer = state.npcs[killerAt];
        const victim = state.npcs[victimAt];
        if (!killer || !victim || killer.status !== 'alive' || victim.status !== 'alive') continue;
        spent.add(killer.id);
        spent.add(victim.id);
        out.attempts[r.stakes.motive]++;

        const peopleNearby = state.npcs.some(n => n.status === 'alive' && n.locationId === victim.locationId
            && !r.attackers.some(a => a.id === n.id) && n.id !== victim.id)
            || !isGroundAwayFromEverybody(r.place);
        const killersHouse = killer.factionId === null ? null : state.factions.find(f => f.id === killer.factionId) ?? null;
        const mix = whatTheFightComesTo({
            gap: theirHeight(r.attackers) - victim.cultivation.realmOrdinal,
            attackers: r.attackers.length,
            place: r.place,
            peopleNearby,
            stakes: r.stakes,
            killersHouse
        });
        const outcome = drawTheOutcome(mix, rng.next());
        count(outcome);
        const band = (x: NpcRecord) => x.factionId === null ? 'rogue' : x.factionRankIndex <= 1 ? 'junior' : 'senior';
        const gap = Math.round(theirHeight(r.attackers) - victim.cultivation.realmOrdinal);
        count(`by ranks ${band(killer)} on ${band(victim)}|${outcome}`);
        count(`by gap ${gap <= -2 ? '<=-2' : gap <= 1 ? '-1..1' : gap <= 4 ? '2..4' : '5+'}|${outcome}`);
        count(`by motive ${r.stakes.motive}|${outcome}`);
        writeIt(state, r, killer, victim, outcome, day, out);
    }
    return out;
}

function writeIt(
    state: WorldState,
    r: AReasonThisYear,
    killer: NpcRecord,
    victim: NpcRecord,
    outcome: ReturnType<typeof drawTheOutcome>,
    day: number,
    out: AYearOfIt
): void {
    const where = placeName(r.place);
    const houseIds = [killer.factionId, victim.factionId].filter((id): id is string => id !== null);
    // SEVERAL CAME, OR ONE DID, and the record says which. A killer more than
    // three rungs below their victim cannot get there alone - the combat layer's
    // own edge cap, which `demography.test.ts` holds the world to - and a group
    // can, so the ones who came with them are on the row and in the note.
    const withThem = r.attackers.filter(a => a.id !== killer.id);
    const actors = [
        { id: killer.id, name: killer.name, role: 'killer' },
        ...withThem.map(a => ({ id: a.id, name: a.name, role: 'with' })),
        { id: victim.id, name: victim.name, role: 'victim' }
    ];
    const byName = withThem.length > 0
        ? `${killer.name} and ${withThem.length} other${withThem.length > 1 ? 's' : ''}`
        : killer.name;

    if (outcome === 'killed' || outcome === 'hidden') {
        const hidden = outcome === 'hidden';
        // Greed carries off what it came for, before anybody else stands over it.
        if (r.stakes.motive === 'greed') {
            for (const id of r.stakes.objectIds) {
                const o = state.objects.findIndex(x => x.id === id);
                if (o < 0 || state.objects[o]!.possessorId !== victim.id) continue;
                state.objects[o] = transferPossession(state.objects[o]!, {
                    onDay: day, toHolderId: killer.id, toHolderName: killer.name, how: 'stolen',
                    transfersOwnership: false, note: `Taken off ${victim.name} at ${where}.`
                });
            }
        }
        const victimAt = indexById(state.npcs, victim.id);
        // The dead keep their account open, and only where they knew who.
        if (!hidden) {
            state.npcs[victimAt] = upsertRelationship(state.npcs[victimAt]!, {
                targetId: killer.id, targetName: killer.name, kind: 'enemy', standing: -1,
                note: `Killed them at ${where}.`
            }, day);
            andTheOtherEnd(state.npcs, victim, { targetId: killer.id, kind: 'enemy', standing: -1 }, day,
                { note: `Killed them at ${where}.` });
        }
        const dying = state.npcs[victimAt]!;
        const victimsHouse = victim.factionId === null
            ? null
            : state.factions.find(f => f.id === victim.factionId) ?? null;
        const dead = theWorldEnds(dying, day, hidden ? whatItWasMadeToLookLike(r.place) : `Killed by ${byName}.`);
        if (!dead) return;
        state.npcs[victimAt] = dead;
        const handoff = settleNpcDeath(state, dying, day);
        const summary = `${byName} killed ${victim.name} at ${where}.`;
        // THE WAKE HAPPENS EITHER WAY. A killing nobody has worked out is still
        // a chair standing empty and a house standing lower: what the cover
        // story hides is who did it, not that they are gone.
        const wake = theWakeOfADeath(state, state.npcs[victimAt] ?? dying, day,
            hidden ? whatItWasMadeToLookLike(r.place) : `${byName} killed them.`);
        if (hidden) {
            const held = aDeedEntersTheWorld(state, {
                kind: 'grudge_opened', day, locationId: r.place?.id ?? null, actors, factionIds: houseIds,
                summary: `${summary} It was made to look like something else.`,
                // NAME-FREE, which the cover story is not: a ruin is named after
                // whoever did not come out of it.
                unattributed: 'Somebody did not come back from something, and nobody has said how.',
                weight: 'unforgivable',
                workedOut: false,
                data: { motive: r.stakes.motive, relation: r.relation.why, hidden: true, evil: r.stakes.evil, attackers: r.attackers.length }
            });
            out.written.push({ fact: held.fact, deaths: [handoff], npcs: [killer.id, victim.id] });
            return;
        }
        const theyLeft = whoTheyLeave({
            dead: dying, heirs: handoff.heirs,
            stillHere: id => state.npcs.some(n => n.id === id && n.status === 'alive')
        });
        const leaves = whatAKillingLeaves(state, { victim: dying, killer, day, theyLeft, description: summary });
        // HOW BIG A KILLING IS READS WHO DIED. `personal`, `regional` and 0.45
        // were the same three numbers whether the dead was an outer disciple or
        // a Seat of the Hollow Court, and the world afterwards was the world
        // before it. See `what-a-death-at-this-height-is-worth.ts`.
        const worth = whatADeathIsWorth(dying, victimsHouse, whatTheyHeldUp(state, dying));
        // AND THEY PAY FOR IT IN FRONT OF EVERYBODY. Killing somebody a realm
        // or more beneath you says you were threatened by somebody who could
        // not threaten you. Only for a killing that is known to be theirs: a
        // hidden one costs nothing, which is one more reason they are hidden.
        const faceCost = whatPunchingDownCostsInFace(
            killer.cultivation.realmOrdinal, victim.cultivation.realmOrdinal);
        if (faceCost > 0) theirFaceMoves(state, killer.id, -faceCost, day);
        const fact = appendWorldFact(state, makeFact({
            day, kind: 'grudge_opened', scale: worth.scale, summary, actors,
            locationId: r.place?.id ?? null, factionIds: victim.factionId ? [victim.factionId] : [],
            visibility: worth.visibility, magnitude: worth.magnitude,
            data: {
                ...(wake === null ? {} : {
                    powerWas: wake.powerWas, powerNow: wake.powerNow,
                    seatEmptied: wake.seatEmptied, housesThatMoved: wake.housesThatMoved
                }),
                ...(leaves ? aPricedDeed(leaves.weight) : {}),
                pressure: 'killing', motive: r.stakes.motive, relation: r.relation.why, evil: r.stakes.evil,
                attackers: r.attackers.length,
                unattributed: 'A body was found on the low road and nobody is saying whose it was.'
            }
        }));
        out.written.push({ fact, deaths: [handoff], npcs: [killer.id, victim.id] });
        return;
    }

    let summary: string;
    let heldBy = 0.6;
    if (outcome === 'shakedown') {
        const taken: string[] = [];
        for (let o = 0; o < state.objects.length; o++) {
            const thing = state.objects[o]!;
            if (thing.possessorId !== victim.id || thing.significance === 'mundane') continue;
            state.objects[o] = transferPossession(thing, {
                onDay: day, toHolderId: killer.id, toHolderName: killer.name, how: 'stolen',
                transfersOwnership: false, note: `Handed over to ${killer.name} at ${where}.`
            });
            taken.push(thing.name);
        }
        summary = `${killer.name}${r.attackers.length > 1 ? ` and ${r.attackers.length - 1} others` : ''} stopped ${victim.name} at ${where} `
            + `and took ${taken.length > 0 ? taken.join(', ') : 'what they carried'}. ${victim.name} handed it over and lived.`;
        heldBy = 0.5;
    } else if (outcome === 'bothWounded') {
        summary = `${killer.name} went for ${victim.name} at ${where}, and both came away hurt.`;
        // Through the one wound writer, an ordinary serious wound from a fight.
        const rng = forStream(state.seed, 'a-long-fight', day, killer.id, victim.id);
        for (const id of [killer.id, victim.id]) {
            const at = indexById(state.npcs, id);
            if (at < 0) continue;
            state.npcs[at] = carryingWounds(state.npcs[at]!, [createInjury({
                severity: 'serious', source: 'combat', turn: 0, woundType: ordinaryWoundFor('combat', 'serious')
            }, rng)], day);
        }
    } else if (outcome === 'fled') {
        summary = `${killer.name} went for ${victim.name} at ${where}, and ${victim.name} got away.`;
    } else if (outcome === 'publicBrawl') {
        summary = `${killer.name} went for ${victim.name} at ${where}. ${victim.name} ran where there were people, and everybody there saw who came after them.`;
        heldBy = 0.8;
    } else {
        summary = `${killer.name} and ${victim.name} fought at ${where} and broke it off.`;
        heldBy = 0.45;
    }
    const fact = appendWorldFact(state, makeFact({
        day, kind: 'grudge_opened', scale: 'personal', summary, actors: [
            { id: killer.id, name: killer.name, role: 'attacker' },
            { id: victim.id, name: victim.name, role: 'attacked' }
        ],
        locationId: r.place?.id ?? null, factionIds: houseIds,
        visibility: outcome === 'publicBrawl' ? 'public' : 'regional',
        magnitude: outcome === 'publicBrawl' ? 0.45 : 0.25,
        data: { motive: r.stakes.motive, relation: r.relation.why, outcome, unattributed: 'Somebody on the road was set upon, and lived.' }
    }));
    hold(state, victim.id, killer, heldBy, summary, day, fact.id);
    if (outcome !== 'shakedown' && outcome !== 'fled') hold(state, killer.id, victim, 0.3, summary, day, fact.id);
    out.written.push({ fact, deaths: [], npcs: [killer.id, victim.id] });
}
