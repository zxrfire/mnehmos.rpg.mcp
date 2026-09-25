/**
 * Somebody on a road or at a cave door comes at the player, and it is a fight.
 *
 * Until this, a hostile encounter that stopped a span stopped it and nothing
 * else: nobody in the world ever opened a fight on the player. This opens the
 * ordinary `StandingFight` with them as aggressor, so the player's next sentence
 * is a round of it - strike, guard, yield, break off, shout - through the one
 * resolver every fight uses.
 */

import { ENCOUNTERS } from '../data/cultivation/encounters.js';
import { getTechnique } from '../data/cultivation/index.js';
import { getOccupation } from '../data/cultivation/mortal-world.js';
import { resolveMelee } from '../engine/cultivation/combat.js';
import { forStream } from '../engine/cultivation/rng.js';
import { howMany } from '../utils/a-count-agrees-with-what-it-counts.js';
import {
    A_BLOW_MEANT_TO_END_IT,
    AN_ORDINARY_SWING
} from '../engine/cultivation/how-a-blow-was-thrown.js';
import { openFight, whereThisFightStands } from '../engine/cultivation/unfinished-fight.js';
import { needsToFindYou } from '../engine/encounters/activity.js';
import type { EncounterOccurrence, EncounterRoll } from '../engine/encounters/types.js';
import type { AmbientQi, Cultivator, Run } from '../schema/cultivation.js';
import { combatantFromCultivator } from '../server/consolidated/combat-manage.js';
import { isGuidingErrorBody } from '../server/consolidated/cultivation-support.js';
import { PLAYER_ROLL_IDENTITY } from './encounters.js';
import { factsForToolResult } from './facts.js';
import type { StandingFight } from './fight-answers.js';
import { wouldTheyWorkTheRiteOnYou } from './the-furnace-rite-worked-on-you.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

/**
 * Whether this occurrence is somebody coming at the cultivator with nothing on
 * offer: an engageable threat with no walking away, of a kind that has to find
 * you (`needsToFindYou` - people, not beasts or weather).
 *
 * Catalog rows are further held to what they say about themselves: `hostile`,
 * and no `reward` (a reward is a third party asking you to step into their
 * fight). The catalog's own feud row is left alone unless it came off the
 * ledger: drawn from the catalog it names a bystander with a grudge from a list,
 * and a fight opened on that would be a fight with somebody who holds nothing.
 */
export function comesAtYou(occurrence: EncounterOccurrence): boolean {
    const threat = occurrence.confrontation;
    if (!threat || !threat.engageable || threat.avoidable) return false;
    if (occurrence.account) return true;
    if (occurrence.scene || occurrence.duty) return false;
    const entry = ENCOUNTERS.find(row => row.id === occurrence.entryId);
    if (!entry || !needsToFindYou(entry)) return false;
    const tags = new Set(entry.tags);
    return tags.has('hostile') && !tags.has('reward') && !tags.has('feud');
}

/**
 * What the fight's other side is called, where the draw named nobody.
 *
 * TODO(owner: "for now just one"): walking alone, a band is fought as its leader
 * alone and `confrontation.count` is ignored. Against an escort a band fights as
 * a group: see {@link theRestOfTheFight}.
 */
function whoLeadsThem(occurrence: EncounterOccurrence): string {
    const many = (occurrence.confrontation?.count ?? 1) > 1;
    const onTheRoad = ENCOUNTERS.find(row => row.id === occurrence.entryId)?.tags.includes('road');
    if (occurrence.kind === 'bandits' && onTheRoad) return many ? 'the leader of the bandits' : 'the bandit';
    return many ? 'the strongest of them' : 'the cultivator';
}

/**
 * Open the fight the first such occurrence in `happened` brings, or settle it
 * where the gap decides it before anybody moves. Null when nothing came at them.
 */
export function theyCameAtYou(
    service: GameService,
    run: Run,
    cultivator: Cultivator,
    ambient: AmbientQi,
    happened: EncounterRoll,
    /** A band that attacked the vehicle they ride in is a fight they are in, walking away or not. */
    onTheVehicle = false
): Execution | null {
    const occurrence = happened.occurrences.find(one => one.interrupts);
    if (!occurrence) return null;
    if (!comesAtYou(occurrence) && !(onTheVehicle && occurrence.confrontation?.engageable)) return null;
    const threat = occurrence.confrontation!;

    // WHO: the person the ledger sent, or the strongest of whoever the draw put
    // in the road, at the rung the draw gave them.
    const sent = occurrence.account?.sent ?? null;
    const party = sent
        ? { id: sent.id, name: sent.name }
        : { id: `encounter:${occurrence.id}:${occurrence.absoluteDay}`, name: whoLeadsThem(occurrence) };
    const theirRecord = sent ? service.atHand?.npcs.find(npc => npc.id === sent.id) ?? null : null;
    const onRecord = sent !== null && !theirRecord && service.repos.cultivators.getById(sent.id) != null;
    const theirBody = service.theBodyTheyStandIn(
        run, party, onRecord, sent?.realmOrdinal ?? threat.threatOrdinal, theirRecord
    );
    if (isGuidingErrorBody(theirBody)) return null;

    // WHAT THEY CAME FOR. Somebody holding an art that draws on another comes to
    // make the player comply for it; an account that is carried rather than
    // settled, or unforgivable, comes to end it; anything else is a beating.
    const rite = sent ? wouldTheyWorkTheRiteOnYou(service, cultivator, sent.id) : null;
    const theirArt = rite && 'art' in rite ? getTechnique(rite.art)?.name ?? rite.art : null;
    const wantsTheRite = theirArt !== null;
    const account = occurrence.account ?? null;
    const thrown = !wantsTheRite && account && (account.carried || account.severity === 'unforgivable')
        ? A_BLOW_MEANT_TO_END_IT
        : AN_ORDINARY_SWING;
    const entry = ENCOUNTERS.find(row => row.id === occurrence.entryId);

    const techniqueId = service.artTheyWouldFightWith(cultivator) ?? null;
    const selfBody = combatantFromCultivator(
        cultivator, service.repos, techniqueId ?? undefined, service.atHand?.objects ?? []
    );
    const running = service.artTheyWouldRunWith(cultivator);
    const ground = service.groundUnderAFight(cultivator);
    const turn = run.turn + 1;

    const opened = openFight({
        id: `${turn}:${PLAYER_ROLL_IDENTITY}:came-at:${occurrence.absoluteDay}`,
        seed: run.seed,
        aggressor: { input: theirBody, edges: [], vector: 'body', movement: null, movementMastery: 0 },
        defender: {
            input: selfBody, edges: [], vector: 'body',
            movement: running, movementMastery: running?.mastery ?? 0
        },
        intent: {
            thrown,
            ...(wantsTheRite ? { toMakeThemComply: true } : {}),
            willWithdraw: true,
            opening: entry?.tags.includes('ambush') ? 'from_concealment' : 'open'
        },
        playerId: cultivator.id,
        ground,
        turn,
        ambient
    });

    const because = occurrence.event.summary;
    const held: StandingFight = {
        state: opened.fight ?? {
            // Never read when the gap settled it; the shape is filled so the
            // conclusion is handed one object.
            id: '', seed: run.seed, roundsFought: 0, roundBudget: 0,
            aggressor: { input: theirBody, edges: [], vector: 'body', movement: null, movementMastery: 0 },
            defender: { input: selfBody, edges: [], vector: 'body', movement: null, movementMastery: 0 },
            hp: {}, injuries: {}, hpAtOpening: {}, exchanges: [], brokenObjects: [],
            intent: { thrown }, playerId: cultivator.id, ground, openedOnTurn: turn
        },
        runId: run.id,
        cultivatorId: cultivator.id,
        party,
        theirRecord,
        opponentIdOnRecord: onRecord ? party.id : null,
        standingOrdinal: sent?.realmOrdinal ?? threat.threatOrdinal,
        self: selfBody,
        opponent: theirBody,
        techniqueId,
        terms: 'open',
        verb: 'attack',
        cameAtYou: { wanted: wantsTheRite ? 'furnace' : null, because }
    };

    const whatTheyCameFor = wantsTheRite
        ? `${party.name} holds ${theirArt} and came to make this `
          + 'cultivator yield for it.'
        : thrown === A_BLOW_MEANT_TO_END_IT
            ? `${party.name} came to end it: the account is ${account?.carried ? 'a blood feud' : account?.severity}.`
            : `${party.name} came with an ordinary swing.`;

    // AND THROUGH WHAT, where a sealed door stood between them.
    const door = occurrence.door ?? null;
    const throughTheDoor = door?.what === 'broke_in'
        ? `${party.name} broke through ${door.doorName} to reach you.`
        : door?.what === 'stopped'
            ? `${party.name} was waiting outside ${door.doorName} when you came out.`
            : null;

    if (opened.settled) {
        service.fight = null;
        const settled = service.concludeTheFight(run, cultivator, held, opened.settled);
        settled.facts.structure.unshift(
            `${party.name} came at this cultivator and the gap settled it before anybody moved. `
            + whatTheyCameFor
        );
        if (throughTheDoor) {
            settled.facts.lines.unshift(throughTheDoor);
            settled.facts.required = [throughTheDoor, ...(settled.facts.required ?? [])];
        }
        return settled;
    }

    service.fight = held;
    const where = whereThisFightStands(held.state, ambient);
    const line = `${party.name} attacks you. The fight is open, and the next thing you do is a round of it.`;
    // Who sent them and over what is the whole of why this is happening, so it
    // is said to the player and not only handed to the narrator.
    const owed = account
        ? `${party.name} came over the account ${account.holderIsAHouse ? `${account.holderName} holds` : 'they hold'} `
          + `against you: ${account.what.trim()}`
        : null;
    const said = [throughTheDoor, owed, line].filter((one): one is string => one !== null);
    const facts = factsForToolResult(`${party.name} attacks.`, said);
    facts.required = said;
    if (door) {
        facts.structure.push(
            `${door.doorName} stands at ${door.doorStandsAt}; ${party.name} brings ${door.theirStrength}. `
            + (door.what === 'broke_in' ? 'That reaches it, so it broke.' : 'That is short of it, so they waited outside.')
        );
    }
    facts.structure.push(
        `A fight opened with ${party.name} as aggressor and this cultivator defending, off `
        + `${occurrence.account ? `the account ${occurrence.account.holderName} holds` : `catalog row ${occurrence.id}`}. `
        + `${whatTheyCameFor} ${where.line}`
    );
    return {
        facts,
        events: [],
        timeSkip: null,
        breakthrough: null,
        outcome: 'executed',
        calls: [{
            name: 'combat.openFight',
            action: 'attack',
            summary: `${party.name} (${theirBody.realmOrdinal}) opened a fight on the player. ${whatTheyCameFor}`,
            ok: true
        }]
    };
}

/**
 * A band that takes on an escort fights as a group, and only the foreground is played.
 *
 * The owner: "we stick to our 3 person in a 'room' rule by having everyone else
 * fight in the background and 1-2 bandits and 1 person on the caravan, plus you".
 * Where the player can fight the band's leader, that is the ordinary played fight
 * `theyCameAtYou` opens, one guard stands beside them and takes the second bandit,
 * and everybody else - the rest of the escort and the rest of the band - fights
 * in the background. Where the player cannot, the whole escort meets the whole
 * band. Each is resolved here by `resolveMelee` and said as one line. A guard
 * stands at the escort job's rung (`job-escort`); every bandit at the rung the
 * draw gave the band. `escortHeld` is false only where the band won the background.
 */
export function theRestOfTheFight(
    service: GameService,
    run: Run,
    occurrence: EncounterOccurrence,
    escortHeads: number,
    ambient: AmbientQi,
    vehicle: string,
    thePlayerFightsTheLeader: boolean
): { lines: string[]; escortHeld: boolean } {
    const band = occurrence.confrontation?.count ?? 1;
    const bandRung = occurrence.confrontation?.threatOrdinal ?? 0;
    const guardRung = getOccupation('job-escort')?.minOrdinal ?? 0;
    const body = (who: string, rung: number) => {
        const made = service.theBodyTheyStandIn(run, { id: who, name: who }, false, rung, null);
        return isGuidingErrorBody(made) ? null : made;
    };
    const bodies = (name: string, count: number, rung: number) => Array.from({ length: Math.max(0, count) },
        (_, i) => body(`${name} ${i + 1}`, rung)).filter((one): one is NonNullable<typeof one> => one !== null);
    const fight = (guards: number, bandits: number, stream: string) => {
        const escort = bodies('guard', guards, guardRung);
        const them = bodies('bandit', bandits, bandRung);
        if (escort.length === 0 || them.length === 0) return null;
        return resolveMelee([
            { id: 'escort', name: 'the escort', members: escort },
            { id: 'band', name: 'the band', members: them }
        ], {
            rng: forStream(run.seed, stream, occurrence.absoluteDay),
            ambient,
            turn: run.turn + 1,
            intent: { thrown: AN_ORDINARY_SWING, willWithdraw: true }
        });
    };
    const said = (result: ReturnType<typeof resolveMelee>, who: string): string => {
        const escort = result.sides.find(side => side.id === 'escort')!;
        const them = result.sides.find(side => side.id === 'band')!;
        const how = result.winningSideId === 'escort' ? `${who} held`
            : result.winningSideId === 'band' ? 'the band had the better of it' : 'neither side broke';
        return `${how}: of the guards ${escort.fallen.length} fell and ${escort.withdrawn.length} broke off; `
            + `of the band ${them.fallen.length} fell and ${them.withdrawn.length} broke off.`;
    };

    const lines: string[] = [];
    const inFront = thePlayerFightsTheLeader ? Math.min(2, band) : 0;
    const besideYou = inFront === 2 ? 1 : 0;
    const beside = besideYou === 1 ? fight(1, 1, 'a-guard-beside-you') : null;
    if (beside) lines.push(`A guard fights beside you against a second of the band, and ${said(beside, 'the guard')}`);
    const guards = escortHeads - besideYou;
    const behind = fight(guards, band - inFront, 'the-rest-of-the-fight');
    if (behind) {
        lines.push(`Around the ${vehicle}, ${howMany(guards, 'guard')} and ${band - inFront} of the band `
            + `fight it out, and ${said(behind, 'the escort')}`);
    }
    return { lines, escortHeld: behind === null || behind.winningSideId !== 'band' };
}

/** Put what the opened fight said into the execution the span already built. */
export function foldTheFightIn(into: Execution, fight: Execution): Execution {
    into.facts.lines.push(...fight.facts.lines);
    into.facts.required = [...(into.facts.required ?? []), ...(fight.facts.required ?? [])];
    into.facts.structure.push(...fight.facts.structure);
    into.facts.prose = [into.facts.prose, fight.facts.prose].filter(Boolean).join('\n\n');
    into.calls.push(...fight.calls);
    into.events.push(...fight.events);
    return into;
}
