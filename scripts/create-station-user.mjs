#!/usr/bin/env node

/**
 * Script to create or assign an employee, shift manager, or station admin to a station.
 *
 * Usage:
 *   node --env-file=apps/admin/.env.local scripts/create-station-user.mjs <stationCodeOrId> <email> <password> <fullName> <role> [employeeCode]
 *
 * Role:
 *   - ADMIN          (מנהל תחנה)
 *   - SHIFT_MANAGER  (מנהל משמרת)
 *   - WORKER         (עובד תחנה)
 *
 * Example:
 *   node --env-file=apps/admin/.env.local scripts/create-station-user.mjs SSS worker@paz.co.il Pass123! "ישראל ישראלי" WORKER EMP-101
 */

import { createRequire } from 'module';
import path from 'path';

const require = createRequire(path.resolve('./packages/database/package.json'));
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('\n❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const stationIdentifier = process.argv[2]?.trim();
const email = process.argv[3]?.trim().toLowerCase();
const password = process.argv[4];
const fullName = process.argv[5]?.trim();
const rawRole = process.argv[6]?.trim().toUpperCase();
const employeeCode = process.argv[7]?.trim() || null;

const validRoles = ['ADMIN', 'SHIFT_MANAGER', 'WORKER'];

if (!stationIdentifier || !email || !password || !fullName || !rawRole) {
  console.error('\n❌ Missing arguments.');
  console.error('Usage:');
  console.error('  pnpm create-user <stationCodeOrId> <email> <password> <fullName> <role> [employeeCode]\n');
  console.error('Roles: ADMIN | SHIFT_MANAGER | WORKER');
  console.error('Example:');
  console.error('  pnpm create-user SSS worker@paz.co.il Pass123! "דני לוי" WORKER EMP-101\n');
  process.exit(1);
}

if (!validRoles.includes(rawRole)) {
  console.error(`\n❌ Invalid role "${rawRole}". Valid roles are: ${validRoles.join(', ')}\n`);
  process.exit(1);
}

async function main() {
  console.log(`\n🔍 Looking up station "${stationIdentifier}"...`);

  // Find station by id or code
  const { data: allStations, error: stErr } = await supabase
    .from('stations')
    .select('id, code, name');

  if (stErr) {
    console.error(`❌ Error fetching stations: ${stErr.message}`);
    process.exit(1);
  }

  const station = allStations?.find(
    (s) =>
      s.code.toLowerCase() === stationIdentifier.toLowerCase() ||
      s.id === stationIdentifier
  );

  if (!station) {
    console.error(`❌ Station "${stationIdentifier}" not found.`);
    console.error('Available stations:');
    allStations?.forEach((s) => console.error(`  - ${s.name} (Code: ${s.code}, ID: ${s.id})`));
    process.exit(1);
  }

  console.log(`✓ Found station: ${station.name} (${station.code})`);

  // 1. Check or create user
  console.log(`\n🔍 Checking for user: ${email}...`);
  const { data: listData, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error(`❌ Failed to list users: ${listErr.message}`);
    process.exit(1);
  }

  let user = listData.users.find((u) => u.email?.toLowerCase() === email);
  let userId;

  if (!user) {
    console.log(`➕ Creating new user account...`);
    const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createErr || !createData.user) {
      console.error(`❌ Failed to create user: ${createErr?.message}`);
      process.exit(1);
    }
    userId = createData.user.id;
    console.log(`✓ User created with ID: ${userId}`);
  } else {
    userId = user.id;
    console.log(`ℹ️  User already exists (ID: ${userId}). Updating password and name...`);
    await supabase.auth.admin.updateUserById(userId, {
      password,
      user_metadata: { full_name: fullName },
    });
  }

  // Ensure profile has email and full_name
  await supabase.from('profiles').upsert({
    id: userId,
    email,
    full_name: fullName,
    is_active: true,
  });

  // 2. Check or create station membership
  const { data: existingMembership } = await supabase
    .from('station_memberships')
    .select('id, role, status')
    .eq('station_id', station.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (existingMembership) {
    console.log(`ℹ️  User already assigned to this station. Updating role to ${rawRole}...`);
    const { error: updErr } = await supabase
      .from('station_memberships')
      .update({
        role: rawRole,
        status: 'ACTIVE',
        employee_code: employeeCode,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingMembership.id);

    if (updErr) {
      console.error(`❌ Failed to update membership: ${updErr.message}`);
      process.exit(1);
    }
  } else {
    console.log(`🔗 Assigning user to ${station.name} with role ${rawRole}...`);
    const { error: insErr } = await supabase
      .from('station_memberships')
      .insert({
        station_id: station.id,
        user_id: userId,
        role: rawRole,
        status: 'ACTIVE',
        employee_code: employeeCode,
      });

    if (insErr) {
      console.error(`❌ Failed to assign station member: ${insErr.message}`);
      process.exit(1);
    }
  }

  const roleLabel =
    rawRole === 'ADMIN'
      ? 'מנהל תחנה (Station Admin)'
      : rawRole === 'SHIFT_MANAGER'
        ? 'מנהל משמרת (Shift Manager)'
        : 'עובד תחנה (Worker)';

  console.log('\n================================================================');
  console.log('✅ STATION MEMBER CONFIGURED SUCCESSFULLY');
  console.log('================================================================');
  console.log(` Station:       ${station.name} (${station.code})`);
  console.log(` User Name:     ${fullName}`);
  console.log(` Email:         ${email}`);
  console.log(` Role:          ${rawRole} — ${roleLabel}`);
  if (employeeCode) console.log(` Employee Code: ${employeeCode}`);
  console.log(` User ID:       ${userId}`);
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
