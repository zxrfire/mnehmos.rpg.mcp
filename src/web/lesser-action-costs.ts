/** Days spent on acts that have no longer span of their own. */
import type { ActionName } from './action-set.js';
import { thePlanIsTheReadInsideTheVerb } from './action-set.js';
import type { PlannedAction } from './planned-action.js';
import { PRESSING_SOMEBODY } from './asking-is-not-doing.js';

/** Existing spans win; these costs apply only when the handler spent no time. */
export const LESSER_ACTION_DAYS: Readonly<Record<ActionName, 0 | 0.125 | 0.25 | 0.5>> = {
    project: 0.25, possess: 0.25, reconstruct: 0.5,
    interact: 0.125, investigate: 0.5, move: 0.25, ride: 0.25, fold: 0.25,
    passage: 0.125, oath: 0.125, attack: 0.125, coerce: 0.125, insult: 0.125,
    cultivate: 0.125, seclude: 0.125, breakthrough: 0.125, train_technique: 0.125,
    refine: 0.125, craft: 0.125, gather: 0.5, hunt: 0.5,
    eat: 0.125, provision: 0.125, treat: 0.125, buy: 0.125, sell: 0.125,
    give: 0.125, inventory: 0, consume_pill: 0.125, destroy: 0.125, stow: 0.125,
    list_techniques: 0, learn_technique: 0.125, teach: 0.125, acquisition: 0,
    derive: 0.125, ceiling: 0, teacher: 0, destinations: 0, roads: 0,
    wait: 0.125, work: 0.125, market: 0, sect: 0.125, site: 0.125,
    legacy: 0.125, petition: 0.125, posture: 0.125, seal: 0.125, offer: 0.125,
    descend: 0.125, look: 0, status: 0, assess: 0, recall: 0, recognise: 0,
    news: 0.125, tell: 0.125, request: 0.125, guard: 0.125, challenge: 0.125,
    propose: 0.125, decline: 0.125, child: 0.125, carry: 0.125, conceal: 0.125,
    unclear: 0
};

/** A board or one's stored belongings are reads, even inside an action verb. */
export function lesserActionDays(plan: PlannedAction): number {
    if (thePlanIsTheReadInsideTheVerb(plan)) return 0;
    if (plan.action === 'stow' && (!plan.intent || plan.intent === 'look')) return 0;
    if (plan.action === 'carry' && !plan.target && (!plan.intent || plan.intent === 'wear')) return 0;
    return LESSER_ACTION_DAYS[plan.action];
}

/** Only day-long spans compete for the sentence's one long act. */
export function isDayLongAct(plan: PlannedAction): boolean {
    if (thePlanIsTheReadInsideTheVerb(plan)) return false;
    if (plan.action === 'move' && /^(?:(?:the|my|our|a)\s+)?(?:room|street|market|table|gate|far gate|forecourt|courtyard|upstairs|downstairs)$/i.test(plan.target ?? '')) return false;
    if (plan.action === 'wait' && plan.days !== undefined && plan.days < 1) return false;
    if (plan.action === 'interact') return PRESSING_SOMEBODY.has(plan.intent ?? '');
    if (plan.action === 'request' && plan.intent === 'end_company') return false;
    return ['cultivate', 'seclude', 'train_technique', 'refine', 'craft', 'gather', 'hunt',
        'wait', 'work', 'treat', 'learn_technique', 'teach', 'derive', 'guard', 'propose',
        'decline', 'child', 'request', 'move', 'ride', 'fold', 'passage', 'site', 'legacy',
        'project', 'possess', 'reconstruct'].includes(plan.action);
}
