'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { UploadZone } from '@/components/UploadZone';
import type { Extraction } from '@/lib/types';

type ExtractStatus = 'idle' | 'uploading' | 'processing' | 'error';

interface ExtractResponse {
  cached?: boolean;
  extraction_id?: string;
  error?: string;
}

interface PollResponse {
  extraction?: Extraction;
  error?: string;
}

export function ExtractClient() {
  const router = useRouter();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<ExtractStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [extractionId, setExtractionId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, []);

  function reset() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setFiles([]);
    setStatus('idle');
    setErrorMessage(null);
    setExtractionId(null);
  }

  function startPolling(id: string) {
    pollRef.current = setInterval(async () => {
      const response = await fetch(`/api/extractions/${id}`);
      const data = (await response.json()) as PollResponse;

      if (!response.ok || !data.extraction) {
        setStatus('error');
        setErrorMessage(data.error ?? 'Could not check extraction status.');
        if (pollRef.current) {
          clearInterval(pollRef.current);
        }
        return;
      }

      if (data.extraction.status === 'done') {
        if (pollRef.current) {
          clearInterval(pollRef.current);
        }
        router.push(`/result/${id}`);
      }

      if (data.extraction.status === 'error') {
        setStatus('error');
        setErrorMessage(data.extraction.error_message ?? 'Extraction failed.');
        if (pollRef.current) {
          clearInterval(pollRef.current);
        }
      }
    }, 2000);
  }

  async function submit() {
    setStatus('uploading');
    setErrorMessage(null);

    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));

    const response = await fetch('/api/extract', {
      method: 'POST',
      body: formData,
    });
    const data = (await response.json()) as ExtractResponse;

    if (!response.ok || !data.extraction_id) {
      setStatus('error');
      setErrorMessage(data.error ?? 'Failed to start extraction.');
      return;
    }

    setExtractionId(data.extraction_id);

    if (data.cached) {
      router.push(`/result/${data.extraction_id}`);
      return;
    }

    setStatus('processing');
    startPolling(data.extraction_id);
  }

  return (
    <main className="mx-auto max-w-[640px] px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900">Extract knowledge from a carousel</h1>
      <p className="mt-2 text-gray-600">
        Upload 1-10 screenshots in slide order. The AI will read them left to right.
      </p>

      {status === 'processing' ? (
        <div className="mt-10 flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-16 text-center">
          <Spinner size="lg" />
          <p className="mt-4 font-medium text-gray-900">Reading your slides...</p>
          {extractionId && <p className="mt-2 text-xs text-gray-400">Extraction ID: {extractionId}</p>}
        </div>
      ) : (
        <div className="mt-8">
          <UploadZone
            onFilesSelected={setFiles}
            maxFiles={10}
            disabled={status !== 'idle' && status !== 'error'}
          />

          {files.length > 0 && (
            <p className="mt-4 text-sm text-gray-600">
              {files.length} slide{files.length === 1 ? '' : 's'} selected
            </p>
          )}

          {status === 'error' && errorMessage && (
            <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
              <p>{errorMessage}</p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={reset}>
                Try again
              </Button>
            </div>
          )}

          <Button
            className="mt-6"
            size="lg"
            isLoading={status === 'uploading'}
            disabled={files.length === 0 || status !== 'idle'}
            onClick={submit}
          >
            Extract knowledge
          </Button>
        </div>
      )}
    </main>
  );
}
