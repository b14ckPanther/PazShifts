# Physical NFC pilot — automatic scan-in / scan-out

The user has the physical tag. The worker origin supplied by the user is `https://paz-shifts.vercel.app`. The tag URL stays unchanged:

```text
https://paz-shifts.vercel.app/nfc/c716fc17587a465bbd6dc74997c99db4
```

Station: **פז כורדני**, code `KURDANI`, recorded station ID `7f0dd990-83d8-4588-b3dd-94bf860cdbaf`. Verify the token and station against the deployed database before the pilot. Automated tests use isolated fixtures and do not establish physical success.

## Before testing the updated flow

1. Apply migrations in order, including `20260911000009_staff_permission_boundaries.sql` and `20260911000010_atomic_nfc_scans.sql`, to the intended Supabase project.
2. Deploy the updated worker app. Set both actual app origins and configure Supabase redirect URLs as described in [DEPLOYMENT.md](DEPLOYMENT.md).
3. Confirm the worker has an active profile and active membership at the station, and check whether they already have a shift open. The first scan after this update closes an existing active shift at the same station.
4. Write the **bare tag URL above** using NFC Tools → Write → Add a record → URL / URI. Never write the temporary `?scan=...&at=...` receipt URL from the browser address bar. Keep the tag unlocked for future domain changes.

## Expected experience

- **Logged in, no active shift:** opening the tag URL automatically registers clock-in and shows a confirmation with start time and elapsed time. No start button.
- **Logged in, active shift at this station:** a fresh scan automatically clocks out and shows the completed duration. No end-shift button.
- **Logged out:** compact login opens; the same scan continues automatically after authentication.
- **Double scan within 10 seconds:** the existing receipt is returned; no accidental reversal. Wait longer than 10 seconds for a deliberate next operation.
- **Refresh, browser back, or request retry:** the same receipt ID cannot change attendance twice, even after the 10-second window.
- **Unprocessed scan older than 15 minutes:** scan again; an old background tab must not unexpectedly start/end work.
- **Offline:** no success is claimed and no action is queued in the background. Reconnect and retry the same scan, then wait for confirmation before leaving.

A static URL tag cannot prove physical proximity: opening a copied bare URL is indistinguishable from scanning the tag. The scan flow and token are required for worker attendance; cryptographic proof of a physical scan requires different hardware/protocol support.

## Physical acceptance checks — user verification required

1. Logged-out scan → login → automatic clock-in. Confirm there is only one active database attendance record.
2. Refresh the receipt and switch away/back: attendance does not toggle.
3. Immediately rescan within 10 seconds: still only one operation.
4. After the duplicate window, physically scan again: clock-out occurs without a button; verify both timestamps and duration in the admin portal.
5. Rescan after a completed shift (after 10 seconds): a new shift starts, leaving history intact.
6. Test another-station conflict, inactive membership, invalid/rotated token, and a network interruption. No unauthorized or duplicate records should appear.
7. Test login, password autofill/show-hide, keyboard open, scan receipt, and error states on actual iPhone Safari and Android Chrome. Browser simulations do not reproduce all OS keyboard/NFC behavior.
8. Test Add to Home Screen / standalone launch. Launching the PWA opens the personal home, not an old scan. The phone OS may open an NFC link in its default browser; that browser must have its own logged-in session.

## Verification status

| Item                                                   | Status                                                |
| ------------------------------------------------------ | ----------------------------------------------------- |
| NFC hardware                                           | AVAILABLE                                             |
| Previous physical scan                                 | Reported by user for the old confirmation-button flow |
| Updated automatic scan-in/out on hardware              | PENDING USER AFTER MIGRATION / DEPLOYMENT             |
| Actual iPhone / Android keyboard and standalone checks | PENDING USER                                          |
| Automated scan transaction and responsive-layout tests | Separate from physical verification                   |
| Real station pilot on this version                     | NOT YET VERIFIED                                      |
