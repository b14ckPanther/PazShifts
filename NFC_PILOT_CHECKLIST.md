# NFC Real-Device Pilot Checklist — פז כורדני (Paz Kurdani)

Step-by-step checklist for testing a physical NFC tag with one real station, one authenticated worker, and one station admin.

---

## 1. Pilot Station Details

| Parameter                    | Value                                                           |
| :--------------------------- | :-------------------------------------------------------------- |
| **Station Name**             | **פז כורדני**                                                   |
| **Station Code**             | `KURDANI`                                                       |
| **Station ID**               | `7f0dd990-83d8-4588-b3dd-94bf860cdbaf`                          |
| **Station Address**          | שדרות ירושלים 1, קריית מוצקין                                   |
| **Active NFC Public Token**  | `c716fc17587a465bbd6dc74997c99db4`                              |
| **Exact Production NFC URL** | `https://shifts.paz.co.il/nfc/c716fc17587a465bbd6dc74997c99db4` |

---

## 2. Hardware Prerequisites

- **Physical NFC Tag**: NTAG213, NTAG215, or NTAG216 adhesive sticker (standard ISO/IEC 14443 Type A).
- **Writing Device**: iOS (iPhone 7 or newer) or Android phone with NFC enabled.
- **Tag Writing Application**: [NFC Tools](https://www.wakdev.com/en/apps/nfc-tools.html) (free on App Store & Google Play).
- **Worker Device**: Smartphone with NFC reading capability (Safari / Chrome).
- **Physical Tag Location**: Mounted at eye level near the cashier counter or employee entrance, away from bare metal surfaces (or using anti-metal ferrite foil NFC tags).

---

## 3. Physical Tag Programming Instructions

1. Open **NFC Tools** app on your phone.
2. Select **Write** > **Add a record**.
3. Select **URL / URI**.
4. Enter the exact URL:
   ```text
   https://shifts.paz.co.il/nfc/c716fc17587a465bbd6dc74997c99db4
   ```
5. Tap **OK**, then tap **Write / 13 Bytes**.
6. Hold your phone's NFC antenna (top of iPhone, back-center of Android) against the physical NFC sticker until the app vibrates and displays **Write complete!**.
7. _(Optional)_ In NFC Tools, select **Other tasks** > **Lock tag** only after the entire pilot has been verified if you wish to prevent accidental overwriting.

---

## 4. Operational Pilot Scenarios & Physical Device Validation

Execute the following 10 real-world steps on-site at Paz Kurdani:

### Test 1: Scan While Logged Out

1. Ensure the worker is logged out (or open an incognito/private browser tab).
2. Tap the phone against the physical NFC tag.
3. **Expected**: The browser automatically opens and redirects to:
   `https://shifts.paz.co.il/login?next=%2Fnfc%2Fc716fc17587a465bbd6dc74997c99db4`
4. **Verification**: Hebrew login screen appears with Paz Yellow branding and return path preserved.

### Test 2: Authentication & Auto-Return

1. Enter the worker's credentials on the login screen and submit.
2. **Expected**: Immediately redirects back to the NFC attendance interface:
   `https://shifts.paz.co.il/nfc/c716fc17587a465bbd6dc74997c99db4`
3. **Verification**: Displays "פז כורדני", worker's name, current time, and a prominent green "התחלת משמרת (Clock In)" button.

### Test 3: Authenticated Scan (Subsequent Visits)

1. Close browser tab.
2. Tap the phone against the physical NFC tag while still logged in.
3. **Expected**: Opens directly to the clock-in/out screen with zero login prompts.

### Test 4: Clock-In Execution

1. Tap the green **התחלת משמרת** button.
2. **Expected**:
   - Audio/haptic confirmation feedback.
   - Screen transitions to the **Active Shift** view.
   - Live elapsed-time counter starts ticking from `00:00:01`.
   - Displays "משמרת פעילה בתחנת פז כורדני".
3. **Admin Verification**: In the admin portal (`https://admin.shifts.paz.co.il/stations/7f0dd990-83d8-4588-b3dd-94bf860cdbaf/attendance`), the worker appears in the **נוכחים כעת (Active)** list.

### Test 5: Idempotent Rescan While Active

1. While the shift is active, tap the phone against the NFC tag again.
2. **Expected**: Re-opens the active shift screen with the live running timer without starting a duplicate shift.

### Test 6: Clock-Out Execution

1. Tap the red/yellow **סיום משמרת** button.
2. **Expected**:
   - Summary dialog displays start time, end time, and total shift duration.
   - Screen returns to idle status ready for next shift.
3. **Admin Verification**: Worker moves to the **משמרות שהסתיימו** list with clock-in/out source marked as `NFC`.

### Test 7: Rescan After Shift Completion

1. Tap the NFC tag after completing the shift.
2. **Expected**: Clean interface offering to start a new shift. No stuck or conflicting state.

### Test 8: Non-Station Worker Isolation

1. Attempt to scan the NFC tag with a user account not assigned to Paz Kurdani.
2. **Expected**: Clean Hebrew message: _"אינך משויך לתחנה זו. אנא פנה למנהל התחנה."_ Access denied.

### Test 9: Offline / Weak Signal Recovery

1. Toggle airplane mode or throttle network, then tap clock-in.
2. **Expected**: Friendly Hebrew alert stating connection error with a "נסה שנית" button. No crash.

### Test 10: Token Rotation

1. In the admin portal under NFC settings, click **סיבוב מזהה NFC**.
2. Confirm the rotation prompt.
3. Scan the old physical NFC tag.
4. **Expected**: Displays error _"תג NFC אינו מזוהה או שפג תוקפו"_.
5. Reprogram the physical tag with the newly generated URL.
6. Verify normal operation resumes.

---

## 5. Troubleshooting Matrix

| Symptom                                | Probable Cause                           | Action                                                                      |
| :------------------------------------- | :--------------------------------------- | :-------------------------------------------------------------------------- |
| Phone does not detect tag              | Tag placed directly on metal surface     | Use an anti-metal NFC tag or mount with a plastic spacer.                   |
| Tag opens App Store instead of browser | Custom URL scheme written                | Re-write tag ensuring type is standard **URL / URI** (`https://...`).       |
| "תג NFC אינו מזוהה"                    | Station token was rotated                | Check the token in the station admin panel and re-write to tag.             |
| "אין שיוך לתחנה"                       | Worker not assigned to Paz Kurdani       | In Admin > Staff, assign the worker with role `WORKER` and status `ACTIVE`. |
| Login redirect loop                    | Browser blocking cookies in private mode | Ensure standard mobile browser session is used.                             |
