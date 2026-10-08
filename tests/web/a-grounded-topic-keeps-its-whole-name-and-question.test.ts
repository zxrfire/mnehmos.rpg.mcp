/** Observed 2026-10-03 in native retrieval diagnostic78343: a real printed
 * "the Nine Peaks Ascetic Sect artifact furnace" reached phase1 intact but
 * petition received "the nine peaks ascetic sect artifact fur" and fell through
 * to NoSuchForm. The native object, permission, provider and keys were valid.
 * planned-action.validatePlan had a 40-character ASCII-label normalizer for
 * every topic, and its schema rejected topics over120 characters. A noun name
 * or full information question has no world/body bound of that kind. Existing
 * rooms07 showed the same topic normalizer discarded name/work questions;
 * that was repaired at the conversation merge, leaving this general seam.
 *
 * This literal is the OBSERVED printed name, not a prescribed catalog layout.
 * These controls preserve named text/questions without prefix guesses or
 * reconstruction. Case normalization for existing sect labels remains. Model
 * fields still select closed acts and cannot assert numbers/state. End-to-end
 * actual printed-name handler evidence remains in original retrieval16, pending
 * the shared clock candidate. Baseline controls gave 3 failures and 1 pass;
 * after the topic repair all 4 pass (full-topic-and-door-routing green log,
 * 20261003-01; 19 controls across 5 files). Native retrieval starts now reach
 * the actual object; successful physical delivery remains separately pending.
 */
import { expect, it } from 'vitest';
import { validatePlan } from '../../src/web/planned-action.js';

it('keeps the complete actual printed object name for native petition lookup', () => {
    const printed = 'the Nine Peaks Ascetic Sect artifact furnace';
    const answer = validatePlan({ action: 'petition', intent: 'stock', target: 'Nine Peaks Ascetic Sect', topic: printed });
    expect(answer.ok).toBe(true);
    if (!answer.ok) throw new Error(answer.reason);
    expect(answer.action.topic).toBe(printed.toLowerCase());
});
it('keeps every clause of a full information question longer than the retired schema cap', () => {
    const topic = 'Hello, I came from Azure Cloud Pavilion. What is your name, what work do you do here, and what medical care can you offer travellers with wounds of this grade?';
    const answer = validatePlan({ action: 'interact', intent: 'talk', target: 'physician', topic });
    expect(answer.ok).toBe(true);
    if (!answer.ok) throw new Error(answer.reason);
    expect(answer.action.topic).toBe(topic.toLowerCase());
});
it('keeps punctuation and Unicode in named text while retaining case-insensitive topic labels', () => {
    const topic = "Borrow the elder's blade: 雪莲?";
    const answer = validatePlan({ action: 'request', target: 'elder', topic });
    expect(answer.ok).toBe(true);
    if (!answer.ok) throw new Error(answer.reason);
    expect(answer.action.topic).toBe(topic.toLowerCase());
    const label = validatePlan({ action: 'sect', intent: 'escort', topic: 'ACCEPT' });
    expect(label.ok).toBe(true);
    if (!label.ok) throw new Error(label.reason);
    expect(label.action.topic).toBe('accept');
});
it('retains closed-action/state-field authority instead of trusting an outcome in a long topic', () => {
    expect(validatePlan({ action: 'set_realm', topic: 'make me stronger' }).ok).toBe(false);
    const answer = validatePlan({ action: 'petition', topic: 'Please lend the printed artifact furnace', realmOrdinal: 44, spiritStones: 9999 });
    expect(answer.ok).toBe(true);
    if (!answer.ok) throw new Error(answer.reason);
    expect(answer.action).not.toHaveProperty('realmOrdinal');
    expect(answer.action).not.toHaveProperty('spiritStones');
});
