/**
 * An established company agreement survives a physical passage. Its original
 * activity moves into ONE suspended source; the current row is the actual
 * course. Fellow passengers and crew are never made party members by sharing
 * a vessel. Invitation redirects retain their existing night/home semantics.
 */
import type { NpcActivity, NpcRecord } from './npc-state.js';

export function companyAgreement(activity: NpcActivity | null | undefined, day: number): NpcActivity | null {
    const agreement = activity?.kind === 'out_with_a_party' ? activity
        : activity?.kind === 'travelling' || activity?.kind === 'waiting_for_a_departure' ? activity.passageCompany : null;
    if (!agreement || agreement.kind !== 'out_with_a_party') return null;
    if (agreement.redirect && day >= agreement.redirect.until) return null;
    if (agreement.untilDay != null && day >= agreement.untilDay) return null;
    return agreement;
}

/** Rerouting reuses the original source, rather than nesting passage copies. */
export function companyDuringPassage(previous: NpcActivity | null | undefined,
    passage: NpcActivity, day: number): NpcActivity {
    const agreement = companyAgreement(previous, day);
    const course = { ...passage }; delete course.passageCompany; delete course.redirect;
    return agreement ? { ...course, passageCompany: agreement } : course;
}

/** The caller has already established actual arrival or cancellation ground. */
export function companyAfterPassage(npc: NpcRecord, day: number): NpcActivity | null {
    return npc.status === 'alive' ? companyAgreement(npc.activity, day) : null;
}
