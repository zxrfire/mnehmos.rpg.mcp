/**
 * Somebody at hand spending their medicine on you at death's door.
 *
 * The owner, 2026-09-24: ending a fight you forced while barely standing kills you, even if you won,
 * and "medicine from someone at hand may save you". And 2026-10-09, on who: "anyone if they want to,
 * of course. falls out of agents.md". So there is no rescuer class. Whoever is standing with you and
 * really carries a healing pill may spend it on you, by either of two readings of the same person:
 *  - the ask, through the resolver every other ask goes through: their tie to you, their house, standing;
 *  - who they are. The owner: "some people might be genuinely kind too". Somebody dying cannot ask
 *    for anything, and whether a stranger kneels beside them is mostly that stranger's nature, so their
 *    own open-handedness (`openHandednessOf`, fixed for life) carries a rescue on its own. Alignment does
 *    not gate it: kind elders exist just as greedy demonic cultivators exist.
 * The pill leaves their stack, your body takes its potency, and the world keeps that you owe them a life.
 */
import { getPill } from '../data/cultivation/pills.js';
import { forStream } from '../engine/cultivation/rng.js';
import { makeFact } from '../engine/world/history.js';
import { isRuined } from '../engine/world/possessions.js';
import { whatThisThingIs } from '../engine/world/what-a-house-gives-merit-for.js';
import { appendWorldFact } from '../engine/world/who-was-there-when-it-happened.js';
import { resolveAttempt } from '../engine/social-leverage/an-attempt-to-move-somebody.js';
import { openHandednessOf } from '../engine/social-leverage/how-freely-somebody-parts-with-what-they-have.js';
import { theRollLands } from '../server/consolidated/forcing-an-attempt-to-land.js';
import type { Cultivator } from '../schema/cultivation.js';
import type { Run } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';

export interface ARescue { rescuerId: string; lines: string[] }

/** At the kind end of open-handedness, how likely somebody is to spend their medicine on a stranger. */
const THE_KINDEST_HELP = 0.8;

/** Null where nobody here both carries healing medicine and chooses to spend it on you. */
export function somebodyAtHandSavesYou(game: GameService, run: Run, body: Cultivator,
    notThem: readonly string[] = []): ARescue | null {
    const world = game.atHand;
    if (!world) return null;
    const day = Math.floor(world.currentDay);
    const here = new Set(game.present(body).map(row => row.id));
    const house = game.repos.sects.getMembership(body.id)?.sectId ?? null;
    const people = world.npcs.filter(npc => here.has(npc.id) && npc.status === 'alive' && !notThem.includes(npc.id))
        .sort((a, b) => a.id.localeCompare(b.id));
    for (const person of people) {
        const at = world.objects.findIndex(object => object.possessorId === person.id && !isRuined(object)
            && object.kind === 'pill' && getPill(whatThisThingIs(object)?.kindId ?? '')?.effect === 'heal_hp');
        if (at < 0) continue;
        const tie = person.relationships.find(row => row.targetId === body.id);
        const answer = resolveAttempt({
            actor: { id: body.id, name: body.name, ordinal: body.realmOrdinal, charm: body.attributes.charm,
                factionId: house, alignment: null },
            subject: { id: person.id, name: person.name, ordinal: person.cultivation.realmOrdinal,
                factionId: person.factionId,
                alignment: world.factions.find(f => f.id === person.factionId)?.alignment ?? null },
            ask: 'a_real_favour', onDay: day,
            theirTie: tie ? { active: true, strength: Math.max(0, tie.standing) } : null,
            rng: forStream(run.seed, 'a-rescue-at-deaths-door', day, run.turn, person.id),
            theAttemptLands: theRollLands('an_approach_to_somebody')
        });
        const kindness = Math.max(0, openHandednessOf(person.id));
        const ofTheirOwnAccord = forStream(run.seed, 'kindness-at-deaths-door', day, run.turn, person.id)
            .chance(kindness * THE_KINDEST_HELP);
        if (answer.outcome !== 'taken' && answer.outcome !== 'turned' && !ofTheirOwnAccord) continue;
        const pill = world.objects[at]!;
        const kind = getPill(whatThisThingIs(pill)!.kindId)!;
        const left = Math.max(1, Math.floor(Number(pill.data.quantity ?? 1)) || 1) - 1;
        if (left > 0) world.objects[at] = { ...pill, data: { ...pill.data, quantity: left } };
        else world.objects.splice(at, 1);
        const healed = Math.min(body.maxHp, body.hp + kind.potency);
        game.repos.cultivators.applyDeltas(body.id, { hp: healed - body.hp });
        const known = game.knowledge.isAwareOf(body.id, 'cultivator', person.id);
        const who = known ? person.name : 'Somebody standing here';
        appendWorldFact(world, makeFact({ day, kind: 'debt_incurred', locationId: person.locationId,
            summary: `${person.name} spent a ${kind.name} to keep ${body.name} alive.`,
            actors: [{ id: person.id, name: person.name, role: 'rescuer' }, { id: body.id, name: body.name, role: 'saved' }],
            witnessIds: [...here].filter(id => id !== body.id),
            data: { lifeSaved: true, rescuerId: person.id, savedId: body.id, pillId: kind.id } }));
        game.theWorldMoved();
        return { rescuerId: person.id, lines: [
            `${who} puts a ${kind.name} between your teeth before the dark closes.`,
            `You live. You owe ${known ? person.name : 'them'} for it, and they know it.`
        ] };
    }
    return null;
}
