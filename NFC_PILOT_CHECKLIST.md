# Physical NFC pilot — automatic scan-in / confirmed scan-out

The pilot tag was written with the original worker origin `https://paz-shifts.vercel.app`, which stays assigned to the worker project alongside the current worker origin `https://paz.darb.co.il` (see [DEPLOYMENT.md](DEPLOYMENT.md)). The tag URL stays unchanged:

```text
https://paz-shifts.vercel.app/nfc/c716fc17587a465bbd6dc74997c99db4
```

Station: **פז כורדני**, code `KURDANI`, recorded station ID `7f0dd990-83d8-4588-b3dd-94bf860cdbaf`. Migration 17 sets its location to 32.858784, 35.090755 with the default 50 m radius. Verify the token, station and location against the deployed database before the pilot. Automated tests use isolated fixtures and do not establish physical success.

## Before testing the updated flow

1. Apply migrations in order, including `20260911000009_staff_permission_boundaries.sql` , `20260911000010_atomic_nfc_scans.sql`, `20260911000011_nfc_checkout_confirmation.sql`, `20260911000012_auth_profile_contact_sync.sql`, `20260912000016_attendance_removal.sql` and `20260912000017_station_geofence.sql`, to the intended Supabase project. For the native app, also apply `20260913000020_native_nfc.sql` and `20260913000021_left_open_notifications.sql`.
2. Deploy the updated worker and admin apps together: migration 17 replaces the scan RPC, and old clients without location fail closed. Set both actual app origins and configure Supabase redirect URLs as described in [DEPLOYMENT.md](DEPLOYMENT.md). Keep `paz-shifts.vercel.app` serving the worker app, without a redirect, while this tag uses it.
3. In the admin station page, confirm the station's coordinates and radius (30–200 m). A station without coordinates rejects every scan.
4. Confirm the worker has an active profile and active membership at the station, and check whether they already have a shift open. A scan with an existing active shift asks for checkout confirmation; it does not close the shift immediately.
5. Write the **bare tag URL above** using NFC Tools → Write → Add a record → URL / URI. Never write the temporary `?scan=...&at=...` receipt URL from the browser address bar. Keep the tag unlocked for future domain changes.

## Expected experience

- **Location:** the browser asks for location on each scan and on checkout confirmation. The fix must be fresh (up to 60 seconds), with reported accuracy no worse than the station radius, and inside the radius. Denied, timed-out, stale, inaccurate or outside readings create no attendance and offer a retry of the same scan. Cancelling a checkout needs no location.
- **Logged in, no active shift:** opening the tag URL automatically registers clock-in and shows a confirmation with start time and elapsed time. No start button.
- **Logged in, active shift at this station:** a fresh scan asks “לסיים את המשמרת?”. Confirm to clock out at confirmation time, or cancel to keep working. There is no worker checkout control outside the scan flow; station admins can close or delete a record, with a reason, in admin attendance.
- **Logged out:** enter phone number and the existing password; no OTP is sent. The email option is hidden in the login form. The same scan continues after authentication. Save and verify a worker phone through the admin edit form before trying phone login.
- **Double scan within 10 seconds:** the existing receipt is returned; no accidental reversal. Wait longer than 10 seconds for a deliberate next operation.
- **Refresh, browser back, or request retry:** the same receipt ID cannot change attendance twice, even after the 10-second window. Replaying the receipt of an attendance record an admin deleted shows “המשמרת כבר הסתיימה” and never recreates it.
- **Unprocessed scan older than 15 minutes:** scan again; an old background tab must not unexpectedly start/end work.
- **Offline:** no success is claimed and no action is queued in the background. Reconnect and retry the same scan, then wait for confirmation before leaving.
- **Native app installed (iOS production build):** the OS may open the tag URL in the YellowShifts app instead of the browser. The native screen requires an explicit press for both entry and exit and one fresh precise location fix; the server applies the same checks. See [apps/mobile/PHASE7.md](apps/mobile/PHASE7.md).

A static URL tag cannot prove physical proximity: opening a copied bare URL is indistinguishable from scanning the tag. The scan flow and token are required for worker attendance; browser-supplied coordinates can be spoofed and deter only casual remote use. Cryptographic proof of a physical scan requires different hardware/protocol support.

## Physical acceptance checks — user verification required

1. Logged-out scan → login → automatic clock-in. Confirm there is only one active database attendance record.
2. Refresh the receipt and switch away/back: attendance does not toggle.
3. Immediately rescan within 10 seconds: still only one operation.
4. After the duplicate window, physically scan again: cancel checkout first and verify the shift stays active. Scan again and confirm checkout; verify both timestamps and duration in the admin portal.
5. Rescan after a completed shift (after 10 seconds): a new shift starts, leaving history intact.
6. Test another-station conflict, inactive membership, invalid/rotated token, and a network interruption. No unauthorized or duplicate records should appear.
7. Test location at the tag: inside and outside the radius, denied permission, and an inaccurate reading. The 50 m default needs physical testing at the tag location.
8. Test login, password autofill/show-hide, keyboard open, scan receipt, and error states on actual iPhone Safari and Android Chrome. Browser simulations do not reproduce all OS keyboard/NFC behavior.
9. Test Add to Home Screen / standalone launch. Launching the PWA opens the personal home, not an old scan. The phone OS may open an NFC link in its default browser or, when installed, the native app; each has its own logged-in session. Sessions are host-scoped: a session on `paz.darb.co.il` does not cover the old tag host.

## Verification status

| Item                                                   | Status                                                |
| ------------------------------------------------------ | ----------------------------------------------------- |
| NFC hardware                                           | AVAILABLE                                             |
| Previous physical scan                                 | Reported by user for the old confirmation-button flow |
| Updated scan-in / confirmed checkout on hardware       | PENDING USER AFTER MIGRATION / DEPLOYMENT             |
| Station location / radius at the tag                   | PENDING USER                                          |
| Native app tag tap                                     | PENDING USER                                          |
| Actual iPhone / Android keyboard and standalone checks | PENDING USER                                          |
| Automated scan transaction and responsive-layout tests | Separate from physical verification                   |
| Real station pilot on this version                     | NOT YET VERIFIED                                      |
