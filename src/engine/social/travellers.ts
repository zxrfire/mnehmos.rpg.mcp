/**
 * People passing through, and the names they bring with them.
 *
 * `docs/world/houses/discovery.md` lists the scarce sources a step up the ladder can
 * come from: "a sect elder who has heard things, a record in a library you
 * have access to, A TRAVELLER, a ruin's inscriptions, an auction catalogue, a
 * rumour that turns out to be half true - or the thing itself walking past."
 *
 * Of those, the traveller is the only one available to somebody who has never
 * left their village and has nothing to trade for information. It is therefore
 * the main engine of discovery for the ordinary case, which is almost every
 * case: a cultivator in a thin-qi settlement who cannot afford to go anywhere
 * and would not know where to go if they could.
 *
 * ── What a traveller gives, and what they do not ──────────────────────────
 * Two different things, and keeping them apart is the whole file.
 *
 *   Where they came FROM is `placed`. They said it themselves, with a number
 *   of days attached, because that is how a person answers "where are you off
 *   to then". The listener now knows a place exists, roughly where it is, and
 *   that a road goes there. That is a route out of the village.
 *
 *   Anything else they mention is `whisper`. A name said in passing, on the
 *   way to the price of salt. The listener has the word and nothing else, and
 *   the traveller will be gone tomorrow.
 *
 * discovery.md is emphatic about the second half: "A character said a name;
 * that grants the name, not the meaning. If the next paragraph tells the
 * player what the Sill is, the moment has been spent for nothing."
 *
 * ── Why they are forthcoming ──────────────────────────────────────────────
 * `asking.md`: "what closes a mouth is position, not power... A wandering
 * expert with no sect, no title and no lease may simply tell you - not as a
 * favour, and not because you asked well. Because it cost them nothing and
 * they were already talking." A traveller is the cheap, low-stakes version of
 * exactly that, and it is why the channel works at all.
 *
 * ── Pure, seeded, and ignorant of everything else ─────────────────────────
 * Nothing here reads a database, a realm, a location record or a catalog. The
 * caller hands in the places this listener cannot already name; this module
 * decides whether somebody came through today and which of those names they
 * would say. Same seed, same day, same place: same traveller.
 */

// ─────────────────────────────────────────────────────────────────────────
// SHAPES
// ─────────────────────────────────────────────────────────────────────────

/**
 * A place a traveller could have come from or could mention.
 *
 * Deliberately three fields. This module has no business knowing what a
 * location record contains, and a wider type here would tempt somebody into
 * reading a threshold off it and deciding a traveller cannot mention a place
 * the listener could not survive - which would be the access gate leaking into
 * the knowledge gate, and the one mistake discovery.md names twice.
 */
export interface TravellerPlace {
    id: string;
    name: string;
    /** Where it belongs, when that is known. Used to prefer far names. */
    regionId: string | null;
}

/**
 * What somebody on the road is.
 *
 * Occupations rather than personalities, because the register is the point:
 * these are people with somewhere to be, who mention where they have been the
 * way anyone does, and who are not performing a revelation.
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
 * How the world sees them, with no name attached.
 *
 * A traveller is not introduced. Standing in the same square is permission to
 * see somebody, never to know who they are, and a passer-through who is gone
 * by evening is the clearest case of it - so the listener gets a shape and the
 * knowledge layer is never handed a person.
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
     * Where they came from, and how long it took.
     *
     * The valuable half. Said flatly, with a number of days on it, which is
     * what makes it `placed` rather than a sound.
     */
    from: TravellerPlace;
    /** Days on the road, as they said it. Their account, not a measurement. */
    daysOnTheRoad: number;
    /**
     * Names dropped on the way past, assuming the listener knows them.
     *
     * `whisper` and no more. Usually empty: somebody stopping for water is not
     * a gazetteer, and a traveller who reels off four proper nouns is a
     * briefing with a cart in front of it.
     */
    mentions: TravellerPlace[];
    /** Provenance, honestly. Goes onto the record and is read a lifetime later. */
    note: string;
    /** How much of a fact this is. On the record; never a gate. */
    confidence: number;
}

// ─────────────────────────────────────────────────────────────────────────
// HOW OFTEN
// ─────────────────────────────────────────────────────────────────────────

/**
 * Chance somebody came through, in a scene the listener did not pay for.
 *
 * Low enough that a traveller is a thing that happens rather than a fixture,
 * high enough that a cultivator who spends a year in one village meets several
 * - which is the point. This is the channel that has to work for a player who
 * never leaves, so it is the one rate in the discovery layer that is allowed
 * to be generous.
 */
export const TRAVELLER_AMBIENT_CHANCE = 0.18;

/**
 * And when the listener is deliberately sitting where the road is.
 *
 * asking.md's cheapest lever, applied to geography rather than to people:
 * loitering in a market with no business is free, available to a cultivator
 * with nothing, and it should pay.
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
     * Places this listener cannot already name.
     *
     * Filtered by the caller against the holder's own records, because this
     * module does not read the ledger. An empty list means nobody has anything
     * to tell them, and no traveller is generated - a scene where somebody
     * arrives and says nothing new is not worth a roll.
     */
    unknownPlaces: readonly TravellerPlace[];
    /** The region the listener is standing in, or null when it is not known. */
    hereRegionId: string | null;
    /**
     * How much of the world goes past this door, 0..1.
     *
     * A ford on the border road sees carts; a hamlet up a dead-end valley does
     * not. Supplied by whoever knows the map - this module will not go looking
     * for one. Defaults to the middle, which is the honest answer when nobody
     * has said.
     */
    traffic?: number;
    /** Whether the listener is deliberately watching the road. */
    listening?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// WHO CAME THROUGH
// ─────────────────────────────────────────────────────────────────────────

/**
 * Decide whether somebody passed through, and what they said.
 *
 * Returns null far more often than not. The names are drawn with a strong
 * preference for somewhere ELSE, because that is the entire value of a
 * traveller: local geography is what everybody already has, and a road that
 * only ever brings news of the next village over is not a road.
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

    // Where they came from. Far first, because near is what the listener
    // already has - and if there is nothing far left, near is still a road.
    const far = unknownPlaces.filter(place =>
        place.regionId === null || place.regionId !== input.hereRegionId);
    const pool = far.length > 0 ? far : unknownPlaces;
    const from = pool[rng.int(0, pool.length - 1)];

    // Their account of the distance. Theirs, not a measurement: a carter says
    // eleven days and means whatever eleven days meant to him.
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
 * Who said it, and under what circumstances.
 *
 * discovery.md: "Record the source. A name from a drunk carter and a name from
 * a sect archivist are different facts, and the carter's may still be the true
 * one." A hundred turns later this sentence is what tells a player which of
 * their two names for a thing to trust, so it says what happened and makes no
 * claim about whether it was right.
 */
function travellerNote(kind: TravellerKind, from: TravellerPlace, days: number): string {
    return `${TRAVELLER_SHAPE[kind]}, ${TRAVELLER_ERRAND[kind]}, said they had come ` +
        `from ${from.name} - ${days} days. They said it the way you would say a weekday, ` +
        'and did not stay.';
}

/**
 * What the listener holds afterwards, in their own words.
 *
 * Two sentences for two stages, and neither explains anything. The first says
 * where a place is because that is genuinely what was conveyed; the second is
 * the engine's standing account of a word with nothing attached to it.
 */
export function placedStatement(place: TravellerPlace, days: number): string {
    return `${place.name} is somewhere a road goes, about ${days} days off. ` +
        'Somebody came from there.';
}

export function whisperStatement(place: TravellerPlace): string {
    return `${place.name} is a name that got said. What it is remains unknown.`;
}

/**
 * The traveller as engine prose, for the path with no model behind it.
 *
 * Says what happened and stops. It does not tell the listener what any of it
 * means, it does not imply a relationship between the two names, and it ends
 * on something ordinary - which is the register discovery.md asks for and the
 * reason the moment lands.
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
