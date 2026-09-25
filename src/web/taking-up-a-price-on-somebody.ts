/**
 * The player's side of a price a house has put on somebody: taking it up, and
 * bringing the house what it asked for.
 *
 * The engine half is `engine/world/a-house-puts-a-price-on-somebody.ts`, which
 * posts the papers, says which still stand, and pays on one. Nothing here adds
 * a store:
 *
 *   taking it up   an oath on the ledger, the way a duty off a board is taken
 *                  (`acceptDuty`): who, for which house, on what terms, due the
 *                  day the paper comes down. It spends no day and binds nobody
 *                  to anything but their word
 *   bringing it in at the house - inside its walls, or to one of its people
 *                  standing here, the rule handing a thing in keeps - with the
 *                  world holding a death that names the player as the killer.
 *                  The oath is settled whether it was taken first or not, the
 *                  way `completeDuty` settles a word it re-derives: the paper
 *                  pays whoever brings what it asks for
 *
 * A house that does not pay leaves the player holding an account against it,
 * because a wrong done to the player is a wrong.
 *
 * A price on the player is read off the same wall as anybody's, and cannot be
 * taken up by them: the paper pays for a death, and there would be nobody left
 * to collect it.
 */

import {
    aPriceIsBroughtIn,
    theDeathTheyAreHeldFor,
    thePaperHangsAt,
    thePapersNotYetPaidOn,
    thePricesStanding,
    type PersonBounty
} from '../engine/world/a-house-puts-a-price-on-somebody.js';
import { createGrudge, createOath, settleObligation, type ObligationRecord } from '../engine/social/grudges.js';
import { theSeatOfTheCompound } from '../engine/world/where-inside-a-house-somebody-is-standing.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import { ledgerAbout, writeOneObligation } from '../storage/repos/obligation.repo.js';
import { matchScore } from './entities.js';
import { factsForRefusal, factsForToolResult } from './facts.js';
import { refused } from './tool-result-prose.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

/** How close a name has to be before it is the person they meant. `destroy`'s figure. */
const CLOSE_ENOUGH = 60;

/** The tag every price-oath carries, and the one naming which paper. */
const A_PRICE_TAKEN_UP = 'price';
const ON_THE_PAPER = 'paper:';

/** The papers whose name the words reach, best first. */
function thePapersNamed(papers: readonly PersonBounty[], said: string): PersonBounty[] {
    const scored = papers
        .map(paper => ({ paper, score: Math.max(matchScore(said, paper.targetName), matchScore(said, paper.posterName)) }))
        .filter(row => row.score >= CLOSE_ENOUGH)
        .sort((a, b) => b.score - a.score);
    const best = scored[0]?.score;
    return scored.filter(row => row.score === best).map(row => row.paper);
}

function theWordGivenOn(db: GameService['db'], cultivatorId: string, paperId: string): ObligationRecord | null {
    return ledgerAbout(db, cultivatorId).find(row =>
        row.kind === 'oath' && row.holderId === cultivatorId && row.status === 'open'
        && row.tags.includes(A_PRICE_TAKEN_UP) && row.tags.includes(`${ON_THE_PAPER}${paperId}`)) ?? null;
}

function theWordFor(cultivator: Cultivator, paper: PersonBounty, onDay: number, dueOnDay: number): ObligationRecord {
    return createOath({
        holderId: cultivator.id,
        subjectId: paper.posterFactionId ?? 'unaffiliated',
        cause: 'other',
        severity: 'slight',
        onDay,
        description: `Took up ${paper.posterName}'s price on ${paper.targetName}.`,
        terms: `${paper.purseStones} spirit stones for ${paper.targetName}, paid on ${paper.evidence}.`,
        dueOnDay,
        tags: [A_PRICE_TAKEN_UP, `${ON_THE_PAPER}${paper.id}`, `on:${paper.targetId}`]
    });
}

export const priceVerbs = {
    /**
     * Take up a price, or with nobody named, read the prices up where the
     * player is standing. Spends no day.
     */
    async takeUpAPrice(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        target: string | undefined
    ): Promise<Execution> {
        this.atHand = this.atHand ?? await this.loadWorld();
        const world = this.atHand;
        if (!world) {
            return refused('engine.aPrice', 'sect', factsForRefusal(
                'There is no world to have put a price on anybody.',
                'Nobody has put paper up on anybody, because there is no world running for them to live in.',
                'price: world off. Nothing written.'
            ));
        }
        const here = (cultivator.location ?? '').trim();
        const standing = thePricesStanding(world, world.currentDay);
        const upHere = standing.filter(paper => thePaperHangsAt(paper, here));
        const said = (target ?? '').trim();

        if (said.length < 2) {
            const lines = upHere.length > 0
                ? upHere.map(paper => `${paper.posterName} will pay ${paper.purseStones} spirit stones for `
                    + `${paper.targetName}, ${paper.forWhat}. It pays on ${paper.evidence}.`)
                : [`No house has a price up on anybody on the walls at ${here || 'this place'}.`];
            return this.freeAction(run, 'sect', factsForToolResult(
                upHere.length > 0 ? `Prices are up at ${here}.` : 'No prices are up here.', lines));
        }

        const named = thePapersNamed(standing, said);
        if (named.length === 0) {
            return refused('engine.aPrice', 'sect', factsForRefusal(
                `No house has a price up on ${said}.`,
                upHere.length > 0
                    ? `The prices up here are on ${upHere.map(p => p.targetName).join(', ')}.`
                    : `There is no price up on anybody on the walls at ${here || 'this place'}.`,
                `price: "${said}" matched none of ${standing.length} standing papers. Nothing written.`
            ));
        }
        if (named.length > 1) {
            return refused('engine.aPrice', 'sect', factsForRefusal(
                `More than one price answers to ${said}.`,
                `There are prices up on ${named.map(p => `${p.targetName} from ${p.posterName}`).join(', and ')}.`,
                `price: "${said}" matched ${named.length} papers. Nothing written.`
            ));
        }
        const paper = named[0]!;
        if (paper.targetId === cultivator.id) {
            return refused('engine.aPrice', 'sect', factsForRefusal(
                'The name on that paper is yours.',
                `${paper.posterName}'s price pays for your death, and there would be nobody left to collect it.`,
                `price: ${paper.id} names the player. Nothing written.`
            ));
        }

        const house = world.factions.find(f => f.id === paper.posterFactionId) ?? null;
        const seatName = house ? world.locations.find(l => l.id === house.seatLocationId)?.name ?? null : null;
        if (!thePaperHangsAt(paper, here) && !standingWithTheHouse(this, world, cultivator, house?.id ?? null)) {
            return refused('engine.aPrice', 'sect', factsForRefusal(
                `${paper.posterName}'s paper on ${paper.targetName} is not up here.`,
                `It is up on the walls ${paper.posterName} answers for`
                + (seatName ? `, and at its gate at ${seatName}` : '')
                + '. It is taken up where it can be read.',
                `price: ${paper.id} does not hang at "${here}". Nothing written.`
            ));
        }

        if (theWordGivenOn(this.db, cultivator.id, paper.id)) {
            return this.freeAction(run, 'sect', factsForToolResult(
                `You have already taken up ${paper.posterName}'s price on ${paper.targetName}.`,
                [`${paper.purseStones} spirit stones for ${paper.targetName}, paid on ${paper.evidence}.`]));
        }

        const runDay = Math.floor(run.elapsedDays);
        const began = world.runs.find(r => r.id === run.id)?.startedOnDay ?? world.currentDay - runDay;
        const word = theWordFor(cultivator, paper, runDay, Math.max(runDay, paper.lapsesOnDay - began));
        writeOneObligation(this.db, word);

        const lines = [
            `You take up ${paper.posterName}'s price on ${paper.targetName}: ${paper.purseStones} spirit stones, `
            + `${paper.forWhat}.`,
            `It pays on ${paper.evidence}, brought to ${paper.posterName}`
            + (seatName ? ` at ${seatName}.` : '.'),
            `The paper comes down in ${Math.max(0, Math.round(paper.lapsesOnDay - world.currentDay))} days.`
        ];
        const facts = factsForToolResult(`You take up the price on ${paper.targetName}.`, lines);
        facts.required = lines.slice(0, 2);
        facts.structure.push(`price: oath ${word.id} on paper ${paper.id}; due run day ${word.dueOnDay}.`);
        return this.freeAction(run, 'sect', facts);
    },

    /**
     * Bring a house what its paper asked for, and be paid - or not, by the
     * paper's honoured word.
     */
    async bringInAPrice(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        target: string | undefined
    ): Promise<Execution> {
        this.atHand = this.atHand ?? await this.loadWorld();
        const world = this.atHand;
        if (!world) {
            return refused('engine.aPrice', 'sect', factsForRefusal(
                'There is no world to have put a price on anybody.',
                'Nobody has put paper up on anybody, because there is no world running for them to live in.',
                'price claim: world off. Nothing paid.'
            ));
        }
        const said = (target ?? '').trim();
        const papers = thePapersNotYetPaidOn(world);
        // With nobody named, the price they took up and can now bring in.
        const taken = ledgerAbout(this.db, cultivator.id).filter(row =>
            row.kind === 'oath' && row.status === 'open' && row.holderId === cultivator.id
            && row.tags.includes(A_PRICE_TAKEN_UP));
        const candidates = said.length >= 2
            ? thePapersNamed(papers, said)
            : papers.filter(p => taken.some(row => row.tags.includes(`${ON_THE_PAPER}${p.id}`))
                && theDeathTheyAreHeldFor(world, cultivator.id, p.targetId) !== null);
        if (candidates.length !== 1) {
            return refused('engine.aPrice', 'sect', factsForRefusal(
                candidates.length === 0 ? 'There is no price to bring in.' : `More than one price answers to ${said}.`,
                candidates.length === 0
                    ? (said.length >= 2 ? `No house has put a price on ${said}.` : 'Name whose price it is.')
                    : `There are prices on ${candidates.map(p => `${p.targetName} from ${p.posterName}`).join(', and ')}.`,
                `price claim: "${said}" matched ${candidates.length} papers. Nothing paid.`
            ));
        }
        const paper = candidates[0]!;
        const house = world.factions.find(f => f.id === paper.posterFactionId && f.dissolvedOnDay === null) ?? null;
        if (!house) {
            return refused('engine.aPrice', 'sect', factsForRefusal(
                `${paper.posterName} is not standing to pay anybody.`,
                `The house that put the price on ${paper.targetName} is gone, and its paper with it.`,
                `price claim: ${paper.posterFactionId} ended. Nothing paid.`
            ));
        }

        const death = theDeathTheyAreHeldFor(world, cultivator.id, paper.targetId);
        if (!death) {
            const alive = world.npcs.find(n => n.id === paper.targetId)?.status === 'alive';
            return refused('engine.aPrice', 'sect', factsForRefusal(
                `${house.name} pays on ${paper.evidence}.`,
                alive
                    ? `${paper.targetName} is alive, and ${house.name} pays for a death.`
                    : `Nobody holds you as the one who killed ${paper.targetName}, and that is what the house pays for.`,
                `price claim: no death with killer ${cultivator.id} and victim ${paper.targetId}. Nothing paid.`
            ));
        }
        if (death.day < paper.postedOnDay || death.day > paper.lapsesOnDay) {
            return refused('engine.aPrice', 'sect', factsForRefusal(
                `${house.name}'s paper was not up when ${paper.targetName} died.`,
                `The price was up from day ${paper.postedOnDay} to day ${paper.lapsesOnDay}, and a death outside it `
                + 'is not what the house paid for.',
                `price claim: death ${death.id} on ${death.day} outside the paper. Nothing paid.`
            ));
        }

        const seatName = world.locations.find(l => l.id === house.seatLocationId)?.name ?? null;
        if (!standingWithTheHouse(this, world, cultivator, house.id)) {
            return refused('engine.aPrice', 'sect', factsForRefusal(
                `Nobody of ${house.name} is here to pay you.`,
                `The price is paid at the house` + (seatName ? `, at ${seatName},` : '')
                + ' or by one of its people standing where you are.',
                `price claim: not inside ${house.seatLocationId ?? 'no seat'} and no member of ${house.id} present. Nothing paid.`
            ));
        }

        const runDay = Math.floor(run.elapsedDays);
        const standingWord = theWordGivenOn(this.db, cultivator.id, paper.id);
        const result = this.repos.db.transaction(() => {
            const brought = aPriceIsBroughtIn(world, {
                paper, claimantId: cultivator.id, claimantName: cultivator.name, death, day: world.currentDay
            });
            const word = standingWord ?? theWordFor(cultivator, paper, runDay, runDay);
            writeOneObligation(this.db, settleObligation(word, {
                resolution: 'oath_fulfilled',
                onDay: runDay,
                byId: cultivator.id,
                note: brought.paid
                    ? `Brought ${house.name} proof of ${paper.targetName}'s death and was paid ${brought.stones}.`
                    : `Brought ${house.name} proof of ${paper.targetName}'s death and was not paid.`
            }));
            if (brought.stones > 0) {
                this.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: brought.stones });
            } else {
                // A WRONG DONE TO THE PLAYER IS A WRONG.
                writeOneObligation(this.db, createGrudge({
                    holderId: cultivator.id,
                    subjectId: house.id,
                    cause: 'other',
                    severity: 'serious',
                    onDay: runDay,
                    description: `${house.name} put a price on ${paper.targetName}, and when `
                        + `${cultivator.name} brought it what it asked for, it did not pay.`,
                    triggeringEventId: brought.fact.id,
                    tags: ['unpaid-price']
                }));
            }
            this.theWorldMoved();
            return brought;
        })();

        const lines = result.paid
            ? [`${house.name} pays you ${result.stones} spirit stones on its price on ${paper.targetName}.`]
            : [
                `${house.name} takes what you brought on ${paper.targetName} and does not pay.`,
                `You hold it against ${house.name}.`
            ];
        const facts = factsForToolResult(
            result.paid ? `${house.name} pays the price on ${paper.targetName}.` : `${house.name} does not pay.`, lines);
        facts.required = [...lines];
        facts.structure.push(`aPriceIsBroughtIn(${paper.id}): paid=${result.paid} stones=${result.stones}; death ${death.id}.`);
        const execution = this.freeAction(run, 'sect', facts);
        execution.calls = [{
            name: 'world.aPriceIsBroughtIn',
            action: 'sect',
            summary: result.line,
            ok: true
        }];
        return execution;
    }
};

/** Inside the house's walls, or with one of its people standing here. `hand_in`'s rule. */
function standingWithTheHouse(
    service: GameService,
    world: WorldState,
    cultivator: Cultivator,
    houseId: string | null
): boolean {
    if (houseId === null) return false;
    const house = world.factions.find(f => f.id === houseId);
    if (!house) return false;
    const here = service.worldPlaceOf(cultivator);
    if (house.seatLocationId !== null && theSeatOfTheCompound(world, here)?.id === house.seatLocationId) return true;
    return service.present(cultivator)
        .map(p => world.npcs.find(n => n.id === p.id))
        .some(n => n !== undefined && n.status === 'alive' && n.factionId === house.id);
}
