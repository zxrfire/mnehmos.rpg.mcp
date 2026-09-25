/**
 * What somebody remembers, and how they came to know it.
 *
 * The owner, on a house's memories coming up in conversation: *"but remember a
 * sect is its people"*. A house does not remember anything; the people on its
 * roll do, each from where they stood. An elder who buried the dead has it as
 * something lived, and it was their master or it was not; a disciple entered
 * on the roll afterwards has it as a story somebody told them, or does not have
 * it at all; somebody of another house has none of it.
 *
 * NOTHING HERE IS STORED AND NOTHING HERE WRITES. Three stores already hold
 * the whole of it, and this reads them for one person:
 *
 *   `memory.ts`       what this person carries: a loss they were written when a
 *                     life was enshrined, the rumour of an ascension, a word
 *                     come down through a channel. Theirs, in their own line.
 *   the ledger        their house's losses, a death or a departure with the
 *                     house on it. Whether they lived it or were told it is
 *                     read off when they were entered on the roll, off their
 *                     ties to the one it was about, and off who is left in the
 *                     house to tell it.
 *   the player's own  what the player did, from the player's row
 *   record            (`trajectoryOf`), where this person was named or was
 *                     standing there. It runs both ways: what the player lived
 *                     through is remembered by the people who were there.
 *
 * ── HOW THEY CAME TO KNOW IT ─────────────────────────────────────────────
 *
 * Lived: on the house's roll on the day, or there, or tied to the one it was
 * about by a tie a death leaves somebody holding (`aDeathLeavesThemHoldingIt`).
 * The day somebody was entered on a roll is the day the house put its robes on
 * them (`aUniformFor`); the founding roll was robed the day the world opened and
 * had been on it for as long as they had been alive.
 *
 * Told, when they came later: the house's great dead, the deaths that carried
 * past the house (`WHEN_A_DEATH_IS_MORE_THAN_A_HOUSES_OWN`), are told to
 * everybody on the roll; any other loss reaches them only through somebody
 * still on the roll who lived it - their master, or, for somebody in the upper
 * half of the ladder (`worthRecordingRank`), anybody who did. When nobody who
 * lived it is left and it never carried, the story has gone with them.
 *
 * WHAT IT DOES NOT DO is decide when any of it is said. That is the person's,
 * played by the narrator from the facts this hands over; see `aPersonsCard`.
 */

import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import type { HistoricalActor, HistoricalFact } from './history.js';
import { LID_CHANNEL_TAG } from './immortal-world.js';
import { recallAbout, searchMemories, type MemoryKind, type MemoryRecord } from './memory.js';
import type { NpcRecord, RelationshipKind } from './npc-state.js';
import { worthRecordingRank } from './recording-where-somebody-stands-in-a-house.js';
import { WHEN_A_DEATH_IS_MORE_THAN_A_HOUSES_OWN } from './what-a-death-at-this-height-is-worth.js';
import { trajectoryOf } from './who-was-there-when-it-happened.js';
import { aDeathLeavesThemHoldingIt } from './who-is-left-when-somebody-dies.js';
import type { FactionRecord, WorldState } from './world-state.js';

/** How they came to know it. */
export type HowTheyKnowIt =
    /** They were there, on the roll, or it was somebody of theirs. */
    | 'lived'
    /** Somebody who lived it told them. */
    | 'told'
    /** A rumour they were given and never had settled. */
    | 'heard';

/** A person a remembered line names, and what to call them without the name. */
export interface NamedInIt {
    id: string;
    name: string;
    /** How this person would say who it was, where the listener has no name for them. */
    otherwise: string;
}

export interface SomethingTheyRemember {
    /** One line, in the engine's words. Names the people in it; see `named`. */
    what: string;
    how: HowTheyKnowIt;
    /** Who told it, where it was told: `their master` or `their house`. */
    toldBy: string | null;
    /** It was before they were on their house's roll. */
    beforeTheyJoined: boolean;
    /** Whole years since it happened. */
    yearsAgo: number;
    /** What the one it was about was to them, where a death would leave them holding it. */
    itWasTheir: string | null;
    /** The player was in it. The line calls them "the player". */
    withThePlayer: boolean;
    /** Theirs alone: a word that came to them and nobody else. */
    keptToThemselves: boolean;
    /** Everybody the line names, for a caller that has to say them without a name. */
    named: NamedInIt[];
}

/** Who the player is, so a line can call them that. Null when nobody is asking. */
export interface ThePlayer {
    id: string;
    name: string;
}

/** The kinds a memory store row can be that a person would ever bring up. Trivia is not. */
const WORTH_BRINGING_UP: readonly MemoryKind[] = [
    'relationship', 'betrayal', 'promise', 'debt', 'discovery', 'loss', 'history', 'faction_change', 'rumour'
];

/** The kinds of ledger row that are a house losing somebody. */
const A_HOUSE_LOSES_SOMEBODY: ReadonlySet<HistoricalFact['kind']> = new Set(['death', 'ascension']);

/** The roles a fact gives the one the house lost, across the writers of those two kinds. */
const THE_ONE_LOST: ReadonlySet<string> = new Set(['deceased', 'victim', 'missing', 'crossed']);

/**
 * What this person remembers, strongest first, at most `limit` of it.
 *
 * Strongest is: the player in it, then somebody of theirs, then lived before
 * told, then what carried past the house, then the most recent.
 */
export function whatSomebodyRemembers(
    state: WorldState,
    personId: string,
    options: { player?: ThePlayer | null; limit?: number } = {}
): SomethingTheyRemember[] {
    const person = state.npcs.find(npc => npc.id === personId);
    if (!person || person.status !== 'alive') return [];
    const player = options.player ?? null;
    const today = state.currentDay;
    const byId = new Map(state.npcs.map(npc => [npc.id, npc]));
    const house = person.factionId === null ? null : state.factions.find(f => f.id === person.factionId) ?? null;

    const found: Ranked[] = [];
    const aboutSomebodyAlready = new Set<string>();

    // ── WHAT THEY CARRY ──────────────────────────────────────────────────
    // What they carry about the person in front of them first: `recallAbout`
    // is the retrieval a conversation needs, and a debt waiting forty years to
    // be said is the reason it orders on salience.
    const carried: MemoryRecord[] = [];
    if (player) carried.push(...recallAbout(state.memories, person.id, player.id));
    const seen = new Set(carried.map(m => m.id));
    for (const m of searchMemories(state.memories, { ownerId: person.id, kinds: WORTH_BRINGING_UP })) {
        if (!seen.has(m.id)) carried.push(m);
    }
    for (const m of carried) {
        // `recallAbout` reads every kind, so the trivia is dropped here too.
        if (!WORTH_BRINGING_UP.includes(m.kind)) continue;
        const about = m.actorIds[0] ?? null;
        if (about !== null && (m.kind === 'loss' || m.kind === 'rumour')) aboutSomebodyAlready.add(about);
        const named = m.actorIds
            .map(id => byId.get(id))
            .filter((npc): npc is NpcRecord => npc !== undefined)
            .map(npc => ({ id: npc.id, name: npc.name, otherwise: howTheyWouldSayWho(person, npc, house, state) }));
        found.push({
            thing: {
                what: callingThePlayerThat(m.summary, player),
                how: m.kind === 'rumour' ? 'heard' : 'lived',
                toldBy: null,
                beforeTheyJoined: false,
                yearsAgo: yearsSince(m.onDay, today),
                itWasTheir: about === null ? null : whatTheyWereToThem(person, about, byId),
                withThePlayer: player !== null && m.actorIds.includes(player.id),
                keptToThemselves: m.tags.includes(LID_CHANNEL_TAG),
                named: named.filter(n => n.id !== player?.id)
            },
            day: m.onDay,
            carried: false
        });
    }

    // ── WHAT THEIR HOUSE LOST ────────────────────────────────────────────
    if (house) {
        const entered = whenTheyWereEntered(state, house.id);
        const masters = new Set(person.relationships.filter(tie => tie.kind === 'master').map(tie => tie.targetId));
        const upperHalf = worthRecordingRank(person.factionRankIndex, house.ranks.length);
        const stillOnTheRoll = state.npcs.filter(npc =>
            npc.status === 'alive' && npc.factionId === house.id && npc.id !== person.id);

        for (const fact of state.history.facts) {
            if (!A_HOUSE_LOSES_SOMEBODY.has(fact.kind) || !fact.factionIds.includes(house.id)) continue;
            const lost = fact.actors.find(actor => THE_ONE_LOST.has(actor.role));
            if (!lost || lost.id === person.id || aboutSomebodyAlready.has(lost.id)) continue;

            const lived = livedIt(person, fact, lost.id, entered.get(person.id) ?? null);
            let toldBy: string | null = null;
            if (!lived) {
                if (fact.visibility === 'secret' || fact.fidelity === 'lost') continue;
                const tellers = stillOnTheRoll.filter(other =>
                    livedIt(other, fact, lost.id, entered.get(other.id) ?? null));
                if (tellers.some(other => masters.has(other.id))) toldBy = 'their master';
                else if (WHEN_A_DEATH_IS_MORE_THAN_A_HOUSES_OWN.includes(fact.scale)) toldBy = 'their house';
                else if (upperHalf && tellers.length > 0) toldBy = 'their house';
                else continue;
            }

            const killer = fact.actors.find(actor => actor.role === 'killer') ?? null;
            const present = wasThere(person, fact);
            const deadRow = byId.get(lost.id) ?? null;
            const named: NamedInIt[] = [{
                id: lost.id,
                name: lost.name,
                otherwise: deadRow ? howTheyWouldSayWho(person, deadRow, house, state) : 'somebody of their house'
            }];
            const killerRow = killer ? byId.get(killer.id) ?? null : null;
            if (killer && killer.id !== player?.id && (fact.causeKnown || present)) {
                named.push({
                    id: killer.id,
                    name: killer.name,
                    otherwise: killerRow ? howTheyWouldSayWho(person, killerRow, house, state) : 'somebody'
                });
            }
            found.push({
                thing: {
                    what: whatHappenedToThem(fact, lost, killer, deadRow, fact.causeKnown || present, player),
                    how: lived ? 'lived' : 'told',
                    toldBy,
                    // Not lived and not theirs is somebody who came to the roll after.
                    beforeTheyJoined: !lived,
                    yearsAgo: yearsSince(fact.day, today),
                    itWasTheir: whatTheyWereToThem(person, lost.id, byId),
                    withThePlayer: player !== null && killer?.id === player.id,
                    keptToThemselves: false,
                    named
                },
                day: fact.day,
                carried: WHEN_A_DEATH_IS_MORE_THAN_A_HOUSES_OWN.includes(fact.scale)
            });
        }
    }

    // ── WHAT THE PLAYER DID, WHERE THEY WERE ─────────────────────────────
    const playerRow = player ? byId.get(player.id) ?? null : null;
    if (player && playerRow) {
        const counted = new Set(found.map(r => r.thing.what));
        for (const fact of trajectoryOf(state, playerRow)) {
            if (A_HOUSE_LOSES_SOMEBODY.has(fact.kind) && house && fact.factionIds.includes(house.id)) continue;
            if (!wasThere(person, fact)) continue;
            // A killing is said off its fields here too, for the same reason.
            const lost = A_HOUSE_LOSES_SOMEBODY.has(fact.kind)
                ? fact.actors.find(actor => THE_ONE_LOST.has(actor.role)) ?? null
                : null;
            const what = lost
                ? whatHappenedToThem(fact, lost, fact.actors.find(actor => actor.role === 'killer') ?? null,
                    byId.get(lost.id) ?? null, true, player)
                : callingThePlayerThat(fact.summary, player);
            if (counted.has(what)) continue;
            const named = fact.actors
                .filter(actor => actor.id !== player.id)
                .map(actor => {
                    const row = byId.get(actor.id);
                    return {
                        id: actor.id,
                        name: actor.name,
                        otherwise: row ? howTheyWouldSayWho(person, row, house, state) : 'somebody'
                    };
                });
            found.push({
                thing: {
                    what,
                    how: 'lived',
                    toldBy: null,
                    beforeTheyJoined: false,
                    yearsAgo: yearsSince(fact.day, today),
                    itWasTheir: null,
                    withThePlayer: true,
                    keptToThemselves: false,
                    named
                },
                day: fact.day,
                carried: WHEN_A_DEATH_IS_MORE_THAN_A_HOUSES_OWN.includes(fact.scale)
            });
        }
    }

    found.sort((a, b) =>
        Number(b.thing.withThePlayer) - Number(a.thing.withThePlayer)
        || Number(b.thing.itWasTheir !== null) - Number(a.thing.itWasTheir !== null)
        || Number(a.thing.how === 'told') - Number(b.thing.how === 'told')
        || Number(b.carried) - Number(a.carried)
        || b.day - a.day);
    return found.slice(0, options.limit ?? found.length).map(r => r.thing);
}

interface Ranked {
    thing: SomethingTheyRemember;
    day: number;
    /** It carried past the house. */
    carried: boolean;
}

/**
 * The day each of a house's people was entered on its roll: the earliest set of
 * robes the house issued them. Robed on the day the world opened is the
 * founding roll, and on it for as long as they have been alive. Absent for
 * somebody taken on who has not reached the house yet.
 */
function whenTheyWereEntered(state: WorldState, houseId: string): Map<string, number> {
    const robed = new Map<string, number>();
    for (const thing of state.objects) {
        if (thing.ownerId !== houseId || !thing.tags.includes('uniform')) continue;
        const member = thing.data.memberId;
        const day = thing.data.issuedOnDay;
        if (typeof member !== 'string' || typeof day !== 'number') continue;
        robed.set(member, Math.min(robed.get(member) ?? Infinity, day));
    }
    // The age still running opened the day the world did: `createWorld` opens
    // it, and nothing opens another.
    const opened = state.history.eras.find(era => era.endDay === null)?.startDay ?? -Infinity;
    const entered = new Map<string, number>();
    for (const [member, day] of robed) {
        const row = state.npcs.find(npc => npc.id === member);
        entered.set(member, day <= opened && row ? row.identity.bornOnDay : day);
    }
    return entered;
}

function wasThere(person: Pick<NpcRecord, 'id'>, fact: HistoricalFact): boolean {
    return fact.witnessIds.includes(person.id) || fact.actors.some(actor => actor.id === person.id);
}

function livedIt(person: NpcRecord, fact: HistoricalFact, lostId: string, entered: number | null): boolean {
    if (entered !== null && entered <= fact.day) return true;
    if (wasThere(person, fact)) return true;
    return person.relationships.some(tie => tie.targetId === lostId && aDeathLeavesThemHoldingIt(tie.kind));
}

/** What somebody was to this person, in their word, where a death would leave them holding it. */
function whatTheyWereToThem(
    person: NpcRecord,
    otherId: string,
    byId: ReadonlyMap<string, NpcRecord>
): string | null {
    const tie = person.relationships.find(t => t.targetId === otherId && aDeathLeavesThemHoldingIt(t.kind));
    if (!tie) return null;
    return `their ${tieWord(tie.kind, byId.get(otherId)?.identity.sex ?? null)}`;
}

function tieWord(kind: RelationshipKind, sex: string | null): string {
    const female = sex === 'female';
    const male = sex === 'male';
    switch (kind) {
        case 'parent': return female ? 'mother' : male ? 'father' : 'parent';
        case 'child': return female ? 'daughter' : male ? 'son' : 'child';
        case 'spouse': return female ? 'wife' : male ? 'husband' : 'spouse';
        case 'master': return 'master';
        case 'disciple': return 'disciple';
        default: return 'kin';
    }
}

/**
 * Who somebody was, the way this person would say it without the name: what
 * they were to them, else their rank in this person's house, else whose they
 * were.
 */
function howTheyWouldSayWho(
    person: NpcRecord,
    them: NpcRecord,
    house: FactionRecord | null,
    state: WorldState
): string {
    const tie = person.relationships.find(t => t.targetId === them.id && aDeathLeavesThemHoldingIt(t.kind));
    if (tie) return `their ${tieWord(tie.kind, them.identity.sex)}`;
    if (house && them.factionId === house.id) {
        if (house.ranks.length > 0 && them.factionRankIndex >= house.ranks.length - 1) {
            return 'the head of their house';
        }
        const title = house.ranks[them.factionRankIndex];
        return title ? `${/^[aeiou]/i.test(title) ? 'an' : 'a'} ${title} of their house` : 'somebody of their house';
    }
    if (them.factionId !== null && state.factions.some(f => f.id === them.factionId)) {
        return 'somebody of another house';
    }
    return 'somebody';
}

/**
 * What happened to the one the house lost, from the row's own fields rather
 * than its summary: a summary can carry a count off the ladder, which nobody
 * standing there perceives, and it names a killer the house may never have
 * learned. `endNote` is the engine's own factual note on how a life ended.
 */
function whatHappenedToThem(
    fact: HistoricalFact,
    lost: HistoricalActor,
    killer: HistoricalActor | null,
    deadRow: NpcRecord | null,
    causeKnownToThem: boolean,
    player: ThePlayer | null
): string {
    if (fact.kind === 'ascension') return `${lost.name} went for the last crossing and has not been seen since`;
    if (lost.role === 'missing') return `${lost.name} went missing and has not been seen since`;
    if (killer) {
        if (!causeKnownToThem) return `${lost.name} was killed, and by whom is not known to them`;
        return `${lost.name} was killed by ${killer.id === player?.id ? 'the player' : killer.name}`;
    }
    const note = (deadRow?.endNote ?? '').trim().replace(/\.$/, '');
    if (note.length === 0 || fact.actors.some(actor => note.includes(actor.name))) return `${lost.name} died`;
    // "Died of a fever." is the commonest note, and it already says the verb.
    if (/^died\b/i.test(note)) return `${lost.name} ${note.charAt(0).toLowerCase()}${note.slice(1)}`;
    return `${lost.name} died; ${note.charAt(0).toLowerCase()}${note.slice(1)}`;
}

function callingThePlayerThat(line: string, player: ThePlayer | null): string {
    const trimmed = line.trim().replace(/\.$/, '');
    if (!player || player.name.length === 0) return trimmed;
    return trimmed.split(player.name).join('the player');
}

function yearsSince(day: number, today: number): number {
    return Math.max(0, Math.floor((today - day) / DAYS_PER_YEAR));
}
