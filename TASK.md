# CarouselBrain — Build Task

Build the CarouselBrain MVP from scratch. This is a Next.js 14 full-stack application. Read `AGENTS.md` first — it contains all architectural decisions, the stack, the database schema, and the code conventions. Do not deviate from anything in it.

---

## Step 1 — Scaffold the project

Run this to initialize:

```bash
npx create-next-app@14 . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
```

Then install additional dependencies:

```bash
npm install @supabase/ssr @supabase/supabase-js
```

No other packages. Do not install axios, zod, react-query, shadcn, or anything else.

---

## Step 2 — Create all configuration files

### `.env.local`
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
OCR_SPACE_API_KEY=your_ocr_space_api_key
GROQ_API_KEY=your_groq_api_key
```

### `next.config.ts`
```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '52mb',
    },
  },
};

export default nextConfig;
```

### `tsconfig.json`
```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

## Step 3 — Create the database migration

Create `supabase/migrations/001_initial.sql` with this exact content:

```sql
create extension if not exists "uuid-ossp";

-- Profiles (mirrors auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  created_at timestamptz default now() not null,
  extraction_count integer default 0 not null
);
alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Extractions (core table)
create table public.extractions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text,
  source_type text not null default 'upload',
  image_urls text[] not null default '{}',
  raw_ocr_text text,
  output jsonb not null default '{}',
  content_hash text unique,
  status text not null default 'pending',
  error_message text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
create index extractions_user_id_idx on public.extractions (user_id);
create index extractions_content_hash_idx on public.extractions (content_hash);
create index extractions_created_at_idx on public.extractions (created_at desc);
alter table public.extractions enable row level security;
create policy "Users can view own extractions" on public.extractions for select using (auth.uid() = user_id);
create policy "Users can insert own extractions" on public.extractions for insert with check (auth.uid() = user_id);
create policy "Users can update own extractions" on public.extractions for update using (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger set_updated_at
  before update on public.extractions
  for each row execute procedure public.handle_updated_at();
```

---

## Step 4 — Create shared TypeScript types

Create `lib/types.ts`:

```typescript
export type ExtractionStatus = 'pending' | 'processing' | 'done' | 'error';
export type ResourceType = 'book' | 'tool' | 'course' | 'link' | 'person' | 'framework';

export interface Resource {
  name: string;
  type: ResourceType;
  url: string | null;
  description: string;
}

export interface Concept {
  term: string;
  definition: string;
}

export interface ExtractionOutput {
  main_topic: string;
  summary: string;
  key_insights: string[];
  action_steps: string[];
  resources: Resource[];
  concepts: Concept[];
  learning_path: string[];
  tags: string[];
}

export interface Extraction {
  id: string;
  user_id: string;
  title: string | null;
  source_type: string;
  image_urls: string[];
  raw_ocr_text: string | null;
  output: ExtractionOutput;
  content_hash: string | null;
  status: ExtractionStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExtractionListItem {
  id: string;
  title: string | null;
  status: ExtractionStatus;
  created_at: string;
  main_topic: string;
  tags: string[];
}
```

---

## Step 5 — Create Supabase clients

### `lib/supabase/client.ts`
```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### `lib/supabase/server.ts`
```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}
```

---

## Step 6 — Create the OCR module

Create `lib/ocr.ts`:

```typescript
const OCR_API_URL = 'https://api.ocr.space/parse/image';

export async function extractTextFromImage(
  base64Image: string,
  mimeType: string
): Promise<string> {
  const formData = new FormData();
  formData.append('base64Image', `data:${mimeType};base64,${base64Image}`);
  formData.append('language', 'eng');
  formData.append('isOverlayRequired', 'false');
  formData.append('detectOrientation', 'true');
  formData.append('scale', 'true');
  formData.append('isTable', 'false');
  formData.append('OCREngine', '2');

  const response = await fetch(OCR_API_URL, {
    method: 'POST',
    headers: { apikey: process.env.OCR_SPACE_API_KEY! },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`OCR API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (data.IsErroredOnProcessing) {
    throw new Error(`OCR processing error: ${data.ErrorMessage}`);
  }

  return (
    data.ParsedResults
      ?.map((r: { ParsedText: string }) => r.ParsedText)
      .join('\n\n') ?? ''
  ).trim();
}

export async function extractTextFromCarousel(
  images: Array<{ base64: string; mimeType: string }>
): Promise<string> {
  const results: string[] = [];
  for (let i = 0; i < images.length; i++) {
    const text = await extractTextFromImage(images[i].base64, images[i].mimeType);
    if (text) results.push(`--- SLIDE ${i + 1} ---\n${text}`);
  }
  return results.join('\n\n');
}
```

---

## Step 7 — Create the Groq LLM module

Create `lib/groq.ts`:

```typescript
import type { ExtractionOutput } from './types';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `You are a knowledge extraction specialist. Analyze OCR-extracted text from educational social media carousels and transform it into structured, actionable knowledge.

Respond with valid JSON only. No preamble, no markdown fences, no explanation. Just the raw JSON object.

Required schema:
{
  "main_topic": "core subject of the carousel",
  "summary": "2-3 sentence plain-English summary for someone who hasn't seen it",
  "key_insights": ["3-7 complete, useful sentences — the most important ideas"],
  "action_steps": ["3-6 verb-first actionable items the reader can do immediately"],
  "resources": [
    {
      "name": "exact name of the resource",
      "type": "one of: book | tool | course | link | person | framework",
      "url": "infer if obvious (e.g. github.com/org/repo), otherwise null",
      "description": "one sentence: what it is and why it matters"
    }
  ],
  "concepts": [
    {
      "term": "a jargon term or acronym mentioned",
      "definition": "plain English, 1-2 sentences"
    }
  ],
  "learning_path": ["3-8 ordered steps from beginner to advanced mastery of this topic"],
  "tags": ["3-6 lowercase hyphenated topic tags, e.g. machine-learning, career, python"]
}

Rules:
- Never hallucinate resources. Only include what is explicitly mentioned.
- action_steps must be immediately actionable, not vague advice.
- concepts only for non-obvious terms. Skip things any educated adult would know.
- If OCR text is noisy, infer meaning from context — do not refuse to answer.
- If the carousel is shallow or motivational rather than educational, say so briefly in the summary.`;

export async function extractKnowledge(ocrText: string): Promise<ExtractionOutput> {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Extract structured knowledge from this carousel OCR text:\n\n${ocrText}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error: ${response.status} — ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from Groq');

  let parsed: ExtractionOutput;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Failed to parse Groq response: ${content.slice(0, 200)}`);
  }

  return {
    main_topic: parsed.main_topic ?? 'Untitled',
    summary: parsed.summary ?? '',
    key_insights: parsed.key_insights ?? [],
    action_steps: parsed.action_steps ?? [],
    resources: parsed.resources ?? [],
    concepts: parsed.concepts ?? [],
    learning_path: parsed.learning_path ?? [],
    tags: parsed.tags ?? [],
  };
}
```

---

## Step 8 — Create the API routes

### `app/api/extract/route.ts`

This is the most important file. Implement it with this exact behavior:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractTextFromCarousel } from '@/lib/ocr';
import { extractKnowledge } from '@/lib/groq';
import { createHash } from 'crypto';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 10;

export async function POST(request: NextRequest) {
  // 1. Auth check
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse files
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const files = formData.getAll('images') as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: 'No images provided' }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Maximum ${MAX_FILES} images allowed` }, { status: 400 });
  }

  // 3. Validate each file server-side
  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Only JPEG, PNG, and WEBP allowed.` },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File ${file.name} exceeds 5MB limit` },
        { status: 400 }
      );
    }
  }

  // 4. Compute content hash server-side
  const hashInput = files
    .map(f => `${f.name}:${f.size}`)
    .sort()
    .join(',');
  const contentHash = createHash('sha256').update(hashInput).digest('hex');

  // 5. Cache check
  const { data: cached } = await supabase
    .from('extractions')
    .select('id')
    .eq('content_hash', contentHash)
    .eq('status', 'done')
    .single();

  if (cached) {
    return NextResponse.json({ cached: true, extraction_id: cached.id }, { status: 200 });
  }

  // 6. Create pending row
  const { data: extraction, error: insertError } = await supabase
    .from('extractions')
    .insert({
      user_id: user.id,
      status: 'processing',
      content_hash: contentHash,
    })
    .select('id')
    .single();

  if (insertError || !extraction) {
    return NextResponse.json({ error: 'Failed to create extraction record' }, { status: 500 });
  }

  const extractionId = extraction.id;

  // 7. Return 202 immediately, process in background
  // TODO: Add rate limiting before launch
  processExtraction(extractionId, user.id, files, supabase).catch(console.error);

  return NextResponse.json({ cached: false, extraction_id: extractionId }, { status: 202 });
}

async function processExtraction(
  extractionId: string,
  userId: string,
  files: File[],
  supabase: ReturnType<typeof import('@/lib/supabase/server').createClient>
) {
  try {
    // Upload images to Supabase Storage + convert to base64 for OCR
    const imageUrls: string[] = [];
    const imagesForOcr: Array<{ base64: string; mimeType: string }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.type.split('/')[1];
      const storagePath = `${userId}/${extractionId}/${i}.${ext}`;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('carousel-images')
        .upload(storagePath, buffer, { contentType: file.type, upsert: false });

      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

      // Get signed URL (private bucket)
      const { data: urlData } = await supabase.storage
        .from('carousel-images')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 year

      if (urlData) imageUrls.push(urlData.signedUrl);

      // Prepare base64 for OCR
      imagesForOcr.push({
        base64: buffer.toString('base64'),
        mimeType: file.type,
      });
    }

    // Run OCR
    const rawOcrText = await extractTextFromCarousel(imagesForOcr);

    if (rawOcrText.trim().length < 50) {
      await supabase
        .from('extractions')
        .update({
          status: 'error',
          error_message: 'Could not extract enough text from images. Ensure images contain readable text.',
        })
        .eq('id', extractionId);
      return;
    }

    // Run LLM extraction
    const output = await extractKnowledge(rawOcrText);

    // Update row to done
    await supabase
      .from('extractions')
      .update({
        status: 'done',
        title: output.main_topic,
        raw_ocr_text: rawOcrText,
        image_urls: imageUrls,
        output,
      })
      .eq('id', extractionId);

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await supabase
      .from('extractions')
      .update({ status: 'error', error_message: message })
      .eq('id', extractionId);
  }
}
```

### `app/api/extractions/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('extractions')
    .select('id, title, status, created_at, output')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = (data ?? []).map(row => ({
    id: row.id,
    title: row.title,
    status: row.status,
    created_at: row.created_at,
    main_topic: row.output?.main_topic ?? '',
    tags: row.output?.tags ?? [],
  }));

  return NextResponse.json({ extractions: items });
}
```

### `app/api/extractions/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('extractions')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Extraction not found' }, { status: 404 });
  }

  return NextResponse.json({ extraction: data });
}
```

---

## Step 9 — Create UI components

### `components/ui/Spinner.tsx`
```typescript
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  return (
    <svg
      className={`${sizes[size]} animate-spin text-current`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}
```

### `components/ui/Button.tsx`
```typescript
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { Spinner } from './Spinner';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', isLoading, disabled, children, className = '', ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
    const variants = {
      primary: 'bg-gray-900 text-white hover:bg-gray-700 active:bg-gray-800',
      secondary: 'border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 active:bg-gray-100',
      ghost: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
    };
    const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {isLoading && <Spinner size="sm" />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
```

### `components/ui/Card.tsx`
```typescript
import { HTMLAttributes } from 'react';

export function Card({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-white border border-gray-200 rounded-xl p-5 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
```

### `components/ui/Badge.tsx`
```typescript
const colorMap: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-800',
  purple: 'bg-purple-100 text-purple-800',
  green: 'bg-green-100 text-green-800',
  gray: 'bg-gray-100 text-gray-700',
  orange: 'bg-orange-100 text-orange-800',
  teal: 'bg-teal-100 text-teal-800',
  red: 'bg-red-100 text-red-800',
  yellow: 'bg-yellow-100 text-yellow-800',
};

export function Badge({ color = 'gray', children }: { color?: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorMap[color] ?? colorMap.gray}`}>
      {children}
    </span>
  );
}
```

---

## Step 10 — Create the Navbar

### `components/Navbar.tsx`

'use client' component. Uses `createClient()` from `lib/supabase/client.ts`. Shows different nav based on auth state. On sign-out, call `supabase.auth.signOut()` then `router.push('/')`.

Desktop: Logo left | "Library" + "Extract" links + user email (truncated to 20 chars + "...") + Sign out button right.

Mobile: Logo left | hamburger right (toggles a dropdown with the same links, no animation needed).

Sticky top, `bg-white border-b border-gray-200 z-50`.

---

## Step 11 — Create the UploadZone component

### `components/UploadZone.tsx`

'use client' component.

Props:
```typescript
interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}
```

Implement:
- Large dashed border drop zone, `min-h-[200px]`, centered content
- Text: "Drop carousel screenshots here" + "or click to select files" below
- Sub-text: "JPEG, PNG, WEBP · Up to 10 slides · 5MB each"
- On `dragover`: change border to `border-gray-900`, background to `bg-gray-50`
- On `dragleave` and `drop`: reset styling
- On file selection (drop or picker): filter to allowed types, show alert for rejections, enforce maxFiles
- After valid selection: show a horizontal scrollable row of thumbnail previews with filename below each
- Use `URL.createObjectURL()` for thumbnails, revoke on unmount with `useEffect` cleanup
- Hidden `<input type="file" accept="image/jpeg,image/png,image/webp" multiple />` triggered on click

---

## Step 12 — Create pages

### `app/layout.tsx`

Root layout. Import `Inter` font from `next/font/google`. Render `<Navbar />` above `{children}`. Set `<html lang="en">`. Background: `bg-gray-50`.

### `app/page.tsx` — Landing page

Server component. Check session server-side. If logged in, add a "Go to dashboard" link in the hero instead of the sign-up CTA.

Structure (no card wrappers — full-width sections):

**Section 1 — Hero**
Max-width 600px centered, lots of vertical padding (`py-24`).
- Headline: `text-4xl font-bold text-gray-900 leading-tight` — "Turn Instagram carousels into structured knowledge"
- Subheadline: `text-lg text-gray-600 mt-4` — "Upload educational carousel screenshots. Get a clean summary, actionable steps, and an organized knowledge page — in seconds."
- CTA button → `/extract`: "Start extracting for free →" (primary, lg)

**Section 2 — How it works**
Gray background `bg-white border-t border-gray-100 py-16`. Heading: "How it works". Three steps side by side on desktop, stacked on mobile. Use emoji icons: 📤 Upload, 🔍 AI reads, 📄 You get structure.

**Section 3 — Example output preview**
Max-width 640px centered, `py-16`. Heading: "What you'll get". A static mockup card showing fake extraction output for "AI Engineer Roadmap 2025" — fake summary, 3 fake key insights, 3 fake action steps, 3 fake tags. Use the same visual style as the real result page. Mark it with a subtle "Example" badge.

**Footer**: `py-8 text-center text-sm text-gray-400` — "CarouselBrain · Turn social media into your second brain"

### `app/auth/login/page.tsx`

Centered card, max-width 400px.
Title: "Sign in to CarouselBrain"
Subtitle: "Enter your email and we'll send you a magic link."
Email input + "Send magic link" button.
On submit: call `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + '/auth/callback' } })`.
On success: show "Check your inbox for a login link. You can close this tab."
On error: show inline error message in red.
This is a 'use client' component.

### `app/auth/callback/route.ts`

Standard Supabase PKCE callback:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  if (code) {
    const supabase = createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(`${origin}/dashboard`);
}
```

### `app/extract/page.tsx`

Protected route — check session server-side, redirect to `/auth/login` if not logged in.

'use client' component (needs state for files, upload status, polling).

State: `files: File[]`, `status: 'idle' | 'uploading' | 'processing' | 'error'`, `errorMessage: string | null`, `extractionId: string | null`.

Layout: max-width 640px centered, `py-12`.
Title: "Extract knowledge from a carousel"
Subtitle: "Upload 1–10 screenshots in slide order. The AI will read them left to right."

Render `<UploadZone onFilesSelected={setFiles} maxFiles={10} disabled={status !== 'idle'} />`.

Below: file count display `"{n} slide{s} selected"` (hidden when 0 files).

Extract button: disabled when `files.length === 0 || status !== 'idle'`. On click:

1. Set status to 'uploading'
2. Build FormData, append each file as `images`
3. POST to `/api/extract`
4. If response is cached or 202: set `extractionId` from response, set status to 'processing'
5. If cached result: navigate directly to `/result/{extraction_id}`
6. If 202: start polling `/api/extractions/{extraction_id}` every 2000ms
7. When polled status is 'done': navigate to `/result/{extraction_id}`
8. When polled status is 'error': show error message, reset to idle

Processing state UI: show a spinner + "Reading your slides..." text. Do not show the upload zone during processing.

Error state: show error message in a red box with a "Try again" button that resets state.

### `app/dashboard/page.tsx`

Protected route — check session server-side.

'use client' for data fetching. Fetch `/api/extractions` on mount.

Title: "Your knowledge library"
Right-aligned: "New extraction →" button → `/extract`

Loading state: show 6 skeleton cards (gray rounded rectangles, pulsing with `animate-pulse`).

Empty state: centered, `py-24`. Text: "Your library is empty." Subtext: "Upload your first carousel to start building your knowledge base." + "Extract now →" button.

Extraction grid: `grid grid-cols-1 sm:grid-cols-2 gap-4`. Map over extractions, render `<ExtractionCard extraction={item} />` for each.

### `components/ExtractionCard.tsx`

'use client' — wraps everything in `<Link href={/result/${extraction.id}}>`.

Card style: `bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-400 hover:shadow-sm transition-all cursor-pointer block`.

Content:
- Status badge top-right: green "Done" / yellow "Processing" / red "Error" (use `Badge` component)
- Title: `extraction.main_topic || extraction.title || 'Untitled'` — bold, 1 line truncated
- Summary: first 100 chars of `extraction.summary` if `status === 'done'`, else "Processing..." — muted, 2 lines
- Tags row: show up to 3 tags as gray badges, then "+N more" if there are more
- Date: relative time — "2 days ago", "just now", "3 months ago" — computed in JS without any library

For relative time, implement a simple function:
```typescript
function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
```

### `app/result/[id]/page.tsx`

Protected route. Fetch extraction server-side using Supabase server client. If not found or not owned by user, redirect to `/dashboard`.

If `status !== 'done'`: show a centered message "This extraction is still processing..." with a link back to dashboard.

Full result layout, max-width 768px centered, `py-10`:

**Page header**:
- `← Library` link back to `/dashboard` (small, muted)
- Title: `output.main_topic` — `text-3xl font-bold text-gray-900`
- Tags row: map `output.tags` to `<Badge color="gray">` components
- Date: extracted X days ago
- Copy-link button (client component): copies `window.location.href` to clipboard, shows "Copied!" for 2 seconds

**Section: Overview** (always render)
Gray card `bg-gray-50 rounded-xl p-6`.
Label: `text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2` → "Overview"
Content: `output.summary` — `text-gray-700 leading-relaxed`

**Section: Key Insights** (render if array non-empty)
Label: "Key Insights"
Numbered list: `ol` with `list-none`. Each item: number circle `bg-gray-900 text-white rounded-full w-6 h-6` + text. Left border accent `border-l-2 border-gray-200 pl-4`.

**Section: Action Steps** (render if array non-empty)
Label: "Action Steps"
Each step: checkmark "✓" in `text-green-600` + text. Make the first word of each step bold (split on first space, wrap first word in `<strong>`).

**Section: Resources & Tools** (render if array non-empty)
Label: "Resources & Tools"
Two-column grid on desktop. Each resource card: `bg-white border border-gray-200 rounded-lg p-4`.
- Resource type badge with color: book=blue, tool=purple, course=green, link=gray, person=orange, framework=teal
- Name: bold
- Description: muted small text
- URL: if present, show as external link → opens in new tab, with "↗" arrow

**Section: Concepts Explained** (render if `concepts.length > 0`)
Label: "Concepts Explained"
`dl` definition list. `dt`: term in bold + `dd`: definition in muted text. Dividers between items `border-b border-gray-100`.

**Section: Learning Path** (render if `learning_path.length > 0`)
Label: "Learning Path"
Vertical stepper: numbered circles connected by a thin vertical line `w-0.5 bg-gray-200`. Each step: number circle + step text. Last step has no connecting line.

**Bottom CTA**: `mt-12 pt-8 border-t border-gray-100 text-center`
"Extract another carousel →" button → `/extract`

---

## Step 13 — Verify and finalize

After creating all files:

1. Run `npm run typecheck` — fix every TypeScript error. There should be zero errors.
2. Run `npm run build` — production build must succeed with zero errors and zero warnings.
3. Do NOT start the dev server.
4. Do NOT fill in real API keys — leave `.env.local` as placeholders.
5. Do NOT add any packages beyond what was installed in Step 1.

After the build succeeds, print this setup checklist:

```
========================================
 CarouselBrain — Setup Checklist
========================================

Before running locally:

[ ] 1. Create a Supabase project at supabase.com (free tier)
[ ] 2. Copy Project URL and anon key → paste into .env.local
[ ] 3. Copy Service Role key → paste into .env.local (keep this secret)
[ ] 4. Run supabase/migrations/001_initial.sql in the Supabase SQL editor
[ ] 5. Create a storage bucket named exactly: carousel-images
         Set it to PRIVATE (not public)
[ ] 6. Get a free OCR.space API key at ocr.space/ocrapi
         Free tier: 500 requests/month — enough for testing
[ ] 7. Get a free Groq API key at console.groq.com
         Free tier: very generous, ~enough for hundreds of extractions/day
[ ] 8. Fill in all 5 values in .env.local

To run locally:
  npm run dev
  Open http://localhost:3000

To test the full flow:
  1. Sign in with your email (check inbox for magic link)
  2. Go to /extract
  3. Upload 2-3 screenshots from an educational Instagram post
  4. Wait ~15 seconds for processing
  5. Review the structured output at /result/[id]

To deploy to Vercel:
  npx vercel --prod
  (Add all .env.local variables as Environment Variables in Vercel dashboard)

========================================
```
