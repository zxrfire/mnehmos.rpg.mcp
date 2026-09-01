/**
 * What the columns on the standing register mean.
 *
 * A reading aid rather than catalog data, which is why it lives here and not in
 * `data/cultivation/`. Every term below is a heading, a chip or a column value
 * somewhere on the sheet, and several are ordinary English words used in a
 * narrower sense than an operator would assume - `standing`, `stock`, `gate`
 * and `state` especially. A panel whose columns have to be explained somewhere
 * else is a panel people misread.
 *
 * ── Why the groups carry an intro ────────────────────────────────────────
 *
 * A flat list of terms forces every entry to establish its own context, and
 * that fails in both directions at once. Entries that share a concept end up
 * restating it - two definitions of the same thing, and a reader who has to
 * work out whether they are looking at two states or one. Entries that define a
 * gradation skip it instead, and `light / medium / heavy` is unreadable to
 * anybody who was never told what is being drawn down.
 *
 * So the concept is stated once, at the top of the group, and each term below
 * defines only what makes it different from its siblings. If an entry could be
 * deleted without losing anything the intro does not already say, it should be.
 *
 * ── The rules the entries are held to ────────────────────────────────────
 *
 *   1. Every term here is shown somewhere on the register. Nothing defines a
 *      column the sheet stopped printing.
 *   2. Every vocabulary the register prints is covered. Both directions.
 *   3. No two entries define the same thing. Where they overlapped, one of them
 *      was wrong and both were confusing.
 *   4. Figures come from the engine's constants, never restated by hand. The
 *      ladder has been re-cut twice under this file and hand-copied numbers are
 *      what went stale first.
 */

import {
    MAX_ORDINAL,
    TOTAL_RANKS,
    FALSE_IMMORTAL_ORDINAL,
    TRUE_IMMORTAL_ORDINAL,
    OBJECT_CEILING_BELOW_THE_LID,
    MANUALS_MAY_EXCEED_THE_LID,
    REALM_TIERS,
    rankName
} from '../engine/cultivation/realms.js';
import { APEX_INSTITUTIONS } from '../data/cultivation/hierarchy.js';
import { GRADE_ORDER } from '../data/cultivation/techniques.js';

/** Looked up by key, never by index: the tier list has grown twice already. */
const tier = (key: string) => REALM_TIERS.find(t => t.key === key)!;

const IMMORTAL = tier('immortal');
/** The last realm anybody climbs into rung by rung. */
const LAST_CLIMBED = tier('tribulation_transcendence');
/** The three destinations an immortal object can cap at. */
const DEITY = tier('deity_transformation');
const VOID_REFINEMENT = tier('void_refinement');
const GRAND_ASCENSION = tier('grand_ascension');
/** The realm whose sub-ranks show most plainly that the vocabulary is local. */
const BODY_INTEGRATION = tier('body_integration');

export interface GlossaryEntry {
    term: string;
    meaning: string;
}

export interface GlossaryGroup {
    group: string;
    /**
     * The concept, in two or three sentences: what this axis is, why the
     * register tracks it, and what a reader is looking at when they meet it on
     * a card. Everything the terms below would otherwise have to repeat.
     */
    intro: string;
    entries: readonly GlossaryEntry[];
}

export const GLOSSARY: readonly GlossaryGroup[] = [
    // ── the unit every number on the sheet is in ───────────────────────
    {
        group: 'The ladder',
        intro:
            `Every number on this sheet is a rung on one ladder of ${TOTAL_RANKS} ranks, ordinal 0 to `
            + `${MAX_ORDINAL}, and the same ladder measures a person and a faction. Realms group the rungs `
            + `and name them; the sub-rank vocabulary belongs to the realm rather than to the ladder, so `
            + `${DEITY.name} counts ${DEITY.subRanks[0]} to ${DEITY.subRanks[DEITY.subRanks.length - 1]} `
            + `and ${BODY_INTEGRATION.name} names the four things it has joined. The top realm is the one `
            + `stretch nobody climbs into.`,
        entries: [
            {
                term: 'Ordinal',
                meaning:
                    `The rung, 0 to ${MAX_ORDINAL}. Against a faction it means the realm of the strongest `
                    + 'member who will actually answer - takes a challenge, walks a border, sits at a '
                    + 'negotiation. It orders this whole sheet, and it is never what a faction could field '
                    + 'once at cost.'
            },
            {
                term: 'Realm boundary',
                meaning:
                    'The rung where the next step is into a different realm. It costs far more than the '
                    + 'steps inside a realm and it is where the great majority of careers end. Within a '
                    + 'realm the cost still rises at every rung: no rung on the ladder is ever cheaper '
                    + 'than one below it.'
            },
            {
                term: rankName(FALSE_IMMORTAL_ORDINAL),
                meaning:
                    `Ordinal ${FALSE_IMMORTAL_ORDINAL}. The crossing was survived and did not complete, so `
                    + 'this is the landing on the near side of the Lid: above every mortal rank, permanently '
                    + 'below the rung it was reaching for, and not a lesser grade of the other outcome. '
                    + 'Reached no other way, left by no route at all.'
            },
            {
                term: rankName(TRUE_IMMORTAL_ORDINAL),
                meaning:
                    `Ordinal ${TRUE_IMMORTAL_ORDINAL}, the summit. The crossing completed and the far side `
                    + 'is where they are. Nothing accumulates into it and no object in this catalog delivers '
                    + 'anybody near it.'
            },
            {
                term: 'Above the Lid',
                meaning:
                    `Both rungs of ${IMMORTAL.name}, taken together. Progress there is not denominated in `
                    + `qi at all - the engine returns no figure rather than a large one - which is why the `
                    + `cost column stops at ${FALSE_IMMORTAL_ORDINAL} instead of continuing with bigger `
                    + 'numbers.'
            }
        ]
    },

    // ── the four columns on every dossier ──────────────────────────────
    // ── the four questions an entry is read to answer ──────────────────
    {
        group: 'The assessment',
        intro:
            'An entry on this sheet is read by somebody deciding something - whether to join a faction, '
            + 'lean on it, avoid it, or count it in a war - so it opens with the four things that '
            + 'decision turns on and keeps the prose underneath. None of it is written for the sheet: '
            + 'every line is a field the catalogs already hold, put in the order a reader needs rather '
            + 'than the order it happens to be stored in.',
        entries: [
            {
                term: 'Can field now',
                meaning:
                    'Who answers a challenge this afternoon. It is the same number as the faction ordinal '
                    + 'and it is the one almost everybody outside the house is working from.'
            },
            {
                term: 'Could field once',
                meaning:
                    'What the house could produce a single time, at a cost it usually cannot pay twice. '
                    + 'Blank on most factions, and blank is the honest entry: a house whose one-off is '
                    + 'its everyday has nothing in reserve, and printing the first figure again would '
                    + 'suggest it had.'
            },
            {
                term: 'The gap',
                meaning:
                    'The distance between those two, in rungs, with whether anybody outside knows it is '
                    + 'there. A hidden gap is the single most dangerous thing on this page: it means '
                    + 'every rival is pricing that faction low, and one of them will find out.'
            },
            {
                term: 'What it costs',
                meaning:
                    'What spending the one-off actually takes, which is generally the house that spends '
                    + 'it. A reserve that can only be used by ending the institution holding it is not a '
                    + 'weapon, it is a last resort, and the difference decides whether anybody can be '
                    + 'threatened with it.'
            },
            {
                term: 'Produces',
                meaning:
                    'What the house can make from its own intake, against what it happens to contain. A '
                    + 'faction can stand at a rung because somebody walked in; this is the rung it '
                    + 'reaches on its own, and it is the figure that says whether it will still be '
                    + 'standing there in a century.'
            },
            {
                term: 'Counts in',
                meaning:
                    'What this house actually keeps accounts in - deference, unpaid bills, years of '
                    + 'service, crossings owed, nothing at all. It is how the house can be paid, and it '
                    + 'is the most reliable way to predict what it will and will not trade. Absent on the '
                    + 'two apexes nobody can join, which is a hole in the catalog rather than an '
                    + 'institution that trades in nothing, and their entries say so instead of guessing.'
            },
            {
                term: 'Teaches',
                meaning:
                    'The arts this house will actually hand over, resolved against the same catalog the '
                    + 'Arts tab is built from, with the rung each is written for and the grade it sits at. '
                    + 'This is what its people can do, as against what it owns or what rung its head '
                    + 'stands on, and it is the first thing an entry should establish: a library that is '
                    + 'one element end to end says more about a house than any figure on the sheet.'
            },
            {
                term: 'Actually good at',
                meaning:
                    'What it is best at, which is reliably not what it is known for. Reputation fixes on '
                    + 'whatever is legible from the road and then stops updating, so the sheet prints '
                    + 'both and the gap between them rather than picking one.'
            },
            {
                term: 'Do not take at face value',
                meaning:
                    'Where the catalogs disagree with each other or with the house: a claim an audit does '
                    + 'not support, a reserve nobody outside knows about, a practice the house has '
                    + 'quietly stopped. Deliberately narrow: what a house has wrong about itself is true '
                    + 'of very nearly all of them and sits with the other capability fields, because a '
                    + 'marker every entry carries is a marker that has stopped saying anything. An entry '
                    + 'with no flags is one where the catalogs agree with each other and with the house.'
            }
        ]
    },

    {
        group: 'Reading a faction',
        intro:
            'A faction\'s entry describes what it can do rather than what it owns. The fields below are '
            + 'the ones routinely misread as measures of size or wealth: the admission threshold, the '
            + 'one-off reserve, the source of its right to stand where it stands, and two markers of the '
            + 'company it keeps.',
        entries: [
            {
                term: 'Gate',
                meaning:
                    'How somebody gets in, in one of three answers. A number is the minimum ordinal to be '
                    + 'considered at all, and 0 means anyone who walks up. "Closed" means no applicants '
                    + 'under any circumstances. "Adoption" is a dao house, where there is a way in and it '
                    + 'is not an admission day: the house is a family, so an outsider is taken into it - '
                    + 'once in a century, for being extraordinary at the one dao that house exists for - '
                    + 'and printing an ordinal there would name a bar nobody is ever asked to clear.'
            },
            {
                term: 'Ceiling',
                meaning:
                    'What it could put in the world once, at cost, because something sealed under it is '
                    + 'stronger than anything it can field day to day. Shown only where that exceeds the '
                    + 'ordinal, because otherwise it is the ordinal said twice.'
            },
            {
                term: 'Holds from',
                meaning:
                    'Who issues its right to its vein. "Nobody" is a claim about power rather than '
                    + 'paperwork, and most of this register holds on ground nobody granted.'
            },
            {
                term: 'Alignment',
                meaning:
                    'Righteous, neutral or demonic - the dot beside the name. A description of method and '
                    + 'reputation, not of morality: righteous factions are the ones the orthodox world will '
                    + 'deal with openly, demonic ones are the ones it will not, and neutral is most of the '
                    + 'world getting on with its business.'
            },
            {
                term: 'Dao house',
                meaning:
                    'A body that sells a service rather than holding ground - arbitration, verification, '
                    + 'survey, the register of names. Marked because its ordinal means something different: '
                    + 'it buys nobody territory, and the house is dangerous to cross for reasons that have '
                    + 'nothing to do with its ordinal.'
            }
        ]
    },

    // ── who granted the ground ─────────────────────────────────────────
    {
        group: 'Governance',
        intro:
            'The answer to one question: who, if anybody, granted this faction the ground it is standing '
            + 'on. These six are not degrees of one thing and they do not sit on a scale - two of them '
            + 'describe holding from somebody, three describe holding from nobody for three completely '
            + 'different reasons, and one is not in the pyramid at all.',
        entries: [
            {
                term: 'Federated',
                meaning:
                    'Holds from somebody. An apex holds the vein system, courts administer arterial veins '
                    + 'on its behalf, and sects hold a single vein at sufferance on a renewable grant, '
                    + 'paying tribute and disciples. There is a local sect to belong to and somebody nearby '
                    + 'to petition.'
            },
            {
                term: 'Administered',
                meaning:
                    'Holds from somebody, with nobody in between. A power holds its territory itself: no '
                    + 'client sects, no courts, no leases, nothing skimmed - and no feeder either, so it '
                    + 'recruits directly. Joining a federated power means joining a sect; joining a direct '
                    + 'ruler means being processed.'
            },
            {
                term: 'Deference',
                meaning:
                    'Holds from nobody, by reputation. A small faction administers only what it can '
                    + 'comfortably walk and holds a far larger zone because nobody is willing to find out '
                    + 'what happens otherwise. The claim is worth what it was worth the last time it was '
                    + 'tested, and beliefs decay.'
            },
            {
                term: 'Unassailable',
                meaning:
                    'Holds from nobody, by arithmetic. The occupants are individually stronger than '
                    + 'anything that could be sent, everyone has done the sum, and nobody raises it. Unlike '
                    + 'deference this does not decay with time, because it was never a belief.'
            },
            {
                term: 'Unbacked',
                meaning:
                    'Holds from nobody, and pays for it continuously - which is the whole difference from '
                    + 'the two above. Each survivor has one specific reason it has not been absorbed, and '
                    + 'usually that reason is that it has not been worth the trouble yet.'
            },
            {
                term: 'Outside',
                meaning:
                    'Holds no vein by nature rather than by failure. The Dao houses sell services instead. '
                    + 'They are not in the pyramid, which is why they cannot be evicted from it.'
            }
        ]
    },

    // ── the state of the lease, not of the faction ─────────────────────
    {
        group: 'Standing',
        intro:
            'The condition of the grant, and only that. It describes the lease rather than the faction: a '
            + 'formidable sect can be probationary and a weak one in good standing, because what is being '
            + 'rated is how the renewal is going. It is meaningful only for the two governance kinds that '
            + 'hold from somebody.',
        entries: [
            {
                term: 'Good',
                meaning: 'Renewed without discussion, and has been for a long time.'
            },
            {
                term: 'Strained',
                meaning: 'Under pressure. Renewal is no longer a formality and both parties know it.'
            },
            {
                term: 'Probationary',
                meaning:
                    'Conditional on behaviour. The next renewal is the live question, and the faction is '
                    + 'behaving accordingly.'
            },
            {
                term: 'Not applicable',
                meaning:
                    'Holds from nobody, so there is no grant to be in good standing on. Not a bad score - '
                    + 'the absence of the thing being scored.'
            }
        ]
    },

    // ── the warmth words, which are conduct rather than sentiment ──────
    //
    // Beside Standing above rather than folded into it, because they measure
    // different things and a reader who conflates them will misread both.
    // Standing is a property of a GRANT and runs one way: it says how a
    // client's lease is going. A regard is a property of a PARTY and there are
    // always two of them on a tie, so the interesting rows are the ones where
    // the two words differ.
    {
        group: 'How two bodies regard each other',
        intro:
            'One word per side of a relationship, and the two sides are allowed to disagree. It is '
            + 'deliberately about conduct rather than feeling, because conduct is what an outsider can '
            + 'observe: what a body actually does about another body, not what it would say about them. '
            + 'The facts of a tie - who is above whom, what it is, what it is about - are stored once and '
            + 'shared, so only the warmth can be asymmetric, and where it is, that asymmetry is the most '
            + 'useful thing on the row.',
        entries: [
            {
                term: 'Warm',
                meaning:
                    'Glad of them, and will spend on them without being asked. Rare upward and rarer '
                    + 'downward.'
            },
            {
                term: 'Correct',
                meaning:
                    'The forms observed exactly and nothing beyond them. The most common word in the '
                    + 'catalog and the least informative on its own - read it against the other side.'
            },
            {
                term: 'Distant',
                meaning:
                    'No ill will and no contact. Nobody maintains this one, and on two bodies in the '
                    + 'catalog that is a stated policy rather than neglect.'
            },
            {
                term: 'Wary',
                meaning: 'Useful, watched, and not left unattended.'
            },
            {
                term: 'Cold',
                meaning:
                    'The forms observed and the warmth deliberately withheld. Distinguished from correct '
                    + 'by intent: both parties do what the arrangement requires, and only one of them has '
                    + 'decided that is all they will ever do.'
            },
            {
                term: 'Hostile',
                meaning: 'Acted against, or would be if the cost ever fell.'
            },
            {
                term: 'Above / beside / under',
                meaning:
                    'Where the other body stands, read out of the same tables that draw the org chart, so '
                    + 'a relationship can never disagree with the pyramid. Never a claim about strength: '
                    + 'the highest acting body in the world stands beside three apexes and under nobody.'
            },
            {
                term: 'From',
                meaning:
                    'Which table the tie was read out of. Authored means somebody wrote it because no '
                    + 'table held it; everything else names the row it restates - the grant table, the '
                    + 'court table, the rivalry lists, the contested claims, the dao house counters or '
                    + 'the shared events - so a reader can go and check it.'
            }
        ]
    },

    // ── the state column: availability, never rank ─────────────────────
    {
        group: 'What a person is doing',
        intro:
            'The state column answers one question - can this person be met, and by whom - and it never '
            + 'repeats the rank beside it. Rank says what somebody is; state says whether they are '
            + 'available, to what, and at what cost to whoever holds them. The Factions tab sorts each '
            + 'dossier into the same conditions under its own headings - Members, Sealed ancestors, '
            + 'Ascended, Dead and lost.',
        entries: [
            {
                term: 'Acting',
                meaning:
                    'In the world and answering for the faction. The ordinary case, and the one the '
                    + 'faction\'s ordinal is measured from. Heads the Members section of a dossier.'
            },
            {
                term: 'Pinned',
                meaning:
                    'Cannot leave. Holds something in place by being where they are, so the strength is '
                    + 'real and permanently spent - the faction has it and can never send it anywhere.'
            },
            {
                term: 'Withdrawn',
                meaning:
                    'Awake, unsealed, at full strength, and effectively never present. Distinct from '
                    + 'pinned, which cannot leave, and from sealed, which cannot act at all without being '
                    + 'spent. A withdrawn seat could come out and does not.'
            },
            {
                term: 'Sealed',
                meaning:
                    'Alive and unable to act without being spent. A break-glass asset with a stated trigger '
                    + 'and a stated cost, and the cost is generally not survived.'
            },
            {
                term: 'At large',
                meaning:
                    'Held by no institution on this page: unsealed, unsponsored, under nobody\'s orders. '
                    + 'A name in the faction column does not contradict this - being carried on a roll is '
                    + 'not the same as being held by it, and where the two differ this column reports the '
                    + 'hold. Mostly a fact about everybody else: whoever meets them does so with no faction '
                    + 'behind either party, and nobody to petition afterwards.'
            },
            {
                term: 'Ascended',
                meaning:
                    'Through the Lid. Alive on the far side and gone from this one - nothing crosses except '
                    + 'the cultivator, so what they left behind is the whole of what the faction still has '
                    + 'of them.'
            },
            {
                term: 'Failed the crossing',
                meaning: 'Attempted it and did not survive the attempt. A death like any other.'
            },
            {
                term: 'Declined the crossing',
                meaning:
                    'Reached the rung it is attempted from and did not attempt it. Recorded because the '
                    + 'refusal is a fact about the house, and because they then died of something ordinary.'
            },
            {
                term: 'Dead and lost',
                meaning:
                    'The line stops there. The entry exists because what they did still shapes the faction; '
                    + '"lost" means the record stops rather than that anybody watched it end.'
            }
        ]
    },

    // ── the top of the world ───────────────────────────────────────────
    {
        group: 'The apex',
        intro:
            `${APEX_INSTITUTIONS.length} institutions on this sheet are apexes, and the word is a test `
            + 'rather than a rank. Each received something from a founder who crossed, and each is still '
            + 'able to hold it - the second half is what makes an apex, because provenance without the '
            + 'strength to keep it just means somebody else has the object now.',
        entries: [
            {
                term: 'Apex',
                meaning:
                    'A faction that received something from an ascended founder and can hold it. Both '
                    + 'halves, or it is not one.'
            },
            {
                term: 'Sent down',
                meaning:
                    'What that founder sent back through the Lid. Permanent, unreproducible, and the reason '
                    + 'the apex is an apex.'
            },
            {
                term: 'Second seat',
                meaning:
                    'The ordinal of the strongest member after the pinned one. The gap between them is the '
                    + 'honest measure of how deep a position goes - a huge leader above a thin bench is one '
                    + 'accident from being an ordinary sect.'
            },
            {
                term: 'Stock',
                meaning:
                    'How much of the founder\'s divestment is left, from spent to nearly intact. Age runs '
                    + 'backwards here: an ancient faction has depth of position and an empty storehouse, a '
                    + 'young one the reverse.'
            }
        ]
    },

    // ── the layer every tenant actually deals with ─────────────────────
    {
        group: 'A court and its offices',
        intro:
            'A court administers an arterial vein for an apex and issues the grants every tenant beneath '
            + 'it holds on. It does not teach and does not admit, so its titles are the pieces of that job '
            + 'held by one person each, and they do not form a ladder - reading a roster as one is the '
            + 'commonest mistake made about this part of the sheet. Every officer therefore carries two '
            + 'standings at once, and the two routinely disagree.',
        entries: [
            {
                term: 'What it apportions',
                meaning:
                    'The vein this court divides up, in the catalog\'s own words. It is a definition of '
                    + 'the job rather than an introduction to the body doing it, which is why the panel no '
                    + 'longer opens on it: a reader who does not already know the setting learns nothing '
                    + 'from being told that a court administers something.'
            },
            {
                term: 'Office',
                meaning:
                    'What that person does about the vein - measures it, apportions it, drafts it, carries '
                    + 'it. Named for the work and never for a rung, and no office contains another.'
            },
            {
                term: 'Apex rank',
                meaning:
                    'Where the same person stands inside the institution that posted them, in that '
                    + 'that institution\'s own vocabulary. It is the other end of what a posting means, '
                    + 'and it '
                    + 'is the column that decides a room: a courier can stand a mark above the man who '
                    + 'measures the vein while standing eight rungs beneath him on the realm ladder.'
            },
            {
                term: 'Answers for the court',
                meaning:
                    'The one officer marked with a dot. A court\'s ordinal is defined as the strongest '
                    + 'member who will answer, so it names a person rather than a rating - and that person '
                    + 'is not the top of a chain of command, because there is not one.'
            },
            {
                term: 'How it came to answer here',
                meaning:
                    'Shown on the two courts that do not answer where they used to. One changed patrons '
                    + 'and one was promoted inside its own, and the note says which in its first '
                    + 'sentence - so the heading names neither, because a heading that picks one word '
                    + 'for both is wrong on whichever court it was not. Either way the people arrive '
                    + 'holding titles from a ladder that no longer applies, and where the conversion was '
                    + 'not clean is where the grievances are.'
            },
            {
                term: 'A beginner',
                meaning:
                    'Whether a starting cultivator may be told this court exists. It is not a property of '
                    + 'the court: a court is exactly as nameable as the apex above it, so the two hidden '
                    + 'apexes hide their courts and the one with a front gate has a court with one. The '
                    + 'panel prints both ends so the rule can be seen holding rather than asserted.'
            },
            {
                term: 'Also called',
                meaning:
                    'The chip beside a name, on the two bodies that answer to two of them: the name the '
                    + 'province has used for nine hundred years, and the name the apex above it calls the '
                    + 'posting. Such a body is one institution with a row in two catalogs rather than two '
                    + 'neighbours, so it is drawn once, with its offices and its house as the two halves '
                    + 'of the one entry. Neither name is the correct one - the catalog\'s point is that '
                    + 'this has never been settled and nobody has ever been corrected.'
            },
            {
                term: 'The one who got furthest',
                meaning:
                    'Somebody this court took to the last realm and no longer has, with how it ended. It '
                    + 'is the whole difference between a court and an apex stated as a fact rather than a '
                    + 'rank: an apex has such a person sitting on what a founder sent down, and a court '
                    + 'had one. Most courts have never produced one at all.'
            }
        ]
    },

    // ── the third column of force ──────────────────────────────────────
    {
        group: 'Arts',
        intro:
            'What a person knows, as against what they are and what they are carrying. An art is worth an '
            + 'enormous amount inside a realm and nothing whatsoever across the Lid, which is the fact '
            + 'that keeps this table and the object table from being comparable: practise the best art in '
            + 'existence at full mastery and you are still a mortal thing to somebody on the other side. '
            + 'Both directions of who-teaches-what are derived from the sect catalog\'s own teach lists, '
            + 'so they cannot disagree with each other.',
        entries: [
            {
                term: 'Grade',
                meaning:
                    `The band an art belongs to - ${GRADE_ORDER.join(', ')}, ascending. It is a real band `
                    + 'in the catalog rather than a label: it sets the qi the art costs, the range of rungs '
                    + 'it is written across, and how much of it is expected to survive being written down.'
            },
            {
                term: 'Ord',
                meaning:
                    'On this table only, the rung the art was written for - not a bar a reader has to '
                    + 'clear. Nothing stops anybody practising an art above them, and several here are '
                    + 'written for rungs nobody alive stands on.'
            },
            {
                term: 'Reach',
                meaning:
                    'How many people one use lands on - one, the ones either side of them, or a whole '
                    + 'place. It belongs to the art and not to the holder: the word means the same for a '
                    + 'bandit with a wide swing as for somebody at the top of the ladder, and what makes '
                    + 'the second terrible is the ordinary power arithmetic applied once per person '
                    + 'reached. Absent in the catalog means single, so an art with nothing recorded is '
                    + 'shown as single rather than as unknown.'
            },
            {
                term: 'field',
                meaning:
                    'The widest reach, and a difference in kind rather than in degree: the art lands on a '
                    + 'place instead of on a person, and everybody standing in it is in it. Everyone the '
                    + 'user did not mean is included.'
            },
            {
                term: 'Channel',
                meaning:
                    'How a copy reaches somebody, and the only thing that decides how long it takes to '
                    + 'learn. Being shown always beats reading, at every grade.'
            },
            {
                term: 'shown',
                meaning:
                    'A house will demonstrate it. This is what a teach list is, and it is the reference '
                    + 'speed - every other route is measured as a multiple of it.'
            },
            {
                term: 'read',
                meaning:
                    'It survives on a page rather than in anybody\'s hands, so it comes out of a ruin or a '
                    + 'grave. How much of it is lost on the way onto the page runs across the grades '
                    + 'rather than with them: a blunt art reads nearly as well as it is shown, and an art '
                    + 'made of timing and intent barely transmits in writing at all.'
            },
            {
                term: 'Taught by',
                meaning:
                    'Every house that will hand the art over, strongest first. Empty is the interesting '
                    + 'case and does not mean the art is lost - it means every copy is somewhere that '
                    + 'does not teach, which is what makes a grave worth opening.'
            },
            {
                term: 'signature',
                meaning:
                    'The one art a house is known for. It is on the teach list like the others; what the '
                    + 'marker adds is that this is the art the house would be named after in a rumour.'
            },
            {
                term: 'no copy anywhere',
                meaning:
                    'Stronger than having no teacher, and the one state a grave cannot fix. The art is '
                    + 'still named, still remembered and still in this table, and there is nothing left to '
                    + 'learn it from.'
            },
            {
                term: 'elementless',
                meaning:
                    'The art is tied to no element, which is a positive property rather than a missing '
                    + 'field: an elementless art will not conflict with whatever a mixed intake walks in '
                    + 'carrying, which is why the houses that take anybody teach so many of them.'
            }
        ]
    },

    // ── the line to the far side ───────────────────────────────────────
    {
        group: 'Correspondence with the far side',
        intro:
            'Somebody who crossed is alive above the Lid and can, at cost, still send things down - '
            + 'objects, writings, an answer to a question. That line is what a channel is, and holding one '
            + 'outranks any amount of vein wealth: it is the real hierarchy of this world. Channels are '
            + 'finite. Every use spends something on the far side, so a line that has been leaned on for '
            + 'centuries answers less and less.',
        entries: [
            {
                term: 'Answering channel',
                meaning:
                    'Somebody up there still picks up. The strongest thing a faction on this sheet can '
                    + 'have, and the reason the register treats an answering channel as proof a founder is '
                    + 'still alive: an answer is somebody answering.'
            },
            {
                term: 'Personal channel',
                meaning:
                    'A line to one named person rather than to a lineage. It works for exactly as long as '
                    + 'they answer, and it is inherited by nobody.'
            },
            {
                term: 'Parting gift',
                meaning:
                    'No line at all. What is held is what was left behind on the way out, and there is '
                    + 'nobody to call. A faction with a parting gift and no channel has an object and a '
                    + 'story about an object.'
            },
            {
                term: 'Crossings',
                meaning:
                    'How many people this house has ever put through the Lid, and the tier is that count in '
                    + 'words - extraordinary, legendary, supreme, very nearly mythical. It is a count of '
                    + 'history, not of anybody currently available.'
            },
            {
                term: 'Depletion',
                meaning:
                    'How far the channel has been drawn down, on three steps. Light means it still answers '
                    + 'readily; medium means it is being rationed; heavy means long gaps and thin returns, '
                    + 'and a house at heavy is spending the last of something it cannot restock.'
            },
            {
                term: 'The ten or fifteen breaths',
                meaning:
                    'What it costs an immortal to come down and act here, and the reason the figure is '
                    + 'famous. Being shown a thing beats reading about it - a manual cannot answer, correct '
                    + 'or repeat the half-second an art turns on - so a few breaths of an immortal acting '
                    + 'is worth more than the writings a house spent four centuries working through. It is '
                    + 'the only demonstration that rung will ever give.'
            }
        ]
    },

    // ── seals: two axes, routinely confused ────────────────────────────
    {
        group: 'How a seal was built',
        intro:
            'The grade of the workmanship, which decides what the seal costs to keep and whether anybody '
            + 'outside can tell it is there. It says nothing about who is under it or why - that is the '
            + 'next group - and the two are read together or not at all.',
        entries: [
            {
                term: 'Crude',
                meaning:
                    'Cheap to raise and expensive to keep. Burns vein output continuously and cannot be '
                    + 'hidden, because the numbers do not add up and anyone auditing sees it.'
            },
            {
                term: 'Sound',
                meaning: 'The ordinary standard, and one of the ordinary reasons a sect is poor.'
            },
            {
                term: 'Masterwork',
                meaning:
                    'Built by somebody who is no longer available. Draws almost nothing, has not been '
                    + 'serviced in centuries, and is invisible - which is why nobody can say which quiet '
                    + 'mountain has something under it.'
            }
        ]
    },
    {
        group: 'Why somebody was sealed',
        intro:
            'The reason they went under, which decides what waking them can be spent on. Both kinds are '
            + 'assets a faction can use exactly once, and the difference is whether the faction chose the '
            + 'moment or the person was ending anyway. A seal is only an asset if the house can say who is '
            + 'down there and why they agreed, so where the catalog answers that, the entry prints it.',
        entries: [
            {
                term: 'Protector',
                meaning:
                    'Sealed while still whole, deliberately, as a reserve. Waking one spends a weapon the '
                    + 'faction chose to bank, and it can be spent on anything worth a weapon.'
            },
            {
                term: 'Final breath',
                meaning:
                    'Sealed because they were ending anyway, and the seal is what is left of them. '
                    + 'Generally cannot be redirected - what remains is shaped around one act - and waking '
                    + 'one spends the last of somebody already finished.'
            },
            {
                term: 'Vouched for',
                meaning:
                    'The block under a seal answering who he is, what the seal was cut before, whether he '
                    + 'knows what waking will mean, and where the output that paid for it went. Most houses '
                    + 'cannot answer all four - the seal is older than the roster, or the reason was '
                    + 'desperation - and one who comes up with a question about the living is not '
                    + 'reinforcement. The block is absent where the doubt is the point.'
            },
            {
                term: 'Level with the house',
                meaning:
                    'The chip beside a seal, comparing its rung to the faction\'s own. A reserve is not '
                    + 'assumed to outrank what it is held by: a second person at the last realm in a house '
                    + 'counted as having one is a larger fact than a bigger version of the head would be, '
                    + 'and it raises no ceiling, so no ceiling is printed.'
            },
            {
                term: 'Still down there',
                meaning:
                    'People the roll records as under the ground with no seal record behind them - walked '
                    + 'into a vein and did not come out, lay down under a datum, took a position and never '
                    + 'left it. Not a break-glass asset, no trigger and no stated cost, and a different '
                    + 'fact from the seal above it.'
            }
        ]
    },

    // ── the artifact table, which is one table on purpose ──────────────
    {
        group: 'Objects on the ladder',
        intro:
            'Every artifact in the world sits in one table, sorted on one column, with no separate '
            + 'treatment for the top of it. That is the design rather than a convenience: the strongest '
            + 'object and a dead bandit\'s sabre are records of the same kind, made by the same factory '
            + 'and read by the same code, and nothing anywhere branches on which of them somebody is '
            + 'holding. What makes a person hard to kill is the size of the number they are carrying.',
        entries: [
            {
                term: 'Power',
                meaning:
                    `What an object is worth in a fight, on the same ladder of ${TOTAL_RANKS} ranks a `
                    + 'person stands on - so an object and its holder can be subtracted, and the question '
                    + 'of whether a thing is worth more than whoever has it has an answer. It is a combat '
                    + 'rating and not a ranking of importance: the object that decides a province may be '
                    + 'well down the table from the one that decides a room.'
            },
            {
                term: 'The ceiling',
                meaning:
                    'The rule drawn across the table, at the highest power anything finished below the Lid '
                    + 'reaches. It is a boundary of provenance rather than of quality - everything above it '
                    + 'was sent down by somebody who crossed, everything at or below it was made here - '
                    + 'and it is read off the catalog each time, so it disappears if a forge ever passes '
                    + 'it. An object above the line cannot be bought, commissioned or dug up.'
            },
            {
                term: 'The rung ceiling on objects',
                meaning:
                    `A different and harder limit than the one above: no object on this side of the Lid is `
                    + `rated over ${OBJECT_CEILING_BELOW_THE_LID}, ever, whoever made it. An object rated `
                    + 'at a rung lets whoever is holding it strike at that rung, so one rated a step higher '
                    + 'would put a mortal in a position to injure a True Immortal. A manual is under no '
                    + `such rule, because ${MANUALS_MAY_EXCEED_THE_LID ? 'a manual is paper' : 'it is not'}: `
                    + 'an art may be written for any rung at all, and studying one above you to full '
                    + 'mastery leaves you exactly as strong as you were.'
            },
            {
                term: 'Owner',
                meaning:
                    'Whose it is, as the world would judge it. Separate from who is holding it, and often '
                    + 'a different party: nobody is a real answer and a common one.'
            },
            {
                term: 'Held by',
                meaning:
                    'Who physically has it right now, with their own rung beside them where the catalogs '
                    + 'record one - so the two numbers on the line can be read against each other. Someone '
                    + 'standing well under what they are carrying is the interesting case.'
            },
            {
                term: 'In a vault',
                meaning:
                    'The holder is the owning institution itself, so the object is stored rather than '
                    + 'carried. Not a category of object: the same column read twice. A house holding its '
                    + 'own property has it in a vault, and anything else is somebody walking around with '
                    + 'it, which is a completely different problem to plan against.'
            },
            {
                term: 'Standing',
                meaning:
                    'How much bookkeeping the object gets - mundane, notable, significant, legendary. It '
                    + 'governs whether provenance is tracked at all and says nothing about power; a '
                    + 'legendary object and a mundane one are compared on the first column like everything '
                    + 'else.'
            },
            {
                term: 'No entry',
                meaning:
                    'The chip beside an owner the sheet could not resolve to a faction on it. A fault in '
                    + 'the catalog rather than a kind of ownership, printed rather than hidden because the '
                    + 'alternative is a row that silently stops appearing under the house that owns it.'
            }
        ]
    },

    // ── what came down, and what it can do ─────────────────────────────
    {
        group: 'Immortal objects',
        intro:
            'Objects that came down a channel. They cannot be made, repaired or reordered here, so every '
            + 'use is permanent and the world\'s stock only ever falls. Grade caps the destination rather '
            + 'than the distance: every grade performs the same single crossing, from the top rung of one '
            + 'realm to the first rung of the next, and what a higher grade buys is permission to perform '
            + `it further up the ladder. Nothing reaches ${LAST_CLIMBED.ordinalStart}.`,
        entries: [
            {
                term: 'Lower',
                meaning:
                    `Delivers into ${DEITY.name} and no higher. The grade anybody has actually `
                    + 'seen, and the most common holding on this sheet.'
            },
            {
                term: 'Middle',
                meaning:
                    `Delivers into ${VOID_REFINEMENT.name} and no higher - the boundary most careers end at, `
                    + 'and the difference between a regional power and one of the strongest people in a '
                    + 'province.'
            },
            {
                term: 'Higher',
                meaning:
                    `Delivers into ${GRAND_ASCENSION.name} and no higher, the last boundary on the mortal `
                    + 'plane. Still one rung, still only from a Perfection, and still stops dead below '
                    + `${LAST_CLIMBED.name}.`
            }
        ]
    }
];

/** The groups in render order. */
export function glossaryGroups(): GlossaryGroup[] {
    return GLOSSARY.map(g => ({ ...g, entries: [...g.entries] }));
}

/** Every term on the sheet, flattened - for tests and for search. */
export function glossaryTerms(): { group: string; term: string; meaning: string }[] {
    return GLOSSARY.flatMap(g => g.entries.map(e => ({ group: g.group, ...e })));
}
