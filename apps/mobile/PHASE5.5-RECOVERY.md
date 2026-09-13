# Phase 5.5 — iOS Apple-login recovery

## Verified on 2026-09-14

- EAS CLI 24.3.0, macOS arm64, Node 26.7.0; Expo SDK 57 (installed ~57.0.22).
- `whoami`: millionroses. `project:info`: @millionroses/yellowshifts-worker,
  c737ab37-6406-450c-ace7-b516e7815c93. Expo and Apple account emails need not match.
- Development identity: il.co.darb.yellowshifts.dev. Preview/production: il.co.darb.yellowshifts.
- `eas credentials --platform ios`, development-device, **No** to Apple login:
  EAS reports **No credentials set up yet** for the development identity.
- `security find-identity -v -p codesigning`: zero valid local signing identities.
- `xcrun devicectl list devices`: no connected devices found. This does not establish
  whether the iPhone is already registered in the Apple Portal.
- Developer membership active per owner; direct Apple Portal login/team verification pending.
- No Apple password requested, key material read, credentials revoked, builds submitted,
  production data changed, migrations applied, or product features modified in this recovery.

## Diagnosis and supported bypass

[Expo issue 4392](https://github.com/expo/eas-cli/issues/4392), opened September 11,
reports the exact `iTunes service key is empty` assertion in @expo/apple-utils during
Apple login, before team selection. The issue was open at inspection. This supports
an upstream authentication-path problem; it is not proof of a bad password or inactive
membership. We did not repeat the owner's failing login or patch Apple authentication.

Use [EAS local credentials](https://docs.expo.dev/app-signing/local-credentials/).
Only `build.development-device.ios.credentialsSource` is now `local`. Android and
preview/production credential sources retain their existing defaults.

**Signing distinction:** EAS `distribution: internal` uses Ad Hoc signing with an
Apple Distribution certificate, even with `developmentClient: true`. Do not create
an Apple Development profile for this EAS path. See
[internal distribution](https://docs.expo.dev/build/internal-distribution/) and
[Apple Ad Hoc profiles](https://developer.apple.com/help/account/provisioning-profiles/create-an-ad-hoc-provisioning-profile).

Local credentials avoid EAS Apple login; they do not make an EAS cloud build offline.
EAS still receives signing material to sign the build. Never include it in Git.

## Stop 1: Apple Portal inventory — owner interaction required now

1. Open https://developer.apple.com/account/ and sign in as founder@darb.co.il privately.
2. Confirm the paid team appears and any membership agreement required for access is accepted.
3. Open Certificates, Identifiers & Profiles → Certificates.
4. Look for an unexpired **Apple Distribution** certificate. Do not revoke it. If one
   exists, locate its original matching private key / password-protected .p12 on its
   owner's Mac or secure backup. Downloading the .cer alone does not recover that key.
5. Under Identifiers, look for explicit App ID `il.co.darb.yellowshifts.dev`.
6. Under Devices, check whether the intended iPhone is registered.

Report only certificate existence / expiry, App ID existence, device registration,
and public Team ID if available. Do not send passwords, .p12 contents, or keys in chat.
If Portal login fails too, resolve that Apple account issue before creating certificates.

## Subsequent steps after inventory (perform one stage at a time)

### Certificate, only if no reusable certificate/private-key pair exists

1. Open macOS Keychain Access. Select login keychain.
2. Keychain Access → Certificate Assistant → Request a Certificate From a Certificate Authority.
3. Email: founder@darb.co.il. Common Name: YellowShifts Distribution. CA Email: blank.
   Select Saved to disk. Save CSR inside `apps/mobile/credentials/`.
4. Apple Portal → Certificates → + → Apple Distribution → Continue → upload that CSR.
5. Download the .cer into credentials/ and double-click to install it.
6. Keychain Access → login → My Certificates: find the new Apple Distribution certificate.
   Expand it and confirm a matching private key. Export the certificate and private key
   together as `credentials/apple-distribution.p12`, protected by a strong password.
   Enter passwords only in local OS dialogs. If a certificate quota is reached, stop;
   do not revoke another app's certificate to free a slot.

### App ID and iPhone

- Reuse the explicit .dev App ID if present. Otherwise Identifiers → + → App IDs → App,
  description YellowShifts Development, explicit bundle ID `il.co.darb.yellowshifts.dev`.
- Enable Push Notifications and Associated Domains before generating the profile.
  Background location is configured by the native app; do not add unrelated capabilities.
- Connect iPhone by USB, unlock it and approve Trust on iPhone/Mac. Open Xcode →
  Window → Devices and Simulators → Devices → select iPhone → copy Identifier (UDID).
- Apple Portal → Devices → + → iOS → name the test iPhone and enter the actual UDID.
  Do not use a simulator UUID. If already registered, reuse it.

### Provisioning

Apple Portal → Profiles → + → Distribution → **Ad Hoc** → select the explicit .dev App ID
→ select the matching Apple Distribution certificate → select the registered test iPhone
→ name YellowShifts Dev Ad Hoc → Generate → Download.
Save as `credentials/yellowshifts-dev-adhoc.mobileprovision`.

Before building, validate locally: profile unexpired, matching certificate SHA-256,
matching certificate/private key, correct Apple team, application-identifier ending in
`.il.co.darb.yellowshifts.dev`, ProvisionedDevices includes the actual iPhone, Ad Hoc
rather than App Store/Development profile, and Push/Associated Domains entitlements.
Do not print the full profile or private key. An Ad Hoc-signed app uses production APNs
entitlement/environment; 'development client' does not mean APNs sandbox signing.

### Local JSON

`credentials.example.json` contains placeholders only. Real credentials.json is ignored
because the P12 password is secret. Keep directory mode 700 and JSON/file modes 600.
After files are ready, run from apps/mobile (password entry is hidden):

```bash
python3 - <<'PY'
import getpass, json, os
from pathlib import Path
p = Path('credentials.json')
if p.exists():
    raise SystemExit('credentials.json already exists; inspect privately, do not overwrite blindly')
for f in ['credentials/apple-distribution-macos.p12', 'credentials/yellowshifts-dev-adhoc.mobileprovision']:
    if not Path(f).is_file():
        raise SystemExit('Required local signing file is missing')
s = json.loads(Path('credentials.example.json').read_text())
s['ios']['distributionCertificate']['password'] = getpass.getpass('P12 export password: ')
fd = os.open(p, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as out:
    json.dump(s, out, indent=2)
PY
```

Do not paste this JSON into chat. Preserve Android/other local credentials if a file
already exists. The example is single-target; this app currently has no extensions.

### Build after credential validation

```bash
cd /Users/zangeel/Documents/GitHub/PazShifts/apps/mobile
pnpm dlx eas-cli@24.3.0 build --platform ios --profile development-device --non-interactive
```

Pin the inspected CLI for reproducibility. This uses supplied credentials without Apple
login. Inspect errors without EXPO_DEBUG or secret dumps. If a dependency fails, do not
change product behavior or regenerate credentials blindly. No auto-submit flag.
Keep ignored generated ios/ out of the EAS source archive so the .dev config is prebuilt;
the local Simulator ios/ tree may have the production identity from previous QA.

## APNs — separate, after signing works

No .p8 belongs in credentials.json: that file describes build signing, not push delivery.
Inspect Apple Portal → Keys first. Reuse a valid APNs key with an available private .p8.
Apple only allows downloading it when created; do not revoke it if the file is missing.
If a new key is needed, create it explicitly for APNs using Apple's current scope controls
covering this team/app and production APNs used by Ad Hoc. Record public Key ID and Team ID.
Keep .p8 in ignored credentials/. Never confuse an App Store Connect API key with APNs.

EAS credentials menu exposes Push Notifications even when Apple login is declined.
Use that menu to select an existing key/upload supplied .p8 + Key ID + Team ID; inspect
actual prompts before submitting. Do not choose Generate or revoke blindly. If CLI
requires Apple login for validation, stop and use Expo's supported dashboard credential
upload if available; do not patch authentication or insert undocumented API requests.

## Config validation result

EAS 24.3.0 `config --platform ios --profile development-device --json` passed:
local credentials, internal distribution, developmentClient=true, simulator=false,
and bundleIdentifier=il.co.darb.yellowshifts.dev. `expo install --check` passed.
EAS reported no Plain text/Sensitive variables in its development environment.
Local .env.local contains public Supabase configuration, but it is Git-ignored;
confirm the cloud build environment has the intended public URL/anon key before
building. This does not justify uploading server secrets. Notification enablement
also needs explicit test-build configuration before push qualification.
Git ignore probes for .p12/.p8/.mobileprovision/credentials.json/Firebase JSON/private
.key all passed. The temporary resolved config was deleted after allowlisted inspection.

## Device qualification (pending)

Install the signed IPA using the EAS build installation page on the registered iPhone;
enable iOS Developer Mode if prompted, then start Metro using `pnpm dev -- --lan`.
Use a dedicated test worker/station only. Verify .dev identity and launch first.
Before push testing, confirm the test build has EXPO_PUBLIC_NOTIFICATIONS_ENABLED=true
and correct public Supabase configuration; remote push is otherwise intentionally gated.
Never add service-role secrets to mobile environment variables.

Then test permission grant/denial, ExpoPushToken and own worker_devices registration,
foreground/background/closed taps, logout/account switch, and second device if available.
Do not print push tokens. Verify AASA hosts include the real App ID prefix + .dev identity
before testing Universal Links. Website configuration/deployment is a separate owner step;
this recovery does not deploy it. Test NFC using isolated station/token and explicit
confirmation only. Test optional When In Use → Always permissions and real geofence
entry/exit; no automatic attendance or production test attendance.

Android is deferred until iOS is unblocked: then check google-services.json, FCM v1 key
in EAS, signing SHA-256 and assetlinks. Do not change Android signing during iOS recovery.

## Current outcome

Local credential routing/template and Git protections prepared. Apple App ID, remote
team certificates, provisioning profile, registered iPhone and APNs key still require
Portal inventory. No signed EAS build, physical installation, push token or physical
notification/geofence/NFC verification completed. Phase 5.5 is **not complete**.

Rollback of this config-only bypass: restore development-device.ios.credentialsSource
to remote (or remove it) once verified remote credentials are available. This does not
revoke anything. Preserve encrypted credential backups; never use Git as the backup.

## Recovery progress — manual certificate received

Owner's Apple Portal screenshot confirms team KHQ29Z6A7S and initially empty certificate
inventory. Created RSA-2048/SHA-256 CSR with encrypted private key in ignored credentials/.
Downloaded distribution.cer identifies Apple Distribution: Noor Aldeen Mosa,
team KHQ29Z6A7S, valid September 13, 2026 through September 13, 2027 (UTC).
Verified certificate public key matches the CSR's private key and certificate is not expired.
Created credentials/apple-distribution.p12 and verified password-protected reopening.
Key, certificate PEM and separate generated password files remain ignored, permissions 600;
credentials/ has permissions 700. No password or private key was printed or committed.
No Keychain import was needed for EAS local credentials. Preserve these artifacts securely;
a .cer download alone cannot recreate the matching private key.

Next owner step: inspect/create explicit development App ID with Push Notifications and
Associated Domains, register actual iPhone UDID, then generate matching Ad Hoc profile.
Do not regenerate the completed certificate. EAS JSON will be populated privately after
profile verification, using the existing local P12 password file without chat disclosure.
APNs, signed build and physical-device testing remain pending.

## Provisioning profile and first EAS attempts

Downloaded YellowShifts Dev Ad Hoc profile passes team, explicit .dev App ID, real iPhone,
matching distribution certificate, Ad Hoc type, expiry, production APNs and Associated Domains
checks. Expiry: 2027-09-13T21:20:43Z. Stored ignored with mode 600; credentials.json created
privately with the generated P12 password. Device identifier stays out of tracked documentation.

First EAS build ec4e0a83-3142-4d2c-8180-830f0c39a07d bypassed Apple login but failed at
PREPARE_CREDENTIALS: certificate was readable, but builder could not validate the imported
signing identity. Local macOS certificate trust verification passed. Repackaged the same
certificate/key with Apple's verified WWDR G3 intermediate (downloaded from Apple PKI),
retaining AES-256 encryption and the original P12. Local JSON now points to
credentials/apple-distribution-with-chain.p12. No Apple credential rotation/revocation.

EAS development environment now has only the required public Supabase URL and anon key
copied from existing local app configuration. Anon role verified; no server key uploaded.
Notifications flag remains off pending APNs setup. Retry build:
ad4b8a31-9511-47d0-92c6-d48e31e662b2. Outcome pending at this log entry.

Second attempt also failed credential preparation. Reproduced locally: macOS security import
rejects the OpenSSL 3 default PBES2/AES P12 with MAC verification error although OpenSSL
can reopen it. Exported the identical key/certificate with macOS-compatible PKCS12
PBE-SHA1-3DES key/certificate wrapping, SHA-1 MAC, 100000 iterations and the existing
random high-entropy export password. Signing RSA key and certificate are unchanged.
Included verified Apple WWDR G3 intermediate. File: credentials/apple-distribution-macos.p12.
Verified native import and **one valid codesigning identity** in isolated temporary Keychain
with its chain included in the temporary search list. Restored original user search list and
deleted temporary Keychain. No user trust override or normal Keychain import. Local JSON
now references that native-verified P12. Prior packaging files retained privately.

Build ff7278ae-c05b-4ba4-bab5-86c7a1cbc054 uses the macOS-compatible archive.
EAS PREPARE_CREDENTIALS, Expo Doctor, native prebuild, CocoaPods and Xcode configuration
passed. Compilation in progress. credentials.example.json now points to the validated
macOS-compatible archive name; never copy the example over an existing credentials.json.

## Successful signed build and physical installation

Build ff7278ae-c05b-4ba4-bab5-86c7a1cbc054 finished successfully.
https://expo.dev/accounts/millionroses/projects/yellowshifts-worker/builds/ff7278ae-c05b-4ba4-bab5-86c7a1cbc054
Downloaded IPA to ignored credentials/yellowshifts-dev.ipa. Extracted locally and verified
codesign --verify --deep --strict. Bundle il.co.darb.yellowshifts.dev, version 1.0.0,
build 1; signed application identifier matches team KHQ29Z6A7S. aps-environment production;
associated domains paz.darb.co.il and paz-shifts.vercel.app are present.
Installed successfully via devicectl on the owner's connected iPhone 15 Pro Max.
Native process launch command succeeded. This verifies installation and OS launch, not
visual runtime behavior or all app flows. Owner confirmation of the screen remains pending.

Apple-login workaround and signed-device installation are now successful. APNs key upload,
remote push enablement, token registration/delivery, Universal Link association verification,
NFC and geofence physical testing remain pending. Phase 5.5 is not yet fully complete.
No Git push, App Store submission, production data mutation or credential revocation.

## Push finalization checkpoint — 2026-09-14

Owner confirms the signed development client loads on the physical iPhone.
Read-only EAS CLI 24.3.0 credentials inspection selected development-device, declined
Apple login, and inspected Push Notifications > Use an existing push key > Adhoc.
EAS explicitly reported no Push Keys available in the account. No .p8 files were found
in apps/mobile/credentials or the owner Downloads directory. No keys were created,
revoked, uploaded or reassigned by this inspection.

Required external next step: create YellowShifts Push in Apple Developer > Keys with
APNs enabled, then download the one-time .p8 locally. The signed Ad Hoc app has
aps-environment=production, so its push key must support that environment. Team ID:
KHQ29Z6A7S. Keep key material in the ignored credentials directory.

Token registration code passes the linked EAS project ID to getExpoPushTokenAsync,
uses secure installation storage, and serializes registration/detach. These are code
observations, not physical qualification of tokens, logout or account switching.
Real delivery, receipts, foreground/background/terminated taps, preferences, scheduler
events and two-device behavior remain unverified. No release guards were changed.

Additional scheduler audit finding to resolve before qualification: the original SQL
reminder scan compares scheduled_shifts.start_at directly to now(), while the current
mobile schedule adapter normalizes legacy wall-clock timestamp storage. Check the
latest deployed function and timestamp semantics before enabling the scheduler. No
migration or production activation has been performed.

Only this checkpoint documentation was changed during this finalization audit. No
runtime tests were run for this documentation-only update. Phase 5.5 remains incomplete
until the APNs external step and signed-device notification qualification are finished.

## APNs key uploaded and assigned — 2026-09-14

Owner supplied AuthKey_7W54HZT332.p8. Copied to ignored credentials directory with
mode 600; verified Git exclusion and private-key parse/check without logging contents.
EAS CLI 24.3.0: development-device > declined Apple login > Push Notifications >
Add a new push key > Adhoc > declined generation > supplied existing file, Key ID
7W54HZT332 and Team ID KHQ29Z6A7S > assigned to yellowshifts-worker.
EAS subsequently displayed the matching Push Key and team for il.co.darb.yellowshifts.dev.
The CLI could not validate against Apple without login; real delivery remains required.
No certificate/profile rotation, no production bundle assignment, no release flag change.

Validation: node --experimental-strip-types --test apps/mobile/tests/notifications.test.mjs
tests/notification-delivery.test.mjs passed 22/22. These cover mocked registration,
account isolation, authorization, tickets, receipts and invalid-token cleanup; they do
not establish physical APNs delivery. Awaiting owner identification of the test worker
and station before test registration/delivery. No scheduler or production traffic enabled.

## Signed iPhone foreground push qualified — 2026-09-14

Local-only EXPO_PUBLIC_NOTIFICATIONS_ENABLED=true enabled in ignored .env.local.
Physical iPhone granted notification permission and registered an enabled iOS 1.0.0
device for the owner-designated Anas account. Linked EAS project ID confirmed by
development diagnostics; token contents never printed.

Observed repeat registration caused by native token-change callback requesting native
registration again through getExpoPushTokenAsync. Provider now forwards the native
event token to synchronizeDevice, which passes devicePushToken to Expo. Added regression
coverage. Development-only diagnostics log stages, permission and project ID, no tokens.

Sent one explicitly labelled qualification notification for the designated account at
Curdani, using its existing active attendance as a safe LEFT_OPEN navigation target.
No attendance or schedule changes. This is a seeded transport/navigation test, not
qualification of automatic LEFT_OPEN threshold eligibility. The private harness reused
dispatchNotifications with all operations scoped to one device/delivery; it did not
invoke the global claim RPC. One inbox row and delivery ledger row created.
Expo accepted the ticket and getReceipts returned status ok. Owner confirmed the update
appeared in the foreground inbox. Background/terminated delivery and taps remain pending.
23 notification/device/transport tests passed; mobile typecheck and lint passed.
No Git commit/push, deployment, production release flag change or scheduler activation.

## Background and terminated-app qualification — 2026-09-14

Owner confirmed background notification appearance and tap opening Curdani. Owner then
force-closed the app and confirmed a new notification launched it, restored login and
opened Curdani automatically. Expo returned successful receipts for both tests. Read-only
DB verification confirms both tapped inbox rows have read_at set; the foreground row
remains unread as expected when merely displayed rather than opened. These qualify the
seeded LEFT_OPEN attendance target; schedule and shift reminder targets remain untested.

Phase 5.5 is still incomplete: actual schedule publication/reminder generation, automated
LEFT_OPEN eligibility, scheduler deployment/activation, account switch, second device,
and remaining permission settings need qualification. No broad scheduler was invoked.
The reminder SQL time interpretation issue needs a separately approved migration before
reminder qualification: current schedule writer preserves station wall time in UTC-labelled
values, while SQL treats start_at as an absolute instant. Proposed change is station-timezone
conversion in reminder selection and eligibility, including expiry; preserve the original
start value for dedupe/version checks. No historical shift rows should be rewritten.
User explicitly requires approval before creating a migration; none created.

## Approved reminder timezone migration — 2026-09-14

Added 20260914000023_notification_station_time.sql after explicit user approval.
Converts legacy UTC-labelled station wall times using each station timezone, choosing
the earlier repeated DST hour and skipping nonexistent local times, matching mobile.
Replaces only the schedule functions wrapped by LEFT_OPEN migration 21. New reminder
expiry uses the real start instant; eligibility also uses that instant. Stored startAt
and dedupe keys remain unchanged. No stored shifts, attendance, delivery rows or
preferences are rewritten by the migration. Existing reminder eligibility no longer
relies on legacy incorrect expiry. Publication expiry retains its existing behavior.

Validation ran only in disposable local paz_push_timezone_test, cloned from the
existing notification fixture DB. Added a minimal empty attendance fixture and station
threshold column locally to load migration 21, and applied the Sunday migration 22.
Both tests/sql/worker-notifications.sql and tests/sql/notification-station-time.sql pass.
Coverage: registration/RLS/account reassociation, 30/60/off, stale edits, dedupe, expiry,
past starts, summer/winter, spring gap, earlier fall overlap, UTC/negative offsets and
helper permissions. Fixture time storage now follows the real schedule writer contract.
The minimal attendance fixture does not qualify production LEFT_OPEN behavior.

Migration is not applied to hosted Supabase. No db push, deployment, scheduler activation
or Git commit/push performed. Review pending migrations before any later database push;
that command may apply other unshipped migrations too. Phase 5.5 remains incomplete
pending automatic-event, account-switch and second-device physical qualification.
