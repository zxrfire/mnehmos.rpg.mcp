import { writeFileSync, mkdirSync } from 'node:fs';
import { describe, it } from 'vitest';
import { makeGameInWorld } from '../web/harness';

const OUT = 'C:/Users/hi/AppData/Local/Temp/claude/D--intellij-projects-mnehmos-rpg-mcp/9994bbb7-442c-4b55-8118-0c5a83611923/scratchpad/probe2';

const SEEDS = Array.from({ length: 24 }, (_, i) => `dm2-${i}`);

const DYING = /(?:are|is) dying|They are dying/;
const DEATH_DIGEST = /Year (\d+): ([^.]*?(?:died|death|dead)[^.]*)\./gi;

describe('probe2: a long seclusion and who is dying at the end of it', () => {
    it('scans seeds', async () => {
        mkdirSync(OUT, { recursive: true });
        const report: string[] = [];
        for (const seed of SEEDS) {
            const h = await makeGameInWorld({ seed, worldSeed: seed });
            await h.game.newRun('Probe');
            await h.game.act('I look around');
            // Several long sittings back to back, so the clock actually gets
            // years deep even when food or a disturbance cuts one short.
            let text = '';
            for (let i = 0; i < 4; i++) {
                let r: any;
                try {
                    r = await h.game.act('I cultivate for ten years anyway');
                } catch (err) {
                    report.push(`--- ${seed} pass ${i} ended: ${String(err)}`);
                    break;
                }
                text = String(r.narration ?? '');
                const dying = DYING.test(text);
                const deaths = [...text.matchAll(DEATH_DIGEST)].map(m => m[0]);
                if (dying || deaths.length > 0) {
                    report.push(`--- ${seed} pass ${i} ---`);
                    if (deaths.length) report.push('DIGEST DEATHS: ' + deaths.join(' | '));
                    const dyingLines = text.split('\n').filter(l => DYING.test(l));
                    if (dyingLines.length) report.push('DYING BLOCK: ' + dyingLines.join(' | '));
                    // Name overlap
                    for (const d of deaths) {
                        const name = /Year \d+: ([A-Z][a-z]+ [A-Z][a-z]+)/.exec(d)?.[1];
                        if (name && dyingLines.some(l => l.includes(name))) {
                            report.push(`!!! BOTH: ${name} appears in the digest death AND the dying block`);
                        }
                    }
                    writeFileSync(`${OUT}/${seed}-${i}.txt`, text, 'utf8');
                }
            }
        }
        writeFileSync(`${OUT}/report.txt`, report.join('\n'), 'utf8');
    }, 900_000);
});
