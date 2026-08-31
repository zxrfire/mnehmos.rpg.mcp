/**
 * Things that came down from above.
 *
 * A handful of consumables exist in the world that nobody below the Lid can
 * make, refine, repair or replace. They came down from the immortal realm,
 * which is the only provenance any of them has and the only one they can have,
 * and the supply is therefore finite and shrinking: every one spent is one
 * fewer in the world forever. That is what makes the holders careful rather
 * than merely stingy.
 *
 * TWO EFFECTS, BOTH CURRENTLY IMPOSSIBLE BY ANY OTHER MEANS
 * --------------------------------------------------------
 *   promote_realm        advance a small realm outright, skipping accumulation
 *                        that would otherwise take decades or centuries
 *   change_spirit_root   rewrite the aperture a person draws qi through
 *
 * The second one should read like something that should not exist, because it
 * should not. `spirit-roots.ts` states the rule the whole design rests on: a
 * spirit root is rolled once, is permanent, and there is no respec, no reroll
 * and no item that changes it. `CultivatorSchema` says the same thing in the
 * comment above the field - rolled once, permanent, never editable after
 * creation. Every balance measurement in this engine assumes it.
 *
 * So a Second Dealing is not a consumable tier. It is a world-historic
 * exception, of which two are known to exist, and the correct reaction to
 * hearing that one is in a room is not excitement but a kind of vertigo. The
 * catalog states the rule and then states the exception, in that order,
 * deliberately.
 *
 * NOT PURCHASABLE, AT ALL
 * -----------------------
 * There is no price field in this file and there must never be one. A price
 * would imply the economy reaches these, and it does not: the Thousand
 * Treasure Pavilion has never listed one in four hundred years of catalogues,
 * and the Stonewright Consortium declines to assay them, on the stated grounds
 * that an assay implies a rate.
 *
 * THREE HOLDERS, TWO KINDS OF OBSTACLE
 * ------------------------------------
 * The Azure Cloud Pavilion holds three, under written instructions from the
 * woman who left them, and can therefore act. There is somebody to convince,
 * and getting one is a social and political problem rather than a heist.
 *
 * The Deep Survey and the Long Cut are a different kind of obstacle entirely,
 * and the difference is the point. These are the administrators of the world:
 * they hold the veins, set the terms and keep the registers, and a body that
 * runs an economy is exactly the body that counts a finite irreplaceable stock
 * down to the unit, minutes it, and requires a quorum to touch it. Their
 * carefulness is not sentiment and not hoarding. It is what an institution
 * does with a line item it cannot reorder.
 *
 * So the holding is small enough that releasing one is a decision taken
 * collectively, every member would rather not be the one who moved it, and any
 * one of them can say no. Rank does not help: a Surveyor asking is one voice,
 * and the others can refuse. There is a form for requesting one. It has been
 * submitted. The answer was no.
 *
 * That is arithmetic rather than a lever, and there is no version of the
 * problem where the player finds the right person and applies enough pressure.
 *
 * The contrast is deliberate: Azure Cloud is a sect holding a dead woman's
 * gift and trying to honour what she meant by it, and the apexes are
 * bureaucracies holding an unreplenishable line item. Same objects, entirely
 * different obstacle.
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────
// SCHEMA
// Content-side. Nothing here is in `src/schema/cultivation.ts` yet, and two of
// the effects cannot be expressed by anything that is - see ENGINE_GAPS.
// ─────────────────────────────────────────────────────────────────────────

export const ImmortalItemEffectSchema = z.enum([
    'promote_realm',
    'change_spirit_root'
]);
export type ImmortalItemEffect = z.infer<typeof ImmortalItemEffectSchema>;

export const ImmortalItemFormSchema = z.enum(['golden_pill', 'talisman']);
export type ImmortalItemForm = z.infer<typeof ImmortalItemFormSchema>;

/** How a holder decides to part with one, which differs sharply by holder. */
export const ReleaseModeSchema = z.enum([
    'written_instruction',  // somebody left terms, so somebody can act on them
    'collective_consent'    // a body decides, and any member can refuse
]);
export type ReleaseMode = z.infer<typeof ReleaseModeSchema>;

export const RecordedRefusalSchema = z.object({
    yearsAgo: z.number().int().min(1),
    /** Who asked, and why the case was a good one. */
    theCase: z.string().min(120),
    /** Who refused, and the reason given at the time. */
    refusedBy: z.string().min(60),
    /** What happened to the petitioner afterwards. */
    afterwards: z.string().min(60),
    /** Why the sect was probably right, stated without softening it. */
    probablyRight: z.string().min(80),
    /** What saying no cost them anyway, which is the point of recording it. */
    costAnyway: z.string().min(80)
});
export type RecordedRefusal = z.infer<typeof RecordedRefusalSchema>;

export const HoldingSchema = z.object({
    factionId: z.string(),
    itemId: z.string(),
    /** The count. Never "a few": everyone senior knows the number. */
    count: z.number().int().min(0),
    countIsKnownTo: z.string().min(60),
    releaseMode: ReleaseModeSchema,
    /** The body or office that decides. For collective holders, a body. */
    decidedBy: z.string().min(80),
    /** True where any single member of the deciding body can end it. */
    anyoneMayRefuse: z.boolean(),
    /** What the holder considers a sufficient reason to part with one. */
    sufficientReason: z.string().min(120),
    /** What saying yes costs the holder internally. */
    costOfSayingYes: z.string().min(120),
    /**
     * The instrument, where the holder is a bureaucracy: there is a form, it
     * has been submitted, and the answer was no.
     */
    theForm: z.string().min(120).nullable(),
    /** Collective holders only: the time somebody good was told no. */
    recordedRefusal: RecordedRefusalSchema.nullable(),
    /**
     * Collective holders only. Saving the institution is not a transaction and
     * does not buy anything. It produces a circumstance in which refusing
     * becomes indefensible to people who would otherwise refuse - and even
     * then, one or two of them may hold out, and a player who saves the sect
     * and still walks away empty-handed has been treated honestly.
     */
    savingTheSect: z.string().nullable()
});
export type Holding = z.infer<typeof HoldingSchema>;

export const ImmortalItemSchema = z.object({
    id: z.string(),
    /** The name the world settled on. Nobody knows what it was called above. */
    name: z.string().min(1),
    form: ImmortalItemFormSchema,
    effect: ImmortalItemEffectSchema,
    /** Total known to exist, across every holder, right now. */
    knownCount: z.number().int().min(0),
    /** Total believed to have existed ever, including the spent ones. */
    everKnown: z.number().int().min(0),
    /** Where it came from, which is fixed and is the only possibility. */
    provenance: z.string().min(150),
    /** Why the supply cannot be renewed, including who has tried. */
    cannotBeMade: z.string().min(150),
    /** Why no price appears anywhere in this file. */
    notForSale: z.string().min(120),
    /** What it does, in world terms rather than engine terms. */
    effectNote: z.string().min(120),
    /** What happens to the person afterwards, socially. The interesting part. */
    socialConsequence: z.string().min(200),
    /** Whether a ruin could hold one, and under exactly what circumstance. */
    ruinAvailability: z.string().min(150),
    description: z.string().min(150)
});
export type ImmortalItem = z.infer<typeof ImmortalItemSchema>;

// ─────────────────────────────────────────────────────────────────────────
// THE ITEMS
// ─────────────────────────────────────────────────────────────────────────

export const IMMORTAL_ITEMS: readonly ImmortalItem[] = [
    {
        id: 'immortal-unearned-step',
        name: 'The Unearned Step',
        form: 'golden_pill',
        effect: 'promote_realm',
        knownCount: 6,
        everKnown: 11,
        provenance:
            'It came down. That is the whole of the provenance and there is no competing account: every one in the world arrived with somebody who had crossed and then came back down, or was left behind by somebody who crossed and did not. Nothing in either province has ever produced one, and no record anywhere describes an attempt that got further than an ingredient list.',
        cannotBeMade:
            'The Cinnabar Crucible Guild has tried it four times across three centuries, published every failure in full, and states plainly that it cannot identify the method, the materials, or in two cases even the direction of the error. What is left of a failed attempt is inert and does not resemble the original in any measurable way. No alchemist at any grade has produced anything closer.',
        notForSale:
            'It has never appeared in a Thousand Treasure catalogue, and the Stonewright Consortium declines to assay one on the stated grounds that an assay implies a rate. There is no price, there has never been a price, and a party who opens with an offer of stones has told the room something about themselves.',
        effectNote:
            'It moves a cultivator up a small realm outright, without the accumulation. What would have been forty years of sitting, or a century, or a lifetime that ran out first, is simply done - and the body arrives at the new realm without having built the road to it, which is a thing every physician who has examined a recipient has remarked on and none of them can quantify.',
        socialConsequence:
            'The arithmetic is public. Anybody who has watched a cultivator for a decade can see that the accumulation was not there, and the conclusion arrives in a week. The Ninefold Ledger opens a lineage audit without being asked, because an unexplained jump is exactly what an unrecorded transfer looks like and the Ledger does not distinguish. Rivals stop treating the person as an individual and start treating them as the instrument of whoever gave it, which is usually correct. And the giver becomes publicly known to hold one fewer, which invites the only question that matters about a finite supply: how many are left. The recipient is not admired. What gets remarked on is the part that could not be given.',
        ruinAvailability:
            'Only as the rarest case, and only as a grave rather than an inheritance: somebody who came down carrying one and died somewhere remote before spending it. That is legitimate and it has happened perhaps twice in recorded history. What does not exist, at any depth, in any sealed site, is a supply - a cache, a shelf, a second one in the same room. Two finds have been claimed in four hundred years and the Ledger established both as forgeries.',
        description:
            'A golden pill, smaller than expected, in a box that is plainly part of the object rather than packaging for it. The inscription on the lid is in no script anybody below the Lid can read, and the four institutions that have examined one agree on nothing about it except that the writing is not decorative.'
    },
    {
        id: 'immortal-second-dealing',
        name: 'The Second Dealing',
        form: 'talisman',
        effect: 'change_spirit_root',
        knownCount: 2,
        everKnown: 3,
        provenance:
            'The same and no other: it came down. Two are known to be in the world, one was spent nine hundred years ago in a case the Ninefold Ledger still holds the file on, and there is no fourth in any record anywhere. Whether more exist above is not a question anyone below can put to anybody.',
        cannotBeMade:
            'Nothing in the world approaches it, and unlike the golden pill there is no history of attempts, because there is no theory to attempt. A spirit root is the aperture a person draws qi through and it is settled before birth; there is no discipline anywhere that treats it as a thing with a mechanism, and the alchemists who tried the pill will say flatly that this is a different kind of object and they would not know where to begin.',
        notForSale:
            'No price, no catalogue, no assay, and no broker who will carry an approach. The Thousand Treasure Pavilion, which will handle almost anything, has twice declined to pass a message about one and did not explain why either time.',
        effectNote:
            'It changes the root. The thing that was dealt once and could not be redrawn is redrawn, and a cultivator who was muddled is not muddled any more. Every rule in the world says this is impossible - the manuals say it, the physicians say it, the Frostmirror Court has four centuries of records saying it - and the rule is correct in every case but this one, which is precisely what a world-historic exception is.',
        socialConsequence:
            'There is no version of this that stays quiet. The House of Held Names holds a register entry describing a person who no longer matches it, and an entry that has stopped matching its holder is the single loudest signal that register can produce - it is what the register is for. The Quiet Cut will take a commission to make the discrepancy go away and will not be able to, which has happened once and did not improve their reputation. The House of the Narrow Hour cannot sight the person correctly for some years afterwards, because every reading it holds was cast on a root that is no longer there. And two institutions in particular want to know: the Frostmirror Court and the Storm Tyrant Court both survive on an intake of one root in a hundred, and a manufactured mutated root would end that problem permanently, which makes them the least safe parties in the world to be recognised by.',
        ruinAvailability:
            'In principle only, and nobody sensible plans on it. The legitimate case is identical to the pill - a grave, one person, one object, somewhere remote - and it has never once been the recorded outcome of a dig. The Bone Lantern Cult, which works more graves than anybody, states that it has never seen one and does not expect to. There is no cache, there has never been a cache, and the claim that there is one has been the bait in at least three lethal frauds.',
        description:
            'A talisman, thin, and warm in a way that does not change with the room. Two are known. The correct reaction to being told one is in the building is not excitement, and the people who have handled one describe the same thing afterwards: that it should not be here, and that it plainly is.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// WHO HOLDS THEM
// Counts are exact, small, and known to the people who hold them.
// ─────────────────────────────────────────────────────────────────────────

export const IMMORTAL_HOLDINGS: readonly Holding[] = [
    // ── the Azure Cloud Pavilion: there is somebody to convince ────────
    {
        factionId: 'sect-azure-cloud-pavilion',
        itemId: 'immortal-unearned-step',
        count: 3,
        countIsKnownTo:
            'The Pavilion Master, the four Sword Elders, and the grant book, which records the number openly. The Pavilion does not treat the count as a secret and never has.',
        releaseMode: 'written_instruction',
        decidedBy:
            'The Pavilion Master, with four Sword Elders consenting in the same room - the same instrument that governs drawing the Standing Edge, which is not a coincidence and is how Ru Anjing wrote it.',
        anyoneMayRefuse: false,
        sufficientReason:
            'Ru Anjing left instructions rather than a prohibition, and they are specific: one goes to a cultivator who has done the accumulation and is being stopped by something outside their control. A documented injury that will not close. A bottleneck the Pavilion physicians have recorded over years. A lifespan that will run out before the road does. Ambition is not a reason. Usefulness to the Pavilion is explicitly not a reason, and she wrote that part twice.',
        costOfSayingYes:
            'One of three becomes one of two, and the Master who authorised it is named in the grant book beside the entry, permanently. Two of the last four Masters spent none at all. Worse than the count is what follows: after the last one was given, eleven disciples petitioned formally inside a year, and the Pavilion had to write a refusal doctrine it did not previously need and now cannot un-write.',
        theForm: null,
        recordedRefusal: null,
        savingTheSect: null
    },

    // ── the Deep Survey: a line item, minuted, with a form ─────────────
    {
        factionId: 'apex-deep-survey',
        itemId: 'immortal-unearned-step',
        count: 2,
        countIsKnownTo:
            'The four Surveyors, the standing stock register, and the annual minute that confirms the register. It is two. It has been two for a hundred and forty years, and the figure is written down in a place four people can read.',
        releaseMode: 'collective_consent',
        decidedBy:
            'All four Surveyors, unanimously, against a minuted request. There is no office above them to appeal to and no post that can act alone: a Surveyor who wants one released is one voice of four, and the other three can refuse without giving a reason and have.',
        anyoneMayRefuse: true,
        sufficientReason:
            'The register describes the stock as unreorderable and the standing instruction is that it is spent only where the arterial system itself is at stake. Nothing about individual merit enters it. A cultivator of enormous promise is not a reason under the instruction, and the Survey does not consider that harsh so much as simply not what the line item is for.',
        costOfSayingYes:
            'Two becomes one, permanently, in a register that has never been revised upward and never will be. Every Surveyor who consents is minuted by name, and the minute outlives them. There is no institution above to authorise it and therefore nobody to share the entry with.',
        theForm:
            'A Requisition Against Standing Stock, which exists, has a number, and requires the applicant to state what is at stake in terms of the arterial system rather than in terms of themselves. It has been submitted eleven times in four hundred years. It has been granted once, in a year the Survey does not discuss, and refused ten times, and the refusals are filed with the same care as the grant.',
        recordedRefusal: {
            yearsAgo: 140,
            theCase:
                'A formation master relit a node at the Root Sill that had been dark for six years, alone, over a winter, at a cost to herself the Kiln Wardens recorded in detail. It is the only instance in the outside record of anybody doing that court a service it could not do itself, and she filed the requisition for a disciple rather than for herself.',
            refusedBy:
                'Two of the four Surveyors, in writing, on the ground that a service to a court is not a matter touching the arterial system. The other two consented and it made no difference, because the instrument requires all four.',
            afterwards:
                'She accepted, took what the Wardens offered instead - passage and water, which they consider serious things - and the disciple she had filed for never advanced past Core Formation.',
            probablyRight:
                'On the instruction as written they were correct, and nobody has ever shown otherwise: the stock is for the arterial system, her service was to a court, and the distinction is exactly the sort of thing a register exists to hold. It also meant that the only outsider who ever did the Survey a real favour was told no on a technicality.',
            costAnyway:
                'The Wardens acknowledged the debt in writing themselves, in numbers, and are still honouring it a hundred and forty years later in small ways nobody has totalled - her line has never been refused passage, water, shelter or a warning. The Survey saved a line item and its own court has been paying the bill by instalments ever since.'
        },
        savingTheSect:
            'Saving the Survey does not buy one and no Surveyor will pretend otherwise. What it does is remove the argument the instruction rests on: if the arterial system itself was at stake and an outsider is the reason it held, then refusing them is indefensible to at least two of the four. Two is not four. It is entirely possible to save the Deep Survey, be minuted for it permanently, and be refused by one Surveyor who does not give a reason, and a player standing in that outcome has been treated honestly.'
    },
    {
        factionId: 'apex-deep-survey',
        itemId: 'immortal-second-dealing',
        count: 1,
        countIsKnownTo:
            'The four Surveyors and the standing stock register, where it is a single line with no annotation. It is one. The register has never carried a second.',
        releaseMode: 'collective_consent',
        decidedBy:
            'All four Surveyors, unanimously, and no requisition against this line has ever been submitted - not refused, submitted. The form permits it and nobody has ever filled it in.',
        anyoneMayRefuse: true,
        sufficientReason:
            'None is stated anywhere, and the absence is deliberate: the register describes the item and does not describe a circumstance for it. The Survey administers a world in which talent is dealt once and every arrangement it operates assumes so, which makes the line item an instrument for undoing one of its own foundations, and no Surveyor has ever wanted to be the one who raised it.',
        costOfSayingYes:
            'One becomes none, for the world rather than for the Survey, and there is no prospect of another. Whichever Surveyor moved it would be proposing to end a category of thing, in a minute, with their name on it, in a register that is read by their successors.',
        theForm:
            'The same Requisition Against Standing Stock, which does not distinguish between the two line items and therefore permits an application nobody has made. Clerks are taught the form as a single procedure and most have never noticed that the second line exists.',
        recordedRefusal: null,
        savingTheSect:
            'Not connected. Saving the arterial system makes refusal indefensible on the pill and does not reach this line at all, and a petitioner who has just done the Survey an enormous service and asks for the talisman instead has, in the view of all four Surveyors, misunderstood what they are standing in front of.'
    },

    // ── the Long Cut: receipted, scheduled, and slower than a life ─────
    {
        factionId: 'apex-long-cut',
        itemId: 'immortal-unearned-step',
        count: 1,
        countIsKnownTo:
            'The Course Keepers, and the schedule, where it appears as an entry with no date against it. It is one, everybody senior can say so, and the entry is read aloud at every schedule revision.',
        releaseMode: 'collective_consent',
        decidedBy:
            'The Course Keepers together, unanimously, at a schedule revision rather than on request - which means the body that would decide is not assembled when anybody asks and cannot be assembled early. A petition arriving between revisions is receipted, logged, and waits.',
        anyoneMayRefuse: true,
        sufficientReason:
            'Nothing in the schedule provides for it. The Long Cut administers driven ground on a horizon measured in centuries and treats a human career as a rounding error, so a case that turns on one person having very little time is not a case the instrument can read at all.',
        costOfSayingYes:
            'One becomes none, and the Long Cut is the holder least able to justify it: it owns every act by name, has no vassal to attribute anything to, and would have to minute the decision as its own. The administration is legalistic precisely because it cannot deflect, and this is the largest thing it could do without being able to deflect.',
        theForm:
            'A schedule amendment, receipted on submission and answered at the next revision, which is up to twenty years away. Three have been submitted. All three were answered with the original entry restated and no reasoning, which is the standard form of a refusal here and is not intended as contempt.',
        recordedRefusal: {
            yearsAgo: 60,
            theCase:
                'A Weir Office warden submitted an amendment for a carver at Standing Cut who had held a collapsing face alone for nine days while a crew got out, and whose lungs were finished by it. The Office backed the submission, which it had never done before and has not since, and attached the crew rolls as evidence.',
            refusedBy:
                'The Course Keepers at the following revision, four years later, by restating the entry. No reasoning was given, because the form does not require one and the administration does not volunteer.',
            afterwards:
                'The carver died of dust-lung two years before the revision was held. The Office was notified of the refusal in the ordinary way and filed it.',
            probablyRight:
                'By its own instrument it was correct, and the instrument is what makes the Long Cut governable at all: a body administering five provinces on forty staff cannot start reading cases on their merits without ceasing to be able to administer anything. The cost of that consistency was that the only person the Weir Office ever asked for was dead before the question was heard.',
            costAnyway:
                'The Weir Office has never submitted another amendment of any kind, on any subject, in sixty years - not out of protest, which it would consider improper, but because it now regards the instrument as something that does not answer. An administration that stops being petitioned by its own bureau has lost something it cannot measure and has no line for.'
        },
        savingTheSect:
            'The same body, the same revision cycle, and the same answer in every recorded instance: a receipt, and the entry restated. If the driven ground itself was at stake and an outsider is why it held, refusing at the next revision becomes indefensible to most of the Keepers - and the revision is still up to twenty years away, and one Keeper can still hold out, and nobody will explain.'
    },
    {
        factionId: 'apex-long-cut',
        itemId: 'immortal-second-dealing',
        count: 1,
        countIsKnownTo:
            'The Course Keepers. Outside the administration it is not known at all, and the Deep Survey does not know the Long Cut holds one, which is the single largest gap in either register.',
        releaseMode: 'collective_consent',
        decidedBy:
            'The Course Keepers together, unanimously, at a revision, exactly as with the pill - the Long Cut draws no procedural distinction between the two objects, which outsiders find either admirable or alarming depending on what they came for.',
        anyoneMayRefuse: true,
        sufficientReason:
            'Never described and never petitioned for. It sits on the schedule as an entry with no date, and every Keeper for three centuries has read it aloud at revisions without any of them proposing anything about it.',
        costOfSayingYes:
            'It would take the world from two of these to one, minuted, by name, in an administration that owns every act it takes. Nobody has been willing to be the Keeper whose name is against that line.',
        theForm:
            'The same schedule amendment, which does not distinguish the two entries and has never been submitted against this one. The Keepers are aware that it could be, and have never discussed what they would do.',
        recordedRefusal: null,
        savingTheSect:
            'The Long Cut has never connected the two and would regard the connection as a category error. The most a petitioner has ever received on this line is a receipt confirming that their submission was received, which is accurate and is all it says.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// ENGINE GAPS
// Declared, not invented. Neither effect can be resolved by anything that
// exists today, and this file deliberately does not attempt a mechanic.
// ─────────────────────────────────────────────────────────────────────────

export const ENGINE_GAPS: readonly {
    effect: ImmortalItemEffect;
    missing: string;
    blockedBy: string;
    note: string;
}[] = [
    {
        effect: 'promote_realm',
        missing: 'There is no `PillEffect` for advancing a rank. The closest is `advance_progress`, which adds cultivation progress toward the next rank and is not the same thing: progress still has to be spent through a breakthrough attempt that can fail, and the whole point of this object is that it does not.',
        blockedBy: '`MAX_RANKS_PER_TURN = 1` in `src/schema/cultivation.ts` caps advancement per turn regardless of accumulated progress, so even a granted rank needs an explicit engine path rather than a large progress number.',
        note: 'Needs an engine decision on whether a granted rank skips the breakthrough roll entirely, and on what the Price of Advancement does about a boundary crossed without accumulation - which is the more interesting question and is not one content should answer.'
    },
    {
        effect: 'change_spirit_root',
        missing: 'There is no `PillEffect` for it and there is no field-level path to it either. `CultivatorSchema.spiritRoot` is documented as rolled once, permanent and never editable after creation, and `spirit-roots.ts` states in its header that there is no respec, no reroll and no item that changes it.',
        blockedBy: 'The permanence is not merely a comment: cultivation rate, deviation risk, matched-technique bonus and technique availability are all derived from the root, so a change is a recalculation of a run rather than a field write.',
        note: 'Deliberately left unresolvable. If this is ever implemented it should be an engine ceremony with its own audit record, not a mutation - and the catalog should not be the place that decided how it works.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// LOOKUPS
// ─────────────────────────────────────────────────────────────────────────

const ITEM_BY_ID: ReadonlyMap<string, ImmortalItem> = new Map(IMMORTAL_ITEMS.map(i => [i.id, i]));

export function getImmortalItem(id: string): ImmortalItem | undefined {
    return ITEM_BY_ID.get(id);
}

/** Everything a faction holds, which for almost every faction is nothing. */
export function getHoldingsOf(factionId: string): Holding[] {
    return IMMORTAL_HOLDINGS.filter(h => h.factionId === factionId);
}

export function getHoldersOf(itemId: string): Holding[] {
    return IMMORTAL_HOLDINGS.filter(h => h.itemId === itemId);
}

/** The count in the world right now, summed from the holdings. */
export function worldCountOf(itemId: string): number {
    return getHoldersOf(itemId).reduce((sum, h) => sum + h.count, 0);
}

/**
 * Holders a petitioner could in principle persuade, as opposed to holders
 * where there is nobody with the authority to be persuaded.
 */
export function persuadableHolders(): Holding[] {
    return IMMORTAL_HOLDINGS.filter(h => h.releaseMode === 'written_instruction');
}

/** Every recorded instance of a good case being refused. */
export function recordedRefusals(): { holding: Holding; refusal: RecordedRefusal }[] {
    return IMMORTAL_HOLDINGS
        .filter(h => h.recordedRefusal !== null)
        .map(h => ({ holding: h, refusal: h.recordedRefusal as RecordedRefusal }));
}

export function getEngineGap(effect: ImmortalItemEffect): typeof ENGINE_GAPS[number] | undefined {
    return ENGINE_GAPS.find(g => g.effect === effect);
}
