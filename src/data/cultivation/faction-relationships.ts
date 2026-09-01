/**
 * How each faction stands with the bodies above it, below it and beside it.
 *
 * The catalog already knew a great deal about who answers to whom - a grant in
 * `FACTION_PARENTAGE`, an apex on every court, a rivals list on every sect, a
 * contested claim on most ambitions, a counter on every dao house, a shared
 * event with two accounts of it - and none of it was ever assembled into the
 * one question a reader actually arrives with: *how do these two get on*. This
 * module is that assembly. It adds no faction, no grant and no fight; it reads
 * the tables that already exist, and it carries authored pairs for the ties
 * those tables cannot express.
 *
 * WHY THE PAIR IS THE OBJECT
 * --------------------------
 * A relationship is stored once, as a pair, with two sides on it. That is not
 * tidiness - it is the correctness rule stated in the type.
 *
 *   The FACT is symmetric and is written once. `kind`, `what` and `since` are
 *   single fields on the pair, so there is no way to record that A is patron to
 *   B without B holding from A. A one-directional claim the other side does not
 *   carry is the incoherence this module exists to remove, and the shape of the
 *   data makes it unrepresentable rather than merely tested for.
 *
 *   The FEELING is asymmetric and is written twice. `a` and `b` each carry
 *   their own warmth, their own account of the tie in their own mouth, what
 *   they actually do about it, and a grievance where there is one. A house can
 *   be dutiful upward and brutal downward; a client can be warm to a patron who
 *   is merely correct back. That asymmetry is the interesting part and it is
 *   the reason two mirrored records would have been the wrong shape: mirrored
 *   records let the facts drift, and a pair with two sides cannot.
 *
 * UPWARD AND DOWNWARD ARE NOT DECORATION
 * --------------------------------------
 * `aStandsTo` is where A sits relative to B, and it is read from the same
 * tables that decide the org chart, so a relationship cannot disagree with the
 * pyramid. Every body therefore has relations in three directions and the
 * register shows all three: what it answers to, what answers to it, and what
 * stands level with it. A body warm upward and cold downward is a legible and
 * common shape, and until now nothing anywhere said so.
 *
 * WHAT IS AUTHORED AND WHAT IS DERIVED
 * ------------------------------------
 * Both are data and neither is invented at render time. A derived tie restates
 * a row that already exists - a grant, a rivalry, an event with two accounts -
 * and says which table it came from, so a reader can check it. An authored tie
 * is written here because no table carries it: two bodies with no shared patron
 * and no shared border can still be the two most closely bound institutions in
 * the world, which is exactly the case of the Root Sill and the Kiln.
 *
 * Where both exist for one pair, the authored one wins and the derived one is
 * dropped, because the authored one says everything the derived one did and
 * more. `SOURCE` on the resolved record says which a reader is looking at.
 *
 * NOTHING HERE DECIDES ANYTHING. There is no warmth arithmetic, no threshold at
 * which a cold relationship becomes a war, and no helper that adds warmth words up.
 * `Warmth` is a word from a fixed list, chosen by an author or restated from a
 * `standing` field, and a grievance with a cause is worth more than any number
 * this file could have carried.
 */

import { z } from 'zod';

import {
    SECTS,
    DAO_HOUSES,
    getSect,
    getDaoHouse
} from './sects.js';
import {
    COURTS,
    FACTION_PARENTAGE,
    getApexInstitution,
    getCourt,
    idsForFaction
} from './governance-and-water-rights.js';
import { SHARED_EVENTS } from './faction-history.js';

// ─────────────────────────────────────────────────────────────────────────
// THE VOCABULARY
// ─────────────────────────────────────────────────────────────────────────

/**
 * Where one body sits relative to another. Never a judgement of strength: the
 * Hollow Court stands alongside three apexes at ordinal 44 and above nobody.
 */
export const RelationStanceSchema = z.enum(['above', 'below', 'alongside']);
export type RelationStance = z.infer<typeof RelationStanceSchema>;

/**
 * How warm one side is toward the other. Six words, deliberately not a number.
 *
 * The scale is about conduct rather than sentiment, because conduct is what an
 * outsider can observe and what the engine could ever act on:
 *
 *   warm     glad of them, and will spend on them without being asked
 *   correct  the forms observed exactly, and nothing beyond them
 *   distant  no ill will and no contact; nobody maintains this one
 *   wary     useful, and watched, and not left unattended
 *   cold     the forms observed and the warmth deliberately withheld
 *   hostile  acted against, or would be if the cost ever fell
 *
 * `correct` and `cold` are the pair that does the most work in this world.
 * Both parties do exactly what the arrangement requires; only one of them has
 * decided that is all they will ever do.
 */
export const WarmthSchema = z.enum([
    'warm',
    'correct',
    'distant',
    'wary',
    'cold',
    'hostile'
]);
export type Warmth = z.infer<typeof WarmthSchema>;

/** What kind of tie it is. The factual nature, shared by both sides. */
export const RelationKindSchema = z.enum([
    'patron_and_client',        // a vein held on a grant, on stated terms
    'apex_and_court',           // administers an arterial on the apex's behalf
    'apex_and_posting',         // staffs a posting the apex appoints into
    'severed_patronage',        // answered there once and does not any more
    'administration',           // staff of a direct ruler, not a tenant
    'contracted',               // works under contract, not under a lease
    'two_bodies_nobody_joins',  // the offices among the courts
    'same_patron',              // two bodies answering the same house
    'rivals',                   // a standing feud both parties acknowledge
    'contested_claim',          // two hands on one object
    'counter',                  // holds the thing that beats the other's dao
    'service_and_dependent',    // one cannot function without the other
    'shared_event',             // one thing happened and both have an account
    'tolerated'                 // holds nothing here and is not moved on
]);
export type RelationKind = z.infer<typeof RelationKindSchema>;

/** Where a resolved tie came from, so a reader can go and check it. */
export const RelationSourceSchema = z.enum([
    'authored',
    'the grant table',
    'the court table',
    'the rivalry lists',
    'the contested claims',
    'the dao house counters',
    'the shared events'
]);
export type RelationSource = z.infer<typeof RelationSourceSchema>;

/**
 * One party's half of a relationship. Everything here is that body's own, and
 * the other side's half is allowed to disagree with all of it except the facts,
 * which are not on this object at all.
 */
export const RelationSideSchema = z.object({
    warmth: WarmthSchema,
    /** How this body puts the tie, in its own mouth. Partisan on purpose. */
    howTheyPutIt: z.string().min(80),
    /** What this side actually does about it. An act, never a mood. */
    andSoTheyDo: z.string().min(60),
    /**
     * The specific complaint, where there is one, with its cause and its date.
     *
     * Null is a real answer and a common one: a body can be cold to another
     * without having anything to complain about, and a grievance nobody can
     * name is the kind that gets invented later.
     */
    grievance: z.string().min(60).nullable()
});
export type RelationSide = z.infer<typeof RelationSideSchema>;

export const FactionRelationshipSchema = z.object({
    id: z.string().min(1),
    /** Ids in `SECTS`, `COURTS` or `APEX_INSTITUTIONS`. Checked in the tests. */
    aId: z.string().min(1),
    bId: z.string().min(1),
    /** Where A sits relative to B. B's stance is the inverse and is derived. */
    aStandsTo: RelationStanceSchema,
    kind: RelationKindSchema,
    /**
     * The tie itself, stated once, in nobody's voice.
     *
     * Both sides read this same sentence. If a fact only one party accepts
     * belongs in the description, it belongs in that party's `howTheyPutIt`
     * instead - this field is the part neither of them disputes.
     */
    what: z.string().min(100),
    /** Where it came from, dated wherever the catalog dates it. */
    since: z.string().min(60),
    a: RelationSideSchema,
    b: RelationSideSchema
});
export type FactionRelationship = z.infer<typeof FactionRelationshipSchema>;

// ─────────────────────────────────────────────────────────────────────────
// THE AUTHORED PAIRS
//
// Written here because no table in the catalog carries them. Everything else a
// body stands in is derived below from the grant table, the court table, the
// rivalry lists, the contested claims, the dao house counters and the shared
// events, and a derived tie is not a lesser tie - it is the same fact, read out
// of the row that already held it.
//
// The rule for adding one: it must say something the existing tables cannot.
// Two houses that are rivals do not need an entry here to say they are rivals.
// They need one when the interesting fact is that one of them does not think of
// it as a rivalry.
// ─────────────────────────────────────────────────────────────────────────

export const FACTION_RELATIONSHIPS: readonly FactionRelationship[] = [
    // ═══════════════════════════════════════════════════════════════════
    // THE TWO BODIES NOBODY JOINS
    //
    // The pair this module was built for. They share no patron, no border and
    // no correspondence, so not one of the derivable tables produces a tie
    // between them, and the register showed the two offices among the courts as
    // two unrelated entries.
    //
    // NOT A NAMING DISPUTE. The catalog used to carry a partisan account on
    // each of them arguing that it was the real house, with a field on each
    // saying no instrument anywhere settles it. That framing is gone: it made
    // an institution that had split read as an institution having an argument.
    // They had a schism and they have run independently ever since, and this is
    // the relationship - what each kept, whom each answers, and how much of
    // each other they can stand.
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'rel-the-root-sill-and-the-kiln',
        aId: 'sect-kiln-wardens',
        bId: 'court-kiln',
        aStandsTo: 'alongside',
        kind: 'two_bodies_nobody_joins',
        what:
            'Every other court in the world is a sect: it has members, an intake, a ladder and a seat, and the word court describes what it administers rather than what kind of institution it is. These two are the exception and they are the only exception. Nobody applies to either; somebody stands there because a decision was taken elsewhere, about them, by an apex or by a house friendly to one. That shared shape is why the split was available at all - a posting can be reposted and a sect cannot - and it is the one thing each of them knows about the other that nobody else in the world knows about either. They ran as one posting under two names for nine hundred years and they are two institutions now: the Kiln kept the datum, the nine hundred lit nodes and the perimeter under the Deep Survey, the Root Sill took the roll and the founding posting order four provinces away under the Long Cut, and neither has written to the other since.',
        since:
            'Nine hundred years as one posting under two names, and roughly a lifetime as two institutions: the Deep Survey reposted the court without consulting anybody standing in it, most of the Wardens declined the reposting, and the Long Cut was waiting for them.',
        a: {
            warmth: 'cold',
            howTheyPutIt:
                'What was walked out of was an arrangement, not a job. The roll is here, most of the Wardens are here, the founding posting order that names the first four is here, and the people who stayed are welcome to the ground. There is nothing to discuss with them and there has never been an attempt to discuss it.',
            andSoTheyDo:
                'Keeps the roll, keeps the posting order, walks a different rota for a different apex, and writes nothing to the gate. There has been no correspondence in either direction since the walk and neither body has asked for any.',
            grievance:
                'Nobody was asked. The reposting arrived by letter about a body that had been walking the same rota for nine hundred years, and what the Wardens declined was not the work but being reassigned to it in writing. The half that stayed accepted the same letter without comment, and that is the part this body has never got past.'
        },
        b: {
            warmth: 'correct',
            howTheyPutIt:
                'The Kiln is where the datum, the nodes and the perimeter are, and the work is walking all three on a schedule. Some of the people who used to do it went elsewhere and are doing something else now. The province has read four Warden ranks off this gate for nine hundred years and reads them off it today, and none of that was affected.',
            andSoTheyDo:
                'Nothing at all, in public or in writing. The Kiln issues no correspondence, has never named the other body in a document, and has never asked its own patron to.',
            grievance: null
        }
    },
    {
        id: 'rel-the-root-sill-and-the-survey-that-reposted-it',
        aId: 'apex-deep-survey',
        bId: 'sect-kiln-wardens',
        aStandsTo: 'above',
        kind: 'severed_patronage',
        what:
            'The Deep Survey posted this body, named it, and staffed it for nine hundred years, and it does not any more. It is the only administration in the world that has ever changed patrons, and what moved was people rather than ground: the roll and the founding posting order walked out and the datum stayed where it was. The Survey has never referred to the departed body in correspondence, which leaves the sharpest fact in the arrangement standing unaddressed - the name being ignored is the Survey own word, invented by the Survey, for a posting the Survey created.',
        since:
            'The reposting, and the walk that followed it. Living memory by the standards of the bodies involved, and the second administration the Long Cut has taken from the Survey in that span.',
        a: {
            warmth: 'distant',
            howTheyPutIt:
                'A court was reposted, correctly, on a schedule, and the Survey lists the Kiln Court as its court on the datum. It has never characterised the season otherwise in any document and has never been asked to in a room where it would have to reply.',
            andSoTheyDo:
                'Files the datum figure it receives once a year from the body that stayed, and does not name the other one. Two procedures were quietly restructured in the same era and neither change was explained.',
            grievance: null
        },
        b: {
            warmth: 'cold',
            howTheyPutIt:
                'What was declined was not an assignment, it was an honour, and there is a difference the Survey has spent nine hundred years filing as the first. Every Warden who walked had competed for the thing they were walking away from. Declining an assignment is a disagreement; declining an honour is a verdict.',
            andSoTheyDo:
                'Enters new terms on the roll it walked out with, knowing that one of the three apexes behaves as though the document does not exist and that a service record with this body\'s name at the top of it will be read by two of them and silently passed over by the third.',
            grievance:
                'Silence used as an answer. The Survey has never once referred to this court in correspondence, which is what it does instead of replying, and it has lost the only administration in the world that has ever changed patrons to the same rival in living memory, and has never acknowledged it.'
        }
    },
    {
        id: 'rel-the-root-sill-and-the-schedule-that-took-it-in',
        aId: 'apex-long-cut',
        bId: 'sect-kiln-wardens',
        aStandsTo: 'above',
        kind: 'apex_and_posting',
        what:
            'The Long Cut appoints into this posting now, by schedule or by nomination from a house under it or friendly to it, and the people standing in it were appointed by one apex and are appointed by another, into the same posting, under the same title, on the strength of a roll that predates both arrangements. What the Long Cut acquired with them was a claim on the strongest sealed thing anybody has established the existence of, and it acquired it by offering some disaffected appointees a place, without a word having to be said out loud.',
        since:
            'The walk. The Long Cut offered a schedule rather than a rank, which was the only offer in the world that would have been taken, and it has never acknowledged making it.',
        a: {
            warmth: 'correct',
            howTheyPutIt:
                'A place in the schedule was available and was taken. The Long Cut ranks people by faces worked and deaths avoided, it owns every act it takes by name, and it has never described this one as anything but an ordinary arrangement working.',
            andSoTheyDo:
                'Schedules the appointments and says nothing about where the body came from. The Course Keepers have begun handing returning appointees the faces nobody else is given, without recording why.',
            grievance: null
        },
        b: {
            warmth: 'warm',
            howTheyPutIt:
                'A schedule is a thing that can be honoured exactly, which is more than the last arrangement offered. What was wanted was not a rank and not a patron who would explain itself; it was a body that would say what it wanted on a date and then keep to the date.',
            andSoTheyDo:
                'Walks the rota, takes the appointments, and sends its returning people back into an arrangement that has no rungs to promote them into - which is a problem this body has created for its own patron and has never been asked about.',
            grievance: null
        }
    },
    {
        id: 'rel-the-kiln-and-the-survey-it-still-answers',
        aId: 'apex-deep-survey',
        bId: 'court-kiln',
        aStandsTo: 'above',
        kind: 'apex_and_court',
        what:
            'The Kiln administers the datum - the deep vein at the world root that the whole arterial system is measured from - on the Deep Survey behalf, and it is the one court in the Survey arrangement that issues no grants, holds no tenants and has no catchment. The whole of the reporting relation is one figure a year, and the figure has not changed in the current Keeper tenure.',
        since:
            'Nine hundred years, uninterrupted from the Survey side of the record: it posted the court, it named the court, and it lists this body as its court on the datum today.',
        a: {
            warmth: 'correct',
            howTheyPutIt:
                'A posting on the datum is the most important assignment in the Survey arrangement and the least eventful. It is staffed, the figure arrives, and there is nothing further to administer.',
            andSoTheyDo:
                'Appoints four people into it by letter, or accepts a nomination from a house under it or friendly to it, and reads a term served there when any of those houses wants something of theirs read.',
            grievance: null
        },
        b: {
            warmth: 'correct',
            howTheyPutIt:
                'Staff, posted, doing an assigned job on somebody else datum. Every single thing the province finds inexplicable about the Wardens is explained by that sentence, and the sentence is the Survey.',
            andSoTheyDo:
                'Reports one figure upward once a year and answers nothing downward. The figure has not changed and it is submitted anyway.',
            grievance: null
        }
    },
    {
        id: 'rel-the-kiln-and-the-court-raised-beside-it',
        aId: 'court-kiln',
        bId: 'sect-storm-tyrant-court',
        aStandsTo: 'alongside',
        kind: 'same_patron',
        what:
            'Two bodies answering the Deep Survey directly in the same province, and the only pair of them anywhere. One administers a datum nobody draws on, issues nothing and answers nothing downward. The other was raised out of two centuries of probation to answer as a court because the lightning curriculum is the one thing in the Low Fall nobody can replace, and the probation was carried across rather than lifted. The Kiln was not consulted about the raising, which is unremarkable, because the Kiln is not consulted about anything.',
        since:
            'The raising of the Storm Tyrant Court to answer the Survey directly, which made it the second Survey body in the province and gave the province its first pair to compare.',
        a: {
            warmth: 'distant',
            howTheyPutIt:
                'Nothing. The Kiln has never commented on the other court, in writing or otherwise, and has never been asked to by the body that posted them both.',
            andSoTheyDo:
                'Walks the rota, holds the perimeter, and submits the figure. No exchange of any kind between the two bodies has ever been observed.',
            grievance: null
        },
        b: {
            warmth: 'cold',
            howTheyPutIt:
                'One of us issues a curriculum nobody else in the province can supply and holds its charter on a probation that was carried across rather than lifted. The other takes nothing out of the richest ground in the world, issues nothing, answers nothing, and is renewed without a question ever being asked.',
            andSoTheyDo:
                'Finds it intolerable in a way it has never put in writing, and reads its own last two renewals - six years instead of twelve - as a warning it has not established the subject of.',
            grievance:
                'That the same patron applies two standards and has never stated either. The Storm Tyrant has held on probation for two centuries and been raised without the probation being lifted, while the body next to it has held nine hundred years with no grievance in the outside record and no terms anybody has seen.'
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // THE TOP OF THE WORLD
    //
    // Three apexes and the one body none of them will go near. Their conduct
    // toward each other is authored on each apex row already; what was missing
    // was the pairing, which is what makes the asymmetries legible - the
    // Pavilion is cold to both and both are wary of it, and neither of those
    // two is anything but correct with the other.
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'rel-the-two-old-apexes',
        aId: 'apex-deep-survey',
        bId: 'apex-long-cut',
        aStandsTo: 'alongside',
        kind: 'rivals',
        what:
            'The two apexes nobody can date. They agree entirely that what a house believes is not a term of any contract, and disagree entirely about whether you delegate at all: one grants veins to tenants on twelve-year terms and reads the reports, and the other holds every face itself with a posted staff of about forty and has no tenants to have a view about. Both have known the other answer for eleven hundred years and neither has ever raised it. In that span one of them has taken two of the other administrations and neither has acknowledged it.',
        since:
            'Longer than either keeps a record of. The Third Sill has administered an arterial for the Long Cut inside a province the Deep Survey holds for longer than either apex can date, and neither has ever explained or raised that either.',
        a: {
            warmth: 'correct',
            howTheyPutIt:
                'A difference about method between two bodies that have both costed their principles. It is much older than any live question and there is no room in which it would need settling.',
            andSoTheyDo:
                'Lists the anomalies as ordinary in its own papers, does not raise them, and has lost the only administration that has ever moved to the other without a word being said in either direction.',
            grievance: null
        },
        b: {
            warmth: 'correct',
            howTheyPutIt:
                'Courteous and total. It has taken two of the other administrations and acknowledged nothing, and nothing has been acknowledged back, and both understand that as the arrangement working rather than as hostility.',
            andSoTheyDo:
                'Does not argue. It schedules, it keeps the record, and its whole conduct is that it will still be here on the date.',
            grievance: null
        }
    },
    {
        id: 'rel-the-pavilion-and-the-survey',
        aId: 'apex-azure-cloud',
        bId: 'apex-deep-survey',
        aStandsTo: 'alongside',
        kind: 'rivals',
        what:
            'The one live argument at the top of the world, and it does not move. The Pavilion position is that a contract with three terms and no fourth will eventually be met by something nobody should be dealing with. The Survey answer has been the same for three centuries and is why the argument is stuck: it is not defending demonic houses, it is defending the contract, and it would defend a righteous house on identical terms - which the Pavilion cannot attack without attacking the principle its own grantless standing rests on.',
        since:
            'Three hundred and eighty years, which is the whole life of the younger party. The Survey has had the same argument put to it before, by bodies that no longer exist, and answers it in the same number of words every time.',
        a: {
            warmth: 'cold',
            howTheyPutIt:
                'It objects, on the axis the other refuses to price, and it says so where it can be quoted. It is not asking the Survey to change; it is asking it to answer in its own words instead of in a silence, which is the only move available to a body that objects and cannot act.',
            andSoTheyDo:
                'Declines to sign, declines to attend, puts the objection on records nobody asked for, teaches its forms below cost to houses that will not take a demonic grant, and keeps a list it has never published and has never denied keeping.',
            grievance:
                'That a seat with somebody in it counts as an order however that somebody behaves, and that nobody in the arrangement is required to look at what the somebody does. The Pavilion takes in the people that reasoning ruins, and the Mist recall roll is the running total.'
        },
        b: {
            warmth: 'wary',
            howTheyPutIt:
                'Unshockable, and specifically not cynical about it: the Survey has principles and has costed them, which is a different thing from not having any. It does not treat the objection as amusing.',
            andSoTheyDo:
                'Answers in the same words every time, and has quietly restructured two procedures around never being made to answer in public, and has never explained why either changed.',
            grievance: null
        }
    },
    {
        id: 'rel-the-pavilion-and-the-long-cut',
        aId: 'apex-azure-cloud',
        bId: 'apex-long-cut',
        aStandsTo: 'alongside',
        kind: 'rivals',
        what:
            'The same objection pointed at a body that has no tenants to have a view about. The Long Cut has never encountered the question the Pavilion is asking, because there are no institutions on its ground to hold beliefs - everybody there is staff and everything there is a schedule - and that is the whole of the deadlock: the Survey can be argued with about a tenant, and the Long Cut cannot, because it has none.',
        since:
            'Since the Pavilion became an apex and began publishing a standard. The Long Cut has had to answer questions about the Weir Office twice in ninety years that it would not otherwise have been asked.',
        a: {
            warmth: 'cold',
            howTheyPutIt:
                'An arrangement with nobody in it to be responsible is not an answer to the objection, it is a way of not having to hear it. The Pavilion says so out loud, in a room where saying it out loud is read as a tell.',
            andSoTheyDo:
                'Publishes its own standard and refuses on it, which makes the silent arrangements in the Marches legible by contrast without a word of it being addressed to anybody.',
            grievance: null
        },
        b: {
            warmth: 'wary',
            howTheyPutIt:
                'Inconvenient rather than absurd. An apex that publishes its standard and refuses on it produces questions elsewhere that would otherwise not have been asked, and questions cost schedule.',
            andSoTheyDo:
                'Answers the questions when they arrive, by name, in writing, and does very little quickly.',
            grievance: null
        }
    },
    {
        id: 'rel-the-hollow-court-and-the-deep-survey',
        aId: 'sect-hollow-court',
        bId: 'apex-deep-survey',
        aStandsTo: 'alongside',
        kind: 'tolerated',
        what:
            'No grant is issued over the Court, no arbitration is offered to it, and no precedence is claimed against it, which is why its governance is recorded as unassailable rather than as apex. It holds the best vein anybody has ever surveyed and draws nothing from it, so there is nothing in the arrangement for a patron to be the patron of.',
        since:
            'Longer than the question has had a form. Nobody at the top of the region has ever pressed the Court on anything, and no document records a first time that was true.',
        a: {
            warmth: 'distant',
            howTheyPutIt:
                'The Court has no view. It works at a published address on four known mountains, takes nothing out of the ground it sits on, and has never asked anybody above it for anything, because there is nothing it needs that an apex could supply.',
            andSoTheyDo:
                'Holds the mountains, protects its own crossings, and gives out one honorary title that carries no obligation in either direction.',
            grievance: null
        },
        b: {
            warmth: 'wary',
            howTheyPutIt:
                'It is not deference and it is not fear. It is an institution being extremely careful never to become interesting to a body that has crossed six times and can put more than one person at the last realm in a room.',
            andSoTheyDo:
                'Issues nothing over it, offers it nothing, claims nothing against it, and has never once put a question to it that would require an answer.',
            grievance: null
        }
    },
    {
        id: 'rel-the-hollow-court-and-the-long-cut',
        aId: 'sect-hollow-court',
        bId: 'apex-long-cut',
        aStandsTo: 'alongside',
        kind: 'tolerated',
        what:
            'The Court holds four mountains and the richest vein in the world on nobody grant, inside no schedule, answering to nothing. The Long Cut runs five provinces of driven ground by owning every act on it by name, and has never scheduled anything that touches the four mountains.',
        since:
            'Long enough that no record anywhere carries a first instance. The absence of any instrument between them is the whole of the relation.',
        a: {
            warmth: 'distant',
            howTheyPutIt:
                'A body that ranks people by faces worked and deaths avoided is running a different question. The Court has never needed anything from it and has never been offered anything.',
            andSoTheyDo:
                'Nothing. The friendships its members arrived with are two and three centuries old and are used personally, never as the Court, and never in writing.',
            grievance: null
        },
        b: {
            warmth: 'wary',
            howTheyPutIt:
                'There is no face there and no schedule to keep, so there is nothing to own by name. A body that owns every act it takes has taken none in that direction.',
            andSoTheyDo:
                'Keeps its ground, keeps its record, and has never sent anybody up the mountains for any purpose.',
            grievance: null
        }
    },
    {
        id: 'rel-the-hollow-court-and-the-pavilion',
        aId: 'sect-hollow-court',
        bId: 'apex-azure-cloud',
        aStandsTo: 'alongside',
        kind: 'tolerated',
        what:
            'The only apex with a front gate and the only body above it that has one too, and neither has ever put anything to the other. The Court bar is a Void Refinement floor and evidence you could reach the last realm; the Pavilion bar is a probation standing at the floor of the ladder. They are the two published doors in the world and they open onto opposite ends of it.',
        since:
            'Three hundred and eighty years at most, because that is the whole age of the younger body. Nothing in either record says the two have ever formally corresponded.',
        a: {
            warmth: 'distant',
            howTheyPutIt:
                'A house that publishes a standard and refuses on it is doing a legible thing. The Court has no view on it, because having a view is a way of becoming a party.',
            andSoTheyDo:
                'Nothing on the record. What its Seats do with their own two and three centuries of friendships is theirs, is done personally, and is not told to the Court.',
            grievance: null
        },
        b: {
            warmth: 'wary',
            howTheyPutIt:
                'The Court is the one body at that altitude nobody has an argument with, which is either the strongest position in the world or the emptiest, and the Pavilion has not settled which.',
            andSoTheyDo:
                'Does not petition it, does not cite it, and does not include it on the list it keeps and has never published.',
            grievance: null
        }
    }
];

// ─────────────────────────────────────────────────────────────────────────
// RESOLUTION
//
// A body's section of the register is the authored pairs it appears in, plus
// every tie the other tables already implied. Derivation happens here rather
// than in the view for the reason the whole module exists: a relationship the
// register assembles at render time is decoration, and one the catalog can be
// asked for is state.
// ─────────────────────────────────────────────────────────────────────────

/**
 * One relationship as it looks from one side of it.
 *
 * `stance` is where the OTHER body stands relative to the one being asked
 * about, because that is the question a reader of an entry is asking: what is
 * above me, what is below me, what is beside me.
 */
export interface ResolvedRelationship {
    id: string;
    /** The body on the other end. */
    otherId: string;
    otherName: string;
    /** Where the other body stands relative to the one asked about. */
    stance: RelationStance;
    kind: RelationKind;
    source: RelationSource;
    what: string;
    since: string;
    /** How the body asked about regards the other one. */
    warmth: Warmth;
    /** How the other one regards it back. Allowed to differ, and often does. */
    theirWarmth: Warmth;
    howTheyPutIt: string;
    andSoTheyDo: string;
    grievance: string | null;
}

/**
 * What to call the body on the other end of a tie.
 *
 * A BODY, and only ever a body. This module relates institutions to
 * institutions and to nothing else: a person is not a faction, and neither is
 * whoever happens to be standing in the same ruin. Facts about what an
 * individual does, or about how a house behaves when it meets strangers,
 * belong in that house's own description - they are not ties, and putting one
 * here makes a section about how bodies stand with each other into a place
 * where anything can be filed.
 */
function nameOfBody(id: string): string {
    return getSect(id)?.name
        ?? getApexInstitution(id)?.name
        ?? getCourt(id)?.name
        ?? id;
}

function invert(stance: RelationStance): RelationStance {
    return stance === 'above' ? 'below' : stance === 'below' ? 'above' : 'alongside';
}

/**
 * The warmth a `standing` value already states, restated in this vocabulary.
 *
 * Not a new fact and not an inference. `Parentage.standing` is the catalog's
 * own word for how a client is doing with its patron, and this is the same word
 * in the scale the register reads. It runs in one direction only, because
 * `standing` runs in one direction only: it says how the client stands, and it
 * says nothing whatever about what the patron feels, which is why a derived
 * downward tie takes `correct` and an authored one is the only way a patron
 * ever gets a warmer or a colder word than that.
 */
function warmthFromStanding(standing: string): Warmth {
    switch (standing) {
        case 'good': return 'correct';
        case 'strained': return 'cold';
        case 'probationary': return 'wary';
        case 'lapsed': return 'cold';
        default: return 'distant';
    }
}

interface DerivedPair {
    id: string;
    aId: string;
    bId: string;
    aStandsTo: RelationStance;
    kind: RelationKind;
    source: RelationSource;
    what: string;
    since: string;
    a: RelationSide;
    b: RelationSide;
}

/**
 * The one id a body is filed under here, where it has more than one.
 *
 * Several bodies have a row in two catalogs - an apex that is also a sect, a
 * court that is also a sect - and the tables this module reads were each
 * written against whichever of the two their author had in front of them. The
 * Azure Mist holds from the Pavilion in the grant table and is posted by the
 * Azure Cloud in the court table, and those are one relationship with one other
 * party, not two: without this the Mist's entry listed its own patron twice
 * under two names, which is precisely the incoherence this module exists to
 * remove.
 *
 * The last id is taken rather than the first because `idsForFaction` returns
 * the institutional row first and the house row second, and the house name is
 * the one the register leads with and the one every reader arrives holding.
 */
function canonical(id: string): string {
    const ids = idsForFaction(id);
    return ids[ids.length - 1] ?? id;
}

function pairKey(a: string, b: string): string {
    return [canonical(a), canonical(b)].sort().join('::');
}

/**
 * Every tie the other catalogs already contain, read out of them.
 *
 * Built once at module load, because the tables it reads are frozen constants
 * and a per-call rebuild would be the same answer at a cost paid on every
 * faction on the sheet.
 */
const DERIVED: readonly DerivedPair[] = (() => {
    const out: DerivedPair[] = [];
    const seen = new Set<string>();

    const add = (p: DerivedPair): void => {
        const aId = canonical(p.aId);
        const bId = canonical(p.bId);
        // A body is not in a relationship with itself. Not theoretical: the
        // Azure Mist is a court in one table and a sect in another, and the
        // court table pairs it with the apex whose sect row is its own patron.
        if (aId === bId) return;
        const key = pairKey(aId, bId);
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ ...p, aId, bId });
    };

    // ── the grant table: who holds what from whom ────────────────────
    for (const parentage of Object.values(FACTION_PARENTAGE)) {
        const parentId = parentage.parentFactionId;
        if (!parentId) continue;
        const clientName = nameOfBody(parentage.factionId);
        const parentName = nameOfBody(parentId);
        const terms = parentage.terms;
        const kind: RelationKind =
            parentage.relation === 'court' ? 'apex_and_court'
                : parentage.relation === 'administration' ? 'administration'
                    : parentage.relation === 'contracted' ? 'contracted'
                        : 'patron_and_client';
        add({
            id: `rel-holds-from-${parentage.factionId}`,
            aId: parentId,
            bId: parentage.factionId,
            aStandsTo: 'above',
            kind,
            source: 'the grant table',
            what: `${clientName} holds from ${parentName}. ${parentage.holds}`,
            since: terms
                ? `Renewal: ${terms.renewal}`
                : 'No terms are recorded, because the arrangement is not a tenancy: this is staff rather than a tenant, and there is nothing on a cycle to renew.',
            a: {
                warmth: 'correct',
                howTheyPutIt: `An arrangement in ${parentName}'s own book, on the terms in it, standing ${parentage.standing.replace(/_/g, ' ')}.`,
                andSoTheyDo: terms
                    ? `Takes what the terms say and renews on the stated cycle. ${terms.buys.length} thing${terms.buys.length === 1 ? '' : 's'} are bought by it and ${terms.inKind.length} taken in kind.`
                    : 'Posts, staffs and instructs. Nothing is taken and nothing is renewed, because there is no lease here to renew.',
                grievance: null
            },
            b: {
                warmth: warmthFromStanding(parentage.standing),
                howTheyPutIt: parentage.note,
                andSoTheyDo: terms
                    ? `Pays ${terms.tributeStonesPerYear.toLocaleString()} stones a year and sends ${terms.disciplesPerCycle} disciple${terms.disciplesPerCycle === 1 ? '' : 's'} a cycle upward, and is aware of the apex above it at the level of: ${parentage.awarenessOfApex}.`
                    : `Does the assigned work, and is aware of the apex above it at the level of: ${parentage.awarenessOfApex}.`,
                grievance: null
            }
        });
    }

    // ── the court table: an apex and the courts it posted ────────────
    //
    // Read separately from the grant table because the catalog files
    // subordination in two places and they do not overlap. A court names its
    // apex on its own row; everything else points upward from the parentage
    // table, and an apex assembled from one of them loses whatever lives in
    // the other.
    for (const court of COURTS) {
        add({
            id: `rel-posted-${court.id}`,
            aId: court.apexId,
            bId: court.id,
            aStandsTo: 'above',
            kind: court.posting ? 'apex_and_posting' : 'apex_and_court',
            source: 'the court table',
            what: `${court.name} administers ${court.administers.charAt(0).toLowerCase()}${court.administers.slice(1)} on ${nameOfBody(court.apexId)}'s behalf, with ${court.roster.length} offices standing in it and ${court.grantsInPrefectureIds.length} prefecture${court.grantsInPrefectureIds.length === 1 ? '' : 's'} holding from it.`,
            since: court.transferNote
                ?? 'No record anywhere says it ever answered anywhere else.',
            a: {
                warmth: 'correct',
                howTheyPutIt: `One of ${(getApexInstitution(court.apexId)?.courtIds.length ?? 1)} court${(getApexInstitution(court.apexId)?.courtIds.length ?? 1) === 1 ? '' : 's'} standing between this apex and the ground it holds.`,
                andSoTheyDo: court.posting
                    ? 'Appoints into it. There is no application anybody could make, so every person standing there is somebody this house or a house friendly to it decided about, elsewhere.'
                    : 'Posts it, names it, and reads what it sends up.',
                grievance: null
            },
            b: {
                warmth: 'correct',
                howTheyPutIt: court.officesNote,
                andSoTheyDo: `Administers on the apex's behalf and reports upward. Awareness of the body above it, in the province: ${court.startingAwareness}.`,
                grievance: null
            }
        });
    }

    // ── the rivalry lists: symmetric by construction ─────────────────
    for (const sect of SECTS) {
        for (const rivalId of sect.rivals) {
            const rival = getSect(rivalId);
            add({
                id: `rel-rivals-${[sect.id, rivalId].sort().join('-and-')}`,
                aId: sect.id,
                bId: rivalId,
                aStandsTo: 'alongside',
                kind: 'rivals',
                source: 'the rivalry lists',
                what: `A standing feud, carried on both rolls. ${sect.name} stands at ${sect.powerOrdinal} and ${rival?.name ?? rivalId} at ${rival?.powerOrdinal ?? '?'}, and a feud the other party has not heard about is not a feud, which is why this one appears on both.`,
                since: 'The catalog does not date it. What it records is that both houses carry it, which is the whole of what makes it a feud rather than a complaint.',
                a: {
                    warmth: 'hostile',
                    howTheyPutIt: `${sect.name} carries ${rival?.name ?? rivalId} on its own rivals list, which is a statement it made about itself rather than one made about it.`,
                    andSoTheyDo: 'Acts against them where the cost falls in its favour, and says so.',
                    grievance: null
                },
                b: {
                    warmth: 'hostile',
                    howTheyPutIt: `${rival?.name ?? rivalId} carries ${sect.name} on its own list too. Neither entry was written to answer the other.`,
                    andSoTheyDo: 'The same, from the other side.',
                    grievance: null
                }
            });
        }
    }

    // ── the contested claims: two hands on one object ────────────────
    for (const sect of SECTS) {
        const ambition = sect.ambition;
        if (!ambition) continue;
        for (const otherId of ambition.contestedWith) {
            add({
                id: `rel-contested-${[sect.id, otherId].sort().join('-and-')}`,
                aId: sect.id,
                bId: otherId,
                aStandsTo: 'alongside',
                kind: 'contested_claim',
                source: 'the contested claims',
                what: `Both houses have a hand on the same thing, and both entries describe it from their own side. ${sect.name} wants: ${ambition.wants}`,
                since: 'Undated in the catalog. What is recorded is how far each of them has actually got, which is usually not far.',
                a: {
                    warmth: 'wary',
                    howTheyPutIt: ambition.wants,
                    andSoTheyDo: ambition.movedOn,
                    grievance: null
                },
                b: {
                    warmth: 'wary',
                    howTheyPutIt: getSect(otherId)?.ambition?.wants
                        ?? `${nameOfBody(otherId)} carries the same contest on its own entry.`,
                    andSoTheyDo: getSect(otherId)?.ambition?.movedOn
                        ?? 'The catalog records the contest from this side without recording a move.',
                    grievance: null
                }
            });
        }
    }

    // ── the dao house counters: who holds the thing that beats you ───
    for (const house of DAO_HOUSES) {
        const holderId = house.counter.heldBy;
        if (!holderId) continue;
        const holder = getDaoHouse(holderId);
        add({
            id: `rel-counter-${[house.id, holderId].sort().join('-and-')}`,
            aId: holderId,
            bId: house.id,
            aStandsTo: 'alongside',
            kind: 'counter',
            source: 'the dao house counters',
            what: `${nameOfBody(holderId)} holds ${house.counter.name}, which is the thing that beats ${house.name}'s principle. ${house.counter.description}`,
            since: 'Structural rather than dated. Every house has a named counter and wherever possible a rival house holds it, so that specialisation is an advantage and never ownership.',
            a: {
                warmth: 'wary',
                howTheyPutIt: `Holding the answer to somebody else's dao is not the same as being stronger than them, and ${holder?.name ?? holderId} has its own counter held by somebody else.`,
                andSoTheyDo: 'Keeps it, and is careful about who is told what it can actually do.',
                grievance: null
            },
            b: {
                warmth: 'wary',
                howTheyPutIt: `${house.name} knows exactly what beats it and knows exactly who is holding it, which is the ordinary condition of every house in the catalog.`,
                andSoTheyDo: 'Works around it, and does not test it.',
                grievance: null
            }
        });
    }

    // ── the shared events: one thing happened, two accounts of it ────
    for (const event of SHARED_EVENTS) {
        const [firstId, secondId] = event.parties;
        if (!firstId || !secondId) continue;
        add({
            id: `rel-event-${event.id}`,
            aId: firstId,
            bId: secondId,
            aStandsTo: 'alongside',
            kind: 'shared_event',
            source: 'the shared events',
            what: `${event.what} It happened ${event.yearsAgo.toLocaleString()} years ago, both bodies have an account of it, and the two accounts are of the same event.`,
            since: `${event.yearsAgo.toLocaleString()} years ago. What it explains about the world today: ${event.explains.replace(/_/g, ' ')}.`,
            a: {
                warmth: 'wary',
                howTheyPutIt: event.accounts[firstId] ?? `${nameOfBody(firstId)} was a party to it.`,
                andSoTheyDo: 'Carries its own account of it, and has never had to reconcile it with the other.',
                grievance: null
            },
            b: {
                warmth: 'wary',
                howTheyPutIt: event.accounts[secondId] ?? `${nameOfBody(secondId)} was a party to it.`,
                andSoTheyDo: 'Carries its own account of it, and has never had to reconcile it with the other.',
                grievance: null
            }
        });
    }

    return out;
})();

/** Every pair in the world, authored ones first and derived ones behind them. */
function allPairs(): DerivedPair[] {
    const authoredKeys = new Set(FACTION_RELATIONSHIPS.map(r => pairKey(r.aId, r.bId)));
    const authored: DerivedPair[] = FACTION_RELATIONSHIPS.map(r => ({
        id: r.id,
        aId: canonical(r.aId),
        bId: canonical(r.bId),
        aStandsTo: r.aStandsTo,
        kind: r.kind,
        source: 'authored' as const,
        what: r.what,
        since: r.since,
        a: r.a,
        b: r.b
    }));
    // An authored pair says everything its derived twin said and more, so the
    // derived one is dropped rather than shown beside it. Two entries for one
    // tie is the incoherence, not the coverage.
    return [...authored, ...DERIVED.filter(d => !authoredKeys.has(pairKey(d.aId, d.bId)))];
}

const ALL_PAIRS: readonly DerivedPair[] = allPairs();

const STANCE_ORDER: Record<RelationStance, number> = { above: 0, alongside: 1, below: 2 };

/**
 * Every relationship one body stands in, seen from that body's side.
 *
 * Accepts any id the body is filed under - a court id, a sect id or an apex id
 * - because several bodies have rows in two catalogs and a caller holding
 * either one is asking the same question.
 */
export function relationshipsOf(factionId: string, alsoKnownAsIds: readonly string[] = []): ResolvedRelationship[] {
    const mine = new Set<string>([factionId, ...alsoKnownAsIds]);
    const out: ResolvedRelationship[] = [];

    for (const pair of ALL_PAIRS) {
        const isA = mine.has(pair.aId);
        const isB = mine.has(pair.bId);
        // A body is not in a relationship with itself. This is not theoretical:
        // a court and the sect that IS that court are two ids for one body, and
        // without this guard the Azure Mist would appear on its own sheet as
        // its own subordinate.
        if (isA === isB) continue;

        const side = isA ? pair.a : pair.b;
        const otherSide = isA ? pair.b : pair.a;
        const otherId = isA ? pair.bId : pair.aId;

        out.push({
            id: pair.id,
            otherId,
            otherName: nameOfBody(otherId),
            stance: isA ? invert(pair.aStandsTo) : pair.aStandsTo,
            kind: pair.kind,
            source: pair.source,
            what: pair.what,
            since: pair.since,
            warmth: side.warmth,
            theirWarmth: otherSide.warmth,
            howTheyPutIt: side.howTheyPutIt,
            andSoTheyDo: side.andSoTheyDo,
            grievance: side.grievance
        });
    }

    return out.sort((x, y) =>
        STANCE_ORDER[x.stance] - STANCE_ORDER[y.stance]
        || Number(y.source === 'authored') - Number(x.source === 'authored')
        || x.otherName.localeCompare(y.otherName));
}

/**
 * The one tie between two named bodies, from the first one's side. Usually none.
 *
 * Both ends are resolved through every id their body is filed under, because a
 * caller holding a court id and a caller holding that court's sect id are
 * asking the same question and must get the same answer. Matching on the bare
 * string instead reported that the Azure Mist Court does not record the apex
 * that posted it, which it does, under the apex's other name.
 */
export function relationshipBetween(factionId: string, otherId: string): ResolvedRelationship | undefined {
    const theirs = new Set(idsForFaction(otherId));
    return relationshipsOf(factionId, idsForFaction(factionId))
        .find(r => idsForFaction(r.otherId).some(id => theirs.has(id)));
}

/** Every authored and derived pair in the world. For the coherence tests. */
export function allFactionRelationshipPairs(): readonly {
    id: string;
    aId: string;
    bId: string;
    aStandsTo: RelationStance;
    kind: RelationKind;
    source: RelationSource;
}[] {
    return ALL_PAIRS.map(p => ({
        id: p.id,
        aId: p.aId,
        bId: p.bId,
        aStandsTo: p.aStandsTo,
        kind: p.kind,
        source: p.source
    }));
}
