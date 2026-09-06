import io
p = 'src/web/verb-pattern-table.ts'
s = io.open(p, encoding='utf-8').read()

duty_block = """    // the house's own board, ahead of the mortal one
    const namedDuty = usedAsVerb(text, DUTY_TAKING_VERBS) ? dutyNamed(text) : undefined;
    if (namedDuty) {
        return { action: 'sect', intent: 'duty', target: namedDuty };
    }
"""
intake_block = """    // WHAT IS NAILED TO THE WALL
    if (TAKING_A_POSTED_INTAKE.test(text)) {
        const house = whoseIntakeItIs(input);
        return { action: 'sect', ...(house ? { target: house } : {}) };
    }
"""
assert duty_block in s and intake_block in s
i_duty = s.index(duty_block)
i_intake = s.index(intake_block)
assert i_duty < i_intake, 'expected duty to come first'

new_intake = """    // ── WHAT IS NAILED TO THE WALL, AHEAD OF THE BOARD ───────────────────
    //
    // Measured: "I take the intake at the Silver Island Market" came back as a
    // DUTY carrying the target "intake at the Silver Island Market" - a
    // commission by that name, which no house has ever posted. The two
    // branches below read the same verb. `take` is a duty-taking verb and it
    // is also how somebody says they are turning up to be admitted, so the
    // named-duty read fired first and `dutyNamed` handed back the whole phrase
    // as the name of a job.
    //
    // Order is the fix and not a guard, because the two are not ambiguous in
    // the other direction: `TAKING_A_POSTED_INTAKE` needs an intake noun, and
    // "I take a commission" has none. Signing on is a narrower sentence than
    // taking work, so it is asked first.
"""
s = s[:i_intake] + s[i_intake + len(intake_block):]
i_duty = s.index(duty_block)
s = s[:i_duty] + new_intake + intake_block + '\n' + s[i_duty:]
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
