/** Boot01 native16543 executed one case in each arm; BOTH failed with
 * ACTION_NAMES is not iterable. Phrase extraction alone was insufficient.
 * Existing parser dependencies reach air presence, exposure, then prompt via
 * theSeasonOn. Boot02 moves that exact pure season read out of the eager prompt.
 * The new inverse restores ONLY exposure prompt-versus-leaf import; phrase
 * leaf and all original cold-boot/wait/offer assertions stay in both arms. */
/** Road09 native1791392803429 failed at module initialization with
 * ACTION_NAMES is not iterable: zero tests and no chain observations ran.
 * The offered-ride parser imported its runtime adapter, whose passage/air/
 * lodging readers reached prompt/planned-action before the table initialized.
 * This test imports ONLY Vitest at module scope. The actual narrator is first
 * imported inside the case, so a boot error is one real failed assertion,
 * not a zero-case pseudo-red. The control restores only the action table's
 * adapter import; the exact phrase leaf/re-export and every assertion remain.
 * No provider, harness, planned-action or action module preloads the graph.
 */
import { expect, it } from 'vitest';
it('the actual narrator boots cold and reads ordinary and offered-passage sentences', async () => {
 let native: typeof import('../../src/web/narrator.js');
 try { native = await import('../../src/web/narrator.js'); } catch (error) {
  if (process.env.NATIVE_BOOT_OBSERVATIONS) {
   const { appendFileSync } = await import('node:fs');
   appendFileSync(process.env.NATIVE_BOOT_OBSERVATIONS, JSON.stringify({ phase: 'cold narrator import', name: error instanceof Error ? error.name : null, message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : null }) + '\n');
  }
  throw error;
 }
 const { DeterministicNarrator } = native;
 const narrator = new DeterministicNarrator();
 const wait = await narrator.plan('I wait for 0.5 days');
 expect(wait.action).toMatchObject({ action: 'wait', days: 0.5 });
 const offer = await narrator.plan('I offer Wei Tianshan free passage to Cloud Gate');
 expect(offer.action).toMatchObject({ action: 'request', intent: 'passage', target: 'Wei Tianshan', topic: 'Cloud Gate' });
});
