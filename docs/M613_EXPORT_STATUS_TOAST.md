# M6.13 — Floating MP4 Export Status

## Scope

Move the MP4 export preparation status out of the transcript's normal content flow and into the existing bottom-right floating notice stack.

## Behavior

- The initial `正在准备导出…` status appears as a normal Fluent-style floating notice at the bottom of the right pane.
- Subsequent host `status` messages with `busy: true` update the same task notice; they do not create duplicate notices.
- The task notice is persistent while the export is active and cannot be dismissed manually.
- When the host sends `busy: false`, the task notice is removed. The existing completion, cancellation, or error message is then handled by the ordinary notice rules.
- Ordinary notices keep their existing timeout and error-dismissal behavior.
- The active task notice uses the same border, background, radius, typography, shadow, and stack spacing as ordinary notices, with a small activity spinner.
- Floating notices and the word-edit toolbar share one bottom overlay. When the word toolbar is visible, notices stack above it rather than overlapping it.
- The overlay does not participate in transcript layout or scrolling.

## Non-goals

- No changes to Remotion, npm, browser preparation, rendering, cancellation, or MP4 output logic.
- No changes to project storage, subtitle data, word editing, or text export.
- The dependency confirmation/progress dialog remains unchanged; it is separate from the inline export-status toast.

## Validation

Run `npm run verify`. The M6.13 source-level regression tests cover removal of the inline status element, reuse and cleanup of the persistent task notice, and stacking with the word toolbar.


## Subsequent code-review corrections

The 2026-11-05 full code review also made MP4 export commit an active word edit and recompute its page-plan snapshot, bound external page plans to the visible word sequence, and preserved a paragraph break attached to a hidden word during plain-text export. See `M613_CODE_REVIEW_2026-11-05.md`.
