import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const root = process.cwd();
const envPath = path.join(root, '.env.local');

function readLocalEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};

  return Object.fromEntries(
    fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
        return [key, value];
      })
  );
}

const fileEnv = readLocalEnv(envPath);
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || fileEnv.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || fileEnv.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. No database calls were made.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const tables = [
  'profiles',
  'posts',
  'likes',
  'comments',
  'book_clubs',
  'messages',
  'giveaways',
  'giveaway_participants',
  'notifications',
  'creative_posts',
  'creative_likes',
  'creative_comments',
  'follows',
  'rewards',
  'redemptions',
  'shop_books',
  'events'
];

function printSection(title) {
  console.log(`\n=== ${title} ===`);
}

async function countTable(table) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });

  return {
    table,
    count: error ? null : count,
    status: error ? `ERROR: ${error.code || 'unknown'} ${error.message}` : 'OK'
  };
}

async function fetchOpenApiRpcPaths() {
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: 'application/openapi+json'
    }
  });

  if (!response.ok) {
    return { error: `OpenAPI request failed: ${response.status} ${response.statusText}`, rpcPaths: [] };
  }

  const spec = await response.json();
  const rpcPaths = Object.keys(spec.paths || {})
    .filter((item) => item.startsWith('/rpc/'))
    .sort();

  return { rpcPaths };
}

async function main() {
  console.log('Nobel Conecta read-only Supabase audit');
  console.log(`Project: ${new URL(SUPABASE_URL).hostname}`);
  console.log('Mode: read-only. This script does not insert, update, delete, upload, or call mutating RPCs.');

  printSection('Table Visibility And Counts');
  for (const result of await Promise.all(tables.map(countTable))) {
    console.log(`${result.table}: ${result.status}${result.count === null ? '' : ` (${result.count})`}`);
  }

  printSection('Admin Profiles');
  const { data: admins, error: adminsError } = await supabase
    .from('profiles')
    .select('id, username, role, points, created_at')
    .in('role', ['admin', 'superadmin'])
    .order('created_at', { ascending: true });

  if (adminsError) {
    console.log(`Could not read admin profiles: ${adminsError.code || 'unknown'} ${adminsError.message}`);
  } else if (!admins?.length) {
    console.log('No admin/superadmin profiles visible through the anon client.');
  } else {
    admins.forEach((admin) => {
      console.log(`@${admin.username} | role=${admin.role} | points=${admin.points ?? 0} | id=${admin.id}`);
    });
  }

  printSection('Suspicious Public Profile Signals');
  const { count: highPointsCount, error: highPointsError } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .gt('points', 5000);

  if (highPointsError) {
    console.log(`Could not count high-point profiles: ${highPointsError.code || 'unknown'} ${highPointsError.message}`);
  } else {
    console.log(`Profiles with more than 5000 points: ${highPointsCount ?? 0}`);
  }

  printSection('RPC Metadata');
  const { rpcPaths, error: rpcError } = await fetchOpenApiRpcPaths();
  if (rpcError) {
    console.log(rpcError);
  } else {
    const required = ['/rpc/increment_points', '/rpc/redeem_reward'];
    required.forEach((rpc) => {
      console.log(`${rpc}: ${rpcPaths.includes(rpc) ? 'present in OpenAPI schema' : 'not listed in OpenAPI schema'}`);
    });
  }

  printSection('Policy Audit Limitation');
  console.log('RLS policy definitions are not exposed through the public anon API.');
  console.log('Use Supabase SQL Editor for policy inspection, or apply docs/production_security_patch.sql after review.');
}

main().catch((error) => {
  console.error('Audit failed:', error.message || error);
  process.exit(1);
});
