/**
 * A member seen to out of their own house's medicine, at its seat.
 *
 * The same shelf the yearly pass spends on the house's own people, under the
 * same allotment and at the house's own price (`house-wound-medicine.ts`):
 * `whatTheShelfGivesAMember` decides, and this file only writes what it decided.
 * No days pass: a dose is swallowed, not a stay.
 *
 * Null wherever the shelf has nothing to say - no roll, not at the seat, nothing
 * on it that closes one of their wounds - and `treat` goes on to a physician
 * exactly as it did before this existed.
 */

import { theSeatOfTheCompound } from '../engine/world/where-inside-a-house-somebody-is-standing.js';
import { takeOffTheShelf, whatTheShelfGivesAMember } from '../engine/world/house-wound-medicine.js';
import { pillStockKey } from '../engine/world/where-the-pills-actually-are.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import { factsForToolResult } from './facts.js';
import { positionIn } from './standing.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

export type FromTheHouseShelf =
    /** Doses given, wounds closed, contribution written off. */
    | { given: Execution }
    /** The shelf holds something that would close a wound and did not give it. Said, then a physician. */
    | { withheld: { line: string; structure: string } }
    | null;

export async function seenToFromTheHouseShelf(
    game: GameService,
    run: Run,
    cultivator: Cultivator
): Promise<FromTheHouseShelf> {
    const position = positionIn(game.repos, cultivator.id);
    if (!position) return null;
    game.atHand = game.atHand ?? await game.loadWorld();
    const world = game.atHand;
    const house = world?.factions.find(f => f.id === position.sectId && f.dissolvedOnDay === null) ?? null;
    if (!world || !house || house.seatLocationId === null) return null;
    if (theSeatOfTheCompound(world, game.worldPlaceOf(cultivator))?.id !== house.seatLocationId) return null;

    const offer = whatTheShelfGivesAMember(world, {
        houseId: house.id,
        member: {
            id: cultivator.id,
            rankIndex: position.rankIndex,
            realmOrdinal: cultivator.realmOrdinal,
            injuries: cultivator.injuries
        },
        contribution: position.contribution
    });

    if (offer.doses.length === 0) {
        const held = offer.withheld;
        if (held === null) return null;
        return {
            withheld: held.why === 'contribution'
                ? {
                    line: `${house.name} holds ${held.pill.name}s, one of which would close a wound you carry, and gives `
                        + `one to its own for ${held.price} contribution. You stand at ${position.contribution}.`,
                    structure: `whatTheShelfGivesAMember(${house.id}): ${held.pill.id} costs ${held.price} `
                        + `contribution, member holds ${position.contribution}. Nothing taken off the shelf.`
                }
                : {
                    line: `${house.name} holds ${held.pill.name}s, and what it holds is kept for ${held.above} of its `
                        + `own who stand above you and carry a wound it closes.`,
                    structure: `whatTheShelfGivesAMember(${house.id}): ${held.pill.id} on the shelf is kept back `
                        + `for ${held.above} wounded member(s) above rank ${position.rankIndex}.`
                }
        };
    }

    const standsAt: { contribution: number | null } = { contribution: null };
    game.db.transaction(() => {
        for (const dose of offer.doses) {
            for (const wound of dose.closed) game.repos.cultivators.treatInjury(wound.id, run.turn + 1);
            takeOffTheShelf(house, dose.pill.id);
        }
        standsAt.contribution = game.repos.sects
            .addContribution(house.id, cultivator.id, -offer.contribution)?.contribution ?? null;
        game.theWorldMoved();
    })();

    const byPill = new Map<string, { name: string; count: number }>();
    for (const dose of offer.doses) {
        const row = byPill.get(dose.pill.id) ?? { name: dose.pill.name, count: 0 };
        row.count++;
        byPill.set(dose.pill.id, row);
    }
    const given = [...byPill.values()].map(p => (p.count === 1 ? `a ${p.name}` : `${p.count} of ${p.name}`));
    const closed = offer.doses.reduce((n, d) => n + d.closed.length, 0);
    const after = game.repos.cultivators.getById(cultivator.id) ?? cultivator;
    const open = after.injuries.filter(i => !i.treated).length;

    const lines = [
        `${house.name} gives you ${given.join(' and ')} out of its own medicine, and you take `
        + `${offer.doses.length === 1 ? 'it' : 'them'} at its seat: ${closed} wound${closed === 1 ? '' : 's'} `
        + 'closed.',
        `It writes ${offer.contribution} contribution off your name for ${offer.doses.length === 1 ? 'it' : 'them'}`
        + (standsAt.contribution !== null ? `, which stands at ${standsAt.contribution}.` : '.'),
        open === 0
            ? 'Nothing you carry is open now.'
            : `${open} still open.`
    ];
    const facts = factsForToolResult(`Seen to out of ${house.name}'s medicine.`, lines);
    facts.required = lines.slice(0, 2);
    facts.structure.push(
        `whatTheShelfGivesAMember(${house.id}): ${offer.doses.map(d => d.pill.id).join(', ')}; `
        + `${closed} wound(s) closed; contribution -${offer.contribution}. On the shelf now: `
        + [...byPill.keys()].map(id => `${id}=${Number(house.resources[pillStockKey(id)] ?? 0)}`).join(', ')
        + '. No days passed.'
    );
    const execution = game.freeAction(run, 'treat', facts);
    execution.calls = [{
        name: 'world.whatTheShelfGivesAMember',
        action: 'treat',
        summary: `${offer.doses.length} dose(s) from ${house.name}'s shelf for ${offer.contribution} contribution; `
            + `${closed} wound(s) closed, ${open} open.`,
        ok: true
    }];
    return { given: execution };
}
