import { openHandednessOf } from '../engine/social-leverage/how-freely-somebody-parts-with-what-they-have.js';
import { accrueProgress } from '../engine/cultivation/cultivation.js';
import { forStream } from '../engine/cultivation/rng.js';
import { drawnOffMultiplierOf, physiqueOrNull } from '../engine/cultivation/physiques.js';
import { FURNACE_MIN_AGE, oldEnoughForTheRite } from '../engine/social-leverage/an-art-that-needs-two-people.js';
import { ageInYears } from '../engine/world/npc-state.js';
import { aChildIsConceived, DAYS_A_CHILD_IS_CARRIED } from '../engine/world/a-child-an-act-conceived.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import { theirHalfOfTheRite, whatThisFurnaceIsWorth, whyTheRiteWillNotOpen } from './an-art-that-needs-both-of-them.js';
import { factsForToolResult } from './facts.js';
import { useFurnaceTechnique } from './furnace-technique.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

/** Offered subjects keep their own decision; the model cannot supply consent. */
export function aWillingFurnaceRite(service: GameService, run: Run, player: Cultivator,
    named: string, offerSelf: boolean): Execution {
    const world = service.atHand;
    const present = service.somebodyAtHand(named, player)
        ?? service.present(player).find(row => row.name.toLowerCase() === named.trim().toLowerCase());
    const other = world?.npcs.find(row => row.id === present?.id && row.status === 'alive');
    const answer = (line: string, ok = false): Execution => {
        const result = service.freeAction(run, 'cultivate', factsForToolResult(line, [line]));
        result.calls = [{ name: ok ? 'furnace.useFurnaceTechnique' : 'furnace.offer', action: 'cultivate', summary: line, ok }];
        return result;
    };
    if (!world || !other) return answer('The person you named is not here.');
    const today = Math.floor(world.currentDay);
    if (!oldEnoughForTheRite(player.age) || !oldEnoughForTheRite(ageInYears(other, today))) {
        return answer(`Both people must be at least ${FURNACE_MIN_AGE} for the rite. Nothing happened.`);
    }
    const mine = theirHalfOfTheRite(service.repos, player.id);
    const theirs = theirHalfOfTheRite(service.repos, other.id, other.cultivation.techniqueIds);
    const actor = offerSelf ? { id: other.id, name: present!.name, sex: other.identity.sex } : player;
    const subject = offerSelf ? player : { id: other.id, name: present!.name, sex: other.identity.sex };
    const subjectHalf = offerSelf ? mine : theirs;
    const shut = whyTheRiteWillNotOpen(offerSelf ? theirs : mine, subjectHalf, subject.name, 'offered');
    if (shut) return answer(shut.said);
    const standing = other.relationships.find(tie => tie.targetId === player.id)?.standing ?? 0;
    const chance = Math.min(0.95, Math.max(0.05, 0.15 + 0.75 * standing + 0.1 * openHandednessOf(other.id)));
    if (forStream(run.seed, 'furnace-offer', other.id, run.turn).next() >= chance) {
        return answer(`${present!.name} declines the offered rite. Nothing happened.`);
    }
    const outcome = useFurnaceTechnique({ world, actorId: actor.id, actorName: actor.name, actorSex: actor.sex,
        subjects: [{ personId: subject.id, name: subject.name, sex: subject.sex,
            conceptionSample: forStream(run.seed, 'furnace-conception', subject.id, Math.floor(run.elapsedDays)).next(),
            deathSample: 1, drawnOff: whatThisFurnaceIsWorth(subjectHalf, 'offered')
                * drawnOffMultiplierOf(physiqueOrNull(offerSelf ? player.physique : other.identity.physique)) }],
        type: 'offered', onDay: today, locationId: service.worldPlaceOf(player), seenBy: null });
    if (!outcome.happened) return answer(outcome.line);
    const fresh = service.repos.cultivators.getById(player.id)!;
    const atRate = accrueProgress(fresh, outcome.daysStolen, { ambient: service.ambientFor(fresh, run) });
    service.repos.cultivators.update(player.id, { cultivationProgress: offerSelf
        ? Math.max(0, fresh.cultivationProgress - (atRate.newProgress - fresh.cultivationProgress))
        : atRate.newProgress });
    const at = world.npcs.findIndex(row => row.id === other.id);
    const live = world.npcs[at]!;
    const since = live.cultivation.accumulatingSinceDay;
    world.npcs[at] = { ...live, cultivation: { ...live.cultivation,
        accumulatingSinceDay: offerSelf ? since - outcome.daysStolen : Math.min(today, since + outcome.daysStolen) },
        updatedOnDay: today };
    if (outcome.each[0]!.conceived) aChildIsConceived(world, {
        carrierId: player.sex === 'female' ? player.id : other.id,
        otherParentId: player.sex === 'female' ? other.id : player.id, dueOnDay: today + DAYS_A_CHILD_IS_CARRIED });
    service.theWorldMoved();
    return answer(`${subject.name} willingly offers the rite. ${actor.name} draws ${Math.round(outcome.daysStolen)} days of cultivation.`, true);
}
