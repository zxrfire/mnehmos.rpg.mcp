/**
 * How many of a house's people are worth putting in the world, and who they are.
 *
 * A roster is who you could come to know, not how many exist. AGENTS.md holds
 * that ruling; this is the half that acts on it.
 *
 * ── WHAT WAS WRONG ───────────────────────────────────────────────────────
 *
 * Nothing seeded a house's rank and file. A house got the people the CATALOG
 * names, plus whoever the wandering population happened to roll into it: the
 * seeder offers each derived person one local house at random and drops them if
 * that house's bar is above them. Measured at world open on seed `afford-a`,
 * 306 people on 38 rolls, of whom 207 were catalog figures and 99 were
 * everything else - a mean of 2.6 unnamed people per house, and THIRTEEN HOUSES
 * WITH NONE AT ALL. The roll ran 4 to 15 with a median of 8 on day one and 1 to
 * 31 with a median of 7 at a century, which is the figure AGENTS.md names as
 * too thin.
 *
 * So a house is seeded with the people it raised. They are the rank and file
 * AROUND the catalog's figures and never instead of them: what the catalog
 * already put on the roll is counted first, and only the shortfall is raised.
 *
 * ── WHERE THE NUMBER COMES FROM ──────────────────────────────────────────
 *
 * One figure is stated, because it is a fact about the player's head rather
 * than about the world, and AGENTS.md is explicit that this is where the number
 * has to come from: {@link A_ROLL_A_PLAYER_COULD_KNOW}. Everything that makes
 * one house differ from another is read off the catalog:
 *
 *   its ladder      a house with seven distinct standings has more places a
 *                   player could meet somebody than a patrol with four.
 *   its standing    an apex draws people a county sect never sees. The owner's
 *                   own caveat on the guideline - *"some can have more some can
 *                   have less"*, an apex may run richer.
 *   whether it
 *   recruits at all a house that takes nobody raises nobody, and keeps exactly
 *                   the people the catalog gives it. This is what holds the
 *                   Hollow Court and the Deeproot Court where they are.
 *   how long it
 *   has stood       a house founded inside the lifespan of the people it takes
 *                   in has not had time to fill a roll yet.
 *
 * Both medians are computed off the catalog rather than typed, so a house added
 * or a ladder changed moves what "ordinary" means instead of leaving a stale
 * number here.
 *
 * ── AND THE ONE THING IT MAY NOT MOVE ────────────────────────────────────
 *
 * `power_ordinal` is the strongest person on a house's roll, so deepening the
 * rank and file could silently re-order the whole catalog by standing. It
 * cannot: {@link theBandARaisedMemberStandsIn} caps a raised person below the
 * strongest the house already has, and returns null where the rung's own band
 * has no room under that cap - so the house holds one fewer rather than
 * gaining a head. Measured: identical `power_ordinal` on every house across
 * five seeds, before and after.
 */

import { SECTS } from '../../data/cultivation/sects.js';
import { rankRealmBand } from '../../data/cultivation/members.js';
import { lifespanForOrdinal } from '../cultivation/realms.js';

/**
 * The roll an ordinary house is worth modelling.
 *
 * The design owner's figure, and the only number here that is not read off the
 * catalog: *"we don't have to keep track of that many cultivators, 10-20 per
 * sect is already a lot for gameplay? that should fill up the rungs good."*
 *
 * It is a statement about how many people a player can hold in their head, so
 * there is nothing in the world to derive it from and it should not pretend
 * otherwise. It is a GUIDELINE - the owner said so in the same breath - and
 * what actually lands on a roll is this scaled by the house's own facts, so
 * the spread across a seeded world is roughly 4 to 22 rather than 15 anywhere.
 */
export const A_ROLL_A_PLAYER_COULD_KNOW = 15;

function median(values: readonly number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Houses that take people at all. The two that do not are not a scale. */
const RECRUITING = SECTS.filter(s => s.recruits);

/**
 * The ladder an ordinary house has, computed off the catalog.
 *
 * `A_ROLL_A_PLAYER_COULD_KNOW` is stated against this, so a house with fewer
 * rungs holds proportionally fewer and one with more holds more.
 */
export const AN_ORDINARY_LADDER = median(RECRUITING.map(s => s.ranks.length));

/**
 * What an ordinary house stands at, computed off the catalog.
 */
export const AN_ORDINARY_HOUSES_STANDING = median(RECRUITING.map(s => s.powerOrdinal));

/** Everything about a house that decides how much of it is worth modelling. */
export interface AHouseToBeFilled {
    rankCount: number;
    powerOrdinal: number;
    admissionOrdinal: number;
    recruits: boolean;
    /** Years since it was founded. */
    yearsStanding: number;
    /**
     * The roll an ORDINARY house is worth modelling. Defaults to
     * {@link A_ROLL_A_PLAYER_COULD_KNOW}; the seeder passes it through so a
     * world can be seeded without this pass and the two arms compared in one
     * command.
     */
    scale?: number;
}

/**
 * How many people this house is worth modelling, catalog figures included.
 *
 * Zero for a house that recruits nobody: a posting and a closed Court keep the
 * people the catalog names them with and gain no rank and file, by standing
 * ruling rather than by arithmetic.
 */
export function aRollWorthModelling(house: AHouseToBeFilled): number {
    if (!house.recruits) return 0;
    if (house.rankCount <= 0) return 0;

    const ladder = AN_ORDINARY_LADDER > 0 ? house.rankCount / AN_ORDINARY_LADDER : 1;
    const standing = AN_ORDINARY_HOUSES_STANDING > 0
        ? house.powerOrdinal / AN_ORDINARY_HOUSES_STANDING
        : 1;

    // A house has had time to fill a roll once it has stood for longer than the
    // people it takes in live. Until then it holds the share of one it has had
    // the years for. The lifespan is the ladder's own figure for somebody at
    // the bar this house admits at, not a settling period somebody chose.
    const aGeneration = Math.max(1, lifespanForOrdinal(house.admissionOrdinal));
    const filled = Math.min(1, Math.max(0, house.yearsStanding) / aGeneration);

    const scale = house.scale ?? A_ROLL_A_PLAYER_COULD_KNOW;
    return Math.max(0, Math.round(scale * ladder * standing * filled));
}

/**
 * The band somebody the house raised into this rung stands in.
 *
 * `rankRealmBand` is the catalog's own statement of what a member at a rank of
 * a house stands at, so this reads it rather than deciding anything - except
 * for the cap, which is the guarantee the header states: nobody a house raises
 * may stand at or above the strongest it already has, so `power_ordinal` is
 * untouched by construction. Null where the rung's band has no room under the
 * cap; the caller leaves the seat empty rather than lowering somebody into it.
 */
export function theBandARaisedMemberStandsIn(
    factionId: string,
    rankIndex: number,
    strongestAlreadyHere: number
): { minOrdinal: number; maxOrdinal: number } | null {
    const band = rankRealmBand(factionId, rankIndex);
    if (!band) return null;
    const ceiling = Math.min(band.maxOrdinal, strongestAlreadyHere - 1);
    if (ceiling < band.minOrdinal) return null;
    return { minOrdinal: band.minOrdinal, maxOrdinal: ceiling };
}
