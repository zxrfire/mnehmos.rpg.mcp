/** Actual finders take things. A sponsoring elder then chooses what to keep or share. */
import { forStream } from '../cultivation/rng.js';
import { realmIndexOf } from '../cultivation/realms.js';
import { pillBandOrdinal } from '../cultivation/breakthrough.js';
import { GRADE_ORDINAL_BANDS } from '../cultivation/which-rungs-a-grade-covers.js';
import { getTechnique } from '../../data/cultivation/techniques.js';
import { whetherTheyGiveItAway } from './what-somebody-standing-here-would-part-with.js';
import { applyWhatThePartyCarriedOut, booksLyingIn, goodsLyingIn, whoOfThemCouldOpenIt } from './what-a-ruin-has-on-its-shelves.js';
import { manualCeilingOf } from './manuals.js';
import { takeTheArtOffThePage } from './what-a-manual-has-left-in-it.js';
import { A_PUBLIC_WIN, theirFaceMoves, whatBeingWatchedIsWorth } from './what-a-face-is-worth.js';
import { whatThisThingIs } from './what-a-house-gives-merit-for.js';
import { transferPossession, type ObjectRecord } from './possessions.js';
import { isTheWorldsToMove, type NpcRecord } from './npc-state.js';
import { makeFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import type { WorldState } from './world-state.js';
import { playerAtTheContact } from './background-incident-draw.js';

/** Unknown usefulness earns no shame by inference. Read the actual art, power or native grade band. */
export function theyHaveOutgrownTheFind(person: NpcRecord, object: ObjectRecord): boolean {
    const ordinal = person.cultivation.realmOrdinal;
    const art = typeof object.data.techniqueId === 'string' ? getTechnique(object.data.techniqueId) : undefined;
    if (art?.cap != null) return realmIndexOf(art.cap) < realmIndexOf(ordinal);
    if (object.power !== null) return realmIndexOf(object.power) < realmIndexOf(ordinal);
    const thing = whatThisThingIs(object);
    if (thing && object.kind === 'pill') return realmIndexOf(pillBandOrdinal(thing.grade)) < realmIndexOf(ordinal);
    return thing !== null && GRADE_ORDINAL_BANDS[thing.grade].max < ordinal;
}

/** Equal parties keep each pickup. An elder expedition's sponsor decides every allocation. */
export function collectPrivatePartyFinds(state: WorldState, locationId: string, members: readonly NpcRecord[],
    elderId: string | null, day: number, ventureId: string, elderExpedition?: boolean,
    extraGoods: readonly ObjectRecord[] = []): void {
    const contact = playerAtTheContact(state);
    const survivors = members.filter(person => person.status === 'alive' && (isTheWorldsToMove(person)
        || contact?.id === person.id && contact.placeId === locationId));
    if (!survivors.length) return;
    const found = [...new Map([...booksLyingIn(state, locationId), ...goodsLyingIn(state, locationId), ...extraGoods]
        .map(object => [object.id, object])).values()];
    const finders = new Map<string, NpcRecord>();
    applyWhatThePartyCarriedOut(state, { locationId, house: null, readers: survivors, onDay: day, extraGoods,
        carrierFor: (object, alive) => {
            const finder = forStream(state.seed, 'private-party-finder', ventureId, object.id).pick([...alive]);
            finders.set(object.id, finder); return finder;
        } });
    for (const original of found) {
        const at = state.objects.findIndex(object => object.id === original.id), finder = finders.get(original.id);
        if (at < 0 || !finder || state.objects[at]!.possessorId !== finder.id) continue;
        allocatePrivatePartyFind(state, original, finder, survivors, elderId, locationId, day, ventureId, elderExpedition);
    }
}

/** The same allocation follows a real player's pickup as a native collector's pickup. */
export function allocatePrivatePartyFind(state: WorldState, original: ObjectRecord, finder: NpcRecord,
    survivors: readonly NpcRecord[], elderId: string | null, locationId: string, day: number, ventureId: string,
    elderExpedition?: boolean): void {
        const at = state.objects.findIndex(object => object.id === original.id);
        if (at < 0 || state.objects[at].possessorId !== finder.id || state.history.facts.some(fact =>
            fact.data.privatePartyFind === ventureId && fact.data.objectId === original.id)) return;
        const pickup = appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: 'secret', locationId,
            actors: [{ id: finder.id, name: finder.name, role: 'finder' }], causes: [ventureId],
            summary: `${finder.name} found and took ${original.name}.`, data: { privatePartyFind: ventureId, objectId: original.id } }),
            { recur: false, bystanders: false });
        state.objects[at] = transferPossession(state.objects[at]!, { toHolderId: finder.id, toHolderName: finder.name,
            onDay: day, how: 'found', transfersOwnership: true, factId: pickup.id });
        const elder = state.npcs.find(person => person.id === elderId && person.status === 'alive' && isTheWorldsToMove(person));
        const ownDisciple = finder.relationships.some(tie => tie.targetId === elder?.id && tie.kind === 'master');
        if (!elder || !(elderExpedition ?? ownDisciple)) return;
        const recipient = finder.id !== elder.id ? finder : survivors.find(person => person.id !== elder.id
            && person.relationships.some(tie => tie.targetId === elder.id && tie.kind === 'master'))
            ?? survivors.find(person => person.id !== elder.id);
        if (!recipient) return;
        const beneath = theyHaveOutgrownTheFind(elder, original);
        const tie = elder.relationships.find(row => row.targetId === recipient.id);
        const shared = whetherTheyGiveItAway({ id: elder.id, name: elder.name,
            ordinal: elder.cultivation.realmOrdinal, factionId: elder.factionId, spiritStones: elder.spiritStones }, {
            outgrown: beneath, recipientStanding: tie?.standing ?? 0, withholdingCostsFace: beneath && ownDisciple,
            rng: forStream(state.seed, 'elder-shares-a-find', ventureId, original.id, elder.id, recipient.id) });
        const choice = appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: 'secret', locationId,
            actors: [{ id: elder.id, name: elder.name, role: 'decided' }, { id: finder.id, name: finder.name, role: 'finder' },
                { id: recipient.id, name: recipient.name, role: 'recipient' }],
            causes: [pickup.id], summary: `${elder.name} ${shared ? `gave ${original.name} to ${recipient.name}` : `kept ${original.name}`}.`,
            data: { privateFindAllocation: ventureId, objectId: original.id, shared, beneathElder: beneath } }), { recur: false });
        const holder = shared ? recipient : elder;
        if (state.objects[at]!.possessorId !== holder.id) state.objects[at] = transferPossession(state.objects[at]!, { toHolderId: holder.id,
            toHolderName: holder.name, onDay: day, how: 'awarded', transfersOwnership: true, factId: choice.id });
        if (shared || beneath && ownDisciple) theirFaceMoves(state, elder.id,
            A_PUBLIC_WIN * whatBeingWatchedIsWorth(survivors.filter(person => person.id !== elder.id).length) * (shared ? 1 : -1), day);
        if (!shared && typeof original.data.techniqueId === 'string') {
            const art = getTechnique(original.data.techniqueId);
            if (art?.cap != null && art.cap > manualCeilingOf(elder) && whoOfThemCouldOpenIt([elder], {
                id: art.id, name: art.name, cap: art.cap, requiredOrdinal: art.requiredOrdinal ?? 0, element: art.element ?? null })) {
                const read = takeTheArtOffThePage(state.objects[at]!, { grade: art.grade, byId: elder.id, onDay: day });
                if (read.took) {
                    state.objects[at] = read.object;
                    const personAt = state.npcs.findIndex(person => person.id === elder.id), current = state.npcs[personAt]!;
                    state.npcs[personAt] = { ...current, cultivation: { ...current.cultivation,
                        techniqueIds: [...new Set([...current.cultivation.techniqueIds, art.id])] } };
                }
            }
        }
}
