import { redirect } from 'next/navigation';
import { ExtractClient } from '@/components/ExtractClient';
import { createClient } from '@/lib/supabase/server';

export default async function ExtractPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  return <ExtractClient />;
}
