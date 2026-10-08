/**
 * Source audit 2026-10-07 found every company request became a night invitation
 * and an already invited person could not be asked to continue: costing refused
 * before the ordinary consent resolver. The owner distinguishes an established
 * RPG party from fellow passengers. Joining that party is actual-person consent,
 * with the stated term or no stated end, never automatic passenger affiliation.
 * The operator uses the existing withTheAttemptLanding positive control; this
 * is native behavior, not actual model prose acceptance. Refusal is unforced.
 * Root-owned Consent12 paired17347 recorded red 2 failures / 12 passes and
 * candidate 2 failures / 12 passes. Preserved diagnostic13 then proved both
 * positive attempts landed, wrote actual ongoing company with no night end,
 * retained the reverse debt and spent .125 days. The resolver returned turned:
 * its authoritative contract means they did it and took hold of the asking.
 * Generic request/interact tool and execution flags recognised only taken,
 * falsely reporting a refusal after the deed. Consent14 uses one accepted
 * outcome read without removing that reverse obligation or changing the draw.
 * Original14-case runtime controls and assertions remain; added call-through
 * execution and actual ledger checks protect this measured reporting defect.
 * Consent14 remains uncompiled/unrun; diagnostic prose is scripted, not a model
 * acceptance claim. Original12/13 evidence stays frozen.
 * Consent14 compiler11294 passed; paired native reached the corrected tool and
 * execution flags, then both positives failed the added debt observer. Preserved
 * diagnostic15 found the same actual open turned debt through world person,
 * resolved request person and player ledger reads: world id equals resolved id.
 * There was no alias defect. The engine wrote the player as holder and the NPC
 * as subject; the assertion had invented the opposite direction. Consent16
 * changes only that observer to the actual open turned account involving both
 * actors. Engine holder, subject, terms, counter-obligation and draws remain
 * untouched; original consent assertions and execution checks are retained.
 * Consent16 is uncompiled/unrun. Original14/15 evidence stays frozen.
 * Consent16 full compiler passed; strict report-only red reached its intended
 * two failures / twelve passes. Candidate then reached thirteen passes and
 * failed the later original explicit-dismissal assertion. Preserved diagnostic17
 * showed the given-name target remained present and the agreement unchanged:
 * the actual request handler never ran. The deterministic floor did not read
 * 'I part company with <name>', so the existing intent safety check rejected
 * the model request as an unsafe mismatch. Consent18 adds that ordinary form
 * to the existing end-company route, without bypassing the safety check or
 * changing dismissal, consent, time or ledger. An isolated established-company
 * case reaches dismissal independently of the earlier acceptance checks.
 * Consent18 remains uncompiled/unrun. Original16/17 evidence stays frozen.
 * Consent20 strengthens the isolated named ending with a second existing living
 * agreed member on the same actual ground. That other agreement must survive;
 * dropping the name into an unspecified dismissal cannot pass this control.
 * Consent19 native report-control arm stopped at 3 failures / 12 passes:
 * the two intended accepted-report failures plus this newly added zero-time
 * expectation. Consent21 root-owned isolated native46792 measured an executed
 * request with no timeDisposition, no timeSkip, and lesserActionTime/simulation/
 * storage all charging .125 day. The named member ended, the second agreement
 * survived, and ground/accounts stayed intact. freeAction is not free_read:
 * existing executor4349 applies ordinary exchange time to this request.
 * Consent22 changes only that added timing expectation to the observed .125;
 * original16 assertions and all production timing/runtime remain unchanged.
 * Prior runtime and assertions remain intact; this successor is uncompiled/unrun.
 * Local invitation sibling tests retain their contract.
 */
import { expect, it, vi } from 'vitest';
import { ledgerAbout } from '../../src/storage/repos/obligation.repo.js';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { worldLocationFor } from '../../src/web/entities.js';
import { peopleInThisPlace } from '../../src/web/hearsay.js';
import { withTheAttemptLanding } from '../../src/server/consolidated/forcing-an-attempt-to-land.js';
import { whoTheyAreOutWith, takeThemWithYou } from '../../src/engine/world/who-is-on-the-road-with-you.js';
import { routineTime, invitationEndsAt } from '../../src/engine/world/npc-routines.js';

async function scene() {
    const plans: string[] = [];
    const h = await makeGameInWorld({ seed: 'routine-visit', worldSeed: 'road-world',
        provider: new ScriptedProvider({ plans, narrations: ['Opening.', 'Reply.'] }) });
    const { cultivator } = await h.game.newRun('Visitor');
    const world = (await h.game.loadWorld())!, body = h.repos.cultivators.getById(cultivator.id)!;
    const place = worldLocationFor(world, body.location)!;
    const read = peopleInThisPlace(h.repos, body, world, place);
    const other = world.npcs.find(n => n.status === 'alive' && n.identity.sex === 'female' && read.whereIs.has(n.id))!;
    expect(other).toBeDefined();
    h.repos.cultivators.standIn(body.id, read.whereIs.get(other.id)!);
    plans.push(JSON.stringify({ action: 'look', intent: 'around' }));
    await h.game.act('I look around.');
    expect(h.game.present(h.game.state().cultivator).some(n => n.id === other.id)).toBe(true);
    h.game.theyGaveTheirName(h.game.state().cultivator, h.game.currentRun().run, other);
    return { ...h, other, plans };
}
function company(h: Awaited<ReturnType<typeof scene>>) {
    const npc = h.game.atHand!.npcs.find(n => n.id === h.other.id)!;
    return whoTheyAreOutWith(npc, routineTime(h.game.atHand!));
}

it('actual consent to join the party has no invented night end and can be explicitly ended', async () => {
    const h = await scene();
    try {
        const before = h.game.state();
        h.plans.push(JSON.stringify({ action: 'request', intent: 'company', target: h.other.name, topic: 'join my party' }));
        const actualRequest = vi.spyOn(h.game, 'request');
        const joined = await withTheAttemptLanding('request', () => h.game.act('I ask ' + h.other.name + ' to join my party.'));
        expect(joined.result.toolCalls.some(c => c.name === 'engine.resolveAttempt' && c.ok)).toBe(true);
        expect(joined.result.toolCalls.some(c => c.name === 'world.takeThemWithYou' && c.ok)).toBe(true);
        const execution = await actualRequest.mock.results.at(-1)!.value;
        actualRequest.mockRestore();
        expect(execution.outcome, 'the actual accepted request execution cannot report refusal').toBe('executed');
        expect(joined.forced.landed).toContain('an_approach_to_somebody');
        expect(joined.result.toolCalls.some(c => c.name === 'social.createObligation' && c.ok)).toBe(true);
        const held = ledgerAbout(h.db, h.other.id);
        expect(held.some(row => row.kind === 'debt' && row.status === 'open' && row.tags.includes('turned')
            && new Set([row.holderId, row.subjectId]).size === 2
            && [row.holderId, row.subjectId].includes(h.other.id)
            && [row.holderId, row.subjectId].includes(h.game.currentRun().cultivator.id)),
            'an accepted turned attempt retains its actual open account involving both actors').toBe(true);
        expect(h.game.state().run.elapsedDays - before.run.elapsedDays).toBeCloseTo(.125, 8);
        expect(company(h)?.untilDay).toBeNull();
        expect(h.game.atHand!.npcs.find(n => n.id === h.other.id)!.activity?.redirect).toBeUndefined();
        const ordinaryInvitationEnd = invitationEndsAt(h.game.atHand!);
        h.plans.push(JSON.stringify({ action: 'wait' }));
        await h.game.act('I wait for 12 hours.');
        expect(routineTime(h.game.atHand!)).toBeGreaterThanOrEqual(ordinaryInvitationEnd);
        expect(company(h)?.withIds).toContain(before.cultivator.id);
        h.plans.push(JSON.stringify({ action: 'request', intent: 'end_company', target: h.other.name }));
        await h.game.act('I part company with ' + h.other.name + '.');
        expect(company(h)).toBeNull();
        expect(h.game.atHand!.npcs.find(n => n.id === h.other.id)!.activity?.kind).not.toBe('travelling');
    } finally { h.db.close(); }
}, 180_000);

it('renewing a local invitation into ongoing travel asks for actual consent instead of refusing as already with you', async () => {
    const h = await scene();
    try {
        h.plans.push(JSON.stringify({ action: 'request', intent: 'company', target: h.other.name, topic: 'my room' }));
        await withTheAttemptLanding('request', () => h.game.act('I invite ' + h.other.name + ' to my room.'));
        expect(company(h)?.untilDay).not.toBeNull();
        h.plans.push(JSON.stringify({ action: 'request', intent: 'company', target: h.other.name, topic: 'keep travelling together' }));
        const actualRequest = vi.spyOn(h.game, 'request');
        const renewed = await withTheAttemptLanding('request', () => h.game.act('I ask ' + h.other.name + ' to keep travelling together.'));
        expect(renewed.result.toolCalls.some(c => c.name === 'engine.resolveAttempt' && c.ok)).toBe(true);
        expect(renewed.result.toolCalls.some(c => c.name === 'world.takeThemWithYou' && c.ok)).toBe(true);
        const execution = await actualRequest.mock.results.at(-1)!.value;
        actualRequest.mockRestore();
        expect(execution.outcome, 'the actual accepted request execution cannot report refusal').toBe('executed');
        expect(renewed.forced.landed).toContain('an_approach_to_somebody');
        expect(renewed.result.toolCalls.some(c => c.name === 'social.createObligation' && c.ok)).toBe(true);
        const held = ledgerAbout(h.db, h.other.id);
        expect(held.some(row => row.kind === 'debt' && row.status === 'open' && row.tags.includes('turned')
            && new Set([row.holderId, row.subjectId]).size === 2
            && [row.holderId, row.subjectId].includes(h.other.id)
            && [row.holderId, row.subjectId].includes(h.game.currentRun().cultivator.id)),
            'an accepted turned attempt retains its actual open account involving both actors').toBe(true);
        expect(company(h)?.untilDay).toBeNull();
        expect(h.game.atHand!.npcs.find(n => n.id === h.other.id)!.activity?.redirect).toBeUndefined();
    } finally { h.db.close(); }
}, 180_000);

it('an actual unforced refusal creates no ongoing party and still spends the ordinary exchange', async () => {
    const h = await scene();
    try {
        const before = h.game.state();
        h.plans.push(JSON.stringify({ action: 'request', intent: 'company', target: h.other.name, topic: 'join my party' }));
        const refused = await h.game.act('I ask ' + h.other.name + ' to join my party.');
        expect(refused.toolCalls.some(c => c.name === 'engine.resolveAttempt' && !c.ok)).toBe(true);
        expect(refused.toolCalls.some(c => c.name === 'world.takeThemWithYou' && c.ok)).toBe(false);
        expect(company(h)).toBeNull();
        expect(h.game.state().run.elapsedDays - before.run.elapsedDays).toBeCloseTo(.125, 8);
        expect(h.game.state().cultivator.spiritStones).toBe(before.cultivator.spiritStones);
    } finally { h.db.close(); }
}, 180_000);


it('an already established actual company can be ended by parting with the name they gave', async () => {
    const h = await scene();
    try {
        const world = h.game.atHand!, before = h.game.currentRun(), day = routineTime(world);
        const at = world.npcs.findIndex(person => person.id === h.other.id);
        const another = world.npcs.find(person => person.status === 'alive' && person.id !== h.other.id
            && person.id !== before.cultivator.id && person.locationId === world.npcs[at]!.locationId)!;
        expect(another, 'another existing living person on this actual ground supplies the retained agreement control').toBeDefined();
        const agreed = takeThemWithYou(world.npcs, { party: [
            { id: h.other.id, name: h.other.name }, { id: another.id, name: another.name }
        ], leaderId: before.cultivator.id, note: 'An already agreed ongoing company.', onDay: day, untilDay: null });
        for (const member of agreed) world.npcs[world.npcs.findIndex(person => person.id === member.id)] = member;
        const retained = structuredClone(world.npcs.find(person => person.id === another.id)!.activity);
        expect(whoTheyAreOutWith(world.npcs.find(person => person.id === another.id)!, day)?.withIds).toContain(before.cultivator.id);
        h.game.theWorldMoved();
        h.game.theyGaveTheirName(before.cultivator, before.run, world.npcs[at]!);
        expect(company(h)?.withIds).toContain(before.cultivator.id);
        const location = world.npcs[at]!.locationId, accounts = ledgerAbout(h.db, h.other.id);
        h.plans.push(JSON.stringify({ action: 'request', intent: 'end_company', target: h.other.name }));
        const ended = await h.game.act('I part company with ' + h.other.name + '.');
        expect(ended.toolCalls.some(call => call.name === 'engine.parseIntent' && !call.ok), JSON.stringify(ended.toolCalls)).toBe(false);
        expect(company(h), 'the actual ongoing membership ends after the ordinary named dismissal').toBeNull();
        const stillWithYou = h.game.atHand!.npcs.find(person => person.id === another.id)!;
        expect(whoTheyAreOutWith(stillWithYou, routineTime(h.game.atHand!))?.withIds,
            'ending company with the named person cannot dismiss a different actual agreed member').toContain(before.cultivator.id);
        expect(stillWithYou.activity).toEqual(retained);
        expect(h.game.atHand!.npcs.find(person => person.id === h.other.id)!.locationId).toBe(location);
        expect(h.game.atHand!.npcs.find(person => person.id === h.other.id)!.activity?.kind).not.toBe('travelling');
        expect(h.game.currentRun().run.elapsedDays - before.run.elapsedDays, 'the actual end-company request is an ordinary exchange').toBeCloseTo(.125, 8);
        expect(ledgerAbout(h.db, h.other.id)).toEqual(accounts);
    } finally { h.db.close(); }
}, 180_000);
