/** A person's expressed element changes nearby practice; their works are ordinary objects. */
import { getTechnique } from '../../data/cultivation/techniques.js';
import type { Cultivator, Element, Injury } from '../../schema/cultivation.js';
import { getSpiritRoot } from '../cultivation/spirit-roots.js';
import { brokenStatusesOn } from '../cultivation/what-goes-wrong-at-a-realm-boundary.js';
import { grantsHeldWith } from './capability.js';
import type { NpcRecord } from './npc-state.js';
import { makeObject, ruin, type ObjectRecord } from './possessions.js';
import type { WorldState } from './world-state.js';

type Body = Pick<Cultivator, 'realmOrdinal' | 'spiritRoot' | 'injuries'>;

export function expressedElement(ids: readonly string[]): Element | null {
    return ids.map(getTechnique).find(t => t?.element)?.element ?? null;
}

export function neighbourhoodRate(body: Body, people: readonly NpcRecord[], ownId: string, day: number): number {
    const elements = getSpiritRoot(body.spiritRoot).elements;
    let pressure = 1;
    let benefit = 1;
    for (const person of people) {
        if (person.id === ownId || person.status !== 'alive') continue;
        const other = person.cultivation;
        const broken = brokenStatusesOn(other.injuries);
        const grants = grantsHeldWith(other.realmOrdinal, broken);
        if (grants.includes('suppresses_lesser') && other.realmOrdinal > body.realmOrdinal) {
            pressure = Math.min(pressure, Math.max(0.05, Math.pow(0.85, other.realmOrdinal - body.realmOrdinal)));
        }
        if (!grants.includes('elemental_neighbourhood')) continue;
        if (broken.includes('unfulfilled-ascension') && (person.activity?.kind !== 'their_practice'
            || day - person.activity.sinceDay >= 1)) continue;
        const element = expressedElement(other.techniqueIds);
        if (element && elements.includes(element)) benefit = Math.max(benefit, 1.5);
    }
    return pressure * benefit;
}

export function makeElementalWork(input: {
    id: string; makerId: string; makerName: string; locationId: string;
    ordinal: number; injuries: readonly Injury[]; element: Element; onDay: number;
}): ObjectRecord | null {
    if (!grantsHeldWith(input.ordinal, brokenStatusesOn(input.injuries)).includes('lasting_elemental_work')) return null;
    const imperfect = brokenStatusesOn(input.injuries).includes('unfulfilled-ascension');
    return makeObject({
        id: input.id, name: `a ${input.element} working`, kind: 'other',
        ownerId: input.makerId, ownerName: input.makerName, locationId: input.locationId,
        significance: 'significant', tags: ['elemental-work', 'never-carried', `element:${input.element}`],
        data: { madeOnDay: input.onDay, expiresOnDay: imperfect ? input.onDay + 365 : null },
        provenance: [{ onDay: input.onDay, holderId: null, holderName: input.makerName,
            how: 'crafted', source: input.locationId, previousHolderId: null,
            previousHolderName: null, factId: null, note: `${input.element} left on the ground` }]
    });
}

export function expireElementalWorks(state: WorldState, day: number): void {
    state.objects = state.objects.map(o => o.tags.includes('elemental-work') && !o.tags.includes('ruined')
        && typeof o.data.expiresOnDay === 'number' && o.data.expiresOnDay <= day
        ? ruin(o, { onDay: o.data.expiresOnDay, source: 'the elemental working expired' }) : o);
}
