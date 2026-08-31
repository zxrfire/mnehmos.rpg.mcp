/**
 * Secret lifecycle, per holder.
 *
 * The assertion that matters most is the one about the player: a secret
 * existing in the database is not the same as anybody having it, and the
 * ledger is the gate that keeps those apart.
 */

import {
    SecretLedger,
    createHolding,
    isDistorted,
    isHolding,
    transitionHolding
} from '../../../src/engine/social/secrets.js';
import { daysForYears } from '../../../src/engine/social/common.js';

const SECRET = 'secret_shan_shielded_the_crossing';

describe('holdings', () => {
    it('records a position per holder rather than one global revealed flag', () => {
        const ledger = new SecretLedger();
        ledger.put(
            createHolding({
                secretId: SECRET,
                holderId: 'elder_shan',
                status: 'discovered',
                onDay: daysForYears(10),
                note: 'He was the one holding the qi steady.'
            })
        );
        ledger.put(
            createHolding({
                secretId: SECRET,
                holderId: 'ke_ran',
                status: 'suspected',
                onDay: daysForYears(12),
                note: 'Noticed the sect ledger was short three hundred stones that spring.'
            })
        );
        ledger.put(
            createHolding({
                secretId: SECRET,
                holderId: 'yun_qi',
                status: 'unknown',
                onDay: daysForYears(12),
                note: 'Has never been told what it cost.'
            })
        );

        expect(ledger.holdersOf(SECRET)).toHaveLength(3);
        expect(ledger.holdersOf(SECRET, { holdingOnly: true }).map(h => h.holderId)).toEqual([
            'elder_shan'
        ]);
        expect(ledger.statusFor(SECRET, 'ke_ran')!.status).toBe('suspected');
    });

    it('distinguishes all nine lifecycle states', () => {
        const states = [
            'unknown',
            'suspected',
            'discovered',
            'stolen',
            'traded',
            'leaked',
            'suppressed',
            'falsified',
            'misunderstood'
        ] as const;
        const ledger = new SecretLedger();
        for (const status of states) {
            ledger.put(
                createHolding({ secretId: SECRET, holderId: `h_${status}`, status, onDay: 100 })
            );
        }
        expect(ledger.holdersOf(SECRET)).toHaveLength(9);
        expect(ledger.holdersOf(SECRET, { holdingOnly: true })).toHaveLength(6);
        expect(isHolding(ledger.statusFor(SECRET, 'h_suspected')!)).toBe(false);
        expect(isHolding(ledger.statusFor(SECRET, 'h_stolen')!)).toBe(true);
        expect(isDistorted(ledger.statusFor(SECRET, 'h_falsified')!)).toBe(true);
        expect(isDistorted(ledger.statusFor(SECRET, 'h_discovered')!)).toBe(false);
    });
});

describe('the player is not privileged', () => {
    it('does not hand the player a secret merely because the database has one', () => {
        const ledger = new SecretLedger();
        ledger.put(
            createHolding({ secretId: SECRET, holderId: 'elder_shan', status: 'discovered', onDay: 0 })
        );

        // The secret exists, is central, and has been in the world for years.
        expect(ledger.holdersOf(SECRET)).toHaveLength(1);
        // The player still has nothing, because no row says they do.
        expect(ledger.isKnownTo(SECRET, 'yun_qi')).toBe(false);
        expect(ledger.statusFor(SECRET, 'yun_qi')).toBeNull();
        expect(ledger.heldBy('yun_qi')).toHaveLength(0);
    });

    it('treats a suspicion as not knowing', () => {
        const ledger = new SecretLedger();
        ledger.put(
            createHolding({ secretId: SECRET, holderId: 'yun_qi', status: 'suspected', onDay: 0 })
        );
        expect(ledger.isKnownTo(SECRET, 'yun_qi')).toBe(false);
    });
});

describe('lifecycle transitions', () => {
    it('logs every move, with who did it and when', () => {
        const ledger = new SecretLedger();
        let holding = ledger.put(
            createHolding({ secretId: SECRET, holderId: 'ke_ran', status: 'suspected', onDay: daysForYears(12) })
        );

        holding = ledger.apply(holding, {
            to: 'stolen',
            onDay: daysForYears(14),
            actorId: 'ke_ran',
            note: 'Read the sect treasury ledger while the elder was in seclusion.'
        });
        holding = ledger.apply(holding, {
            to: 'traded',
            onDay: daysForYears(15),
            actorId: 'a_broker',
            acquiredFromId: 'ke_ran',
            price: 'A third-grade Meridian Knitting Pill and a name.',
            note: 'Sold it on within the year.'
        });
        holding = ledger.apply(holding, {
            to: 'suppressed',
            onDay: daysForYears(16),
            actorId: 'elder_ru',
            note: 'Sect ruling. She was made to swear on it.'
        });

        expect(holding.status).toBe('suppressed');
        expect(holding.price).toContain('Meridian Knitting Pill');
        // acquiredOnDay is preserved: when she first came into contact with it
        // does not change because her relationship to it did.
        expect(holding.acquiredOnDay).toBe(daysForYears(12));
        expect(holding.lastChangedOnDay).toBe(daysForYears(16));

        const history = ledger.historyFor(SECRET, 'ke_ran');
        expect(history.map(e => e.to)).toEqual(['stolen', 'traded', 'suppressed']);
        expect(history[0].from).toBe('suspected');
        expect(history[2].actorId).toBe('elder_ru');
    });

    it('keeps the fact that a suppressed secret was out for a while', () => {
        const ledger = new SecretLedger();
        let holding = ledger.put(
            createHolding({ secretId: SECRET, holderId: 'public:sweptground', holderKind: 'public', status: 'leaked', onDay: daysForYears(20) })
        );
        holding = ledger.apply(holding, {
            to: 'suppressed',
            onDay: daysForYears(22),
            note: 'The Hall put it down. Two years too late.'
        });

        expect(holding.status).toBe('suppressed');
        // Currently down, but the log still says it was out for two years -
        // which is a completely different problem from never having been out.
        const history = ledger.historyOf(SECRET);
        expect(history[0].to).toBe('suppressed');
        expect(history[0].from).toBe('leaked');
        expect(ledger.holdersOf(SECRET)[0].acquiredOnDay).toBe(daysForYears(20));
    });

    it('is pure: transitioning does not mutate the holding handed in', () => {
        const before = createHolding({ secretId: SECRET, holderId: 'ke_ran', status: 'suspected', onDay: 100 });
        const snapshot = JSON.parse(JSON.stringify(before));
        transitionHolding(before, { to: 'stolen', onDay: 200, note: 'x' });
        expect(before).toEqual(snapshot);
    });
});

describe('holding something that is not the secret', () => {
    it('keeps a doctored version apart so it can be sold onward and believed', () => {
        const ledger = new SecretLedger();
        const duped = ledger.put(
            createHolding({
                secretId: SECRET,
                holderId: 'yun_qi',
                status: 'falsified',
                onDay: daysForYears(24),
                acquiredFromId: 'a_broker',
                price: 'Two hundred stones.',
                heldVersion:
                    'Elder Shan took three hundred stones from the treasury and kept them.',
                note: 'The broker altered it to set him against the elder.'
            })
        );

        expect(isHolding(duped)).toBe(true);
        expect(isDistorted(duped)).toBe(true);
        // He has "the secret" and will act on it. What he has is not it.
        expect(ledger.versionHeldBy(SECRET, 'yun_qi')).toContain('kept them');
        expect(ledger.isKnownTo(SECRET, 'yun_qi')).toBe(true);
        // Whereas the man who was actually there holds no altered version.
        ledger.put(
            createHolding({ secretId: SECRET, holderId: 'elder_shan', status: 'discovered', onDay: 0 })
        );
        expect(ledger.versionHeldBy(SECRET, 'elder_shan')).toBeNull();
    });

    it('separates being wrong on purpose from being wrong by accident', () => {
        const ledger = new SecretLedger();
        ledger.put(
            createHolding({
                secretId: SECRET,
                holderId: 'ke_ran',
                status: 'misunderstood',
                onDay: 100,
                heldVersion: 'The elder was bribed.',
                note: 'Nobody lied to her. She drew the wrong conclusion.'
            })
        );
        expect(ledger.holdersOf(SECRET, { status: 'misunderstood' })).toHaveLength(1);
        expect(ledger.holdersOf(SECRET, { status: 'falsified' })).toHaveLength(0);
    });
});

describe('determinism', () => {
    it('mints the same ids for the same pair, so holdings round-trip', () => {
        const a = createHolding({ secretId: SECRET, holderId: 'ke_ran', status: 'suspected', onDay: 100 });
        const b = createHolding({ secretId: SECRET, holderId: 'ke_ran', status: 'stolen', onDay: 900 });
        expect(a.id).toBe(b.id);

        const first = transitionHolding(a, { to: 'stolen', onDay: 200, note: 'x' });
        const second = transitionHolding(a, { to: 'stolen', onDay: 200, note: 'x' });
        expect(first).toEqual(second);
    });
});
