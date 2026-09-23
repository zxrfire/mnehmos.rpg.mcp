/**
 * The player sends word on a communication talisman, and cuts them.
 *
 * The engine half is `src/engine/world/a-communication-talisman-carries-word-home.ts`
 * and the catalog row is `src/data/cultivation/communication-talismans.ts`. This
 * is the player's end of both: a pouch stack, the sentence that burns one, and
 * the sentence that cuts more.
 *
 * ── THE PLAYER'S HALF IS A POUCH ROW ─────────────────────────────────────
 *
 * Counted stock in a pouch is a catalog id and a number, and a communication
 * talisman is marked with a house, so the id carries the mark:
 * `communication-talisman:<house id>`, kind `talisman`. The pouch is the
 * player's, so every slip in it is keyed to them; its twins are world rows in
 * the house's hall, the same as anybody's (`keepTheTwins`).
 *
 * ── SENDING WORD ─────────────────────────────────────────────────────────
 *
 * "I send word to the sect that...". A slip arrives at its twin, and a house's
 * twins are kept in its hall, so word goes to the hall of the house that keyed
 * the slip and is read there by a person (`whoReadsTheHall`). A person is not an
 * address: the refusal says where the player's slips do reach. What refuses is a
 * count or a distance and the refusal says which: no slip of that mark, no twin
 * kept, or a hall further than a slip carries. What it writes is one fact, with
 * the reader on it (`theWordArrives`), and no time passes.
 *
 * NOTHING COMES BACK ON IT. An answer reaches the player when they are at the
 * house or somebody walks it to them. That is said, because the player would
 * otherwise wait for a reply.
 *
 * ── CUTTING THEM ─────────────────────────────────────────────────────────
 *
 * "I make some communication talismans", "I cut five communication talismans
 * for the sect". At Foundation or above, and marked with the player's own house,
 * so somebody with no house cuts none: a mark is whose it is. For themselves,
 * pairs, two slips each: the half into the pouch and the twin to the hall - no
 * permission and no merit, which is the whole of what that half asks. For
 * the house, blanks into its treasury, credited as contribution for the days it
 * took (`whatServiceIsWorth`) and paid for what went in (`whatCuttingPays`),
 * which is what somebody of the house sitting down to the same work between other
 * work is credited and paid - and THAT half is an office's work. Internal
 * Affairs cuts the house's own blanks, so a member who has not been handed the
 * seal is told so and told who has: `who-cuts-the-houses-slips.ts`.
 *
 * IT WAS THE NOTICE'S PRICE, and a notice is a month: a player cutting one slip in
 * a day was credited the month's contribution for it, again and again.
 */

import type Database from 'better-sqlite3';

import {
    CUT_IN_A_SITTING,
    DAYS_A_SITTING_TAKES,
    THE_COMMUNICATION_TALISMAN,
    WHO_CAN_CUT_A_COMMUNICATION_TALISMAN,
    couldCutACommunicationTalisman,
    daysToCut
} from '../data/cultivation/communication-talismans.js';
import { rankName } from '../engine/cultivation/realms.js';
import {
    addToTheStack,
    howManyTwinsTheHallKeeps,
    keepTheTwins,
    takeOneTwin,
    theWordArrives,
    whetherWordReachesTheHouse,
    whoReadsTheHall
} from '../engine/world/a-communication-talisman-carries-word-home.js';
import { THE_INTERNAL_AFFAIRS_ELDER } from '../engine/world/a-house-knows-its-own-by-a-lamp-and-a-token.js';
import { whereThisHouseBurnsItsLamps } from '../engine/world/a-recruit-is-given-their-lamp-at-the-house.js';
import { sendWordOnJade, whoTheirJadeReaches } from '../engine/world/a-pair-of-communication-jade.js';
import { theMasterTheyKneltTo } from './encounters.js';
import { whatServiceIsWorth } from '../engine/world/what-a-house-counts-in-somebodys-favour.js';
import { whatCuttingPays } from '../engine/world/what-a-house-hears-from-its-people-away.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { AmbientQi, Cultivator, Run } from '../schema/cultivation.js';
import {
    addToPouch,
    removeFromPouch
} from '../server/consolidated/cultivation-support.js';
import { worldLocationFor } from './entities.js';
import { factsForRefusal, factsForToolResult } from './facts.js';
import type { GameService } from './turn-engine.js';
import { refused } from './tool-result-prose.js';
import { BENCH_FOCUS } from './turn-constants.js';
import type { Execution } from './turn-wire-shapes.js';
import { whatIsBeingCut } from './communication-talisman-phrasings.js';
import { positionIn } from './standing.js';
import {
    whetherTheyMayCutForTheHouse,
    whyTheHousesSlipsAreNotTheirsToCut
} from './who-cuts-the-houses-slips.js';

// ─────────────────────────────────────────────────────────────────────────
// THE POUCH STACK
// ─────────────────────────────────────────────────────────────────────────

const A_MARKED_SLIP = `${THE_COMMUNICATION_TALISMAN.id}:`;

/** The pouch id of a stack of one house's communication talismans. */
export function pouchIdForCommunicationTalismans(houseId: string): string {
    return `${A_MARKED_SLIP}${houseId}`;
}

/** Whether a pouch row is a stack of communication talismans. */
export function isACommunicationTalismanInAPouch(itemId: string): boolean {
    return itemId.startsWith(A_MARKED_SLIP);
}

/** Every mark in this pouch, with how many. */
export function theCommunicationTalismansOnYou(
    db: Database.Database,
    holderId: string
): { houseId: string; count: number }[] {
    const rows = db
        .prepare(
            "SELECT item_id, quantity FROM cultivator_pouch WHERE holder_id = ? AND item_kind = 'talisman' "
            + 'AND quantity > 0 ORDER BY item_id'
        )
        .all(holderId) as { item_id: string; quantity: number }[];
    return rows
        .filter(r => r.item_id.startsWith(A_MARKED_SLIP))
        .map(r => ({ houseId: r.item_id.slice(A_MARKED_SLIP.length), count: r.quantity }));
}

/** The inventory's line for them, or nothing. */
export function theLineForCommunicationTalismans(
    held: readonly { houseId: string; count: number }[],
    nameOf: (houseId: string) => string
): string[] {
    if (held.length === 0) return [];
    return [
        'Communication talismans: '
        + held.map(h => `${h.count} marked with ${nameOf(h.houseId)}`).join(', ')
        + `, keyed to you. Each carries word to its twin in that house's hall, as far as `
        + `${THE_COMMUNICATION_TALISMAN.reachWalkingDays} walking days.`
    ];
}

// ─────────────────────────────────────────────────────────────────────────
// WHO IT IS FOR
// ─────────────────────────────────────────────────────────────────────────

interface Addressee {
    /** The house whose hall the slip's twin is kept in. */
    houseId: string;
    /** How the player named them, for the lines. */
    called: string;
}

/**
 * The person a sentence names, where it names one: "my master", or somebody the
 * world holds by name. Null where it names a house, a hall, or nobody.
 */
function thePersonNamed(
    game: GameService,
    world: WorldState,
    cultivator: Cultivator,
    named: string
): { id: string; name: string } | null {
    const said = named.toLowerCase().replace(/^(?:to\s+)/, '').trim();
    if (/^(?:my|our)\s+(?:master|teacher|shifu|shizun)\b/.test(said)) {
        const masterId = theMasterTheyKneltTo(game.repos, cultivator.id);
        if (masterId === null) return null;
        const row = world.npcs.find(n => n.id === masterId);
        return { id: masterId, name: row?.name ?? game.repos.cultivators.getById(masterId)?.name ?? 'your master' };
    }
    const person = world.npcs.find(n => n.status === 'alive' && n.name.toLowerCase() === said);
    return person ? { id: person.id, name: person.name } : null;
}

/** The names, said the way a person says a short list of them. */
function saidAsAList(names: readonly string[]): string {
    if (names.length <= 2) return names.join(' and ');
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Whose hall the word goes to. A slip arrives at its twin, and the twins of a
 * house's slips are kept in its hall, so the only place a slip can reach is the
 * hall of the house that keyed it. A person is reached there or not at all.
 *
 * AND WHO THEY CAN REACH ON A JADE. Asking for a person by name is the moment a
 * player is told a slip is not an address, and it is the moment they would ask
 * the obvious next thing: who CAN I reach. A cultivator knows whose half answers
 * to a half in their own pouch (`whoTheirJadeReaches`), so the refusal says it
 * rather than making them try one name at a time. WHO, AND NOT WHERE: a jade
 * pair carries word and not position, and nothing here reads a location.
 */
function whoTheWordIsFor(
    world: WorldState,
    cultivator: Cultivator,
    named: string,
    held: readonly { houseId: string; count: number }[]
): Addressee | { refusal: string } {
    const said = named.toLowerCase().replace(/^(?:to\s+)/, '').trim();
    const own = cultivator.sectId ?? null;
    const nameOf = (id: string) => world.factions.find(f => f.id === id)?.name ?? id;
    const whereTheyAnswer = held.length === 0
        ? 'You carry no communication talisman.'
        : `The communication talismans you carry are keyed to you, and their twins are kept in the hall of `
          + `${held.map(h => nameOf(h.houseId)).join(' and ')}, which is the only place they reach.`;

    if (/\binternal\s+affairs\b/.test(said)
        || /^(?:(?:my|our|the)\s+(?:sect|house|hall|clan|family|elders?|patriarch|matriarch|sect\s+master)|home)\b/.test(said)) {
        if (own === null) return { refusal: `You have no house for word to go to. ${whereTheyAnswer}` };
        return { houseId: own, called: `the hall of ${nameOf(own)}` };
    }
    const house = world.factions.find(f => f.dissolvedOnDay === null
        && (f.name.toLowerCase() === said || f.name.toLowerCase().replace(/^the\s+/, '') === said.replace(/^the\s+/, '')));
    if (house) return { houseId: house.id, called: `the hall of ${house.name}` };
    const reaches = [...new Set(whoTheirJadeReaches(world, cultivator.id))]
        .filter(id => id !== cultivator.id)
        .map(id => world.npcs.find(n => n.id === id)?.name ?? '')
        .filter(name => name.length > 0)
        .sort();
    const onJade = reaches.length === 0
        ? `Word to somebody in particular goes by hand, or on a jade whose other half they hold.`
        : `Word to somebody in particular goes by hand, or on a jade whose other half they hold: `
          + `yours answers to ${saidAsAList(reaches)}.`;
    return {
        refusal: `A communication talisman goes to the hall where its twin is kept, and not to a person. `
            + `${whereTheyAnswer} ${onJade}`
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE VERBS
// ─────────────────────────────────────────────────────────────────────────

export const communicationTalismanVerbs = {
    /** Burn one and send word. Passes no time. */
    async sendWord(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        target: string | undefined,
        topic: string | undefined
    ): Promise<Execution> {
        this.atHand = this.atHand ?? await this.loadWorld();
        const world = this.atHand;
        const refuse = (headline: string, line: string, note: string): Execution =>
            refused('engine.burnACommunicationTalisman', 'tell', factsForRefusal(headline, line, note));
        // A SUBJECT, BECAUSE THE LINE HAD NONE. "Nothing is loaded to carry it"
        // names no talisman, no recipient and no road, and reads like a system
        // error to the one reader it can reach. It is a harness state rather
        // than a world state - a player in a live session never sees it - so
        // this says what would carry the word and stops there, which costs a
        // sentence and builds nothing.
        if (!world) {
            return refuse(
                'There is no world for word to cross.',
                'A slip burns and a jade speaks, and both of them reach somebody standing '
                + 'somewhere. There is no world open for them to cross, so nothing was sent and '
                + 'nothing was spent.',
                'send word: no world.'
            );
        }

        // ── HOLDING ONE HALF NAMES THE OTHER ─────────────────────────────
        //
        // The owner's ruling, and it is the whole difference between a jade and
        // a house slip: a pair has exactly one other half by construction, so a
        // player who says "I use the jade" and names nobody has not left
        // anything open. Asking them which jade would be the engine pretending
        // not to know something it knows.
        //
        // Only where the sentence named nobody, and only where there is exactly
        // one. Somebody holding two pairs has made a real choice and is asked
        // which, with both named - that is a question, not a hedge.
        const reaches = (target ?? '').trim().length === 0
            ? whoTheirJadeReaches(world, cultivator.id)
            : [];
        if (reaches.length > 1) {
            const names = reaches
                .map(id => world.npcs.find(n => n.id === id)?.name ?? id)
                .join(', ');
            return refuse(
                'You hold more than one half.',
                `Your jade answers to ${reaches.length} people: ${names}. Say which of them you `
                + 'are speaking to.',
                `send word: ${reaches.length} jade partners for ${cultivator.id}; none named.`
            );
        }
        const named = reaches.length === 1
            ? world.npcs.find(n => n.id === reaches[0])?.name ?? reaches[0]!
            : (target ?? '');

        // ON A JADE, WHERE THEY SHARE ONE. Nothing is spent, and the word reaches
        // the person holding the other half wherever they are.
        const person = thePersonNamed(this, world, cultivator, named);
        if (person) {
            const spoken = (topic ?? '').trim().slice(0, 240);
            if (spoken.length > 0) {
                const here = worldLocationFor(world, cultivator.location ?? null);
                const onJade = sendWordOnJade(world, {
                    senderId: cultivator.id, senderName: cultivator.name,
                    toId: person.id, toName: person.name, says: spoken,
                    onDay: Math.floor(world.currentDay), fromLocationId: here?.id ?? null,
                    lampBurnsFor: id => id !== cultivator.id || cultivator.alive
                });
                if (onJade.sent) {
                    this.theWorldMoved();
                    const lines = [
                        `You speak into your half of the communication jade, and ${person.name} hears it: ${spoken}`,
                        'Nothing is spent. The jade answers to its other half for as long as you both live.'
                    ];
                    const facts = factsForToolResult('The jade carries it.', lines);
                    facts.structure.push(`send word: ${onJade.fact.id} on jade ${String(onJade.half.data.pairId)} to ${person.id}.`);
                    facts.required = lines.slice(0, 1);
                    const answer = this.freeAction(run, 'tell', facts);
                    answer.calls = [{
                        name: 'world.sendWordOnJade',
                        action: 'tell',
                        summary: `${cultivator.id} spoke to ${person.id} on a communication jade as ${onJade.fact.id}.`,
                        ok: true
                    }];
                    return answer;
                }
            }
        }

        const held = theCommunicationTalismansOnYou(this.db, cultivator.id);
        const who = whoTheWordIsFor(world, cultivator, target ?? '', held);
        if ('refusal' in who) return refuse('Word to whom?', who.refusal, `send word: no hall for "${target ?? ''}".`);
        const says = (topic ?? '').trim().slice(0, 240);
        if (says.length === 0) {
            return refuse('Send word of what?', 'A communication talisman carries a short message, and there is nothing to put in it. '
                + 'Say it: "I send word to the sect that...".', 'send word: no message.');
        }

        const house = world.factions.find(f => f.id === who.houseId);
        const houseName = house?.name ?? 'that house';
        const ofThisMark = held.find(h => h.houseId === who.houseId)?.count ?? 0;
        if (ofThisMark === 0) {
            const others = held.map(h => world.factions.find(f => f.id === h.houseId)?.name ?? h.houseId);
            return refuse(
                'You have no slip for it.',
                (others.length > 0
                    ? `The communication talismans you carry are keyed to you with their twins in the hall of `
                      + `${others.join(' and ')}. None of them reaches ${houseName}.`
                    : 'You carry no communication talisman.')
                + ` Word to ${houseName} goes on one of its slips cut for you, or on foot.`,
                `send word: 0 slips marked ${who.houseId}; carrying ${held.map(h => `${h.count} of ${h.houseId}`).join(', ') || 'none'}.`
            );
        }
        if (howManyTwinsTheHallKeeps(world.objects, who.houseId, cultivator.id) === 0) {
            return refuse(
                'Its twin is gone.',
                `The hall of ${houseName} keeps no twin of the slips you carry, so a slip you burnt would arrive nowhere. `
                + 'Nothing burnt.',
                `send word: ${ofThisMark} slip(s) of ${who.houseId} and no twins kept for ${cultivator.id}.`
            );
        }

        const here = worldLocationFor(world, cultivator.location ?? null);
        const reach = whetherWordReachesTheHouse(world, { houseId: who.houseId, fromLocationId: here?.id ?? null });
        if (reach.house === null) {
            return refuse('There is no hall for it to reach.', `${houseName} has no hall standing for word to go to.`, 'send word: house gone or seatless.');
        }
        if (!reach.reaches) {
            return refuse(
                'It will not carry that far.',
                reach.walkingDays === null
                    ? `No road the world knows runs from here to ${houseName}, and a communication talisman carries `
                      + `${THE_COMMUNICATION_TALISMAN.reachWalkingDays} walking days along one.`
                    : `${houseName} is ${reach.walkingDays} walking days from here, and a communication talisman `
                      + `carries ${THE_COMMUNICATION_TALISMAN.reachWalkingDays}.`,
                `send word: ${reach.walkingDays ?? 'no road'} walking days against a reach of `
                + `${THE_COMMUNICATION_TALISMAN.reachWalkingDays}. Nothing burnt.`
            );
        }

        removeFromPouch(this.db, cultivator.id, pouchIdForCommunicationTalismans(who.houseId), 1);
        takeOneTwin(world.objects, who.houseId, cultivator.id);
        const reader = whoReadsTheHall(world, who.houseId);
        const fact = theWordArrives(world, {
            senderId: cultivator.id,
            senderName: cultivator.name,
            houseId: who.houseId,
            fromLocationId: here?.id ?? null,
            onDay: Math.floor(world.currentDay),
            to: { kind: 'an_office', title: THE_INTERNAL_AFFAIRS_ELDER, holderId: reader?.id ?? null },
            receivedBy: reader,
            says,
            walkingDays: reach.walkingDays
        });
        this.theWorldMoved();

        const left = ofThisMark - 1;
        const lines = [
            `You burn a communication talisman keyed to you, and the word arrives at its twin in the hall of `
            + `${houseName}: ${says}`,
            reader === null
                ? `Nobody of ${houseName} is at its hall to read it.`
                : `${reader.name} reads it there.`,
            `${left} marked with ${houseName} left.`,
            'Nothing comes back on it. An answer reaches you at the house, or on somebody who walks it out to you.'
        ];
        const facts = factsForToolResult('The slip burns and the word is gone.', lines);
        facts.structure.push(
            `send word: ${fact?.id ?? 'no fact'} to the hall of ${who.houseId}, read by ${reader?.id ?? 'nobody'}, `
            + `${reach.walkingDays} walking days, 1 slip and its twin burnt, ${left} left of that mark.`
        );
        facts.required = lines.slice(0, 2);
        const answer = this.freeAction(run, 'tell', facts);
        answer.calls = [{
            name: 'world.theWordArrives',
            action: 'tell',
            summary: `${cultivator.id} sent word to the hall of ${who.houseId}${fact ? ` as ${fact.id}` : ''}.`,
            ok: true
        }];
        return answer;
    },

    /** Cut communication talismans: pairs keyed to yourself, or blanks for the house's treasury. */
    async cutCommunicationTalismans(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        said: string
    ): Promise<Execution> {
        const ask = whatIsBeingCut(said) ?? { count: CUT_IN_A_SITTING, forTheHouse: false };
        const refuse = (headline: string, line: string, note: string): Execution =>
            refused('engine.couldCutACommunicationTalisman', 'craft', factsForRefusal(headline, line, note));

        if (!couldCutACommunicationTalisman(cultivator.realmOrdinal)) {
            return refuse(
                `${rankName(cultivator.realmOrdinal)} is not the hand for it.`,
                'Putting a voice into paper wants a foundation to put it there from. You stand at '
                + `${rankName(cultivator.realmOrdinal)}, and it starts at `
                + `${rankName(WHO_CAN_CUT_A_COMMUNICATION_TALISMAN)}.`,
                `cut communication talismans: ordinal ${cultivator.realmOrdinal} against a floor of `
                + `${WHO_CAN_CUT_A_COMMUNICATION_TALISMAN}. Nothing spent.`
            );
        }
        const houseId = cultivator.sectId ?? null;
        if (houseId === null) {
            return refuse(
                'There is no house to mark them with.',
                'A communication talisman is marked with a house and arrives at its hall. You have no house, '
                + 'so there is nothing for a slip you cut to answer to.',
                'cut communication talismans: no house. Nothing spent.'
            );
        }

        // ── AND THE HOUSE'S OWN BLANKS ARE AN OFFICE'S WORK ──────────────
        //
        // The meritorious half is Internal Affairs': *"the internal affairs
        // elder crafts them, or his disciples who work in internal affairs."*
        // Anybody at Foundation cutting a PAIR FOR THEMSELVES is untouched by
        // this - no permission and no merit - and the refusal below is the
        // house's rather than the verb's: nobody has handed them the seal.
        // Before the days, because a refusal must not cost any. See
        // `who-cuts-the-houses-slips.ts`.
        this.atHand = this.atHand ?? await this.loadWorld();
        if (ask.forTheHouse && this.atHand) {
            const stands = positionIn(this.repos, cultivator.id);
            const theirs = whetherTheyMayCutForTheHouse(
                this.atHand, this.repos, cultivator.id, houseId, stands?.rankIndex ?? 0
            );
            if (theirs.may === null) {
                const name = this.atHand.factions.find(f => f.id === houseId)?.name
                    ?? this.repos.sects.getById(houseId)?.name ?? 'your house';
                const said = whyTheHousesSlipsAreNotTheirsToCut(name, theirs.whoDoes);
                const facts = factsForRefusal('Not yours to cut.', said.join(' '), theirs.structure);
                facts.lines = said.slice();
                facts.required = said.slice(0, 1);
                return refused('engine.whetherTheyMayCutForTheHouse', 'craft', facts);
            }
        }

        // A PAIR IS TWO SLIPS. For yourself each is a pair, the half you carry and
        // the twin the hall keeps; for the house each is one blank.
        const slipsEach = ask.forTheHouse ? 1 : 2;
        const days = daysToCut(ask.count * slipsEach);
        const spent = await this.shortSkip(run, cultivator, ambient, BENCH_FOCUS, 'Cutting communication talismans', days);
        const after = this.repos.cultivators.getById(cultivator.id) ?? cultivator;
        if (!after.alive) return spent;

        // WHAT THE DAYS SPENT CUT, NOT WHAT WAS ASKED. A span can be broken off
        // (somebody arrives, the world cuts in), and thirty slips were landing in
        // the pouch after one day of a ten-day sitting, which made the drawerful
        // cost a day of cultivation instead of ten.
        const lived = Math.min(days, spent.timeSkip?.simulatedDays ?? days);
        const slipsCut = Math.floor(lived / DAYS_A_SITTING_TAKES) * CUT_IN_A_SITTING;
        const cut = Math.min(ask.count, Math.floor(slipsCut / slipsEach));
        const ofWhatWasAsked = cut < ask.count ? ` of the ${ask.count} you sat down to` : '';

        this.atHand = this.atHand ?? await this.loadWorld();
        const world = this.atHand;
        const houseName = world?.factions.find(f => f.id === houseId)?.name
            ?? this.repos.sects.getById(houseId)?.name ?? 'your house';
        const seat = world?.factions.find(f => f.id === houseId)?.seatLocationId ?? null;

        const lines = [...spent.facts.lines];
        if (cut === 0) {
            lines.push(`Nothing cut: the sitting was broken off after ${lived} day${lived === 1 ? '' : 's'}, short of a whole one.`);
        } else if (ask.forTheHouse && world) {
            const now = addToTheStack(world.objects, {
                houseId, houseName, holderId: null, count: cut, locationId: seat,
                onDay: Math.floor(world.currentDay)
            });
            this.theWorldMoved();
            const membership = this.repos.sects.getMembership(cultivator.id);
            const credit = membership ? Math.max(1, Math.round(whatServiceIsWorth(after.realmOrdinal, lived))) : 0;
            const paid = membership ? whatCuttingPays(cut, after.realmOrdinal) : 0;
            if (credit > 0) this.repos.sects.addContribution(houseId, cultivator.id, credit);
            if (paid > 0) this.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: paid });
            lines.push(
                `You cut ${cut} blank communication talisman${cut === 1 ? '' : 's'}${ofWhatWasAsked} marked with `
                + `${houseName} and they go into its treasury, keyed to nobody, which now holds ${now}.`,
                credit > 0
                    ? `${houseName} counts it as work for the house: ${credit} contribution`
                      + (paid > 0 ? `, and ${paid} spirit stone${paid === 1 ? '' : 's'} for what went in.` : '.')
                    : `${houseName} does not count work from somebody not on its roll.`
            );
        } else {
            addToPouch(this.db, cultivator.id, pouchIdForCommunicationTalismans(houseId), 'talisman', cut);
            if (world) {
                keepTheTwins(world.objects, {
                    houseId, houseName, senderId: cultivator.id, senderName: cultivator.name, count: cut,
                    hallLocationId: whereThisHouseBurnsItsLamps(world.locations, houseId) ?? seat,
                    onDay: Math.floor(world.currentDay)
                });
                this.theWorldMoved();
            }
            lines.push(
                `You cut ${cut} communication talisman${cut === 1 ? '' : 's'}${ofWhatWasAsked} keyed to you and marked `
                + `with ${houseName}, and their twins go to its hall. Each carries word there once, as far as `
                + `${THE_COMMUNICATION_TALISMAN.reachWalkingDays} walking days.`
            );
        }

        const facts = factsForToolResult(`${lived} day${lived === 1 ? '' : 's'} at the paper.`, lines);
        facts.structure.push(
            ...spent.facts.structure,
            `cut communication talismans: ${cut} of ${ask.count} asked, marked ${houseId}, ${lived} of ${days} day(s), `
            + (ask.forTheHouse ? 'blanks into the treasury.' : 'pairs, keyed halves into the pouch and twins to the hall.')
        );
        facts.required = lines.slice(-2);
        return { ...spent, facts, outcome: 'executed' };
    }
};
