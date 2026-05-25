import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { extractKnowledge } from '@/lib/groq';
import { extractTextFromCarousel } from '@/lib/ocr';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILES = 10;

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const files = formData.getAll('images').filter((item): item is File => item instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: 'No images provided' }, { status: 400 });
  }

  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Maximum ${MAX_FILES} images allowed` }, { status: 400 });
  }

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

  const hashInput = files
    .map((file) => `${file.name}:${file.size}`)
    .sort()
    .join(',');
  const contentHash = createHash('sha256').update(hashInput).digest('hex');

  const { data: cached } = await supabase
    .from('extractions')
    .select('id')
    .eq('content_hash', contentHash)
    .eq('status', 'done')
    .single();

  if (cached) {
    return NextResponse.json({ cached: true, extraction_id: cached.id }, { status: 200 });
  }

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

  const extractionId = extraction.id as string;

  // TODO: rate limit before launch
  processExtraction(extractionId, user.id, files, supabase).catch((error: unknown) => {
    console.error(error);
  });

  return NextResponse.json({ cached: false, extraction_id: extractionId }, { status: 202 });
}

async function processExtraction(
  extractionId: string,
  userId: string,
  files: File[],
  supabase: ReturnType<typeof createClient>
) {
  try {
    const imageUrls: string[] = [];
    const imagesForOcr: Array<{ base64: string; mimeType: string }> = [];

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const ext = file.type.split('/')[1] ?? 'jpg';
      const storagePath = `${userId}/${extractionId}/${i}.${ext}`;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from('carousel-images')
        .upload(storagePath, buffer, { contentType: file.type, upsert: false });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      const { data: urlData } = await supabase.storage
        .from('carousel-images')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

      if (urlData) {
        imageUrls.push(urlData.signedUrl);
      }

      imagesForOcr.push({
        base64: buffer.toString('base64'),
        mimeType: file.type,
      });
    }

    const rawOcrText = await extractTextFromCarousel(imagesForOcr);

    if (rawOcrText.trim().length < 50) {
      await supabase
        .from('extractions')
        .update({
          status: 'error',
          error_message:
            'Could not extract enough text from images. Ensure images contain readable text.',
        })
        .eq('id', extractionId);
      return;
    }

    const output = await extractKnowledge(rawOcrText);

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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await supabase
      .from('extractions')
      .update({ status: 'error', error_message: message })
      .eq('id', extractionId);
  }
}
