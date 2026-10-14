/** Mutual consent writes the existing serious oath and lateral kin edges. */
import type { GameService } from './turn-engine.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { PlannedAction } from './planned-action.js';
import { actualPersonFor } from './the-actual-person-behind-a-world-row.js';
import { recordSwornBrotherhood, swornSiblingsOf } from '../engine/world/close-people-go-together.js';
import { putPrivateRequest } from '../engine/world/private-requests.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { forStream } from '../engine/cultivation/rng.js';
import { makeFact } from '../engine/world/history.js';
import { appendWorldFact } from '../engine/world/who-was-there-when-it-happened.js';
import { factsWithDataValue } from '../engine/world/witness-reaction-index.js';
import { writeObligations } from '../storage/repos/obligation.repo.js';
import { factsForToolResult, factsForRefusal } from './facts.js';
import { refused } from './tool-result-prose.js';
import { passHours } from './routine-invitations.js';
import { executionWithItsSpentSpan } from './an-execution-with-its-spent-span.js';
import { readPrivateWordsAtTheActualBody, writePrivateWordsAtTheActualBody } from './private-words-on-the-actual-ledger.js';
import { LESSER_ACTION_DAYS } from './lesser-action-costs.js';

export function brotherhoodOfferedOnContact(game: GameService, body: Cultivator): string[] {
    const world = game.atHand, player = actualPersonFor(game, body.id);
    if (!world || !player || !body.alive) return [];
    const day = routineTime(world), year = Math.floor(day / 365);
    for (const face of game.present(body)) {
        const person = actualPersonFor(game, face.id);
        if (!person || swornSiblingsOf(world, body.id).has(person.id)) continue;
        const mutual = Math.min(player.relationships.find(tie => tie.targetId === person.id)?.standing ?? 0,
            person.relationships.find(tie => tie.targetId === body.id)?.standing ?? 0);
        if (mutual <= 0 || factsWithDataValue(world, 'swornBrotherhoodInvitation', true)
            .some(fact => fact.year === year && fact.data.fromId === person.id && fact.data.toId === body.id)
            || !forStream(world.seed, 'close-company-bond', person.id, year).chance(mutual)) continue;
        appendWorldFact(world, makeFact({ day, kind: 'opportunity', visibility: 'secret',
            locationId: game.worldPlaceOf(body), actors: [{ id: person.id, name: person.name, role: 'invited' },
                { id: body.id, name: body.name, role: 'asked' }], summary: `${person.name} asks ${body.name} to swear brotherhood.`,
            data: { swornBrotherhoodInvitation: true, fromId: person.id, toId: body.id } }), { bystanders: false, recur: false });
        game.theWorldMoved();
    }
    return factsWithDataValue(world, 'swornBrotherhoodInvitation', true).filter(fact => fact.data.toId === body.id
        && game.present(body).some(face => face.id === fact.data.fromId)
        && !world.history.facts.some(reply => reply.data.swornBrotherhoodReply === fact.id)
        && !swornSiblingsOf(world, body.id).has(String(fact.data.fromId)))
        .map(fact => {
            const speaker = fact.actors.find(actor => actor.role === 'invited')!;
            game.theyGaveTheirName(body, game.currentRun().run, speaker);
            return `${speaker.name} asks you to swear brotherhood. Do you agree?`;
        });
}

export async function swearingBrotherhoodWithAPerson(game: GameService, run: Run, body: Cultivator,
    action: PlannedAction, raw: string) {
    if (!game.atHand || !/\b(?:swear|sworn|brotherhood)\b/i.test(raw)
        || !/\b(?:brotherhood|sworn (?:brothers|siblings|sisters|kin))\b/i.test(raw)
        || /\b(?:break|release|owe|ledger|status)\b/i.test(raw)) return null;
    const world = game.atHand, player = actualPersonFor(game, body.id)!;
    readPrivateWordsAtTheActualBody(game, body.id);
    const pending = factsWithDataValue(world, 'swornBrotherhoodInvitation', true).filter(fact => fact.data.toId === body.id
        && game.present(body).some(face => face.id === fact.data.fromId)
        && !world.history.facts.some(reply => reply.data.swornBrotherhoodReply === fact.id));
    const face = (action.target && game.somebodyAtHand(action.target, body))
        || game.present(body).find(person => raw.toLowerCase().includes(person.name.toLowerCase()));
    const invitation = pending.find(fact => face ? fact.data.fromId === face.id : pending.length === 1);
    const subjectId = face?.id ?? (typeof invitation?.data.fromId === 'string' ? invitation.data.fromId : null);
    const subject = subjectId && actualPersonFor(game, subjectId);
    if (!subject || !body.alive || !game.present(body).some(face => face.id === subject.id)) return refused('world.swornBrotherhood',
        'oath', factsForRefusal('No mutual oath was made.', 'Reach the person whose answer you need. Nothing spent.'));
    if (swornSiblingsOf(world, body.id).has(subject.id)) return { ...game.freeAction(run, 'oath',
        factsForToolResult('You are already sworn siblings.', ['No second oath was made.'])), timeDisposition: 'no_op' as const };
    let accepted: boolean, spent: Awaited<ReturnType<typeof passHours>> | null = null;
    if (invitation && /\b(?:accept|agree|decline|refuse)\b/i.test(raw)) {
        accepted = !/\b(?:decline|refuse)\b/i.test(raw);
        appendWorldFact(world, makeFact({ day: routineTime(world), kind: 'opportunity', visibility: 'secret',
            locationId: game.worldPlaceOf(body), actors: [{ id: body.id, name: body.name, role: 'answered' }],
            causes: [invitation.id], summary: `${body.name} ${accepted ? 'accepted' : 'declined'} the brotherhood invitation.`,
            data: { swornBrotherhoodReply: invitation.id, accepted } }), { bystanders: false, recur: false });
    } else {
        const before = world.history.facts.length;
        accepted = putPrivateRequest(world, player, subject, routineTime(world),
            `${body.name} asked ${subject.name} to swear brotherhood.`, 'sworn-brotherhood-answer', 'a_real_favour',
            () => game.present(body).some(face => face.id === subject.id), LESSER_ACTION_DAYS.request);
        writePrivateWordsAtTheActualBody(game, body.id);
        const days = world.history.facts.slice(before).reduce((sum, fact) => sum + Number(fact.data.attentionDays ?? 0), 0);
        // Both people give the word while they are actually speaking, as the ordinary oath verb does.
        if (accepted && game.present(body).some(face => face.id === subject.id)) {
            recordSwornBrotherhood(world, actualPersonFor(game, body.id)!, actualPersonFor(game, subject.id)!, routineTime(world));
            writePrivateWordsAtTheActualBody(game, body.id);
        }
        game.theWorldMoved();
        spent = await passHours(game, run, body, days * 24);
        if (!spent.finished) {
            if (spent.spent && swornSiblingsOf(game.atHand!, body.id).has(subject.id))
                spent.spent.facts.lines.push(`${body.name} and ${subject.name} swore brotherhood before the exchange ended.`);
            return spent.spent;
        }
    }
    const current = game.currentRun(), reached = game.present(current.cultivator).some(face => face.id === subject.id);
    if (accepted && reached && current.cultivator.alive && !swornSiblingsOf(game.atHand!, body.id).has(subject.id)) {
        const before = game.atHand!.obligations.length;
        recordSwornBrotherhood(game.atHand!, actualPersonFor(game, body.id)!, actualPersonFor(game, subject.id)!, routineTime(game.atHand!));
        writeObligations(game.db, game.atHand!.obligations.slice(before));
        game.theWorldMoved();
    }
    const swore = swornSiblingsOf(game.atHand!, body.id).has(subject.id);
    const done = game.freeAction(current.run, 'oath', factsForToolResult(swore ? 'You swore brotherhood together.'
        : 'No mutual oath was made.', [swore ? `${body.name} and ${subject.name} are sworn siblings. Each gave a serious oath.`
            : `${subject.name} ${accepted ? 'is no longer here to swear the oath' : 'did not agree to the bond'}.` ]), !spent?.spent);
    if (spent?.spent) return executionWithItsSpentSpan(spent.spent, done, done);
    return done;
}
