/**
 * The four roads that reach the top of the ladder, and what it actually takes
 * to be walked up one.
 *
 * The manuals themselves are ordinary rows in `techniques.ts` and are read by
 * the same code as a stall primer. What this module carries is the two facts a
 * teach list cannot express, and which decide whether anybody ever gets up one
 * of them:
 *
 *   HOW MANY COPIES THE HOUSE PHYSICALLY HAS, and it is one or two. Not a
 *   rarity tier and not a policy: copying out a road of that depth takes the
 *   hours of somebody who has walked it, there is nobody else who can, and so
 *   the supply is bounded by how many hours one person at the top of the ladder
 *   has spent writing. The copies are LENT and go back. Possession stays with
 *   the house, access is granted and withdrawn, and that is a different
 *   relationship to an object than owning it.
 *
 *   HOW MANY PEOPLE IN THE HOUSE CAN TEACH AT THAT DEPTH, which is the figure
 *   that actually separates these four bodies. An apex has ONE, and only
 *   sometimes: the head of the house, at their own discretion, showing a
 *   chosen disciple a thing or two between everything else they have to do. The
 *   Hollow Court has FOUR, and all four are working on nothing else.
 *
 * THAT SECOND NUMBER IS WHY THE COURT'S ROAD IS THE BEST ONE. Not a better
 * secret and not a further reach - every road here ends at the same rung. Four
 * people whose whole attention is on getting somebody up a road, against a
 * fraction of one person's, is four times the capacity aimed at the same
 * problem, and centuries of that is what a well-paved road is made of. The
 * paving is recorded on the manual itself as an absent `opening`; the reason
 * for it is here.
 *
 * AND THE HOUSE CANNOT WALK ANYBODY TO THE END. Nothing here says so and
 * nothing needs to: `carriesTo` in `techniques.ts` takes the lower of the
 * teacher's own rung and the book's cap, the three apex heads stand at 43, 42
 * and 41, and the roads run past all three. The last rungs of those three are
 * walked alone. The Hollow Court's seats stand at the top of the ladder, so it
 * is the only body in the world whose road has a teacher for the whole of it,
 * and it is also the only one that has repeatedly produced people who finished.
 *
 * NOTHING HERE DECIDES ANYTHING. There is no throughput formula and no helper
 * that converts a capacity into an advancement rate. `teachersAtDepth` is a
 * count of named people, and the register prints it beside a shelf so a reader
 * can see the difference between a body that holds a road and a body that is
 * spending itself on one.
 */

import { z } from 'zod';

import { MAX_ORDINAL } from '../../engine/cultivation/realms.js';

/**
 * How a copy reaches a reader, where one does at all.
 *
 * `lent` is the whole of the apex answer and it is doing real work: a chosen
 * disciple may be permitted to read the house's copy and it goes back
 * afterwards, so nobody outside the house has ever held one and no second
 * copy has ever entered the world through a student.
 */
export const DeepRoadAccessSchema = z.enum(['lent', 'read_in_the_hall']);
export type DeepRoadAccess = z.infer<typeof DeepRoadAccessSchema>;

export const DeepRoadTeacherSchema = z.object({
    /** What the house calls them, or the office where the person is unnamed. */
    who: z.string().min(2),
    realmOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    /**
     * How much of this person is actually available for teaching, in words.
     *
     * The load-bearing field on the apex rows. "Sometimes" is the difference
     * between one teacher and a fraction of one, and it is why a seat at an
     * apex is worth what it is worth: what is being competed for is the only
     * hours there are.
     */
    availability: z.string().min(60)
});
export type DeepRoadTeacher = z.infer<typeof DeepRoadTeacherSchema>;

export const DeepRoadHoldingSchema = z.object({
    /** The body, by whichever id the register files it under. */
    factionId: z.string().min(1),
    /** The road, by its row in `techniques.ts`. */
    techniqueId: z.string().min(1),
    /**
     * Copies the house physically holds. One or two at an apex.
     *
     * A count with a measurement behind it rather than a chosen number: see
     * `whyThatManyCopies`, which is always somebody's hours.
     */
    copies: z.number().int().min(1).max(12),
    /** Why that many, in hours rather than in rarity. Never a tier. */
    whyThatManyCopies: z.string().min(120),
    access: DeepRoadAccessSchema,
    /** What being allowed to read one actually involves, and what it is not. */
    accessTerms: z.string().min(120),
    /** Everybody in the house who can personally carry somebody up it. */
    teachers: z.array(DeepRoadTeacherSchema).min(1),
    /**
     * Whether the house's capacity is whole or a fraction of one person.
     *
     * `teachers.length` is the count; this is what the count is worth, and on
     * three of the four rows the honest answer is "less than the number
     * suggests".
     */
    capacityNote: z.string().min(120),
    /**
     * How the teaching is rationed by standing inside the house, where it is.
     *
     * Null where the question does not arise, which is every apex: there is one
     * teacher and their attention is not a thing that gets divided by rank, it
     * is a thing that gets given to one person or to nobody.
     */
    gradedByStanding: z.string().min(120).nullable(),
    /** Where the people who teach it learned what they are teaching. */
    whereTheTeachingComesFrom: z.string().min(120)
});
export type DeepRoadHolding = z.infer<typeof DeepRoadHoldingSchema>;

export const THE_DEEPEST_ROADS: readonly DeepRoadHolding[] = [
    {
        factionId: 'sect-azure-cloud-pavilion',
        techniqueId: 'clear-terrace-ascension-canon',
        copies: 2,
        whyThatManyCopies:
            'Two, and the second one took eleven years. Ru Anwei wrote it out herself because there is nobody else in the house who has read the whole of it and nobody else in the world who could be shown it, and eleven years of a woman at the first rung of the last realm is what one copy of a road at this depth costs. She has not begun a third and has not said whether she intends to.',
        access: 'lent',
        accessTerms:
            'Lent, inside the inner hall, to somebody the house has already decided about. It goes back. No copy has left the terraces in three hundred and eighty years, no disciple has been given one to keep, and the Pavilion does not regard this as secrecy - it regards it as the only arrangement under which the second copy still exists.',
        teachers: [
            {
                who: 'Ru Anwei',
                realmOrdinal: 41,
                availability:
                    'Sometimes, and nobody can predict which times. She has not left the inner hall in three hundred and eighty years and the whole of the Pavilion is arranged so that nobody needs her to, so what a chosen disciple is asking for is hours out of the one person the house cannot spare, and the answer is often nothing at all.'
            }
        ],
        capacityNote:
            'One teacher, available sometimes, which is materially less than one. Everything else the head of an apex has to be doing is the reason, and the reason is not laziness: a body of this size with a front gate, a probation programme, two feeders and a standing objection at the top of the world has a great many claims on the only person in it who can teach this. What is being competed for is the hours, and there are very few.',
        gradedByStanding: null,
        whereTheTeachingComesFrom:
            'From the author, directly, and from nobody since. Ru Anjing taught the road to her sister in the decades before she crossed and to no one else, so everything the Pavilion knows about walking it is one woman\'s memory of being taught by one woman, three hundred and eighty years ago.'
    },
    {
        factionId: 'apex-deep-survey',
        techniqueId: 'arterial-sounding-canon',
        copies: 1,
        whyThatManyCopies:
            'One, which is the original, and the Survey has never made a second. The Assessor of the Deep has costed the work and filed the figure: a fair copy is somewhere over nine years of his own hours, the road would be unavailable for the duration because he would be the one writing it, and the Survey has concluded twice that the arrangement is better as it stands. The figure is in the file and so is the conclusion.',
        access: 'read_in_the_hall',
        accessTerms:
            'Read where it sits, in the presence of somebody who is not going to leave the room, and not carried out of it. There is exactly one copy, so lending it would mean the Survey did not have it, and the Survey does not do things that would leave a datum unattended.',
        teachers: [
            {
                who: 'The Assessor of the Deep',
                realmOrdinal: 43,
                availability:
                    'Sometimes, and only for somebody the Survey has already decided to spend on. He administers five provinces of granted ground through four courts and reads what they send up, and the hours he could give a student are the hours he is not doing that. Nobody is told in advance whether the answer will be yes.'
            }
        ],
        capacityNote:
            'One teacher, available sometimes, and the road runs two rungs past where he himself stands. So the Survey can start somebody, can take them a long way, and cannot finish them, and it has never pretended otherwise to anybody it has started.',
        gradedByStanding: null,
        whereTheTeachingComesFrom:
            'From the house\'s own succession, which is the ordinary case and the least interesting answer: whoever held the seat taught whoever was going to hold it next, and the chain is as old as the Survey and has never been written down as a chain.'
    },
    {
        factionId: 'apex-long-cut',
        techniqueId: 'driven-ground-endurance-canon',
        copies: 2,
        whyThatManyCopies:
            'Two, and both are scheduled objects like everything else here: the second was made because the first is carried and a carried document gets wet, and the Long Cut priced the replacement against the loss and made the copy. It took the holder of the seat somewhat over seven years, entered on the record as seven years of a face nobody worked, which is the only entry of its kind in the schedule.',
        access: 'lent',
        accessTerms:
            'Lent on a term, in writing, with the return date on the document, exactly as everything else in this arrangement is issued. Nobody has ever failed to return one and the Long Cut has never had to consider what it would do about that, which it regards as evidence that the terms are set correctly.',
        teachers: [
            {
                who: 'The Nail-Keeper',
                realmOrdinal: 42,
                availability:
                    'Sometimes, and it goes on the schedule when it happens. The seat cannot leave the Nail, so a student comes to the ground rather than the other way round, and the hours come out of the same forty-staff arrangement that administers five provinces of driven face by name.'
            }
        ],
        capacityNote:
            'One teacher, available sometimes, and the hardest opening of any road in the world in front of the student before the teaching starts to matter. The Long Cut states both figures to anybody it offers this to, at the time, in writing, because stating the price at the time is the one thing it does that nobody has ever complained about.',
        gradedByStanding: null,
        whereTheTeachingComesFrom:
            'From the previous holder of the seat, on a handover, on a date. The Long Cut has a record of every one of them and has never made anything of the fact that it is the only continuous teaching lineage at this height that anybody could actually produce a document for.'
    },
    {
        factionId: 'sect-hollow-court',
        techniqueId: 'protected-crossing-canon',
        copies: 6,
        whyThatManyCopies:
            'Six, which is four hands rather than one and several centuries of them. The Court copies the road because a road nobody can read is not a road: every person on it needs one in front of them, and four people at the top of the ladder writing between crossings produce copies at a rate no single seat anywhere else can approach. It is the same arithmetic that gives an apex one or two, run with four times the hands.',
        access: 'lent',
        accessTerms:
            'Lent to whoever is on the road, for as long as they are on it, and returned when they are past that stretch. Nothing leaves the four mountains. A copy is not a possession here and is not treated as one - it is the thing you are currently reading, and somebody else is going to need it.',
        teachers: [
            {
                who: 'The first seat',
                realmOrdinal: 44,
                availability:
                    'Entirely, apart from a crossing. Presence at the Court is measured in decades of absence because a protector has to be standing there for the whole of somebody\'s attempt, and outside those stretches the seat is on the mountain and is working on this and on nothing else.'
            },
            {
                who: 'The second seat',
                realmOrdinal: 44,
                availability:
                    'Entirely, apart from a crossing. The four take the protecting in turn, which is the arrangement the whole Court is built on, and it is also why teaching capacity here is never zero: one is away and three are not.'
            },
            {
                who: 'The third seat',
                realmOrdinal: 43,
                availability:
                    'Entirely. Has not stood protector in this era and has spent the whole of it on the road, which the other three regard as the most useful thing anybody in the Court is currently doing.'
            },
            {
                who: 'The fourth seat',
                realmOrdinal: 41,
                availability:
                    'Entirely, and this is the seat a disciple actually sees. The furthest from the top of the four and consequently the one who most recently walked the stretch an outer disciple is on, which the Court has decided makes them the right person to be teaching it.'
            }
        ],
        capacityNote:
            'Four teachers, and all four working on the same road, which is the single fact that separates this body from an apex. An apex holds a comparable shelf and can spare a fraction of one person for it; the Court has one purpose and spends everything it has on that purpose, so the whole of its capacity points at the same problem. Four times the attention on one question, for centuries, is what produced a road with no bad stretch in it.',
        gradedByStanding:
            'By how far along you are, and an outer disciple gets less. Not as a rationing of favour: the four are spending their hours where the hours do the most, and somebody at the start of the road needs the stretch the fourth seat walked most recently rather than the stretch only the first seat has ever seen. What an outer disciple gets is real teaching from somebody at the top of the ladder and less of it than a seat gets, and everybody at the Court can say exactly why without anybody being embarrassed about it.',
        whereTheTeachingComesFrom:
            'From each other, and from one person who is not a member and never has been. The seats teach each other, which is what makes them a collaboration rather than four hermits on four mountains - and the ones at the last realm are also the only people in the world a False Immortal will sit down with, because they are the only ones who can follow him. He is not of the Court, holds nothing of theirs, and is given nothing; what passes is conversation, and it is worth more than any ruin because a ruin holds what somebody left behind and he is alive and can be asked. Nobody outside can establish that any of this happens.'
    }
];

const BY_FACTION: ReadonlyMap<string, DeepRoadHolding> =
    new Map(THE_DEEPEST_ROADS.map(r => [r.factionId, r]));

/** The deep road this body holds, where it holds one. Four bodies do. */
export function deepRoadOf(factionId: string): DeepRoadHolding | undefined {
    return BY_FACTION.get(factionId);
}

/** Which body holds this road. Exactly one, by the counting rule. */
export function whoHoldsDeepRoad(techniqueId: string): DeepRoadHolding | undefined {
    return THE_DEEPEST_ROADS.find(r => r.techniqueId === techniqueId);
}

/**
 * How many people in this house can teach at that depth, and nothing more.
 *
 * A count of named people rather than a rate. What it is worth is
 * `capacityNote` on the row, which is prose because "one, sometimes" is not a
 * number and pretending it is would be the kind of quiet arithmetic this
 * catalog is not allowed to carry.
 */
export function teachersAtDepth(factionId: string): number {
    return BY_FACTION.get(factionId)?.teachers.length ?? 0;
}
