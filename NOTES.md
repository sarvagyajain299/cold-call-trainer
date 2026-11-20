# Notes: things to add and do

Personal to-do and ideas list for this project. Add new items at the top of "Inbox". Move them when done.
Planned phases live in `SCORECARD_MEMORY_CHEATSHEET_PLAN.md`; nothing here starts until you say so.

## Inbox (new ideas, not sorted yet)

- Desktop lessons UI: scrolling should move the lesson forward, instead of having to click to advance.
  - Why: mouse scrolling is familiar, and familiarity is what makes something intuitive.
  - Alternative: clicking anywhere moves the lesson forward, but only when the screen has no box or button the user must click.
- Scorecard: detect interruptions and talking over each other (new), and name the slurred words (partly there).
  - Pace and the "share of words understood clearly" already exist; slurring could list the specific low-confidence words from Deepgram.
  - Interruptions: compare user word timestamps (Deepgram) with prospect turn times in the ElevenLabs transcript. Overlap = both talking at once. Report "you cut them off N times" and "they cut you off N times".
  - Cost about $0 (maths on data we already fetch). About 1-2 hours with tests.
  - First check: do the recording and transcript times line up to the second? (unverified, see PROJECT_CONTEXT.md section 6.2). Also check whether ElevenLabs marks interrupted turns itself.

## To do

- [ ] AI-write the call script steps for the offer (today only the backup sections are generated). Needs a plan first.
- [ ] Regenerate currently overwrites edits to reason, questions, objections, ask and proof. Decide: warn more clearly, or keep edited lines.
- [ ] Cheat sheet "focus" and "call with <name>" can reveal the person you are about to re-call. Filter by project or hide the name.

## Later / maybe

- [ ] Step 5 items (region voices, progress charts, ambient sound, drill mode, edit/delete projects, backups). See PROJECT_CONTEXT.md section 6.
- [ ] Add `recordings/` to `.gitignore` before any commit.

## Done

- 
