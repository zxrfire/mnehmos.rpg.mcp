/** Visible ground and buildings share the free read used by look. */
export const THE_GROUND_ITSELF =
    /^(?:the |this |these |round |around )?(?:here|place|ground|town|village|city|province|region|district|land|area|settlement|surroundings)$/i;

export const WHAT_SOMEBODY_BUILT =
    /^(?:the |this |these |round |around )?(?:compound|buildings?|walls?|courts?|yards?|gates?|halls?|architecture|stonework|masonry)$/i;

/** A visible subject, rather than something sought in a thorough search. */
export function isAskingAboutWhatIsAlreadyInFrontOfThem(target: string): boolean {
    const asked = target.trim();
    return WHAT_SOMEBODY_BUILT.test(asked) || THE_GROUND_ITSELF.test(asked);
}
