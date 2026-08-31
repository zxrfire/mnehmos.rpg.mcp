/**
 * Wandering figures: people who belong to nothing and are therefore worth
 * asking.
 *
 * `docs/world/asking.md` ends on the rule this file exists to embody: what
 * closes a mouth is position, not power. An official has more to lose by
 * talking than he could gain. A patriarch answers for a sect. A guest elder is
 * paid by somebody. All of them are careful, and their care scales with how
 * much they have.
 *
 * Somebody with no sect, no title, no lease, no obligations and nothing anyone
 * can do to them is under no such pressure, and will simply say things - not as
 * a favour, not because the asking was skilful, but because it cost nothing and
 * they were already talking.
 *
 * That is not a shortcut and must never be built as one. A wanderer is rare,
 * hard to recognise before they matter, and under no obligation to be accurate,
 * current, serious or consistent. They may answer the first question and ignore
 * the second. What they say may be two centuries out of date and delivered as
 * though it were this morning. They may be wrong and not care.
 *
 * Every entry here is `unaware` to an ordinary cultivator: not hard to find,
 * unknown to exist. See `hierarchy.ts` for the awareness ladder and the rule
 * that a name may not be spoken in narration to somebody who has no record of
 * it.
 */

import { z } from 'zod';
import { MAX_ORDINAL } from '../../engine/cultivation/realms.js';
import { AwarenessSchema } from './hierarchy.js';
import type { SecretStatus } from '../../engine/social/secrets.js';

// ─────────────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────────────

/** What the last crossing did to them, where it applies. */
export const CrossingOutcomeSchema = z.enum(['none', 'false_immortal', 'true_immortal']);
export type CrossingOutcome = z.infer<typeof CrossingOutcomeSchema>;

/** One of the mutually incompatible stories in circulation. */
export const LegendSchema = z.object({
    /** The name this version uses. */
    calledBy: z.string().min(1),
    /** Who tells it. */
    toldAmong: z.string().min(30),
    version: z.string().min(80),
    /** Whether it is true. Almost all of them are not. */
    accurate: z.boolean(),
    /** What is actually wrong with it, for the engine rather than the player. */
    whatIsWrong: z.string().min(40)
});
export type Legend = z.infer<typeof LegendSchema>;

/**
 * An inheritance of his, which is unlike every other inheritance in the world
 * in two ways: it is restocked, because he is alive, and it is not in a place,
 * because he is walking around and moves it when it suits him.
 */
export const MobileInheritanceSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    contents: z.string().min(100),
    /** True. This is the property nothing else in the world has. */
    refills: z.literal(true),
    refillNote: z.string().min(150),
    /** It is not a site. Anybody treating it as one is wasting their life. */
    mobile: z.literal(true),
    mobilityNote: z.string().min(150),
    lastMovedYearsAgo: z.number().int().min(0),
    /** Accounts of it, which contradict each other without anybody lying. */
    contradictoryAccounts: z.array(z.string().min(60))
});
export type MobileInheritance = z.infer<typeof MobileInheritanceSchema>;

/** Somebody he happened to like. Not a disciple, not a lineage, not a following. */
export const InheritorSchema = z.object({
    name: z.string().min(1),
    whatTheyWere: z.string().min(40),
    /** Why them. He would say fate, and would not elaborate. */
    chosenBecause: z.string().min(60),
    /** The real thing they have, which is usually latent and rarely visible. */
    latentThing: z.string().min(80),
    /** Whether the inheritor has any idea. Usually not. */
    theyKnow: z.boolean(),
    status: z.enum(['living', 'dead']),
    /** Whether he has noticed, where they are dead. Frequently he has not. */
    heKnows: z.boolean(),
    note: z.string().min(80)
});
export type Inheritor = z.infer<typeof InheritorSchema>;

/** Something small he did while walking about. Incidents, not deeds. */
export const IncidentSchema = z.object({
    yearsAgo: z.number().int().min(0),
    where: z.string().min(10),
    what: z.string().min(100),
    /** What it did to somebody afterwards, which he did not stay to see. */
    consequence: z.string().min(80),
    /** True where he has never learned what his passing through cost. */
    heNeverLearned: z.boolean()
});
export type Incident = z.infer<typeof IncidentSchema>;

/**
 * The only ceiling on his behaviour, and it is not in this world.
 *
 * He does not care about any consequence the mortal world can produce, and he
 * is correct not to: nothing below the Lid can reach him. What he does care
 * about is that an act outrageous enough will bring an old immortal down to
 * kill him, at a price they would pay and he knows they would pay.
 *
 * The line is drawn by WHOSE INTEREST an act crosses, never by how much damage
 * it does - which is why, from below, his restraint looks arbitrary. He robs a
 * top sect on a whim and then declines something that appears smaller, and
 * nobody watching can derive the rule. Only somebody who understands what is
 * above the Lid can, which makes his behaviour a piece of evidence about the
 * shape of the world for anyone able to read it.
 */
export const RestraintSchema = z.object({
    principle: z.string().min(150),
    /**
     * What he does not know, which is the actual source of the restraint. He
     * is not avoiding a known punishment from a named party; he is declining
     * to find out what is on the other side of a door.
     */
    whatHeDoesNotKnow: z.string().min(150),
    /** Acts he leaves alone for no reason more elevated than having no reason. */
    noMotiveNote: z.string().min(120),
    /** Acts he will do cheerfully, each with whose problem it is. */
    willDo: z.array(z.string().min(60)),
    /** Acts he will not do, each with whose interest it crosses. */
    willNotDo: z.array(z.string().min(60)),
    /** The deterrent, named, and not an abstraction. */
    theDeterrent: z.string().min(150),
    /** What enforcing it would cost the enforcer. It is enormous. */
    deterrentPrice: z.string().min(150),
    /** Warned, worked it out, or both - and when. */
    howHeKnows: z.string().min(120),
    /** A specific occasion where he stopped short. Worth more than a policy. */
    theOccasion: z.object({
        yearsAgo: z.number().int().min(1),
        what: z.string().min(150),
        whereHeStopped: z.string().min(100),
        whoNoticed: z.string().min(60)
    }),
    /** Why nobody below can predict him. */
    looksArbitraryFromBelow: z.string().min(150),
    /** And who could, in principle, read it correctly. */
    readableBy: z.string().min(100),
    /** The player is not covered by any of this. */
    playerIsNotProtected: z.string().min(150)
});
export type Restraint = z.infer<typeof RestraintSchema>;

/**
 * Why he is wandering, and it is logistical rather than tragic.
 *
 * He is not cursed, shunned or brooding. He outlived his enemies, most of whom
 * died of things that had nothing to do with him, and the handful of people he
 * would actually want to talk to are in seclusion for another sixty years.
 * That is the whole of it.
 *
 * So walking the mortal world is not a hobby and not a search for meaning: it
 * is the only conversation available. Which reframes the generosity entirely -
 * he likes somebody because they are there, present and interesting for an
 * afternoon, and that is scarcer in his life than any object. Stealing a pill
 * for a stranger costs him nothing and is the most interesting thing to have
 * happened to him in a decade.
 *
 * Never write him as lonely. He is cheerful, curious and unbothered, and has
 * not once mentioned any of this. The reader can do the arithmetic.
 */
export const IsolationSchema = z.object({
    enemies: z.string().min(120),
    lastFriendWhoDied: z.object({
        name: z.string().min(1),
        whatTheyWere: z.string().min(40),
        yearsAgo: z.number().int().min(1),
        howHeHeard: z.string().min(60)
    }),
    friendsInSeclusion: z.object({
        lastSpokeYearsAgo: z.number().int().min(1),
        withWhom: z.string().min(10),
        expectedOutInYears: z.number().int().min(1),
        note: z.string().min(100)
    }),
    whyHeTalksToStrangers: z.string().min(150),
    /** The afternoon that reorganises a life is, to him, an afternoon. */
    theAsymmetry: z.string().min(150),
    /** He keeps turning up in the same few places. */
    regulars: z.array(z.object({
        place: z.string().min(5),
        person: z.string().min(3),
        yearsThere: z.number().int().min(1),
        timesServed: z.number().int().min(1),
        whatTheyThinkHeIs: z.string().min(40),
        note: z.string().min(60)
    }))
});
export type Isolation = z.infer<typeof IsolationSchema>;

/**
 * One of the four he simply does not like.
 *
 * Not a feud. At their scale a real quarrel would be a geological event and
 * this is nothing of the sort - he finds one of them irritating and always
 * has. Keep it petty. It is what turns four beings who have stopped
 * participating in the world into people, and it undercuts nothing, because
 * there is nothing at stake in it at all.
 */
export const PettyDislikeSchema = z.object({
    /** Which of the four. */
    who: z.string().min(3),
    reasonYearsAgo: z.number().int().min(1),
    /** Trivial, and it would sound absurd said aloud. */
    reason: z.string().min(120),
    /** And partly forgotten, which he has decided does not matter. */
    forgottenPart: z.string().min(80),
    /** Possibly mutual. He has never asked. */
    mutual: z.enum(['unknown']),
    mutualNote: z.string().min(80),
    /** Consequences no larger than the pettiness deserves. */
    consequences: z.array(z.string().min(40)),
    /** Neither will explain, and not because it is a secret. */
    whyNeitherExplains: z.string().min(120),
    /** What it is explicitly not, so nobody escalates it later. */
    whatItIsNot: z.string().min(80),
    /**
     * The shape underneath, which is not distance or mystery but familiarity.
     * The surface stays trivial and unexplained; this is what is actually
     * going on, and neither party will say it.
     */
    theShapeUnderneath: z.string().min(200)
});
export type PettyDislike = z.infer<typeof PettyDislikeSchema>;

export const WandererSchema = z.object({
    id: z.string(),
    /** The name in the one record that has it right. Rarely used aloud. */
    recordName: z.string().min(1),
    /** What most people who know anything call him. */
    commonName: z.string().min(1),
    /** Above the ladder in effect; the ordinal is the last one he stood on. */
    lastOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    crossingOutcome: CrossingOutcomeSchema,
    crossingYearsAgo: z.number().int().min(1),
    /** What he was before the attempt, and where he came from. */
    before: z.string().min(150),
    /** What the attempt did, stated plainly. */
    whatHappened: z.string().min(150),
    /** The one specific thing that did not come back. Never explained. */
    incomplete: z.string().min(80),
    /**
     * A property of what he now is rather than a technique he uses. He is not
     * fixed, and changes when it suits him for reasons that are barely
     * reasons. Never give it a name or list it as a capability: a man who did
     * not entirely come back is not going to have a fixed face, and he has
     * never once remarked on it.
     */
    notFixed: z.object({
        howItReads: z.string().min(150),
        casualNotTactical: z.string().min(150),
        whyItDefeatsARegister: z.string().min(150),
        whoCouldTell: z.string().min(120)
    }),
    /** Never explained anywhere, by him or by the catalog. */
    incompleteIsUnexplained: z.literal(true),
    /** Vast, finite, and he knows the figure. */
    lifespanYearsRemaining: z.number().int().min(1),
    lifespanNote: z.string().min(100),
    /** The affiliation, and what it actually amounts to, which is nothing. */
    affiliation: z.object({
        factionId: z.string(),
        rankHeld: z.string().min(1),
        /**
         * A rank previously held, where the current one replaced something.
         *
         * Null is the ordinary case. It is set where the honorary rank is not a
         * courtesy extended to an outsider but the residue of a real position
         * somebody can no longer occupy, which is a different relationship and
         * reads as one the moment it is stated.
         */
        formerRank: z.string().nullable(),
        whatItAmountsTo: z.string().min(150),
        /** What the faction gets out of it without doing anything. */
        whatTheFactionGets: z.string().min(80)
    }),
    /** Why he is not there, which is the whole logic of him. */
    whyNotWithThem: z.string().min(150),
    /** Wanted, and unsupplied by anybody below the Lid. */
    wants: z.string().min(120),
    whyHeIsHonest: z.string().min(150),
    /** The ways he is not a shortcut, enumerated so nobody builds one. */
    unreliability: z.array(z.string().min(40)),
    /** He could stand protector at a crossing. Unresolved on purpose. */
    couldStandProtector: z.string().min(200),
    /** What being noticed by him does, which he neither intends nor tracks. */
    attentionConsequence: z.string().min(200),
    restraint: RestraintSchema,
    /**
     * He divested completely before the crossing, the way every ascending
     * cultivator does, because nothing goes through the Lid with them - and
     * then did not complete it. He owns nothing and wants nothing, and this is
     * not asceticism: he finished that part of his life and then kept going.
     */
    estate: z.object({
        divestedYearsAgo: z.number().int().min(1),
        whatHeDid: z.string().min(150),
        whyObjectsDoNotRegister: z.string().min(150),
        /** Never written pathetically. He does not experience it that way. */
        notPathetic: z.string().min(100)
    }),
    inheritances: z.array(MobileInheritanceSchema),
    /**
     * A secret with an explicit holder set, which is what the secret lifecycle
     * in `src/engine/social/secrets.ts` is for: the inheritors and the Court
     * members who already know are the holders, and an outsider can only be
     * `unknown`, `suspected`, `leaked` into, or `misunderstood`. Nothing new is
     * invented here; this records who holds it and what breaking it costs.
     */
    secrecy: z.object({
        /** As he actually put it. Once, offhand, and never repeated. */
        theOath: z.string().min(150),
        permittedToTell: z.array(z.string().min(30)),
        forbidden: z.string().min(80),
        /** Not fear of consequence. He does not want them gossiping. */
        motive: z.string().min(120),
        /** Why everything in circulation comes from people who saw a glimpse. */
        whyLegendsAreIncoherent: z.string().min(200),
        /** The worst possible consequence, which is nothing at all. */
        breachConsequence: z.string().min(200),
        theOneWhoTalked: z.object({
            name: z.string().min(1),
            whatTheyWere: z.string().min(40),
            yearsAgo: z.number().int().min(1),
            whyTheyTalked: z.string().min(100),
            whatHappened: z.string().min(150),
            whatDidNotHappen: z.string().min(100),
            howLongTheyDidNotKnow: z.string().min(100)
        }),
        /** The joke underneath it: they are allowed to talk and never do. */
        networkBarelyFunctions: z.string().min(200),
        /**
         * Statuses an outsider holding of this secret may legitimately be in,
         * drawn from the engine's own `SecretStatus` union rather than a new
         * vocabulary. Typed as the engine type so a rename there breaks here.
         */
        outsiderStatuses: z.array(z.string().min(4)).transform(v => v as SecretStatus[])
    }),
    /**
     * Chosen by fate, which at his level is not a figure of speech.
     *
     * From outside the selection looks arbitrary and no method can be built on
     * it - that part is true and load-bearing. What is NOT true is that there
     * is nothing there. Every one of them has something real. It is usually
     * latent rather than demonstrated, it is not legible to observers, and it
     * is frequently not legible to the inheritor either.
     *
     * Which is why the inheritances are not merely treasure. The engine models
     * a latent slope that is rolled from the run seed and never surfaced
     * (`affinityFor` in `engine/cultivation/dao.ts`), and it models access as a
     * hard filter rather than a modifier: without something to comprehend
     * from, a Dao is not harder, it is absent. His inheritances are exposure,
     * handed to exactly the people for whom exposure will matter. He is doing
     * the single most valuable thing anybody could do for these people,
     * casually, without method, and without thinking of it as anything.
     */
    inheritors: z.object({
        chosenBy: z.string().min(150),
        /** Fate delivers. He does not have to mean anything by it. */
        fateDelivers: z.string().min(150),
        /** There is always something there. */
        whatTheyHave: z.string().min(150),
        /** And nobody can see it in advance, including him. */
        notLegible: z.string().min(150),
        /** The inheritance is access, which is the thing that actually matters. */
        inheritanceIsExposure: z.string().min(150),
        noPatternToExploit: z.string().min(150),
        notALineage: z.string().min(100),
        people: z.array(InheritorSchema)
    }),
    isolation: IsolationSchema,
    /**
     * Who holds what, and the gap that matters: the two institutions that
     * administer the world have an unaccounted-for existence wandering their
     * territory and do not know what he is. Not an absence in their records - a
     * file, wrong in interesting ways, and a set of entries nobody reconciled.
     */
    whoKnowsWhat: z.object({
        fullTruth: z.array(z.string().min(40)),
        fragments: z.string().min(150),
        nothing: z.string().min(120),
        /**
         * Both apexes know the category and cannot resolve the instance. They
         * are not failing at record-keeping: the thing they are trying to
         * count does not hold still, and neither institution possesses an
         * instrument that would settle it.
         */
        apexBlindSpot: z.object({
            /** Confirmed by both, separately, and not disputed. */
            categoryConfirmed: z.string().min(150),
            /** The question neither can answer: is it the same one. */
            theOpenQuestion: z.string().min(150),
            /** Both concluded, separately, that they cannot tell. */
            bothConcluded: z.string().min(150),
            /** A wandering one is itself anomalous, and the record notices. */
            theAnomaly: z.string().min(150),
            /** The candidate list, as a real artefact. */
            candidateNames: z.array(z.object({
                name: z.string().min(2),
                status: z.enum(['verifiably_dead', 'never_a_person', 'unresolved', 'live']),
                whatTheRecordHas: z.string().min(80)
            })),
            candidateListNote: z.string().min(150)
        }),
        whatItIsWorth: z.string().min(150)
    }),
    /** The four have not agreed about anything in six hundred years. */
    courtOpinions: z.array(z.object({
        who: z.string().min(3),
        stance: z.enum(['fond', 'indifferent', 'amused', 'dislikes']),
        note: z.string().min(100)
    })),
    theOneHeAvoids: PettyDislikeSchema,
    incidents: z.array(IncidentSchema),
    legends: z.array(LegendSchema),
    startingAwareness: z.literal('unaware'),
    awarenessSources: z.array(z.string().min(30)),
    /** How he presents, before anybody knows anything. */
    firstImpression: z.string().min(120)
});
export type Wanderer = z.infer<typeof WandererSchema>;

// ─────────────────────────────────────────────────────────────────────────
// THE CATALOG
// One entry. He is supposed to be the only one of his kind anybody meets.
// ─────────────────────────────────────────────────────────────────────────

export const WANDERERS: readonly Wanderer[] = [
    {
        id: 'wanderer-lu-sheng',
        recordName: 'Lu Sheng',
        commonName: 'the Guest',
        lastOrdinal: 44,
        crossingOutcome: 'false_immortal',
        crossingYearsAgo: 640,
        before:
            'Born at the eastern perimeter to the Girdle remnant, three generations after the Anchorhold took the survey, into a lineage that is permitted to live there and barred from holding rank in the house that replaced theirs. He climbed anyway, without a patron, without a grant, and without ever being admitted to anything, which is the part of the account nobody disputes because there is nobody who could have sponsored him.',
        whatHappened:
            'He reached the end of Tribulation Transcendence six hundred and forty years ago and made the last crossing. The tribulation was survived and the hole was opened. The crossing did not complete: what is left stayed on this side, permanently and by name, and the Lid does not open twice for the same name. He is stronger than anything at Tribulation Transcendence and he is not a True Immortal, and both halves of that are permanent.',
        incomplete:
            'He cannot hear rain. Every other sound reaches him normally. He watches it come down in silence and refers to it, when it comes up at all, the way a person refers to a mild inconvenience of long standing.',
        incompleteIsUnexplained: true,
        notFixed: {
            howItReads:
                'He does not have a fixed face. It is not a technique, it has no name, he has never demonstrated it and he has never mentioned it - it is simply a property of what came back, in the same register as not being able to hear rain. Somebody who spent an evening with him and meets him again in nine years is meeting a stranger who talks the same way.',
            casualNotTactical:
                'He is not hiding, not maintaining aliases and not running anything. He changes when it suits him, for reasons that are barely reasons, in the way another man might change which road he takes out of a town. There is no scheme to uncover because there is no scheme.',
            whyItDefeatsARegister:
                'Deliberate deception would be far easier to handle: deception has patterns, and a body like the Deep Survey is extremely good at patterns. Whim has none. There is nothing to model, no alias set to correlate, and no behaviour that recurs - so the sightings can be neither linked nor separated, and the register cannot even say how many people it is looking at.',
            whoCouldTell:
                'His inheritors, because they know him rather than his face - the way he asks a second question, what he finds funny, the specific quality of not being in a hurry. It is one more reason he would rather they did not gossip, and it has never been the reason he gave.'
        },
        lifespanYearsRemaining: 11_000,
        lifespanNote:
            'Vast and finite, and he knows the number to the year. He will give the figure to anybody who asks, without ceremony, and the figure is smaller every time somebody asks it. That arithmetic is the entire reason he is walking around rather than sitting still.',
        affiliation: {
            factionId: 'sect-hollow-court',
            rankHeld: 'Guest of the Court',
            formerRank: 'First Seat',
            whatItAmountsTo:
                'It is real and it is empty, and it is what is left of something that was not. He held First Seat: at Tribulation Transcendence Perfection there was nobody above him, and he made the crossing from the top of the Court rather than from the edge of it. What came back could not hold a seat. Seats go by ordinal and then by remaining years, and a False Immortal has no ordinal and no attempts left at all, so he is not merely unranked - he is the one person the rule can never favour, and the Court had to invent somewhere to put him. Guest of the Court sits outside the four rungs rather than beneath them, he was entered on it without discussion, and has never used it for anything. No Seat has asked him for a service, he has never been to the mountains, and the last time any of the four saw him is not recorded. There is no obligation attached in either direction and neither party has ever proposed one - including the obvious one: if the mountains were attacked tomorrow nothing whatsoever compels him to come, and nobody can say whether he would. The tie is real for all that. He is on the roll, he has never asked to be taken off it, and the fact that no outsider can price what he would do is worth more to the Court as deterrence than a promise it could not enforce anyway.',
            whatTheFactionGets:
                'Prestige, without having done anything to earn it: the Court has a False Immortal on its roll, everyone who knows anything knows it, and the Court has never once mentioned him. It also gets the only living account of what the crossing looks like from the top of that ladder, from somebody who went at it with every advantage the Court can supply. It has never asked, and the three who would benefit most are the three who have to sit with why not.'
        },
        whyNotWithThem:
            'The Hollow Court is four people working continuously on the crossing, and presence there is measured in decades of absence because that is what the work looks like. He is permanently barred from that crossing - it has been opened against his name and will not open again - so there is nothing at the Court for him to do. Everyone else on those mountains has the only thing he does not have, which is something left to attempt. So he left, and nobody argued.',
        wants:
            'To know what the far side declined, and why. Nobody below the Lid can tell him, the only parties who could are through it and do not come back, and he has had six hundred and forty years to establish that no arrangement, resource, favour or threat available in this world touches the question.',
        whyHeIsHonest:
            'Not virtue. He has no sect to protect, no title to lose, no lease, no patron, no disciples and no property, and there is nothing anyone in the world can do to him. Nothing is bought by discretion and nothing is risked by talking, so he says what he happens to be thinking, to whoever is sitting there, and stops when he gets bored. Anybody who mistakes this for candour on their behalf has misunderstood it.',
        unreliability: [
            'He may answer the first question fully and ignore the second entirely, without appearing to notice that he has.',
            'What he says may be two centuries out of date and delivered as though it happened this morning, and he does not distinguish.',
            'He is often wrong about the present and does not care, having no stake in the outcome of any of it.',
            'He does not remember who he has already told, so a thing he said once in a room may be repeated anywhere else.',
            'He answers what he finds interesting, which correlates with nothing the asker can arrange or predict.'
        ],
        couldStandProtector:
            'He could stand protector at a crossing, which is the single most valuable thing anybody in this world could offer and which almost nobody can supply: strong enough to matter against whatever arrives, available in a way nobody holding a sect or a crossing of their own ever is, and entirely indifferent to what it would cost him. Whether he would is not recorded, has never been asked, and should not be resolved here. What is worth knowing is that it is legible to anybody who understands what he is - and that it means an inheritor of his has something to hope for that nobody else in the world can hope for at all.',
        attentionConsequence:
            'He will not hurt anybody and has not in six hundred years. The damage is structural: a sentence from him lands in a room where he has no standing to lose and everyone else has, and it reorganises somebody. A remark taken as endorsement makes a junior disciple suddenly political. A correction offered idly makes an elder wrong in front of people who will remember. A question he asks in passing becomes, within a season, the thing a sect believes he is interested in - and sects act on that. He does not intend any of it, does not track it, and is not there when it arrives. Being noticed by him is closer to weather than to patronage.',
        estate: {
            divestedYearsAgo: 641,
            whatHeDid:
                'Exactly what every ascending cultivator does in the last years, because nothing goes through the Lid with them: he sold, gave away, buried, sealed and arranged. Debts discharged, obligations closed, artifacts distributed, four inheritances built properly and stocked. It took him eleven years and he did it thoroughly. Then he made the crossing, and did not complete it, and came back down to a life he had already finished settling.',
            whyObjectsDoNotRegister:
                'He is not indifferent to objects out of discipline or philosophy. He completed the part of a life where objects matter, deliberately and at length, before most of the people now alive were born - and then kept going for six hundred and forty years past the end of it. Handing somebody a stolen pill costs him nothing because nothing in that category has cost him anything since before their province was surveyed.',
            notPathetic:
                'He does not experience any of this as loss and would be puzzled by the suggestion. The estate was settled correctly, which is a thing done well, and he is pleased with how it was done. He simply also happens to still be here.'
        },
        inheritances: [
            {
                id: 'inheritance-the-fourth-bundle',
                name: 'The fourth of the four he built, which has no name and is called whatever the last person to find it called it',
                contents:
                    'A manual he wrote out himself, two artifacts of no enormous power and considerable quality, spirit stones in a quantity that would change a poor cultivator entirely, and a short letter that does not explain anything.',
                refills: true,
                refillNote:
                    'It has been emptied at least three times and has been full each subsequent time somebody found it, because he restocks it when he passes. Every other inheritance in the world is a dead cultivator\'s final deposit: finite, emptied once, and then a story. This one is maintained, and it is the only category of its kind in existence. Anyone who establishes that a particular inheritance keeps refilling has learned something enormously valuable and cannot explain how it is possible without revealing that he exists, which is why the observation has never been published.',
                mobile: true,
                mobilityNote:
                    'It is not a place. He picks it up and puts it down somewhere else when it suits him, for reasons that are very probably not reasons. Directions to it are worthless inside a decade, so anybody treating it as a site - surveying, sealing, watching, mapping - is wasting their life, and several have. This is also most of why the accounts of him are incoherent.',
                lastMovedYearsAgo: 7,
                contradictoryAccounts: [
                    'A Hollow Bell wanderer found it in a dry cistern under a ruined granary in the Low Fall, ninety years ago, and could take anybody to the spot',
                    'A Gleaners crew found what is plainly the same cache in a burn-zone chamber in the Quiet Marches forty years ago, and can also take anybody to the spot',
                    'A Clear River ferryman describes finding it in a boat locker that was not his boat, twelve years ago, and has never been believed by anybody'
                ]
            }
        ],
        secrecy: {
            theOath:
                'There was no oath and no ceremony; a ritual would have embarrassed him. He said it once, while doing something else, in roughly these words: do not go telling people about me. Other people I have given things to, that is fine. The Court knows already. Everybody else, no. Then he changed the subject, and has never raised it again with anybody, and it has been honoured absolutely by every inheritor who ever received it.',
            permittedToTell: [
                'other inheritors of his, of whom there are perhaps a dozen and most of whom have never met',
                'the Seats of the Hollow Court and the two or three at the top of the Ninefold Ledger who already hold the file'
            ],
            forbidden:
                'Everybody else, without exception: their sect, their master, their family, their disciples and whoever is buying.',
            motive:
                'Not fear, since there is no consequence in the world he would mind and he knows it. He simply does not want to be gossiped about. It is a preference, expressed once, of the same weight as preferring a corner table - and it is obeyed more completely than most oaths sworn in front of the Bound Word.',
            whyLegendsAreIncoherent:
                'Because the accurate sources are precisely the ones not talking. Everything circulating in high cultivator circles comes from the outer ring: a sighting, a secondhand account, an incident witnessed at a distance and reconstructed wrongly by somebody with half of it. The people who could correct any of it are inheritors, who will not, and Court Seats, who do not speak to anybody. So the versions multiply, contradict each other, and are never once tested against somebody who knows.',
            breachConsequence:
                'Nothing. He does not retaliate, punish, threaten, or take anything back - all of which would require caring about it. He simply does not come back. The inheritance is not restocked again and he is never seen there again, and because he had no schedule in the first place, the person who talked cannot tell the difference between having been cut off and his merely being elsewhere. That uncertainty runs for decades and is far worse than a punishment would have been, which he has never thought about and would find an odd thing to be told.',
            theOneWhoTalked: {
                name: 'Tao Ji',
                whatTheyWere: 'A formation master of a small granted sect, and an inheritor for nineteen years',
                yearsAgo: 230,
                whyTheyTalked:
                    'He was accused by his own sect of having stolen the artifacts he was plainly in possession of, and the truth was the only defence he had. He told his sect master, once, in a closed room, and was believed.',
                whatHappened:
                    'The accusation was dropped. And that was the end of it: the cache was never restocked again, and Tao Ji never saw him again. He wrote twice, into the air, with nowhere to send it. He spent the remaining forty-one years of his life unable to establish which of the two things had happened, because there had never been a visiting schedule to depart from.',
                whatDidNotHappen:
                    'No retaliation, no threat, no demand for return, no visit, no word, and nothing taken back. He kept every object he had been given and used them all until he died.',
                howLongTheyDidNotKnow:
                    'Forty-one years, and he died not knowing. His sect master, who is also long dead, believed until the end that the whole account had been invented under pressure.'
            },
            networkBarelyFunctions:
                'The permitted network barely exists. He has never introduced any of them to any of the others, has never given anybody a list, and has never mentioned that there are others except in the sentence that allows them to talk. So the dozen or so people entitled to discuss him almost never do, and two of them could pass each other in a market and neither would have the least idea. He has built a secret society whose members are permitted to speak to one another and functionally never have, and if this were pointed out to him he would think it was funny.',
            outsiderStatuses: ['unknown', 'suspected', 'leaked', 'misunderstood']
        },
        inheritors: {
            chosenBy:
                'Fate, which is his word for it and by which he means nothing rigorous at all. Whoever was standing there. Whoever he ran into three times without arranging it. Whoever survived something he happened to be watching. From outside it is indistinguishable from arbitrariness, he would call it fate, and he would not elaborate if asked - not evasively, but because there is nothing further in his head about it.',
            fateDelivers:
                'He is a False Immortal, and fate at his level is not a figure of speech. When he picks by fate, fate delivers - which does not require him to be trying, to be paying attention, or to have any idea what he has just done. He is genuinely being flippant. It genuinely works. Those two facts do not conflict at his altitude, and that is the part nobody below can get at.',
            whatTheyHave:
                'Every single one of them has something real, and it is the reason they were picked whether or not anybody involved knows it. A brilliant young sword prodigy is an obvious case. A fifty-year-old herb-gatherer who never passed Qi Condensation is not an obvious case, and she has the strongest karmic affinity in three provinces and has never once been in a room where karma was practised. He thought about both decisions equally hard, which is to say not at all, and both were correct.',
            notLegible:
                'What they have is usually latent rather than demonstrated: an unrealised gift, an affinity for something they have never been exposed to, a physique nobody has examined, a comprehension nobody has given them the chance to form. It is not visible to observers, it is frequently not visible to the inheritor, and it is not visible in advance to him either. He is not reading them. He is simply where he is, and so are they.',
            inheritanceIsExposure:
                'This is what makes the inheritances more than treasure. A latent slope stays absent until something exists to comprehend from - a teacher, a manual, a site, an artifact, an inheritance left by somebody who had it - and without that access the road is not harder, it is not there at all. His caches are precisely that access, handed to exactly the people for whom it will matter. He does not think of it as anything, and it is the single most valuable thing anybody in the world could do for these people.',
            noPatternToExploit:
                'No method can be built on any of it. You cannot search for his inheritances, because they are not anywhere in particular, and you cannot qualify as an inheritor, because the criterion is invisible in advance to everybody including him. Every institution that has hunted for the pattern has found nothing extractable, and they are not being stupid: there is a real reason under every choice and no observable rule over the set of them. That is the reason nobody has ever systematically hunted the only restocking inheritances in the world, despite every institution knowing it would be worth doing.',
            notALineage:
                'Not a lineage, not a following, not a sect and not a school. A loose set of people he happened to like, most of whom have never met each other, several of whom are dead, and none of whom were told there were others.',
            people: [
                {
                    name: 'Guo Shi',
                    whatTheyWere: 'A herb-gatherer at the Fourth Ford who never passed Qi Condensation and never expected to',
                    chosenBecause: 'He ran into her three times in four years without arranging any of it, and thought that was enough.',
                    latentThing: 'The strongest karmic affinity in three provinces, on a slope nobody has ever measured, in a woman who never once stood in a room where karma was practised and would not have recognised it if she had.',
                    theyKnow: false,
                    status: 'dead',
                    heKnows: false,
                    note: 'She died nineteen years ago, of ordinary age, having used almost none of it and told nobody where it was. He has not been back that way since and does not know. He will find out eventually, take it calmly, and restock it anyway.'
                },
                {
                    name: 'Wei Lan',
                    whatTheyWere: 'A sword prodigy of an unbacked league, genuinely brilliant, twenty-two at the time',
                    chosenBecause: 'He watched her survive something she had no business surviving and did not intervene, which he considers the relevant fact.',
                    latentThing: 'A sword comprehension of a kind her league has no teacher for and no manual of, which is why it has never surfaced, and which the contents of the cache happen to be exactly the exposure for.',
                    theyKnow: false,
                    status: 'living',
                    heKnows: true,
                    note: 'He looks in every decade or so, is pleasant, asks two or three questions, and leaves. She has never worked out whether she is being tested and has stopped asking.'
                }
            ]
        },
        isolation: {
            enemies:
                'All dead. He did not outfight them, he outlived them, and most of them died of things that had nothing to do with him - age, a bad crossing, a rival, a winter. The last party with a standing grievance against him stopped existing about two hundred years ago when its sect was absorbed, and he found out some decades later, in passing, and had no particular reaction.',
            lastFriendWhoDied: {
                name: 'Bai Erlang',
                whatTheyWere: 'A boatman at the Fourth Ford who was not a cultivator, never asked to be, and argued with him about the same three subjects for fifty years',
                yearsAgo: 31,
                howHeHeard: 'He came back the following spring, found somebody else on the boat, and was told. He asked two questions, said that was a pity, and stayed for the afternoon.'
            },
            friendsInSeclusion: {
                lastSpokeYearsAgo: 41,
                withWhom: 'the Second Seat',
                expectedOutInYears: 60,
                note: 'Part of an afternoon, forty-one years ago, on a path rather than at the Court. She entered seclusion the following spring. Nobody expects any of the four out inside sixty years, and none of them has fallen out with him: they are working continuously on the crossing and are simply not available.'
            },
            whyHeTalksToStrangers:
                'Because there is nobody else to talk to, and that is the entire explanation. It is not a hobby, not a discipline and not a search for anything - the people he would choose are in seclusion for another sixty years, everybody else he ever knew is dead, and a stranger in an inn is the only conversation on offer. He is extremely good company and this is why.',
            theAsymmetry:
                'The afternoon that reorganises somebody else entirely is, to him, an afternoon. He will remember them fondly and inaccurately, will confuse two of them a century later, and may not notice that one has died. None of that is coldness. It is the arithmetic of a very long life, and he has never remarked on it.',
            regulars: [
                {
                    place: 'The Bell and Ford, an inn at Scarwater on the border road',
                    person: 'Old Tan, who has run it since he was thirty-one',
                    yearsThere: 41,
                    timesServed: 9,
                    whatTheyThinkHeIs: 'A retired caravan surveyor with money put by and no family left',
                    note: 'Nine visits in forty-one years, the same corner, the same order, and a conversation Old Tan looks forward to and cannot afterwards summarise. He believes they are nine different customers who happen to drink the same way, has never once suspected otherwise, and would not believe what he has been serving.'
                },
                {
                    place: 'A tea stall at the Fourth Ford, where the boat used to be',
                    person: 'The granddaughter of Bai Erlang, who does not know he knew her grandfather',
                    yearsThere: 12,
                    timesServed: 4,
                    whatTheyThinkHeIs: 'A man who knew somebody here once and does not say who',
                    note: 'He has never mentioned it, which is not restraint - it simply has not come up in four visits, and he assumes there is time.'
                }
            ]
        },
        whoKnowsWhat: {
            fullTruth: [
                'the four Seats of the Hollow Court, who have known him since before the crossing',
                'the inheritors who have actually met him, of whom there are perhaps a dozen and who have been asked not to gossip'
            ],
            fragments:
                'High-level cultivators, and only in the outer ring: a sighting, a secondhand account, an incident reconstructed wrongly by somebody who saw the end of it. Every circulating version is incompatible with the others, none has ever been tested against anybody who knows, and the two or three at the top of the Ninefold Ledger who hold the crossing file have the shape of it and not the man.',
            nothing:
                'Everybody else in the world, including every institution that would pay enormously for it and several that have tried. There is no archive anywhere with a correct account, because the correct accounts are held by people who do not write things down and people who have been asked not to.',
            apexBlindSpot: {
                categoryConfirmed:
                    'Both the Deep Survey and the Long Cut know that a False Immortal is wandering. Neither disputes it and neither ever has: the sightings are too consistent in kind, the incidents require the category, and both institutions established it independently and wrote it down. The category is not the problem.',
                theOpenQuestion:
                    'Whether it is the same one. Sightings across three centuries, in provinces that do not connect, described by people who never met and who describe different men - and no way to establish continuity of identity between any two of them. It could be one existence walking for three hundred years. It could be four, in sequence. The evidence supports both equally and has never leaned.',
                bothConcluded:
                    'That they cannot tell, separately, in their own words, and they are right. Neither institution is being incompetent here: they have done everything competently and they have exactly the evidence that exists, and it does not resolve. This is what real institutional knowledge looks like at this distance, and both of them have had the honesty to write the uncertainty down rather than pick an answer.',
                theAnomaly:
                    'A wandering False Immortal is itself anomalous, and both registers note it. Nearly everybody who half-fails is sealed under a mountain or seated at the Hollow Court, because that state does not usually produce somebody who walks about visiting people. One doing so is not what the category predicts, which is a further reason the record cannot make sense of him: the observations are strange in a way the classification does not account for.',
                candidateNames: [
                    {
                        name: 'Lu Sheng',
                        status: 'live',
                        whatTheRecordHas: 'Logged as having gone up six hundred and forty years ago from the eastern perimeter, of a barred lineage, no sect, no sponsor. Nothing marks the entry out from the others and nothing ever has.'
                    },
                    {
                        name: 'Qiao Wen',
                        status: 'verifiably_dead',
                        whatTheRecordHas: 'Went up four hundred years ago; a scar was found nine years later at the site, dated and matched, with the tribulation signature intact. As certain as anything on the list gets, and he is on it anyway because a garbled account surfaced afterwards.'
                    },
                    {
                        name: 'Sun Yuan',
                        status: 'verifiably_dead',
                        whatTheRecordHas: 'Went up eight hundred years ago; scar found within the decade, surveyed twice, permanently thin. Also still on the list, for the same reason: somebody was heard of afterwards under a name close enough to be confused with his.'
                    },
                    {
                        name: 'The Ninth Stone',
                        status: 'never_a_person',
                        whatTheRecordHas: 'Not a name and never was: a Girdle-lineage story that entered the register through a Warden report and has never been removed, because removing an entry requires establishing that it was wrong and nobody can establish anything about it.'
                    },
                    {
                        name: 'Cheng Bo',
                        status: 'unresolved',
                        whatTheRecordHas: 'Went up five hundred and twenty years ago. No scar has ever been found, no account has ever surfaced, and there is nothing else. Could be anything, which is exactly the difficulty.'
                    }
                ],
                candidateListNote:
                    'Five names, of which two are verifiably dead with the scars to prove it, one was never a person at all, one is unresolvable, and one is him - and his is indistinguishable from the noise. Failing the crossing leaves a scar and nothing else, so a name on this list is usually just a man who died and was misfiled, and both institutions know that and keep the list anyway because there is nothing better to keep. Different names attached to different faces, some of which were the same man, and no way to sort them: the two verifiably dead ones may have been him twice.'
            },
            whatItIsWorth:
                'A player who assembles even part of it is holding something the Deep Survey does not have, about a party the Deep Survey has miscategorised, in a world where that institution sets the terms on everything else. It is worth more than any object in the catalogs and is considerably more dangerous to be known to possess, because the only parties who could confirm it are the ones who will not talk and the ones who would very much like to know how you found out.'
        },
        courtOpinions: [
            {
                who: 'The First Seat',
                stance: 'fond',
                note: 'Regards him as the only one of the five of them who did the sensible thing afterwards, and has said so once, which by the standards of the Court is effusive. Would receive him at any time and has not seen him in ninety years.'
            },
            {
                who: 'The Second Seat',
                stance: 'amused',
                note: 'Finds the herb-gatherers and the stolen pill genuinely funny and has been heard to laugh about the assay house incident, which is the only recorded instance of any Seat laughing at anything. Spoke to him forty-one years ago on a path and enjoyed it.'
            },
            {
                who: 'The Fourth Seat',
                stance: 'indifferent',
                note: 'Has no view. Was asked once, said that he is welcome and that this is not a subject, and returned to the crossing. This is not coldness; it is the correct allocation of attention by somebody with one thing left to do.'
            },
            {
                who: 'The Third Seat',
                stance: 'dislikes',
                note: 'Finds him insufferable and has for nine hundred years. She knows exactly what he is and exactly what he can do, having watched all of it at close range for longer than any institution in the world has existed, and likes him less for the knowing rather than more.'
            }
        ],
        theOneHeAvoids: {
            who: 'The Third Seat, who holds the north mountain',
            reasonYearsAgo: 900,
            reason:
                'At a gathering nine hundred years ago the Third Seat corrected him, in front of other people, on the pronunciation of the name of a river he had grown up beside. The Third Seat was right. That is the whole of it, and neither of them has ever put it into words, because putting it into words would require saying that sentence out loud.',
            forgottenPart:
                'He is no longer entirely certain it was the river. There may have been something earlier, and he has a vague sense that there was, and he has decided that the question is not worth pursuing after nine centuries.',
            mutual: 'unknown',
            mutualNote:
                'Possibly mutual and possibly not. He has never asked, the Third Seat has never raised it, and neither of them has any way of finding out short of asking, which neither of them is going to do.',
            consequences: [
                'He does not go to the north mountain, and has not for nine hundred years',
                'He times the rare visits he does make to the Court against the seclusion schedule',
                'If the Third Seat is expected out within the decade he finds somewhere else to be for the decade',
                'Nothing else whatsoever, and nothing has escalated in nine hundred years'
            ],
            whyNeitherExplains:
                'Not secrecy. Explaining it would require admitting how small it is, and both of them are extremely old, extremely formidable, and entirely unwilling to be the one who says the sentence about the river. So it stands, unexplained, and everybody who has noticed the pattern has assumed there is something enormous behind it.',
            whatItIsNot:
                'Not a feud, not a grudge with stakes, and not connected to the refusal of ninety years ago, which everyone who knows about both assumes it must be and which postdates it by eight centuries.',
            theShapeUnderneath:
                'From her side it is not distance and not mystery: it is familiarity. She has watched him do all of it at close range for nine centuries - the wandering, the flippancy, the inheritances handed to herb-gatherers who will never know why, the pill taken off the most prestigious institution in the world on an afternoon whim - and she knows precisely what he is and precisely what he can do, and finds him insufferable for the same reasons everybody else would find him wonderful. She will not explain that to anybody, because explaining it would mean setting out the whole of him to somebody who has not earned it. So what shows on the surface is a nine-hundred-year-old remark about a river, and that is all anybody is ever going to get.'
        },
        restraint: {
            whatHeDoesNotKnow:
                'What is above the Lid. He was most of the way through and does not know what is there, who is there, whether anybody is watching, or what any of them would consider intolerable. He is not a man weighing a known penalty; he is a man who has decided not to knock on a door, having no idea what is behind it and no particular need to find out.',
            noMotiveNote:
                'Whole categories of act are not restrained at all - they simply never come up. Collapsing an apex institution would be tempting fate for nothing whatever: he holds nothing against either of them, has no interest in administration, and would gain precisely nothing. The reason he has never touched them is not caution. It is that there is no reason to bother, which is far more characteristic of him.',
            principle:
                'The line is drawn by whose interest an act crosses, and never by the size of the damage. Anything that is only the mortal world\'s problem he will do if it amuses him, because the mortal world has no recourse and both parties know it. Anything that crosses the interest of somebody who is through the Lid he will not do at any scale, including small ones, because that is the only category of party that can reach him.',
            willDo: [
                'Walk into a top sect and take something irreplaceable off them, which is the sect\'s problem and about which the sect can do nothing at all',
                'Say a true thing in a room where saying it ruins somebody, having no position to protect and no reason to weigh it',
                'Hand a stranger an object worth more than the province, on the strength of having enjoyed a conversation',
                'Refuse a patriarch, decline an offering, and leave without finishing the sentence'
            ],
            willNotDo: [
                'Collapse the Azure Cloud Pavilion, because Ru Anjing built its reserve on her way out and its continued existence is hers rather than theirs',
                'Touch the Standing Edge, for the same reason and more directly: it is the object she left, and the Pavilion is only holding it',
                'Interfere with a crossing in progress anywhere, since what waits at the far side of one is the one constituency he cannot be indifferent to',
                'Break anything that a party above the Lid arranged deliberately, at any size, including arrangements he finds ridiculous',
                'Touch the Deep Survey or the Long Cut, which is not restraint at all - he has nothing against either, wants nothing they hold, and finds administration boring'
            ],
            theDeterrent:
                'Something would come down and settle it. That is the whole of what he knows: not who, not what, not how many, and not whether it would be anybody he could name. He is aware that Ru Anjing went through and reasons about her arrangements accordingly, but he does not know that she would come, or that it would be her, or that what came would be a person at all. He has declined to find out, which is a different thing from being afraid of a known punishment.',
            deterrentPrice:
                'Whatever came would be paying ruinously for the privilege. A descent is forcing an opening inward, bought out of cultivation condensed over ages and possibly the body, for something on the order of ten breaths, and the ones who get it wrong do not come back at all. He has drawn the only conclusion available from that: a party willing to spend that in order to reach him is a party he does not wish to meet, and the question of who it would be is precisely the question he has spent six hundred years not answering.',
            howHeKnows:
                'Something came down for a few breaths about five hundred years ago and spoke to him, and nobody else was present. He does not know what it was. He mentions it perhaps once a century, without drama, and has never said what was said - which may be discretion and is more probably that he did not understand it. In the six hundred and forty years since the crossing his behaviour has two distinct periods, and the boundary between them is that afternoon.',
            theOccasion: {
                yearsAgo: 40,
                what:
                    'He walked into the Azure Cloud Pavilion in daylight, past four Sword Elders who understood exactly what was happening and did nothing because there was nothing to do, and took one of the four Unearned Steps out of the reserve. He did not hurry and he did not explain. The Pavilion held four that morning and three that evening. It holds seven now, because what the sister sends keeps arriving, and the rising count is the reason nobody outside has ever been able to reconcile the story with the ledger.',
                whereHeStopped:
                    'The Standing Edge was in the floor of the inner hall, ten paces further on, and he looked at it and left it there. On the way out he said - to nobody, and one Sword Elder wrote it down - that the pill was the Pavilion\'s and the sword was not.',
                whoNoticed:
                    'Four Sword Elders and the Pavilion Master, all of whom saw both halves of it. The Pavilion has never published the remark and has never publicly accounted for the missing pill either, which is why the count of three is usually assumed to be the original number.'
            },
            looksArbitraryFromBelow:
                'Two decisions, ten paces and one minute apart: he robbed the most prestigious institution in the world of an irreplaceable object, and then declined to touch a sword lying unattended in an empty room. From below those acts are the same kind of act and the second is smaller, so the province concluded variously that he was mad, that the Edge is trapped, that he was interrupted, or that the Pavilion is lying about what happened. None of them can get at the actual rule, because the actual rule is about a party they do not know exists.',
            readableBy:
                'Somebody who understands that there is a constituency above the Lid with interests down here, and that it is the only constituency he answers to. There are perhaps a dozen such people, four of them are Seats of the Hollow Court, and none of them has explained it to anybody.',
            playerIsNotProtected:
                'None of this covers whoever he gives something to. He is fine; the recipient is holding stolen property belonging to an institution that knows precisely who has it, has every right to it, and cannot reach him. He does not think of that as a risk transfer because he does not think about it at all, and by the time it matters he has wandered off and is two provinces away, entirely cheerful.'
        },
        incidents: [
            {
                yearsAgo: 40,
                where: 'A ford town on the border road, and then the Azure Cloud Pavilion, on the same afternoon',
                what: 'He spent two days talking to a physician\'s daughter who was cultivating on a thin hillside with a muddled root and no prospects, liked her, walked to the Pavilion, took one of the four Unearned Steps, came back, and gave it to her. He explained nothing, stayed one more night, and left the province.',
                consequence: 'She used it. The realm arrived without the accumulation, everybody who had watched her for a decade did the arithmetic inside a month, and the Pavilion - which knew exactly what had been taken and exactly who had it - sent a courier rather than a sword. The Ledger opened a lineage audit unasked. Her sect refused her. She could not return the pill and could not explain how she had come by it in any way that was believed, and she spent the remaining sixty years of her life as the woman who was carrying stolen Pavilion property, at a realm she had not earned, in a province where both facts were common knowledge.',
                heNeverLearned: true
            },
            {
                yearsAgo: 60,
                where: 'A Cinnabar Crucible Guild refining hall, during an open examination',
                what: 'He remarked, to a journeyman he had been talking to about something else, that the fourth line of the method-script on the wall is not a step in the method. He was correct - a Furnace Elder later died proving the same thing - and he did not stay to be asked how he knew, or to learn that the Guild teaches the line to this day.',
                consequence: 'The journeyman repeated it, twice, in the wrong company. He was expelled for insubordination within the year, and the Guild still teaches the fourth line.',
                heNeverLearned: true
            },
            {
                yearsAgo: 19,
                where: 'A waystation on the marked road at Sixmile, in the Quiet Marches',
                what: 'He spent a winter repainting stakes on the burn edge because the Wardens were two people short and it was something to do. He gave no name that anybody wrote down, took paint and food, worked the season, and left in spring without mentioning where he was going.',
                consequence: 'The Sixmile Wardens remember a competent drifter who was better on the edge than he had any business being, and have never connected him to anything. Their survey that year is the most accurate they have.',
                heNeverLearned: false
            },
            {
                yearsAgo: 8,
                where: 'A Thousand Treasure Pavilion auction preview',
                what: 'He looked at a catalogued lot for some seconds and said, out loud and to nobody in particular, that it was a forgery of an Unearned Step and not a good one. He was right, he did not elaborate, and he had left before the auctioneer worked out who to ask.',
                consequence: 'The lot was withdrawn, the consignor was ruined inside a month, and the Pavilion has not held a preview open to the public since.',
                heNeverLearned: true
            }
        ],
        legends: [
            {
                calledBy: 'The Ninth Stone',
                toldAmong: 'Anchorhold Wardens, mostly the ones posted to the eastern perimeter',
                version: 'That the barred Girdle lineage produced somebody who went all the way to the Lid, and that this is why the exclusion is maintained: the house is not keeping them out, it is keeping the story from being tested.',
                accurate: false,
                whatIsWrong: 'The lineage did produce him, which is the part everyone assumes is invention. The motive attributed to the Anchorhold is wrong: the house does not know, and the exclusion is nine hundred years of paperwork rather than a policy about him.'
            },
            {
                calledBy: 'The Guest',
                toldAmong: 'The four Seats of the Hollow Court, and three or four people at the top of the Ninefold Ledger',
                version: 'That a False Immortal holds the lowest rank at the Court, has never used it, and is somewhere in the world walking about.',
                accurate: true,
                whatIsWrong: 'Nothing, which is why it is the version almost nobody has heard: every party holding it is either an inheritor who has been asked not to gossip or a Seat who does not speak to anybody. It is also the version least likely to be believed if repeated, because it is the least interesting.'
            },
            {
                calledBy: 'The man who came back',
                toldAmong: 'The Severed, at the Ninth Cut and above',
                version: 'That he pre-paid the price the Severed way, crossed, and returned by choice - and that he is therefore proof the road works and that what waits on the far side can be declined rather than merely failed.',
                accurate: false,
                whatIsWrong: 'He cut nothing in advance and did not return by choice. The crossing did not complete. The Severed have built a doctrinal argument on an outcome that is the exact opposite of the one they describe, and he has never been asked to correct it.'
            },
            {
                calledBy: 'The Moving Hoard',
                toldAmong: 'Grave-readers, Gleaners crews and anybody who trades in salvage on the border road',
                version: 'That there is a cache somewhere that refills itself, that three separate parties have found it in three different provinces, and that at least two of them must therefore be lying.',
                accurate: false,
                whatIsWrong: 'None of them is lying. It refills because he restocks it and it moves because he carries it, and the accounts contradict each other for the most ordinary reason imaginable. The version omits the man entirely, which is why it has stayed in circulation without ever leading anybody to him.'
            },
            {
                calledBy: 'Ru Anjing',
                toldAmong: 'Market towns along the border road, where the story is a generation old and getting worse',
                version: 'That the Azure Cloud Pavilion ancestor did not cross at all, that she has been walking the province in plain clothes for three hundred years, and that the Pavilion knows.',
                accurate: false,
                whatIsWrong: 'Ru Anjing crossed, completely, and it is the last confirmed crossing in the world. The Pavilion finds this version offensive, has said so publicly, and has thereby kept it alive for two more generations.'
            }
        ],
        startingAwareness: 'unaware',
        awarenessSources: [
            'a Seat of the Hollow Court, in the unlikely event of one speaking to anybody',
            'the Ninefold Ledger at Keeper level, which holds the crossing file and does not discuss it',
            'a high-realm cultivator repeating one of the wrong versions at a gathering where such people are present',
            'having sat next to him for an evening and worked it out afterwards, usually years afterwards'
        ],
        firstImpression:
            'An unremarkable man of no obvious age, drinking slowly in the cheap part of an inn, who answers questions from whoever sits down and does not ask who they are. He is not registered at any gate, carries nothing worth taking, and pays for things in ordinary coin. Nobody who has not been told what he is has ever guessed it from looking.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// LOOKUPS
// ─────────────────────────────────────────────────────────────────────────

const WANDERER_BY_ID: ReadonlyMap<string, Wanderer> = new Map(WANDERERS.map(w => [w.id, w]));

export function getWanderer(id: string): Wanderer | undefined {
    return WANDERER_BY_ID.get(id);
}

/** Wanderers affiliated with a faction without being of it. */
export function getWanderersAffiliatedWith(factionId: string): Wanderer[] {
    return WANDERERS.filter(w => w.affiliation.factionId === factionId);
}

/** The stories in circulation, wrong ones included. Mostly wrong ones. */
export function legendsOf(wandererId: string): Legend[] {
    return [...(WANDERER_BY_ID.get(wandererId)?.legends ?? [])];
}

/** The one version that happens to be true, where there is one. */
export function accurateLegendOf(wandererId: string): Legend | undefined {
    return WANDERER_BY_ID.get(wandererId)?.legends.find(l => l.accurate);
}

/**
 * Whether this wanderer may be named in narration to somebody holding this
 * awareness. Same rule as the apex institutions: `unaware` and `whisper` are
 * not enough, and the world may act on a player who cannot name what acted.
 */
export function mayBeNamedTo(awareness: z.infer<typeof AwarenessSchema>): boolean {
    return awareness !== 'unaware' && awareness !== 'whisper';
}
