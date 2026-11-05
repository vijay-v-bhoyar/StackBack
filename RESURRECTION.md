# A linked-card stack, revived for a shift change

StackBack reimagines the linked-card authoring and browsing model of HyperCard as an offline operational guide. Cards, explicit links, browse/edit modes and a stack index are the interaction model. This is an original implementation, not a HyperCard emulator, legacy-file converter or HyperTalk interpreter.

## What was revived

| Linked-card idea | Working StackBack behavior |
|---|---|
| Browse a stack of cards | Explore stack opens a card reader with an index of cards and their connections. Following a link changes the displayed card without starting a recorded session. |
| Author the cards and their links | Edit a copy, use the card stack map to reach a card, write its content and select destinations. Validation finds broken, unreachable or cyclic routes. |
| Carry the context with the stack | A handoff JSON contains the exact guide snapshot, choices/backtracking and current note. A recipient previews it and imports a distinct local copy. |
| Read the current card without the original environment | A plain-text handoff brief carries the current step, note, active path, full correction history and snapshot identifier. A recipient can read it in a text viewer without a prepared StackBack app. It cannot resume the branching session. |
| Put the revived model to a current use | A volunteer shift can continue on its frozen guide while the author publishes a changed library revision. The version comparison shows what changed without silently rewriting the active session. |

The modern additions are bounded validation, local durable recovery, explicit conflicts and offline preparation. No runtime AI decides a route. The author remains responsible for its instructions.

The intended problem is a shift boundary where the next volunteer has a waiting task but lacks the route and version behind it. The new practice guide makes that concrete: the first shift used Blue table, the later library says Green table, and an earlier desk choice was corrected. The handoff preserves those facts so a coordinator can decide what applies. Preservation does not establish that continuing old instructions is correct.

## Demonstrate the difference

Use the original fictional Welcome desk sample and made-up notes only.

1. Select **Explore stack**. Follow **Find a station**, then **I'm not sure**. Inspect the connections and return to Library. This preview creates no saved session.
2. Edit a copy, name it **Shift handoff**, and save it. Start the guide, follow **Find a station**, write a fictional note and save.
3. Return to Library and edit that same guide. Change Card 2's body to a fictional new-shift instruction, then save.
4. Resume the earlier session. Its current card and note stay on the original snapshot. Open **Compare guide versions** to inspect the library change alongside the retained text.
5. Export the handoff and import it in a fresh, prepared recipient browser. Continue the original route. The recipient does not need the author's newer library copy to interpret the handoff.

For the richer case, select **Create shift-change practice guide**. It opens unsaved in the existing editor; it does not pre-record a fictional person's actions. Save and start it, follow **Review waiting handoff**, choose **Textile desk**, go back and choose **Ask coordinator**. Save a made-up waiting-task note. In the library, change Card 3's body from Blue table to Green table and save. Resume and compare the earlier snapshot with the new assignment. Export the text brief and read it in a text viewer without opening StackBack. Export JSON separately if the recipient needs to resume the route.

This demonstrates frozen context versus a changing guide. It does not establish that volunteers are faster or make fewer errors. A printed branching guide plus a note, Twine and other branching authoring tools remain relevant alternatives; no universal superiority is claimed.

## Boundaries that matter

An exported JSON file needs a running or previously prepared StackBack app. It is not a self-running offline document. The text brief can be read without the app but is not a replacement for the runnable guide. An initial app visit requires a connection; Offline ready requires the actual shell resources to be cached. Browser data can be cleared or evicted, so keep external backups.

Files are editable, unsigned and unencrypted. They contain the snapshot, corrected choices and current note, not an authenticated audit log. Avoid sensitive information. New writes obey the 1 MiB canonical file limit; a note that cannot fit remains unsaved while the earlier checkpoint is preserved. A stale session tab must save its alternative as a new copy rather than replace newer work.

Real volunteer demand, unassisted understanding, matched-baseline benefit and assistive-technology usability remain unvalidated. The fictional sample provides routing only, not repair expertise or safety advice.

A useful future comparison would give a consenting recipient the same fictional task through a printed branching guide plus note, then through a StackBack handoff, with order balanced. Check whether they identify the current task, corrected choice, original version and need for coordinator confirmation without creator help. Record errors and effort rather than assuming improvement. That study has not been run; the current demonstration establishes mechanics only.
