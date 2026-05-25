'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ExtractionCard } from '@/components/ExtractionCard';
import type { ExtractionListItem } from '@/lib/types';

interface ExtractionsResponse {
  extractions?: ExtractionListItem[];
  error?: string;
}

export function DashboardClient() {
  const [items, setItems] = useState<ExtractionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const response = await fetch('/api/extractions');
      const data = (await response.json()) as ExtractionsResponse;

      if (!response.ok) {
        setError(data.error ?? 'Failed to load extractions.');
      } else {
        setItems(data.extractions ?? []);
      }

      setIsLoading(false);
    }

    load().catch(() => {
      setError('Failed to load extractions.');
      setIsLoading(false);
    });
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Your knowledge library</h1>
        <Link
          href="/extract"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          New extraction →
        </Link>
      </div>

      {isLoading && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-40 animate-pulse rounded-xl border border-gray-200 bg-gray-100"
            />
          ))}
        </div>
      )}

      {!isLoading && error && (
        <div className="mt-8 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {!isLoading && !error && items.length === 0 && (
        <div className="py-24 text-center">
          <h2 className="text-xl font-semibold text-gray-900">Your library is empty.</h2>
          <p className="mt-2 text-gray-600">
            Upload your first carousel to start building your knowledge base.
          </p>
          <Link
            href="/extract"
            className="mt-6 inline-flex rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Extract now →
          </Link>
        </div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <ExtractionCard key={item.id} extraction={item} />
          ))}
        </div>
      )}
    </main>
  );
}
