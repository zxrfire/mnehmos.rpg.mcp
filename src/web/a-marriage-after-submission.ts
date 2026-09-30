import { ageInYears } from '../engine/world/npc-state.js';
import { bindHousehold, SPOUSE_STANDING } from '../engine/world/the-ties-an-ordinary-life-produces.js';
import { oldEnoughForTheRite } from '../engine/social-leverage/an-art-that-needs-two-people.js';
import { createObligation } from '../engine/social/grudges.js';
import { writeOneObligation } from '../storage/repos/obligation.repo.js';
import { recordTheTieAnAttemptLeft } from './encounters.js';
import type { GameService } from './turn-engine.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { Execution } from './turn-wire-shapes.js';

/** A forced match follows submission; it cannot be asserted by narration. */
export function marriageAfterSubmission(service: GameService, run: Run, player: Cultivator,
    otherId: string, execution: Execution): void {
    const world = service.atHand;
    const self = world?.npcs.find(row => row.id === player.id);
    const other = world?.npcs.find(row => row.id === otherId && row.status === 'alive');
    if (!world || !self || !other || !oldEnoughForTheRite(player.age)
        || !oldEnoughForTheRite(ageInYears(other, world.currentDay))) return;
    bindHousehold(world, new Map(world.npcs.map((row, at) => [row.id, at])), self, other, world.currentDay);
    const line = 'The forced marriage is written on both records.';
    recordTheTieAnAttemptLeft(service.repos, player.id, other.id, Math.floor(run.elapsedDays), {
        theirs: { type: 'spouse', strength: SPOUSE_STANDING, significance: 'defining', roles: ['married', 'coerced'] },
        yours: { type: 'spouse', strength: SPOUSE_STANDING, significance: 'defining', roles: ['married', 'coerced'] },
        event: { onDay: Math.floor(run.elapsedDays), kind: 'match', summary: line } });
    writeOneObligation(service.db as never, createObligation({ kind: 'grudge', holderId: other.id,
        subjectId: player.id, cause: 'violated', severity: 'unforgivable', onDay: Math.floor(run.elapsedDays),
        description: 'Forced into marriage after submission.', participants: [player.id, other.id], tags: ['marriage', 'coerced'] }));
    execution.facts.lines.push(line);
    execution.facts.prose = [execution.facts.prose, line].join('\n');
    execution.calls.push({ name: 'marriage.afterSubmission', action: 'coerce', summary: line, ok: true });
    service.theWorldMoved();
}
