import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://quelnhdikndxgkaptdfm.supabase.co',
  'sb_publishable_JqBQYpyG_7Cui9YsrR3qBA_-vQviETm'
);

async function check() {
  console.log('=== VERIFICANDO BANCO NOBEL CONECTA ===\n');

  // 1. Listar tabelas acessíveis pelo PostgREST
  const tables = ['profiles', 'posts', 'likes', 'comments', 'book_clubs', 'messages', 
                   'giveaways', 'giveaway_participants', 'notifications', 'creative_posts',
                   'creative_likes', 'creative_comments', 'follows', 'rewards', 
                   'redemptions', 'shop_books', 'events'];

  console.log('--- Status das Tabelas ---');
  for (const table of tables) {
    try {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      if (error) {
        console.log(`  ${table}: ❌ ERRO - ${error.message}`);
      } else {
        console.log(`  ${table}: ✅ ${count} registros`);
      }
    } catch (e) {
      console.log(`  ${table}: ❌ NÃO ENCONTRADA`);
    }
  }

  // 2. Verificar profiles
  console.log('\n--- Últimos 5 Profiles ---');
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, username, full_name, role, points, created_at').order('created_at', { ascending: false }).limit(5);
  if (pErr) {
    console.log('  ERRO:', pErr.message);
  } else {
    profiles?.forEach(p => console.log(`  @${p.username} | ${p.full_name} | role=${p.role} | pts=${p.points} | ${new Date(p.created_at).toLocaleDateString()}`));
  }

  // 3. Verificar posts
  console.log('\n--- Últimos 5 Posts ---');
  const { data: posts, error: postErr } = await supabase.from('posts').select('id, book_title, type, created_at').order('created_at', { ascending: false }).limit(5);
  if (postErr) {
    console.log('  ERRO:', postErr.message);
  } else {
    posts?.forEach(p => console.log(`  "${p.book_title}" | tipo=${p.type} | ${new Date(p.created_at).toLocaleDateString()}`));
  }

  // 4. Verificar tamanhos críticos
  console.log('\n--- Contagens Críticas ---');
  const criticalTables = ['notifications', 'messages', 'likes'];
  for (const t of criticalTables) {
    const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
    console.log(`  ${t}: ${count ?? '?'} registros`);
  }

  // 5. Verificar storage buckets
  console.log('\n--- Storage Buckets ---');
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  if (bErr) {
    console.log('  ERRO:', bErr.message);
  } else {
    buckets?.forEach(b => console.log(`  ${b.name} | público=${b.public}`));
  }

  console.log('\n=== FIM DA VERIFICAÇÃO ===');
}

check().catch(console.error);
