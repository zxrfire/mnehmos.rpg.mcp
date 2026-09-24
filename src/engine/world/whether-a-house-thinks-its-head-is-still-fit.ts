/**
 * Whether somebody is still fit to lead.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT FITNESS IS READ FROM, AND WHAT IT IS NOT READ FROM
 * ═════════════════════════════════════════════════════════════════════════
 *
 *   `soulState`         `intact | damaged | fragmented | fading`. The spine of
 *                       the read: a fragmented soul is not somebody an
 *                       institution can rely on, whatever their strength says.
 *   PERMANENT WOUNDS    `aggregateInjuryPenalties(...).permanentCount` - wounds
 *                       nothing in the world closes, which *"never stop
 *                       costing"*. Distinct from open channels, which mend.
 *
 * NOT STRENGTH. A patriarch weaker than one of his elders is not unfit; he is
 * outclassed, and that is what the promotion ladder is for. Folding strength in
 * here would turn every ordinary succession into a fitness question.
 *
 * NOT THE MADNESS STAGES, and that is a gap rather than a decision.
 * `madnessStageAt` needs years since a crossing and an `NpcRecord` carries no
 * crossing date - there is no field for it. The stages also run on a
 * 20,000-year band, so no ordinary house head reaches the first boundary in a
 * played world. Where a False Immortal holds a seat the right read is theirs,
 * and this one will say fit; wiring it needs a crossing day on the record first.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * AND THE HOUSE NOTICING LATE IS DELIBERATELY NOT HERE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The catalog is emphatic that an institution is slow about this: a protector
 * deep in the second stage is *"no longer available to anybody in any sense that
 * an institution could use, and the institution is usually the last party to
 * work that out"*, and of another, *"Nobody has assessed him unfit, he has failed
 * no test."* THE LAG IS WANTED. It is the old man holding the chair of a house
 * that has not admitted what everybody outside it can see.
 *
 * It is not built here, for a reason worth keeping: the shape it would copy -
 * `who-a-house-has-lost-track-of.ts`, two marks with the durable one held on the
 * house - GETS ITS TRIGGER FOR FREE. A world pass loses sight of somebody, which
 * is a discrete event (`markMissing`), and it clears on discrete events: the
 * lamp goes out, or they are standing at the seat again. `soulState` has no such
 * moment. It degrades through a field, and nothing fires.
 *
 * AND ON A BACKGROUND PERSON IT DOES NOT EVEN DEGRADE. The three writers -
 * `what-goes-wrong-at-a-realm-boundary.ts`, `a-body-under-somebody-elses-hand.ts`
 * and `combat-verbs.ts` - are all on the played character's path, so no world
 * pass ever damages a background NPC's soul. Measured, every living person in
 * two worlds reads `intact` at seeding and at 200 years. The layer works; the
 * simulation does not use it.
 *
 * So copying the shape means inventing WHEN A HOUSE LOOKS AT ITS OWN PATRIARCH,
 * and that is the whole of the work - the tag is thirty lines and the noticing
 * is a mechanism. That question already has an answer being designed elsewhere:
 * a review is PROVOKED, with a long baseline underneath, provoked by a chair
 * emptying or a house's power falling. A fitness lag belongs on that trigger.
 * Grown here it would be a second mechanism answering one question, which is the
 * defect this repo keeps finding.
 *
 * LEFT OUT DELIBERATELY, NOT FORGOTTEN, and left out whole: there is no
 * half-built mark here for somebody to find and wire up. A field nothing writes
 * is the thing AGENTS.md names, and half a lag would be one.
 */

import { aggregateInjuryPenalties } from '../cultivation/injuries.js';
import { woundsCarriedBy, type NpcRecord } from './npc-state.js';

/**
 * Permanent wounds past which somebody is no longer fit to lead.
 *
 * Two, not one. A house is led by people who have been in fights for centuries,
 * and one wound nothing closes is the ordinary condition of anybody who got
 * there; making it the bar would find every patriarch in the world unfit.
 */
export const WOUNDS_NOTHING_CLOSES_THAT_UNFIT_SOMEBODY = 2;

/** How fit somebody is to lead. */
export interface HowFit {
    fit: boolean;
    /** Engine truth, one line, for the mechanical channel. Never narration. */
    because: string;
}

/**
 * Whether this person is still fit to lead, read fresh off the body.
 *
 * Pure. No RNG and no write. Read rather than stored, because a body's state is
 * not an opinion and a copy of it would go stale.
 */
export function howFitTheyAre(npc: NpcRecord): HowFit {
    if (npc.soulState === 'fragmented' || npc.soulState === 'fading') {
        return { fit: false, because: `Their soul is ${npc.soulState}.` };
    }
    const permanent = aggregateInjuryPenalties(woundsCarriedBy(npc)).permanentCount;
    if (permanent >= WOUNDS_NOTHING_CLOSES_THAT_UNFIT_SOMEBODY) {
        return { fit: false, because: `They carry ${permanent} wounds nothing closes.` };
    }
    return { fit: true, because: 'Nothing on them says otherwise.' };
}
