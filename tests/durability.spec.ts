/**
 * Durable-handoff regression suite. Kiro-authored, with Codex fixture/oracle corrections.
 *
 * FOUR independent browser oracles covering the three gaps described in design.md:
 *   1. canonical-limit  — near-capacity import + 1 000-char note must report Not saved and retain the original checkpoint.
 *   2. compact-bypass   — compact JSON whose pretty canonical form exceeds MAX_FILE_BYTES must be rejected before the import dialog.
 *   3. legacy-recovery  — over-capacity run seeded directly into IndexedDB must remain resumable; shortening the note must save.
 *   4. stale-tab-conflict — concurrent-tab overwrite must report Not saved; "Save session as new copy" creates a distinct record.
 *
 * Imports the Codex-authored deterministic fixture; no manual byte calculations here.
 *
 * Canonical-size invariant:
 *   When enforcing canonical size in parsePackage and Store.saveRun do NOT call encodePackage
 *   (encodePackage already calls parsePackage → infinite recursion).  Use
 *   JSON.stringify(value, null, 2) + new TextEncoder().encode(s).byteLength directly.
 */
import {test,expect,type BrowserContext,type Page} from '@playwright/test';
import {capacityRun,handoff,canonicalBytes} from './capacity-fixture';

const MAX_FILE_BYTES = 1_048_576;

// ---------------------------------------------------------------------------
// Test 1 — near-limit import: 1 000-char note must NOT replace the saved checkpoint.
// Required behavior: Save reports "Not saved"; reload still offers Resume
//   with the original (pre-edit) note.
// Earlier regression: saveRun writes the over-limit run anyway and the
//   stored note becomes the 1 000-char string (wrong).
// ---------------------------------------------------------------------------
test('near-limit import: 1000-char note is rejected and original checkpoint survives reload', async ({page}) => {
  const run = capacityRun();

  // Confirm the fixture is truly near-capacity before touching it.
  const baseBytes = canonicalBytes(run);
  expect(baseBytes, 'fixture must be below MAX_FILE_BYTES with empty note').toBeLessThan(MAX_FILE_BYTES);

  const originalNote = 'Original synthetic note — no real data';
  run.note = originalNote;
  expect(
    canonicalBytes(run),
    'fixture with short original note must still fit within MAX_FILE_BYTES',
  ).toBeLessThan(MAX_FILE_BYTES);

  // Verify a 1 000-char note pushes it over the limit.
  const bigNote = 'A'.repeat(1000);
  const runWithBigNote = {...run, note: bigNote};
  expect(
    canonicalBytes(runWithBigNote),
    'fixture with 1 000-char note must exceed MAX_FILE_BYTES',
  ).toBeGreaterThan(MAX_FILE_BYTES);

  // Wrap the original-note run as a valid handoff file and import it.
  const fileContent = JSON.stringify(handoff(run), null, 2);
  expect(
    new TextEncoder().encode(fileContent).byteLength,
    'handoff file to import must be within MAX_FILE_BYTES',
  ).toBeLessThanOrEqual(MAX_FILE_BYTES);

  await page.goto('/');

  // Use the native Import chooser (matches journeys.spec.ts pattern).
  const chooserPromise = page.waitForEvent('filechooser', {timeout: 4000});
  await page.getByRole('button', {name: 'Import a file', exact: true}).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'capacity-handoff.json',
    mimeType: 'application/json',
    buffer: Buffer.from(fileContent),
  });

  // Confirm the import dialog appears with the guide title.
  await expect(page.getByRole('dialog')).toContainText('Synthetic capacity fixture');

  // Accept the import.
  await page.getByRole('button', {name: 'Import as new copy'}).click();

  // The runner view should load; the note field should show the original note.
  await expect(page.getByLabel('Current handoff note')).toHaveValue(originalNote);

  // Edit the note to exactly 1 000 ASCII characters.
  await page.getByLabel('Current handoff note').fill(bigNote);
  await page.getByRole('button', {name: 'Save note'}).click();

  // Required assertion: Save must report Not saved.
  await expect(page.getByRole('status')).toContainText('Not saved');

  // Reload and confirm the original checkpoint (with the short original note) is still available.
  await page.reload();

  // The session list must contain a Resume button for the imported run.
  await expect(page.getByRole('button', {name: 'Resume session'})).not.toHaveCount(0);

  // Resume the first session (the imported one).
  await page.getByRole('button', {name: 'Resume session'}).first().click();

  // Required assertion: the stored note must be the original short note, not the big one.
  await expect(page.getByLabel('Current handoff note')).not.toHaveValue(bigNote);
  await expect(page.getByLabel('Current handoff note')).toHaveValue(originalNote);
});


// ---------------------------------------------------------------------------
// Test 2 — compact-bypass: compact JSON ≤ MAX_FILE_BYTES but pretty-print > MAX_FILE_BYTES
//   must be rejected before the import dialog opens.
// Required behavior: alert visible, dialog absent.
// Earlier regression: the compact file passes parsePackage's byte-length
//   check and the import dialog opens (wrong).
// ---------------------------------------------------------------------------
test('compact JSON whose canonical form exceeds MAX_FILE_BYTES is rejected before import dialog', async ({page}) => {
  const run = capacityRun();

  // The independent original fixture is below the cap; this allowed note makes its canonical output exceed it.
  run.note = 'A'.repeat(1000);
  const prettyBytes = canonicalBytes(run);
  expect(
    prettyBytes,
    'fixture canonical form must be at or above MAX_FILE_BYTES for this test to be meaningful',
  ).toBeGreaterThanOrEqual(MAX_FILE_BYTES);

  // Produce the compact form (no indent) — this is what a sender might ship.
  const compactContent = JSON.stringify(handoff(run)); // no indent
  const compactByteLength = new TextEncoder().encode(compactContent).byteLength;
  expect(
    compactByteLength,
    'compact form must be below MAX_FILE_BYTES (otherwise this test conflates two separate checks)',
  ).toBeLessThan(MAX_FILE_BYTES);

  await page.goto('/');

  // Feed the compact file through the hidden file input (direct path; this test
  // exercises parsePackage rejection, not the chooser UX — the chooser path is
  // already covered by journeys.spec.ts test 1 and durability test 1).
  await page.locator('input[type=file]').setInputFiles({
    name: 'compact-over-limit.json',
    mimeType: 'application/json',
    buffer: Buffer.from(compactContent),
  });

  // Required assertion: an alert must appear.
  await expect(page.getByRole('alert')).toBeVisible();

  // Required assertion: no import dialog must have opened.
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // The existing session list must be unchanged — no new Resume button appeared.
  const resumeCount = await page.getByRole('button', {name: 'Resume session'}).count();
  expect(resumeCount, 'no session must have been created from the rejected compact file').toBe(0);
});


// ---------------------------------------------------------------------------
// Test 3 — legacy over-capacity stored session recovery.
//   A run seeded directly into IndexedDB (bypassing saveRun) that is valid per
//   requireRun/replay but whose canonical form exceeds MAX_FILE_BYTES must appear
//   in the session list with a recovery tag and be resumable.  Shortening the
//   note and saving must then report Saved.
// Required behavior: listed (not hidden), resumable, note-shortening saves.
// Earlier regression: refresh() filters it out as corrupt (encodePackage throws).
// ---------------------------------------------------------------------------
test('over-capacity stored run is listed resumable and note-shortening saves successfully', async ({page}) => {
  // Build the over-capacity run: valid schema/replay, canonical bytes > MAX_FILE_BYTES.
  const run = capacityRun();

  // Add a 1 000-char note to push it over the canonical limit.
  const overCapacityNote = 'B'.repeat(1000);
  run.note = overCapacityNote;
  expect(
    canonicalBytes(run),
    'over-capacity run must exceed MAX_FILE_BYTES for this test to be meaningful',
  ).toBeGreaterThan(MAX_FILE_BYTES);

  // Seed once after initialization, then reload. Re-seeding on every navigation would overwrite the repair.
  await page.goto('/');
  await page.evaluate((value) => new Promise<void>((resolve,reject)=>{
    const request=indexedDB.open('stackback-v1',1);
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{const db=request.result;const tx=db.transaction('runs','readwrite');tx.objectStore('runs').put(value);tx.oncomplete=()=>{db.close();resolve()};tx.onabort=()=>reject(tx.error)};
  }),run);
  await page.reload();

  // Required assertion: the over-capacity run must appear in the session list.
  // The design specifies the tag text 'Over-capacity — shorten note to export'.
  await expect(page.locator('[class*="tag"]').filter({hasText: 'Over-capacity'})).toBeVisible();

  // Required assertion: a Resume session button must be present.
  await expect(page.getByRole('button', {name: 'Resume session'})).not.toHaveCount(0);

  // Resume the over-capacity session.
  await page.getByRole('button', {name: 'Resume session'}).first().click();

  // Confirm the runner view loaded (the guide title heading should be visible).
  await expect(page.getByLabel('Current handoff note')).toHaveValue(overCapacityNote);

  // Shorten the note so it fits within the canonical limit.
  await page.getByLabel('Current handoff note').fill('Shortened note');
  await page.getByRole('button', {name: 'Save note'}).click();

  // Required assertion: Save must now succeed.
  await expect(page.getByRole('status')).toContainText('Saved');

  // Reload and confirm the shortened note persists.
  await page.reload();
  await page.getByRole('button', {name: 'Resume session'}).first().click();
  await expect(page.getByLabel('Current handoff note')).toHaveValue('Shortened note');
});


// ---------------------------------------------------------------------------
// Test 4 — stale-tab conflict: two tabs on the same session.
//   Tab A saves a choice+note after Tab B has loaded the same session.
//   Tab B's subsequent save must report Not saved (conflict) and leave A's stored
//   record unchanged.  Tab B must be able to use "Save session as new copy" to
//   preserve its alternative as a distinct second record.
// Required behavior: conflict reported, A's record intact, copy distinct.
// Earlier regression: no conflict detection; B silently overwrites A's record.
// ---------------------------------------------------------------------------
test('stale-tab conflict preserves newer stored record and copy creates a distinct second session', async ({browser}) => {
  // Each tab gets its own page but shares the same BrowserContext and therefore
  // the same IndexedDB.
  const context: BrowserContext = await browser.newContext();

  try {
    const pageA: Page = await context.newPage();
    const pageB: Page = await context.newPage();

    // ---- SETUP: both tabs navigate to the library. ----
    await pageA.goto('/');
    await pageB.goto('/');

    // Tab A starts the sample guide and waits for the initial save.
    await pageA.getByRole('button', {name: 'Start guide', exact: true}).first().click();
    await expect(pageA.getByRole('status')).toContainText('Saved');

    // Tab A makes a choice to advance to a new card and saves with a note.
    await pageA.getByRole('button', {name: 'Find a station', exact: true}).click();
    await pageA.getByLabel('Current handoff note').fill('Tab A note');
    await pageA.getByRole('button', {name: 'Save note'}).click();
    await expect(pageA.getByRole('status')).toContainText('Saved');

    // Record the run ID that Tab A is working on (read from the page for later comparison).
    const runIdA = await pageA.evaluate(() => {
      // The runner heading's parent article or status bar typically doesn't expose
      // the run id directly; we read it from IndexedDB.
      return new Promise<string>((resolve, reject) => {
        const req = indexedDB.open('stackback-v1', 1);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('runs', 'readonly');
          const store = tx.objectStore('runs');
          const getAllReq = store.getAll();
          getAllReq.onsuccess = () => {
            const runs: Array<{id: string; events: unknown[]}> = getAllReq.result;
            // The most recently updated run is the one Tab A just saved.
            if (runs.length === 0) { reject(new Error('no runs')); return; }
            const latest = runs.reduce((a, b) =>
              (a as any).updatedAt > (b as any).updatedAt ? a : b,
            );
            resolve(latest.id);
          };
        };
        req.onerror = () => reject(new Error('idb error'));
      });
    });

    // Tab B navigates to the library and resumes the same session (run ID A).
    await pageB.reload();
    await expect(pageB.getByRole('button', {name: 'Resume session'})).not.toHaveCount(0);
    await pageB.getByRole('button', {name: 'Resume session'}).first().click();

    // Confirm Tab B loaded the session (note from Tab A should be visible).
    await expect(pageB.getByLabel('Current handoff note')).toHaveValue('Tab A note');

    // Tab A now makes ANOTHER choice and saves — this advances A's stored checkpoint.
    await pageA.getByRole('button', {name: 'Clothing or textile', exact: true}).click();
    await pageA.getByRole('button', {name: 'Save note'}).click();
    await expect(pageA.getByRole('status')).toContainText('Saved');

    // Record A's stored record BEFORE Tab B does anything — used for comparison later.
    const aRecordBeforeB = await pageA.evaluate((id: string) => {
      return new Promise<string>((resolve, reject) => {
        const req = indexedDB.open('stackback-v1', 1);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('runs', 'readonly');
          const getReq = tx.objectStore('runs').get(id);
          getReq.onsuccess = () => resolve(JSON.stringify(getReq.result));
          getReq.onerror = () => reject(new Error('get failed'));
        };
        req.onerror = () => reject(new Error('idb error'));
      });
    }, runIdA);

    // Tab B (which still has the stale checkpoint from before A's second save)
    // makes a choice and tries to save.
    // Tab B's in-memory path is still at the card it navigated to; it now saves the note.
    await pageB.getByLabel('Current handoff note').fill('Tab B alternative note');
    await pageB.getByRole('button', {name: 'Save note'}).click();

    // Required assertion: Tab B must report a conflict/Not saved.
    await expect(pageB.getByRole('status')).toContainText('Not saved');
    // The conflict message should mention "another tab" or "conflict".
    await expect(pageB.getByRole('status')).toContainText(/another tab|conflict/i);

    // Required assertion: A's stored record must be unchanged.
    const aRecordAfterBFailed = await pageA.evaluate((id: string) => {
      return new Promise<string>((resolve, reject) => {
        const req = indexedDB.open('stackback-v1', 1);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('runs', 'readonly');
          const getReq = tx.objectStore('runs').get(id);
          getReq.onsuccess = () => resolve(JSON.stringify(getReq.result));
          getReq.onerror = () => reject(new Error('get failed'));
        };
        req.onerror = () => reject(new Error('idb error'));
      });
    }, runIdA);

    expect(aRecordAfterBFailed, 'A\'s stored record must be unchanged after B\'s conflict').toBe(aRecordBeforeB);

    // Required assertion: a "Save session as new copy" button must be visible on Tab B.
    await expect(pageB.getByRole('button', {name: 'Save session as new copy'})).toBeVisible();

    // Tab B uses "Save session as new copy" to preserve its alternative.
    await pageB.getByRole('button', {name: 'Save session as new copy'}).click();
    await expect(pageB.getByRole('status')).toContainText('Saved');

    // The copy must have a DIFFERENT run id than A's run.
    const runIdB = await pageB.evaluate(() => {
      return new Promise<string>((resolve, reject) => {
        const req = indexedDB.open('stackback-v1', 1);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('runs', 'readonly');
          const getAllReq = tx.objectStore('runs').getAll();
          getAllReq.onsuccess = () => {
            const runs: Array<{id: string; updatedAt: string}> = getAllReq.result;
            if (runs.length === 0) { reject(new Error('no runs')); return; }
            const latest = runs.reduce((a, b) => a.updatedAt > b.updatedAt ? a : b);
            resolve(latest.id);
          };
        };
        req.onerror = () => reject(new Error('idb error'));
      });
    });

    expect(runIdB, 'copy must have a distinct id from the original run').not.toBe(runIdA);

    // ASSERTION: A's stored record is STILL unchanged even after B saved its copy.
    const aRecordAfterCopy = await pageA.evaluate((id: string) => {
      return new Promise<string>((resolve, reject) => {
        const req = indexedDB.open('stackback-v1', 1);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('runs', 'readonly');
          const getReq = tx.objectStore('runs').get(id);
          getReq.onsuccess = () => resolve(JSON.stringify(getReq.result));
          getReq.onerror = () => reject(new Error('get failed'));
        };
        req.onerror = () => reject(new Error('idb error'));
      });
    }, runIdA);

    expect(aRecordAfterCopy, 'A\'s stored record must remain unchanged after B saved a copy').toBe(aRecordBeforeB);

  } finally {
    await context.close();
  }
});
