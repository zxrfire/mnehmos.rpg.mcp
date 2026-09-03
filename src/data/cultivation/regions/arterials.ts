/**
 * The four arterials: one per Surveyor, and the administrative spine under the
 * Low Fall's grant book.
 *
 * Their own file rather than a province's because an arterial is the unit the
 * Survey works in and it is read against provinces rather than owned by one.
 * `arterialsOf` is in `provinces.ts` with the other lookups that share its
 * private indices.
 */

import { z } from 'zod';
import { LOW_FALL_PROVINCE_ID } from './region-ids.js';

/**
 * An arterial vein. Not a place - a thing under places, which is why it has a
 * holder and no prefectures. The Deep Survey's whole position is four of these
 * and the one province standing on top of them.
 */
export const ArterialSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    /** First through fourth, as the Survey numbers them. */
    ordinalInSystem: z.number().int().min(1).max(4),
    provinceId: z.string(),
    /** Who administers it, or null where nobody does and the Survey says so. */
    administeredByCourtId: z.string().nullable(),
    /** Who is actually drawing on it, which is a different question. */
    drawnOnBy: z.string().min(30),
    note: z.string().min(60)
});
export type Arterial = z.infer<typeof ArterialSchema>;

// ─── the four arterials ──────────────────────────────────────────────────
// One per Surveyor. Three of the four have nothing branching from them, which
// is why the loss of the third is not a quarter of the Survey's position.

export const ARTERIALS: readonly Arterial[] = [
    {
        id: 'arterial-hollow-run',
        name: 'The Hollow Run',
        ordinalInSystem: 1,
        provinceId: LOW_FALL_PROVINCE_ID,
        administeredByCourtId: null,
        drawnOnBy: 'The Hollow Court, which was not granted it and did not ask.',
        note:
            'The richest of the four and the only one the Survey has never had an administrator for. The first Surveyor is a real office with real duties and none of them are on the arterial itself; what the post actually does is keep a figure current and submit it, which is the same shape as the Kiln and is not admitted to be.'
    },
    {
        id: 'arterial-the-root',
        name: 'The Root',
        ordinalInSystem: 2,
        provinceId: LOW_FALL_PROVINCE_ID,
        administeredByCourtId: 'court-kiln',
        drawnOnBy: 'Nobody at all. Nine hundred lit nodes and no draw.',
        note:
            'The datum. Every survey in the province is ultimately measured against it without knowing whose datum it is, and the one figure the Kiln reports upward once a year is this arterial\'s, unchanged for the whole of Ji Wanluo\'s tenure.'
    },
    {
        id: 'arterial-the-eleven',
        name: 'The Eleven',
        ordinalInSystem: 3,
        provinceId: LOW_FALL_PROVINCE_ID,
        administeredByCourtId: 'court-third-sill',
        drawnOnBy: 'The eleven surveyed veins of the Low Fall, and through them every granted sect in the province.',
        note:
            'The only arterial anything branches from, and therefore the only one that generates a grant book, an apportionment, a courier and a queue. It is administered by a court that answers to the Long Cut. The Deep Survey has not stated in any document that its province\'s working arterial is administered by the other apex, the Long Cut has not either, and both are counting on the Low Fall never asking whose name is on the countersignature.'
    },
    {
        id: 'arterial-the-long-cold',
        name: 'The Long Cold',
        ordinalInSystem: 4,
        provinceId: LOW_FALL_PROVINCE_ID,
        administeredByCourtId: null,
        drawnOnBy: 'The Frostmirror Court at the head and the Storm Tyrant Court where it goes down, both holding directly from the Survey and neither able to reach the bottom.',
        note:
            'Runs under the glacier and out beneath the floating stone. The fourth Surveyor is the one who asked, two hundred and forty years ago, who would be sitting on the vault while the Lamp was walked to a dispute, and the minute records the question and no reply.'
    }
];
