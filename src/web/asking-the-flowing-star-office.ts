/**
 * Asking the Flowing Star office where to find somebody or something.
 *
 * The owner: the Flowing Star Tower "opens offices for people looking for people / things. you can
 * imagine a cultivator asking where i can find x once they've exhausted the usual options. think
 * information house in xianxia. either they tell you or they make the best guess."
 *
 * So a clerk of the Tower, keeping its office (`a-dao-house-shopfront.ts`), answers a where-question
 * for a fee, off the world as it is now: where a person stands this hour, where a house sits, which
 * province a place is in, where a named thing is kept, who teaches an art. Anything it cannot place
 * exactly gets the office's best guess, said as a guess. The fee is the Tower's and goes to the clerk
 * who took it; what is learned is written to the asker's knowledge before it is narrated.
 */
import { getSectsTeaching } from '../data/cultivation/sects.js';
import { theShopfrontOf, isACityThatMatters } from '../engine/world/a-dao-house-shopfront.js';
import { routineOf } from '../engine/world/npc-routines.js';
import { routeQueriesFor } from '../engine/world/locations.js';
import type { LocationRecord } from '../engine/world/locations.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { Cultivator } from '../schema/cultivation.js';
import { resolveAnything } from './entities.js';
import { factsForRefusal, observable } from './facts.js';
import { refused } from './tool-result-prose.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';
import { whereYouStandOnYourHousesRoll } from './walking-up-to-a-house.js';

/** The Tower's house id. */
export const THE_STAR_HOUSE_ID = 'house-flowing-light';

/** What one question at the office costs, in spirit stones. A sighting proper costs far more. */
export const AN_OFFICE_QUESTION_STONES = 10;

const A_WHERE_QUESTION = /\b(?:where(?:abouts)?|find|locate|track down|look(?:ing)? for)\b/i;
const THE_ASKING_WORDS = /^(?:(?:can|could|would|will) you (?:tell me )?|please |tell me )?(?:where (?:can|could|do|would|might) (?:i|one|we) (?:find|get|meet|locate)|where (?:is|are|was|were)(?: to be found)?|where to find|how (?:do|can) i find|find me|help me find|i(?:'m| am) looking for|i want to find|i need to find|the whereabouts of|whereabouts of)\s+/i;

/** The words of the question, without the asking around them. */
export function whatTheyAreLookingFor(topic: string): string | null {
    if (!A_WHERE_QUESTION.test(topic)) return null;
    const subject = topic.trim().replace(/[?.!]+$/, '').replace(THE_ASKING_WORDS, '').replace(/\s+(?:now|these days|nowadays)$/i, '').trim();
    return subject.length >= 2 ? subject : null;
}

interface AnAnswer { line: string; exact: boolean; learned?: { kind: 'cultivator' | 'sect' | 'place'; id: string; name: string } }

function placeName(state: WorldState, id: string | null | undefined): string | null {
    return id ? state.locations.find(l => l.id === id)?.name ?? null : null;
}

/** The office's best guess for something it cannot place: the nearest exchange that matters. */
function theBestGuess(state: WorldState, from: LocationRecord, subject: string): AnAnswer {
    const graph = routeQueriesFor(state.locations);
    const days = graph.treeFrom(from.id).days;
    const exchange = state.locations.filter(isACityThatMatters)
        .sort((a, b) => (days.get(a.id) ?? Infinity) - (days.get(b.id) ?? Infinity) || a.id.localeCompare(b.id))[0];
    return { exact: false, line: exchange
        ? `Their best guess for ${subject} is the exchange at ${exchange.name}: most things that are anywhere pass through one, and it is the nearest that matters. It is a guess, and they say so.`
        : `They cannot place ${subject}, and they will not invent a place for it.` };
}

function whereItIs(game: GameService, cultivator: Cultivator, state: WorldState, here: LocationRecord, subject: string): AnAnswer {
    const resolved = resolveAnything(game.repos, subject, cultivator, undefined, whereYouStandOnYourHousesRoll(game, cultivator));
    // The office keeps the world's people, not only the ones on the cultivator table: a name that
    // is exactly one person's, alive or dead, is theirs.
    const wantedName = subject.toLowerCase().replace(/^(?:the|a|an)\s+/, '');
    const byName = resolved ? [] : state.npcs.filter(n => n.name.toLowerCase() === wantedName);
    const named = resolved ?? (byName.length === 1 ? { kind: 'cultivator' as const, id: byName[0]!.id, name: byName[0]!.name } : null);
    if (named?.kind === 'cultivator') {
        const person = state.npcs.find(n => n.id === named.id);
        if (person?.status === 'alive') {
            const at = placeName(state, routineOf(state, person).locationId);
            if (at) return { exact: true, line: `${named.name} is at ${at} this hour.`,
                learned: { kind: 'cultivator', id: named.id, name: named.name } };
        }
        if (person && person.status !== 'alive') return { exact: true, line: `${named.name} is dead. The office keeps that too.`,
            learned: { kind: 'cultivator', id: named.id, name: named.name } };
    }
    if (named?.kind === 'sect') {
        const house = state.factions.find(h => h.id === named.id);
        const seat = placeName(state, house?.seatLocationId);
        if (seat) return { exact: true, line: `${named.name} sits at ${seat}.`, learned: { kind: 'sect', id: named.id, name: named.name } };
    }
    if (named?.kind === 'place') {
        const place = state.locations.find(l => l.id === named.id || l.name === named.name);
        const province = placeName(state, place?.parentId);
        if (place) return { exact: true, line: province ? `${place.name} is in ${province}.` : `${place.name} is where the map says.`,
            learned: { kind: 'place', id: place.id, name: place.name } };
    }
    if (named?.kind === 'technique') {
        const teachers = getSectsTeaching(named.id).map(s => state.factions.find(h => h.id === s.id && h.dissolvedOnDay === null))
            .filter((h): h is NonNullable<typeof h> => h !== undefined);
        if (teachers.length) {
            const first = teachers[0]!;
            return { exact: true, line: `${named.name} is taught by ${teachers.map(h => h.name).join(', ')}`
                + (placeName(state, first.seatLocationId) ? `; ${first.name} sits at ${placeName(state, first.seatLocationId)}.` : '.'),
            learned: { kind: 'sect', id: first.id, name: first.name } };
        }
    }
    // A named thing somebody holds or keeps.
    const wanted = subject.toLowerCase().replace(/^(?:the|a|an)\s+/, '');
    const thing = state.objects.find(o => o.name.toLowerCase() === wanted);
    if (thing) {
        const holder = thing.possessorId ? state.npcs.find(n => n.id === thing.possessorId) : undefined;
        const at = holder && holder.status === 'alive' ? placeName(state, routineOf(state, holder).locationId) : placeName(state, thing.locationId);
        if (at) return { exact: true, line: holder ? `${thing.name} is with ${holder.name}, at ${at}.` : `${thing.name} is kept at ${at}.` };
    }
    return theBestGuess(state, here, subject);
}

/** Null unless this is a where-question put to a Flowing Star clerk at their own office. */
export function askingTheFlowingStarOffice(game: GameService, cultivator: Cultivator, askedId: string,
    topic: string): Execution | null {
    const subject = whatTheyAreLookingFor(topic);
    const world = game.atHand;
    if (!subject || !world) return null;
    const here = world.locations.find(l => l.id === game.worldPlaceOf(cultivator));
    const clerk = world.npcs.find(n => n.id === askedId);
    if (!here || !clerk || clerk.factionId !== THE_STAR_HOUSE_ID || theShopfrontOf(world, THE_STAR_HOUSE_ID, here) === null
        || !game.present(cultivator).some(p => p.id === askedId)) return null;
    if (cultivator.spiritStones < AN_OFFICE_QUESTION_STONES) {
        return refused('engine.theFlowingStarOffice', 'interact', factsForRefusal(
            'Not for what you are carrying.',
            `A question at the Flowing Star office is ${AN_OFFICE_QUESTION_STONES} spirit stones, paid before it is answered; you are carrying ${cultivator.spiritStones}.`,
            'Nothing was paid and nothing was answered.'));
    }
    const answer = whereItIs(game, cultivator, world, here, subject);
    const paid = game.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: -AN_OFFICE_QUESTION_STONES });
    if (!paid) return null;
    clerk.spiritStones += AN_OFFICE_QUESTION_STONES;
    clerk.updatedOnDay = world.currentDay;
    game.theWorldMoved();
    if (answer.learned) {
        game.knowledge.learnIfNew({ holderId: cultivator.id, onDay: Math.floor(game.currentRun().run.elapsedDays),
            kind: answer.learned.kind, id: answer.learned.id, name: answer.learned.name, stage: 'placed', sourceKind: 'told',
            fromHolderId: clerk.id, sourceNote: 'The Flowing Star office placed it for a fee.' });
    }
    const lines = [`You pay the Flowing Star office ${AN_OFFICE_QUESTION_STONES} spirit stones.`, answer.line];
    return {
        facts: observable(answer.exact ? 'The office places it.' : 'The office gives its best guess.', lines, lines.join('\n\n'),
            [`Flowing Star office at ${here.name}: "${subject}" ${answer.exact ? 'placed exactly' : 'answered as a guess'}; `
                + `${AN_OFFICE_QUESTION_STONES} stones to ${clerk.id}.`]),
        events: [], timeSkip: null, breakthrough: null, outcome: 'executed',
        calls: [{ name: 'engine.theFlowingStarOffice', action: 'ask',
            summary: `${clerk.name} answered "${subject}" ${answer.exact ? 'exactly' : 'with a guess'} for ${AN_OFFICE_QUESTION_STONES} stones.`, ok: true }]
    };
}
