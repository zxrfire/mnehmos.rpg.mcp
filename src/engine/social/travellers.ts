/**
 * People passing through, and the names they bring with them.
 */

/**
 * A place a traveller could have come from or could mention.
 */
export interface TravellerPlace {
    id: string;
    name: string;
    /** Where it belongs, when that is known. Used to prefer far names. */
    regionId: string | null;
}

/**
 * What somebody on the road is. Occupations rather than personalities, because
 * these are people with somewhere to be who are not performing a revelation.
 */
export type TravellerKind =
    | 'carter'
    | 'courier'
    | 'pedlar'
    | 'pilgrim'
    | 'drover'
    | 'displaced'
    | 'surveyor'
    | 'physician';

export const TRAVELLER_KINDS: readonly TravellerKind[] = [
    'carter', 'courier', 'pedlar', 'pilgrim', 'drover', 'displaced', 'surveyor', 'physician'
] as const;

/**
 * How the world sees them, with no name attached. Standing in the same square
 * is permission to see somebody and never to know who they are, so the listener
 * gets a shape and the knowledge layer is never handed a person.
 */
export const TRAVELLER_SHAPE: Record<TravellerKind, string> = {
    carter: 'A carter watering his animals',
    courier: 'A courier waiting on a seal',
    pedlar: 'A pedlar with a pack she has not put down',
    pilgrim: 'A pilgrim resting a bad leg',
    drover: 'A drover counting stock he does not trust',
    displaced: 'Somebody who came here with what they could carry',
    surveyor: 'A surveyor writing up the morning',
    physician: 'A physician between calls'
};

/** How each one accounts for the road, in one clause. Never explanatory. */
export const TRAVELLER_ERRAND: Record<TravellerKind, string> = {
    carter: 'hauling, and behind',
    courier: 'carrying, and paid by the day',
    pedlar: 'selling, badly',
    pilgrim: 'walking it because it is walked',
    drover: 'moving stock ahead of the weather',
    displaced: 'not going back',
    surveyor: 'measuring somebody else\'s ground',
    physician: 'called out, and called out again'
};

export interface Traveller {
    kind: TravellerKind;
    /** How the listener would describe them. Not a name; they gave none. */
    shape: string;
    /**
     * Where they came from, and how long it took. The valuable half: said
     * flatly with a number of days on it, which is what makes it `placed`
     * rather than a sound.
     */
    from: TravellerPlace;
    /** Days on the road, as they said it. Their account, not a measurement. */
    daysOnTheRoad: number;
    /**
     * Names dropped on the way past. `whisper` and no more, and usually empty:
     * a traveller who reels off four proper nouns is a briefing with a cart in
     * front of it.
     */
    mentions: TravellerPlace[];
    /** Provenance, honestly. Goes onto the record and is read a lifetime later. */
    note: string;
    /** How much of a fact this is. On the record; never a gate. */
    confidence: number;
}

/**
 * Chance somebody came through, in a scene the listener did not pay for. Low enough
 * that a traveller is a thing that happens rather than a fixture, high enough that
 * a cultivator who spends a year in one village meets several. The one rate in the
 * discovery layer that is allowed to be generous, because this is the channel that
 * has to work for a player who never leaves.
 */
export const TRAVELLER_AMBIENT_CHANCE = 0.18;

/**
 * And when the listener is deliberately sitting where the road is. Loitering in
 * a market with no business is free, available to a cultivator with nothing,
 * and it should pay.
 */
export const TRAVELLER_LISTENING_CHANCE = 0.5;

/** Chance a traveller drops a second name on top of where they came from. */
export const TRAVELLER_MENTION_CHANCE = 0.4;

/** The minimum an RNG has to offer. Seeded and owned by the engine. */
export interface TravellerRng {
    chance(p: number): boolean;
    int(min: number, max: number): number;
}

export interface PassingThroughInput {
    rng: TravellerRng;
    /**
     * Places this listener cannot already name, filtered by the caller because
     * this module does not read the ledger. An empty list generates no
     * traveller: somebody arriving and saying nothing new is not worth a roll.
     */
    unknownPlaces: readonly TravellerPlace[];
    /** The region the listener is standing in, or null when it is not known. */
    hereRegionId: string | null;
    /**
     * How much of the world goes past this door, 0..1. Supplied by whoever
     * knows the map; this module will not go looking for one. Defaults to the
     * middle, which is the honest answer when nobody has said.
     */
    traffic?: number;
    /** Whether the listener is deliberately watching the road. */
    listening?: boolean;
}

/**
 * Decide whether somebody passed through, and what they said. Returns null far
 * more often than not, and draws names with a strong preference for somewhere
 * ELSE: local geography is what everybody already has.
 */
export function passingThrough(input: PassingThroughInput): Traveller | null {
    const { rng, unknownPlaces } = input;
    if (unknownPlaces.length === 0) return null;

    const traffic = clamp01(input.traffic ?? 0.5);
    const base = input.listening ? TRAVELLER_LISTENING_CHANCE : TRAVELLER_AMBIENT_CHANCE;
    // Traffic scales the rate rather than gating it. Somebody walks through
    // everywhere eventually, including the places nobody has a reason to be.
    if (!rng.chance(base * (0.4 + traffic))) return null;

    const kind = TRAVELLER_KINDS[rng.int(0, TRAVELLER_KINDS.length - 1)];

    // Far first, because near is what the listener already has - and if there
    // is nothing far left, near is still a road.
    const far = unknownPlaces.filter(place =>
        place.regionId === null || place.regionId !== input.hereRegionId);
    const pool = far.length > 0 ? far : unknownPlaces;
    const from = pool[rng.int(0, pool.length - 1)];

    // Their account of the distance, not a measurement: a carter says eleven
    // days and means whatever eleven days meant to him.
    const daysOnTheRoad = rng.int(2, 20);

    const mentions: TravellerPlace[] = [];
    const rest = unknownPlaces.filter(place => place.id !== from.id);
    if (rest.length > 0 && rng.chance(TRAVELLER_MENTION_CHANCE)) {
        mentions.push(rest[rng.int(0, rest.length - 1)]);
    }

    return {
        kind,
        shape: TRAVELLER_SHAPE[kind],
        from,
        daysOnTheRoad,
        mentions,
        note: travellerNote(kind, from, daysOnTheRoad),
        // A stranger with no reason to lie and no reason to be accurate. Higher
        // than a fragment through a wall, well below anything written down.
        confidence: 0.4
    };
}

/**
 * Who said it, and under what circumstances. A hundred turns later this
 * sentence is what tells a player which of their two names for a thing to
 * trust, so it says what happened and makes no claim about whether it was right.
 */
function travellerNote(kind: TravellerKind, from: TravellerPlace, days: number): string {
    return `${TRAVELLER_SHAPE[kind]}, ${TRAVELLER_ERRAND[kind]}, said they had come ` +
        `from ${from.name} - ${days} days. They said it the way you would say a weekday, ` +
        'and did not stay.';
}

/**
 * What the listener holds afterwards, in their own words. Two sentences for two
 * stages, and neither explains anything.
 */
export function placedStatement(place: TravellerPlace, days: number): string {
    return `${place.name} is somewhere a road goes, about ${days} days off. ` +
        'Somebody came from there.';
}

export function whisperStatement(place: TravellerPlace): string {
    return `${place.name} is a name that got said. What it is remains unknown.`;
}

/**
 * The traveller as engine prose, for the path with no model behind it. Says
 * what happened and stops: no explanation of what any of it means, no implied
 * relationship between the two names, and it ends on something ordinary.
 */
export function travellerProse(traveller: Traveller): string {
    const mentioned = traveller.mentions.length > 0
        ? ` Somewhere in it ${traveller.mentions.map(m => m.name).join(' and ')} ` +
          'gets said, in the middle of something else, and is not explained.'
        : '';
    return `${traveller.shape}, ${TRAVELLER_ERRAND[traveller.kind]}. ` +
        `They came up from ${traveller.from.name}, ${traveller.daysOnTheRoad} days, ` +
        'and say so the way you would say a weekday.' + mentioned +
        ' Then it is the weather, and then they are gone.';
}

function clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0.5;
    return value < 0 ? 0 : value > 1 ? 1 : value;
}
