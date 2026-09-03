/**
 * Places that teach a dao: named ground where a road besides your own can be
 * walked, and who is standing on the door.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ACCESS PUTS A ROAD IN REACH, AND YEARS ARE WHAT WALK IT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This banner used to say ACCESS, NOT EFFORT, and the requirement still names
 * what must be IN REACH rather than what must be DONE: there is no deed here
 * and no quest, and nothing on this page can be earned by completing anything.
 * What has changed is that access alone is no longer the whole answer. Under
 * the old reading an NPC held every road their access could supply from the day
 * they were born, free, while a player standing on the same cliff held none -
 * so a price in YEARS OF PRACTICE now sits on every kind of access, charged the
 * same way to everybody, in
 * `engine/cultivation/what-a-road-in-reach-costs-to-walk.ts`. A cliff is forty
 * years. A carving is eight, because it is a text. Nobody may be somewhere for
 * an afternoon and leave with a road.
 *
 * What the rows below decide is still the interesting half: four completely
 * different ways of being unable to get in, and the difference between them is
 * the content:
 *
 *   HELD    A house controls it, and lets its own people in by STANDING. This
 *           is what membership is actually worth, and it is the answer to "why
 *           join a sect when you could buy the book" - the book is portable and
 *           the terrace is not. A house's dao ground is the one asset it cannot
 *           be robbed of and cannot sell, and it is why an outer disciple who
 *           will never be promoted is genuinely stuck in a way a rogue is not
 *           stuck: the rogue can go somewhere else.
 *
 *   OPEN    Nobody holds it. Anybody who is standing in the province and high
 *           enough to read it takes what is there. The cost is geography - you
 *           are born where you are born, and four of these are one province
 *           each - and the consequence is that a province is a hand of roads
 *           dealt at birth. The Drowned Reach has no institution in it worth
 *           the name and a cultivator raised there can still walk the road of
 *           life and death, because the water does not ask who sent you.
 *
 *   BURIED  Inside a ruin, and it teaches nobody until the ruin is found. This
 *           is the channel that opens on the world's own clock rather than on
 *           anybody's merit, and it is the only one that can put a road into a
 *           province that had none. An expedition is worth dying on because
 *           what comes out of the hole is not treasure, it is a road, and a
 *           road is the thing that money has never once bought.
 *
 *   CARVING A worked face somebody left behind, standing open in a province
 *           like any other rock. Three exist. Nobody is on the door and the
 *           bar is entirely the FLOOR, which is the highest in this file: a
 *           carving was cut for people who were in the room and had it shown to
 *           them first, so a later reader gets the surface without the
 *           afternoon. It is the one-time source to the other three's passive
 *           one, and in this engine that difference is the price - see
 *           `DaoGroundAccessSchema`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY A GROUND HAS A FLOOR AND NOT A CEILING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `fromOrdinal` is the rung below which a visitor takes nothing, and there is
 * deliberately no rung above which they stop taking it. Comprehension is not
 * priced like a manual. A manual has a `cap` because it teaches a METHOD and
 * the method runs out; a place teaches a PRINCIPLE, and a principle is either
 * legible to you or it is not. Standing in front of the Sword-Marked Cliff at
 * Qi Condensation, four hundred spans of somebody else's forty-year argument
 * with one problem is a cliff with scratches on it. At Foundation Establishment
 * it is an argument, and it stays an argument at Grand Ascension.
 *
 * Which is why the floors climb with what the ground is about rather than with
 * how impressive it is. The Grinding Ford asks almost nothing and the Doorless
 * Room asks Void Refinement, and the gap between them is not quality - it is
 * that you cannot be taught what an absence is by a thing that is there.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * NOTHING HERE IS BESPOKE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Every row becomes an ordinary `LocationRecord` at seeding - the same table a
 * ford town and a sect courtyard live in, with the same `kind`, the same
 * `thresholds` and the same `controllingFactionId` - and the road it teaches is
 * an ordinary `Insight` with an ordinary `InsightProvenance`. Take the place
 * away and the holder prices out as an ordinary house with one fewer holding.
 * There is no branch anywhere on which house owns which ground.
 *
 * See `src/engine/world/how-a-cultivator-comes-by-a-road.ts` for what reads it.
 */

import { z } from 'zod';

import { MAX_ORDINAL } from '../../engine/cultivation/realms.js';
import { InsightDomainSchema } from '../../schema/cultivation.js';

// ─────────────────────────────────────────────────────────────────────────
// THE SHAPE
// ─────────────────────────────────────────────────────────────────────────

/**
 * The one domain a root supplies unaided, and therefore the one domain a place
 * may never teach.
 *
 * A ground that taught `element` would be teaching what everybody already has,
 * and the gate does not count it - so the row would be scenery that looked like
 * supply, which is worse than an absence. The schema refuses it rather than a
 * test catching it later.
 */
export const DaoGroundDomainSchema = InsightDomainSchema.exclude(['element']);
export type DaoGroundDomain = z.infer<typeof DaoGroundDomainSchema>;

/**
 * How somebody fails to get in, which is four different sentences.
 *
 * The fourth, CARVING, is the one-time shape and the other three are the
 * passive one, and that difference is now a real difference rather than a
 * flavour note: `YEARS_A_ROAD_COSTS` in
 * `engine/cultivation/what-a-road-in-reach-costs-to-walk.ts` charges each kind
 * of access a price in years of practice, and a carving is cheap where ground
 * is expensive.
 *
 * That is the whole distinction and it is the right way round. A cliff is
 * expensive because nothing on it is addressed to you and the only way through
 * it is to sit there for forty years. A carving is a TEXT: you read it, and
 * what is scarce about it is that there are three faces in the world and
 * getting to one is the entire journey. `docs/world/climbing/immortals.md` is explicit
 * that a later reader "gets the surface an afternoon was worked out on without
 * the afternoon, and pays the whole of what reading costs" - so the price is
 * the floor, which is very high, and not the sitting.
 */
export const DaoGroundAccessSchema = z.enum(['held', 'open', 'buried', 'carving']);
export type DaoGroundAccess = z.infer<typeof DaoGroundAccessSchema>;

export const PlaceThatTeachesADaoSchema = z.object({
    id: z.string().min(3),
    /** The name the world uses. Printed, and therefore typeable back. */
    name: z.string().min(3),
    /** Region id from `regions.ts`. The place hangs under that province. */
    regionId: z.string().min(3),
    domain: DaoGroundDomainSchema,
    /** What specifically is understood. Becomes the insight's `subject`. */
    subject: z.string().min(3),
    /** Below this rung a visitor takes nothing. See the banner. */
    fromOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    access: DaoGroundAccessSchema,
    /**
     * Faction id that controls it. Required on `held`, null on the other two -
     * a ground somebody holds and a ground nobody holds are not the same row
     * with a field left blank, and the refinement below enforces it.
     */
    heldBy: z.string().min(3).nullable(),
    /**
     * Index into the holder's own rank ladder that a member must have reached
     * to be let in. Zero means every member; four is an elder.
     *
     * The same instrument `manuals.ts` gates a shelf with, for the same reason:
     * a house's depth is rationed by standing, and standing is the thing forty
     * years of sweeping actually buys.
     */
    standingRequired: z.number().int().min(0).max(5),
    /** What the place physically is. */
    description: z.string().min(80),
    /** What a visitor does there, and why it teaches anything. */
    what: z.string().min(80)
}).refine(
    row => (row.access === 'held') === (row.heldBy !== null),
    { message: 'a held ground names its holder and an unheld one names nobody' }
).refine(
    row => row.access === 'held' || row.standingRequired === 0,
    { message: 'nobody has standing at a ground nobody holds' }
);
export type PlaceThatTeachesADao = z.infer<typeof PlaceThatTeachesADaoSchema>;

// ─────────────────────────────────────────────────────────────────────────
// THE PLACES
//
// Twenty, and the distribution is the design rather than the count:
//
//   - every one of the eight roads is taught somewhere OPEN or BURIED, so no
//     domain is a house's private property and no house can close a road to
//     the world by holding its door. Specialisation is an advantage, never
//     ownership - the same rule the Dao houses are held to.
//   - every province has at least one open ground, so being born badly narrows
//     what is in reach without emptying it. The Quiet Marches, which is the
//     province people leave, has exactly one and its floor is the lowest in
//     the world.
//   - the held grounds sit on houses that already have a reason to hold them,
//     read off what those houses are: the sword sect holds the cliff, the
//     alchemy guild holds the kiln, the karma house holds the floor its whole
//     civil authority is issued from.
//   - the floors climb with the road rather than with the holder. Two houses
//     of identical standing hold grounds four realms apart, because what they
//     understand is different, not because one is grander.
// ─────────────────────────────────────────────────────────────────────────

export const PLACES_THAT_TEACH_A_DAO: readonly PlaceThatTeachesADao[] = [
    // ── HELD. The nine that make membership worth something. ──────────────
    {
        id: 'dao-ground-sword-marked-cliff',
        name: 'The Sword-Marked Cliff',
        regionId: 'region-low-fall',
        domain: 'weapon',
        subject: 'the sword',
        fromOrdinal: 12,
        access: 'held',
        heldBy: 'sect-azure-cloud-pavilion',
        standingRequired: 1,
        description:
            'Four hundred spans of gorge wall above the Pavilion terraces, cut end to end by one woman over thirty-one years. Nothing is written on it. The strokes are dated by depth and by which of them cross which, and they are not a curriculum - they are one person failing at the same problem several thousand times and being wrong differently each time.',
        what:
            'A disciple is sent up with nothing and told to find where she stopped being wrong. Most find the place in a season and take nothing from it. The ones who take something take it from the four hundred strokes before it, which is why the Pavilion will not simply point at the spot.'
    },
    {
        id: 'dao-ground-standing-kiln',
        name: 'The Standing Kiln',
        regionId: 'region-low-fall',
        domain: 'alchemy',
        subject: 'refinement',
        fromOrdinal: 16,
        access: 'held',
        heldBy: 'sect-cinnabar-crucible-guild',
        standingRequired: 2,
        description:
            'A furnace under the Guild compound that has not been allowed to go out in nine hundred and forty years, banked and fed in six-hour watches by people whose entire duty it is. The brickwork has taken on the shape of what has been refined in it, and the interior is no longer the shape anybody built.',
        what:
            'Watch-keeping. A Guild alchemist stands the watches for years, and what teaches is not the fire but the fact that every batch anyone has ever run has left the chamber slightly different - so a recipe is a conversation with a vessel that remembers, and no two furnaces in the world are the same instrument.'
    },
    {
        id: 'dao-ground-counting-floor',
        name: 'The Counting Floor',
        regionId: 'region-low-fall',
        domain: 'karma',
        subject: 'debt',
        fromOrdinal: 20,
        access: 'held',
        heldBy: 'house-ninefold-ledger',
        standingRequired: 2,
        description:
            'The room every arbitration in the province is issued out of: a stone floor scored in nine rings, with the house\'s working ledgers stacked against the walls in the order they were closed rather than by date. Six centuries of who owed what to whom, and what happened to them afterwards.',
        what:
            'Reading the closed ones. The house does not teach karma and says so; it hands a member the shelf and lets them find out for themselves that the debts which were paid and the debts which were forgiven produced different descendants, reliably, for six hundred years.'
    },
    {
        id: 'dao-ground-hour-room',
        name: 'The Hour Room',
        regionId: 'region-low-fall',
        domain: 'time',
        subject: 'duration',
        fromOrdinal: 24,
        access: 'held',
        heldBy: 'house-narrow-hour',
        standingRequired: 3,
        description:
            'A windowless chamber under the house seat in which one hour takes a measurably different length of time to pass than it does outside, by an amount the house has recorded daily for eight hundred years and has never been able to change. The record is the holding; the room is only where it is kept.',
        what:
            'Sitting in it with the water clock. What is comprehended is not that time can be stretched - it cannot, and the house is emphatic - but that a duration is a relation between two things and there is no third thing to appeal to.'
    },
    {
        id: 'dao-ground-under-stair',
        name: 'The Under-Stair at Nine Peaks',
        regionId: 'region-low-fall',
        domain: 'body',
        subject: 'the body under load',
        fromOrdinal: 8,
        access: 'held',
        heldBy: 'sect-nine-peaks-ascetic-order',
        standingRequired: 0,
        description:
            'The service stair cut into the vein face below the Order\'s lowest peak, eleven hundred steps of it, worn through in the middle to the depth of a hand. Everything the Order eats goes up it on somebody\'s back, twice a day, in all weather, and it has done for two centuries.',
        what:
            'Carrying. There is no instruction attached and the Order offers none. What a Stone Bearer eventually notices is that the stair has selected for a particular way of holding a load, that nobody taught it to them, and that their body arrived at it without being asked.'
    },
    {
        id: 'dao-ground-forty-one-nodes',
        name: 'The Forty-One Node Diagram',
        regionId: 'region-low-fall',
        domain: 'formation',
        subject: 'the diagram',
        fromOrdinal: 16,
        access: 'held',
        heldBy: 'sect-stonewright-consortium',
        standingRequired: 2,
        description:
            'A survey diagram of a formation nobody now living can light, cut into the floor of the Consortium\'s drafting hall at full scale because it was the only way to check the line lengths. Nine of its forty-one nodes are understood. The Consortium has never claimed otherwise and has never covered the other thirty-two.',
        what:
            'Drafting on top of it. Every apprentice line in the Consortium is laid over the diagram, so a draughtsman spends a career watching their own work fail to explain thirty-two nodes, which is a more useful education than the nine.'
    },
    {
        id: 'dao-ground-doorless-room',
        name: 'The Doorless Room',
        regionId: 'region-low-fall',
        domain: 'void',
        subject: 'absence',
        fromOrdinal: 28,
        access: 'held',
        heldBy: 'house-unlit-gate',
        standingRequired: 3,
        description:
            'A room the house has held for as long as it has been a house, with no door in it and no record of one ever being cut. It is entered, by the four people alive who can, and none of them can describe the entering afterwards in a way that survives being written down.',
        what:
            'Being let in, which is done to a member rather than by them. What is comprehended arrives on the way out and not on the way in.'
    },
    {
        id: 'dao-ground-tomb-slash-ice',
        name: 'The Cut Face',
        regionId: 'region-white-stair',
        domain: 'weapon',
        subject: 'the edge',
        fromOrdinal: 20,
        access: 'held',
        heldBy: 'sect-frostmirror-court',
        standingRequired: 2,
        description:
            'The working face of the glacier the Court dug its curriculum out of, kept open and kept cold, with the strata of four separate ages of ice standing exposed in a wall a hundred spans high. Things are visible in it that the Court has decided not to cut out.',
        what:
            'Cutting. An applicant is set to open the face by a stated depth in a stated time, and the ice answers differently at every stratum, so the edge that worked yesterday is the wrong edge today and there is no season in which it is not.'
    },
    {
        id: 'dao-ground-quiet-hall-tablets',
        name: 'The Hall of Tablets',
        regionId: 'region-low-fall',
        domain: 'life_death',
        subject: 'what is left',
        fromOrdinal: 16,
        access: 'held',
        heldBy: 'sect-lantern-hall',
        standingRequired: 1,
        description:
            'Every name the Temple has buried, on tablets, in the entrance hall rather than the interior, on purpose. Eleven thousand of them. The oldest are illegible and have not been recut, which is doctrine and is stated as doctrine.',
        what:
            'Dusting them, which is the duty of the most junior monk in the building. What is comprehended is that the illegible ones were people, that nobody remembers which, and that this was always going to happen and is not a failure of anybody\'s.'
    },

    // ── OPEN. Ground nobody holds, dealt out by province. ─────────────────
    {
        id: 'dao-ground-drowning-steps',
        name: 'The Drowning Steps',
        regionId: 'region-drowned-reach',
        domain: 'life_death',
        subject: 'the water',
        fromOrdinal: 12,
        access: 'open',
        heldBy: null,
        standingRequired: 0,
        description:
            'A flight of stone steps running down off a headland into open water, going somewhere that is no longer there. At the low tide of the year eleven of them are dry. Nobody has counted the rest and the people who have tried are the reason it is called that.',
        what:
            'Going down them. There is no trick, no formation and no guardian; the water is cold, it is deep, and it is indifferent, and a cultivator who goes far enough to have to decide to come back has been asked the question the road is about.'
    },
    {
        id: 'dao-ground-grinding-ford',
        name: 'The Grinding Ford',
        regionId: 'region-quiet-marches',
        domain: 'body',
        subject: 'wear',
        fromOrdinal: 4,
        access: 'open',
        heldBy: null,
        standingRequired: 0,
        description:
            'The crossing every cart out of the western workings has used for six hundred years, where the driven stone comes up through the streambed in ridges and the water runs fast over it. It has ground four spans of rock away in living memory and it grinds anything standing in it.',
        what:
            'Standing in it, which the quarry crews do because it is faster than going round. Nobody in the Marches thinks of this as cultivation. What it teaches is what wear is, from underneath, and the Marches produce a disproportionate number of people who cannot be worn down.'
    },
    {
        id: 'dao-ground-glass-field',
        name: 'The Glass Field',
        regionId: 'region-wide-field',
        domain: 'weapon',
        subject: 'the stroke',
        fromOrdinal: 20,
        access: 'open',
        heldBy: null,
        standingRequired: 0,
        description:
            'Nine hundred spans of ploughland fused to green glass in a single stroke, in a province with no high ground and nothing to fuse it, on a date every one of the nine cities records and none of them explains. The furrows are still visible under it. It has never been leased.',
        what:
            'Walking it. The stroke is legible in the glass from end to end - where it began, where it was going, and that it did not stop where it stopped because it ran out. A cultivator with a weapon reads their own hand in it and finds it small.'
    },
    {
        id: 'dao-ground-slow-bell',
        name: 'The Slow Bell',
        regionId: 'region-white-stair',
        domain: 'time',
        subject: 'the interval',
        fromOrdinal: 24,
        access: 'open',
        heldBy: null,
        standingRequired: 0,
        description:
            'A bronze bell in the ice above the highest holding, struck once by the ice moving and not again for between four and nine years. Nobody rings it. Three separate parties have tried and it does not sound when it is struck by a person.',
        what:
            'Waiting for it, which people do for years and mostly in vain. What is comprehended is arrived at during the waiting rather than at the stroke, and everybody who has got anything out of it says so and is not believed.'
    },
    {
        id: 'dao-ground-blown-hollow',
        name: 'The Hollow Between the Arms',
        regionId: 'region-low-fall',
        domain: 'void',
        subject: 'the gap',
        fromOrdinal: 24,
        access: 'open',
        heldBy: null,
        standingRequired: 0,
        description:
            'A surfacing in the Blown Ground that has stayed open longer than any other on record - eleven years and counting - and has nothing in it. Not thin qi: none, in a pocket eight spans across, in the middle of the richest unheld vein in the world. It moves like the rest of the ground and it has not closed.',
        what:
            'Standing in the eight spans, which can be done for about forty breaths. It is the only place anybody can go where there is nothing, and forty breaths of nothing is more instruction in the road than any amount of reading about it.'
    },
    {
        id: 'dao-ground-nine-city-assize',
        name: 'The Nine-City Assize',
        regionId: 'region-wide-field',
        domain: 'karma',
        subject: 'the lease',
        fromOrdinal: 16,
        access: 'open',
        heldBy: null,
        standingRequired: 0,
        description:
            'The open court the nine cities hear leasehold disputes in, sitting eleven months of the year in whichever city is least offended by the last ruling. Anybody may attend and most people do, because in a province where every institution holds a lease, every ruling is about everybody.',
        what:
            'Attending. Four hundred years of rulings are read out from the roll before each sitting, and it becomes impossible to sit through many of them without noticing that what a party did nine decades ago is doing the work that their argument today is not.'
    },
    {
        id: 'dao-ground-fired-terraces',
        name: 'The Fired Terraces',
        regionId: 'region-quiet-marches',
        domain: 'alchemy',
        subject: 'what heat leaves',
        fromOrdinal: 24,
        access: 'open',
        heldBy: null,
        standingRequired: 0,
        description:
            'The abandoned refining terraces of the last western house that could work the driven stone, forty of them stepped up a hillside, every crucible still seated and every one of them cracked in the same place. The house did not fail; it ran out of stone and left, and nobody has been back for the equipment because there is nothing wrong with it.',
        what:
            'Looking at forty identical cracks. The failure is in the method rather than the vessel, it took the house two centuries to arrive at that method, and it is written down nowhere - so what the terraces teach is the thing the house never learned, which is the useful half.'
    },

    // ── BURIED. Roads that teach nobody until somebody digs. ──────────────
    {
        id: 'dao-ground-unwritten-register',
        name: 'The Unwritten Register',
        regionId: 'region-wide-field',
        domain: 'formation',
        subject: 'the unlit line',
        fromOrdinal: 24,
        access: 'buried',
        heldBy: null,
        standingRequired: 0,
        description:
            'A survey office of an age that ended, under nine spans of flood silt in the east of the province, holding the working register of a formation network that covered ground the Wide Field no longer has a name for. The register was never finished. The unfinished part is the part that is legible.',
        what:
            'Reading a draughtsman\'s working notes rather than their result, which nobody in the world does because working notes are not kept. The corrections are on the page, in order, and it is possible to watch somebody arrive at a line.'
    },
    {
        id: 'dao-ground-salt-hall',
        name: 'The Salt Hall',
        regionId: 'region-drowned-reach',
        domain: 'void',
        subject: 'what the water is standing on',
        fromOrdinal: 20,
        access: 'buried',
        heldBy: null,
        standingRequired: 0,
        description:
            'A pillared hall on the seabed four days out, upright, roofed, and standing on nothing - there is no rock under the Reach and there is none under this either. Whatever it was built on is not there and the hall has not fallen.',
        what:
            'Getting to the floor of it and looking down through the joints. The Reach\'s whole governing fact is that there is no ground, and the hall is the one object in the world that argues with it, from the wrong side.'
    },
    {
        id: 'dao-ground-frozen-assay',
        name: 'The Frozen Assay',
        regionId: 'region-white-stair',
        domain: 'alchemy',
        subject: 'the interrupted run',
        fromOrdinal: 20,
        access: 'buried',
        heldBy: null,
        standingRequired: 0,
        description:
            'An assay room taken by the ice mid-run, with every crucible still seated, every fire long out, and the whole of one refinement stopped at whatever stage it had reached. Eleven vessels, eleven different stages, one recipe.',
        what:
            'Reading eleven crucibles as eleven frames of the same process, which is the one thing no living alchemist can do - a refinement is watched from outside a sealed vessel and inferred, and here it is simply open.'
    },
    {
        id: 'dao-ground-struck-terrace',
        name: 'The Struck Terrace',
        regionId: 'region-low-fall',
        domain: 'life_death',
        subject: 'what the lightning left',
        fromOrdinal: 28,
        access: 'buried',
        heldBy: null,
        standingRequired: 0,
        description:
            'A terrace under the gorge scree where a tribulation came down on a person who did not survive it, long enough ago that the province has forgotten which. The lightning took nearly everything they were carrying, which is the ordinary rule, and it did not take the terrace, and the terrace is what is worth having.',
        what:
            'Standing where they stood. What is on the stone is the shape of somebody in the last moment of holding something they could not hold, at a scale a living cultivator will not otherwise see, and it is not survivable to look at below Void Refinement.'
    },

    // ── CARVING. Three worked faces, and nobody cut them for a reader. ────
    //
    // `docs/world/climbing/immortals.md` is the authority and it is unusually specific.
    // The living False Immortal is on the third path, has not done the durable
    // carving because he still has students, and what exists instead is
    // RESIDUE: "a lecture needs a surface, he works on whatever is there, and
    // he does not take the stone away afterwards. Three faces exist, in the
    // ordinary hand, cut for people who were in the room and had it shown to
    // them first. A later reader gets the surface an afternoon was worked out
    // on without the afternoon, from an author who is still alive and could
    // simply have been asked, and pays the whole of what reading costs."
    //
    // So: three, not four and not a set. Ordinary hand rather than the
    // compressed one, because these were not written to outlast anybody. The
    // price is the FLOOR, which is the highest in this file, and not the years
    // - reading is cheap and being able to read it at all is not.
    //
    // They are in three provinces that do not connect, which is not a
    // flourish: the register cannot establish whether the sightings behind
    // them are one existence or four in sequence, and three unlinked faces is
    // what that looks like from the ground.
    //
    // Nothing about these rows is bespoke. Same schema, same seeding, same
    // `daoGroundsInReachOf`, same `RoadWithinReach`. Take the author away and
    // they are three cliffs with working on them.
    {
        id: 'dao-carving-the-rain-face',
        name: 'The Rain Face',
        regionId: 'region-white-stair',
        domain: 'void',
        subject: 'the seam',
        fromOrdinal: 28,
        access: 'carving',
        heldBy: null,
        standingRequired: 0,
        description:
            'An overhang two days above the last village on the stair, worked across about eleven paces of dry rock in a single afternoon and never touched since. The hand is unhurried and completely ordinary, the way a man writes when the person he is explaining to is standing next to him, and it stops mid-argument because the argument was finished out loud.',
        what:
            'Reading it. What is on the rock is one person describing the boundary from the far side of it, to somebody who had already been shown what he meant, so a later reader gets the notation without the afternoon. Below Deity Transformation there is nothing there but weathering; above it there is a great deal there and none of it is addressed to you.'
    },
    {
        id: 'dao-carving-the-counted-wall',
        name: 'The Counted Wall',
        regionId: 'region-quiet-marches',
        domain: 'time',
        subject: 'a span you can count',
        fromOrdinal: 32,
        access: 'carving',
        heldBy: null,
        standingRequired: 0,
        description:
            'The inner face of a drainage cut behind an abandoned holding, carrying a single running figure worked down its length and revised eleven times, each revision smaller than the last. Nobody local can read it and everybody local knows it is there. It has been variously explained as a tax record, a flood mark and a curse.',
        what:
            'Working out what is being counted. It is a remaining span, revised as it was recalculated, by somebody who knows his own to the year and gives the figure to anybody who asks - and the thing that teaches is not the number but that it was worth revising eleven times. A cultivator below Void Refinement has no span worth the arithmetic and reads a list of numbers.'
    },
    {
        id: 'dao-carving-the-unfinished-side',
        name: 'The Unfinished Side',
        regionId: 'region-wide-field',
        domain: 'life_death',
        subject: 'coming back short',
        fromOrdinal: 36,
        access: 'carving',
        heldBy: null,
        standingRequired: 0,
        description:
            'A field boundary stone, on the side that faces away from the road, worked over about a day and a half by somebody who then left the district. Two thirds of it is a careful account of a thing that did not complete. The last third is the same account started again from a different place and abandoned, and the abandonment is legible.',
        what:
            'Reading both attempts and seeing why the second one stopped. It is the only first-hand description in the world of an ending that did not finish, from the only person it has happened to who is still walking around, and what it teaches is what the shortfall consists of rather than how to avoid it. Nothing below Body Integration has anything to compare it to.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// ACCESSORS
// ─────────────────────────────────────────────────────────────────────────

export function getPlaceThatTeachesADao(id: string): PlaceThatTeachesADao | undefined {
    return PLACES_THAT_TEACH_A_DAO.find(p => p.id === id);
}

/** Every ground a house controls. Empty for almost every house in the world. */
export function daoGroundsHeldBy(factionId: string): PlaceThatTeachesADao[] {
    return PLACES_THAT_TEACH_A_DAO.filter(p => p.heldBy === factionId);
}

/** Every ground in a province, whoever holds it. */
export function daoGroundsIn(regionId: string): PlaceThatTeachesADao[] {
    return PLACES_THAT_TEACH_A_DAO.filter(p => p.regionId === regionId);
}

/**
 * The ground a free-text place name refers to, if it refers to one.
 *
 * Loose on both sides, and it has to be: a player's `location` is free text,
 * the parser strips a leading article off what they typed, and every name in
 * this file begins with one. A strict compare answers "not a dao ground" for
 * every dao ground in the world the moment somebody actually stands on one.
 */
export function daoGroundNamed(name: string | null | undefined): PlaceThatTeachesADao | undefined {
    const wanted = loosely(name ?? '');
    if (wanted.length === 0) return undefined;
    return PLACES_THAT_TEACH_A_DAO.find(p => loosely(p.name) === wanted);
}

function loosely(name: string): string {
    return name.toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
