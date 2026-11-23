/**
 * One chip recipe for the whole chrome stack.
 *
 * The command bar and the venue nav used to size themselves independently, which is half of why the
 * two bars together ran past 140px on a phone and pushed the stage player off the first screen.
 * Every control that sits on the bar now imports these, so the stack's height is decided in one
 * place rather than in nine components that drift.
 *
 * A chip is a 44px tap target (CHROME_TAP) that paints a 32px pill: the top and bottom 6px are a
 * transparent border the background does not reach (bg-clip-padding), so the touch area is the
 * full 44px while the bar keeps its compact look. Each bar is exactly one chip tall with no padding
 * of its own, so the two bars stack to 89px on a phone (44 + the 1px divider + 44), under the 96px budget that keeps the video
 * on the first screen. Padding a bar, or growing a chip past 44px, breaks that budget.
 */
export const CHROME_TAP = "min-h-11 border-y-[6px] border-transparent bg-clip-padding";

/** A control on a bar that paints no pill of its own (the West Peek mark): a plain 44px square. */
export const CHROME_TAP_BOX = "min-h-11 min-w-11 justify-center";

export const COMMAND_CHIP = `flex shrink-0 items-center whitespace-nowrap rounded-full ${CHROME_TAP} px-2.5 text-xs font-black`;

/** The default chip: a control on the dark bar that is not the primary action. */
export const COMMAND_CHIP_MUTED = `${COMMAND_CHIP} bg-white/10 text-white hover:bg-white/20`;

/** A chip that only reports state (the status pill, "Show ended") and cannot be pressed. */
export const COMMAND_CHIP_STATIC = `${COMMAND_CHIP} bg-white/15 text-white`;

/**
 * A menu that opens off the bar.
 *
 * Below xl the bar is ONE scrolling row, and a row that scrolls clips anything absolutely
 * positioned inside it, which would have swallowed these panels. Fixed positioning escapes the
 * scroller, so on a phone a menu is a sheet at the bottom of the screen, which is where a thumb is
 * anyway. From xl up the row fits whole, nothing scrolls, and the menu is the dropdown it was.
 */
export const COMMAND_PANEL = "fixed inset-x-3 bottom-3 z-40 max-h-[70vh] overflow-auto rounded-2xl border border-brand-line bg-white shadow-xl xl:absolute xl:inset-x-auto xl:bottom-auto xl:mt-2";
