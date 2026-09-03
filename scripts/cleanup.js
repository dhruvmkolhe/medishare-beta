import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanup() {
  // Get the first 3 users (the orphaned ones from the failed first run)
  const { data: users } = await supabase.from('users').select('id, email').order('created_at', { ascending: true }).limit(3);
  console.log('Deleting users:', users);

  // Delete related providers and patients first
  for (const user of users || []) {
    const { data: providers } = await supabase.from('providers').select('id').eq('user_id', user.id);
    for (const p of providers || []) {
      await supabase.from('providers').delete().eq('id', p.id);
      console.log('Deleted provider', p.id);
    }
    const { data: patients } = await supabase.from('patients').select('id').eq('user_id', user.id);
    for (const p of patients || []) {
      await supabase.from('patients').delete().eq('id', p.id);
      console.log('Deleted patient', p.id);
    }
  }

  // Delete the orphaned users
  for (const user of users || []) {
    await supabase.from('users').delete().eq('id', user.id);
    console.log('Deleted user', user.id);
  }

  console.log('Cleanup complete');
}

cleanup().catch(err => {
  console.error('Cleanup error:', err);
  process.exit(1);
});
