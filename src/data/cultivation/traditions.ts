/**
 * Two traditions, one ladder.
 *
 * The world holds two genuinely different ways of cultivating, and the
 * difference between them is the oldest quarrel in it. Both climb the SAME
 * rungs: a fourth-realm practitioner of either is Core Formation, ordinal 17
 * to 20, and `realmOrdinal` means exactly what it means everywhere else. There
 * is no second scale in this file and there must never be one.
 *
 * What differs is affordances:
 *
 *   METHOD        The Drawn take ambient qi into the body and refine it there.
 *                 The Cut take qi that has been driven into stone and work it
 *                 out with tools. Same ranks, arrived at sideways, with
 *                 different bottlenecks, costs and deviation risks.
 *
 *   METAPHYSICS   This is the part with teeth. The two traditions have
 *                 different answers to being killed, and the answers are
 *                 inverses of each other:
 *
 *                   A Drawn cultivator at Nascent Soul or above survives the
 *                   destruction of their body. They cannot take anyone else's
 *                   - that door does not exist for them - but an intact soul
 *                   can be re-embodied, slowly and expensively.
 *
 *                   A Cut cultivator has no detachable soul at any rank, so
 *                   soul-directed arts do nothing to them whatsoever. Kill the
 *                   body and they are usually dead. Usually: the seam is worked
 *                   into material, so a large enough seam-bearing piece can be
 *                   grown back over years, and what comes back is not reliably
 *                   the same person.
 *
 *                 Knowing which tradition you are facing is therefore worth
 *                 more than knowing their rank, and everyone competent knows
 *                 this.
 *
 *   RECOGNITION   Immediate and requires no investigation. A Drawn cultivator's
 *                 qi circulates; a Cut cultivator's qi is held still, and a
 *                 room notices.
 *
 *   HISTORY       A war, nine hundred years ago, which is why the Quiet Marches
 *                 is the way it is. Both sides teach a different account of who
 *                 started it and both accounts are wrong in the same direction.
 *
 * Walking both roads is possible, catastrophic and rare. See `TWICE_WORKED`.
 */

import { z } from 'zod';
import { MAX_ORDINAL } from '../../engine/cultivation/realms.js';

export const TraditionIdSchema = z.enum(['tradition-drawn', 'tradition-cut']);
export type TraditionId = z.infer<typeof TraditionIdSchema>;

/** What ends a practitioner of this tradition, and what does not. */
export const DeathAnswerSchema = z.object({
    /** Ordinal at or above which the body stops being the whole of the person. */
    persistsFromOrdinal: z.number().int().min(0).max(MAX_ORDINAL).nullable(),
    /** What happens when the body is destroyed. */
    onBodyDestroyed: z.string().min(60),
    /** What happens when the soul is attacked directly. */
    onSoulAttacked: z.string().min(60),
    /** What actually finishes them, stated plainly enough to plan around. */
    whatFinishesThem: z.string().min(60),
    /** What they cannot do, which every account of them gets wrong. */
    cannotDo: z.string().min(40),
    /** Recovery, where recovery exists at all: cost and reliability. */
    recovery: z.string().min(60)
});
export type DeathAnswer = z.infer<typeof DeathAnswerSchema>;

export const TraditionSchema = z.object({
    id: TraditionIdSchema,
    name: z.string().min(1),
    /** What its own practitioners call themselves. */
    endonym: z.string().min(1),
    /** What the other tradition calls them, which is never polite. */
    exonym: z.string().min(1),
    /** The road, not the rungs. */
    method: z.string().min(80),
    /** Home region id. Traditions travel; seats do not. */
    seatRegionId: z.string(),
    /** Modifiers over the shared ordinals. Never a second ladder. */
    bottleneckOrdinals: z.array(z.number().int().min(0).max(MAX_ORDINAL)),
    deviationRiskModifier: z.number().min(-1).max(1),
    costNote: z.string().min(60),
    /** How a practitioner is spotted across a room, before anyone speaks. */
    recognition: z.array(z.string().min(40)),
    death: DeathAnswerSchema,
    /** What this tradition is strong and weak at, as a fighting proposition. */
    strengths: z.array(z.string().min(30)),
    weaknesses: z.array(z.string().min(30)),
    /** What it teaches about the other tradition, accurately or otherwise. */
    saysOfTheOther: z.string().min(80)
});
export type Tradition = z.infer<typeof TraditionSchema>;

export const TRADITIONS: readonly Tradition[] = [
    {
        id: 'tradition-drawn',
        name: 'The Drawn Road',
        endonym: 'cultivators, who do not think of themselves as having a tradition at all',
        exonym: 'drawers, or in the Marches simply "the breathers", which is not affectionate',
        method:
            'Take ambient qi in, refine it in the body, build a foundation from it, condense that into a core, and let the core birth a soul that can outlive the body. Every step is internal, every step needs air with something in it, and the road is impossible on ground where the qi has been driven out.',
        seatRegionId: 'region-low-fall',
        bottleneckOrdinals: [12, 16, 20],
        deviationRiskModifier: 0,
        costNote:
            'Costs access and medicine: ground with ambient qi, pills at the boundaries, and a sect willing to spend on the crossing. All three are purchasable, which is why the Low Fall has an economy at all.',
        recognition: [
            'Their qi moves. In a closed room a candle flame leans toward a Drawn cultivator sitting still, and keeps leaning.',
            'They are warm to stand near, and the warmth has a rhythm to it - it is circulation, and a carver can count it.',
            'They gesture when they cultivate, and their arts have a shape in the air that a Cut practitioner finds gaudy and legible.'
        ],
        death: {
            persistsFromOrdinal: 21,
            onBodyDestroyed:
                'Below Nascent Soul, they die. At Nascent Soul and above the soul leaves intact and can persist without a body for a period measured in months, shortening with every day it stays out.',
            onSoulAttacked:
                'Lethal, and the only reliable way to finish one. The whole discipline of soul-anchoring exists because a Drawn cultivator can be attacked at the one place they cannot armour.',
            whatFinishesThem:
                'Ending the soul. A destroyed body is a serious injury and an enormous expense above Nascent Soul; it is not a death, and treating it as one is how feuds continue after a funeral.',
            cannotDo:
                'They cannot take another body. The door does not exist for them, whatever the Marches teaches about it, and every attempt on record has ended the soul that tried.',
            recovery:
                'Re-embodiment: a prepared vessel grown for the purpose, months of seclusion and a price that beggars most sects. It works, it is rare, and the cultivator who comes back is themselves - which is the one advantage this road has that the other does not.'
        },
        strengths: [
            'flexible arts, since a road built on circulation can throw what it circulates',
            'formations and alchemy, both of which require ambient qi and are therefore theirs alone',
            'the highest ceiling: every recorded crossing was made from this road'
        ],
        weaknesses: [
            'a soul is a target, and everyone above Nascent Soul is carrying one',
            'the road stops entirely on ground with nothing in the air, which is most of the Marches',
            'dependence on pills, which means dependence on somebody else\'s guild'
        ],
        saysOfTheOther:
            'That carving is not cultivation but quarrying with extra steps, that a seam is a crutch for people who could not find good ground, and that a carver who dies is simply dead because there was never anything in there to leave. The last part is close to true and stated with a confidence the evidence does not support.'
    },
    {
        id: 'tradition-cut',
        name: 'The Cut Road',
        endonym: 'carvers, or in full "those who work a face"',
        exonym: 'chisels, which is meant as an insult and has been adopted with some pride',
        method:
            'Cut stone that holds driven qi and take what comes out of the cut, working it into the body as material rather than circulating it. The result is a seam: a worked line running through the practitioner that holds load and does not move. It is a trade with tools, an apprenticeship, and a working day.',
        seatRegionId: 'region-quiet-marches',
        bottleneckOrdinals: [12, 20, 24],
        deviationRiskModifier: 0.04,
        costNote:
            'Costs grant time and lungs: forty stones a day for a workable face, a chisel a season, and dust that kills more carvers than every other cause combined. Nothing purchasable improves the odds, which is why the Marches has no pill trade to speak of.',
        recognition: [
            'Their qi does not move at all. The room goes flat near a carver: sound arrives closer than it should and dust hangs where it was.',
            'A candle flame near a working carver stands perfectly straight, which is the single test every Drawn cultivator knows and the first thing they look for.',
            'Split white hands, a permanent cough, and stillness while cultivating - a carver at work looks like somebody holding a heavy thing rather than performing.'
        ],
        death: {
            persistsFromOrdinal: null,
            onBodyDestroyed:
                'Usually final. There is no soul to leave. The exception is the seam: if a large enough seam-bearing piece survives intact, the carver can be regrown from it over years, and this is why the Marches walls its dead into the faces they were working.',
            onSoulAttacked:
                'Nothing. Soul-directed arts pass through a carver without finding a purchase, which is the single most dangerous fact about them and the one outsiders discover last.',
            whatFinishesThem:
                'Breaking the seam and scattering the pieces. A carver who is merely killed may be back in nine years; a carver whose seam has been quarried out and dispersed is finished, and everyone in the Marches knows the difference between a funeral and a scattering.',
            cannotDo:
                'They cannot leave the body, ever, at any rank. A carver at the top of the ladder has no more of an exit than an apprentice does.',
            recovery:
                'Regrowth from a seam fragment: years of it, in a sealed face, at enormous cost in grant time, and what comes back is not reliably the same person. The Marches has eleven recorded regrowths and disputes the identity of four of them.'
        },
        strengths: [
            'immune to soul-directed arts, entirely and at every rank',
            'bodies that were built by physical work and read as body-tempering without anyone training for it',
            'able to cultivate where the Drawn road simply stops, which is most of the world by area'
        ],
        weaknesses: [
            'no alchemy and no formations, so a carver arrives at high ranks lopsided and knows it',
            'dependent on access to a workable face, which in practice means dependent on the Weir Office',
            'dust-lung, which is not a hazard of the road but the road itself, and is untreatable locally'
        ],
        saysOfTheOther:
            'That the Drawn are tenants: they take what happens to be in the air, on ground somebody else owns, and call the accident of good ground a talent. Carvers also hold that a Drawn cultivator can take another body when cornered, which is false, and which has got at least two Drawn envoys killed by people acting on it.'
    }
];

/**
 * The war that made the Marches, and the two accounts of it. Both official
 * versions blame the other tradition. The true version is worse for a third
 * party who is not mentioned in either.
 */
export const TRADITION_WAR = {
    yearsAgo: 900,
    whatTheGeographyRecords:
        'A province where the qi is in the rock instead of the air, a burn edge that is still moving at about a pace a year, and a weir works at the centre of it whose formation nodes are cut into stone rather than laid on ground.',
    lowFallAccount:
        'That the carvers did it to themselves: a working at the weir that went wrong, or was meant to deny the province to the Drawn and succeeded far past its brief. Taught in the Low Fall as an object lesson in what happens when a tradition refuses arbitration.',
    marchesAccount:
        'That the Drawn drained the province deliberately to end the quarrel, and that the Cut Road exists because a few people learned to work what was left rather than die of it. Taught in the Marches as the founding fact of the region.',
    trueAccount:
        'Both traditions were working the same vein at the weir simultaneously, under a treaty that permitted it, and the terms were incompatible with the vein rather than with either party\'s good faith. The qi inverted. The treaty was witnessed and is still in the Bound Word\'s vault, unpublished, because the alternative to both official accounts is that the most famous agreement the house ever sealed killed a province.',
    discoverableTraces: [
        'the weir nodes are cut into stone, which is Cut Road work, on a site the Low Fall account says the Drawn never held',
        'the burn edge radiates from the weir rather than from any battlefield, and no engagement of any size is recorded within forty li of it',
        'the Bound Word\'s vault index lists a treaty of that year with both traditions as parties and no subject line',
        'the Ninefold Ledger has an arbitration case from eighty years later in which both regions sued the same third party and then jointly withdrew'
    ]
} as const;

/**
 * Walking both roads. Rare, accidental, and it makes a person strange rather
 * than strong: the two methods fight, and the practitioner inherits both
 * vulnerabilities while being difficult to finish because an opponent must
 * understand both traditions to do it properly.
 */
export const TWICE_WORKED = {
    name: 'The Twice-Worked',
    howItHappens:
        'Not by study. Every recorded case is an accident of the two rites colliding: a Drawn soul anchored into a body that was regrown from a seam fragment, which happens when a carver dies alongside a Drawn cultivator and someone competent and desperate is present within the hour.',
    whyItIsRare:
        'It requires a death, a regrowth and a soul-anchoring in the same place at the same time, and the two traditions do not work together, so the circumstance is close to a coincidence. Eleven are recorded in nine hundred years and four of those are disputed.',
    costs: [
        'cultivation runs at roughly half rate, because a circulating road and a held seam are physically hostile',
        'permanently elevated deviation risk, since the two never settle into one rhythm',
        'neither tradition will teach them past the fourth realm, so their upper ranks are self-taught from recovered material'
    ],
    benefit:
        'They cannot be finished by either tradition\'s method alone. Ending one requires attacking the soul and scattering the seam, and almost nobody alive knows how to do both.',
    drawnOpinion:
        'That they are corpses that argue: a soul stapled into quarried material, and an offence against the road rather than an extension of it.',
    cutOpinion:
        'That they are a face somebody else is drawing from, which is the worst thing a carver can say about a person, and it is said to their face.',
    recordedCount: 11,
    disputedCount: 4
} as const;

// ─────────────────────────────────────────────────────────────────────────
// LOOKUPS
// ─────────────────────────────────────────────────────────────────────────

const TRADITION_BY_ID: ReadonlyMap<string, Tradition> = new Map(TRADITIONS.map(t => [t.id, t]));

export function getTradition(id: string): Tradition | undefined {
    return TRADITION_BY_ID.get(id);
}

export function requireTradition(id: TraditionId): Tradition {
    const t = TRADITION_BY_ID.get(id);
    if (!t) throw new Error(`Unknown tradition: ${id}`);
    return t;
}

/** The tradition seated in a region. */
export function traditionForRegion(regionId: string): Tradition | undefined {
    return TRADITIONS.find(t => t.seatRegionId === regionId);
}

/**
 * What ending this cultivator actually requires, given their tradition and
 * rank. The engine resolves the outcome; this supplies the shape of it, and
 * the shape differs between two people standing at the same ordinal.
 */
export function killRequirement(traditionId: TraditionId, ordinal: number): {
    bodyIsEnough: boolean;
    soulAttackWorks: boolean;
    note: string;
} {
    const tradition = requireTradition(traditionId);
    if (tradition.id === 'tradition-cut') {
        return {
            bodyIsEnough: false,
            soulAttackWorks: false,
            note: 'Destroying the body kills a carver in the ordinary case and leaves the seam. Finishing one means quarrying the seam out and scattering it, and a party who does not know this will believe the job is done.'
        };
    }
    const persists = tradition.death.persistsFromOrdinal !== null
        && ordinal >= tradition.death.persistsFromOrdinal;
    return {
        bodyIsEnough: !persists,
        soulAttackWorks: true,
        note: persists
            ? 'Above Nascent Soul the body is an expense rather than a life. Finishing one means ending the soul, and there are perhaps four arts in the catalog that do it.'
            : 'Below Nascent Soul the body is the whole of the person, and an ordinary killing is an ordinary killing.'
    };
}

/**
 * What each tradition gets wrong about the other, which is where people die.
 * These are beliefs held by competent parties, not by fools.
 */
export const CROSS_TRADITION_ERRORS: readonly {
    heldBy: TraditionId;
    belief: string;
    truth: string;
    consequence: string;
}[] = [
    {
        heldBy: 'tradition-cut',
        belief: 'That a cornered Drawn cultivator can take somebody else\'s body.',
        truth: 'That door does not exist for them. Every attempt on record ended the soul that tried it.',
        consequence: 'Two Drawn envoys have been killed pre-emptively in Kettle by people acting reasonably on a false premise, and the Marches has never revised the teaching.'
    },
    {
        heldBy: 'tradition-drawn',
        belief: 'That a carver who has been killed is finished, because there is nothing in there to leave.',
        truth: 'The seam persists in material. Nine years later a large enough fragment can produce somebody who remembers the argument.',
        consequence: 'At least three Low Fall feuds thought closed have reopened with the same party on the other side of them, and the Ledger files these as continuations rather than new cases.'
    },
    {
        heldBy: 'tradition-drawn',
        belief: 'That soul-directed arts work on everybody and merely work poorly on the strong.',
        truth: 'They do nothing at all to a carver, at any rank, including an apprentice.',
        consequence: 'The commonest single cause of death among Low Fall cultivators who go into the Marches for work, and the reason escort contracts there are underwritten separately.'
    }
];
