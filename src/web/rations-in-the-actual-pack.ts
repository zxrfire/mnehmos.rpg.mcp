/** Ordinary ration custody, moved from GameService without changing its arithmetic.
 * The suspended native span borrows this stock and exposes its actual remainder
 * before world consequences; neither MCP nor web keeps a second food ledger. */
import type Database from 'better-sqlite3';
import type { Cultivator } from '../schema/cultivation.js';
import { satietyBurnMultiplier } from '../engine/cultivation/survival.js';
import { readFlag, writeFlag } from '../server/consolidated/cultivation-support.js';
import { FLAG_RATIONS_HELD } from './flag-keys.js';

export function rationsHeld(db: Database.Database, cultivator: Pick<Cultivator, 'id'>): number {
        const raw = readFlag(db, cultivator.id, FLAG_RATIONS_HELD);
        const held = raw === null ? 0 : Number(raw);
        return Number.isFinite(held) && held > 0 ? Math.floor(held) : 0;
    }

export function drawFromPack(db: Database.Database, cultivator: Pick<Cultivator, 'id' | 'realmOrdinal' | 'satiety' | 'injuries'>, days: number): number {
        const multiplier = satietyBurnMultiplier(cultivator.realmOrdinal, cultivator.injuries);
        if (multiplier <= 0) return 0;
        void days;
        const held = rationsHeld(db, cultivator);
        if (held > 0) setRationsHeld(db, cultivator, 0);
        return held;
    }

export function putBackWhatWasNotEaten(db: Database.Database, cultivator: Pick<Cultivator, 'id'>, skip: { endState: { rationsRemaining: number } }): void {
        const left = Math.max(0, Math.floor(skip.endState.rationsRemaining));
        setRationsHeld(db, cultivator, rationsHeld(db, cultivator) + left);
    }

export function setRationsHeld(db: Database.Database, cultivator: Pick<Cultivator, 'id'>, held: number): void {
        writeFlag(db, cultivator.id, FLAG_RATIONS_HELD, String(Math.max(0, Math.floor(held))));
    }
