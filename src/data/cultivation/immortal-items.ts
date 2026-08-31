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
 * The Hollow Court and the Kiln Wardens are a different kind of obstacle
 * entirely, and it is worth being precise about the difference: they are not
 * rationing. Rationing implies a policy, and a policy implies somebody who
 * sets it and could be persuaded to bend it. There is no such person here.
 * The holding is small enough that releasing one is a decision the institution
 * takes collectively, every one of them would rather not, and any one of them
 * can say no. The patriarch asking is not sufficient; at the Court there is no
 * patriarch at all, and at the gate the body that would decide is not the same
 * body next month.
 *
 * That is arithmetic rather than a lever, and there is no version of the
 * problem where the player finds the right person and applies enough pressure.
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
        recordedRefusal: null,
        savingTheSect: null
    },

    // ── the Hollow Court: four people, and any one of them ends it ─────
    {
        factionId: 'sect-hollow-court',
        itemId: 'immortal-unearned-step',
        count: 2,
        countIsKnownTo:
            'All four Seats. Each of them knows it is two, and each of them knows the other three know, which is most of why the subject does not come up.',
        releaseMode: 'collective_consent',
        decidedBy:
            'All four Seats, unanimously. There is no patriarch to appeal over the top of: the First Seat is one voice among four and by the practice of the Court is the last to speak rather than the loudest, which was a deliberate arrangement and has held for six hundred years.',
        anyoneMayRefuse: true,
        sufficientReason:
            'Nothing has ever been recorded as sufficient. What the Court weighs is not the merit of the petitioner but whether the remaining count is what the Court itself needs to finish four crossings, and since nobody knows how many a crossing takes, the honest answer has always been that it might. A case can be excellent and still lose that argument, and the Court does not pretend otherwise.',
        costOfSayingYes:
            'Two becomes one, and the Court is four people working on the only thing any of them still wants. Saying yes is a decision to have less of the thing they are collectively spending their existence on, made by the four people who would use it, which is why the arithmetic does not move.',
        recordedRefusal: {
            yearsAgo: 90,
            theCase:
                'A former disciple of the Second Seat, at Void Refinement Perfection, with a meridian injury the Verdant Spring Hall had documented across forty years and could not close, and a lifespan the Ledger calculated would run out roughly four decades before the accumulation could. He asked once, in person, having travelled for two years. The Second Seat argued for him.',
            refusedBy:
                'The Third Seat, alone, with the other three willing. The reason given, in full, was: not enough. He did not elaborate and was not asked to.',
            afterwards:
                'He went home, kept cultivating, and died at Void Refinement Perfection eleven years later without having reached the boundary. He never spoke against the Court.',
            probablyRight:
                'The Court was probably right, and this is not a case of institutional cowardice dressed as prudence. Two objects, four crossings, and no way to know what a crossing costs: on those numbers a refusal is defensible and the Third Seat has never been shown to be wrong. It simply also meant a man died of it.',
            costAnyway:
                'The Second Seat has not spoken to the Third Seat since - ninety years, four mountains, and a silence the rest of the world reads as the Court being inert. It is not inertia. It is two people who cannot be in a room together, and the Court is four people, so the arithmetic of that is also unforgiving.'
        },
        savingTheSect:
            'Saving the Court does not buy one, and nobody at the Court will pretend it does. What it does is remove the argument: if the vein is taken, or a Seat is interrupted in the last days of a crossing and survives because an outsider stood in the way, then refusing that outsider becomes indefensible to at least two of the four. Two is not four. It is entirely possible to save the Hollow Court, be thanked precisely and permanently, and be refused by one Seat who will not explain, and a player standing in that outcome has not been cheated.'
    },
    {
        factionId: 'sect-hollow-court',
        itemId: 'immortal-second-dealing',
        count: 1,
        countIsKnownTo:
            'All four Seats know it is one, and nobody else living knows there is anything to count. The Court has never confirmed it holds one, and the Ledger infers the number from the nine-hundred-year-old file and from what was not in the estate it arbitrated.',
        releaseMode: 'collective_consent',
        decidedBy:
            'All four Seats, unanimously, and the Court has never taken the question to a vote in six hundred years because no case has been brought that any of them thought worth raising with the other three.',
        anyoneMayRefuse: true,
        sufficientReason:
            'None is on record and the Court has never described one. What can be said is that the Seats are four people at the top of the ladder who each drew the root they drew, and that at least two of them would have benefited from this object several centuries ago and did not use it - which is either discipline or an argument they had once and settled, and no outsider has ever been told which.',
        costOfSayingYes:
            'One becomes none, and it becomes none permanently, for the world and not merely for the Court. There is no second one to fall back on and no prospect of another. Whichever Seat spoke for releasing it would be proposing to end a category of thing.',
        recordedRefusal: null,
        savingTheSect:
            'The Court does not connect the two. Saving it makes refusal indefensible on the pill and does not touch this, and a petitioner who has just done the Court an enormous service and asks for the talisman instead has, in the view of all four Seats, misunderstood what they are standing in front of.'
    },

    // ── the Kiln Wardens: the body that decides is not the same body ───
    {
        factionId: 'sect-kiln-wardens',
        itemId: 'immortal-unearned-step',
        count: 1,
        countIsKnownTo:
            'Every Warden, in the same way they know the number of nodes: it is one, it has been one for as long as any of them has been posted, and they will say so plainly in numbers if asked.',
        releaseMode: 'collective_consent',
        decidedBy:
            'The four Wardens holding the gate at that hour together with the Keeper of the Kiln - a shift rather than an office. Membership rotates, so the body that would decide today is not the body that would decide next month, and no Warden has standing to bind the next shift to anything.',
        anyoneMayRefuse: true,
        sufficientReason:
            'The Wardens have never stated one. What they do instead is acknowledge a debt precisely, in writing, in numbers, and treat the acknowledgement as a serious instrument - which it is, and which is not the same as parting with the object. A petitioner is far more likely to leave with a written acknowledgement than with anything else, and the Wardens do not regard that as a lesser outcome.',
        costOfSayingYes:
            'One becomes none, at the gate that has held for nine hundred years, decided by five people who happened to be on that shift and who would be handing away the only such object their posting has ever held. No Warden has been willing to be the one who was standing there when it went.',
        recordedRefusal: {
            yearsAgo: 140,
            theCase:
                'A formation master relit a node that had been dark for six years, alone, over a winter, at a cost to herself the Wardens recorded in detail. It is the only instance in the outside record of anybody doing the Wardens a service they could not do themselves, and she asked for the pill for a disciple rather than for herself.',
            refusedBy:
                'The shift on the gate that day, with the Keeper present. Four of the five were silent and the fifth said no, and the Wardens recorded the refusal in the same document as the debt.',
            afterwards:
                'She accepted, took what they offered instead - passage and water, which the Wardens consider serious things - and the disciple she had asked for never advanced past Core Formation.',
            probablyRight:
                'On their own terms they were right: a posted body cannot spend an object it holds on behalf of something it does not speak for, and no Warden could have justified it upward, because there is no upward that answers. The refusal follows from what the Wardens are, and that is exactly why it was never going to go differently.',
            costAnyway:
                'The written acknowledgement still stands and is still honoured, a hundred and forty years later, in small ways nobody has ever totalled: her line has never been refused passage, water, shelter or a warning. The Wardens are still paying a debt they could have discharged in a single afternoon, and every Warden posted since has inherited it.'
        },
        savingTheSect:
            'If the gate holds because of an outsider, or a node is relit and stays lit, the shift on duty is in a position where refusing is indefensible - and the shift changes. A player who saves the Wardens and returns two months later is asking a different five people, one of whom was not there, and that is not obstruction. It is what a rotating body is.'
    },
    {
        factionId: 'sect-kiln-wardens',
        itemId: 'immortal-second-dealing',
        count: 1,
        countIsKnownTo:
            'Every Warden. Outside the gate it is not known at all, and the Ledger does not carry it: the Wardens have simply never been asked a question that would require them to deny it.',
        releaseMode: 'collective_consent',
        decidedBy:
            'The shift on the gate and the Keeper of the Kiln, unanimously, exactly as with the pill - and the Wardens draw no distinction between the two objects in procedure, which outsiders find either admirable or alarming depending on what they came for.',
        anyoneMayRefuse: true,
        sufficientReason:
            'Never described, never petitioned for, and there is no record of anybody outside the gate knowing there was something to petition for. The Wardens hold it the way they hold everything else: it is on the inventory, the inventory is correct, and nothing on the inventory is for anything.',
        costOfSayingYes:
            'It would take the world from two of these to one, and the Wardens are the only holder who could do that without four people first having to agree that it should be done. That the least discursive institution in the world is also the one with the shortest path to spending it is a fact the Ledger has noticed and has not written down.',
        recordedRefusal: null,
        savingTheSect:
            'The same rotating body, the same procedure, and the same answer in every recorded instance of anybody asking the Wardens for anything at all: an acknowledgement, precisely worded, and not the object.'
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
