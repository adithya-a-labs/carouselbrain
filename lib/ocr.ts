const OCR_API_URL = 'https://api.ocr.space/parse/image';

interface OcrParsedResult {
  ParsedText?: string;
}

interface OcrResponse {
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string | string[];
  ParsedResults?: OcrParsedResult[];
}

function formatOcrError(error: string | string[] | undefined): string {
  if (Array.isArray(error)) {
    return error.join(', ');
  }

  return error ?? 'Unknown OCR processing error';
}

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

  const data = (await response.json()) as OcrResponse;

  if (data.IsErroredOnProcessing) {
    throw new Error(`OCR processing error: ${formatOcrError(data.ErrorMessage)}`);
  }

  return (
    data.ParsedResults?.map((result) => result.ParsedText ?? '').join('\n\n') ?? ''
  ).trim();
}

export async function extractTextFromCarousel(
  images: Array<{ base64: string; mimeType: string }>
): Promise<string> {
  const results: string[] = [];

  for (let i = 0; i < images.length; i += 1) {
    const image = images[i];
    const text = await extractTextFromImage(image.base64, image.mimeType);

    if (text) {
      results.push(`--- SLIDE ${i + 1} ---\n${text}`);
    }
  }

  return results.join('\n\n');
}
