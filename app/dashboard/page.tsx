import { redirect } from 'next/navigation';
import { DashboardClient } from '@/components/DashboardClient';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  return <DashboardClient />;
}
