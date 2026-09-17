/**
 * The player sends word on a communication talisman, and cuts them.
 *
 * The engine half is `src/engine/world/a-communication-talisman-carries-word-home.ts`
 * and the catalog row is `src/data/cultivation/communication-talismans.ts`. This
 * is the player's end of both: a pouch stack, the sentence that burns one, and
 * the sentence that cuts more.
 *
 * ── THE PLAYER'S STACK IS A POUCH ROW ────────────────────────────────────
 *
 * Counted stock in a pouch is a catalog id and a number, and a communication
 * talisman is marked with a house, so the id carries the mark:
 * `communication-talisman:<house id>`, kind `talisman`. One stack per mark, the
 * same one-per-holder-per-mark the world's own stacks keep.
 *
 * ── SENDING WORD ─────────────────────────────────────────────────────────
 *
 * "I burn a communication talisman to tell my master that...", "I send word to
 * the sect that...". The slip answers to the house its mark names and nobody
 * else, so word to a person goes to that person's house, addressed to them.
 * What refuses is a count or a distance and the refusal says which: no slip of
 * that mark, or a hall further than a slip carries. What it writes is one fact
 * the house holds (`theWordArrives`), and no time passes.
 *
 * NOTHING COMES BACK ON IT. A slip answers to a house, not to a person, so an
 * answer reaches the player when they are at the house or somebody walks it to
 * them. That is said, because the player would otherwise wait for a reply.
 *
 * ── CUTTING THEM ─────────────────────────────────────────────────────────
 *
 * "I make some communication talismans", "I cut five communication talismans
 * for the sect". At Foundation or above, and marked with the player's own house,
 * so somebody with no house cuts none: a mark is whose it is. For themselves, into
 * the pouch; for the house, into the house's stock and credited as contribution
 * at the price the house's own notice for the work carries (`dutyTermsFor`),
 * which is what the house's own people are credited for the same work.
 */

import type Database from 'better-sqlite3';

import {
    CUT_IN_A_SITTING,
    THE_COMMUNICATION_TALISMAN,
    WHO_CAN_CUT_A_COMMUNICATION_TALISMAN,
    couldCutACommunicationTalisman,
    daysToCut
} from '../data/cultivation/communication-talismans.js';
import { getSendingReason } from '../data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import { rankName } from '../engine/cultivation/realms.js';
import { dutyTermsFor } from '../engine/encounters/duties.js';
import { aPostingAsAnOffer } from '../engine/encounters/what-a-house-has-on-its-board.js';
import {
    addToTheStack,
    theWordArrives,
    whetherWordReachesTheHouse,
    type WhoTheWordIsFor
} from '../engine/world/a-communication-talisman-carries-word-home.js';
import { THE_INTERNAL_AFFAIRS_ELDER } from '../engine/world/a-house-knows-its-own-by-a-lamp-and-a-token.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { AmbientQi, Cultivator, Run } from '../schema/cultivation.js';
import {
    addToPouch,
    removeFromPouch
} from '../server/consolidated/cultivation-support.js';
import { theMasterTheyKneltTo } from './encounters.js';
import { worldLocationFor } from './entities.js';
import { factsForRefusal, factsForToolResult } from './facts.js';
import type { GameService } from './turn-engine.js';
import { refused } from './tool-result-prose.js';
import type { Execution } from './turn-wire-shapes.js';
import { whatIsBeingCut } from './communication-talisman-phrasings.js';

// ─────────────────────────────────────────────────────────────────────────
// THE POUCH STACK
// ─────────────────────────────────────────────────────────────────────────

const A_MARKED_SLIP = `${THE_COMMUNICATION_TALISMAN.id}:`;

/** The pouch id of a stack of one house's communication talismans. */
export function pouchIdForCommunicationTalismans(houseId: string): string {
    return `${A_MARKED_SLIP}${houseId}`;
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
        + `. Each carries word to the house it is marked with, as far as `
        + `${THE_COMMUNICATION_TALISMAN.reachWalkingDays} walking days.`
    ];
}

// ─────────────────────────────────────────────────────────────────────────
// WHO IT IS FOR
// ─────────────────────────────────────────────────────────────────────────

interface Addressee {
    houseId: string;
    to: WhoTheWordIsFor;
    /** How the player named them, for the lines. */
    called: string;
}

function whoTheWordIsFor(
    game: GameService,
    world: WorldState,
    cultivator: Cultivator,
    named: string
): Addressee | { refusal: string } {
    const said = named.toLowerCase().replace(/^(?:to\s+)/, '').trim();
    const own = cultivator.sectId ?? null;
    const noHouse = 'You have no house. A communication talisman answers to the house it is marked with, '
        + 'and there is no house for word from you to go to.';

    if (/^(?:my|our)\s+(?:master|teacher|shifu|shizun)\b/.test(said)) {
        const masterId = theMasterTheyKneltTo(game.repos, cultivator.id);
        if (masterId === null) return { refusal: 'You have no master to send word to.' };
        const row = world.npcs.find(n => n.id === masterId);
        const name = row?.name ?? game.repos.cultivators.getById(masterId)?.name ?? 'your master';
        const houseId = row?.factionId ?? own;
        if (houseId === null) return { refusal: `${name} has no house for word to go to.` };
        return { houseId, to: { kind: 'a_person', id: masterId, name }, called: name };
    }
    if (/\binternal\s+affairs\b/.test(said)) {
        if (own === null) return { refusal: noHouse };
        return { houseId: own, to: { kind: 'an_office', title: THE_INTERNAL_AFFAIRS_ELDER, holderId: null }, called: `the ${THE_INTERNAL_AFFAIRS_ELDER}` };
    }
    if (/^(?:(?:my|our|the)\s+(?:sect|house|hall|clan|family|elders?|patriarch|matriarch|sect\s+master)|home)\b/.test(said)) {
        if (own === null) return { refusal: noHouse };
        const house = world.factions.find(f => f.id === own);
        return { houseId: own, to: { kind: 'the_hall' }, called: house?.name ?? 'your house' };
    }
    const house = world.factions.find(f => f.dissolvedOnDay === null
        && (f.name.toLowerCase() === said || f.name.toLowerCase().replace(/^the\s+/, '') === said.replace(/^the\s+/, '')));
    if (house) return { houseId: house.id, to: { kind: 'the_hall' }, called: house.name };
    const person = world.npcs.find(n => n.status === 'alive' && n.name.toLowerCase() === said);
    if (person) {
        if (person.factionId === null) {
            return { refusal: `${person.name} is of no house, and a communication talisman answers to a house.` };
        }
        return { houseId: person.factionId, to: { kind: 'a_person', id: person.id, name: person.name }, called: person.name };
    }
    return {
        refusal: `Nobody the world knows answers to "${named}". Word on a communication talisman goes to `
            + 'a house, or to somebody of one: "I send word to my master that...", "I send word to the sect that...".'
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
        if (!world) return refuse('There is no world for word to cross.', 'Nothing is loaded to carry it.', 'send word: no world.');

        const who = whoTheWordIsFor(this, world, cultivator, target ?? '');
        if ('refusal' in who) return refuse('Word to whom?', who.refusal, `send word: no addressee for "${target ?? ''}".`);
        const says = (topic ?? '').trim().slice(0, 240);
        if (says.length === 0) {
            return refuse('Send word of what?', 'A communication talisman carries a short message, and there is nothing to put in it. '
                + `Say it: "I send word to ${who.called} that...".`, 'send word: no message.');
        }

        const house = world.factions.find(f => f.id === who.houseId);
        const houseName = house?.name ?? 'that house';
        const held = theCommunicationTalismansOnYou(this.db, cultivator.id);
        const ofThisMark = held.find(h => h.houseId === who.houseId)?.count ?? 0;
        if (ofThisMark === 0) {
            const others = held.map(h => world.factions.find(f => f.id === h.houseId)?.name ?? h.houseId);
            return refuse(
                'You have no slip for it.',
                (others.length > 0
                    ? `The communication talismans you carry are marked with ${others.join(' and ')}, and a slip `
                      + `answers to the house it is marked with. None of them reaches ${houseName}.`
                    : 'You carry no communication talisman.')
                + ` Word to ${who.called} goes on one marked with ${houseName}, or on foot.`,
                `send word: 0 slips marked ${who.houseId}; carrying ${held.map(h => `${h.count} of ${h.houseId}`).join(', ') || 'none'}.`
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
        const fact = theWordArrives(world, {
            senderId: cultivator.id,
            senderName: cultivator.name,
            houseId: who.houseId,
            fromLocationId: here?.id ?? null,
            onDay: Math.floor(world.currentDay),
            to: who.to,
            says,
            walkingDays: reach.walkingDays
        });
        this.theWorldMoved();

        const left = ofThisMark - 1;
        const lines = [
            `You burn a communication talisman marked with ${houseName}, and the word goes to `
            + `${who.to.kind === 'the_hall' ? `its hall` : who.called}: ${says}`,
            `${left} marked with ${houseName} left.`,
            'Nothing comes back on it. A communication talisman answers to a house and not to you, so an '
            + 'answer reaches you at the house, or on somebody who walks it out to you.'
        ];
        const facts = factsForToolResult('The slip burns and the word is gone.', lines);
        facts.structure.push(
            `send word: ${fact?.id ?? 'no fact'} to ${who.houseId} (${who.to.kind}), ${reach.walkingDays} walking days, `
            + `1 slip burnt, ${left} left of that mark.`
        );
        facts.required = lines.slice(0, 1);
        const answer = this.freeAction(run, 'tell', facts);
        answer.calls = [{
            name: 'world.theWordArrives',
            action: 'tell',
            summary: `${cultivator.id} sent word to ${who.houseId}${fact ? ` as ${fact.id}` : ''}.`,
            ok: true
        }];
        return answer;
    },

    /** Cut communication talismans, for yourself or for the house. */
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
                'A communication talisman is marked with a house and carries word to it. You have no house, '
                + 'so there is nothing for a slip you cut to answer to.',
                'cut communication talismans: no house. Nothing spent.'
            );
        }

        const days = daysToCut(ask.count);
        const spent = await this.shortSkip(run, cultivator, ambient, 0.35, 'Cutting communication talismans', days);
        const after = this.repos.cultivators.getById(cultivator.id) ?? cultivator;
        if (!after.alive) return spent;

        this.atHand = this.atHand ?? await this.loadWorld();
        const world = this.atHand;
        const houseName = world?.factions.find(f => f.id === houseId)?.name
            ?? this.repos.sects.getById(houseId)?.name ?? 'your house';

        const lines = [...spent.facts.lines];
        if (ask.forTheHouse && world) {
            const seat = world.factions.find(f => f.id === houseId)?.seatLocationId ?? null;
            const now = addToTheStack(world.objects, {
                houseId, houseName, holderId: null, count: ask.count, locationId: seat,
                onDay: Math.floor(world.currentDay)
            });
            this.theWorldMoved();
            const membership = this.repos.sects.getMembership(cultivator.id);
            const reason = getSendingReason('sending-to-cut-communication-talismans');
            const credit = membership && reason
                ? dutyTermsFor(
                    aPostingAsAnOffer({
                        reason,
                        house: { id: houseId, name: houseName },
                        pitchOrdinal: after.realmOrdinal
                    }),
                    after.realmOrdinal,
                    {
                        factionId: houseId,
                        factionName: houseName,
                        rankIndex: membership.rankIndex,
                        rankCount: this.repos.sects.getById(houseId)?.ranks.length ?? 1,
                        contribution: membership.contribution
                    },
                    'commission'
                ).contribution
                : 0;
            if (membership && credit > 0) this.repos.sects.addContribution(houseId, cultivator.id, credit);
            lines.push(
                `You cut ${ask.count} communication talisman${ask.count === 1 ? '' : 's'} marked with `
                + `${houseName} and they go into its stores, which now hold ${now}.`,
                credit > 0 ? `${houseName} counts it as work for the house: ${credit} contribution.` :
                    `${houseName} does not count work from somebody not on its roll.`
            );
        } else {
            addToPouch(this.db, cultivator.id, pouchIdForCommunicationTalismans(houseId), 'talisman', ask.count);
            lines.push(
                `You cut ${ask.count} communication talisman${ask.count === 1 ? '' : 's'} marked with ${houseName}. `
                + `Each carries word to ${houseName} once, as far as `
                + `${THE_COMMUNICATION_TALISMAN.reachWalkingDays} walking days.`
            );
        }

        const facts = factsForToolResult(`${days} day${days === 1 ? '' : 's'} at the paper.`, lines);
        facts.structure.push(
            ...spent.facts.structure,
            `cut communication talismans: ${ask.count} marked ${houseId}, ${days} day(s), `
            + (ask.forTheHouse ? 'into the house stock.' : 'into the pouch.')
        );
        facts.required = lines.slice(-2);
        return { ...spent, facts, outcome: 'executed' };
    }
};
