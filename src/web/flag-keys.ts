/**
 * The keys this deployment stores per-cultivator flags under.
 *
 * A flag is a small durable fact about one cultivator that has no column of
 * its own - who they last addressed, whether they have taken the unearned
 * step, how many rations are in the pack, who took them on as a master. The
 * strings are here rather than beside whichever verb writes them because
 * reading and writing a flag are almost never the same verb: the pack is
 * filled by provisioning and drawn down by a seclusion, and a master is
 * written by a request and read on every cultivation span.
 *
 * A key that lives in the module of one of its two callers becomes a circular
 * import the moment that caller moves out, which is what happened here.
 */

/** Who the player last put something to. The referent a pronoun stands in for. */
export const FLAG_LAST_ADDRESSED = 'last_addressed';

/**
 * That this body has already been carried across once, and will not be again.
 *
 * `ONCE_IN_A_LIFE` in `immortal-items.ts`: one Unearned Step per person, ever.
 * A flag rather than a derived fact, because the thing it records is that an
 * EVENT happened - the ordinal it produced is indistinguishable afterwards from
 * one somebody climbed to, which is precisely what makes the object socially
 * expensive and mechanically final.
 */
export const FLAG_STEP_TAKEN = 'unearned_step_taken';

/**
 * Where rations bought ahead of time are kept.
 *
 * A per-cultivator counter rather than a new table: the engine already owns
 * a flag store keyed exactly this way, and a schema change to hold one
 * integer would be a migration this layer has no business writing.
 */
export const FLAG_RATIONS_HELD = 'rations_held';

/**
 * Who agreed to teach this cultivator, and where they stand.
 *
 * `<personId>:<ordinal>`. Read by `guideFor`, which is what turns it into a
 * number: a house supplies a guide because somebody in it is above you, and a
 * person who took you on supplies one for exactly the same reason and by
 * exactly the same arithmetic. `manuals.md` calls this the third and most
 * demanding shape a teaching takes - "a teacher and no book at all... their
 * progress now runs through somebody's goodwill rather than an object they
 * hold".
 */
export const FLAG_MASTER = 'master_who_took_them_on';
