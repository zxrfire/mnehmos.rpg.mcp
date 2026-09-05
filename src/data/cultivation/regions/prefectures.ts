/**
 * What a prefecture is, and every prefecture in the world assembled from the
 * two provinces that have any.
 *
 * The rows are not here. A prefecture is a subdivision of one province, so the
 * Jade Gorge's nine catchments live in `low-fall.ts` and the Silent Cliffs' six
 * face districts live in `quiet-marches.ts`, and this file is the contract and
 * the joining. The other four provinces have no prefectures because there is
 * nothing under them to subdivide, which is a fact about those provinces
 * rather than a gap in this table.
 */

import { z } from 'zod';
import { LOW_FALL_PREFECTURES } from './low-fall.js';
import { QUIET_MARCHES_PREFECTURES } from './quiet-marches.js';

/**
 * The two kinds of prefecture, and they are not two words for one thing.
 * See the section comment: the kind follows from the region's governing fact.
 */
export const PrefectureKindSchema = z.enum(['catchment', 'face_district']);
export type PrefectureKind = z.infer<typeof PrefectureKindSchema>;

/** Which direction the record and the ground disagree in. */
export const HoldingDiscrepancySchema = z.enum([
    'none',
    /** The commonest case in a late age: less is walked than is recorded. */
    'holds_less_than_recorded',
    /** Deference. The zone is real and appears on no document anywhere. */
    'holds_more_than_recorded',
    /** Ground the record carries with nobody's name against it. */
    'no_holder_of_record',
    /** The record names a holder who is not there and has not been for years. */
    'record_names_the_wrong_holder'
]);
export type HoldingDiscrepancy = z.infer<typeof HoldingDiscrepancySchema>;

export const PrefectureSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    provinceId: z.string(),
    kind: PrefectureKindSchema,
    /** The settlement it is run out of. A `RegionPlace` name where one exists. */
    seat: z.string().min(1),
    /** `RegionPlace` names inside it. Empty for ground nobody lives on. */
    places: z.array(z.string()),
    /**
     * The faction holding it. Null is a real answer and appears four times:
     * ground the record carries with no name against it.
     */
    heldByFactionId: z.string().nullable(),
    /**
     * Whose gift it is in: a court id, an apex id, or a sect id where the
     * holding is at one remove. Null where nothing granted it to anybody -
     * which is what the Pavilion, the Hollow Court and the Grove have in
     * common and is the only thing they have in common.
     */
    delegatedFromId: z.string().nullable(),
    /** Sub-holders inside it, by faction id, with what each holds. */
    subHoldings: z.array(z.object({
        factionId: z.string(),
        holds: z.string().min(20),
        /**
         * Whose gift THAT is in, which is not always the prefecture's holder.
         * Set to the faction's own id where nobody granted it, which is how an
         * unbacked body standing inside somebody else's catchment is recorded.
         */
        delegatedFromId: z.string()
    })),
    onPaper: z.string().min(40),
    onTheGround: z.string().min(40),
    discrepancy: HoldingDiscrepancySchema,
    note: z.string().min(40)
});
export type Prefecture = z.infer<typeof PrefectureSchema>;

/** Every prefecture in the world, in province order. */
export const PREFECTURES: readonly Prefecture[] = [
    ...LOW_FALL_PREFECTURES,
    ...QUIET_MARCHES_PREFECTURES
];
