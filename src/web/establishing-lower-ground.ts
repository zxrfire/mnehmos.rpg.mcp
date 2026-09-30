/** Living cultivators take ground and leave goods through the world's ordinary location store. */
import type { GameService } from './turn-engine.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { Execution } from './turn-wire-shapes.js';
import { standInTheWorld } from './the-player-as-a-row-the-world-can-invite.js';
import { theyTakeGroundAndMakeItTheirs } from '../engine/world/somewhere-that-is-theirs.js';
import { makeLocation, makeThresholds, linkLocations } from '../engine/world/locations.js';
import { transferPossession, isRuined, makeObject } from '../engine/world/possessions.js';
import { manualIdOf } from '../engine/world/manuals.js';
import { copiesHeldBy, theCopyLeftTheirHands } from '../server/consolidated/technique-manage.js';
import { getTechnique } from '../data/cultivation/techniques.js';
import { removeFromPouch } from '../server/consolidated/cultivation-support.js';
import { FOUND_BY_PROSPECTING_TAG } from '../engine/world/how-the-world-keeps-finding-more-ruins.js';
import { factsForRefusal, factsForToolResult } from './facts.js';
import { refused } from './tool-result-prose.js';
import { rankName, realmForOrdinal } from '../engine/cultivation/realms.js';
import { positionIn } from './standing.js';
import { matchScore, MATCH_THRESHOLD } from './entities.js';

export async function establishLowerGround(game: GameService, run: Run, cultivator: Cultivator,
    kind: 'residence' | 'inheritance', raw: string): Promise<Execution> {
    game.atHand ??= await game.loadWorld();
    const world = game.atHand;
    const action = kind === 'residence' ? 'stow' : 'legacy';
    const refuse = (line: string) => refused('world.establishGround', action, factsForRefusal(line, line));
    if (!world) return refuse('There is no ground here to build on.');
    const parent = world.locations.find(place => place.id === game.worldPlaceOf(cultivator));
    if (!parent) return refuse('There is no ground here to build on.');
    if (parent.controllingFactionId || parent.kind === 'sect_seat' || parent.data.factionId
        || parent.tags.includes('residence') || parent.tags.includes('gate_town'))
        return refuse('This ground is already held. A residence or inheritance needs unheld ground.');
    const position = positionIn(game.repos, cultivator.id);
    standInTheWorld(world, cultivator, { factionId: position?.sectId ?? null,
        rankIndex: position?.rankIndex ?? -1, contribution: 0 }, world.currentDay);
    if (kind === 'residence') {
        const settled = theyTakeGroundAndMakeItTheirs(world, {
            residentId: cultivator.id, onDay: world.currentDay, parentId: parent.id,
            name: `${cultivator.name}'s residence`,
            shape: { ambient: parent.ambient, qiDensity: parent.qiDensity,
                description: 'A residence cut into unheld ground.' }
        });
        if (!settled.ok || !settled.residence) return refuse(settled.detail);
        if (!settled.created) {
            const ground = world.locations.find(place => place.id === settled.residence!.parentId);
            return refuse(`You already hold ${settled.residence.name} at ${ground?.name ?? 'its existing ground'}. Travel there to use it.`);
        }
        Object.assign(world, settled.state);
        linkLocations(parent, settled.residence, 'path', 0.1);
        game.repos.cultivators.update(cultivator.id, { location: settled.residence.name });
        game.knowledge.learnIfNew({ holderId: cultivator.id, kind: 'place', id: settled.residence.id,
            name: settled.residence.name, onDay: run.elapsedDays, sourceKind: 'witnessed', stage: 'encountered' });
        game.theWorldMoved();
        return game.freeAction(run, action, factsForToolResult('Your residence stands here.',
            [`${settled.residence.name} is on ${parent.name}. Its contents stay here when you leave.`]));
    }
    const gate = /\bfor\s+ordinal\s+(\d+)\b/i.exec(raw);
    const ordinal = gate ? Number(gate[1]) : cultivator.realmOrdinal;
    const floor = realmForOrdinal(ordinal).ordinalStart;
    if (ordinal > cultivator.realmOrdinal) return refuse(`You can set a gate no higher than ${rankName(cultivator.realmOrdinal)}.`);
    const named = raw.replace(/^.*?\bleave\s+/i, '').replace(/\s+(?:as\s+)?(?:an?|my|the)\s+inheritance.*$/i, '').trim();
    const held = world.objects.filter(object => object.possessorId === cultivator.id && !isRuined(object)
        && (object.kind === 'manual' || object.kind === 'artifact'));
    for (const id of copiesHeldBy(game.db, cultivator.id)) {
        if (held.some(object => manualIdOf(object) === id)) continue;
        const art = getTechnique(id);
        if (art) held.push(transferPossession(makeObject({
            id: `obj-inheritance-copy-${cultivator.id}-${run.turn}-${id}`, name: art.name,
            kind: 'manual', ownerId: cultivator.id, ownerName: cultivator.name,
            data: { techniqueId: id, cap: art.cap ?? 0 }
        }), { onDay: world.currentDay, toHolderId: cultivator.id, toHolderName: cultivator.name,
            how: 'found', source: 'the copy carried in the pouch' }));
    }
    const goods = /^(?:an?|my|the)?\s*inheritance/i.test(named) || /^(?:my\s+)?(?:manuals?|artifacts?|books?|all|everything)$/i.test(named)
        ? held.filter(object => /artifact/i.test(named) ? object.kind === 'artifact' : /manual|book/i.test(named) ? object.kind === 'manual' : true)
        : held.filter(object => matchScore(named, object.name) >= MATCH_THRESHOLD);
    if (!goods.length) return refuse('You hold no manual or artifact matching that inheritance.');
    const site = makeLocation({ id: `loc-inheritance-${cultivator.id}-${run.turn}`,
        name: `${cultivator.name}'s inheritance`, kind: 'ruin', parentId: parent.id,
        description: `An inheritance left by a living cultivator, with a gate set for ${rankName(ordinal)}.`,
        ambient: parent.ambient, qiDensity: parent.qiDensity,
        thresholds: makeThresholds(0, floor, floor, ordinal), discovered: true,
        tags: ['inheritance', FOUND_BY_PROSPECTING_TAG],
        data: { builtById: cultivator.id, builtOnDay: world.currentDay, setByOrdinal: ordinal,
            admits: 'nobody_above_the_line', floorOrdinal: floor, ceilingOrdinal: ordinal,
            ruinCharacter: 'vault', wardIntegrity: 1 }
    });
    site.discoveredOnDay = world.currentDay;
    world.locations.push(site);
    linkLocations(parent, site, 'path', 0.1);
    for (const object of goods) {
        const manualId = manualIdOf(object);
        if (manualId) theCopyLeftTheirHands(game.db, cultivator.id, manualId);
        if (typeof object.data.artifactId === 'string') removeFromPouch(game.db, cultivator.id, object.data.artifactId, 1);
        const moved = transferPossession(object, { onDay: world.currentDay, toHolderId: null,
            toHolderName: 'nobody', how: 'gifted', source: site.name });
        const placed = { ...moved, ownerId: object.ownerId === cultivator.id ? null : object.ownerId,
            ownerName: object.ownerId === cultivator.id ? '' : object.ownerName, locationId: site.id };
        const at = world.objects.findIndex(row => row.id === object.id);
        if (at < 0) world.objects.push(placed); else world.objects[at] = placed;
    }
    game.knowledge.learnIfNew({ holderId: cultivator.id, kind: 'place', id: site.id,
        name: site.name, onDay: run.elapsedDays, sourceKind: 'witnessed', stage: 'encountered' });
    game.theWorldMoved();
    return game.freeAction(run, action, factsForToolResult('The inheritance stands.',
        [`${site.name} holds ${goods.map(object => object.name).join(', ')}. Its gate admits ${rankName(ordinal)}. You are still alive.`]));
}
