/**
 * A Dao house's shopfront (分号): a self-contained storefront in a city, with a room at the back
 * where the few disciples keeping it sleep. The owner's three sizes of presence are in
 * `docs/world/houses/dao-houses.md`: a posting is one member, a shopfront is at most three because
 * three is all a scene holds, and only the Immovable Mountain Temple keeps whole branches.
 *
 * Not every city has every house. The Jade Register Hall keeps its gate at every city that matters
 * (provincial capitals and capitals), the Vermilion Sigil Terrace holds every capital auction, and
 * the Flowing Star Tower has opened offices in some of them. The Span's folding counters are the
 * same kind of thing and keep their own reader (`where-the-measured-span-still-answers.ts`).
 *
 * A shopfront belongs to a house that is still standing; a dissolved house's doors are shut.
 */
import { whatKindOfPlace } from '../../data/cultivation/regions.js';
import { forStream } from '../cultivation/rng.js';
import { isBelowTheLid } from './layers.js';
import type { LocationRecord } from './locations.js';
import type { FactionRecord, WorldState } from './world-state.js';

/** At most three keep a shopfront, because three is all a scene holds. */
export const A_SHOPFRONT_HOLDS = 3;

export type ShopfrontKind = 'register_gate' | 'star_office' | 'auction_floor';

export interface AShopfront {
    houseId: string;
    kind: ShopfrontKind;
    /** The area a player walks to, as they would say it. */
    area: string;
    /** Every city that matters, or the ones the house has opened in. */
    everyCity: boolean;
}

export const SHOPFRONTS: readonly AShopfront[] = [
    { houseId: 'house-jade-register', kind: 'register_gate', area: 'the Jade Register gatehouse', everyCity: true },
    { houseId: 'house-flowing-light', kind: 'star_office', area: 'the Flowing Star office', everyCity: false },
    // The auction house is already an area of every capital's exchange; the Terrace keeps its floor.
    { houseId: 'house-vermilion-seal', kind: 'auction_floor', area: 'the auction house', everyCity: true }
];

/** The cities that matter: provincial capitals and capitals, below the Lid. */
export function isACityThatMatters(place: Pick<LocationRecord, 'kind' | 'tags' | 'name' | 'layer'>): boolean {
    return place.kind === 'settlement' && isBelowTheLid(place)
        && (place.tags.includes('city') || whatKindOfPlace(place.name) === 'provincial capital');
}

/** Roughly half the cities that matter have a Flowing Star office; which half is the seed's. */
const AN_OFFICE_OPENS = 0.5;

function opensHere(seed: string, shop: AShopfront, place: Pick<LocationRecord, 'id'>): boolean {
    return shop.everyCity || forStream(seed, 'a-dao-house-opens-a-shopfront', shop.houseId, place.id).chance(AN_OFFICE_OPENS);
}

type Read = Pick<WorldState, 'seed' | 'factions'>;

function standing(state: Read, houseId: string): FactionRecord | undefined {
    return state.factions.find(h => h.id === houseId && h.dissolvedOnDay === null && isBelowTheLid(h));
}

/** The shopfronts at this place, of houses still standing. */
export function shopfrontsAt(state: Read, place: Pick<LocationRecord, 'id' | 'kind' | 'tags' | 'name' | 'layer'>): AShopfront[] {
    if (!isACityThatMatters(place)) return [];
    return SHOPFRONTS.filter(shop => standing(state, shop.houseId) && opensHere(state.seed, shop, place));
}

/** Where a house keeps shopfronts, in a stable order. Empty for a house that keeps none. */
export function shopfrontSitesOf(state: Read & Pick<WorldState, 'locations'>, houseId: string): LocationRecord[] {
    const shop = SHOPFRONTS.find(s => s.houseId === houseId);
    if (!shop || !standing(state, houseId)) return [];
    return state.locations.filter(place => isACityThatMatters(place) && opensHere(state.seed, shop, place))
        .sort((a, b) => a.id.localeCompare(b.id));
}

/** The shopfront this house keeps here, if any. */
export function theShopfrontOf(state: Read, houseId: string | null,
    place: Pick<LocationRecord, 'id' | 'kind' | 'tags' | 'name' | 'layer'>): AShopfront | null {
    if (houseId === null) return null;
    return shopfrontsAt(state, place).find(shop => shop.houseId === houseId) ?? null;
}
