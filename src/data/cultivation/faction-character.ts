/**
 * Faction character - the retroactive distinctness pass.
 *
 * An alignment, a rank ladder and a rivalry list produce factions that are
 * technically populated and completely interchangeable. This file is the fix,
 * applied to every faction in the catalog including the three in the Quiet
 * Marches. Each entry carries:
 *
 *   practice          what an outsider sees in the first ten minutes
 *   grievance         what they believe was taken from them
 *   fear              what they are quietly afraid of
 *   lateness          which fraction of their inheritance still works
 *   disagreement      the internal split, because a faction that agrees with
 *                     itself is scenery
 *   wrongAbout        something held with total confidence that is false, and
 *                     traceable
 *   unitOfValue       what they actually count, which changes every
 *                     negotiation they enter
 *   production        what they can reliably turn out, versus what they once
 *                     could - see below
 *   distinctSentence  the faction test, written down: one sentence that could
 *                     not be said about anything else in the catalog. The
 *                     catalog test asserts these are unique.
 *
 * PRODUCTION IS THE REAL PRESTIGE METRIC
 * --------------------------------------
 * `powerOrdinal` on the sect entry says who its strongest member is.
 * `production` says what it can reliably turn out, and the two answer
 * different questions:
 *
 *   - Production decays with the vein. A sect that loses its ground keeps its
 *     old strong members for a century and loses its pipeline in a generation.
 *   - One ancient elder and no pipeline reads nothing like no elder and a
 *     strong pipeline, and `powerOrdinal` cannot tell them apart.
 *   - It explains recruitment. A sect that can no longer produce Core
 *     Formation has to buy one, and that is a motive.
 *
 * The gap between `powerOrdinal` and `production.reliableOrdinal` is therefore
 * characterful on its own: a sect whose strongest member stands four realms
 * above anything it can still produce is living on inheritance, and the data
 * should say so without anyone writing it in prose.
 *
 * THE GAP IS A RESOURCE STATEMENT, NOT A TEACHING ONE
 * ---------------------------------------------------
 * A house standing at 36 that can only produce 28 has the books and it has the
 * master. What it does not have is the pills and the comprehension materials -
 * which DO exist in this world today, and which somebody else can get. Its own
 * 36 had to reach that peak by their own means. So the gap is a motive, and it
 * is why a house buys, digs, marries, allies and occasionally goes to war.
 *
 * Which constraint a house is actually under is diagnosable rather than
 * asserted: compare `reliableOrdinal` against the cap of the best cultivation
 * manual the house teaches (`productionConstraint` below takes that cap as an
 * argument rather than importing it, so the two catalogs stay uncoupled).
 * `reliable == the shelf` is a MANUAL-limited house - it delivers everything
 * its books can. `reliable < the shelf` is a RESOURCE-limited house - it owns a
 * book it cannot walk anybody to the end of.
 *
 * NOT EVERY HOUSE IS IN DECLINE. THIS WAS MEASURED AND IT WAS WRONG.
 * -----------------------------------------------------------------
 * `scripts/probe-production.ts` reported thirty-two of thirty-two houses with
 * their peak behind them, at a mean gap of twelve rungs. A universal decline is
 * not a setting; it is a mood applied uniformly, and it made the genuinely
 * declining houses unremarkable. The axis now carries five states, and every
 * one of them is readable off the numbers by `productionState` below - the
 * `note` explains the state, it never creates it:
 *
 *   declining     `peak > reliable`. It lost access to something it used to
 *                 source. Still the large majority, because this IS a late age.
 *   at-peak       `reliable == peak`, below `powerOrdinal`. As good as it has
 *                 ever been. Its strongest member is not its own product.
 *   complete      `reliable == peak == powerOrdinal`. It takes people all the
 *                 way to the end of its book, every time, and there is nowhere
 *                 further inside it - so its best eventually have to leave.
 *   ascending     `climbingToward` is set and `waitingOn` is not 'time'.
 *                 Something changed about what it can SOURCE, and it is
 *                 working toward a stated target that could still be taken
 *                 back. The rare one, and the one that did not exist at all.
 *   well-stocked  `climbingToward` is set and `waitingOn` is 'time'. It already
 *                 has the material its own method needs, in quantity, and has
 *                 not had the generations. Nothing is wrong with this house.
 *                 It is also a target, because everybody knows where the
 *                 stores are.
 *
 * The two moving states are authored under one rule: the reasons must not
 * repeat. Two ascending houses ascend for unrelated reasons and two declining
 * houses lost different things, which is the same standard the catalog test
 * already holds `distinctSentence` to.
 */

/**
 * What a faction can turn out, as opposed to what it happens to contain.
 * All ordinals are on the one shared ladder.
 */
import { TRUE_IMMORTAL_ORDINAL } from '../../engine/cultivation/realms.js';

export interface ProductionTier {
    /** Highest ordinal it can currently produce reliably, from its own intake. */
    reliableOrdinal: number;
    /** Roughly how many members it currently has at or above that. */
    currentCount: number;
    /** Highest ordinal it has ever produced, across its whole history. */
    peakOrdinal: number;
    /** How many it produced at that peak, ever. Usually one or two. */
    peakCount: number;
    /** Years since it last produced anyone at the peak ordinal. Zero means now. */
    yearsSinceLastPeak: number;
    /**
     * The ordinal it is working toward TODAY, where it is working toward one.
     *
     * Absent for most of the catalog, which is not going anywhere. Present only
     * where the house could name the target and something specific has already
     * happened to put it in reach - and where `note` says both what changed and
     * what would take it back, because an ascent that cannot be lost is a
     * status rather than a story.
     */
    climbingToward?: number;
    /**
     * What stands between the house and `climbingToward`, and therefore what
     * has to be attacked to stop it. Absent when it is not climbing.
     *
     *   'access'  It has the years and lacked the material, and something
     *             changed about what it can source - ground taken, a supplier
     *             bought, a patron paying, a route it now carries. Reversible,
     *             always, which is the whole of the interest.
     *   'time'    It already holds the material its own method needs, in
     *             quantity, and simply has not had the generations. Patient
     *             rather than anxious, and a target for exactly that reason.
     *   'shelf'   It has the years and the material and is short a book.
     */
    waitingOn?: 'access' | 'time' | 'shelf';
    note: string;
}

/**
 * The outside view, and the gap between it and the inside one.
 *
 * Reputation is not a summary of capability. It fixes on whatever is most
 * legible from the road - a mannerism, a shopfront, a price, a quarrel - and
 * then stops updating, so what a faction is known for is reliably not what it
 * is actually best at. The gap is usable in both directions: a player who
 * hires the reputation gets the wrong thing, and a player who has worked out
 * the reality is holding something almost nobody else has bothered to learn.
 */
export interface KnownFor {
    /** What people two provinces away would say they are. */
    outside: string;
    /** What they are actually best at, which is rarely the same. */
    actuallyGoodAt: string;
    /** Why the two came apart, and stayed apart. */
    theGap: string;
}

export interface FactionCharacter {
    practice: string;
    /** Reputation versus capability. See {@link KnownFor}. */
    knownFor: KnownFor;
    /**
     * Present only where the faction has quietly stopped doing the thing it is
     * defined by, and has not noticed or will not say. Not a failure state:
     * an institution coasting on a practice it no longer performs is one of
     * the more honest shapes in this catalog.
     */
    quietlyStopped?: string;
    grievance: string;
    fear: string;
    lateness: string;
    disagreement: string;
    wrongAbout: string;
    unitOfValue: string;
    production: ProductionTier;
    distinctSentence: string;
}

export const FACTION_CHARACTER: Record<string, FactionCharacter> = {
    // ═══════════════════════════════════════════════════════════════════
    // THE TWO THAT CANNOT BE JOINED
    //
    // Added because the gap was load-bearing rather than cosmetic. Every other
    // faction in this file has a `unitOfValue` - what it actually counts, which
    // is what decides every negotiation it enters - and the two ancient apexes
    // had none. That is precisely the question somebody has about an
    // institution they can never be a member of: not how strong is it, which is
    // published, but what does it want and what would it take.
    //
    // Neither has a rank ladder a player can climb, an admission bar, or a door.
    // What they have is a thing they count, and it is not the same thing.
    // ═══════════════════════════════════════════════════════════════════

    'apex-deep-survey': {
        knownFor: {
            outside: 'Nothing, to almost everybody. Below a certain height the Survey is not a name people decline to say, it is a name they have never heard - and what they have instead is the sense that boundary disputes in some provinces end faster than they should.',
            actuallyGoodAt: 'Being unable to be lied to about where anything is, and having been so for nine hundred years without interruption. Every arterial figure in the region descends from a measurement it took and has never had to retake.',
            theGap: 'It is the strongest institution in the world at the thing nobody experiences as strength. A house that wins arbitrations it does not attend leaves no impression at all on the people it beats, which is why its reputation is smaller than the Pavilion\'s and its position is not.'
        },
        practice: 'Everything is minuted, including refusals, including the refusals of Surveyors who give no reason. The register is read by successors and the Survey behaves accordingly: it does not act in a way it would be embarrassed to have written down, which outsiders read as caution and is closer to vanity.',
        grievance: 'That two of its administrations left for the Long Cut in living memory, and that it has not been able to think of a reply to either that would not concede the point.',
        fear: 'Being made to attend something. The whole position rests on one person not standing up, and every year that nothing requires her to is a year the arrangement was not tested.',
        lateness: 'Constitutionally. It arrives after everything, by design, because a body that measures cannot also be a body that hurries - and it has never once been early to anything in nine hundred years.',
        disagreement: 'Whether the standing stock exists to be spent. Two Surveyors hold that an unreorderable line item is a thing you keep; two hold that a thing never spent is a thing you do not have. The register records that the question has been raised eleven times and settled none.',
        wrongAbout: 'That its silence is read as composure. A substantial minority of the province reads it as having no answer, and the Survey has no instrument that could tell it which.',
        unitOfValue:
            'The datum. What the Survey counts is whether a figure it published is still true, and nothing else converts into that - not stones, not standing, not a favour, not a life. It cannot be paid, and this is the single most useful thing to know about it: a petitioner offering anything at all has already misunderstood the room. What it can be given is a correction, and the only people who have ever moved the Survey are the ones who arrived holding a measurement it had got wrong.',
        production: {
            reliableOrdinal: 37,
            currentCount: 4,
            peakOrdinal: 46,
            peakCount: 3,
            yearsSinceLastPeak: 1_900,
            note: 'Three crossings in three thousand years, the most recent nineteen hundred years ago, and the Survey files each of them under the district they worked rather than under the crossing. It produces Grand Ascension reliably and has never once treated that as the point.'
        },
        distinctSentence: 'It has won four hundred years of arbitrations it never had to attend, and the reason is not procedural.'
    },

    'apex-long-cut': {
        knownFor: {
            outside: 'Driven ground, to the few who know the term at all - and the term is doing a great deal of work, because most of the province could not say what was driven or by whom.',
            actuallyGoodAt: 'Making ground refuse to move, which is worth nothing in a market and everything in a fight. And taking in other people\'s administrations without appearing to have done anything.',
            theGap: 'Its two most consequential acquisitions in living memory both walked in on their own, so there is nothing for the province to have witnessed. A house that gains by being the better option leaves no story behind it.'
        },
        practice: 'Four titles cover every practitioner in every driven province, ranked by work and nothing else, so a Hand may be an apprentice of nineteen or an Inner Face cultivator of four hundred. Carvers consider this obvious. Every visiting Drawn cultivator finds it insulting, and the Long Cut has never adjusted for a visitor.',
        grievance: 'That the Deep Survey has never once referred to either defection in correspondence, which denies the Long Cut the acknowledgement that would make them mean something.',
        fear: 'That the two courts it took will discover they dislike each other more than either dislikes the Survey. One left over a grant book and one over a name, and neither rates the other\'s reason.',
        lateness: 'Never, and it is not a virtue. The Nail cannot be moved, so the Long Cut is already wherever it is going to be, and everything it does has the flat quality of a thing that did not have to travel.',
        disagreement: 'Whether taking in the Root Sill was a gain or a precedent. It acquired a forty-four and a body of people who have proved they will walk out of an arrangement they dislike, and nobody senior has said the second half out loud.',
        wrongAbout: 'That its rank ladder is read as egalitarian. Outside the driven provinces it is read as an institution that cannot be negotiated with, because there is no rung to appeal to and no title that means seniority.',
        unitOfValue:
            'Work done on the ground, counted in courses cut and faces held. Everything else is invisible to it - a stone offered to the Long Cut is not refused so much as not understood as an offer, and standing acquired anywhere else does not transfer at the border. It can be paid, which makes it the more approachable of the two, but only in the one currency: turn up and do the work, for as long as it takes, and be counted. Nineteen years and four hundred are both acceptable answers to how long.',
        production: {
            reliableOrdinal: 38,
            currentCount: 40,
            peakOrdinal: 46,
            peakCount: 2,
            yearsSinceLastPeak: 2_600,
            note: 'Two crossings, both twenty-six hundred years ago and both on driven ground, and nothing since. Forty posted staff with an unusually even distribution and no prodigies at all - the Long Cut produces competence at a rate nobody matches and has not produced a crossing in an age.'
        },
        distinctSentence: 'Its whole position is a siege it has been winning by default for so long that the staff treat the seat as geography rather than as a garrison.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // LOW FALL - RIGHTEOUS
    // ═══════════════════════════════════════════════════════════════════
    'sect-azure-cloud-pavilion': {
        knownFor: {
            outside: 'The sword sect. Flying blades, the tournament, an admission day worth travelling for, and being condescended to by somebody of nineteen.',
            actuallyGoodAt: 'Two things nobody outside sees. It can certify that a person is who they say they are, permanently and without appeal, which is why every ledger and court in the region has to deal with it - and it runs the only programme in the world that takes uncultivated mortals and spends years finding out what they are.',
            theGap: 'Both of its real capabilities happen indoors. The courtyard is where the swords are, so the swords are what the province talks about.'
        },
        practice: 'Disciples stand when a sword is drawn anywhere in earshot, including in a kitchen, and their right forearms are visibly heavier than their left from flying on the blade.',
        grievance: 'That the province treats its deference as owed to a dead woman rather than earned by the Pavilion, and repeats the joke about renting her.',
        fear: 'That the Standing Edge is a finite object, and that the year it is spent is the year the Pavilion becomes an ordinary sect with an unusually good gorge.',
        lateness: 'Nine of forty-one nodes lit; the practice yard cut for six hundred holds ninety; and the sequence of Ru Anjing\'s divestment is recorded in a hand three Sword Elders can no longer fully read.',
        disagreement: 'The Sword Elders want the Edge drawn once in this generation to re-establish what it means. The Pavilion Master holds that its meaning is entirely a function of not drawing it.',
        wrongAbout: 'It teaches that Ru Anjing\'s two words were an instruction to wait for a specific event. The offering record shows the words were answered to a question about a border dispute nobody now remembers asking.',
        unitOfValue: 'Deference. The Pavilion keeps no ledger of favours and an exact mental account of who stood up.',
        production: {
            reliableOrdinal: 17, currentCount: 6, peakOrdinal: 44, peakCount: 2, yearsSinceLastPeak: 380,
            note: 'Reliably turns out Core Formation and has not produced above Nascent Soul in three centuries. Its standing is entirely inherited and the gap is visible in the data.'
        },
        distinctSentence: 'The only institution in the world holding a parting gift from the last confirmed crossing, and it has refused itself permission to draw it nine times.'
    },
    'sect-verdant-spring-hall': {
        knownFor: {
            outside: 'Medicine. The place you are carried to, the only sect that will look at you without asking whose side you were on.',
            actuallyGoodAt: 'Collections. The Hall holds the largest book of unpaid obligations in the province, never writes one off, and can call on a startling number of people who would rather not be reminded why.',
            theGap: 'Nobody thinks of a physician as a creditor until the bill arrives, and by then they are already the sort of person who owes them.'
        },
        practice: 'Physicians keep their fingernails cut to the quick and their sleeves pinned back at all times, and will treat an enemy on the floor of a fight before asking who started it.',
        grievance: 'That it was a hermitage of nine people once, holding its valley by respect and nothing else, and chose to grow - and that the Standing Grove, which refused the same choice, is spoken of the way the Hall used to be.',
        fear: 'That the Bone Lantern Cult is right that the dead are a resource, and that the Hall\'s objection is sentiment rather than medicine.',
        lateness: 'Fourteen of twenty-two nodes lit; the stone irrigation channels are original and get patched with clay; and the rank of Life Elder retains a ceremonial duty at the springs that nobody can explain.',
        disagreement: 'The billing faction wants enemies treated and charged at triple. The physicians want them treated and charged the same, on the argument that a price is a diagnosis of who you think somebody is.',
        wrongAbout: 'The Hall teaches that Lu Wan wrote the restoration method. The valley ruin it came out of predates Lu Wan by six hundred years and the Hall\'s own founding record says "recovered".',
        unitOfValue: 'Unpaid bills. The Hall\'s real ledger is who owes it for treatment, and it never writes one off.',
        production: {
            reliableOrdinal: 20, currentCount: 4, peakOrdinal: 26, peakCount: 3, yearsSinceLastPeak: 120,
            climbingToward: 26, waitingOn: 'access',
            note: 'Climbing, and what changed is not the ground but what a debt can be settled in. The Hall has begun taking old bills in herb stock and comprehension materials instead of stones, which is the first time the largest book of unpaid obligations in the province has been convertible into anything a disciple can use, and on that it can put a physician back into Deity Transformation. What would end it: the houses able to pay in kind are the same houses whose injured it treats at cost, and it has already stopped doing that in two of four dispensaries without saying why.'
        },
        distinctSentence: 'The only sect that treats its enemies on the floor where they fell and then bills them, and has outlived four sects that thought this was weakness.'
    },
    'sect-nine-peaks-ascetic-order': {
        knownFor: {
            outside: 'The stone. Three counties tell the same joke about ascetics setting rocks down on tables, and the joke is affectionate and slightly contemptuous.',
            actuallyGoodAt: 'The best pipeline in the province, because the deepest vein anybody has kept is under them and they have refused for two centuries to lease a foot of it.',
            theGap: 'The stone is visible from the road and the vein is not. It is very hard to be frightened of somebody carrying a rock.'
        },
        practice: 'Ascetics carry a stone at all times, of a size chosen at admission and never changed, and set it down only to sleep - so a conversation with one includes the sound of a rock being placed on a table.',
        grievance: 'That every other institution in the province regards their vein as an accident of geography rather than a two-century refusal to lease it.',
        fear: 'That Meng Da is still alive somewhere in the workings, and that the Order has spent eight hundred years not sealing the entrance because it does not want to find out.',
        lateness: 'Eleven of sixty-three nodes lit, and the Order admits it does not know what forty of the others were for - it maintains them anyway, unlit, on the reasoning that somebody meant them.',
        disagreement: 'The Peak Wardens want the workings surveyed and Meng Da resolved. The Mountain Elders hold that the workings are the vein and the vein is not to be entered, which is doctrine dressed as caution.',
        wrongAbout: 'It holds that carrying the stone builds the body. Its own intake records show the stone selects for people who will do a pointless thing for years, which is a different and more useful filter.',
        unitOfValue: 'Years of service. Rank, grain and vein access are all counted in seasons carried, and stones are treated as an administrative nuisance.',
        production: {
            reliableOrdinal: 21, currentCount: 5, peakOrdinal: 28, peakCount: 4, yearsSinceLastPeak: 90,
            climbingToward: 28, waitingOn: 'time',
            note: 'The best pipeline in the province, because the vein under it is the deepest anyone has kept, and nothing here is short except years. It is the one house in the catalog not waiting on a supplier - it is waiting on people to have carried the stone long enough, because its own rule prices every rung in seasons served and that cannot be paid faster. Which makes it the most obvious target in the province: everybody knows where the stores are, and that they have never been assayed.'
        },
        distinctSentence: 'Sits on the richest vein in the province and has refused for two centuries to lease a foot of it, while maintaining forty formation nodes it cannot light and will not remove.'
    },
    'sect-clear-river-alliance': {
        knownFor: {
            outside: 'Boats. The people who will get anything across anything, and who probably know where the smuggling routes are because several of them are the smuggling routes.',
            actuallyGoodAt: 'Knowing who went where and when. A ferryman is told things nobody would tell a magistrate, and the Alliance has a hundred and forty years of it, distributed across every landing on the water.',
            theGap: 'The Alliance has never once thought of this as intelligence. It is simply what everybody at a crossing already knows, and nobody has ever tried to sell it.'
        },
        quietlyStopped: 'Surveying. Half its river-charts are copies of a survey two ages old, the copies are still better than anything the Alliance has produced since, and at some point in the last century it stopped attempting new ones. Nobody decided this. The last man who could take a proper sounding died, his apprentice took a landing instead, and the charts have been getting copied rather than made ever since.',
        practice: 'Members are recognisable by the tar on their palms from boat rope, and greet each other by naming a ford - "Third, this spring" - rather than by name.',
        grievance: 'That the Thousand Treasure Pavilion prices tolls on routes the Alliance keeps open, and calls this commerce.',
        fear: 'That the ferry trade is what the Alliance is, and that a Measured Span station at Scarwater would end it in a decade.',
        lateness: 'Five of eight nodes lit, all of them on piers; half the river charts are copies of a survey two ages old and more accurate than anything the Alliance has produced since.',
        disagreement: 'The Ford Masters want to federate the Marches border road and become a regional carrier. The River Elders hold that the Alliance is river people and will drown on land.',
        wrongAbout: 'It believes its pier pilings at Scarwater are Alliance work from three centuries back. They are two ages older than the Alliance and are the reason that ford has never moved.',
        unitOfValue: 'Crossings owed. A debt here is discharged by carrying somebody, and the Alliance will accept nothing else from its own.',
        production: {
            reliableOrdinal: 13, currentCount: 9, peakOrdinal: 24, peakCount: 1, yearsSinceLastPeak: 300,
            climbingToward: 17, waitingOn: 'access',
            note: 'Wide, shallow, no vein - and moving for the first time in three centuries, on wagons rather than water. Three Ford Masters have run an unlicensed carrying service to Scarwater for six years and remit a share in kind, so eleven landings now handle bonded refining stock instead of ferry fares, which is enough to put boat hands into Core Formation. It turns on two things the Alliance does not control: the River Elders continuing not to establish what the wagons are, and Scarwater staying a ford rather than becoming a Measured Span station.'
        },
        distinctSentence: 'A federation of ferrymen who learned to fight, who settle internal debts in river crossings rather than stones, and whose oldest asset is a pier they did not build.'
    },
    'sect-sweptground-temple': {
        knownFor: {
            outside: 'Charity. The place that takes beggars and muddled roots, spoken of warmly by people who have never sent it anything and used as a byword for hopelessness by three of the richer sects.',
            actuallyGoodAt: 'Producing working cultivators out of intake every other institution has already refused, on thin ground, with six nodes and no vein. Measured as a return on what it is given, it is the most effective sect in the province by a distance nobody has calculated.',
            theGap: 'It keeps no accounts at all, so nobody has ever seen the figure - including the Temple.'
        },
        practice: 'Monks eat standing, from a single bowl, and will not accept a gift of ground - four separate sects have tried to endow them and all four endowments were returned intact.',
        grievance: 'None stated, which the province finds unnerving; pressed, the Abbot says the Temple was given the thing it needed two and a half thousand years ago and has no further claim on anybody.',
        fear: 'That the First Abbot\'s crossing is not true, and that four centuries of poor people have been told a comfortable thing.',
        lateness: 'Six nodes, all lit, all cut by the Temple itself, and all weak - it is the only complete working formation in the province and it is a beginner\'s diagram.',
        disagreement: 'The younger monks want the claim submitted to the Ninefold Ledger for certification. The Abbot refuses on the grounds that a certified ancestor would change who applies at the gate.',
        wrongAbout: 'It teaches that the First Abbot gave everything away to people rather than the Temple as a lesson about attachment. The likelier reading of the founding record is that the Temple did not exist yet.',
        unitOfValue: 'Nothing. The Temple keeps no accounts at all, which makes it impossible to negotiate with and is the single most frequent complaint against it.',
        production: {
            reliableOrdinal: 13, currentCount: 11, peakOrdinal: TRUE_IMMORTAL_ORDINAL, peakCount: 1, yearsSinceLastPeak: 2_600,
            note: 'The starkest gap in the catalog: it produced the one crossing in its records and now reliably turns out Foundation Establishment on swept ground, from intake nobody else would accept.'
        },
        distinctSentence: 'The poorest institution in the province, sitting on ground it chose for having no vein, holding a true claim to an ancestor that nobody believes and that buys it nothing.'
    },
    'sect-lantern-hall': {
        knownFor: {
            outside: 'Bad news. The ones who write down what a crossing took from you and then publish it, and who will do this whether or not anybody asked.',
            actuallyGoodAt: 'The only systematic record in the world of what boundaries actually take. If you want to know what you are likely to lose before you reach a boundary, they are the only party alive who can tell you, and they will do it for free.',
            theGap: 'Being right in an unwelcome way is socially indistinguishable from being morbid, and the Hall has never once tried to be liked.'
        },
        practice: 'Keepers carry a wax tablet and write during conversations without asking, and they will read a cultivator their own crossing ledger unprompted, which is why they are rarely invited twice.',
        grievance: 'That the world calls what the crossings take "the price" and considers the matter closed.',
        fear: 'That the counter-register is a comfort rather than a remedy, and that writing a name down does not in fact keep it.',
        lateness: 'Seventeen of thirty nodes lit; roughly one register in forty from the third age is illegible from damp, and the stack rooms flood on a schedule the Hall has never fixed.',
        disagreement: 'The Keepers of Names want the registers opened to anyone. The Warden-General holds that an open register is an inventory for the House of Held Names and the Quiet Cut alike.',
        wrongAbout: 'The Hall holds that its counter-register is independent of the House of Held Names. Nine of its nine city stack rooms were originally House buildings, and the House still holds the leases.',
        unitOfValue: 'Names on a wall. The Hall measures its own worth by how many it has recorded, and states the figure the way other sects state their vein depth.',
        production: {
            reliableOrdinal: 21, currentCount: 3, peakOrdinal: 31, peakCount: 2, yearsSinceLastPeak: 210,
            note: 'Produces steadily but slowly, because archivists cultivate on the margins of the working day and the Hall considers that the correct trade.'
        },
        distinctSentence: 'Writes down what the crossings take from other people, publishes it against their wishes, and is correct in a way that has made it unwelcome in nine cities.'
    },

    'sect-standing-grove': {
        knownFor: {
            outside: 'Six harmless recluses in a valley who settle arguments for nothing, and who are talked about the way one talks about a pleasant local custom.',
            actuallyGoodAt: 'Deterrence with no infrastructure at all. Eleven days of country stays quiet on nothing but a belief, and the belief has been checked twice in two hundred years and was correct both times.',
            theGap: 'Both occasions ended inside nine days, in front of witnesses who were not asked to be there, and a thing that ends quickly does not become a story.'
        },
        quietlyStopped: 'Recruiting. The Grove has taken nobody in forty-one years and does not describe itself as closed - it simply has not admitted anyone since the last test, and the six who hold eleven days of country are the six who held it then. Ask and they will say the question has not come up.',
        practice: 'They answer questions and do not ask them. A disciple of the Grove meeting a stranger on the road gives their own name first, waits, and accepts whatever is offered back without comment, including a lie.',
        grievance: 'None they will state, which visitors find unnerving; the Grove holds that a grievance is a claim, and it makes no claims.',
        fear: 'A small test at the edge that is deniable enough to be awkward to answer and public enough that not answering ends the zone. It has been forty-one years and everybody in the hermitage can feel the clock.',
        lateness: 'Four nodes, all lit, all their own work, and a boundary wall that has never been tested - the Grove is the only institution in the province whose inheritance is nothing at all, which is why it has nothing it cannot operate.',
        disagreement: 'Two of the six want a seventh disciple taken this decade. The Keeper holds that a seventh means a roster, a roster means administration, and administration means becoming a different kind of thing.',
        wrongAbout: 'It believes its deference zone runs eleven days out because that is where the last test happened. Two granted sects have quietly moved leases inward on the northern side in the last twenty years and the Grove has not noticed, because nobody has told it and it does not patrol.',
        unitOfValue: 'Occasions answered. The Grove counts its standing in the number of times it has been tested and responded, which is two, and both are known by name across the province.',
        production: {
            reliableOrdinal: 21, currentCount: 6, peakOrdinal: 27, peakCount: 2, yearsSinceLastPeak: 60,
            note: 'Six disciples, all of them known individually across the province, and a pipeline that is deliberately not one - the Grove has taken nobody in forty-one years.'
        },
        distinctSentence: 'Holds a region eleven days across with six people, no patrols and no lease, on nothing but a belief about what would happen, which was last checked forty-one years ago.'
    },
    // ═══════════════════════════════════════════════════════════════════
    // LOW FALL - NEUTRAL
    // ═══════════════════════════════════════════════════════════════════
    'sect-stonewright-consortium': {
        knownFor: {
            outside: 'The rate. Stones, assay, the price of everything, and a reputation as the least romantic body in the world.',
            actuallyGoodAt: 'Recruitment. About half of its Core Formation members were bought mid-career off other sects, which makes it the largest employer of finished cultivators in the region and the reason three smaller sects have no seniors left.',
            theGap: 'It looks like a counting house and behaves like a hiring hall, and it has never advertised the second thing because the first thing is what makes it cheap.'
        },
        practice: 'Factors weigh everything, visibly, including food and correspondence, and will not agree to a figure without putting it on a balance first - a Consortium negotiation begins with somebody unpacking scales.',
        grievance: 'That every institution in the province depends on its rate and every one of them describes the Consortium as parasitic while doing so.',
        fear: 'That the presses are irreplaceable. It repairs them constantly, has never built a new one, and does not publish how many are still working.',
        lateness: 'Thirty-four of fifty-five nodes lit, and its refining presses are inherited machinery of a design its own artificers cannot reproduce at any price.',
        disagreement: 'The Rate-Setters want to publish a vein index and make the price of ground explicit. The Principal holds that an explicit price for a vein is a starting gun.',
        wrongAbout: 'It believes it sets the stone rate. In four recorded shortages the rate was set by what the Thousand Treasure Pavilion would pay, and the Consortium published that figure a week later as its own.',
        unitOfValue: 'Spirit stones, cut and assayed, to the tenth. It is the only faction that treats its own unit as the natural one and cannot really conceive of another.',
        production: {
            reliableOrdinal: 20, currentCount: 12, peakOrdinal: 33, peakCount: 3, yearsSinceLastPeak: 150,
            note: 'Buys production rather than growing it: about half its Core Formation members were recruited mid-career off other sects, which is a policy and not an accident.'
        },
        distinctSentence: 'Sets the price of a vein, a pill and a life in the same ledger, and maintains presses of a design it has never once managed to rebuild.'
    },
    'sect-thousand-treasure-pavilion': {
        knownFor: {
            outside: 'The floor. Where you sell what you dug up, at a commission everybody grumbles about and nobody refuses.',
            actuallyGoodAt: 'Grave-reading. Its appraisers can tell you which era a thing came out of, which kind of hole, and frequently which province, and there is no better body of that skill anywhere that is not doing it illegally.',
            theGap: 'The skill has no name that the Pavilion could say aloud, because naming it would describe the trade.'
        },
        quietlyStopped: 'Appraising its own claim. The Pavilion bought its ancestors at an estate sale, and the one thing its appraisers - the best grave-readers in the region - have never been asked to examine is the provenance of the lot the sect itself bought.',
        practice: 'Appraisers wear gloves indoors and take them off only to touch merchandise, so an outsider can tell exactly when a Pavilion member has started valuing them.',
        grievance: 'That the Consortium sets the rate it must sell at, and that saying so aloud would cost it the Consortium\'s underwriting.',
        fear: 'A Ledger audit of the tablet hall. The Pavilion has priced that risk internally and the figure is kept by three people.',
        lateness: 'Twelve of nineteen nodes lit; an auction floor built for four hundred with the back nine rows rented out for storage; and a tablet hall bought complete, of which no one on the staff can read the older third.',
        disagreement: 'The Council Seats want the ancestral claim quietly retired before somebody proves it. The Grand Steward holds that retiring it is a confession and that the only safe direction is forward.',
        wrongAbout: 'Its staff genuinely believe the Wei Zhaoyin lineage - the fraud is three generations old and the people repeating it are not the people who committed it.',
        unitOfValue: 'Commission, in stones, on somebody else\'s transaction. The Pavilion is the only faction whose unit is a fraction of another faction\'s unit.',
        production: {
            reliableOrdinal: 20, currentCount: 5, peakOrdinal: 20, peakCount: 2, yearsSinceLastPeak: 0,
            note: 'At its own best, and its own best is modest. An appraiser who spends forty years on the floor arrives at Core Formation Perfection, the Pavilion is turning them out at that rung right now, and it has never in its history produced anybody higher - everything above that on the roll walked in with a price on it. Nothing here is decaying. This is a house that never had far to fall, which is exactly why a claimed ancestor is worth what it is worth.'
        },
        distinctSentence: 'Bought its ancestors at an estate sale the Ninefold Ledger brokered, and is now the Ledger\'s largest client for exactly that reason.'
    },
    'sect-cinnabar-crucible-guild': {
        knownFor: {
            outside: 'Pills. The queue, the price list, the failed heaven-grade batches everybody has an opinion about.',
            actuallyGoodAt: 'Teaching. The Guild is a school with a shopfront: it admits by examination rather than combat, and it turns careful people with no talent for violence into professionals with a trade, which is a door that exists almost nowhere else.',
            theGap: 'Everybody sees the counter. Almost nobody sees the examination hall behind it, and the Guild finds the confusion useful at the price list.'
        },
        practice: 'Alchemists keep one hand permanently bandaged, by rule rather than injury, so that a burn to the working hand never costs a batch; guild members shake with the left.',
        grievance: 'That the Thousand Treasure Pavilion prices medicine the Guild makes and takes the margin on it.',
        fear: 'That the missing steps in the wall script are not missing but deliberately omitted, and that the batches which fail are failing for a reason somebody understood.',
        lateness: 'Fifteen of twenty-seven nodes lit, and the refining hall wall it was founded on is legible to about a third - the Guild has built a four-hundred-year reputation on that third.',
        disagreement: 'The Cauldron Masters want to sell heaven-grade attempts at cost with the failure rate disclosed. The Furnace Elders regard disclosure as an admission that the Guild does not know its own method.',
        wrongAbout: 'It teaches that the fourth line of the wall script is a step. Furnace Elder Bo died proving it is not, and the Guild recorded the death and kept teaching the line.',
        unitOfValue: 'Successful batches. Standing inside the Guild is a count of refinements that held, and no amount of money moves it.',
        production: {
            reliableOrdinal: 17, currentCount: 5, peakOrdinal: 25, peakCount: 2, yearsSinceLastPeak: 260,
            climbingToward: 21, waitingOn: 'time',
            note: 'The one house in the catalog that is not short of pills, because it makes them - and short of the only thing pills cannot buy. An alchemist spends the years that would have been cultivation standing at a cauldron refining what other houses climb on, so the Guild sits on stores it could walk its own people to the end of its scripture with and has never had the generations to spare. The stores are not even hidden. They are on a fixed price list nobody negotiates.'
        },
        distinctSentence: 'Built a monopoly on the third of a wall it can read, and still teaches a step that killed the man who proved it was not one.'
    },
    'sect-ashen-forge-clan': {
        knownFor: {
            outside: 'The quarrel. Whatever the Ashen Forge is actually for, the province knows it mostly as the clan that fell out with the Azure Cloud Pavilion over how its swords were being used.',
            actuallyGoodAt: 'Reading a fragment. They can identify what a ploughed-up shard was, which age it is from and what it will tolerate, and then reforge it - and half the region is armed off that skill without knowing whose it is.',
            theGap: 'A quarrel is repeatable at dinner and metallurgy is not.'
        },
        practice: 'Everyone in the compound, including children and the clan chief, feeds the furnace on a rota; refusing a turn is how a person leaves the clan, and it has happened twice.',
        grievance: 'That the Azure Cloud Pavilion accepted its swords for two hundred years and now accepts its deference to somebody else.',
        fear: 'That the furnace will go out. Nobody knows the starting method, so it has not been allowed to cool in eleven generations and the rota is a religion with a duty roster.',
        lateness: 'Seven of twelve nodes lit; the great furnace is inherited and cannot be relit; and the clan reforges ploughed-up fragments because it cannot make steel of that quality itself.',
        disagreement: 'The younger smiths want to arm the Nine Abyss Flame Sect, which pays four times. The Cinder Elders will not sell to a caldera on principle and are losing the argument annually.',
        wrongAbout: 'The clan holds that the furnace is theirs by right of the First Hammer building the compound around it. The compound is later than the furnace by an age and the furnace has an inscription the clan reads as decoration.',
        unitOfValue: 'Turns at the furnace. Obligation inside the clan is counted in rota shifts, and outsiders find that a shift cannot be bought at any price.',
        production: {
            reliableOrdinal: 23, currentCount: 4, peakOrdinal: 23, peakCount: 4, yearsSinceLastPeak: 0,
            note: 'Complete, and closed. A blood clan cannot recruit, so what it produces is the family, and the family gets the same fire every generation: every Ashen child who takes the rota arrives at the rung the clan chief stands on, none has ever passed it, and in eleven generations none has fallen short of it either. Nothing is missing and nothing is decaying. There is simply no further rung inside a compound built round one furnace, which is what the two who refused a turn were actually refusing.'
        },
        distinctSentence: 'A clan whose entire religion is a duty rota for a fire they inherited, cannot relight, and have not let go out in eleven generations.'
    },
    'sect-azure-mist-court': {
        knownFor: {
            outside: 'Where the Azure Cloud Pavilion puts people it is not currently willing to hold. Everybody in the Low Fall can name it and nobody thinks about it.',
            actuallyGoodAt: 'Teaching the Pavilion\'s forms to people who failed at them once. It has four centuries of experience with exactly that problem and the terraces have none, because the terraces never keep anybody who fails.',
            theGap: 'The Pavilion recalls on years served rather than on who is teaching well, so the Mist has never been asked what it does differently, and has never volunteered it.'
        },
        quietlyStopped: 'Petitioning for a written grant. It asked four times across two centuries, was neither refused nor answered, and stopped.',
        practice: 'Every disciple\'s probation term is posted on the yard wall on the day they arrive, in their own hand, and struck through in their own hand on the day it ends.',
        grievance: 'That the terraces call a recall a return and call everything else a placement, and that the Mist is required to use both words.',
        fear: 'That the Pavilion will one day want the lower gorge back, and that there is nothing whatsoever the Mist could do about it.',
        lateness: 'Twelve of nineteen nodes lit, in a yard laid out for four hundred and kept swept for sixty.',
        disagreement: 'The Mist Elders who came down and stayed hold that the Pavilion should be told what the recall rate would be if teaching mattered. The Warden holds that the day the Mist becomes interesting is the day it stops being safe.',
        wrongAbout: 'It believes the terraces read the quarterly probation roll. The roll has been filed unopened for ninety years and the clerk who files it has said so to three separate Mist Elders, none of whom passed it on.',
        unitOfValue: 'Years of probation served, counted publicly on a wall, and worth exactly nothing anywhere else in the world.',
        production: {
            reliableOrdinal: 17,
            currentCount: 31,
            peakOrdinal: 37,
            peakCount: 1,
            yearsSinceLastPeak: 40,
            note: 'Reliable to Core Formation, which is better than the number of nodes would suggest and is entirely down to teaching people who have already failed once.'
        },
        distinctSentence: 'It is the only institution in the world whose entire purpose is holding somebody else\'s disciples until somebody else wants them back, and it does that well enough that most of them go.'
    },
    'sect-azure-dew-sect': {
        knownFor: {
            outside: 'Barely known at all. Four hill villages and a small compound, and most of the province could not place it on a map.',
            actuallyGoodAt: 'Finding people. It sends two or three a decade up the gorge who would never have reached a terrace gate on their own, which over four centuries is a great many swords.',
            theGap: 'Nobody at the terraces knows which of their disciples came through the Dew, because the roll records a Dew admission and the Pavilion files by the terrace gate.'
        },
        quietlyStopped: 'Sending its finds directly to the terraces. It routes them through the Mist now, because a Mist year makes the terrace gate open and a Dew recommendation does not.',
        practice: 'Dew teachers work in the villages for two years before anybody is asked to join, so admission is a formality performed on somebody who has already been coming.',
        grievance: 'That it built its own compound and is still described as part of somebody else\'s grant.',
        fear: 'That the shallow vein is the reason the villages are there, and that nobody has surveyed how much of it is left.',
        lateness: 'None. Six nodes of six, all lit, all built - the only holding in the Azure grant that inherited nothing, which its Wardens raise more often than the Pavilion enjoys.',
        disagreement: 'Half the Dew Elders want the finds sent straight up and the credit with them. The other half point out that the Mist year is what makes them stick.',
        wrongAbout: 'It believes the Pavilion values it for the finds. The Pavilion values it because a body teaching in the villages keeps the villages from teaching themselves, which no Dew Elder has ever considered.',
        unitOfValue: 'People sent up the gorge, counted by name, going back four hundred years.',
        production: {
            reliableOrdinal: 16,
            currentCount: 22,
            peakOrdinal: 16,
            peakCount: 6,
            yearsSinceLastPeak: 0,
            note: 'Exactly as good as it has ever been, and it gives the result away. The Dew walks a village child to the last rung of the tempering scripture and then sends them up the gorge, so its figure is a delivery rather than a ceiling: it has never produced anybody higher, has never tried, and is producing at that rung this year. The Warden standing well above it is an inheritance rather than a product, and the Dew has never pretended otherwise.'
        },
        distinctSentence: 'It is the only holding in the Azure grant that built what it stands in, and the only one that measures itself in people it no longer has.'
    },
    'sect-hollow-bell-wanderers': {
        knownFor: {
            outside: 'Nothing much. A league of diggers and nobodies who ring a bell, taken seriously by no institution in the region.',
            actuallyGoodAt: 'Knowing where everybody has been. The bells are a map, four generations deep, of every crossroads any Wanderer has passed - and the league contains the only people alive who have walked the whole province without a sect telling them where to go.',
            theGap: 'Nobody asks a Wanderer anything, so the map has never once been read by anybody who could use it.'
        },
        practice: 'Members hang a small bell at any crossroads they pass and never at one they intend to return to, so the bells map where the Wanderers have been and never where they are.',
        grievance: 'That every sect in the province refused them first, and that several now recruit from them.',
        fear: 'That the league is a waiting room - that everyone good enough leaves, which is the arithmetic and nobody says it.',
        lateness: 'It owns no ground and inherits nothing, which it presents as philosophy; the honest version is that being late requires having been early.',
        disagreement: 'The Road Elders want a fixed seat and a vein. The Bell Keeper holds that the day the league owns ground is the day it starts refusing people.',
        wrongAbout: 'It believes the bell practice is two centuries old and originally a signal. The oldest bells are forty years old and the practice was started by one person as a joke about being unwelcome.',
        unitOfValue: 'Favours owed between individuals, tracked by nobody centrally, and defaulted on constantly.',
        production: {
            reliableOrdinal: 8, currentCount: 14, peakOrdinal: 20, peakCount: 1, yearsSinceLastPeak: 60,
            note: 'The lowest reliable production in the Low Fall, because anyone who reaches Foundation Establishment is recruited away within a year and the league does not stop them.'
        },
        distinctSentence: 'A league whose members mark where they have been rather than where they are, and which loses every promising member to the sects that refused them first.'
    },
    'sect-frostmirror-court': {
        knownFor: {
            outside: 'Refusal. Cold, arrogant, turns away everybody, leaves its floors unswept, and is unpleasant about all three.',
            actuallyGoodAt: 'Triage. It holds the only complete curriculum for a root that kills its bearers, and every applicant it refuses is somebody the arts would have killed. The refusal is the service.',
            theGap: 'A door that closes looks the same from outside whatever the reason, and the Court has never considered explaining itself to be part of the work.'
        },
        practice: 'Nobody sweeps. The floors of the cold hall are left exactly as they are on doctrine, and a visitor who tidies is not corrected but is not admitted again.',
        grievance: 'That the Storm Tyrant Court has raided them twice and the province regards the Frostmirror as the curiosity in that relationship.',
        fear: 'That the ice curriculum is finite - it was dug out, not written, and there is no more glacier to dig.',
        lateness: 'Twenty-six of forty-four nodes lit; and the curriculum above Rime Disciple is recovered inscription with gaps the Court fills by inference and does not tell disciples it is filling.',
        disagreement: 'The Rime Disciples want to admit clean-root cultivators under supervision. The Court Sovereign has calculated that this kills about four in five and refuses.',
        wrongAbout: 'The Court holds that the Mirror lies under the hall by choice. The hall was built over her afterwards, and the Court\'s own founding inscription is ambiguous in a way it does not teach.',
        unitOfValue: 'Cold. Standing is measured in how long a member can hold the hall\'s temperature without shelter, and the figure is posted.',
        production: {
            // 35 -> 36, which is the top of Body Integration and the last rung
            // the court's own signature manual reaches. The Rime-Heart
            // Stillness Canon caps at 37, and a house whose signature book runs
            // that far having never produced anybody who finished it read as
            // the catalog contradicting itself rather than as a fact about the
            // house. Both of its two peaks got to the end of the book; neither
            // found the next one.
            reliableOrdinal: 20, currentCount: 3, peakOrdinal: 36, peakCount: 2, yearsSinceLastPeak: 400,
            note: 'Constrained by intake rather than ground: it only admits mutated ice roots, so it produces very few and each one very far - to the end of its own canon, twice, and no further.'
        },
        distinctSentence: 'Refuses every applicant in the world except the one root in a hundred that its curriculum will not kill, and leaves its own floors unswept as doctrine.'
    },
    'sect-kiln-wardens': {
        knownFor: {
            outside: 'The gate. Wardens who answer in numbers, turn you around politely, and are frightening in a way nobody can articulate afterwards.',
            actuallyGoodAt: 'Formation work. Every node they hold is lit, which no other institution in the world can say, and the network under that ground is the only complete one anybody has.',
            theGap: 'The reputation is built entirely on the doorstep, because the doorstep is the only part anybody has seen for nine hundred years.'
        },
        practice: 'Wardens speak to outsiders in numbers only - distances, dates, quantities - and turn applicants around at the gate once, politely, with a figure for how far the nearest inn is.',
        grievance: 'None expressed in nine hundred years of outside records, which is itself the most remarked-upon fact about them.',
        fear: 'Unknown, and the absence is what alarms the other powers: an institution with nothing to lose and everything lit is not a shape anyone can price.',
        lateness: 'They are the one faction that is not late: nine hundred nodes held, nine hundred lit, which nobody else in the world can say and nobody can explain.',
        disagreement: 'Outsiders have recorded exactly one: two Wardens at the gate disagreeing, in numbers, about whether a visitor should be given water. He was.',
        wrongAbout: 'The world is wrong about them rather than the reverse: every outside account assumes they draw on the root vein, and the Anchorhold\'s survey figures show they take nothing from it at all.',
        unitOfValue: 'Nothing tradeable. They neither buy nor sell, accept no fees, and have never been recorded making an exchange of any kind.',
        production: {
            reliableOrdinal: 29, currentCount: 0, peakOrdinal: 36, peakCount: 0, yearsSinceLastPeak: 0,
            note: 'Unknown from outside and estimated by the Anchorhold from what walks the perimeter. Current count is recorded as zero because nobody has ever counted them.'
        },
        distinctSentence: 'Sits on the richest ground in the world drawing nothing from it, lights every node it holds, and has never in nine hundred years been recorded making an exchange.'
    },
    'sect-hollow-court': {
        knownFor: {
            outside: 'Stillness. Four beings who reached the top, sat down, and have not got up - holy ground, and inert.',
            actuallyGoodAt: 'Standing guard. They are the only body at that altitude that can protect a crossing, which is the reason six of them have crossed and the reason they work at a published address instead of hiding.',
            theGap: 'The world reads stillness as inertia. Sitting is what protecting looks like when it is being done properly.'
        },
        practice: 'The four seated do not stand. A visitor is answered honestly, at length, without anybody getting up, and the answer usually concerns something the visitor did not ask about.',
        grievance: 'That the world calls them cowards for declining the crossing, when what they declined was paying for it.',
        fear: 'Nothing left to be afraid of, which is precisely the condition, and is why they are useless in a crisis.',
        lateness: 'Forty-one of two hundred nodes lit, and no interest in the other hundred and fifty-nine; the seating is arranged for an audience of two hundred and holds four.',
        disagreement: 'The Second Seat holds that the Court should answer questions freely. The First Seat holds that a free answer from something like them is a form of interference, and they have not resolved it in six hundred years.',
        wrongAbout: 'They believe they are inert. Three regional wars have been settled by parties travelling to ask them a question and going home with the answer, which is not inertness by any measure but their own.',
        unitOfValue: 'Nothing at all. They cannot be paid, and the only currency that moves them is a question worth answering.',
        production: {
            reliableOrdinal: 0, currentCount: 0, peakOrdinal: 40, peakCount: 4, yearsSinceLastPeak: 900,
            note: 'Produces nobody, by construction: it takes no disciples, so its production tier is zero while its power ordinal is forty. The extreme case of the two metrics disagreeing.'
        },
        distinctSentence: 'Four people who reached the top of the ladder, declined to pay for the last step, and have not stood up since - and cannot be paid in anything but a good question.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // LOW FALL - DEMONIC
    // ═══════════════════════════════════════════════════════════════════
    'sect-the-severed': {
        knownFor: {
            outside: 'Horror. The ones who cut away their families on purpose, and the itemised list they hand to applicants.',
            actuallyGoodAt: 'Crossing. Their reasoning is sound and their record proves it: pre-paying the price makes boundaries survivable, and they climb faster than anybody in the catalog.',
            theGap: 'The method is unbearable to look at and the results are in the ledger, so the province has settled on discussing the method.'
        },
        practice: 'Members introduce themselves by what they have already cut - "two bonds, a name" - before giving anything you could call a name, and the ledger is shown to applicants before anything else.',
        grievance: 'That Lantern Hall calls them thieves of themselves while charging nothing to write down what the crossings steal from everyone else.',
        fear: 'That the doctrine works and produces something that cannot be argued with afterwards, including about whether it was worth it.',
        lateness: 'Three nodes, all theirs, all portable, and a founding ledger entry whose identifying columns cut themselves - the house cannot establish who founded it.',
        disagreement: 'The Ninth Cut faction hold that cutting should be voluntary and gradual. The Nameless hold that a gradual cut is a bond you are still paying interest on.',
        wrongAbout: 'They hold that the cut is theirs to choose. The Quiet Cut, who do it professionally, note that a self-severance takes what is reachable rather than what was chosen, and the Severed do not accept the finding.',
        unitOfValue: 'Cuts made, recorded in the house ledger. A member\'s standing is the length of their own entry.',
        production: {
            reliableOrdinal: 24, currentCount: 6, peakOrdinal: 38, peakCount: 1, yearsSinceLastPeak: 600,
            note: 'The fastest pipeline in the catalog by a distance, because pre-paying the price makes crossings survivable - and the fastest attrition, because most of them stop being people first.'
        },
        distinctSentence: 'The only faction that shows applicants an itemised list of what its members have already amputated from themselves, and considers it a recruitment document.'
    },
    'sect-crimson-abyss-hall': {
        knownFor: {
            outside: 'The cash box. Predators who set up outside other sects\' admission days and pay in advance, which everybody agrees is sinister.',
            actuallyGoodAt: 'Training. It produces more Foundation Establishment cultivators annually than any righteous sect in the province, from people who were refused that morning, and it does it by actually teaching them.',
            theGap: 'Paying a stranger a month up front looks like a trap and is in fact a wage, and the Hall would rather be thought sinister than cheap.'
        },
        practice: 'Recruiters wait outside other sects\' admission days with a table and a cash box, and pay the first month in advance to anyone who was refused inside.',
        grievance: 'That the righteous sects create its intake by refusing people and then condemn the Hall for taking them.',
        fear: 'That the tithe has to come from somewhere, and that the Hall\'s own membership is the only supply that has never run short.',
        lateness: 'Six of sixteen nodes lit; a drain in the lower hall floor cut for a purpose the Hall has adopted without ever establishing; and a tithe rate the First Abyss Lord set that nobody has dared revise.',
        disagreement: 'The Left Envoy wants the Hall to stop recruiting refusals and start recruiting talent. The Abyss Lord holds that talent leaves and the desperate stay.',
        wrongAbout: 'It believes the tithe rate is generous because it has never been raised. Measured against five centuries of Consortium rates, holding it flat has more than tripled it in real terms.',
        unitOfValue: 'Spirit stones, paid weekly and in advance, which is the entire pitch and the reason it works.',
        production: {
            reliableOrdinal: 29, currentCount: 2, peakOrdinal: 29, peakCount: 3, yearsSinceLastPeak: 0,
            note: 'Finished rather than stalled, and it is the sharpest case in the catalog: everybody who survives the Hall finishes its book, because the devouring art ends where it ends and the Hall\'s material is its own intake, which is the one supply in the world that has never run short. It has been paying for that by under-declaring the Court\'s tithe by about a fifth for six years. The price is who does not survive - the same high intake and high mortality that make it the largest annual source of Foundation Establishment cultivators in the province - and the consequence is that the Abyss Lord is right that talent leaves, because there is nowhere further inside the Hall except his seat.'
        },
        distinctSentence: 'Sets up a table with a cash box outside other sects\' admission days and pays the first month in advance to everyone they turned away.'
    },
    'sect-bone-lantern-cult': {
        knownFor: {
            outside: 'Graves. The worst company in the region, hunted on principle by one sect and over supply by another.',
            actuallyGoodAt: 'Ground-reading. They are the best diggers alive and can date a battlefield to the season by what is flowering on it, which is a real science practised by people nobody will sit next to.',
            theGap: 'An unpleasant trade is a complete explanation to everybody outside it, so the science underneath has never been examined by anyone who was not doing it.'
        },
        practice: 'Members work in silence at a site and talk continuously away from one, and every one of them can date a battlefield to the season by what is flowering on it.',
        grievance: 'That the Verdant Spring Hall hunts them for handling the dead while buying its crimson marrow fungus from a supply chain with exactly one source.',
        fear: 'The Crimson Abyss Hall, which hunts them over supply rather than principle and is much better funded.',
        lateness: 'Two of nine nodes lit; a field wall built of fragments sorted by weight rather than by what they were; and a rotation established a hundred and forty years ago that nobody now can justify from first principles.',
        disagreement: 'The Pale Elders want to work only battlefields older than the rotation. The Lantern Bearers want to follow live wars, which pays four times and is how the Cult loses people.',
        wrongAbout: 'It holds that its rotation exists to let sites recover. The founding note says it exists to let survivors die off, and the Cult has forgotten the difference.',
        unitOfValue: 'Sites worked, in rotation order. Seniority is a place in the queue and cannot be bought, only waited for.',
        production: {
            reliableOrdinal: 13, currentCount: 6, peakOrdinal: 26, peakCount: 1, yearsSinceLastPeak: 700,
            note: 'Produces at Foundation Establishment and has managed Deity Transformation exactly once, seven hundred years ago, which is the Pale Ancestor and the whole of its prestige.'
        },
        distinctSentence: 'Follows wars at a respectful distance on a hundred-and-forty-year rotation, and can date a battlefield to the season by which flowers are on it.'
    },
    'sect-nine-abyss-flame-sect': {
        knownFor: {
            outside: 'Monstrousness. The caldera, the elders who have stopped being human in one specific way each, and the contract.',
            actuallyGoodAt: 'Disclosure. It is the only faction in the catalog that hands an applicant the full terms before they sign, and its pipeline is the strongest live one in the province precisely because nothing is hidden.',
            theGap: 'Total honesty about a monstrous bargain reads as recruitment rather than as candour, and the sect has stopped expecting otherwise.'
        },
        practice: 'Elders are visibly not human any more in one specific way each - a hand, an eye, a voice - and the sect neither hides this nor comments on it, and applicants are shown the contract in full.',
        grievance: 'That the Sweptground Temple takes in the people the contract ruins and calls the sect a predator, while turning nobody away itself.',
        fear: 'That the Kindler wakes for a reason nobody chose, and that the caldera is the collateral.',
        lateness: 'Nineteen of thirty-eight nodes lit in an alternating ring, because the sect could read every other line of the diagram and lit exactly what it understood.',
        disagreement: 'The Flame Hall Masters want the vent seal opened and the Kindler consulted. The Flame Sovereign has never permitted an inspection and has not explained why.',
        wrongAbout: 'It teaches that the transformation contract is a bargain with a knowable counterparty. Its own recovered text names no counterparty and the sect supplies one by tradition.',
        unitOfValue: 'Contract terms - what a member has agreed to owe and when it comes due. Money is treated as a rounding detail inside that.',
        production: {
            reliableOrdinal: 25, currentCount: 7, peakOrdinal: 34, peakCount: 3, yearsSinceLastPeak: 110,
            note: 'The strongest live pipeline in the province, because the contract works: it reliably produces Deity Transformation and the cost is paid later and by the individual.'
        },
        distinctSentence: 'Hands every applicant the full text of a transformation contract whose counterparty its own scripture does not name, and lights nineteen nodes in an alternating ring because it can read every other line.'
    },
    'sect-storm-tyrant-court': {
        knownFor: {
            outside: 'Collection. A court that takes cultivators and treats refusal as a scheduling matter, which is the only fact most people in the province hold about it.',
            actuallyGoodAt: 'Instruction. It has the world\'s only working lightning curriculum and teaches it properly, which is why the ones it collected mostly stay.',
            theGap: 'Taking somebody is visible from the road and teaching them is not, so the Court is known for the worst ten minutes of a relationship that usually lasts a century.'
        },
        quietlyStopped: 'Opening the vault. It is described at successions, in order, from the record, and it has not been opened in four hundred years. The description is now the ceremony, and at least two Storm Elders privately doubt that everything in the list is still in the room.',
        practice: 'Court members do not sit down indoors during a storm and are audibly uncomfortable in still air; a Storm Servant meeting an outsider will check the sky first, every time.',
        grievance: 'That the world thinks the tether is a trophy when it is a maintenance liability the Court cannot repair and cannot abandon.',
        fear: 'A Ledger certification of its vault inventory, which would establish that the Standing Storm Rod is gone.',
        lateness: 'Twenty-three of seventy-one nodes lit; the tether holding a mountain fragment aloft is inspected annually and cannot be repaired; and the vault is now described rather than opened at successions.',
        disagreement: 'The Thunder Wardens want the rod\'s loss admitted and the curriculum rebuilt around what remains. The Storm Tyrant holds that the claim is the Court\'s only remaining asset.',
        wrongAbout: 'It teaches that the tether is the ancestor\'s work and therefore permanent. The tether predates the Court, was failing before Yan Kuo concealed it, and has an inspection record the Court reads as ceremonial.',
        unitOfValue: 'Collections. Standing is measured in cultivators the Court has taken and kept, and refusal is treated as a scheduling matter rather than an answer.',
        production: {
            reliableOrdinal: 21, currentCount: 4, peakOrdinal: 44, peakCount: 1, yearsSinceLastPeak: 3_400,
            note: 'The mid-curve case in one row: it produced a crossing three and a half thousand years ago, holds a true claim, has lost the gift, and now reliably produces Nascent Soul at best.'
        },
        distinctSentence: 'Holds the world\'s only lightning curriculum on a mountain fragment hanging from a chain it cannot repair, and describes its vault at successions rather than opening it.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // LOW FALL - DAO HOUSES
    // ═══════════════════════════════════════════════════════════════════
    'house-ninefold-ledger': {
        knownFor: {
            outside: 'Audits. Joyless, unavoidable, and the reason nobody can settle an inheritance without paying for a cup of tea the auditor will refuse.',
            actuallyGoodAt: 'The graph. Four thousand years of every connection anybody has had, which is why a house with no war doctrine has never been attacked twice by the same sect.',
            theGap: 'The tea is memorable and the graph is not, and the Ledger has never once corrected anybody about which of the two makes it untouchable.'
        },
        practice: 'Auditors write in front of you and read the entry back before leaving, and they will not accept hospitality of any kind - a Ledger auditor pays for their own tea, in a region where that is close to an insult.',
        grievance: 'That the Tally Court is remembered as corrupt on the strength of an account the Ledger wrote.',
        fear: 'The nine sealed volumes. Three factions inside the house want them opened and the Keeper has never given a reason for refusing.',
        lateness: 'Thirty-one of forty-nine nodes lit; three of forty-one circuit benches unstaffed for a century; and the founding volumes for years 400 to 900 are missing and were probably destroyed internally.',
        disagreement: 'The Circuit wants arbitration extended into criminal judgement. The Book holds that the Ledger records and never rules, and both sides quote the same founding text.',
        wrongAbout: 'It believes its method can read a thread through a grave. It has never once worked, the house keeps a register of the attempts, and the register is filed under research rather than failure.',
        unitOfValue: 'Obligations outstanding. The Ledger prices everything as a debt with a term, including friendship, which is why its arbitration is trusted and its dinners are not enjoyed.',
        production: {
            reliableOrdinal: 21, currentCount: 8, peakOrdinal: 32, peakCount: 4, yearsSinceLastPeak: 400,
            note: 'Steady and unspectacular, and the house regards a spectacular member as a governance risk.'
        },
        distinctSentence: 'Can name the debt your great-grandmother incurred, will not accept a cup of tea while telling you, and destroyed the house it grew out of and wrote the account of why.'
    },
    'house-narrow-hour': {
        knownFor: {
            outside: 'Prophecy. Four thrones keep a reader, so the region has concluded the House knows what is going to happen.',
            actuallyGoodAt: 'Pruning. It does not claim to know the future and never has; it can tell you which two of this month\'s decisions are load-bearing, which is a smaller and far more useful thing.',
            theGap: 'Clients want prophecy, pay for pruning, and go away satisfied, and the House has taken three thousand years of retainers without ever once correcting the misunderstanding.'
        },
        quietlyStopped: 'Training. Intake has not kept pace with deaths for three centuries and the House has never formally stopped taking readers; it has simply not replaced one faster than it lost one since anybody currently alive was born. Eleven advisers, nineteen retainers a century ago, and no decision anywhere in the record.',
        practice: 'Readers sit facing away from whoever is speaking to them, on the doctrine that a face is a possibility already collapsing, and the hall has no walls.',
        grievance: 'That its advisers are treated as furniture by the thrones they keep, and consulted last in the crises they predicted.',
        fear: 'The year of the scar, and Cao Yin\'s sealed account, which does not match what happened and which the house has never explained.',
        lateness: 'Twelve of twelve nodes lit - and all twelve are observational, so the hall cannot be defended and the house has never fixed this.',
        disagreement: 'The Open Hall wants warnings published free and the retainers ended. The Standing Chairs hold that a free warning is ignored, and the retainer is what makes rulers act.',
        wrongAbout: 'It holds that sightings cast on itself are worthless because it stands outside its own convergence. The likelier reading is that the house has never accepted a sighting it disliked, and the record of discarded self-sightings is available.',
        unitOfValue: 'Retainers held. Standing is the number of thrones and sects currently paying to keep a reader in the room, and it has fallen from nineteen to eleven.',
        production: {
            reliableOrdinal: 20, currentCount: 5, peakOrdinal: 30, peakCount: 3, yearsSinceLastPeak: 300,
            note: 'Declining: eleven advisers and no replacement faster than they die, so its production has tracked its retainer count downward for three centuries.'
        },
        distinctSentence: 'Advises four thrones from a hall with no walls, sits facing away from whoever is talking, and cannot say which of its own two contradictory records of the scar year is true.'
    },
    'house-bound-word': {
        knownFor: {
            outside: 'Ceremony. The witnesses at a signing, the ones who make a succession feel official.',
            actuallyGoodAt: 'Enforcement. A broken oath is structural rather than punitive - removing it removes some of the person - and no ruler in the region has found a way to hold a border without them.',
            theGap: 'They look like a formality because the enforcement has never had to be demonstrated in public, which is exactly what a working deterrent looks like.'
        },
        practice: 'Oathwrights never say "I promise" in casual speech, will not answer a yes-or-no question without qualifying it, and a witness signs their own name last, after every party, always.',
        grievance: 'That a founding oath forbids them witnessing for the Severed, and is costing them a fortune they can see and cannot touch.',
        fear: 'The unpublished treaty of nine hundred years ago in its own vault, which permitted two traditions to work one vein simultaneously and is the likeliest explanation for the Quiet Marches.',
        lateness: 'Twenty-five of thirty-six nodes lit; a vault of treaties binding on people who have never read them; and a dissolution method for oaths whose parties are all dead that has never worked and is still taught.',
        disagreement: 'The Warden faction want the house to enforce as well as witness. The Strict Hall holds that a witness who enforces is a party, and a party cannot witness.',
        wrongAbout: 'It teaches that an oath binds the person and that ground is ceremony. The Anchorhold\'s figures show no oath sworn on unsurveyed ground has ever held, and the house has not tested it because testing it would cost it the fee.',
        unitOfValue: 'Terms outstanding - the number of live oaths in the vault. It measures itself in obligations it is holding for other people.',
        production: {
            reliableOrdinal: 21, currentCount: 6, peakOrdinal: 31, peakCount: 2, yearsSinceLastPeak: 500,
            note: 'Slow by design: oathwright training takes forty years, intake has fallen for three generations, and the house will not shorten the training.'
        },
        distinctSentence: 'Cannot say "I promise" in conversation, signs every document last, and is forbidden by its own founding oath from witnessing for the one faction that would pay most.'
    },
    'house-quiet-cut': {
        knownFor: {
            outside: 'Villainy. Everybody knows what they sell, everybody says they should be destroyed, and the saying of it is a social obligation.',
            actuallyGoodAt: 'Being busy. Every institution that has publicly called for their destruction has privately used them, and the house is one of the most productive in the catalog.',
            theGap: 'The denunciation and the commission are performed by the same people, and the Quiet Cut has built its entire pricing around the fact that neither side will ever mention the other.'
        },
        practice: 'No member gives a name, a face is never seen twice on the same commission, and work is taken and delivered exclusively through third parties who are paid not to remember.',
        grievance: 'That every institution which publicly wants them destroyed has privately used them, and that the Severed get called philosophers for doing it badly to themselves.',
        fear: 'The register of absences. The House of Held Names cannot say what was removed, but it can say when, and that has been enough to ruin four clients.',
        lateness: 'Four portable nodes, all of their own making, and a set of Tally Court fragments they depend on, cannot reproduce, and are visibly wearing out.',
        disagreement: 'The Trade takes any commission that pays. The Doctrine holds that severance is mercy and should be given away, and a third group has started cutting without clients at all.',
        wrongAbout: 'It believes a clean cut leaves nothing. Every cut leaves an edge, the Ledger has been reading edges for two hundred years, and the house prices its work as though this were still a secret.',
        unitOfValue: 'Connections removed, priced by age and load. It is the only faction whose unit of value is a subtraction.',
        production: {
            reliableOrdinal: 24, currentCount: 5, peakOrdinal: 33, peakCount: 2, yearsSinceLastPeak: 200,
            note: 'Deliberately opaque even internally: the house cuts its own records, so it repeatedly recuts work it has already done and cannot audit its own pipeline.'
        },
        distinctSentence: 'Sells the permanent removal of a relationship, cuts its own records as doctrine, and consequently keeps redoing work it has already been paid for.'
    },
    'house-held-names': {
        knownFor: {
            outside: 'Extortion. The ones who sell you your own name back, slowly, at a price set by what you can be made to pay.',
            actuallyGoodAt: 'Holding. The register survived what the boundary took, which no other body managed, and twenty thousand names exist in the world only because somebody recites them every morning.',
            theGap: 'Nobody separates the price from the service, and the House has never given anybody a reason to.'
        },
        practice: 'Holders recite the names they carry every morning, aloud, in order, and a holder who stumbles is relieved of that name the same day and never told which one it was.',
        grievance: 'That Lantern Hall gives away for nothing what the House charges for, and is applauded for it while doing worse work.',
        fear: 'Erasure at the source. Four times the House has been left holding an entry for somebody nobody remembers, and it does not know how many more it is holding.',
        lateness: 'Twenty of thirty-three nodes lit; the stack rooms flood, so roughly one register in forty from the third age is illegible; and restoration is partial for a reason the House has never established.',
        disagreement: 'The Gate wants registration extended to every settlement. The Stack wants the House to hold names and sell nothing, and a third group has begun quietly using the names it holds.',
        wrongAbout: 'It holds that a name in the register is safe from a crossing. Above Deity Transformation it has never once recovered one, and the House files those cases as incomplete rather than failed.',
        unitOfValue: 'Names held. Twenty thousand of them, and the House states the figure the way a sect states a vein depth.',
        production: {
            reliableOrdinal: 17, currentCount: 4, peakOrdinal: 29, peakCount: 1, yearsSinceLastPeak: 800,
            note: 'Administrators rather than cultivators: two combat cultivators in seven hundred years, and a pipeline that has never been the point.'
        },
        distinctSentence: 'Recites twenty thousand names every morning and relieves any holder who stumbles of a name without telling them which one they dropped.'
    },
    'house-measured-span': {
        knownFor: {
            outside: 'Couriers. A very large, very useful guild that moves things and rents storage.',
            actuallyGoodAt: 'Denomination. Every long contract, barrier, route and ring in the region is priced off figures only the House can produce, which makes it a quiet input to arrangements it is not party to.',
            theGap: 'Being universally useful is the most effective way in the world to be taken for scenery.'
        },
        practice: 'Surveyors pace distances compulsively, including indoors, and will interrupt a negotiation to write down a figure; a Span member gives directions in two numbers, walked and true.',
        grievance: 'That the Anchorhold nails ground shut and calls it public safety, and that the world agrees with them.',
        fear: 'That the closed terminals are closed from the other side, and that Fu Zhen is still on it.',
        lateness: 'Twenty-nine of fifty-eight nodes lit; twenty-two of thirty-one gate terminals closed and unreopenable; a swept gate frame with no gate in it; and an eastern survey four hundred years out of date because the ground moved.',
        disagreement: 'The Long Measure wants the closed gates reopened whatever it costs. The Freight faction wants the house to stop being ancient and start being solvent.',
        wrongAbout: 'It teaches that the Unlit Gate House destroyed itself by overreach. Forty-one names appear on both houses\' founding rolls and both seats burned in the same season, which the official account does not mention.',
        unitOfValue: 'True distance. Everything the house prices, including its own labour, is quoted per li of true rather than walked distance, which nobody else can verify.',
        production: {
            reliableOrdinal: 25, currentCount: 9, peakOrdinal: 34, peakCount: 5, yearsSinceLastPeak: 260,
            note: 'The most productive house in the catalog, because its discipline is practised while travelling and its members do not stop to hold territory.'
        },
        distinctSentence: 'Quotes every price in a distance only it can measure, and keeps a gateless frame swept at a station where it has been failing to reopen the same span for six hundred years.'
    },
    'house-anchorhold': {
        knownFor: {
            outside: 'Weights. Standards, the survey of record, and a reputation for being the dullest institution anybody has to deal with.',
            actuallyGoodAt: 'Containment. Four catastrophe sites are not spreading, and that is a thing the Anchorhold does continuously rather than a fact about the sites.',
            theGap: 'Their entire product is nothing happening, which is unimprovable as work and hopeless as reputation.'
        },
        practice: 'Wardens stand rather than sit through meetings, on the doctrine that a thing that has settled is doing its job; and they will not be moved from a spot they have taken, which makes them exhausting guests.',
        grievance: 'That the Girdle descendants at the perimeter treat the house as usurpers, and are right, and cannot be told so.',
        fear: 'Two perimeters lost in one season - the condition that wakes Xu Ci, published in the survey standard as a schedule.',
        lateness: 'Sixty-two of eighty-eight nodes lit; two of eleven perimeters maintained below the house\'s own published standard; and the eastern nail sits in a socket cut for a larger Girdle nail that the house does not explain.',
        disagreement: 'The Perimeter wants containment extended to every scar. The Datum holds that the survey is the only real duty, and a faction is pressing to break a nail to see what is under it.',
        wrongAbout: 'It teaches that the Girdle\'s containment failed. Its own nail sits in the wrong-sized socket, the province died four days after the breach rather than before, and the house has both facts in its archive.',
        unitOfValue: 'Perimeter-seasons: how many containments held, for how long, and at whose cost. Money is a means of buying those and nothing else.',
        production: {
            reliableOrdinal: 25, currentCount: 7, peakOrdinal: 35, peakCount: 3, yearsSinceLastPeak: 340,
            note: 'Steady, because standing a perimeter watch for a year is both the admission requirement and the cultivation method.'
        },
        distinctSentence: 'Publishes the exact circumstance under which it will wake the ancestor entombed under its own datum stone, as a line item in the regional survey standard.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // THE QUIET MARCHES
    // ═══════════════════════════════════════════════════════════════════
    'sect-weir-office': {
        knownFor: {
            outside: 'Power. In the Marches the Office is simply what authority looks like: the grant book, the price of a day, and the man who can refuse you.',
            actuallyGoodAt: 'Nothing anybody outside would recognise as strength. Three people at Standing Cut, no chisels, no arts worth the name, and a Weir Master who would be a mid-ranking elder nobody sends for in the Low Fall.',
            theGap: 'This is the one entry where reputation runs ahead of capability rather than behind it. Everything the Office has is positional, everybody local knows it, and nobody local can do anything about it.'
        },
        practice: 'Everything is a form. Office members carry the grant book\'s current page on their person, will read your entry aloud at you in the street, and never touch a chisel - the Office cultivates by holding faces, not working them.',
        grievance: 'That the region calls it a parasite while queuing at its door, and that the Low Fall calls its Keystone a Core Formation as if the two roads were the same walk.',
        fear: 'That the Gapwater face is finite. The Office has surveyed how much workable stone is left and has never published the figure.',
        lateness: 'Seven of twenty-six nodes lit, and the seven are cut into the stone rather than laid on the ground, which is why they still run at all; the rank of Under-Warden retains a duty at the weir gates that has had no function since the water was diverted.',
        disagreement: 'The Under-Wardens want grants issued by lot to end the queue politics. The Weir Master holds that discretion is the Office\'s only asset and that a lottery would make it a landlord.',
        wrongAbout: 'It teaches that carving reaches ranks that ambient drawing cannot, and prices grants on it. The Ledger has certified band for band that the ladder is the same one, and the Office has never submitted its own table for certification.',
        unitOfValue: 'Days of face time. Every debt, wage, fine and favour in the region is denominated in grant days, and stones are simply how days are bought.',
        production: {
            reliableOrdinal: 13, currentCount: 3, peakOrdinal: 20, peakCount: 1, yearsSinceLastPeak: 60,
            climbingToward: 21, waitingOn: 'access',
            note: 'The whole region\'s pipeline is three people at Standing Cut, one Keystone in two hundred years, and a bureau that has started prospecting, which is not a thing bureaus do. Two survey parties have gone past the Dead Verge in four years looking for a third workable face and one did not come back, none of it entered in the grant book. A third face would be the first new ground in the Marches since the catastrophe and would let the Office raise a Keystone out of its own ticketed instead of waiting sixty years for another accident. It ends if Gapwater runs out first, and the Office is the only party that has measured how close that is and has never published the figure.'
        },
        distinctSentence: 'Rents the only two workable stone faces in a province by the day, prices them by a rank table it has never dared submit for certification, and none of its members have ever held a chisel.'
    },
    'sect-sixmile-wardens': {
        knownFor: {
            outside: 'Paint. Stake-painters, mildly comic, greeted with the affection reserved for people doing a job nobody wants.',
            actuallyGoodAt: 'The map. They own the only complete record of where it is safe to walk in a province full of ground that kills, and they keep it current at a cost of two or three lives a year.',
            theGap: 'A public good is invisible while it is working, and a painted stake does not look like an asset until you are standing at one in the dark.'
        },
        practice: 'Wardens carry paint and a brush at all times and stop mid-conversation to repaint a stake; they greet strangers by pointing at the nearest marker rather than speaking.',
        grievance: 'That the Weir Office charges for grants and contributes nothing to the roads its grantees walk in on.',
        fear: 'That the burn edge is accelerating. Three Wardens have said so; the survey shed has the figures; nobody has recalculated them because nobody wants the answer.',
        lateness: 'Nothing inherited at all, which in the Marches is unusual: a shed, nine hundred stakes and a survey, all of it their own work, and the survey is the only complete map of safe ground in the region.',
        disagreement: 'The Road Wardens want to charge a toll and fund replacement paint. The Warden of the Six Mile holds that a paid road is a road people leave to avoid paying for.',
        wrongAbout: 'They believe the original survey is accurate because it has never been wrong. It has never been checked - the burn edge has moved nine hundred paces since it was drawn and the stakes have been moved to match by hand.',
        unitOfValue: 'Stakes standing. The Wardens count their own strength, their dead and their year in painted markers, and will trade labour for paint before stones.',
        production: {
            reliableOrdinal: 5, currentCount: 12, peakOrdinal: 14, peakCount: 1, yearsSinceLastPeak: 190,
            note: 'The lowest production in the catalog: on unaided Marches ground a Warden stops at Chipping, and the single Standing Cut in their history was the founder.'
        },
        distinctSentence: 'A militia that measures its dead in painted stakes, greets strangers by pointing at the nearest one, and owns the only complete map of where it is safe to walk.'
    },
    'sect-gleaners-company': {
        knownFor: {
            outside: 'Dying. The best-paid work available in the Marches, understood locally as a way of dying slightly later than the alternative.',
            actuallyGoodAt: 'Keeping its word. A dead digger\'s share goes to their family, without exception, and the Company has never defaulted once - which in a region administered by a bureau with eleven staff is the only reliable institution anybody deals with.',
            theGap: 'The pay is the thing everybody repeats, so the promise underneath it is treated as a detail of the pay.'
        },
        practice: 'Gleaners rinse their mouths with vinegar on a fixed schedule and spit before speaking, and they will not enter a sealed door in the first hour of a shift on the grounds that nobody is careful yet.',
        grievance: 'That the Bone Lantern Cult undercuts them across a border neither region polices, using finds the Company located.',
        fear: 'The sealed part of their own sorting yard. Xun went in on a wager thirty years ago and the Company sealed it again and raised the wager, and nobody has taken it.',
        lateness: 'Three of fourteen nodes lit, all at the front of a ruin they have never fully entered; the yard is laid out inside somebody else\'s building; and the rotation they follow was justified by a note whose reasoning they have lost.',
        disagreement: 'The Company Factors want to work live burn edges, which pays triple. The Company Master holds the nine-year rotation, and the argument reopens every time a face runs out.',
        wrongAbout: 'They hold that the nine-year rotation lets a site recover. Bo Ai\'s founding note says it exists to let the previous crew\'s survivors die off before the next pass, and the Company reads the note as metaphor.',
        unitOfValue: 'Shares in a find, allocated before the shift and honoured after a death - a dead gleaner\'s share goes to their family, and the Company has never once defaulted on that.',
        production: {
            reliableOrdinal: 8, currentCount: 9, peakOrdinal: 17, peakCount: 1, yearsSinceLastPeak: 40,
            climbingToward: 13, waitingOn: 'access',
            note: 'It loses about one in nine a season and the one Keystone in its history left for the Low Fall within a year - and it is rising anyway, on ground it is not supposed to be on. The Factors have worked two live burn edges without a rotation entry and paid the shares out of the general fund; live ground yields grades the nine-year cycle never turns up, and on that material a gleaner reaches Foundation Establishment instead of stopping at Chipping. What ends it is not the Weir Office. It is one season where the losses outrun the fund and a family goes unpaid, which has never happened and is the whole of what the Company is.'
        },
        distinctSentence: 'Pays a dead digger\'s share to their family without exception, will not open a sealed door in the first hour of a shift, and works a rotation whose stated purpose it has misremembered as mercy.'
    }
};

// ─────────────────────────────────────────────────────────────────────────
// LOOKUPS

// -------------------------------------------------------------------------
// HIGH-REALM PROVENANCE
// Survivors of a richer age, stated as a matter of record rather than law.
//
// The great ages are behind this world. Veins have been drawn down, nobody has
// ascended in living memory, and every competent institution in both provinces
// takes it as settled that the top of the ladder is closed in this age.
//
// That belief is almost right, and "almost" is the whole of the interest. It
// is a claim about the record - about how long it has been, and about who is
// no longer alive to explain how it was done - and not a claim about what the
// world permits. A faction standing this high is evidence of when the climb
// last happened, not proof that it cannot happen again, and nothing in this
// file may assert otherwise. If a player ever manages it, none of these
// records should turn out to have been lying; they should turn out to have
// been describing a very long silence.
//
// So each record carries two separate things, in the same shape the knowledge
// layer already uses: `whyNobodyHasSince` is what actually happened, and
// `settledBelief` is what everyone competent has concluded from it. The gap
// between them is deliberate.
//
// THRESHOLDS: `HIGH_REALM_THRESHOLD` below is an AUTHORING rule - above this
// ordinal a faction owes an account of itself - and is deliberately not a
// statement about reachability. Content does not restate engine measurements:
// if the engine grows an exported constant for the present-day reachability
// rate, this file should import it rather than keep a second number that can
// disagree.
// -------------------------------------------------------------------------

/** Above this ordinal a faction owes an account of which age it climbed in. */
export const HIGH_REALM_THRESHOLD = 32;

export interface HighRealmProvenance {
    /** The ordinal in question, matching the faction's powerOrdinal. */
    highestOrdinal: number;
    /** Years since that person made the climb. Always long ago. */
    climbedYearsAgo: number;
    /** The ground it was done on, which is usually gone or diminished. */
    climbedWhere: string;
    /** Which age, in the faction's own terms. */
    ageNote: string;
    /**
     * The record: how long it has been, what has happened since, and what the
     * present-day symptoms are. Facts about history, never about physical law.
     */
    whyNobodyHasSince: string;
    /**
     * What everyone competent has concluded, which is almost right and is
     * stated as a belief rather than as a finding.
     */
    settledBelief: string;
}

/**
 * Factions above the threshold whose records are being revised elsewhere and
 * are deliberately not written here. Kept explicit so the gap is visible
 * rather than silent, and so the catalog test can hold the line for
 * everything else.
 */
export const PROVENANCE_PENDING: ReadonlySet<string> = new Set([
    'sect-hollow-court',
    'sect-kiln-wardens'
]);

export const HIGH_REALM_PROVENANCE: Record<string, HighRealmProvenance> = {
    'sect-azure-mist-court': {
        highestOrdinal: 37,
        climbedYearsAgo: 340,
        climbedWhere:
            'The mist terraces below the gorge, on the runoff of the vein Ru Anjing was working, in the same decades and off the same water. Nobody has ever proposed that this is a coincidence and nobody has ever written it down either.',
        ageNote:
            'Late Age, and within a generation of the Pavilion\'s own climb, which is the fact that makes the Mist awkward rather than impressive. Two people went up off one vein in one lifetime; one of them crossed and has a province naming its era after her, and the other was a recall the terraces had already given up on and is still filed as a placement.',
        whyNobodyHasSince:
            'Nobody has, in three hundred and forty years, and the Mist can say exactly why rather than guessing. The runoff is what the Pavilion does not use and there has never been more of it. The Mist teaches the Pavilion\'s forms to people who failed at them once, which is a method for producing competent cultivators and not a method for producing another Pei Hanzhang, and the house is honest with itself about the difference.',
        settledBelief:
            'The Low Fall holds that the Mist is a feeder with an unusually old warden. The Pavilion\'s own register still says placement. Pei Hanzhang has been one rung under Grand Ascension for a century and a half and has never once asked for the entry to be corrected, and anybody who works out why understands the Azure family better than the Azure family does.'
    },
    'sect-azure-cloud-pavilion': {
        highestOrdinal: 41,
        climbedYearsAgo: 380,
        climbedWhere:
            'The gorge vein beneath the Pavilion itself, worked continuously by one person for the better part of two centuries while the sect around her was an ordinary Third Sill tenant paying an ordinary tribute.',
        ageNote:
            'Late Age throughout, which is the part nobody can explain away. Ru Anjing did not climb in a richer era; she climbed in this one, on a vein a court had already assessed and priced, and every faction that insists the road is closed has to hold her at arms length to keep saying it.',
        whyNobodyHasSince:
            'The Pavilion has produced exactly one more at the last realm in three hundred and eighty years and produced them slowly. It teaches what she left, and what she left is a record of a divestment rather than a method, so the sect is in the position of having the outcome and not the working.',
        settledBelief:
            'The province holds that the Pavilion knows something. The Pavilion has never said otherwise, has never said what, and has been living off the difference for three centuries.'
    },
    'sect-stonewright-consortium': {
        highestOrdinal: 33,
        climbedYearsAgo: 210,
        climbedWhere: 'The Weiring vein in a province two borders east, which the Consortium assayed, worked and published the closing figure on eighty years ago.',
        ageNote: 'Late enough to be recorded properly and early enough to still be ordinary: the Consortium can name the year, the vein and the surveyor, which is more than most factions at this height can do.',
        whyNobodyHasSince: 'The vein that carried him is closed, by an assay the Consortium published itself, and nothing on its books has carried a climb like that since. It buys its high-realm members now rather than growing them, which is a policy and not an accident.',
        settledBelief: 'Every Rate-Setter in the house will tell you the ground for it no longer exists. They are describing their own ledger accurately and treating that as a description of the world, which is the house error in one sentence.'
    },
    'house-quiet-cut': {
        highestOrdinal: 33,
        climbedYearsAgo: 240,
        climbedWhere: 'A province since drawn down to nothing, worked quietly while the house had no name and no clients worth recording.',
        ageNote: 'The generation before the drawdown, when a cutter could take the years the road needs without buying the ground to take them on.',
        whyNobodyHasSince: 'No Last Cut in two hundred years. Severance never depended on ambient qi, but the decades it takes do, and the house cuts its own records rather than keep a count of how long it has been.',
        settledBelief: 'The Trade holds it settled that the road tops out where it now tops out. The Doctrine faction does not, and this is one of the several things the two of them no longer discuss.'
    },
    'house-measured-span': {
        highestOrdinal: 34,
        climbedYearsAgo: 260,
        climbedWhere: 'The terminal network, across nine more open gates than the house now holds, cultivating in transit the way surveyors do.',
        ageNote: 'The last age in which the road itself was rich: the span between two working terminals carried qi the walked distance never did.',
        whyNobodyHasSince: 'Twenty-two of thirty-one terminals are closed and the house cannot reopen one, so most of the road that made a Keeper is simply not there. Its Elder Surveyors stall in the mid-twenties on the routes that remain.',
        settledBelief: 'The Freight faction takes it as established that a Keeper is a thing the house used to make. The Long Measure keeps insisting otherwise and is regarded, affectionately, as unserious.'
    },
    'sect-nine-abyss-flame-sect': {
        highestOrdinal: 34,
        climbedYearsAgo: 110,
        climbedWhere: 'The vent vein under the caldera, when it still ran hot enough that a Flame Hall Master could work it without a grant day.',
        ageNote: 'Within living memory, barely, which is why the sect believes the road is still open and behaves accordingly.',
        whyNobodyHasSince: 'The vent has thinned measurably and the last three sovereign-track candidates stalled at Deity Transformation. The sect blames the transformation contract rather than the caldera; its own tribute records show the yield falling in step.',
        settledBelief: 'Alone among the high factions, this one has not concluded that the road is shut - which reads as either the only clear sight in either province or the contract talking, and nobody outside the caldera can tell which.'
    },
    'sect-frostmirror-court': {
        highestOrdinal: 36,
        climbedYearsAgo: 400,
        climbedWhere: 'The cold vein under the glacier, forty spans deeper into the ice than the working face now reaches.',
        ageNote: 'Four centuries back, when the ice ran deep enough that the curriculum could be practised at the depth it was written for.',
        whyNobodyHasSince: 'The glacier has retreated and the cold vein with it. Every Court Sovereign since has stopped at Core Formation Perfection, and the Court has quietly stopped teaching the deepest three inscriptions because nobody has reached the state they describe in four hundred years.',
        settledBelief: 'The Court teaches that those inscriptions describe something no longer available. It says "no longer available" rather than anything stronger, which is the most carefully worded position any faction in the catalog holds on the subject, and it is not an accident.'
    },
    'house-anchorhold': {
        highestOrdinal: 35,
        climbedYearsAgo: 340,
        climbedWhere: 'The eastern perimeter, when the scar behind it was still active enough that standing a watch on it was cultivation rather than administration.',
        ageNote: 'The generation after the Girdle, when the house was holding a live containment rather than maintaining a quiet one.',
        whyNobodyHasSince: 'The scar has gone quiet, which is the entire purpose of the house and also why its own people no longer advance on the watch. Two perimeters run below the standard the house publishes, and the Datum faction argues it is now a survey office with a legend attached.',
        settledBelief: 'Taken as settled inside the house that a Standing Anchor was something the live containment produced and that the containment has finished producing. The published wake schedule for Xu Ci is, read closely, an admission that nobody expects to replace her.'
    },
    'sect-storm-tyrant-court': {
        highestOrdinal: 34,
        climbedYearsAgo: 300,
        climbedWhere: 'The floating stone, while the tether still drew and the vein under it could be reached at the bottom.',
        ageNote: 'Three centuries back, before Yan Kuo concealed that the tether was failing - the last window in which the road of the Court ran the whole way up.',
        whyNobodyHasSince: 'Nobody anywhere is recorded as having made this climb in three hundred years. Locally it is worse: no Storm Elder has passed Nascent Soul in a century, and the Court has stopped opening the vault at successions rather than explain why.',
        settledBelief: 'It is taken as settled across both provinces that this height is shut, and the Court is the loudest voice saying so - which is convenient, since it is also the faction that would otherwise be asked how it still has one.'
    },
    'sect-the-severed': {
        highestOrdinal: 38,
        climbedYearsAgo: 180,
        climbedWhere: 'Six cities and no ground at all, on the fastest road anyone has ever found and at the price the road charges.',
        ageNote: 'The last generation for whom paying in advance was enough, and the house has never established whether what changed was the ground or the people.',
        whyNobodyHasSince: 'Nobody on the road has passed Void Refinement Late in a hundred and eighty years, and the house presents this as patience. The last person who could have described how that climb was actually made is dead, and the house cuts its own records, so there is no account left to read.',
        settledBelief: 'Every competent party in either province takes it as settled that the top of the ladder is closed in this age. The Severed decline to correct the belief, on the reasoning that a road nobody believes in is a road nobody competes for, and their own Nameless have stopped saying either way.'
    }
};

export function getHighRealmProvenance(factionId: string): HighRealmProvenance | undefined {
    return HIGH_REALM_PROVENANCE[factionId];
}

/**
 * Factions whose strength is a fact about a previous age rather than this one.
 * Takes its threshold as an argument rather than restating an engine number:
 * pass the engine constant here once one exists.
 */
export function survivorsOfARicherAge(aboveOrdinal: number = HIGH_REALM_THRESHOLD): {
    factionId: string;
    provenance: HighRealmProvenance;
}[] {
    return Object.entries(HIGH_REALM_PROVENANCE)
        .filter(([, p]) => p.highestOrdinal > aboveOrdinal)
        .map(([factionId, provenance]) => ({ factionId, provenance }));
}

// ─────────────────────────────────────────────────────────────────────────
// DORMANT ARTS - present, complete, proven, and unperformed
//
// The fourth state of an absent art, and the least dramatic of the four, which
// is exactly why it is the most useful. The other three are all about something
// being GONE:
//
//   abandoned          The era moved on, by choice. It works; nobody wants the
//                      bargain. `ANCIENT_ARTS` in `lost-ages.ts`.
//   lost               The method survives, the material does not. Involuntary.
//                      The same file, where `upkeepHerbId` is set.
//   no surviving copy  The last copy is gone. `NO_SURVIVING_COPY_TECHNIQUE_IDS`
//                      in `techniques.ts`, with a stated reason each.
//
//   dormant            Nothing is missing. The book is on the shelf, it is
//                      complete, the house knows it works, and there is nobody
//                      there who can perform it.
//
// WHY THIS ONE IS WORTH HAVING. It makes an institution's HISTORY load-bearing
// in the present. `production` already records the gap between what a house can
// reliably turn out and what it once could, and for most of the catalog that
// gap is atmosphere - a number that says which kind of decline somebody is in.
// A dormant holding converts it into an object: the person at the peak
// practised something, the archive kept it, and it is still there. A house at
// the bottom of a long fall is therefore a better prospect than its roster
// looks, and that is a strategic fact a player can act on rather than a mood.
//
// "THEY KNOW IT WORKS" IS THE POINT, AND IT IS NOT HEDGED.
// This is deliberately unlike `claimsLivingAncestor` and `claimIsTrue` in
// `sects.ts`, which are two fields precisely because houses frequently do not
// know what they are claiming. Here they do. Somebody in this house did it, it
// is written down with the names and the year, and the house will say so
// without embellishment and without apology. `evidence` is that certainty and
// it must always be a specific record rather than a tradition - the moment it
// becomes "it is said that", this is a rumour and belongs somewhere else.
//
// THREE RULES.
//
//   1. NOT ON THE TEACH LIST. `SECTS[].teaches` is a house's entire WORKING
//      library and no sect teaches a ruin- or grave-provenance art. A dormant
//      holding is by definition not working, so it never appears there, and
//      the catalog suite checks it. That is what keeps `provenance` honest:
//      a shelved book nobody can open is not a living transmission and does
//      not make one exist.
//
//   2. OUT OF REACH IN FACT, NOT IN POLICY. The art's `requiredOrdinal` stands
//      above the faction's `powerOrdinal` - above its strongest living member,
//      not merely above what it reliably produces. Nobody is refusing anybody.
//      There is simply no hand in the building high enough, and the house is
//      the party most aware of it.
//
//   3. LEARNABLE. Every row says what it would take, because a destination
//      nobody can reach is scenery. The terms are the interesting part: a house
//      that cannot use a thing has very little reason to be precious about it,
//      and several of these are cheaper to obtain than arts a quarter as good.
//
// It composes with the other three rather than replacing them, and the overlap
// is real: the Measured Span's holding is dormant AND lost, because the house
// is short of the rung and short of the material, and either shortage alone
// would be enough. `ARCHIVE_COPIES` in `lost-ages.ts` already covers houses
// that hold an ancient book they cannot FEED - the Ashen Forge and its spears,
// which nobody there has ever had the rung to open - so those are not repeated
// here. That row is the same idea reached from the material side, and one fact
// in two tables is one too many.
//
// NO NUMBERS IN THE PROSE. How many rungs short a house is, and how long it has
// been, are both derivable - from `requiredOrdinal` against `powerOrdinal`, and
// from `production.yearsSinceLastPeak` - so neither is written down here. A
// figure restated in a description is a figure that goes stale silently.
// ─────────────────────────────────────────────────────────────────────────

export interface DormantArt {
    /** The institution holding it. A sect or a Dao house; the form does not matter. */
    factionId: string;
    /** The art, by its row in `techniques.ts`. */
    techniqueId: string;
    /**
     * How the art came to be on these shelves. Always a specific event with a
     * party attached, never "it has always been here".
     */
    howItGotHere: string;
    /**
     * WHY THEY ARE CERTAIN IT WORKS. The load-bearing field, and the one that
     * separates this state from a legend. A record with names, an outcome, and
     * a date - not a tradition and not a claim. If this reads as belief rather
     * than as evidence, the row is in the wrong table.
     */
    evidence: string;
    /**
     * What the house says about not being able to perform it, in its own voice.
     * Institutions are rarely neutral about their own ceiling and the variety
     * is the content: one is embarrassed, one is indifferent, one has built a
     * ceremony out of it.
     */
    howTheHouseTalksAboutIt: string;
    /**
     * What it would take for an outsider to be taught it. Never money alone -
     * the same rule `LIVING_TRANSMISSIONS` is held to - and never impossible,
     * because a learnable art nobody can learn is a locked door with a sign on
     * it.
     */
    terms: string;
}

export const DORMANT_ARTS: readonly DormantArt[] = [
    // ── DAO HOUSES: the discipline outlived the capacity ─────────────────
    // A house is a lineage and its accumulated understanding sits on whoever
    // happens to have been born. Thousands of years of one principle, and no
    // way to hire around a thin generation - so the archive routinely holds
    // the far end of a road the family is no longer walking. The houses are
    // not distressed about this in the way a sect would be. It is the form
    // working as designed, and they say so.
    {
        factionId: 'house-bound-word',
        techniqueId: 'sixteen-thread-command',
        howItGotHere:
            'Deposited in the treaty vault by the parties to a nullification, four ages ago, as part of the settlement - the House took custody of the method on the understanding that custody is not use, and has held it under the same terms ever since. It is catalogued as an exhibit rather than as a book.',
        evidence:
            'Three voided agreements in its own vault, each with the sworn party named, the witnessing oathwright named, and a marginal note in the oathwright\'s hand recording that the signatory\'s hand moved and the signatory did not. The House does not treat these as disputed. It treats them as the reason the method is in the vault.',
        howTheHouseTalksAboutIt:
            'Plainly, and slightly too often. The Bound Word regards holding the one art that makes a witnessed agreement meaningless as the strongest possible argument for its own necessity, and every oathwright can recite what it does. None of them can do it, and the House has never pretended the two facts are related.',
        terms:
            'Swear to the House first - a real oath, witnessed, with a penalty clause the House writes - and then ask. It will teach on those terms to almost anybody, because a party bound by an oathwright\'s own clause is the one kind of person it is not afraid to hand this to. What it will not do is teach somebody who has sworn nothing, and that refusal is doctrine rather than caution.'
    },
    {
        factionId: 'house-ninefold-ledger',
        techniqueId: 'debt-collection-in-arrears',
        howItGotHere:
            'Inherited with everything else when the Ledger took the Tally Court\'s position. The official version is that the method was seized and sealed; the archive shelf-mark is continuous with the Tally Court\'s own numbering, which is what a transfer looks like rather than what a seizure looks like.',
        evidence:
            'The Tally Court\'s case books came across with it, and they are not summaries. Forty-one collections, each with the original transaction, the generations it crossed, the person it was finally taken out of, and what was left of them. The Ledger audits its own archive on a cycle and the case books are audited with everything else, which is how it knows the run is complete.',
        howTheHouseTalksAboutIt:
            'It does not. The Ledger will confirm the holding to anybody who asks in the correct form and will not discuss it otherwise, and the internal position - that a house of karma is obliged to understand the instrument that turns inherited obligation into a single ruinous demand - is written down in one place and read by successors.',
        terms:
            'Bring it a debt it cannot trace. The Ledger has never been able to reconstruct what the Tally Court was actually dissolved for, and the one thing it wants more than stones is the end of a thread it has followed twice and lost twice in the same century.'
    },
    {
        factionId: 'house-measured-span',
        techniqueId: 'hollow-second-body',
        howItGotHere:
            'Carried back from the terminal network in the age the road itself was rich, by a Keeper who was surveying gates that no longer open and appears to have collected it the way surveyors collect things - because it was there, and because it was about being in two places.',
        evidence:
            'The survey of record. A Keeper\'s route book from that age logs two simultaneous measurements at terminals nine days apart, in one hand, initialled at both ends, and the Span has never had any instrument that would let it lie to itself about where something was. Every Surveyor who has read the route book has reached the same conclusion and none of them enjoyed it.',
        howTheHouseTalksAboutIt:
            'As the sharpest thing in the archive and the most useless. The house that understands space better than anybody alive holds the one method for occupying two pieces of it, and is a rung under the hand it needs - a fact the Long Measure faction raises at every opportunity and the Freight faction regards as the whole argument against them.',
        terms:
            'Open a terminal. Not find one, not survey one - open one, and let the house watch. Twenty-two of them are closed and the Span cannot reopen a single one, and it has said in writing that anybody who can will be given whatever they ask for out of the archive.'
    },

    // ── SECTS: a deep foundation, and the shelf that proves it ───────────
    // The other half, and the coordinator's phrase for it is exact: a sect
    // with a deep enough foundation holds techniques nobody currently
    // practises, and they know it works. `production.peakOrdinal` against
    // `reliableOrdinal` is where these come from - the house produced somebody
    // once, that person practised something, and the archive is the evidence.
    {
        factionId: 'sect-sweptground-temple',
        techniqueId: 'canon-of-the-unwritten-span',
        howItGotHere:
            'Sent down. The First Abbot crossed and afterwards writings arrived, in a hand the Temple has always maintained is his, addressed to a place that had no name yet and left where anybody could pick them up. The Temple has never had a story about how they arrived and has never felt it needed one.',
        evidence:
            'The founding record, which is the only document the Temple keeps and the only thing it has ever been careful with. It is contemporaneous, it names the Abbot, it dates the arrival, and the province\'s objection to it has always been that a poor temple would say that - never that the document is wrong. Nobody has ever examined it and found a problem, largely because nobody has ever asked to examine it.',
        howTheHouseTalksAboutIt:
            'Without embarrassment and without any interest in being believed. The Abbot will hand the writings to a visitor who asks, will confirm that no monk in twenty-six centuries has got past the opening, and considers both facts unremarkable. The younger monks want the whole holding submitted to the Ninefold Ledger for certification. The Abbot refuses, on the ground that a certified archive would change who comes to the gate.',
        terms:
            'Ask, and be the sort of person who was going to be let in anyway. There is no price, no service and no test - the Temple takes intake nobody else will accept and hands its writings to anybody who wants to sit with them, which is why nobody in either province takes the holding seriously. What it does not offer is a teacher, because it has never had one.'
    },
    {
        factionId: 'sect-sweptground-temple',
        techniqueId: 'the-fifteenth-breath',
        howItGotHere:
            'The same delivery, and the Temple has always held that this one is the reason for the others - a man explaining, to nobody in particular, how he left.',
        evidence:
            'It is internally consistent with the founding record\'s account of the departure in three details the founding record does not explain and this does, and the founding record was closed and shelved before the writings arrived. The Temple noticed this four hundred years ago, wrote it in the margin, and did nothing else about it.',
        howTheHouseTalksAboutIt:
            'It is read aloud once a year, in full, to monks who cannot perform a word of it, and the Temple does not describe this as a ceremony. It describes it as making sure somebody has read it recently.',
        terms:
            'The same as the rest: sit down and ask. It is the least guarded writing above the Lid in the world, and the reason is that the Temple keeps no accounts and has never worked out that a thing can be worth something.'
    },
    {
        factionId: 'sect-sweptground-temple',
        techniqueId: 'one-crossing-of-a-courtyard',
        howItGotHere:
            'Third of the same delivery and the one the Temple is least comfortable with, because it is not an explanation of anything - it is a working, set down in order, for a reader who is not there.',
        evidence:
            'Three archives hold the incident the art is named after and none of them holds the method. The Temple holds the method and has never held the incident, keeps no accounts, and has therefore never once been in a position to connect the two - which is the strongest argument anybody has that the writings were not assembled after the fact by somebody who had read the accounts.',
        howTheHouseTalksAboutIt:
            'It is shelved with the others and is not read aloud. Pressed, the Abbot says the Temple does not have an opinion about it, which is the only question in the catalog he answers shortly.',
        terms:
            'Ask. And the Temple will mention, without being asked, that the last three people who came specifically for this one did not come back to say how they got on.'
    },
    {
        factionId: 'sect-storm-tyrant-court',
        techniqueId: 'calamity-word-of-the-open-sky',
        howItGotHere:
            'It is the second item on the vault list, and the vault list is read out at every succession in order, from the record. The Court cannot say how it was acquired, because the acquisition entry is one of the ones that has been read aloud so many times it has stopped being a sentence anybody parses.',
        evidence:
            'The Court produced somebody who could use it, and the outcome is on the ground. There is a stretch of the eastern approach where nothing has grown in three and a half thousand years and the Court has never claimed it as a monument, because claiming it would invite the question of who was standing in it. Two Storm Elders have surveyed it privately and neither published.',
        howTheHouseTalksAboutIt:
            'It has built a ceremony out of describing the thing instead of opening the door to it. The vault has not been opened in four centuries and the description has become the succession, which is a comfortable arrangement right up against a genuine fear - at least two Storm Elders privately doubt the book is still in the room, and the Court has arranged its own institutions so that nobody has to find out.',
        terms:
            'Get the vault opened, which nobody inside the Court can do without ending a career. The Thunder Wardens would hand the book to a competent outsider in exchange for the door being opened in front of witnesses, and have said as much to two people. The Storm Tyrant\'s position is that the claim is the Court\'s only remaining asset, and he is not wrong about that either.'
    },
    {
        factionId: 'sect-the-severed',
        techniqueId: 'rebirth-in-the-lotus-furnace',
        howItGotHere:
            'It was on the road. The Severed do not acquire things so much as arrive at them, and this one came in with somebody who had already paid for it somewhere else and did not survive long enough to be asked where.',
        evidence:
            'Itemised, like everything here. The house takes payment in advance and writes down what it took, and there are two ledger entries from before the drawdown recording a Nameless who paid for the furnace, went in, and was afterwards billed for a different body. The Severed cut their own records as a matter of doctrine and these two were not cut, which inside the house is the strongest possible statement about their accuracy.',
        howTheHouseTalksAboutIt:
            'As patience. The house presents its whole ceiling as patience, and this is the item that makes the presentation hardest to sustain, because the furnace is not a road anybody is on - it is a thing one person did once and nobody since has been able to pay for, in the currency the house is actually short of, which is rungs rather than stones.',
        terms:
            'The ordinary Severed price, taken first and itemised in advance, and the house will not tell an applicant what it intends to take until the list is written. It is the only faction in the catalog that will hand over an art above its own ceiling as a matter of routine, and the reason is that the price is collected either way.'
    }
];

const DORMANT_BY_FACTION: ReadonlyMap<string, readonly DormantArt[]> = (() => {
    const map = new Map<string, DormantArt[]>();
    for (const row of DORMANT_ARTS) {
        const bucket = map.get(row.factionId);
        if (bucket) bucket.push(row);
        else map.set(row.factionId, [row]);
    }
    return map;
})();

/** What this institution holds, complete and proven, that nobody there can perform. */
export function dormantArtsOf(factionId: string): readonly DormantArt[] {
    return DORMANT_BY_FACTION.get(factionId) ?? [];
}

/** Everywhere a given art is sitting on a shelf nobody in the building can open. */
export function whoHoldsDormant(techniqueId: string): readonly DormantArt[] {
    return DORMANT_ARTS.filter(d => d.techniqueId === techniqueId);
}

/**
 * Institutions worth more than their roster, because the archive outlived the
 * capacity. The single most useful read on this table: it is the list of houses
 * a player should join for what is on the shelf rather than for who is standing
 * in the yard.
 */
export function factionsHoldingDormantArts(): string[] {
    return [...DORMANT_BY_FACTION.keys()];
}

// ─────────────────────────────────────────────────────────────────────────

export function getFactionCharacter(factionId: string): FactionCharacter | undefined {
    return FACTION_CHARACTER[factionId];
}

export function getProductionTier(factionId: string): ProductionTier | undefined {
    return FACTION_CHARACTER[factionId]?.production;
}

/**
 * How far a faction's strongest member stands above anything it can still
 * produce. A large gap is a faction living on inheritance, and the number is
 * the clearest single read on which kind of decline it is in.
 */
export function inheritanceGap(factionId: string, powerOrdinal: number): number {
    const tier = FACTION_CHARACTER[factionId]?.production;
    return tier ? powerOrdinal - tier.reliableOrdinal : 0;
}

/**
 * Which of the five states a house is in, derived rather than declared.
 *
 * See the file header for what each one means. The order of the tests is the
 * definition: a house that is MOVING is described by where it is going, and
 * only a house that is not moving is described by where it has been.
 *
 * Takes `powerOrdinal` as an argument for the same reason `inheritanceGap`
 * does - this file does not import the sect catalog.
 */
export type ProductionState =
    | 'declining'
    | 'at-peak'
    | 'complete'
    | 'ascending'
    | 'well-stocked';

export function productionState(factionId: string, powerOrdinal: number): ProductionState | undefined {
    const p = FACTION_CHARACTER[factionId]?.production;
    if (!p) return undefined;
    if (p.climbingToward !== undefined && p.climbingToward > p.reliableOrdinal) {
        return p.waitingOn === 'time' ? 'well-stocked' : 'ascending';
    }
    if (p.peakOrdinal > p.reliableOrdinal) return 'declining';
    return p.reliableOrdinal >= powerOrdinal ? 'complete' : 'at-peak';
}

/**
 * Whether a house is held back by its shelf or by its stores.
 *
 * `shelfCapOrdinal` is the cap of the best cultivation manual the house
 * teaches, which lives in `techniques.ts` by way of `sects[].teaches`. It is
 * passed in rather than imported so that this file stays a description of
 * institutions and does not acquire a dependency on the technique catalog -
 * and so that a shelf which grows moves the diagnosis on its own.
 *
 * 'manual' - it delivers everything its books can, and the next rung needs a
 *            book it does not have.
 * 'resource' - it owns a book it cannot walk anybody to the end of. This is the
 *            common case and it is the one the gap was always about.
 */
export type ProductionConstraint = 'manual' | 'resource';

/**
 * A manual's `cap` is `realmEnd + 1`, so the top rung of a book is a HANDOFF to
 * wherever the next book opens rather than somewhere the house puts people.
 * A house delivering `cap - 1` has therefore delivered everything its shelf
 * holds, and one more rung needs a different book rather than more pills.
 */
const HANDOFF_RUNG = 1;

export function productionConstraint(
    factionId: string,
    shelfCapOrdinal: number
): ProductionConstraint | undefined {
    const p = FACTION_CHARACTER[factionId]?.production;
    if (!p) return undefined;
    return p.reliableOrdinal >= shelfCapOrdinal - HANDOFF_RUNG ? 'manual' : 'resource';
}

/** Everything working toward a named target today, and what each one waits on. */
export function ascendingFactions(): {
    factionId: string;
    climbingToward: number;
    waitingOn: NonNullable<ProductionTier['waitingOn']>;
}[] {
    return Object.entries(FACTION_CHARACTER)
        .filter(([, c]) =>
            c.production.climbingToward !== undefined
            && c.production.climbingToward > c.production.reliableOrdinal)
        .map(([factionId, c]) => ({
            factionId,
            climbingToward: c.production.climbingToward!,
            waitingOn: c.production.waitingOn ?? 'access'
        }));
}

/**
 * Factions that have lost ground - `peak` above `reliable` - worst first.
 *
 * This is the raw arithmetic and not the state: a house climbing back toward a
 * peak it once held appears here too, because it HAS lost the ground, and
 * `productionState` is what says whether it is still falling. Use that for the
 * five-way read and this for how far anybody has fallen.
 */
export function decliningFactions(): { factionId: string; lost: number; yearsSinceLastPeak: number }[] {
    return Object.entries(FACTION_CHARACTER)
        .map(([factionId, c]) => ({
            factionId,
            lost: c.production.peakOrdinal - c.production.reliableOrdinal,
            yearsSinceLastPeak: c.production.yearsSinceLastPeak
        }))
        .filter(row => row.lost > 0)
        .sort((a, b) => b.lost - a.lost);
}
