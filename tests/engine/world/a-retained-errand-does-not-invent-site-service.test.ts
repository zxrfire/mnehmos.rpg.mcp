/**
 * Oct7 source audit found retainedSendings rolling success/loss/return solely on
 * due date and surviving IDs: a living member at another town could finish a
 * site errand, lose the house's stake, and be walked home. These native driver
 * controls bind the actual target and uninterrupted activity, then distinguish
 * an already-served same-site term from absent or superseded work. They arrange
 * an ordinary catalog posting, not a manufactured annual completed history.
 * An elapsed unfulfilled term does not grow into later success; a still-active
 * real course remains pending without an invented sighting, death or return.
 * Separate receipt controls prove an accepted air deadline is not landfall and
 * a caused stop is not service. No independent attendance log is claimed.
 * Native component hull controls additionally take the real outward leg, five
 * site days and prepaid return through the driver. Custody is an explicit ordinary
 * transfer fixture; these do not claim office loan consent/board acceptance.
 * Retained14 native measured 11/13 passing. Diagnostic02 established the personal
 * fixture edited an obsolete NPC alias after fact linking, leaving the original
 * five-day activity and no accepted air reference. It also proved the paid hull
 * reached home while a later road projection put its operator back at the post.
 * The current-row binding and receipt-proven return completion preserve actual
 * native arrival/body/custody; successor validation remains root-owned and pending.
 * The home census also found whole-away escorts rejected when both physical
 * legs exactly filled their term: zero time parked is not failed on-site work.
 * That false unfinished binding blocked the body write home until Internal
 * Affairs erased it at the destination. Explicit on-site terms still need all
 * their authored service; an escort can be served by the actual journey.
 * After repairing that read, the same native case found successful settlement
 * clearing the route before committing its proven home position. The assertion
 * keeps the returned body at the actual road endpoint, not its old site marker.
 * An unserved errand that really returned closes unfinished at home. Keeping
 * its returned actor bound forever accumulated work that could never succeed.
 */
import { expect, it } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { fixtureCatalog } from './fixtures.js';
import { createNpc, setRealm, setLocation, markDead } from '../../../src/engine/world/npc-state.js';
import { advanceWorldForPlay } from '../../../src/engine/world/driver.js';
import { getSendingReason } from '../../../src/data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import { postingFor, aPostingForItsActualLegs } from '../../../src/engine/world/who-goes-out-for-a-house-and-what-comes-back.js';
import { aPostingThatCanReachItsGround, siteIntervalOnAnNpcPosting, journeyTimeHasReached } from '../../../src/engine/world/places-on-the-way.js';
import { isLostTrackOf } from '../../../src/engine/world/who-a-house-has-lost-track-of.js';
import { aRetainedMemberActuallyServed } from '../../../src/engine/world/a-retained-sending-has-actually-served.js';
import { beginAnAirCourse, stopAnAirCourse, settleWorldAirTravellers } from '../../../src/engine/world/an-air-course-in-the-world.js';
import { linkLocations, makeLocation } from '../../../src/engine/world/locations.js';
import { quoteAnAirJourney, conveyanceOfPersonalFlight } from '../../../src/engine/world/what-an-air-journey-takes.js';
import { aRetainedMemberActuallyReturned } from '../../../src/engine/world/a-retained-sending-has-actually-served.js';
import { aVehicleOf } from '../../../src/engine/world/a-vehicle.js';
import { transferPossession } from '../../../src/engine/world/possessions.js';
import { quoteHouseAirDuty, admitPaidHouseAirDuty } from '../../../src/engine/world/a-house-party-takes-an-actual-air-leg.js';

function arranged() {
    const world = seedWorld({ seed: 'retained-actual-site', catalog: fixtureCatalog(),
        presentYear: 1000, population: 0 }).state;
    const house = world.factions[0]!;
    world.factions = [house]; world.npcs = []; world.schedule = []; world.populationTarget = 0;
    world.locations.forEach(place => { place.cycle = null; place.controllingFactionId = null; });
    house.resources = { spirit_stones: 100000, levy_per_year: 0 };
    const site = world.locations.find(place => place.kind === 'settlement')!;
    const other = world.locations.find(place => place.kind === 'settlement' && place.id !== site.id)!;
    const start = world.currentDay;
    const reason = getSendingReason('sending-to-look-in-on-a-posting')!;
    const posting = postingFor({ reason, house, pitchOrdinal: 0, locationId: site.id });
    const member = createNpc(world.seed, { id: 'actual-retained-member', name: 'Actual retained member',
        bornOnDay: start - 30 * 365, onDay: start, factionId: house.id, locationId: site.id,
        cultivation: { realmOrdinal: 16 } });
    member.activity = { kind: 'out_with_a_party', note: 'Actual catalog posting check.', withIds: [],
        sinceDay: start, untilDay: start + posting.days, returnTo: site.id };
    world.npcs = [member];
    const row = { posting, party: [{ id: member.id, name: member.name, ordinal: 16 }],
        departsOnDay: start, locationId: site.id, counterparties: [] };
    world.pendingSendings = [row];
    return { world, house, site, other, start, posting, member, row };
}
function move(h: ReturnType<typeof arranged>, days: number) {
    return advanceWorldForPlay(h.world, { days, pressure: { intensity: 0,
        peopleWalkOutOnTheirOwnAccount: false } });
}
function reports(h: ReturnType<typeof arranged>) {
    return h.world.history.facts.filter(fact => fact.kind === h.posting.reason.factKind
        && fact.actors.some(actor => actor.id === h.member.id));
}
it('reports a living party elsewhere neutrally and preserves its actual still-active work', () => {
    const h = arranged(); h.member.locationId = h.other.id;
    const entryPurse = h.house.resources.spirit_stones;
    move(h, h.posting.days);
    const actual = h.world.npcs.find(person => person.id === h.member.id)!;
    expect(actual.status).toBe('alive'); expect(isLostTrackOf(h.world, actual)).toBe(false);
    expect(actual.locationId).toBe(h.other.id);
    expect(actual.activity?.sinceDay).toBe(h.start);
    expect(h.world.pendingSendings).toHaveLength(1);
    expect(h.house.resources.spirit_stones).toBe(entryPurse);
    const news = reports(h).filter(fact => fact.data.retainedSendingUnfinished === true);
    expect(news).toHaveLength(1); expect(news[0]!.truth).toBe('unresolved');
    expect(news[0]!.nearMiss).toBe(false);
    expect(news[0]!.actors.every(actor => !/came back|did not come back/.test(actor.role))).toBe(true);
    move(h, 1);
    expect(reports(h).filter(fact => fact.data.retainedSendingUnfinished === true)).toHaveLength(1);
});
it('does not call standing at the target on due day a served superseded term', () => {
    const h = arranged();
    h.member.activity = { kind: 'their_practice', note: 'A different actual task.', withIds: [],
        sinceDay: h.start, untilDay: null };
    move(h, h.posting.days);
    expect(reports(h).some(fact => fact.data.retainedSendingUnfinished === true)).toBe(true);
    expect(h.world.npcs.find(person => person.id === h.member.id)!.locationId).toBe(h.site.id);
    expect(h.world.pendingSendings).toHaveLength(0);
});
it('resolves the genuinely served same-site term through the ordinary native outcome once', () => {
    const h = arranged();
    expect(aRetainedMemberActuallyServed(h.world, h.member, h.row)).toBe(false);
    move(h, h.posting.days);
    expect(h.world.pendingSendings).toHaveLength(0);
    const news = reports(h).filter(fact => fact.day === h.start + h.posting.days);
    expect(news).toHaveLength(1); expect(news[0]!.truth).not.toBe('unresolved');
    expect(news[0]!.data.retainedSendingUnfinished).not.toBe(true);
    move(h, 1); expect(reports(h).filter(fact => fact.day === h.start + h.posting.days)).toEqual(news);
});
it('a whole-away escort whose real road fills its term returns without requiring time parked', () => {
    const h = arranged();
    const from = makeLocation({ id: 'escort-home', name: 'House grounds', kind: 'sect_seat' });
    const to = makeLocation({ id: 'escort-market', name: 'Market', kind: 'settlement' });
    const reason = getSendingReason('sending-an-escort')!;
    linkLocations(from, to, 'road', reason.days / 2);
    h.world.locations = [from, to]; h.house.seatLocationId = from.id;
    h.row.posting = aPostingThatCanReachItsGround(postingFor({ reason, house: h.house,
        pitchOrdinal: 0, locationId: to.id, hands: 1 }), h.world.locations, from.id, to.id);
    h.row.locationId = to.id;
    h.member.locationId = to.id;
    h.member.activity = { kind: 'out_with_a_party', note: 'Escorting the house envoy.', withIds: [],
        sinceDay: h.start, untilDay: h.start + h.row.posting.days,
        fromLocationId: from.id, returnTo: from.id };
    const due = h.member.activity.untilDay!;
    const site = siteIntervalOnAnNpcPosting(h.world.locations, h.member)!;
    expect(site.untilDay).toBe(site.fromDay);
    h.world.currentDay = due;
    expect(aRetainedMemberActuallyServed(h.world, h.member, h.row)).toBe(true);
    expect(aRetainedMemberActuallyReturned(h.world, h.member, h.row)).toBe(true);
    h.world.currentDay = h.start;
    move(h, h.row.posting.days);
    expect(h.world.pendingSendings).toHaveLength(0);
    expect(h.world.npcs.find(person => person.id === h.member.id)!.locationId).toBe(from.id);
    expect(h.world.history.facts.some(fact => fact.data.retainedSendingUnfinished === true)).toBe(false);
    expect(h.world.history.facts.filter(fact => fact.kind === reason.factKind
        && fact.actors.some(actor => actor.id === h.member.id))).toHaveLength(1);
});
it('a genuinely returned but unserved on-site errand closes unfinished at home', () => {
    const h = arranged();
    const from = makeLocation({ id: 'unserved-home', name: 'House grounds', kind: 'sect_seat' });
    const to = makeLocation({ id: 'unserved-market', name: 'Market', kind: 'settlement' });
    linkLocations(from, to, 'road', h.posting.days / 2);
    h.world.locations = [from, to]; h.house.seatLocationId = from.id;
    h.row.locationId = to.id; h.row.posting = { ...h.posting, locationId: to.id };
    h.member.locationId = to.id;
    h.member.activity = { kind: 'out_with_a_party', note: 'Checking the posting.', withIds: [],
        sinceDay: h.start, untilDay: h.start + h.posting.days,
        fromLocationId: from.id, returnTo: from.id };
    move(h, h.posting.days);
    const actual = h.world.npcs.find(person => person.id === h.member.id)!;
    expect(actual.locationId).toBe(from.id);
    expect(actual.activity).toBeNull();
    expect(h.world.pendingSendings).toHaveLength(0);
    const news = reports(h).filter(fact => fact.data.retainedSendingUnfinished === true);
    expect(news).toHaveLength(1);
    expect(news[0]!.truth).toBe('unresolved');
});
for (const stopped of [false, true]) it('requires native air landfall and rejects a caused stop: ' + stopped, () => {
    const h = arranged();
    h.member = setRealm(h.member, 29, h.start); h.world.npcs = [h.member];
    h.row.party[0]!.ordinal = h.member.cultivation.realmOrdinal;
    const from = makeLocation({ id: 'retained-air-origin', name: 'Departure ground', kind: 'settlement',
        data: { metricXLi: 0, metricYLi: 0, metricExtentLi: 0 } });
    const to = makeLocation({ id: 'retained-air-target', name: 'Posting ground', kind: 'settlement',
        data: { metricXLi: 8, metricYLi: 0, metricExtentLi: 0 } });
    h.world.locations.push(from, to); h.member.locationId = from.id;
    h.row.locationId = to.id; h.row.posting = { ...h.posting, locationId: to.id };
    const course = beginAnAirCourse(h.world, { bodyId: h.member.id, bodyName: h.member.name,
        fromId: from.id, toId: to.id, conveyanceId: 'conv-sword-flight', power: null,
        vesselId: null, artId: null, onDay: h.start, heads: 1,
        houseDutyFunding: { houseId: h.house.id, returnStones: 0 } });
    if (!course) throw Error('Native air course did not accept the arranged actual metric leg');
    // Actual fact linking replaces the NPC row; bind the current native body,
    // retaining its receipt/history rather than editing the obsolete fixture alias.
    h.member = h.world.npcs.find(person => person.id === h.member.id)!;
    // This is a component duty binding, not a claim of house-loan/player-board acceptance.
    const conveyance = conveyanceOfPersonalFlight(null);
    if (!conveyance) throw Error('Native innate conveyance is absent');
    const back = quoteAnAirJourney(h.world.locations, to.id, from.id, conveyance);
    if (!back) throw Error('Native actual return quote is unavailable');
    h.row.posting = aPostingForItsActualLegs(h.row.posting, course.quote.daysOneWay, back.daysOneWay);
    h.member.activity = { ...h.member.activity!, untilDay: h.start + h.row.posting.days };
    h.member.locationId = course.location.id;
    h.member.activity = { ...h.member.activity!, airCourseLocationId: course.location.id,
        airDutyReceiptId: course.fact.id };
    expect(aRetainedMemberActuallyServed(h.world, h.member, h.row)).toBe(false);
    if (stopped) stopAnAirCourse(h.world, course.location,
        (h.start + Number(course.fact.data.arrivalDay)) / 2, 'An actual interrupted course.');
    h.world.currentDay = h.start + h.row.posting.days;
    settleWorldAirTravellers(h.world, h.world.currentDay);
    const actual = h.world.npcs.find(person => person.id === h.member.id)!;
    expect(aRetainedMemberActuallyServed(h.world, actual, h.row)).toBe(!stopped);
    expect(actual.locationId === to.id).toBe(!stopped);
    expect(aRetainedMemberActuallyReturned(h.world, actual, h.row)).toBe(false);
});

it('keeps the authored five days at a post in addition to both real walking legs', () => {
    const h = arranged();
    const from = makeLocation({ id: 'service-origin', name: 'Departure ground', kind: 'settlement' });
    const to = makeLocation({ id: 'service-post', name: 'Posting ground', kind: 'settlement' });
    from.links.push({ toLocationId: to.id, travelDays: 2, kind: 'road', requiresKeyId: null, open: true, note: '' });
    to.links.push({ toLocationId: from.id, travelDays: 3, kind: 'road', requiresKeyId: null, open: true, note: '' });
    h.world.locations.push(from, to);
    h.member.locationId = to.id;
    const posting = aPostingThatCanReachItsGround({ ...h.posting, locationId: to.id }, h.world.locations, from.id, to.id);
    h.row.posting = posting; h.row.locationId = to.id;
    h.member.activity = { ...h.member.activity!, fromLocationId: from.id,
        returnTo: from.id, untilDay: h.start + posting.days };
    expect(posting.days).toBe(2 + h.posting.reason.days + 3);
    const site = siteIntervalOnAnNpcPosting(h.world.locations, h.member)!;
    expect(site.untilDay - site.fromDay).toBe(h.posting.reason.days);
    move(h, 2);
    expect(aRetainedMemberActuallyServed(h.world, h.world.npcs.find(person => person.id === h.member.id)!, h.row)).toBe(false);
    move(h, posting.days - 2);
    expect(h.world.pendingSendings).toHaveLength(0);
    expect(reports(h).some(fact => fact.data.retainedSendingUnfinished === true)).toBe(false);
});
it('refuses native settlement of a shortened legacy term that never served its five site days', () => {
    const h = arranged();
    const from = makeLocation({ id: 'short-service-origin', name: 'Departure ground', kind: 'settlement' });
    const to = makeLocation({ id: 'short-service-post', name: 'Posting ground', kind: 'settlement' });
    from.links.push({ toLocationId: to.id, travelDays: 2, kind: 'road', requiresKeyId: null, open: true, note: '' });
    to.links.push({ toLocationId: from.id, travelDays: 3, kind: 'road', requiresKeyId: null, open: true, note: '' });
    h.world.locations.push(from, to); h.member.locationId = to.id;
    h.row.locationId = to.id;
    h.member.activity = { ...h.member.activity!, fromLocationId: from.id, returnTo: from.id };
    move(h, h.posting.days);
    expect(reports(h).some(fact => fact.data.retainedSendingUnfinished === true)).toBe(true);
    expect(h.world.npcs.find(person => person.id === h.member.id)!.status).toBe('alive');
});

function anActualAirSending() {
    const h = arranged();
    const from = makeLocation({ id: 'paid-sending-origin', name: 'Departure ground', kind: 'settlement',
        data: { metricXLi: 0, metricYLi: 0, metricExtentLi: 0 } });
    const to = makeLocation({ id: 'paid-sending-post', name: 'Posting ground', kind: 'settlement',
        data: { metricXLi: 8, metricYLi: 0, metricExtentLi: 0 } });
    h.world.locations.push(from, to); h.house.seatLocationId = from.id;
    h.member = setRealm(setLocation(h.member, from.id, h.start), 29, h.start);
    h.world.npcs = [h.member]; h.row.party[0]!.ordinal = h.member.cultivation.realmOrdinal; h.row.locationId = to.id;
    const craft = transferPossession(aVehicleOf({ id: 'actual-retained-duty-hull',
        conveyanceId: 'conv-spirit-boat', ownerId: h.house.id, ownerName: h.house.name, at: from.id }),
        { onDay: h.start, toHolderId: h.member.id, toHolderName: h.member.name,
            how: 'lent', source: 'Component fixture actual house loan', note: 'Actual tracked custody.' });
    h.world.objects.push(craft);
    const legs = quoteHouseAirDuty(h.world, h.house, [h.member], h.member, craft, to.id, h.start);
    if (!legs) throw Error('Actual selected hull cannot quote these native endpoints');
    h.row.posting = aPostingForItsActualLegs({ ...h.posting, locationId: to.id,
        conveyanceId: 'conv-spirit-boat' }, legs.quote.daysOneWay, legs.back.daysOneWay);
    const doing = { ...h.member.activity!, fromLocationId: from.id, returnTo: from.id,
        conveyanceId: 'conv-spirit-boat', untilDay: h.start + h.row.posting.days };
    h.house.resources.spirit_stones -= legs.quote.stonesBurned + legs.back.stonesBurned;
    const accepted = admitPaidHouseAirDuty(h.world, h.house, [h.member], h.member, craft,
        to.id, h.start, new Map([[h.member.id, doing]]));
    if (!accepted) throw Error('Actual funded held hull cannot admit the arranged selected duty');
    return { ...h, from, to, craft, legs, accepted };
}
it('serves five actual site days and returns on its bound native paid hull without a second debit', () => {
    const h = anActualAirSending();
    const paidPurse = h.house.resources.spirit_stones;
    const startFacts = h.world.history.facts.filter(fact => fact.data.airFuelPaidFor === h.accepted.fact.id);
    expect(startFacts).toHaveLength(1);
    expect(startFacts[0]!.day).toBe(h.start);
    advanceWorldForPlay(h.world, { days: h.legs.quote.daysOneWay, preciseDays: true,
        pressure: { intensity: 0, peopleWalkOutOnTheirOwnAccount: false } });
    expect(h.world.npcs.find(person => person.id === h.member.id)!.locationId).toBe(h.to.id);
    expect(h.world.pendingSendings).toHaveLength(1);
    expect(reports(h).filter(fact => fact.data.retainedSendingUnfinished === true)).toHaveLength(0);
    advanceWorldForPlay(h.world, { days: h.row.posting.reason.days, preciseDays: true,
        pressure: { intensity: 0, peopleWalkOutOnTheirOwnAccount: false } });
    const returns = h.world.history.facts.filter(fact => fact.data.houseDutyReturnOf === h.accepted.fact.id);
    expect(returns).toHaveLength(1);
    const expectedServiceEnd = Number(h.accepted.fact.data.arrivalDay) + h.row.posting.reason.days;
    expect(journeyTimeHasReached(Number(returns[0]!.data.departureDay), expectedServiceEnd)).toBe(true);
    expect(journeyTimeHasReached(expectedServiceEnd, Number(returns[0]!.data.departureDay))).toBe(true);
    const afterService = h.world.npcs.find(person => person.id === h.member.id)!;
    expect(afterService.locationId).not.toBe(h.from.id);
    expect(aRetainedMemberActuallyReturned(h.world, afterService, h.row)).toBe(false);
    advanceWorldForPlay(h.world, { days: h.legs.back.daysOneWay, preciseDays: true,
        pressure: { intensity: 0, peopleWalkOutOnTheirOwnAccount: false } });
    const actual = h.world.npcs.find(person => person.id === h.member.id)!;
    expect(actual.locationId).toBe(h.from.id);
    expect(h.world.pendingSendings).toHaveLength(0);
    expect(h.house.resources.spirit_stones).toBe(paidPurse);
    expect(reports(h).some(fact => fact.data.retainedSendingUnfinished === true)).toBe(false);
    const actualHull = h.world.objects.find(row => row.id === h.craft.id)!;
    expect(actualHull.ownerId).toBe(h.house.id); expect(actualHull.locationId).toBe(h.from.id);
});
it('does not turn an early physical departure into completed service or a fictitious return', () => {
    const h = anActualAirSending();
    advanceWorldForPlay(h.world, { days: h.legs.quote.daysOneWay, preciseDays: true,
        pressure: { intensity: 0, peopleWalkOutOnTheirOwnAccount: false } });
    const at = h.world.npcs.findIndex(person => person.id === h.member.id);
    h.world.npcs[at] = { ...setLocation(h.world.npcs[at]!, h.other.id, h.world.currentDay),
        activity: { kind: 'their_practice', note: 'Actual superseding work elsewhere.', withIds: [],
            sinceDay: h.world.currentDay, untilDay: null } };
    const paidPurse = h.house.resources.spirit_stones;
    advanceWorldForPlay(h.world, { days: h.row.posting.days - h.legs.quote.daysOneWay, preciseDays: true,
        pressure: { intensity: 0, peopleWalkOutOnTheirOwnAccount: false } });
    const actual = h.world.npcs.find(person => person.id === h.member.id)!;
    expect(actual.locationId).toBe(h.other.id); expect(actual.status).toBe('alive');
    expect(h.world.history.facts.some(fact => fact.data.houseDutyReturnOf === h.accepted.fact.id)).toBe(false);
    expect(reports(h).some(fact => fact.data.retainedSendingUnfinished === true)).toBe(true);
    expect(h.house.resources.spirit_stones).toBe(paidPurse);
});
it('keeps a real dead operator from completing a post or admitting a replacement return', () => {
    const h = anActualAirSending();
    const at = h.world.npcs.findIndex(person => person.id === h.member.id);
    h.world.npcs[at] = markDead(h.world.npcs[at]!, h.start, 'Actual component operator death.');
    advanceWorldForPlay(h.world, { days: h.row.posting.days, preciseDays: true,
        pressure: { intensity: 0, peopleWalkOutOnTheirOwnAccount: false } });
    expect(h.world.history.facts.some(fact => fact.data.houseDutyReturnOf === h.accepted.fact.id)).toBe(false);
    expect(h.world.npcs.find(person => person.id === h.member.id)!.status).toBe('physically_dead');
    expect(h.world.npcs.find(person => person.id === h.member.id)!.locationId).not.toBe(h.from.id);
});
