/**
 * Observed source defect, 2026-10-07: canonical party readers required
 * out_with_a_party while native ship/carriage/owned boarding replaced that
 * activity with travelling and replaced the company term/home. The user's
 * final ruling keeps the RPG party distinct from strangers on the same craft.
 * These native authority controls preserve an existing agreement before,
 * during and after an actual course, including rerouting and cancellation;
 * they never turn a passenger or a crew colleague into a party member.
 * Uncompiled/unrun scratch candidate. Root owns red/green and played controls.
 */
import { expect, it } from 'vitest';
import { createNpc, setLocation, type NpcActivity } from '../../../src/engine/world/npc-state.js';
import { takeThemWithYou, whoIsOnTheRoadWith, whoTheyAreOutWith, whatThePartyIs } from '../../../src/engine/world/who-is-on-the-road-with-you.js';
import { companyDuringPassage, companyAfterPassage } from '../../../src/engine/world/company-during-a-passage.js';
import { activityOfAPublicPassage, onSponsoredPublicPassage, type PublicPassageQuote } from '../../../src/engine/world/public-shipping.js';
import { SEA_LANES } from '../../../src/data/cultivation/what-each-house-makes-and-what-crosses-the-water.js';

const leader = 'actual-agreed-leader';
function party(until = 80) {
    const npc = createNpc('passage-company-world', { id: 'company-member', onDay: 10, bornOnDay: -10000, locationId: 'departure' });
    return takeThemWithYou([npc], { party: [{ id: npc.id, name: npc.name }], leaderId: leader,
        note: 'An agreed journey together.', onDay: 10, untilDay: until })[0]!;
}
function course(sinceDay = 12, untilDay = 16): NpcActivity {
    return { kind: 'travelling', note: 'An actual paid passage.', withIds: ['actual-driver'],
        fromLocationId: 'departure', returnTo: 'arrival', sinceDay, untilDay, vesselId: 'actual-hull' };
}

it('keeps the original company term and words during boarding, rerouting and real landfall', () => {
    const member = party(), before = member.activity!;
    expect(whoIsOnTheRoadWith([member], leader, 11)).toEqual([member]);
    const aboard = { ...member, activity: companyDuringPassage(member.activity, course(), 12) };
    expect(aboard.activity.untilDay).toBe(16);
    expect(aboard.activity.returnTo).toBe('arrival');
    expect(whoTheyAreOutWith(aboard, 13)).toEqual({ withIds: before.withIds, untilDay: 80, note: before.note });
    const card = whatThePartyIs(whoIsOnTheRoadWith([aboard], leader, 13), 13)!;
    expect(card.line).toContain('67 more days');
    expect(card.line).toContain(before.note);
    expect(card.line).not.toContain('actual paid passage');
    const rerouted = { ...aboard, activity: companyDuringPassage(aboard.activity, course(14, 19), 14) };
    expect(rerouted.activity.passageCompany).toBe(before);
    expect(rerouted.activity.passageCompany?.passageCompany).toBeUndefined();
    const landed = { ...setLocation(rerouted, 'arrival', 19), activity: companyAfterPassage(rerouted, 19) };
    expect(landed.locationId).toBe('arrival');
    expect(landed.activity).toEqual(before);
    expect(whoIsOnTheRoadWith([landed], leader, 19)).toEqual([landed]);
});

it('sharing the course supplies no party agreement, and expired, dead or revoked company does not persist', () => {
    const member = party(14);
    const aboard = { ...member, activity: companyDuringPassage(member.activity, course(), 12) };
    const stranger = { ...member, id: 'fellow-passenger', activity: companyDuringPassage(null, course(), 12) };
    expect(whoIsOnTheRoadWith([aboard, stranger], leader, 13)).toEqual([aboard]);
    expect(whoTheyAreOutWith(stranger, 13)).toBeNull();
    expect(companyAfterPassage(aboard, 16)).toBeNull();
    expect(whoTheyAreOutWith(aboard, 14)).toBeNull();
    const dead = { ...aboard, status: 'physically_dead' as const };
    expect(whoIsOnTheRoadWith([dead], leader, 13)).toEqual([]);
    expect(whoTheyAreOutWith(dead, 13)).toBeNull();
    expect(companyAfterPassage(dead, 13)).toBeNull();
    const revoked = { ...aboard, activity: { ...aboard.activity } };
    delete revoked.activity.passageCompany;
    expect(companyAfterPassage(revoked, 13)).toBeNull();
});

it('an explicit cancellation restores valid company at its actual stop without a return-home journey', () => {
    const member = party();
    const aboard = { ...member, activity: companyDuringPassage(member.activity, course(), 12) };
    const stopped = { ...setLocation(aboard, 'actual-intermediate-ground', 13), activity: companyAfterPassage(aboard, 13) };
    expect(stopped.locationId).toBe('actual-intermediate-ground');
    expect(whoIsOnTheRoadWith([stopped], leader, 13)).toEqual([stopped]);
    expect(stopped.activity).toEqual(member.activity);
    expect(stopped.activity?.redirect).toBeUndefined();
});

it('the native sponsored ship writer retains company while its own course remains the physical authority', () => {
    const member = party(), lane = SEA_LANES[0]!;
    // The operator supplies an already accepted quote; this tests the native
    // sponsored writer, not fare discovery or a narrated journey.
    const quote = { lane, vesselId: 'actual-hull', fromId: 'departure', toId: 'arrival', departureDay: 12,
        arrivalDay: 16 } as PublicPassageQuote;
    const native = onSponsoredPublicPassage({ locations: [], seed: 'passage-company-world' }, member, quote, 'The accepted crossing.');
    expect(native).not.toBeNull();
    expect(native!.activity?.kind).toBe('travelling');
    expect(native!.activity?.returnTo).toBe('arrival');
    expect(whoTheyAreOutWith(native!, 13)?.untilDay).toBe(80);
    expect(native!.activity?.passageCompany).toEqual(member.activity);
    expect(activityOfAPublicPassage(quote, 'Another traveller.', [leader]).passageCompany).toBeUndefined();
});

it('an explicitly accepted ongoing agreement has no synthesized night deadline', () => {
    const member = party();
    const ongoing = takeThemWithYou([member], { party: [{ id: member.id, name: member.name }], leaderId: leader,
        note: 'An explicitly agreed ongoing journey.', onDay: 12, untilDay: null })[0]!;
    expect(whoTheyAreOutWith(ongoing, 13)?.untilDay).toBeNull();
    expect(whoIsOnTheRoadWith([ongoing], leader, 100)).toEqual([ongoing]);
    expect(ongoing.activity?.redirect).toBeUndefined();
    expect(whatThePartyIs([ongoing], 13)?.line).toContain('while the agreement continues');
});

it('renewing actual company aboard replaces only its agreement and retains the exact physical leg', () => {
    const member = party(14);
    const physical = course();
    const aboard = { ...member, activity: companyDuringPassage(member.activity, physical, 12) };
    const renewed = takeThemWithYou([aboard], { party: [{ id: member.id, name: member.name }], leaderId: leader,
        note: 'They agreed to keep travelling together.', onDay: 13, untilDay: null, preservePassage: true })[0]!;
    const { passageCompany: agreement, ...actualCourse } = renewed.activity!;
    expect(actualCourse).toEqual(physical);
    expect(agreement?.untilDay).toBeNull();
    expect(agreement?.returnTo).toBe(member.activity!.returnTo);
    expect(agreement?.passageCompany).toBeUndefined();
    expect(whoTheyAreOutWith(renewed, 15)?.note).toContain('agreed to keep travelling');
});
