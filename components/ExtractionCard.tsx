'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import type { ExtractionListItem, ExtractionStatus } from '@/lib/types';

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

function statusColor(status: ExtractionStatus): string {
  if (status === 'done') return 'green';
  if (status === 'error') return 'red';
  return 'yellow';
}

function statusLabel(status: ExtractionStatus): string {
  if (status === 'done') return 'Done';
  if (status === 'error') return 'Error';
  return 'Processing';
}

export function ExtractionCard({ extraction }: { extraction: ExtractionListItem }) {
  const tags = extraction.tags.slice(0, 3);
  const extraTags = extraction.tags.length - tags.length;
  const summary =
    extraction.status === 'done' && extraction.summary
      ? `${extraction.summary.slice(0, 100)}${extraction.summary.length > 100 ? '...' : ''}`
      : extraction.status === 'error'
        ? 'Extraction failed.'
        : 'Processing...';

  return (
    <Link
      href={`/result/${extraction.id}`}
      className="block cursor-pointer rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-gray-400 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="truncate font-semibold text-gray-900">
          {extraction.main_topic || extraction.title || 'Untitled'}
        </h2>
        <Badge color={statusColor(extraction.status)}>{statusLabel(extraction.status)}</Badge>
      </div>
      <p className="mt-2 line-clamp-2 min-h-10 text-sm text-gray-600">{summary}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Badge key={tag} color="gray">
            {tag}
          </Badge>
        ))}
        {extraTags > 0 && <Badge color="gray">+{extraTags} more</Badge>}
      </div>
      <p className="mt-4 text-xs text-gray-400">{relativeTime(extraction.created_at)}</p>
    </Link>
  );
}
