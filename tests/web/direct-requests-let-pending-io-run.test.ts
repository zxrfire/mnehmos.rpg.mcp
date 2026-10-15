/** Run3 lost48 assertions to RPC timeouts across three direct-call files.
 * Diagnostic request yields reported all44 asking cases and10 travel cases,
 * exposing five real failures instead of losing their results. A direct
 * request must allow pending I/O to run, as a real HTTP request already does.
 * Engine time and outcomes still come from the unchanged service.
 */
import { expect, it } from 'vitest';
import { makeGame } from './harness';

it('services pending I/O before opening a direct life', async () => {
    const { game, db } = makeGame();
    let serviced = false;
    const pending = setImmediate(() => { serviced = true; });
    try {
        await game.newRun('Probe');
        expect(serviced).toBe(true);
    } finally { clearImmediate(pending); db.close(); }
});

it('services pending I/O before a direct action without spending body time', async () => {
    const { game, db } = makeGame();
    await game.newRun('Probe');
    const before = game.currentRun().run.elapsedDays;
    let serviced = false;
    const pending = setImmediate(() => { serviced = true; });
    try {
        await game.act('what am I carrying');
        expect(serviced).toBe(true);
        expect(game.currentRun().run.elapsedDays).toBe(before);
    } finally { clearImmediate(pending); db.close(); }
});
