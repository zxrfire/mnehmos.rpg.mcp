/**
 * WHAT SOMEBODY WHO CAN LEAVE THE GROUND SEES WITHOUT BEING TOLD ANY OF IT.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE RULING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   "at higher ranks you should just be able to fly and look around. why should
 *    the entire thing be dependent on asking? that's a mortal's POV."
 *
 * And it is right. `docs/world/houses/discovery.md` builds the whole of discovery on
 * BEING TOLD - hearsay, a record, a traveller, a name said in front of you -
 * which is the correct and load-bearing model for a farm child at Qi
 * Condensation Layer 1 and the wrong one for somebody who does not need
 * anybody's permission to be a thousand feet up. A Void Refinement cultivator
 * does not need a carter to mention that there is a mountain over there.
 *
 * So discovery has a second channel, and this is it. The two are not ranked
 * against each other and neither replaces the other:
 *
 *   BEING TOLD   proximity-gated. Somebody has to be near enough, and willing.
 *                Yields NAMES, and everything a name carries.
 *   SEEING       realm-gated. Yields the WORLD, and nothing that lives in it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE LINE THAT MUST HOLD, AND WHY IT IS IN THE TYPE RATHER THAN IN A COMMENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   PERCEPTION GIVES YOU THE WORLD. IT DOES NOT GIVE YOU PEOPLE.
 *
 * You can see the mountain. You cannot see whose mountain it is.
 *
 *   PHYSICAL, and a high cultivator perceives it: that there is a settlement in
 *   that valley, how far away it is, which way it lies, what the ground under
 *   it carries, whether anything is standing on it, what a compound looks like
 *   from outside.
 *
 *   SOCIAL, and it stays behind the existing gate: its name, whose it is, what
 *   the house is called, who is inside it, how far that province carries
 *   anybody, what somebody there did.
 *
 * That split is already the setting's: an object's nature is realm-gated
 * perception - somebody high enough can tell a relic is genuine anywhere in the
 * world - and who its ancestor was is proximity-gated and no amount of altitude
 * supplies it.
 *
 * {@link Sighting} HAS NO NAME FIELD, and that is the enforcement. A structural
 * guarantee beats a rule somebody has to remember: this module cannot leak a
 * name into the player's prose because it is never handed one. The caller
 * strips them at the boundary. If a later change wants to print a name here, it
 * will have to add a field and argue for it in review, which is the point.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ONE SCALE, READ OFF THE LADDER. NO RUNGS ENUMERATED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The same shape as `what-you-can-tell-about-the-ground.ts`, which is the
 * precedent this follows rather than a design invented here: that module
 * already masks a vein's figures below Core Formation because reading ground is
 * a capability and not a fact you are handed. This generalises the principle
 * from a measurement to geography.
 *
 * What a height buys is ONE NUMBER - how far away a thing can be and still be
 * made out - and everything else is `distance <= horizon`. A tenth thing
 * visible at a tenth height needs no branch, because there are no branches on
 * height at all. There is a curve, and there is a comparison.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHERE THE FLOOR SITS, AND THE HONEST READING OF WHAT FLIGHT IS HERE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Checked before anything was written, because inventing a capability this
 * world does not have would be the larger mistake. **Flight already exists and
 * is not a realm grant.** It is nowhere in `CLASS_GRANTS`, nowhere in
 * `capability.ts`, and has no predicate. What it is, in full:
 *
 *   `gale-riding-sword-flight`   requiredOrdinal 15. "The first true flight
 *                                most cultivators achieve: standing on one's
 *                                own sword and letting metal qi carry both.
 *                                Slow, cold, and the reason Foundation
 *                                cultivators are so insufferable about it."
 *   `thousand-li-cloud-tread`    requiredOrdinal 22. "Sustained flight at the
 *                                height where the air thins and the birds stop."
 *   `no flight`                  a local law a place may declare
 *                                (`LocationEnvironment.specialRules`), which is
 *                                only worth writing down about a world where
 *                                people fly.
 *
 * So the honest reading is the catalog's own, and this module takes it rather
 * than minting a grant: **leaving the ground is a Foundation-era capability and
 * real altitude is a Nascent Soul one.** The two ordinals below are those two
 * rows' `requiredOrdinal`, stated here the way `READS_A_VEIN` is stated in the
 * ground module, and asserted against the catalog in the tests so that a
 * content pass that moves either row fails loudly and points at this file.
 *
 * Deliberately NOT gated on holding either art. Two reasons, and the second is
 * the one that decides it. A technique row is one house's way of doing a thing
 * that the whole world does - the description says "most cultivators achieve",
 * not "holders of this row achieve" - so keying on the id would make a
 * universal capability into a Sword Pavilion privilege. And gating perception
 * on an art nothing grants to a player who did not go looking for it would
 * rebuild, one layer down, exactly the "you had to be told" problem this exists
 * to fix.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE GATE SCALES. IT DOES NOT VANISH
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Below {@link LEAVES_THE_GROUND} the horizon is zero and this read returns
 * nothing at all, which leaves discovery for a low cultivator exactly as it
 * was - and it should, because for them the social channel is doing real work
 * and doing it well.
 *
 * And what is seen is never the catalog. A cultivator at the top of the ladder
 * with the whole world inside their horizon still gets shapes on ground, a
 * bearing and a distance. They do not get the register. The list of everything
 * that exists remains something the world has to say out loud.
 */

import type { AmbientQi } from '../schema/cultivation.js';
import type { Bearing } from '../data/cultivation/regions.js';

// ─────────────────────────────────────────────────────────────────────────
// THE SCALE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Ordinal at which a cultivator can get off the ground at all.
 *
 * `gale-riding-sword-flight.requiredOrdinal`. Below it this read is silent.
 */
export const LEAVES_THE_GROUND = 15;

/**
 * Ordinal at which flight is sustained and high rather than a slow cold hop.
 *
 * `thousand-li-cloud-tread.requiredOrdinal` - "the height where the air thins
 * and the birds stop". Not a branch: it is the second point the curve below is
 * fitted through, and nothing tests against it at runtime.
 */
export const ABOVE_THE_WEATHER = 22;

/**
 * How far the first flight sees, in the catalog's own travel days.
 *
 * Two. The shortest road between any two provinces is six days, so somebody who
 * has just learned to stand on a sword sees their own province and nothing past
 * it - which is the correct answer for a capability whose own description calls
 * it slow and cold.
 */
export const HORIZON_AT_FIRST_FLIGHT = 2;

/**
 * What one more rung is worth, multiplicatively.
 *
 * Fitted through the second anchor rather than chosen: 1.3 puts
 * {@link ABOVE_THE_WEATHER} at about 12.6 days, which reaches the provinces six
 * and eleven days out and not the ones at seventeen and thirty-four. So Nascent
 * Soul sees its neighbours and Deity Transformation sees the world, and the
 * second of those is the cultivation README's own claim - "spiritual perception
 * extends across a region rather than a field" - arrived at from the travel
 * catalog rather than written to match it.
 *
 * Growth is unbounded on purpose and needs no cap. The world is thirty-four
 * days across at its widest, so the curve saturates against the map instead of
 * against a constant somebody would have to maintain.
 */
export const HORIZON_GROWTH_PER_RUNG = 1.3;

/**
 * How far this height can make anything out, in travel days.
 *
 * The whole of what a realm buys here. Zero below the floor, and there is no
 * other threshold anywhere in this file.
 */
export function horizonInDays(ordinal: number): number {
    if (ordinal < LEAVES_THE_GROUND) return 0;
    return HORIZON_AT_FIRST_FLIGHT * HORIZON_GROWTH_PER_RUNG ** (ordinal - LEAVES_THE_GROUND);
}

/**
 * Whether a thing that far off is inside this horizon.
 *
 * `null` days means "inside the province you are standing over", which the
 * gazetteer prices no road for and never has. It is treated as visible to
 * anybody who is off the ground rather than given an invented number, on the
 * same reasoning `whereCouldTheyGo` refuses to print a fabricated zero: the
 * shortest stated road in the world is six days, so a province is comfortably
 * inside the shortest horizon and no arithmetic is needed to say so.
 */
export function withinSight(horizonDays: number, days: number | null): boolean {
    if (horizonDays <= 0) return false;
    if (days === null) return true;
    return days <= horizonDays;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT A SIGHTING IS
// ─────────────────────────────────────────────────────────────────────────

/**
 * One thing on the ground, as it looks from above it.
 *
 * Note what is not here: no name, no id, no faction, no owner, no ceiling, no
 * occupant. See the banner - the omission is the design, and it is in the type
 * so that it cannot be forgotten.
 */
export interface Sighting {
    /**
     * What kind of thing it is, physically. A `LocationKind`, which the caller
     * has already taken off the row - this module turns it into what it looks
     * like from up there, and a kind it does not recognise is reported as
     * something on the ground rather than guessed at.
     */
    kind: string;
    /** Where it lies in the world, off the region's own `bearing`. */
    bearing: Bearing;
    /** Days of travel, from the region catalog. Null inside your own province. */
    days: number | null;
    /**
     * The band the ground itself carries.
     *
     * Physical, and the single most valuable thing this channel gives that the
     * social one cannot: rich ground with nobody on it is exactly what nobody
     * mentions, because the people who know are not telling.
     */
    ambient: AmbientQi | null;
    /**
     * Whether anything is standing on it.
     *
     * Roofs, smoke, movement. A count is a different fact and is not offered:
     * `where-this-cultivator-could-go.ts` established over five seeds that a
     * headcount changes at 60% of steps and its SHAPE at 5%, and a shape is what
     * an eye at height actually resolves. Null where the world holds no record,
     * because "nothing is there" and "nobody has looked" are different answers.
     */
    inhabited: boolean | null;
}

export interface OverlookInput {
    ordinal: number;
    /** Where the viewer is, so a bearing can be stated relative to them. */
    from: Bearing;
    /**
     * Everything the world holds that this cultivator cannot already point at,
     * stripped to physical facts by the caller.
     *
     * Already filtered: this module applies no knowledge gate of its own, in the
     * same division `whereCouldTheyGo` keeps. What it applies is the horizon.
     */
    onTheGround: readonly Sighting[];
}

export interface OverlookRead {
    headline: string;
    lines: string[];
    structure: string[];
    /** How many were inside the horizon. Zero is a real and common answer. */
    seen: number;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT A THING LOOKS LIKE FROM ABOVE IT
// ─────────────────────────────────────────────────────────────────────────

/**
 * The outside of a place, with everything social taken off it.
 *
 * Read the sect entries carefully, because they are where this is easiest to
 * break: a seat is "a compound somebody built to be defended", never "a sect".
 * You can see the walls. Which house put them up is a thing somebody says.
 *
 * And note that dead ground and ground nobody goes into come back IDENTICAL.
 * That is correct rather than lazy - from a thousand feet the two are the same
 * bald patch, and telling them apart is precisely the knowledge a name carries.
 */
const FROM_ABOVE: Record<string, string> = {
    hamlet: 'a scatter of roofs with smoke coming off them',
    village: 'a scatter of roofs with smoke coming off them',
    settlement: 'a scatter of roofs with smoke coming off them',
    market_town: 'a town laid out around an open square',
    city: 'a town big enough that the shape of its streets is legible',
    sect_town: 'a town that has grown up hard against a walled compound',
    sect_seat: 'a compound somebody built to be defended, and has kept up',
    waystation: 'a walled yard on a road, with stabling',
    province: 'the far edge of somebody else\'s country',
    region: 'the far edge of somebody else\'s country',
    vein: 'ground where nothing grows and the air over it stands wrong',
    wilds: 'open country with nothing standing on it',
    cave: 'an opening in a rock face, with a path worn to it or without one',
    ruin: 'walls nobody has kept up',
    grave: 'a raised place with cut stone on it',
    scar: 'a bald patch the country has not closed over',
    forbidden_zone: 'a bald patch the country has not closed over',
    secret_realm: 'a seam in the air that does not agree with the light around it',
    sealed_domain: 'a seam in the air that does not agree with the light around it',
    portal: 'a seam in the air that does not agree with the light around it',
    site: 'something built, a long time ago, that is still standing'
};

function fromAbove(kind: string): string {
    return FROM_ABOVE[kind] ?? 'something on the ground that somebody made';
}

/** The band, said as an eye at height would read it and never as a multiplier. */
const AIR_OVER_IT: Record<AmbientQi, string> = {
    thin: 'the air over it is poor',
    normal: 'the air over it is ordinary',
    dense: 'the air over it is heavy',
    spirit_tide: 'the air over it is running, and running will stop',
    sealed_vein: 'the air over it is wrong in the way a closed vein is wrong'
};

// ─────────────────────────────────────────────────────────────────────────
// WHERE IT LIES
// ─────────────────────────────────────────────────────────────────────────

const OPPOSITE: Record<string, string> = {
    north: 'south', south: 'north', east: 'west', west: 'east'
};

/**
 * Which way to look, honestly, given the shape of this world.
 *
 * The map is a cross: a centre, four arms, and a wedge of ungoverned interior
 * between them, and every road runs through the centre. So a bearing is an
 * absolute position and turning it into a direction depends on where the viewer
 * is standing:
 *
 *   from the CENTRE  an arm lies at its own bearing. Nothing to work out.
 *   from an ARM      the centre lies back down the road, which is the opposite
 *                    of the arm you are on.
 *   arm to ARM       there is no road, and saying "east" would be a claim about
 *                    a line nobody travels. It is said as what it is - across
 *                    the centre.
 *
 * Nothing is invented and nothing is a lie of convenience. Where the geometry
 * does not support a direction, the sentence says so instead of picking one.
 */
export function whichWay(from: Bearing, seen: Bearing): string {
    if (from === seen) return 'below you';
    if (seen === 'interior') return 'inland, in the wedge the roads leave between them';
    if (from === 'interior') return `out towards the ${seen === 'centre' ? 'gorge' : seen}`;
    if (from === 'centre') return `to the ${seen}`;
    if (seen === 'centre') return `back down the road, to the ${OPPOSITE[from] ?? seen}`;
    return `to the ${seen}, across the centre`;
}

/** How far, in the units the catalog prices roads in. */
function howFar(days: number | null): string {
    if (days === null) return 'inside this province';
    return `about ${days} day${days === 1 ? '' : 's'} of road away`;
}

// ─────────────────────────────────────────────────────────────────────────
// THE READ
// ─────────────────────────────────────────────────────────────────────────

/**
 * One sighting, as the cultivator would put it to themselves.
 *
 * Assembled from the four physical facts and nothing else. Every clause here
 * corresponds to a field on {@link Sighting}, which is how it stays impossible
 * for something social to appear in the sentence.
 */
function sightingLine(sighting: Sighting, from: Bearing): string {
    const air = sighting.ambient ? `, and ${AIR_OVER_IT[sighting.ambient]}` : '';
    const standing = sighting.inhabited === null
        ? ''
        : sighting.inhabited
            ? ' Something is living on it.'
            : ' Nothing is living on it.';
    return `${capitalise(fromAbove(sighting.kind))}, ${whichWay(from, sighting.bearing)}, `
        + `${howFar(sighting.days)}${air}.${standing}`;
}

function capitalise(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * What a cultivator who goes up and looks around actually comes back with.
 *
 * The refusal at the bottom names what would work, which every refusal in this
 * build owes the player: somebody who cannot get off the ground is told that
 * this is what is stopping them, and told that the other channel is still open
 * and is the one they should be using.
 *
 * Sorted by what somebody looking for ground to sit on is choosing on - the
 * nearest first, because the whole value of a sighting is that you could be
 * there - and the ordering is stable so the same look twice reads the same way.
 */
export function whatCanBeSeenFromUpThere(input: OverlookInput): OverlookRead {
    const horizon = horizonInDays(input.ordinal);
    const structure: string[] = [
        `Horizon ${horizon.toFixed(1)} travel days at ordinal ${input.ordinal} `
        + `(floor ${LEAVES_THE_GROUND}, ${HORIZON_AT_FIRST_FLIGHT} days growing `
        + `x${HORIZON_GROWTH_PER_RUNG} per rung). `
        + `${input.onTheGround.length} piece(s) of ground offered.`
    ];

    if (horizon <= 0) {
        return {
            headline: 'You cannot get above it.',
            lines: [
                'You look at as much of the world as a person standing on the world can look at, '
                + 'which is the next ridge and then the sky behind it.',
                'Getting high enough to see over it is a thing cultivators do, and not yet a thing '
                + 'you do. It comes in somewhere around a made foundation, on a sword or on '
                + 'anything else that will hold you up, and it is slow and cold when it comes.',
                'Until then the world reaches you the way it reaches everybody: somebody says a '
                + 'name where you can hear it. Ask, and keep asking.'
            ],
            structure: [
                ...structure,
                `Refused: ordinal ${input.ordinal} is below ${LEAVES_THE_GROUND}, the rung the `
                + 'catalog puts first flight at. Nothing was masked, because nothing was read - '
                + 'the horizon is zero and the whole read is skipped.'
            ],
            seen: 0
        };
    }

    const seen = input.onTheGround
        .filter(row => withinSight(horizon, row.days))
        .sort((a, b) => (a.days ?? -1) - (b.days ?? -1));

    structure.push(
        `${seen.length} inside the horizon, ${input.onTheGround.length - seen.length} beyond it. `
        + 'Physical facts only: kind, bearing, distance, the ground\'s own band, whether anything '
        + 'is standing on it. No name, no holder, no ceiling - those stay with the knowledge gate.'
    );

    if (seen.length === 0) {
        return {
            headline: 'Nothing you have not already got a name for.',
            lines: [
                'You go up, and there is nothing inside the circle you can hold that you could not '
                + 'have pointed at from the ground.',
                'Further out the country keeps going and stops resolving. Height is what buys the '
                + 'rest of it.'
            ],
            structure,
            seen: 0
        };
    }

    // ── THINGS THAT LOOK THE SAME ARE ONE SENTENCE ───────────────────
    //
    // Found by playing at ordinal 30: three tracts of open country in the same
    // province came back as three byte-identical lines, which reads as a bug
    // and is in fact the design working - from a thousand feet three empty
    // valleys with the same thin air ARE the same sighting, and there is
    // nothing to tell them apart with, because telling them apart is what a
    // name is for.
    //
    // So they are counted rather than repeated. This is the one place the read
    // could have leaked a distinction it does not have: printing three lines
    // implies three distinguishable things, and the player would reasonably
    // read the third as new information.
    const grouped = new Map<string, number>();
    for (const row of seen) {
        const line = sightingLine(row, input.from);
        grouped.set(line, (grouped.get(line) ?? 0) + 1);
    }
    structure.push(
        `${grouped.size} distinct sighting(s) out of ${seen.length}. Identical silhouettes are `
        + 'counted, not repeated: from that height there is nothing to tell two of them apart '
        + 'with, and printing one line each would imply a distinction only a name carries.'
    );

    return {
        headline: seen.length === 1
            ? 'One thing down there you have never been told about.'
            : `${seen.length} things down there nobody has told you about.`,
        lines: [
            ...[...grouped].map(([line, count]) => count === 1 ? line : `${line} ${andAgain(count)}`),
            'You can see them. That is the whole of what you have: what they are called, whose '
            + 'they are and what is inside them are things somebody has to say out loud.'
        ],
        structure,
        seen: seen.length
    };
}

/**
 * That there are more of the same, said as somebody counting from the air.
 *
 * A count and never a list, because a list would need them to be distinguishable
 * and they are not - which is exactly the fact this channel is here to be
 * honest about.
 */
function andAgain(count: number): string {
    return count === 2
        ? 'And another like it, near enough that you would not tell them apart from here.'
        : `And ${count - 1} more like it, near enough that you would not tell them apart `
          + 'from here.';
}
