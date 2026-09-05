/**
 * The ancient tier: what a richer age made, what is left of it, and who is holding
 * the remains.
 */

import { EXTINCT_HERB_IDS, EXTINCTION_NOTES, getHerb } from './herbs.js';
import { getPill } from './pills.js';
import { getRecipe } from './recipes.js';
import {
    ANCIENT_TECHNIQUE_IDS,
    NO_SURVIVING_COPY_TECHNIQUE_IDS,
    NO_SURVIVING_COPY_NOTES,
    getTechnique,
    type TechniqueEntry
} from './techniques.js';

// THE AXIS: CATEGORICAL AGAINST ELEMENTAL

export const MODERN_AND_ANCIENT = {
    modern:
        'Elemental, and it scales to the horizon. Fire, ice, wind, stone, a blade, a shield, a step - and the whole of the ladder is the same ideas taken further. Nothing about that is modest. An elemental art at the top of the ladder is one of the most frightening things in the world: weather that stops being weather, a river that is not there afterwards, ground that will not carry anything for a century, a scar a province still names three hundred years later. The elemental line is what every institution alive has spent the late age refining, and its summit is enormous.',
    ancient:
        'Categorical. It does something that has no elemental reading at all, and there is no rung of any modern art that becomes it: a piece of ground taken out of the world for an hour, spears standing where nothing put them, vitality moved from one body into another, a person acting while the person inside watches, a hundred paces crossed without crossing them. Not a bigger anything.',
    theWorkedExample:
        'At the top of the elemental line a cultivator sends lightning out of their fingers, or becomes it. An ancient practitioner makes spears out of qi and HANDS THEM TO SOMEBODY ELSE TO CARRY. The second half of that sentence is the whole distinction: one of them is a very dangerous person and the other has changed what their house can do, and no rung of the first ever becomes the second. Ancient arts that act through other people, or leave something behind that outlasts the using, are the family this points at.',
    theClaim:
        'Grandeur is the wrong axis. A top-of-the-ladder elemental art and an art that seals a battlefield off from reality are both extraordinary, and neither is a version of the other. They are incomparable rather than ranked, which is what makes taking up an ancient road a bargain and not an upgrade.',
    whyTheEraChanged:
        'An age that could afford to cut a piece of reality off from the rest wrote its arts on that assumption. A poorer age cannot feed them, so it developed the elemental line instead - which works, scales cleanly, is cheap to teach, and asks nothing the world cannot supply. Modern cultivation is what you build when you cannot afford the old way, and that is the late age in one sentence.',
    notARanking:
        'Ancient is not the weaker option and not the stronger one. Sometimes it is plainly the better thing to be holding and sometimes it is useless, and which one depends entirely on the situation. The only thing forbidden is a STRICT upgrade - better in every case - because that makes the abandonment nonsense and collapses the tier into "old is stronger".',
    theTest:
        'For a new ancient art, both halves must be answerable. Name what it could do that no amount of taking a modern art to the top of the ladder would ever produce - and name a situation where the ordinary art at the same rung is plainly the better thing to be holding. If the first is hard it is a modern art with a bigger number. If the second is hard it is a strict upgrade. Either way it is not finished.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// ABANDONED, WHICH IS NOT CONDEMNED
// ─────────────────────────────────────────────────────────────────────────

/**
 * The boundary, stated because the two produce completely different social
 * consequences for a player who takes one up.
 */
export const ABANDONED_IS_NOT_CONDEMNED = {
    demonic:
        'Condemned. Righteous sects execute for possession, demonic sects charge for it, and both of them are making a claim about what the art is for. The Nine-Abyss Demon Transformation, the Heart of the Ten Thousand Corpses and the Meridian-Devouring Art are here: each of them spends somebody else, and the world has an opinion about that which has not changed in an age.',
    abandoned:
        'Finished with. Nothing about the art is illegal, nothing about it is secret, and no house will move against a person for holding one. An era worked out what it cost, decided the price was not worth paying, and went a different way - and it was right, which is the part that keeps the abandonment coherent. A cultivator today who takes one up is making a defensible and eccentric choice, not discovering that everybody else was an idiot.',
    theOneThatMoved:
        'Lifespan-Devouring Heaven Theft reads better as abandoned than as condemned and always did. It spends the user\'s own allotted years as ammunition and nobody else\'s; there is no victim in it anywhere. It stays filed `forbidden` in `techniques.ts` because that is where four hundred years of righteous sects have filed it and the catalog records what the world believes, but the world is wrong about which of the two it is, and the people who hold copies know that perfectly well. The Crimson Tithe Palm is the same argument at a lower grade with one difference that matters: its manual conceals the cost until the last page, and concealment is a thing worth condemning even where the method is not.',
    whatAbandonmentCostsYouSocially:
        'Nothing formal and a great deal informally. Nobody arrests you. What happens is that people who understand what they are looking at revise their estimate of you on the spot, in one direction or the other, and neither reaction is comfortable.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// THE ANCIENT ROADS
// ─────────────────────────────────────────────────────────────────────────

export interface AncientArt {
    techniqueId: string;
    /** What it does that no modern art at any rung produces. */
    capability: string;
    /**
     * The price the USER pays, in their own body or their own span. Every one
     * of these has one; a capability with no self-directed cost is a modern
     * art with a strange effect.
     */
    costToTheUser: string;
    /**
     * Whether the cost gets worse with use. The compounding ones are why a
     * whole era working it out and stopping is a believable history rather
     * than an arbitrary taboo: the first use is cheap and the hundredth is
     * ruinous.
     */
    compounds: boolean;
    /**
     * The material the practice consumes, where there is one. Null on most of
     * them, deliberately - "not always, but sometimes". A rule applied
     * uniformly is a tax rather than a characteristic.
     */
    upkeepHerbId: string | null;
    /**
     * Where the world's supply stops, expressed as `mastery` on [0, 1], which is
     * the engine's own scale.
     */
    worldSupplyCeiling: number | null;
    /** Why the era walked away, which is always about the era. */
    whyTheEraStopped: string;
    /** When the modern art at the same rung is plainly the better thing. */
    whenTheModernArtWins: string;
    /** Who actually practises it, which follows from the cost. */
    whoPractisesIt: string;
}

/**
 * WHY THE OLD PRACTISE THESE, and it is not a rule anywhere.
 */
export const THE_OLD_ARE_THE_PRACTITIONERS = {
    theMechanism:
        'The price is years, and years are worth what is left of them. The same art is ruinous to somebody with a career ahead of them and nearly free to somebody without one.',
    whatItProduces:
        'Ancient arts belong to the elderly, everywhere, without a rule saying so. Practitioners skew old the way debtors skew poor: it is the cost function, not a custom.',
    theYoungPractitioner:
        'Somebody young holding one is paying at full price, visibly, which is why it reads as a statement about them rather than about the art. Either something extraordinary happened to them or a house is spending on them, and both of those are worth finding out.',
    theWayOut:
        'A rung is lifespan. An old practitioner who advances has reset the clock they were spending, and now holds at a discount a thing they can afford to keep.',
    theOtherKindOfOldPractitioner:
        'Not everybody old holding an ancient art took it up late. Some of them learned it when it was simply how cultivation was done, and never stopped: the era changed around them and they did not. They are not eccentric and they did not choose anything; they are old. And the world cannot tell the two apart - an elder with a strange art may be a survivor of the prosperous age or somebody who found a manual in a ruin two centuries ago, and there is no test that separates them, which is why asking is rude and being told is worth a great deal.',
    theThingAHouseCanDoAboutIt:
        'Wake one, and feed her. A sect with a sealed ancestor from the older era, a thousand-year medicine, and a reason has all three parts of the same act: the ancestor comes out holding an art nobody living has seen, the medicine buys her the span to use it, and the house has spent the two most irreplaceable things it owns in one afternoon. See `sealed-ancestors.ts`, where waking is generally the end of the ancestor, and `standoff.ts`, which treats unsealing as the most serious thing a house can do. Nobody has done it. Several houses could.'
} as const;

export const ANCIENT_ARTS: readonly AncientArt[] = [
    {
        techniqueId: 'hundred-pace-step',
        capability:
            'The user is somewhere else without having crossed the distance. Personal scale, about a hundred paces, and it does not care what is in between - a shut gate, a collapsed shaft, a formation wall, a room with one door and somebody standing in it.',
        costToTheUser:
            'A little off the far end of the user\'s life per use, and a cough that arrives after the fourth or fifth in a day.',
        compounds: true,
        upkeepHerbId: null,
        worldSupplyCeiling: null,
        whyTheEraStopped:
            'Because ordinary qinggong got good. Over any journey a modern movement art is faster, cheaper and repeatable all day, and the hundred paces that genuinely cannot be crossed come up perhaps twice in a career. An era with better roads and better formations stopped paying years for a problem it had mostly designed away.',
        whenTheModernArtWins:
            'Every journey, every pursuit, every retreat, and every fight. Qinggong at the same rung outruns this over any distance worth the name and costs nothing but qi.',
        whoPractisesIt:
            'Salvage crews and the very old. It is the one ancient road with a working trade behind it: a Deep Gleaner who can step out of a collapsed shaft is worth four who cannot, and by the time somebody has done the work to hold it they are old enough for the price not to matter.'
    },
    {
        techniqueId: 'sealed-field-of-the-shut-hour',
        capability:
            'A piece of ground is taken out of the world for an hour. Nothing enters, nothing leaves, no messenger, no formation, no ally, no retreat. It does not stop what is already inside with you.',
        costToTheUser:
            'The raising takes something out of the user that does not come back inside a season, and every raising spends a measure of a lacquer that stopped being made eleven hundred years ago.',
        compounds: false,
        upkeepHerbId: 'herb-kingfisher-lacquer-fern',
        worldSupplyCeiling: 0.5,
        whyTheEraStopped:
            'It did not stop for a reason of judgement. The fern went, the jars ran down, and the houses that could still raise it found themselves rationing an art rather than teaching one - so it left the curriculum, then it left living memory, and what is left is copies and a decreasing number of jars with a level marked on the outside.',
        whenTheModernArtWins:
            'Almost always. A defensive art of the same rung protects the user; this protects nobody, and raised badly it is a way of being alone with something stronger and no road out. It is worth having about once in a lifetime, when the thing that matters is that nobody else arrives.',
        whoPractisesIt:
            'Four archives hold a copy. One person in either province is believed to have raised one in the last century and no account of it agrees with any other.'
    },
    {
        techniqueId: 'thousand-spear-summoning',
        capability:
            'Spears. Real ones, of a metal nobody smelts, standing where they fall and remaining there afterwards - so they hold a line, close a road, and can be pulled out of the ground and handed to somebody.',
        costToTheUser:
            'Blood, at the moment of the summoning, and it does not come back quickly. A practitioner who uses it twice in a week is visibly ill.',
        compounds: true,
        upkeepHerbId: null,
        worldSupplyCeiling: null,
        whyTheEraStopped:
            'It is a siege art in an age with no sieges. What it is genuinely for is holding ground against numbers over hours, which the late age does not do any more: the provinces argue in writing, the courts settle it, and nobody has needed a wall of spears across a valley since the thing that made the age late.',
        whenTheModernArtWins:
            'Any fight decided in under a minute, which is nearly all of them. The ordinary immortal-grade art at the same rung does more damage for less qi on a shorter cooldown, and the practitioner knows it.',
        whoPractisesIt:
            'Nobody, currently. One copy sits at the back of a forge clan vault, held for four hundred years, and not one member of that clan has ever had the rung to open it.'
    },
    {
        techniqueId: 'vessel-borrowing-palm',
        capability:
            'Vitality is taken out of the person struck and put into the person striking. Nothing in the modern catalogue moves a resource between two bodies at all.',
        costToTheUser:
            'What is taken sits badly. The taker is a little less able to hold what is theirs each time, which is the sort of thing that is invisible for twenty years and then is not.',
        compounds: true,
        upkeepHerbId: null,
        worldSupplyCeiling: null,
        whyTheEraStopped:
            'The bargain is transparent and everyone who worked it out reached the same answer: it buys fights you should not have survived, at a price collected over centuries you had been planning to have. An era that mostly stopped fighting for its life stopped needing to buy those fights.',
        whenTheModernArtWins:
            'Whenever the fight can be won outright. The ordinary heaven-grade palm at this rung hits harder for less qi on a shorter cooldown, so the only reason to reach for this one is that you did not expect to be standing at the end.',
        whoPractisesIt:
            'Physicians, oddly, and almost nobody else - it is the one place the capability is not about a fight. A copy sits in a channel physician\'s grave with her own annotations in the margin arguing against it on every page.'
    },
    {
        // THE ONE YOU PRACTISE. Every other entry here is a dao art - a thing
        // you use - and the quadrant of ancient roads you PRACTISE stood empty
        // until this, which made the era axis look like a fact about combat.
        // It is not. An ancient dao art changes what you can do in a fight; an
        // ancient cultivation road changes what kind of cultivator you are,
        // permanently, and there is no putting it down afterwards.
        techniqueId: 'paired-breath-canon',
        capability:
            'Two people cultivate as one circuit and climb faster than either would alone. Nothing in the modern catalogue couples two cultivators at all - every orthodox road is a road one person walks.',
        costToTheUser:
            'Everything else is shared on the same terms as the progress. A deviation is both of your deviations, an injury takes its years off both clocks, and what one of you spends of a life the other has spent.',
        compounds: true,
        upkeepHerbId: null,
        worldSupplyCeiling: null,
        whyTheEraStopped:
            'It asks a person at Foundation Establishment to decide who they are willing to be half of for the rest of their life, and it cannot be undone. An age with shorter horizons and denser qi could treat that as a reasonable trade for a faster climb; an age where advancement is slow and lives are long worked out that the pairing outlasts every reason anybody ever had for entering one. It was not condemned. It went out of fashion, then out of memory.',
        whenTheModernArtWins:
            'Whenever you might one day want to be alone. An ordinary gathering manual at the same rung is slower and asks nothing of you, and the difference in rate stops mattering the first time the other half of your circuit does something you would not have done.',
        whoPractisesIt:
            'Almost nobody, and the ones who do are almost always siblings or a married pair who understood exactly what they were signing. The clearest surviving instance is two cairns eleven paces apart above Clear River Ford, raised on the same afternoon, in a province that has never asked why the second one was needed.'
    },
    {
        techniqueId: 'hollow-second-body',
        capability:
            'A second body, standing where it was made, doing what the practitioner does. It knows nothing, decides nothing, and reports nothing back - but it is in a second place, which no art of the elemental line offers at any rung.',
        costToTheUser:
            'The making takes something out of the practitioner that does not come back, and it consumes a lotus that stopped growing before any institution now standing was founded.',
        compounds: false,
        upkeepHerbId: 'herb-mirror-heart-lotus',
        worldSupplyCeiling: 0.3,
        whyTheEraStopped:
            'It did not stop for want of interest. The lotus went, and with it the only working anybody has ever had - so unlike the other roads on this list, nobody abandoned this one. It was taken away, and the copies that survive are read by people who can do nothing with them.',
        whenTheModernArtWins:
            'Every fight, and most of everything else. The second body is not a second cultivator: it holds nothing the practitioner knows, cannot be trusted with a decision, and dies easily. What it buys is being in two places, which is worth a great deal about twice in a life and nothing at all the rest of the time.',
        whoPractisesIt:
            'Nobody living. The question it leaves behind outlived the art: whether the thing that signed is the thing that swore, which every oath house in the world has an answer to and no two of the answers agree.'
    },
    {
        techniqueId: 'sixteen-thread-command',
        capability:
            'A person does something. Not persuasion and not illusion: the body acts and the person inside it watches.',
        costToTheUser:
            'A measure of the user\'s own span per use, and the measure gets larger the more of them there have been. Practitioners are recorded ageing visibly across a decade.',
        compounds: true,
        upkeepHerbId: null,
        worldSupplyCeiling: null,
        whyTheEraStopped:
            'This is the one that was genuinely decided rather than merely dropped. It is a poor weapon - no damage, once a fight at best, and it fails outright against anybody within a rung of the user - and it is close to unanswerable as a problem for a world that runs on oaths, testimony and witnessed agreement. Every institution that keeps a treaty vault has an opinion about it, and the opinions arrived at the same place from different directions.',
        whenTheModernArtWins:
            'In a fight, always. Anything at this grade that does damage is worth more, because this does none and frequently does not land.',
        whoPractisesIt:
            'Nobody who says so. The only copy anybody can point at is behind the door of a room whose whole subject is what a person said and whether they meant it, which is either a coincidence or the driest joke in the catalog.'
    }
];

/**
 * The membership lives in `techniques.ts`, beside the other named sets the
 * `art()` factory resolves, because that is where `era` is decided and two
 * sets naming the same thing would drift. Re-exported here so the ancient tier
 * reads as one table.
 */
export { ANCIENT_TECHNIQUE_IDS };

// ─────────────────────────────────────────────────────────────────────────
// THE MATERIAL REQUIREMENT, AND WHY IT IS A STATUS MARKER
// ─────────────────────────────────────────────────────────────────────────

/**
 * The requirement is legible, and that is the point.
 */
export const HOW_AN_UPKEEP_IS_READ = {
    impressed:
        'From somebody who understands what the upkeep costs and can see you have been paying it. The question underneath is how somebody like you got this far up it, and it is a real question with only two answers.',
    dismissive:
        'You will not take that past the fifth level. There are not enough of the materials on the whole of this side to do it. Delivered as a put-down and correct as a prediction - and the person saying it is usually not speculating: they are describing their own house\'s history, having watched their own people stall at that exact place with that exact book.',
    whyItLands:
        'Because it is true about the world and may not be true about this cultivator, and the player gets to hear the odds to their face and decide. Somebody who defies it and is right is the best story the tier can produce, and it should be rare and visible to everybody who understands what they are looking at.',
    theFourRoutes: [
        'luck: a ruin nobody had opened, with the stock still in it',
        'a portal, or an environmental event that put somebody somewhere the world no longer is',
        'an ancient inheritance, stocked deliberately by whoever left it',
        'a major sect\'s chosen, with people sent out on their behalf - which is a relationship rather than an acquisition, because the supply is the house\'s to continue or to stop'
    ],
    whatItAdvertises:
        'Backing cannot be hidden. Practising a material-gated art in front of anybody who knows what it takes IS the evidence that a house is spending on you, so it makes a person a client, a target and a curiosity at once, and it gives the house a hold that needs no contract.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// WHAT IS GONE, AND WHAT IT GATED
// ─────────────────────────────────────────────────────────────────────────

export interface LostMaterial {
    herbId: string;
    /** Recipe ids the extinction closed. */
    closedRecipeIds: readonly string[];
    /** Technique ids whose practice consumes it. */
    gatesTechniqueIds: readonly string[];
    /** Kinds of finished object that can no longer be made. Not ids: kinds. */
    closedObjectKinds: readonly string[];
    /**
     * The sentence a register prints. Kept beside the counts rather than
     * derived from them, because the interesting part of a stock is rarely the
     * figure - it is who has it, what it is in, and whether they know.
     */
    remainingStock: string;
    /**
     * What is left, as a number, and where.
     */
    remaining: {
        /** Held by named houses. Cross-checked against `ARCHIVE_COPIES`. */
        inArchives: number;
        /** Sitting in sealed sites nobody has opened. */
        unfound: number;
        /** Where the unfound units are, by site id from `inheritance-trials.ts`. */
        placements: readonly { siteId: string; units: number; note: string }[];
        /** What anybody in the world could establish about the figure. */
        whatIsKnownOfTheCount: string;
    };
}

export const LOST_MATERIALS: readonly LostMaterial[] = [
    {
        herbId: 'herb-kingfisher-lacquer-fern',
        remainingStock:
            'Jars. Two in an archive that has never acknowledged holding them, and seven more in three sealed sites, each with the level marked on the outside so that whoever opens the cupboard can see what is left without opening the jar.',
        closedRecipeIds: [],
        gatesTechniqueIds: ['sealed-field-of-the-shut-hour'],
        closedObjectKinds: [
            'element-bound blades of the old pattern, where the element is in the coating rather than in the smith - a class of weapon nobody now makes, as against a class nobody now makes WELL',
            'the sealing lacquer for any working that has to hold a boundary against the world rather than against a person'
        ],
        remaining: {
            inArchives: 2,
            unfound: 7,
            placements: [
                {
                    siteId: 'trial-the-cold-curriculum',
                    units: 3,
                    note: 'Three sealed jars on a shelf behind the last gate, packed the way somebody packs a thing they expect to come back for. The seals are intact and the level is marked on the outside of each.'
                },
                {
                    siteId: 'grave-the-forge-clan-vault',
                    units: 2,
                    note: 'Two jars at the back of the vault beside the manual, which the clan has walked past for four hundred years without ever having had anybody able to read what they were for.'
                },
                {
                    siteId: 'trial-the-swept-frame',
                    units: 2,
                    note: 'Two, in a store that was swept and left tidy. Whoever closed this place put them away properly, which is the only reason they are still usable.'
                }
            ],
            whatIsKnownOfTheCount:
                'Nine, and this is the one figure in the table anybody could actually establish. The jars were made to a standard and marked on the outside, the Ninefold Ledger has certified transfers of four of them over eleven hundred years, and a patient reader working the Ledger case notes could get to a number. Nobody has, because nobody has thought to ask how many are left rather than where to get one.'
        }
    },
    {
        herbId: 'herb-mirror-heart-lotus',
        remainingStock:
            'Three, and everybody who has an opinion says none. Two are a dried pair in a cold archive that has never been asked a question direct enough to require lying about them, and the third is in the room with the manual that needs it.',
        closedRecipeIds: [],
        gatesTechniqueIds: ['hollow-second-body'],
        closedObjectKinds: [
            'a second body, which is the only capability on this list that nobody chose to give up - it was taken away when the flower went, and the manuals stayed on the shelves being readable'
        ],
        remaining: {
            inArchives: 2,
            unfound: 1,
            placements: [
                {
                    siteId: 'trial-the-four-inward-faces',
                    units: 1,
                    note: 'One, dried, in the room with the four faces and the manual that needs it. Whoever arranged that room put the art and its last input in the same place and did not leave a note explaining the pairing.'
                }
            ],
            whatIsKnownOfTheCount:
                'Nothing anybody will confirm. The persistent claim is that one archive still holds a dried pair and has never said so, and the claim is persistent because it has never been denied either. The claim is true: the Frostmirror Court has them, in the cold, and has never been asked a question direct enough to require lying.'
        }
    },
    {
        herbId: 'herb-thousand-autumn-chrysanthemum',
        remainingStock:
            'One, and it is alive. There is no jar, no cutting and no seed in any archive in the world; there is a single living stand inside a sealed station on a branch of a vein nobody has drawn since. It makes one pill. There is no second.',
        closedRecipeIds: ['recipe-immortal-longevity'],
        gatesTechniqueIds: [],
        closedObjectKinds: [
            'the only medicine in the world that adds a long life to somebody without taking anything for it'
        ],
        remaining: {
            inArchives: 0,
            unfound: 1,
            placements: [
                {
                    siteId: 'trial-the-fourth-branch-station',
                    units: 1,
                    note: 'ONE, AND IT IS ALIVE. The station was sealed on a branch of a vein that has not been drawn since, so the one condition the flower needs - an arterial reaching the surface and staying there - still holds inside, and nowhere else anybody has looked. It is not a preserved cutting. It is growing.'
                }
            ],
            whatIsKnownOfTheCount:
                'Everybody with an opinion says none, and everybody with an opinion is nearly right. There is no jar, no cutting and no seed in any archive in the world, and every house that has looked has concluded the flower is simply over - which is why the single living stand inside a sealed site is the most valuable object in the setting and is not on anybody\'s list of things to look for. It makes one pill. There is no second.'
        }
    }
];

// ─────────────────────────────────────────────────────────────────────────
// THE THOUSAND-AUTUMN PILL
// ─────────────────────────────────────────────────────────────────────────

/**
 * The most economically significant object in the setting, and it is a row in
 * `pills.ts` that was already there.
 */
export const THE_RUIN_MEDICINE = {
    pillId: 'pill-immortal-longevity',
    recipeId: 'recipe-immortal-longevity',
    extinctIngredientHerbId: 'herb-thousand-autumn-chrysanthemum',
    whyItIsAPill:
        'Because `extend_lifespan` already existed and a parallel catalog for important things is the exact mistake AGENTS.md forbids. Remove the row and nothing is left over anywhere.',
    whatItGrants:
        'A thousand years, flat, at any rung, to anybody who swallows it, at no cost on the way in.',
    againstTheModernLine:
        'Three hundred years is the most any living alchemist can set, and it does not hold at all in a body past Nascent Soul. So the ladder reads five, twenty, a hundred, three hundred - and then nothing until this, which is a different kind of object rather than the next rung.',
    theSupply:
        'Fixed, small, and only ever falling. Every one in the world was made in an age that could make them, and no party has a complete count - which is itself one of the more valuable pieces of information anybody could hold.'
} as const;

/**
 * THE EXTINCTION IS SYMMETRIC, and this is the more interesting fact.
 */
export const THE_EXTINCTION_IS_SYMMETRIC = {
    aboveTheLid:
        'They know how. The method is intact up there and always has been - nothing was lost above, and an immortal asked about it can describe the refinement in full. What they cannot do is the same thing nobody down here can do: find the flower. It went from their side too.',
    notADependency:
        'There was never a standing arrangement in which the lower world grew something the upper world needed. Both sides had the flower because the flower grew, and both sides stopped when it stopped.',
    whyThisIsBetter:
        'Because it removes the one comforting reading. A supply chain can be repaired, a refusal can be argued with, and a gatekeeper can be petitioned by somebody sufficiently remarkable. An extinction on both sides of the Lid cannot be any of those, and the pills in the world are the last pills.',
    whatIsLeft:
        'Leftovers, on both sides, from when it could be made at all. Nobody is producing and nobody has produced for an age.'
} as const;

/**
 * THE TRADE: material up, a finished pill back.
 */
export const THE_TRADE = {
    whatItIs:
        'A house finds the flower in a sealed site, sends it up through whatever channel it has, and a finished pill comes back down. The method is above and the material is below, and for one transaction the two are in the same place.',
    frequency:
        'Once in generations, if that. Both ends are scarce and neither is on a schedule. It is an event, not an arrangement, and treating it as a route is how a setting gets a supply line it was not supposed to have.',
    whoCanAttemptIt:
        'A house with an answering channel and something to send. That is a short list in both directions, and the intersection has been empty for as long as anybody can check, because the houses with channels have had nothing to put in them.',
    theReturnIsNotGuaranteed:
        'Sending is the house\'s decision and answering is not. A house that spends its one find on an offering and receives nothing has learned something devastating about its own ancestor, and has spent the find learning it. That outcome has to be possible or the trade proves nothing.',
    itProvesTheClaim:
        'Something came back. That is the only evidence the setting permits and it is unforgeable: `claimIsTrue` cannot be established by asking, by a tablet, by a lineage or by an audit, and a returned pill settles it in front of witnesses who watched the material go up.',
    theSilenceIsAlsoEvidence:
        'A house that sends and hears nothing has established the opposite, at ruinous cost, and will not be publishing it. This is the better half of the mechanic: the failure is as informative as the success and far more likely, and a house that will not say whether it has ever tried is telling you something.',
    whoCannotDoItAtAll:
        'Anybody with no ancestor above. The Azure Cloud Pavilion is the case in the catalog: an ancestor three hundred and eighty years across is not somebody the Pavilion can make this kind of request of, and the Pavilion knows it.'
} as const;

/**
 * `believed_to_hold` is a real state of the world and now has a real holder.
 */
export type MedicineStanding = 'holds_one' | 'spent_theirs' | 'believed_to_hold' | 'never_had_one';

export interface MedicineHolding {
    factionId: string;
    standing: MedicineStanding;
    /** How the world knows, or why it does not. */
    howItIsKnown: string;
    /** For the spenders: on whom, and what it made of the house afterwards. */
    whatBecameOfIt: string | null;
}

/**
 * Who still has theirs.
 */
export const MEDICINE_HOLDINGS: readonly MedicineHolding[] = [
    {
        factionId: 'apex-deep-survey',
        standing: 'holds_one',
        howItIsKnown:
            'It does not appear in the annual inventory of the storehouse under the datum vault, because it is older than the founder and was never part of the divestment. The clerk who has never had to change a figure has never counted it either.',
        whatBecameOfIt: null
    },
    {
        factionId: 'apex-long-cut',
        standing: 'holds_one',
        howItIsKnown:
            'One of the three sealed cases in the seat chamber, and the Long Cut publishes the count of the cases without ever saying what is in them. Everybody who has thought about it has worked out what one of the three probably is, which is a large part of why the Silent Cliffs has arranged itself so carefully around never being the fourth emergency.',
        whatBecameOfIt: null
    },
    {
        // NONE, AND THE REASON IS THE SAME ONE AS EVERYTHING ELSE ABOUT THEM.
        factionId: 'apex-azure-cloud',
        standing: 'never_had_one',
        howItIsKnown:
            'The Pavilion says so when asked, which nobody expected and which is why the province stopped asking. Ru Anjing spent eleven years divesting and the list, whatever else is on it, has never had one of these on it - because she crossed three hundred and eighty years ago and this is a thing an ancestor accumulates over an age. The Pavilion is the youngest apex in the world and this is the third place that shows.',
        whatBecameOfIt: null
    },
    {
        factionId: 'sect-hollow-court',
        standing: 'holds_one',
        howItIsKnown:
            'It has never been hidden and has never been mentioned. The Court has nothing left to be afraid of and nothing left to reach for, which makes it the one holder in the world with no use for the most valuable object in it - and the only one who could be offered anything for it and would simply not answer.',
        whatBecameOfIt: null
    },
    {
        // THE ONE NOBODY CAN SETTLE, INCLUDING THEM.
        factionId: 'sect-storm-tyrant-court',
        standing: 'believed_to_hold',
        howItIsKnown:
            'The Court holds a written record that the First Tyrant sent one down at his crossing, in the hand and the form everything else from that estate is in, and nobody now alive has seen the object. The vault was last opened in a year the Court can name and by people it can name, all of whom are dead. Every party that has priced the Court has had to decide what to do about that record, and every one of them has decided the same way: assume it is there, because assuming otherwise costs nothing if you are right and everything if you are wrong.',
        whatBecameOfIt: null
    },
    {
        factionId: 'sect-nine-peaks-ascetic-order',
        standing: 'spent_theirs',
        howItIsKnown:
            'The Order recorded it, in the ordinary way it records everything, in a grant-cycle return that three parties have read since.',
        whatBecameOfIt:
            'Given to a Mountain Elder four hundred years ago who was at the top of what she was going to reach and eleven years from the end of her allotted span. She had those years and nine hundred more, and did not advance in any of them. The Order has been a different institution since: it is the only house in the province that has already answered the question of what its one great asset was for, and every decision it has made since has been made by people who know the answer was a person rather than a position.'
    },
    {
        factionId: 'house-narrow-hour',
        standing: 'spent_theirs',
        howItIsKnown:
            'The house says so plainly when asked, which nobody expects and which is the reason the answer is believed.',
        whatBecameOfIt:
            'Spent on a reader rather than a fighter, some centuries ago, and the house is the only party in the world that can state exactly what it bought: a thousand years of one person\'s attention on a single question. It declines to say what the question was or whether it was answered, and it does not present the refusal as mysterious.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// THE COPIES, AND WHOSE MATERIAL IS GONE
// ─────────────────────────────────────────────────────────────────────────

export interface ArchiveCopy {
    factionId: string;
    techniqueId: string;
    /** Where the copy came from, which is always an expedition an age ago. */
    provenanceNote: string;
    /** Whether the house can still feed it. */
    stock: 'spent' | 'remnant' | 'never_had_any';
    /**
     * How far the house's own stock carries somebody, on `mastery`'s [0, 1].
     */
    carriesToMastery?: number;
    /**
     * What the house does with a book nobody there can use. This is the field
     * that makes an ancient manual reachable: giving away something nobody can
     * feed costs nothing, so it can be a reward, a favour or a consolation
     * prize handed over by people who are not being generous.
     */
    willingToPartWithIt: string;
}

/**
 * A house with the book and no material is a different house from one with
 * neither, and from one quietly holding the last of both.
 *
 * The last case is allowed exactly once, and should stay that way.
 */
export const ARCHIVE_COPIES: readonly ArchiveCopy[] = [
    {
        factionId: 'sect-nine-peaks-ascetic-order',
        techniqueId: 'sealed-field-of-the-shut-hour',
        provenanceNote:
            'Brought back by an Order expedition eleven hundred years ago, along with four jars, which is a figure the Order still has written down.',
        stock: 'spent',
        willingToPartWithIt:
            'Yes, and it has said so twice. The Order will hand the book to anybody who has done it a service worth the trouble, because it watched three of its own stall at the same place with it and does not expect the fourth to do better. What it will not hand over is the empty jars, which it keeps.'
    },
    {
        factionId: 'house-anchorhold',
        techniqueId: 'hundred-pace-step',
        provenanceNote:
            'Taken in payment for a perimeter survey some centuries ago and shelved, because the Anchorhold does not practise and does not teach.',
        stock: 'never_had_any',
        willingToPartWithIt:
            'For a price it has never had to name, since nobody has ever asked. The house has no idea what it is holding is worth to a salvage crew, and a salvage crew has no idea the Anchorhold has it.'
    },
    {
        factionId: 'sect-ashen-forge-clan',
        techniqueId: 'thousand-spear-summoning',
        provenanceNote:
            'At the back of the vault, older than the clan, and part of the ground rather than part of the inventory - it was there when the clan arrived.',
        stock: 'never_had_any',
        willingToPartWithIt:
            'No, and not out of avarice: the clan has held it for four hundred years without a single member ever having had the rung to open it, and parting with it would mean admitting in public that nobody there ever will.'
    },
    {
        factionId: 'sect-thousand-treasure-pavilion',
        techniqueId: 'vessel-borrowing-palm',
        provenanceNote:
            'Bought at auction from an estate, catalogued, and never sold, because it has been put up four times and withdrawn four times for want of a bid.',
        stock: 'never_had_any',
        willingToPartWithIt:
            'Enthusiastically. It is the clearest thing in the catalog about what an ancient art is worth commercially, which is nothing, right up until it is worth everything to exactly one person.'
    },
    {
        factionId: 'house-quiet-cut',
        techniqueId: 'sealed-field-of-the-shut-hour',
        provenanceNote:
            'No record of where it came from, which is the house\'s whole practice: four portable nodes, no address, and nothing left behind that could be surveyed.',
        // THE ONE EXCEPTION. A house with the book and material both, and
        // nobody knows. Keep this at one.
        stock: 'remnant',
        // Higher than the world's open supply and short of the end, which is
        // the same shape a stocked inheritance has and arrived at from the
        // other direction: a stocked inheritance is a dead person's judgement,
        // and this is a living house's inventory.
        carriesToMastery: 0.85,
        willingToPartWithIt:
            'It has never acknowledged holding either, and the only reason anybody suspects is that a sealed field was raised eleven years ago in a place the Quiet Cut had been working, and four separate accounts of it disagree about everything except that it happened.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// STOCKED INHERITANCES
// ─────────────────────────────────────────────────────────────────────────

export interface StockedInheritance {
    siteId: string;
    /** The person who stocked it, and why they were able to. */
    leftBy: string;
    techniqueId: string;
    upkeepHerbId: string;
    /**
     * How far the stock carries, as `mastery` on [0, 1]. A metered, deliberate
     * choice by a dead person about how far their heir should get - which is a
     * much better object than a hoard, because the ceiling is legible before
     * anybody starts.
     */
    carriesToMastery: number;
    /** Why they stopped there, which is a judgement rather than a shortage. */
    whyThatFar: string;
    /** What it is like to arrive at the end of somebody else's generosity. */
    whenItRunsOut: string;
}

/**
 * Exactly one, and the number is the design.
 */
export const STOCKED_INHERITANCES: readonly StockedInheritance[] = [
    {
        siteId: 'grave-shen-guyi',
        leftBy:
            'Shen Guyi, who reached the end of Tribulation Transcendence in the Third Sill\'s service, spent his last eleven years divesting in a recorded order exactly the way somebody preparing to cross divests, and then did not attempt it. He sat, and old age took him. The eleven years of divestment are the only reason this exists: a man who spends a decade putting things down deliberately has time to decide who gets what and how much of it.',
        techniqueId: 'sealed-field-of-the-shut-hour',
        upkeepHerbId: 'herb-kingfisher-lacquer-fern',
        carriesToMastery: 0.7,
        whyThatFar:
            'It is more than the world can supply and less than the art will take, and the gap is the whole message. He was at the top of the ladder and declined the crossing, so he knew precisely what it is like to stand at the end of a road and stop, and he provisioned an heir to a point past where anybody would tell them they could get and short of the end. Nobody has established whether that was kindness, a lesson, or simply what was in the cupboard.',
        whenItRunsOut:
            'There is no announcement and nothing fails. The jars are empty, the art still works, and the practitioner is holding a book they can read and cannot go further into - standing at the exact place a man who has been dead a hundred and sixty years decided they should stop.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// THE THIRD TIER, RE-EXPORTED RATHER THAN RESTATED
// ─────────────────────────────────────────────────────────────────────────

/**
 * Arts the record attests and no copy of which exists anywhere. Owned by
 * `techniques.ts`; re-exported here so the three tiers can be read as one
 * table without a second set drifting from the first.
 */
export { NO_SURVIVING_COPY_TECHNIQUE_IDS, NO_SURVIVING_COPY_NOTES };

// ─────────────────────────────────────────────────────────────────────────
// LOOKUPS
// ─────────────────────────────────────────────────────────────────────────

/**
 * DORMANT is the fifth, and it is the one where nothing is missing at all.
 */
export type AbsenceTier = 'abandoned' | 'lost' | 'no_surviving_copy' | 'dormant' | 'present';

/**
 * Arts whose only holder is asleep, and who is holding each.
 */
export const DORMANT_HOLDERS: Readonly<Record<string, string>> = {
    'paired-breath-canon':
        'The last practitioner anybody can name is the other half of a circuit, and she is sealed. Her pair died four hundred years ago and she did not, which the canon says is not the ordinary outcome; the house that holds her has never explained how she survived it and has never been asked the question in a form it would have to answer. Waking her would produce the only living teacher of an ancient road in the world, and would also be the end of her, and her holders have understood both halves of that for four centuries.'
} as const;

/**
 * Which tier of absence an art sits in. `present` is the ordinary answer for
 * everything in the catalog that is simply taught somewhere.
 */
export function absenceTierOf(techniqueId: string): AbsenceTier {
    if (NO_SURVIVING_COPY_TECHNIQUE_IDS.has(techniqueId)) return 'no_surviving_copy';
    const ancient = ANCIENT_ARTS.find(a => a.techniqueId === techniqueId);
    if (!ancient) return 'present';
    // Material before choice, and a sleeping holder before either: a road
    // nobody walks is a social fact and a road nobody can feed is a material
    // one, but an art with a living teacher who could be woken is a decision
    // sitting in front of somebody, which is the most actionable of the three.
    if (DORMANT_HOLDERS[techniqueId]) return 'dormant';
    return ancient.upkeepHerbId ? 'lost' : 'abandoned';
}

export function getAncientArt(techniqueId: string): AncientArt | undefined {
    return ANCIENT_ARTS.find(a => a.techniqueId === techniqueId);
}

/** The technique rows themselves, for anything that wants the mechanics. */
export function ancientTechniques(): TechniqueEntry[] {
    return ANCIENT_ARTS
        .map(a => getTechnique(a.techniqueId))
        .filter((t): t is TechniqueEntry => t !== undefined);
}

/** Ancient arts whose practice consumes something the world no longer grows. */
export function materialGatedArts(): AncientArt[] {
    return ANCIENT_ARTS.filter(a => a.upkeepHerbId !== null);
}

/**
 * How many of a material are left in the world, archives and sealed sites
 * together. The one number the whole search economy turns on.
 */
export function unitsLeftInTheWorld(herbId: string): number {
    const m = getLostMaterial(herbId);
    if (!m) return 0;
    return m.remaining.inArchives + m.remaining.unfound;
}

/**
 * Extinct material sitting in a site nobody has opened, by site id.
 */
export function ancientMaterialsAt(siteId: string): {
    herbId: string;
    units: number;
    note: string;
}[] {
    const out: { herbId: string; units: number; note: string }[] = [];
    for (const m of LOST_MATERIALS) {
        for (const place of m.remaining.placements) {
            if (place.siteId === siteId) {
                out.push({ herbId: m.herbId, units: place.units, note: place.note });
            }
        }
    }
    return out;
}

/** Every site holding any of it, for anything that wants to seed a map. */
export function sitesHoldingAncientMaterial(): string[] {
    return [...new Set(LOST_MATERIALS.flatMap(m => m.remaining.placements.map(p => p.siteId)))];
}

export function getLostMaterial(herbId: string): LostMaterial | undefined {
    return LOST_MATERIALS.find(m => m.herbId === herbId);
}

/** Everything a faction is recorded as holding out of the ancient tier. */
export function ancientHoldingsOf(factionId: string): {
    medicine: MedicineHolding | undefined;
    copies: ArchiveCopy[];
} {
    return {
        medicine: MEDICINE_HOLDINGS.find(h => h.factionId === factionId),
        copies: ARCHIVE_COPIES.filter(c => c.factionId === factionId)
    };
}

/** Houses that still have their one, including the one nobody can confirm. */
export function housesStillHoldingMedicine(): MedicineHolding[] {
    return MEDICINE_HOLDINGS.filter(
        h => h.standing === 'holds_one' || h.standing === 'believed_to_hold'
    );
}

/** Houses that have already spent theirs, which is a different house. */
export function housesThatSpentTheirs(): MedicineHolding[] {
    return MEDICINE_HOLDINGS.filter(h => h.standing === 'spent_theirs');
}

/**
 * Everything referenced by this file that must resolve in the real catalogs.
 * Exported so the design guard can assert it rather than reimplementing the
 * list, and so a broken id fails loudly instead of reading as a gap.
 */
export function ancientTierReferences(): {
    herbs: string[];
    pills: string[];
    recipes: string[];
    techniques: string[];
} {
    return {
        herbs: [
            ...LOST_MATERIALS.map(m => m.herbId),
            ...materialGatedArts().map(a => a.upkeepHerbId as string),
            ...STOCKED_INHERITANCES.map(s => s.upkeepHerbId),
            THE_RUIN_MEDICINE.extinctIngredientHerbId
        ],
        pills: [THE_RUIN_MEDICINE.pillId],
        recipes: [
            THE_RUIN_MEDICINE.recipeId,
            ...LOST_MATERIALS.flatMap(m => m.closedRecipeIds)
        ],
        techniques: [
            ...ANCIENT_ARTS.map(a => a.techniqueId),
            ...ARCHIVE_COPIES.map(c => c.techniqueId),
            ...STOCKED_INHERITANCES.map(s => s.techniqueId),
            ...LOST_MATERIALS.flatMap(m => m.gatesTechniqueIds)
        ]
    };
}

/**
 * Whether every id this file names resolves. Kept here rather than only in the
 * test so a tool can ask, and so the failure mode is a thrown name rather than
 * a silently empty lookup.
 */
export function unresolvedAncientReferences(): string[] {
    const refs = ancientTierReferences();
    const bad: string[] = [];
    for (const id of new Set(refs.herbs)) if (!getHerb(id)) bad.push(`herb ${id}`);
    for (const id of new Set(refs.pills)) if (!getPill(id)) bad.push(`pill ${id}`);
    for (const id of new Set(refs.recipes)) if (!getRecipe(id)) bad.push(`recipe ${id}`);
    for (const id of new Set(refs.techniques)) if (!getTechnique(id)) bad.push(`technique ${id}`);
    for (const id of new Set(refs.herbs)) {
        if (!EXTINCT_HERB_IDS.has(id)) bad.push(`herb ${id} is named as lost and is not extinct`);
        if (!EXTINCTION_NOTES[id]) bad.push(`herb ${id} is extinct and does not say why`);
    }
    return bad;
}
