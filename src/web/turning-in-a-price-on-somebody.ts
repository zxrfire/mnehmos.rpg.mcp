/**
 * Turning in a price a house put on somebody, at its gate: the first to bring the proof is paid,
 * and the notice comes down everywhere. Nobody signs on for one.
 *
 * A price is a house notice like any other (`turning-in-what-a-notice-asks.ts`), so a sentence
 * taking one up is answered with what the notice pays on and where, and changes nothing. What
 * counts as proof, and who else can get there first, is `engine/world/a-house-puts-a-price-on-somebody.ts`.
 *
 * A house that does not pay leaves the player holding an account against it, because a wrong done
 * to the player is a wrong. A price on the player is read off the same walls as anybody's.
 */

import {
    aPriceIsBroughtIn,
    everyPaperPosted,
    theDeathTheyAreHeldFor,
    thePaperHangsAt,
    thePapersStillUp,
    whenThePaperCameDown,
    type PersonBounty
} from '../engine/world/a-house-puts-a-price-on-somebody.js';
import { createGrudge } from '../engine/social/grudges.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import { writeOneObligation } from '../storage/repos/obligation.repo.js';
import { matchScore } from './entities.js';
import { factsForRefusal, factsForToolResult } from './facts.js';
import { refused } from './tool-result-prose.js';
import { theGateAStrangerStandsAt } from './the-gate-speaks-for-its-house.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

/** How close a name has to be before it is the person they meant. `destroy`'s figure. */
const CLOSE_ENOUGH = 60;

/** The papers whose name the words reach, best first. */
function thePapersNamed(papers: readonly PersonBounty[], said: string): PersonBounty[] {
    const scored = papers
        .map(paper => ({ paper, score: Math.max(matchScore(said, paper.targetName), matchScore(said, paper.posterName)) }))
        .filter(row => row.score >= CLOSE_ENOUGH)
        .sort((a, b) => b.score - a.score);
    const best = scored[0]?.score;
    return scored.filter(row => row.score === best).map(row => row.paper);
}

/** One paper a house and a head: the latest it put up. */
function theLatestOfEach(papers: readonly PersonBounty[]): PersonBounty[] {
    const latest = new Map<string, PersonBounty>();
    for (const paper of [...papers].sort((a, b) => a.postedOnDay - b.postedOnDay)) {
        latest.set(`${paper.posterFactionId}|${paper.targetId}`, paper);
    }
    return [...latest.values()];
}

function theSeatOf(world: WorldState, paper: PersonBounty): string | null {
    const house = world.factions.find(f => f.id === paper.posterFactionId);
    return house ? world.locations.find(l => l.id === house.seatLocationId)?.name ?? null : null;
}

/** What the paper pays, on what, and where it is turned in. */
function whereItIsTurnedIn(world: WorldState, paper: PersonBounty): string {
    const seat = theSeatOf(world, paper);
    return `${paper.posterName} pays ${paper.purseStones} spirit stones to the first to turn in ${paper.evidence}, `
        + `at its gate${seat ? ` at ${seat}` : ''}, and takes the notice down everywhere when somebody does.`;
}

function daysAgo(world: WorldState, day: number): string {
    const days = Math.max(0, Math.floor(world.currentDay - day));
    return days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} ago`;
}

/**
 * Whether the words name somebody this house has put a price on, up or down. `hand_in`'s route,
 * by the person alone: the house's own name is in every sentence handed in at its gate.
 */
export function namesAPriceOfThisHouse(world: WorldState | null | undefined, houseId: string, said: string): boolean {
    if (!world || said.trim().length < 2) return false;
    return everyPaperPosted(world).some(p => p.posterFactionId === houseId && matchScore(said, p.targetName) >= CLOSE_ENOUGH);
}

/**
 * A sentence taking a price up, answered: nobody signs on for a notice, and here is what it pays
 * on and where. With nobody named, the prices up where the player is standing. Changes nothing.
 */
export async function nobodyTakesUpAPrice(
    game: GameService,
    run: Run,
    cultivator: Cultivator,
    target: string | undefined
): Promise<Execution> {
    game.atHand = game.atHand ?? await game.loadWorld();
    const world = game.atHand;
    if (!world) {
        return refused('engine.aPrice', 'sect', factsForRefusal(
            'There is no world to have put a price on anybody.',
            'Nobody has put paper up on anybody, because there is no world running for them to live in.',
            'price: world off. Nothing written.'
        ));
    }
    const here = (cultivator.location ?? '').trim();
    const up = thePapersStillUp(world, world.currentDay);
    const upHere = up.filter(paper => thePaperHangsAt(paper, here));
    const said = (target ?? '').trim();

    if (said.length < 2) {
        const lines = ['Nobody signs on for a notice.', ...(upHere.length > 0
            ? upHere.map(paper => `On ${paper.targetName}: ${whereItIsTurnedIn(world, paper)}`)
            : [`No house has a price up on anybody on the walls at ${here || 'this place'}.`])];
        return game.freeAction(run, 'sect', factsForToolResult(
            upHere.length > 0 ? `Prices are up at ${here}.` : 'No prices are up here.', lines));
    }

    const named = theLatestOfEach(thePapersNamed(up, said));
    if (named.length > 1) {
        return refused('engine.aPrice', 'sect', factsForRefusal(
            `More than one price answers to ${said}.`,
            `There are prices up on ${named.map(p => `${p.targetName} from ${p.posterName}`).join(', and ')}.`,
            `price: "${said}" matched ${named.length} papers up. Nothing written.`
        ));
    }
    const paper = named[0];
    if (!paper) {
        const down = theLatestOfEach(thePapersNamed(everyPaperPosted(world), said))[0];
        return refused('engine.aPrice', 'sect', factsForRefusal(
            down ? `${down.posterName}'s price on ${down.targetName} is down.` : `No house has a price up on ${said}.`,
            down
                ? `Nobody signs on for a notice, and that one is no longer up.`
                : upHere.length > 0
                    ? `The prices up here are on ${upHere.map(p => p.targetName).join(', ')}.`
                    : `There is no price up on anybody on the walls at ${here || 'this place'}.`,
            `price: "${said}" matched none of ${up.length} papers up. Nothing written.`
        ));
    }

    const lines = [
        'Nobody signs on for a notice.',
        (paper.targetId === cultivator.id ? `The name on ${paper.posterName}'s price is yours. ` : '')
        + whereItIsTurnedIn(world, paper)
    ];
    const facts = factsForToolResult(`Nobody takes up the price on ${paper.targetName}.`, lines);
    facts.required = [...lines];
    facts.structure.push(`price: ${paper.id} is a notice; nothing signed, nothing written.`);
    return game.freeAction(run, 'sect', facts);
}

/**
 * Turn in a price at the gate of the house that put it up. The first to bring the proof is paid by
 * the paper's honoured word, and the notice comes down; whoever comes second gets nothing.
 */
export async function turnInAPrice(
    game: GameService,
    run: Run,
    cultivator: Cultivator,
    target: string | undefined
): Promise<Execution> {
    game.atHand = game.atHand ?? await game.loadWorld();
    const world = game.atHand;
    if (!world) {
        return refused('engine.aPrice', 'sect', factsForRefusal(
            'There is no world to have put a price on anybody.',
            'Nobody has put paper up on anybody, because there is no world running for them to live in.',
            'price turn-in: world off. Nothing paid.'
        ));
    }
    const today = world.currentDay;
    const said = (target ?? '').trim();
    const gate = theGateAStrangerStandsAt(game, cultivator);
    const posted = everyPaperPosted(world).filter(p => p.postedOnDay <= today);

    // The paper they meant: the one named, else this gate's paper on somebody the player killed.
    let pool = said.length >= 2
        ? thePapersNamed(posted, said)
        : posted.filter(p => gate !== null && p.posterFactionId === gate.factionId
            && theDeathTheyAreHeldFor(world, cultivator.id, p.targetId) !== null);
    const thisGate = pool.filter(p => gate !== null && p.posterFactionId === gate.factionId);
    if (thisGate.length > 0) pool = thisGate;
    const stillUp = pool.filter(p => p.lapsesOnDay > today && whenThePaperCameDown(world, p, today) === null);
    if (stillUp.length > 0) pool = stillUp;
    const candidates = theLatestOfEach(pool);
    if (candidates.length !== 1) {
        return refused('engine.aPrice', 'sect', factsForRefusal(
            candidates.length === 0 ? 'There is no price to turn in.' : `More than one price answers to ${said}.`,
            candidates.length === 0
                ? (said.length >= 2 ? `No house has put a price on ${said}.` : 'Name whose price it is.')
                : `There are prices on ${candidates.map(p => `${p.targetName} from ${p.posterName}`).join(', and ')}.`,
            `price turn-in: "${said}" matched ${candidates.length} papers. Nothing paid.`
        ));
    }
    const paper = candidates[0]!;
    if (paper.targetId === cultivator.id) {
        return refused('engine.aPrice', 'sect', factsForRefusal(
            'The name on that paper is yours.',
            `${paper.posterName}'s price is paid for your killing, and there would be nobody left to turn it in.`,
            `price turn-in: ${paper.id} names the player. Nothing paid.`
        ));
    }
    const house = world.factions.find(f => f.id === paper.posterFactionId && f.dissolvedOnDay === null) ?? null;
    if (!house) {
        return refused('engine.aPrice', 'sect', factsForRefusal(
            `${paper.posterName} is not standing to pay anybody.`,
            `The house that put the price on ${paper.targetName} is gone, and its paper with it.`,
            `price turn-in: ${paper.posterFactionId} ended. Nothing paid.`
        ));
    }

    // FIRST COME, FIRST PAID. Down is down, for the player as for anybody.
    const down = whenThePaperCameDown(world, paper, today);
    if (down) {
        return refused('engine.aPrice', 'sect', factsForRefusal(
            `${house.name}'s price on ${paper.targetName} is down.`,
            down.byId === cultivator.id
                ? `You turned it in ${daysAgo(world, down.onDay)}, and the notice is down.`
                : `Somebody else turned in ${house.name}'s price on ${paper.targetName} ${daysAgo(world, down.onDay)}, `
                    + 'and the notice is down. The second to bring it gets nothing.',
            `price turn-in: ${paper.id} came down on ${down.onDay}. Nothing paid.`
        ));
    }
    if (paper.lapsesOnDay <= today) {
        return refused('engine.aPrice', 'sect', factsForRefusal(
            `${house.name}'s price on ${paper.targetName} is down.`,
            `Its span ran out ${daysAgo(world, paper.lapsesOnDay)} with nobody having turned it in.`,
            `price turn-in: ${paper.id} lapsed on ${paper.lapsesOnDay}. Nothing paid.`
        ));
    }

    // THE PROOF: the world holds the player as the one who killed them, while the paper was up.
    const death = theDeathTheyAreHeldFor(world, cultivator.id, paper.targetId);
    if (!death || death.day < paper.postedOnDay) {
        const alive = world.npcs.find(n => n.id === paper.targetId)?.status === 'alive';
        return refused('engine.aPrice', 'sect', factsForRefusal(
            `${house.name} pays on ${paper.evidence}.`,
            alive
                ? `${paper.targetName} is alive, and ${house.name} pays for the killing.`
                : death
                    ? `${house.name}'s paper was not up when you killed ${paper.targetName}, and it pays for a killing done while it was.`
                    : `Nobody holds you as the one who killed ${paper.targetName}, and that is the proof ${house.name} pays on.`,
            `price turn-in: no death with killer ${cultivator.id} and victim ${paper.targetId} on or after ${paper.postedOnDay}. Nothing paid.`
        ));
    }

    // AT THE GATE, where a stranger stands and the house speaks to outsiders.
    if (gate?.factionId !== house.id) {
        const seat = theSeatOf(world, paper);
        return refused('engine.aPrice', 'sect', factsForRefusal(
            `${house.name} takes it in at its gate.`,
            `The price is turned in at the gate of ${house.name}${seat ? ` at ${seat}` : ''}, by somebody not of the house.`,
            `price turn-in: not a stranger at ${house.id}'s gate. Nothing paid.`
        ));
    }

    const runDay = Math.floor(run.elapsedDays);
    const result = game.repos.db.transaction(() => {
        const brought = aPriceIsBroughtIn(world, {
            paper, claimantId: cultivator.id, claimantName: cultivator.name, death, day: Math.floor(today)
        });
        if (brought.stones > 0) {
            game.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: brought.stones });
        } else {
            // A WRONG DONE TO THE PLAYER IS A WRONG.
            writeOneObligation(game.db, createGrudge({
                holderId: cultivator.id,
                subjectId: house.id,
                cause: 'other',
                severity: 'serious',
                onDay: runDay,
                description: `${house.name} put a price on ${paper.targetName}, and when `
                    + `${cultivator.name} turned it in, it did not pay.`,
                triggeringEventId: brought.fact.id,
                tags: ['unpaid-price']
            }));
        }
        game.theWorldMoved();
        return brought;
    })();

    const lines = result.paid
        ? [
            `The disciple on the gate takes your proof of ${paper.targetName}'s killing for ${house.name}'s notice `
            + `and pays ${result.stones} spirit stone${result.stones === 1 ? '' : 's'} out of the house's stores. `
            + 'The notice comes down.',
            ...(result.stones < paper.purseStones ? ['The house had less than the paper said, and paid what it had.'] : [])
        ]
        : [
            `The disciple on the gate takes your proof of ${paper.targetName}'s killing for ${house.name}'s notice, `
            + 'and the house does not pay. The notice comes down.',
            `You hold it against ${house.name}.`
        ];
    const facts = factsForToolResult(`Turned in ${house.name}'s price on ${paper.targetName}.`, lines);
    facts.required = [...lines];
    facts.structure.push(`aPriceIsBroughtIn(${paper.id}): paid=${result.paid} stones=${result.stones}; death ${death.id}. `
        + 'First to turn it in; the notice is down.');
    const execution = game.freeAction(run, 'sect', facts);
    execution.calls = [{
        name: 'world.aPriceIsBroughtIn',
        action: 'sect',
        summary: result.line,
        ok: true
    }];
    return execution;
}
