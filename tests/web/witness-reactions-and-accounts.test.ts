/**
 * Owner ruling 2026-10-01: a witness reacts to an event, and an account is
 * weighed against what that witness could see. A scripted model initially
 * returned a valid deed claim that validatePlan discarded, leaving a pending
 * witness and a refused tell. Another played run treated a body elsewhere in
 * the settlement as beside the player. These scenes keep the body and witness
 * in one area, distinguish seeing a blow from finding its aftermath, and pin
 * reports to a post the witness actually knows. Belief changes no death or
 * object provenance.
 *
 * The trust ruling of 2026-10-01 also makes service and accusation one witness
 * reading. A righteous witness credits a killing of a war enemy; a bystander
 * house whose member dies in that war still demands an ordinary answer. The
 * same paper can mean standing, warning, danger or a purse depending on who
 * reads it. The cases below pin those consequences to witnessed or circulated
 * facts rather than a global war flag.
 */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { activeWorld } from '../../src/server/state/cultivation-world.js';
import { markDead, upsertRelationship } from '../../src/engine/world/npc-state.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { witnessReactions, reactToWitnessedFact, reportFromObservation, houseHearsWitnessReport,
    whatAPriceMeansTo, peopleReadPricesTheyHaveHeardOf,
    observationOf, witnessReactionsThisYear } from '../../src/engine/world/witness-reactions.js';
import { makeFact } from '../../src/engine/world/history.js';
import { makeScheduledEffect } from '../../src/engine/world/world-state.js';
import type { WorldState } from '../../src/engine/world/world-state.js';
import { makeObject } from '../../src/engine/world/possessions.js';
import { meritWith } from '../../src/engine/world/what-a-house-counts-in-somebodys-favour.js';
import { openHandednessOf } from '../../src/engine/social-leverage/how-freely-somebody-parts-with-what-they-have.js';
import { appendWorldFact } from '../../src/engine/world/who-was-there-when-it-happened.js';
import { aPricedDeed } from '../../src/engine/world/a-deed-enters-the-world-as-a-fact.js';
import { ledgerAbout } from '../../src/storage/repos/obligation.repo.js';
import { parseIntent } from '../../src/web/actions.js';
import { whatEachHouseWarnsOf } from '../../src/web/what-is-posted-on-the-wall-here.js';
import { accountsHousesHoldFromWitnessReports, accountsHousesHoldForTheirDead,
    housesPutUpTheirPaper, housesAnswerKnownDeeds } from '../../src/engine/world/a-house-puts-a-price-on-somebody.js';

function putTwoHousesAtWar(world: WorldState, aId: string, bId: string) {
    for (const id of [aId, bId]) world.factions.find(h => h.id === id)!.tags.push('at_war');
    world.schedule.push(makeScheduledEffect({ id: `witness-war-${aId}-${bId}`, kind: 'war_resolves',
        dueOnDay: world.currentDay + 1000, summary: 'The war is due to end.',
        data: { kind: 'war_resolution', sideA: aId, sideB: bId } }));
}

async function scene(options: { alignment?: 'righteous' | 'demonic'; old?: boolean; trust?: number; model?: boolean } = {}) {
    const harness = await makeGameInWorld({ seed: 'witness-play', worldSeed: 'witness-world',
        ...(options.model ? { provider: new ScriptedProvider({ plans: [JSON.stringify({ action: 'look' }),
            JSON.stringify({ action: 'tell', deedAccount: 'found', topic: 'I only just came upon him.' })] }) } : {}) });
    const { game } = harness;
    const { cultivator } = await game.newRun('Bai Suyin');
    const world = (await activeWorld()).state;
    game.atHand = world;
    const here = game.worldPlaceOf(cultivator)!;
    const elsewhere = world.locations.find(l => l.id !== here)!.id;
    const day = Math.floor(world.currentDay);
    const alignment = options.alignment ?? 'righteous';
    const witnessAt = world.npcs.findIndex(n => n.status === 'alive' && !n.tags.includes('the-player')
        && world.factions.some(f => f.id === n.factionId && f.alignment === alignment && f.dissolvedOnDay === null));
    const witness = world.npcs[witnessAt]!;
    for (let i = 0; i < world.npcs.length; i++) {
        const n = world.npcs[i]!;
        if (n.locationId === here && !n.tags.includes('the-player')) world.npcs[i] = { ...n, locationId: elsewhere };
    }
    world.npcs[witnessAt] = upsertRelationship({ ...witness, locationId: here,
        cultivation: { ...witness.cultivation, realmOrdinal: cultivator.realmOrdinal },
        activity: { kind: 'out_with_a_party', note: 'Here.', withIds: [], sinceDay: day, untilDay: day + 100, returnTo: elsewhere } },
        { targetId: cultivator.id, targetName: cultivator.name, kind: 'acquaintance', standing: options.trust ?? 0.8 }, day);
    if (alignment === 'demonic') game.repos.sects.addMember(witness.factionId!, cultivator.id, 0);
    const place = world.locations.find(l => l.id === here)!;
    let victim = world.npcs.find(n => n.status === 'alive' && n.id !== witness.id
        && !n.tags.includes('the-player'))!;
    let area = '';
    for (let i = 0; i < world.npcs.length; i++) {
        const candidate = world.npcs[i]!;
        if (candidate.status !== 'alive' || candidate.id === witness.id
            || candidate.tags.includes('the-player')) continue;
        world.npcs[i] = markDead({ ...candidate, factionId: null, locationId: here },
            options.old === false ? day : day - 10, 'Killed on the road.');
        const where = theAreasOf(world, place);
        if (where.whereBodiesAre.get(candidate.id) === where.whereIs.get(witness.id)) {
            victim = candidate;
            area = where.whereIs.get(witness.id)!;
            break;
        }
        world.npcs[i] = candidate;
    }
    expect(area, 'the body and witness share an area').not.toBe('');
    game.repos.cultivators.standIn(cultivator.id, area);
    game.knowledge.learn({ holderId: cultivator.id, kind: 'cultivator', id: witness.id, name: witness.name,
        onDay: 0, sourceKind: 'witnessed', sourceNote: 'Met here.', stage: 'encountered' });
    game.theWorldMoved();
    expect(game.present(game.currentRun().cultivator).map(n => n.id)).toContain(witness.id);
    return { ...harness, world, witness, victim, me: cultivator };
}

describe('what a witness saw and heard, in play', () => {
    it('a demonic senior needs no account from a demonic junior over an unrelated body', async () => {
        const s = await scene({ alignment: 'demonic' });
        const turn = await s.game.act('look');
        expect(turn.narration).not.toMatch(/asks you to explain/);
        expect(witnessReactions(s.world, s.me.id).some(row => row.observation.state === 'ignored')).toBe(true);
        expect(ledgerAbout(s.db, s.me.id).filter(row => row.tags.includes('witnessed_deed'))).toHaveLength(0);
        s.db.close();
    });

    it('believes finding an older body, with trust and no witnessed blow', async () => {
        const s = await scene();
        expect((await s.game.act('look')).narration).toMatch(/asks you to explain/);
        const turn = await s.game.act('I found him like this');
        expect(turn.narration).toMatch(/believes your account/);
        expect(s.world.npcs.find(n => n.id === s.victim.id)?.status).toBe('physically_dead');
        expect(ledgerAbout(s.db, s.me.id).filter(row => row.tags.includes('witnessed_deed'))).toHaveLength(0);
        s.db.close();
    });

    it('disbelieves the same denial when the witness saw the blow', async () => {
        const s = await scene();
        const fact = appendWorldFact(s.world, makeFact({ day: s.world.currentDay, kind: 'death',
            locationId: s.game.worldPlaceOf(s.me), witnessIds: [s.witness.id],
            actors: [{ id: s.me.id, name: s.me.name, role: 'killer' }, { id: s.victim.id, name: s.victim.name, role: 'victim' }],
            summary: `${s.me.name} killed ${s.victim.name}.`, data: aPricedDeed('grave') }));
        reactToWitnessedFact(s.world, fact, { actorId: s.me.id, victimId: s.victim.id,
            witnesses: [{ id: s.witness.id, seen: { wrong: 'killed', sawAct: true, sawFirstAttack: false,
                foundBeforeActor: false, sawPermission: false, recognisedProperty: false, bonesTaken: false, competingAccount: false } }] });
        const turn = await s.game.act('I found him like this');
        expect(turn.narration).toMatch(/does not believe your account/);
        expect(ledgerAbout(s.db, s.me.id).some(row => row.tags.includes('witnessed_deed') && row.triggeringEventId === fact.id)).toBe(true);
        s.db.close();
    });

    it('half believes an account with no corroboration and retains suspicion', async () => {
        const s = await scene({ old: false, trust: 0.4 });
        await s.game.act('look');
        const turn = await s.game.act('I found him like this');
        expect(turn.narration).toMatch(/remains suspicious/);
        expect(witnessReactions(s.world, s.me.id).some(row => row.observation.state === 'half-belief')).toBe(true);
        const tie = s.world.npcs.find(n => n.id === s.witness.id)!.relationships.find(r => r.targetId === s.me.id)!;
        expect(tie.standing).toBeLessThan(0.4);
        s.db.close();
    });

    it('accepts a model reading of the account without reading outcomes from the model', async () => {
        const s = await scene({ model: true });
        await s.game.act('look');
        expect(s.game.present(s.game.currentRun().cultivator).map(n => n.id)).toContain(s.witness.id);
        const turn = await s.game.act('I only just came upon him.');
        expect(turn.toolCalls.some(call => call.name === 'world.accountForWitnessedDeed'),
            JSON.stringify({ calls: turn.toolCalls, narration: turn.narration,
                observations: witnessReactions(s.world, s.me.id).map(row => row.observation.state) })).toBe(true);
        expect(witnessReactions(s.world, s.me.id).some(row => row.observation.state === 'belief')).toBe(true);
        s.db.close();
    });

    it('a witnessed theft can be accounted for without undoing the taking', async () => {
        const s = await scene({ trust: 0.4 });
        const fact = appendWorldFact(s.world, makeFact({ day: s.world.currentDay, kind: 'grudge_opened',
            locationId: s.game.worldPlaceOf(s.me), witnessIds: [s.witness.id],
            actors: [{ id: s.me.id, name: s.me.name, role: 'actor' },
                { id: s.victim.id, name: s.victim.name, role: 'subject' }],
            summary: `${s.me.name} took an object held by ${s.victim.name}.`,
            data: { deedWrong: 'robbed', objectId: 'the-object' } }));
        reactToWitnessedFact(s.world, fact, { actorId: s.me.id, victimId: s.victim.id,
            witnesses: [{ id: s.witness.id, seen: observationOf(fact) }] });
        const turn = await s.game.act('I had permission');
        expect(turn.toolCalls.some(call => call.name === 'world.accountForWitnessedDeed')).toBe(true);
        expect(witnessReactions(s.world, s.me.id).find(row => row.fact.id === fact.id)?.observation.state).not.toBe('pending');
        expect(fact.data.objectId).toBe('the-object');
        s.db.close();
    });

    it('a blame account records the named person as a telling', async () => {
        const s = await scene();
        await s.game.act('look');
        const blamed = s.world.npcs.find(n => n.status === 'alive' && n.id !== s.witness.id
            && !n.tags.includes('the-player'))!;
        s.game.knowledge.learn({ holderId: s.me.id, kind: 'cultivator', id: blamed.id, name: blamed.name,
            onDay: 0, sourceKind: 'told', stage: 'placed' });
        const turn = await s.game.act(`It wasn't me, it was ${blamed.name}`);
        expect(turn.toolCalls.some(call => call.name === 'world.accountForWitnessedDeed')).toBe(true);
        expect(witnessReactions(s.world, s.me.id).find(row => row.observation.blamedId === blamed.id)).toBeTruthy();
        s.db.close();
    });
});

describe('a report reaches only a known post', () => {
    it('a massacre reaches the house on its ground and puts a warning on its wall', async () => {
        const s = await scene();
        const here = s.game.worldPlaceOf(s.me)!;
        const place = s.world.locations.find(l => l.id === here)!;
        place.controllingFactionId = s.witness.factionId;
        const postAt = s.world.npcs.findIndex(n => n.status === 'alive' && n.id !== s.witness.id
            && !n.tags.includes('the-player'));
        const post = s.world.npcs[postAt]!;
        s.world.npcs[postAt] = { ...post, factionId: s.witness.factionId, locationId: here,
            activity: { kind: 'stationed', note: 'Holds the post.', withIds: [], sinceDay: s.world.currentDay,
                untilDay: s.world.currentDay + 100, returnTo: here } };
        const fact = appendWorldFact(s.world, makeFact({ day: s.world.currentDay, kind: 'war',
            locationId: here, witnessIds: [s.witness.id], magnitude: 0.8,
            actors: [{ id: s.me.id, name: s.me.name, role: 'killer' },
                { id: s.victim.id, name: s.victim.name, role: 'victim' }],
            summary: `${s.me.name} killed several people here.`, data: { harmedCount: 5 } }));
        const seen = observationOf(fact);
        const unknown = reactToWitnessedFact(s.world, fact, { actorId: s.me.id, victimId: s.victim.id,
            knows: () => false, witnesses: [{ id: s.witness.id, seen }] });
        expect(unknown[0]?.state).toBe('pending');
        const knownFact = appendWorldFact(s.world, makeFact({ day: s.world.currentDay, kind: 'war',
            locationId: here, witnessIds: [s.witness.id], magnitude: 0.8,
            actors: [{ id: s.me.id, name: s.me.name, role: 'killer' },
                { id: s.victim.id, name: s.victim.name, role: 'victim' }],
            summary: `${s.me.name} killed several people at the post.`, data: { harmedCount: 5 } }),
        { recur: false });
        const known = reactToWitnessedFact(s.world, knownFact, { actorId: s.me.id, victimId: s.victim.id,
            knows: (_, kind, id) => kind === 'cultivator' && id === post.id,
            witnesses: [{ id: s.witness.id, seen: observationOf(knownFact) }] });
        expect(known[0]?.state).toBe('reported');
        const account = reportFromObservation(knownFact, known[0]!, null, s.world.currentDay);
        expect(account?.holderId).toBe(s.witness.factionId);
        houseHearsWitnessReport(s.world, knownFact, known[0]!, null);
        expect(whatEachHouseWarnsOf(s.world).get(s.witness.factionId!)?.some(row => row.kind === 'warning')).toBe(true);
        s.db.close();
    });

    it('a war loss with no named killer is reported as a loss, not pinned on a combatant', async () => {
        const s = await scene();
        const here = s.game.worldPlaceOf(s.me)!;
        s.world.locations.find(l => l.id === here)!.controllingFactionId = s.witness.factionId;
        const postAt = s.world.npcs.findIndex(n => n.status === 'alive' && n.id !== s.witness.id
            && !n.tags.includes('the-player'));
        const post = s.world.npcs[postAt]!;
        s.world.npcs[postAt] = { ...post, factionId: s.witness.factionId, locationId: here,
            activity: { kind: 'stationed', note: 'Holds the post.', withIds: [], sinceDay: s.world.currentDay,
                untilDay: s.world.currentDay + 100, returnTo: here } };
        const witnessAt = s.world.npcs.findIndex(n => n.id === s.witness.id);
        s.world.npcs[witnessAt] = upsertRelationship(s.world.npcs[witnessAt], {
            targetId: post.id, targetName: post.name, kind: 'acquaintance', standing: 0.3 }, s.world.currentDay);
        const fact = appendWorldFact(s.world, makeFact({ day: s.world.currentDay,
            kind: 'war', locationId: here, witnessIds: [s.witness.id],
            actors: [{ id: post.id, name: post.name, role: 'finished' },
                { id: s.victim.id, name: s.victim.name, role: 'body_destroyed' }],
            summary: 'Four combatants fell in the fighting here.', data: { fell: 4 } }), { recur: false });
        witnessReactionsThisYear(s.world, s.world.currentDay,
            { id: s.me.id, placeId: here });
        expect(s.world.history.facts.some(row => row.data.witnessReport === fact.id
            && row.data.houseWarning === true)).toBe(true);
        expect(s.world.obligations.some(row => row.triggeringEventId === fact.id
            && row.subjectId === post.id)).toBe(false);
        s.db.close();
    });

    it('the player can report a killing they witnessed to the posted person', async () => {
        const s = await scene();
        const here = s.game.worldPlaceOf(s.me)!;
        s.world.locations.find(l => l.id === here)!.controllingFactionId = s.witness.factionId;
        const index = s.world.npcs.findIndex(n => n.id === s.witness.id);
        s.world.npcs[index] = { ...s.world.npcs[index], activity: {
            kind: 'stationed', note: 'Holds this post.', withIds: [], sinceDay: s.world.currentDay,
            untilDay: s.world.currentDay + 100, returnTo: here } };
        s.game.knowledge.learn({ holderId: s.me.id, kind: 'cultivator', id: s.witness.id,
            name: s.witness.name, onDay: 0, sourceKind: 'witnessed', stage: 'known',
            statement: `${s.witness.name} holds this post.` });
        const actor = s.world.npcs.find(n => n.status === 'alive' && n.id !== s.witness.id
            && !n.tags.includes('the-player'))!;
        s.game.knowledge.learn({ holderId: s.me.id, kind: 'cultivator', id: actor.id,
            name: actor.name, onDay: 0, sourceKind: 'told', stage: 'placed' });
        const fact = appendWorldFact(s.world, makeFact({ day: s.world.currentDay, kind: 'death',
            locationId: here, witnessIds: [s.me.id],
            actors: [{ id: actor.id, name: actor.name, role: 'killer' },
                { id: s.victim.id, name: s.victim.name, role: 'victim' }],
            summary: `${actor.name} killed ${s.victim.name}.` }), { recur: false });
        s.game.theWorldMoved();
        const turn = await s.game.act(`I tell ${s.witness.name} that ${actor.name} killed ${s.victim.name}`);
        expect(turn.toolCalls.some(call => call.name === 'world.witnessReportsWhatTheySaw')).toBe(true);
        expect(s.world.obligations.some(row => row.triggeringEventId === fact.id
            && row.holderId === s.witness.factionId && row.subjectId === actor.id)).toBe(true);
        expect(accountsHousesHoldFromWitnessReports(s.world, s.world.currentDay)
            .some(row => row.subjectId === actor.id && row.houseId === s.witness.factionId)).toBe(true);
        s.db.close();
    });
});

describe('world people see the same facts', () => {
    it('records an ordinary kindness and a wrong from the witness IDs', async () => {
        const s = await scene();
        const helper = s.world.npcs.find(n => n.status === 'alive' && n.id !== s.witness.id
            && !n.tags.includes('the-player'))!;
        const kindness = appendWorldFact(s.world, makeFact({ day: s.world.currentDay,
            kind: 'opportunity', locationId: s.game.worldPlaceOf(s.me),
            witnessIds: [s.witness.id], actors: [{ id: helper.id, name: helper.name, role: 'helper' }],
            summary: `${helper.name} carried provisions to somebody here.` }), { recur: false });
        const wrong = appendWorldFact(s.world, makeFact({ day: s.world.currentDay,
            kind: 'injury', locationId: s.game.worldPlaceOf(s.me), witnessIds: [s.witness.id],
            actors: [{ id: helper.id, name: helper.name, role: 'attacker' },
                { id: s.victim.id, name: s.victim.name, role: 'victim' }],
            summary: `${helper.name} wounded ${s.victim.name}.` }), { recur: false });
        witnessReactionsThisYear(s.world, s.world.currentDay,
            { id: s.me.id, placeId: s.game.worldPlaceOf(s.me)! });
        expect(witnessReactions(s.world, helper.id).find(row => row.fact.id === kindness.id)?.observation.state).toBe('remembered');
        expect(witnessReactions(s.world, helper.id).find(row => row.fact.id === kindness.id)?.observation.regard).toBe('credit');
        expect(witnessReactions(s.world, helper.id).some(row => row.fact.id === wrong.id)).toBe(true);
        s.db.close();
    });

    it('records a player seeing a world person beside a body without saying they made it', async () => {
        const s = await scene();
        await s.game.act('look');
        const found = witnessReactions(s.world, s.witness.id).find(row =>
            row.fact.data.seenWithBody === true && row.observation.witnessId === s.me.id
            && row.observation.victimId === s.victim.id);
        expect(found?.observation.sawAct).toBe(false);
        s.db.close();
    });

    it('records a player seeing a world person with goods whose owner they know', async () => {
        const s = await scene();
        s.world.npcs[s.world.npcs.findIndex(n => n.id === s.victim.id)] = {
            ...s.world.npcs.find(n => n.id === s.victim.id)!,
            locationId: s.world.locations.find(l => l.id !== s.game.worldPlaceOf(s.me))!.id };
        s.world.objects.push(makeObject({ id: 'world-person-goods', name: 'a marked parcel', kind: 'other',
            possessorId: s.witness.id, ownerId: s.victim.id, ownerName: s.victim.name,
            knownOwnershipBy: [s.me.id] }));
        await s.game.act('look');
        const found = witnessReactions(s.world, s.witness.id).find(row =>
            row.fact.data.seenWithEvidence === 'world-person-goods' && row.observation.witnessId === s.me.id);
        expect(found?.observation.sawAct).toBe(false);
        expect(found?.fact.data.deedWrong).toBeUndefined();
        s.db.close();
    });
});

describe('fallback deed claims', () => {
    it('routes explicit accounts into the same tell verb', () => {
        for (const [words, account] of [ ['I found him like this', 'found'], ['he attacked first', 'defence'],
            ['it was already broken', 'already_damaged'], ["it wasn't me, it was X", 'blame'] ]) {
            expect(parseIntent(words)).toMatchObject({ action: 'tell', deedAccount: account });
        }
        expect(parseIntent('I report to Wei Min that Cao Feng killed Liu Xin'))
            .toMatchObject({ action: 'tell', target: 'Wei Min' });
    });
});

describe('the two sides read the same witnessed war deed', () => {
    it('a righteous witness carries an enemy killing for their disciple, while the enemy prices them', async () => {
        const s = await scene();
        const ownId = s.witness.factionId!;
        const enemy = s.world.factions.find(h => h.id !== ownId && h.dissolvedOnDay === null
            && h.layer === s.world.factions.find(f => f.id === ownId)!.layer)!;
        putTwoHousesAtWar(s.world, ownId, enemy.id);
        enemy.resources.spirit_stones = 100_000;
        const here = s.game.worldPlaceOf(s.me)!;
        const actorAt = s.world.npcs.findIndex(n => n.status === 'alive' && n.id !== s.witness.id
            && !n.tags.includes('the-player'));
        const actor = s.world.npcs[actorAt]!;
        s.world.npcs[actorAt] = { ...actor, factionId: ownId, locationId: here };
        const victimAt = s.world.npcs.findIndex(n => n.id === s.victim.id);
        s.world.npcs[victimAt] = { ...s.world.npcs[victimAt], factionId: enemy.id };
        const postAt = s.world.npcs.findIndex(n => n.status === 'alive' && n.id !== actor.id
            && n.id !== s.witness.id && !n.tags.includes('the-player'));
        const post = s.world.npcs[postAt]!;
        s.world.npcs[postAt] = { ...post, factionId: ownId, locationId: here,
            activity: { kind: 'stationed', note: 'At the post.', withIds: [],
                sinceDay: s.world.currentDay, untilDay: s.world.currentDay + 100, returnTo: here } };
        const enemyWitness = s.world.npcs.find(n => n.status === 'alive' && n.factionId === enemy.id)!;
        const fact = appendWorldFact(s.world, makeFact({ day: s.world.currentDay, kind: 'death',
            locationId: here, witnessIds: [s.witness.id, enemyWitness.id], visibility: 'regional',
            actors: [{ id: actor.id, name: actor.name, role: 'killer' },
                { id: s.victim.id, name: s.victim.name, role: 'victim' }],
            summary: `${actor.name} killed ${s.victim.name}.`, data: aPricedDeed('grave') }), { recur: false });
        const [read] = reactToWitnessedFact(s.world, fact, { actorId: actor.id, victimId: s.victim.id,
            knows: (_, kind, id) => kind === 'cultivator' && id === post.id,
            witnesses: [{ id: s.witness.id, seen: observationOf(fact) }] });
        expect(read?.state).toBe('reported_for');
        expect(reportFromObservation(fact, read!, ownId, s.world.currentDay)).toBeNull();
        houseHearsWitnessReport(s.world, fact, read!, ownId);
        expect(meritWith(s.world.npcs.find(n => n.id === actor.id)!, ownId)).toBeGreaterThan(0);
        expect(s.world.npcs.find(n => n.id === actor.id)!.face).toBeGreaterThan(0);
        const accounts = accountsHousesHoldForTheirDead(s.world, s.world.currentDay + 100);
        expect(accounts.find(row => row.houseId === enemy.id && row.subjectId === actor.id)?.war).toBe(true);
        const posted = housesPutUpTheirPaper(s.world, accounts, s.world.currentDay + 100);
        expect(posted.some(row => row.posterFactionId === enemy.id && row.targetId === actor.id)).toBe(true);
        s.db.close();
    });

    it('a price reads as warning, standing, payday or danger by ties, means and strength', async () => {
        const s = await scene();
        const found = s.world.npcs.find(n => n.status === 'alive' && n.id !== s.witness.id
            && !n.tags.includes('the-player'))!;
        s.world.npcs[s.world.npcs.findIndex(n => n.id === found.id)] = { ...found,
            factionId: s.witness.factionId,
            cultivation: { ...found.cultivation, realmOrdinal: Math.max(2, found.cultivation.realmOrdinal) } };
        const target = s.world.npcs.find(n => n.id === found.id)!;
        const paper = { targetId: target.id, posterFactionId: 'enemy-house', purseStones: 5000 };
        const sameHouse = { ...s.witness, factionId: s.witness.factionId,
            relationships: s.witness.relationships.filter(r => r.targetId !== target.id) };
        expect(whatAPriceMeansTo(s.world, paper, sameHouse)).toBe('standing');
        const friend = upsertRelationship({ ...sameHouse, factionId: null }, {
            targetId: target.id, targetName: target.name, kind: 'ally', standing: 0.8 }, s.world.currentDay);
        expect(whatAPriceMeansTo(s.world, paper, friend)).toBe('warning');
        const cautious = { ...sameHouse, factionId: null,
            cultivation: { ...sameHouse.cultivation, realmOrdinal: Math.max(0, target.cultivation.realmOrdinal - 1) } };
        expect(whatAPriceMeansTo(s.world, paper, cautious)).toBe('danger');
        const greedy = s.world.npcs.find(n => n.id !== target.id && n.id !== s.witness.id
            && openHandednessOf(n.id) < 0)!;
        const rogue = { ...greedy, factionId: null, spiritStones: 0,
            cultivation: { ...greedy.cultivation, realmOrdinal: target.cultivation.realmOrdinal + 1 },
            relationships: [] };
        expect(whatAPriceMeansTo(s.world, paper, rogue)).toBe('payday');
        s.db.close();
    });

    it('the player can name a real price on their head to somebody here', async () => {
        const s = await scene();
        const house = s.world.factions.find(h => h.id !== s.witness.factionId && h.dissolvedOnDay === null)!;
        house.resources.spirit_stones = 100_000;
        const [paper] = housesPutUpTheirPaper(s.world, [{ key: 'boast-paper', houseId: house.id,
            subjectId: s.me.id, subjectName: s.me.name, severity: 'grave', war: true,
            onDay: s.world.currentDay - 100, forWhat: 'for a killing' }], s.world.currentDay);
        expect(paper).toBeDefined();
        s.game.theWorldMoved();
        const turn = await s.game.act(`I boast to ${s.witness.name} about the bounty on my head`);
        expect(turn.toolCalls.some(call => call.name === 'world.boastingOfThePrice'),
            JSON.stringify({ plan: parseIntent(`I boast to ${s.witness.name} about the bounty on my head`),
                calls: turn.toolCalls, narration: turn.narration })).toBe(true);
        expect(s.world.history.facts.some(f => f.data.priceBoasted === paper.id)).toBe(true);
        s.db.close();
    });
});

describe('evidence and houses outside a war', () => {
    it('being seen with another person’s known goods opens its own witnessed event and account', async () => {
        const s = await scene();
        const at = s.world.npcs.findIndex(n => n.id === s.victim.id);
        s.world.npcs[at] = { ...s.world.npcs[at], locationId: s.world.locations.find(l => l.id !== s.game.worldPlaceOf(s.me))!.id };
        s.world.objects.push(makeObject({ id: 'known-provenance-goods', name: 'marked goods', kind: 'other',
            possessorId: s.me.id, ownerId: s.victim.id, ownerName: s.victim.name,
            knownOwnershipBy: [s.witness.id], provenance: [{ onDay: s.world.currentDay - 1,
                holderId: s.victim.id, holderName: s.victim.name, how: 'found', source: 'Their workshop.',
                previousHolderId: null, previousHolderName: null, factId: null, note: '' }] }));
        s.game.theWorldMoved();
        await s.game.act('look');
        const evidence = witnessReactions(s.world, s.me.id).find(row =>
            row.fact.data.seenWithEvidence === 'known-provenance-goods');
        expect(evidence?.observation.sawAct).toBe(false);
        expect(evidence?.observation.witnessId).toBe(s.witness.id);
        expect(evidence?.fact.data.deedWrong).toBeUndefined();
        const answered = await s.game.act('I had permission');
        expect(answered.toolCalls.some(call => call.name === 'world.accountForWitnessedDeed')).toBe(true);
        s.db.close();
    });

    it('a hidden death does not reach the victim house until the news reaches its people', async () => {
        const s = await scene();
        const houseId = s.witness.factionId!;
        const actor = s.world.npcs.find(n => n.status === 'alive' && n.factionId !== houseId
            && n.id !== s.witness.id
            && !n.tags.includes('the-player'))!;
        const victimAt = s.world.npcs.findIndex(n => n.id === s.victim.id);
        s.world.npcs[victimAt] = { ...s.world.npcs[victimAt], factionId: houseId };
        const fact = appendWorldFact(s.world, makeFact({ day: s.world.currentDay - 20,
            kind: 'death', locationId: s.world.factions.find(h => h.id === houseId)!.seatLocationId,
            witnessIds: [actor.id], visibility: 'secret',
            actors: [{ id: actor.id, name: actor.name, role: 'killer' },
                { id: s.victim.id, name: s.victim.name, role: 'victim' }],
            summary: `${actor.name} killed ${s.victim.name}.` }), { recur: false, bystanders: false });
        expect(accountsHousesHoldForTheirDead(s.world, s.world.currentDay)
            .some(row => row.key === fact.id)).toBe(false);
        appendWorldFact(s.world, makeFact({ day: s.world.currentDay, kind: 'said_in_public',
            locationId: s.game.worldPlaceOf(s.me), witnessIds: [actor.id, s.witness.id],
            visibility: 'regional',
            actors: [{ id: actor.id, name: actor.name, role: 'said it' }],
            summary: `${actor.name} told ${s.witness.name} what they saw.`,
            data: { toldOfWitnessedFact: fact.id } }), { recur: false, bystanders: false });
        expect(accountsHousesHoldForTheirDead(s.world, s.world.currentDay)
            .some(row => row.key === fact.id && row.houseId === houseId)).toBe(true);
        s.db.close();
    });

    it('a known death by a rogue leaves a notice when no house can be asked for them', async () => {
        const s = await scene();
        const houseId = s.witness.factionId!;
        s.world.factions.find(h => h.id === houseId)!.resources.spirit_stones = 0;
        const actorAt = s.world.npcs.findIndex(n => n.status === 'alive' && n.id !== s.witness.id
            && !n.tags.includes('the-player'));
        const actor = s.world.npcs[actorAt]!;
        s.world.npcs[actorAt] = { ...actor, factionId: null };
        const victimAt = s.world.npcs.findIndex(n => n.id === s.victim.id);
        s.world.npcs[victimAt] = { ...s.world.npcs[victimAt], factionId: houseId };
        appendWorldFact(s.world, makeFact({ day: s.world.currentDay, kind: 'death',
            locationId: s.game.worldPlaceOf(s.me), witnessIds: [s.witness.id], visibility: 'regional',
            actors: [{ id: actor.id, name: actor.name, role: 'killer' },
                { id: s.victim.id, name: s.victim.name, role: 'victim' }],
            summary: `${actor.name} killed ${s.victim.name}.` }), { recur: false });
        const accounts = accountsHousesHoldForTheirDead(s.world, s.world.currentDay);
        const response = housesAnswerKnownDeeds(s.world, accounts, s.world.currentDay);
        expect(response.some(f => f.data.houseWarning === true && f.factionIds.includes(houseId))).toBe(true);
        expect(whatEachHouseWarnsOf(s.world).get(houseId)?.some(row => row.kind === 'warning')).toBe(true);
        s.db.close();
    });

    it('a house delivers a junior but keeps a valuable senior when another house demands them', async () => {
        const s = await scene();
        const demanding = s.world.factions.find(h => h.id === s.witness.factionId)!;
        const answering = s.world.factions.find(h => h.id !== demanding.id && h.seatLocationId !== null)!;
        demanding.resources.spirit_stones = 1000;
        answering.resources.spirit_stones = 0;
        const people = s.world.npcs.filter(n => n.status === 'alive' && n.id !== s.witness.id
            && !n.tags.includes('the-player')).slice(0, 2);
        for (const [index, person] of people.entries()) {
            const at = s.world.npcs.findIndex(n => n.id === person.id);
            s.world.npcs[at] = { ...person, factionId: answering.id,
                factionRankIndex: index === 0 ? 0 : answering.ranks.length - 1,
                merit: index === 0 ? [] : [{ houseId: answering.id, points: 100_000 }] };
        }
        const accounts = people.map((person, index) => ({ key: `handover-${index}`,
            houseId: demanding.id, subjectId: person.id, subjectName: person.name,
            subjectHouseId: answering.id, severity: 'grave' as const,
            onDay: s.world.currentDay, forWhat: 'for a member’s death' }));
        const response = housesAnswerKnownDeeds(s.world, accounts, s.world.currentDay);
        expect(response.some(f => f.data.handoverAccount === accounts[0]!.key
            && f.data.handoverAnswer === 'delivered')).toBe(true);
        // Moving the junior must retain the demand's freshly written life fact.
        const delivered = s.world.npcs.find(n => n.id === people[0]!.id)!;
        for (const fact of response.filter(row => row.actors.some(actor => actor.id === delivered.id))) {
            expect(delivered.historyFactIds).toContain(fact.id);
        }
        expect(s.world.npcs.find(n => n.id === people[0]!.id)?.locationId).toBe(demanding.seatLocationId);
        expect(response.some(f => f.data.handoverAccount === accounts[1]!.key
            && f.data.handoverAnswer === 'refused')).toBe(true);
        expect(s.world.npcs.find(n => n.id === people[1]!.id)?.factionId).toBe(answering.id);
        s.db.close();
    });

    it('a larger enemy price gives more face once their own side reads each paper', async () => {
        const s = await scene();
        const ownId = s.witness.factionId!;
        const enemy = s.world.factions.find(h => h.id !== ownId && h.dissolvedOnDay === null)!;
        enemy.resources.spirit_stones = 100_000;
        const targets = s.world.npcs.filter(n => n.status === 'alive' && n.id !== s.witness.id
            && !n.tags.includes('the-player')).slice(0, 2);
        for (const target of targets) {
            const at = s.world.npcs.findIndex(n => n.id === target.id);
            s.world.npcs[at] = { ...target, factionId: ownId, face: 0 };
        }
        const accounts = targets.map((target, index) => ({ key: `price-face-${index}`,
            houseId: enemy.id, subjectId: target.id, subjectName: target.name,
            severity: index === 0 ? 'grave' as const : 'unforgivable' as const,
            war: true, onDay: s.world.currentDay - 100, forWhat: 'for losses in war' }));
        const papers = housesPutUpTheirPaper(s.world, accounts, s.world.currentDay);
        expect(papers).toHaveLength(2);
        for (const paper of papers) s.world.history.facts.find(f => f.id === paper.id)!.witnessIds.push(s.witness.id);
        peopleReadPricesTheyHaveHeardOf(s.world, s.world.currentDay);
        const faces = targets.map(target => s.world.npcs.find(n => n.id === target.id)!.face ?? 0);
        expect(faces[0]).toBeGreaterThan(0);
        expect(faces[1]).toBeGreaterThan(faces[0]);
        s.db.close();
    });

    it('a bystander house answers its member’s killing as ordinary, while two other houses are at war', async () => {
        const s = await scene();
        const bystanderId = s.witness.factionId!;
        s.world.factions.find(h => h.id === bystanderId)!.resources.spirit_stones = 0;
        const others = s.world.factions.filter(h => h.id !== bystanderId && h.dissolvedOnDay === null);
        const attackerHouse = others[0]!;
        const opponentHouse = others[1]!;
        putTwoHousesAtWar(s.world, attackerHouse.id, opponentHouse.id);
        const here = s.game.worldPlaceOf(s.me)!;
        const actorAt = s.world.npcs.findIndex(n => n.status === 'alive' && n.id !== s.witness.id
            && !n.tags.includes('the-player'));
        const actor = s.world.npcs[actorAt]!;
        s.world.npcs[actorAt] = { ...actor, factionId: attackerHouse.id, locationId: here };
        const victimAt = s.world.npcs.findIndex(n => n.id === s.victim.id);
        s.world.npcs[victimAt] = { ...s.world.npcs[victimAt], factionId: bystanderId };
        const fact = appendWorldFact(s.world, makeFact({ day: s.world.currentDay, kind: 'death',
            locationId: here, witnessIds: [s.witness.id], visibility: 'regional',
            actors: [{ id: actor.id, name: actor.name, role: 'killer' },
                { id: s.victim.id, name: s.victim.name, role: 'victim' }],
            summary: `${actor.name} killed ${s.victim.name}.`, data: aPricedDeed('grave') }), { recur: false });
        const [read] = reactToWitnessedFact(s.world, fact, { actorId: actor.id, victimId: s.victim.id,
            witnesses: [{ id: s.witness.id, seen: observationOf(fact) }] });
        expect(read?.state).toBe('pending');
        const accounts = accountsHousesHoldForTheirDead(s.world, s.world.currentDay + 100);
        const held = accounts.find(row => row.houseId === bystanderId && row.subjectId === actor.id);
        expect(held?.war).toBe(false);
        s.world.currentDay += 100;
        const posted = housesPutUpTheirPaper(s.world, accounts, s.world.currentDay);
        const demanded = housesAnswerKnownDeeds(s.world, accounts, s.world.currentDay);
        expect(posted.some(p => p.posterFactionId === bystanderId && p.targetId === actor.id)).toBe(false);
        expect(demanded.some(f => f.data.handoverDemand === true && f.factionIds.includes(bystanderId))).toBe(true);
        expect(demanded.some(f => f.data.handoverAnswer === 'refused'
            || f.data.handoverAnswer === 'delivered')).toBe(true);
        expect(whatEachHouseWarnsOf(s.world).get(bystanderId)?.some(row => row.kind === 'warning')).toBe(true);
        s.db.close();
    });
});
