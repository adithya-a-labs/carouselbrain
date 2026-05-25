import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ResultPage } from '@/components/ResultPage';
import { createClient } from '@/lib/supabase/server';
import type { Extraction } from '@/lib/types';

export default async function ExtractionResultPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data } = await supabase
    .from('extractions')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (!data) {
    redirect('/dashboard');
  }

  const extraction = data as Extraction;

  if (extraction.status !== 'done') {
    return (
      <main className="mx-auto max-w-[640px] px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-gray-900">This extraction is still processing...</h1>
        <Link href="/dashboard" className="mt-4 inline-flex text-sm font-medium text-gray-900">
          Back to dashboard
        </Link>
      </main>
    );
  }

  return <ResultPage extraction={extraction} />;
}
