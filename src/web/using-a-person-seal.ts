/** A spoken intention reaches the existing seal gate; only a live effect can compel. */
import type { GameService } from './turn-engine.js';
import type { Run, Cultivator } from '../schema/cultivation.js';
import type { PlannedAction } from './planned-action.js';
import { actualPersonFor } from './the-actual-person-behind-a-world-row.js';
import { applyActualPersonSeal, releaseActualPersonSeal } from './person-seals-at-the-actual-body.js';
import { holdsASlaveSeal, theSealStillHolds } from '../engine/cultivation/a-qi-seal-is-put-on-a-person.js';
import { whatBreakingASealTakes } from '../engine/social/what-laying-a-qi-seal-takes.js';
import { commandSlave, finishSlaveOrder, type PersonOrder } from '../engine/world/slave-orders.js';
import { endSlaveThroughSeal, liftPersonSeal } from '../engine/world/person-seals.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { forStream } from '../engine/cultivation/rng.js';
import { makeFact } from '../engine/world/history.js';
import { appendWorldFact } from '../engine/world/who-was-there-when-it-happened.js';
import { factsForToolResult, factsForRefusal } from './facts.js';
import { refused } from './tool-result-prose.js';

export async function usingAPersonSeal(game: GameService, run: Run, body: Cultivator, action: PlannedAction, raw: string) {
    if (!game.atHand || !/\b(?:slave|qi)[ -]seal(?:ed)?\b/i.test(raw)
        && !/\b(?:order|command)\b/i.test(raw)) return null;
    if (/\b(?:offer|accept|agree|contract)\b/i.test(raw)) return null;
    const world = game.atHand, day = routineTime(world), holder = actualPersonFor(game, body.id)!;
    const people = [...world.npcs.filter(person => !game.repos.cultivators.getById(person.id)),
        ...game.repos.cultivators.list().flatMap(person => actualPersonFor(game, person.id) ?? [])];
    const named = people.find(person => person.id !== body.id && raw.toLowerCase().includes(person.name.toLowerCase()));
    if (!/\b(?:slave|qi)[ -]seal(?:ed)?\b/i.test(raw) && !/\bslave\b/i.test(raw)
        && (!named || !holdsASlaveSeal(named.cultivation.seal, body.id, day))) return null;
    const subject = named ?? (action.target && actualPersonFor(game, game.somebodyAtHand(action.target, body)?.id ?? ''))
        ?? people.find(person => holdsASlaveSeal(person.cultivation.seal, body.id, day));
    const no = (line: string) => refused('social.personSeal', 'oath', factsForRefusal('The seal act did not proceed.', line));
    if (!subject) return no('Name the real person whose seal is concerned.');
    if (/\b(?:order|command)\b/i.test(raw)) {
        if (!holdsASlaveSeal(subject.cultivation.seal, body.id, day)) return no('That person is not slave-sealed to you.');
        const words = /\bto\s+(.+)$/i.exec(raw)?.[1] ?? action.topic ?? '';
        const attack = /\b(?:attack|kill|massacre|slaughter)\b/i.test(words);
        const kind: PersonOrder['action'] = attack ? 'attack' : /\bguard\b/i.test(words) ? 'guard'
            : /\b(?:fetch|bring)\b/i.test(words) ? 'fetch' : /\b(?:message|tell|deliver word)\b/i.test(words) ? 'message'
                : /\b(?:follow|accompany|join my party)\b/i.test(words) ? 'company'
                    : /\b(?:cultivate|seclude)\b/i.test(words) ? 'cultivate'
                        : /\b(?:go|travel|walk|fly)\b/i.test(words) ? 'travel' : 'request';
        const destination = world.locations.filter(place => words.toLowerCase().includes(place.name.toLowerCase()))
            .sort((a, b) => b.name.length - a.name.length)[0];
        const victim = people.find(person => person.id !== subject.id && words.toLowerCase().includes(person.name.toLowerCase()));
        const object = world.objects.find(object => words.toLowerCase().includes(object.name.toLowerCase()));
        if (attack && !destination && !victim) return no('Name the actual person or place to attack.');
        if (victim && game.repos.cultivators.getById(victim.id))
            return no('That attack must be resolved in the actual person\'s foreground fight.');
        const destinationId = destination?.id ?? victim?.locationId ?? (object?.locationId as string | null) ?? game.worldPlaceOf(body);
        if (!destinationId || !words) return no('State the order and its actual destination.');
        const fact = commandSlave(world, holder, subject, { action: kind, destinationId,
            ...(victim ? { targetId: victim.id } : {}), ...(object ? { objectId: object.id } : {}), words, days: action.days }, day, true);
        if (!fact) return no('No living slave seal carries that order.');
        game.theWorldMoved();
        if (kind === 'request') {
            const done = await game.request(run, body, game.ambientFor(body, run), subject.name, 'a_thing', words, undefined,
                `I ask ${subject.name} to ${words}`, action.days);
            if (done.outcome === 'executed') finishSlaveOrder(world, fact, day, `The actual request path resolved the order. ${done.facts.lines.join(' ')}`);
            done.facts.lines.unshift(`${subject.name} is compelled by the slave seal. ${words}`);
            game.theWorldMoved();
            return done;
        }
        return game.freeAction(run, 'oath', factsForToolResult(`${subject.name} is compelled to carry out the order.`,
            [`${subject.name} is compelled to carry out the order.`, words, 'The actual route, body and opposition decide what they achieve.']));
    }
    const seal = subject.cultivation.seal;
    if (/\b(?:kill|end .*life|destroy .*soul)\b/i.test(raw) && /\bslave\b/i.test(raw)) {
        if (subject.status !== 'alive' || !holdsASlaveSeal(seal, body.id, day)) return no('You do not hold that living slave seal.');
        if (game.repos.cultivators.getById(subject.id)) game.repos.cultivators.markDead(subject.id, 'combat_defeat', run.turn + 1,
            `Killed through the slave seal held by ${body.name}.`);
        else {
            endSlaveThroughSeal(world, holder, subject.id, day);
        }
        game.theWorldMoved();
        return game.freeAction(run, 'oath', factsForToolResult(`${subject.name} was killed through the slave seal.`,
            [`${subject.name} was killed through the slave seal.`, 'The named death is recorded.']));
    }
    if (/\b(?:release|remove|lift|break)\b/i.test(raw)) {
        if (!seal || !theSealStillHolds(seal, day)) return no('No live person seal holds them.');
        const caster = seal.byId && actualPersonFor(game, seal.byId);
        if (!caster) return no('The caster cannot be resolved.');
        const force = /\bbreak\b/i.test(raw);
        if (!game.repos.cultivators.getById(subject.id)) {
            const result = liftPersonSeal(world, holder, subject.id, day, force ? 'force_of_arms' : 'the_hand_that_laid_it');
            if (!result) return no('No live person seal can be resolved.');
            game.theWorldMoved();
            return game.freeAction(run, 'oath', factsForToolResult(result.lifted ? 'The seal came off.' : 'The seal holds.',
                [result.line, ...(result.lifted && force && seal.kind === 'slave' ? ['The freed person\'s soul is fragmented. The caster knows.'] : [])]));
        }
        const result = whatBreakingASealTakes({ how: force ? 'force_of_arms' : 'the_hand_that_laid_it',
            breakerOrdinal: body.realmOrdinal, casterOrdinal: seal.atOrdinal ?? caster.cultivation.realmOrdinal, isTheCaster: caster.id === body.id });
        const lifted = result.odds === 1 || result.odds > 0 && forStream(run.seed, 'break-person-seal', run.turn, subject.id).chance(result.odds);
        if (lifted) {
            releaseActualPersonSeal(game, subject.id, day, force);
            appendWorldFact(world, makeFact({ day, kind: 'opportunity', visibility: 'secret', witnessIds: [caster.id, subject.id, body.id],
                actors: [{ id: body.id, name: body.name, role: 'lifted' }, { id: subject.id, name: subject.name, role: 'subject' }],
                locationId: game.worldPlaceOf(body), summary: `${body.name} ${force ? 'broke' : 'released'} the seal on ${subject.name}.`,
                data: { personSealLifted: subject.id, casterId: caster.id, broken: force } }), { recur: false, bystanders: false });
        }
        game.theWorldMoved();
        return game.freeAction(run, 'oath', factsForToolResult(lifted ? 'The seal came off.' : 'The seal holds.',
            [result.line, ...(lifted && force && seal.kind === 'slave' ? ['The freed person\'s soul is fragmented. The caster knows.'] : [])]));
    }
    if (!game.present(body).some(person => person.id === subject.id)
        && game.whoHasYieldedToYou(body)?.id !== subject.id) return no('They must be actually reached before a seal can be laid.');
    const kind = /\bslave\b/i.test(raw) ? 'slave' : 'qi';
    const laid = applyActualPersonSeal(game, body.id, subject.id, { kind, day,
        consentOrSubmission: game.whoHasYieldedToYou(body)?.id === subject.id,
        days: action.days, note: raw });
    game.theWorldMoved();
    if (!laid?.went) return no(laid?.line ?? 'No seal could be laid.');
    return game.freeAction(run, 'oath', factsForToolResult(`A ${kind} seal was laid on ${subject.name}.`, [laid.line]));
}
