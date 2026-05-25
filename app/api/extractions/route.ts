import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ExtractionOutput, ExtractionStatus } from '@/lib/types';

interface ExtractionListRow {
  id: string;
  title: string | null;
  status: ExtractionStatus;
  created_at: string;
  output: Partial<ExtractionOutput> | null;
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('extractions')
    .select('id, title, status, created_at, output')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as ExtractionListRow[];
  const items = rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    created_at: row.created_at,
    main_topic: row.output?.main_topic ?? '',
    summary: row.output?.summary ?? '',
    tags: row.output?.tags ?? [],
  }));

  return NextResponse.json({ extractions: items });
}
