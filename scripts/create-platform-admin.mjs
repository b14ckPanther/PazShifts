#!/usr/bin/env node

/**
 * Script to create or promote a Platform Admin in YellowShifts.
 *
 * Usage:
 *   node --env-file=apps/admin/.env.local scripts/create-platform-admin.mjs <email> <password> [fullName]
 *
 * Example:
 *   node --env-file=apps/admin/.env.local scripts/create-platform-admin.mjs admin@example.com MySecurePassword123! "מנהל מערכת ראשי"
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
  console.error('\nRun with: node --env-file=apps/admin/.env.local scripts/create-platform-admin.mjs <email> <password> [fullName]\n');
  process.exit(1);
}

const email = process.argv[2]?.trim().toLowerCase();
const password = process.argv[3];
const fullName = process.argv[4]?.trim() || 'Platform Admin';

if (!email || !password) {
  console.error('\n❌ Missing arguments.');
  console.error('Usage: node --env-file=apps/admin/.env.local scripts/create-platform-admin.mjs <email> <password> [fullName]');
  console.error('Example: node --env-file=apps/admin/.env.local scripts/create-platform-admin.mjs admin@example.com Pass123! "ישראל ישראלי"\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  console.log(`\n🔍 Checking for existing user: ${email}...`);

  let userId;

  // 1. Check if user already exists
  const { data: listData, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error(`❌ Failed to list users: ${listErr.message}`);
    process.exit(1);
  }

  const existingUser = listData.users.find((u) => u.email?.toLowerCase() === email);

  if (existingUser) {
    userId = existingUser.id;
    console.log(`ℹ️  User already exists (ID: ${userId}). Updating password...`);
    const { error: updErr } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (updErr) {
      console.error(`❌ Failed to update user: ${updErr.message}`);
      process.exit(1);
    }
  } else {
    console.log(`➕ Creating new auth user...`);
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
    console.log(`✓ Auth user created (ID: ${userId})`);
  }

  // Ensure profile has email and full_name
  await supabase
    .from('profiles')
    .update({ email, full_name: fullName, updated_at: new Date().toISOString() })
    .eq('id', userId);

  // 2. Insert or update in platform_admins table
  console.log(`🛡️  Granting Platform Admin privileges in public.platform_admins...`);
  const { error: adminErr } = await supabase
    .from('platform_admins')
    .upsert(
      {
        user_id: userId,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (adminErr) {
    console.error(`❌ Failed to assign platform admin: ${adminErr.message}`);
    process.exit(1);
  }

  console.log('\n================================================================');
  console.log('✅ PLATFORM ADMIN CREATED SUCCESSFULLY');
  console.log('================================================================');
  console.log(` Email:     ${email}`);
  console.log(` Name:      ${fullName}`);
  console.log(` User ID:   ${userId}`);
  console.log(` Role:      Platform Admin (Global)`);
  console.log('\nYou can now log in to the Admin Portal at /login with these credentials.\n');
}

main().catch((err) => {
  console.error('\n❌ Unexpected error:', err);
  process.exit(1);
});
