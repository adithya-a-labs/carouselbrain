import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import type { Extraction, ResourceType } from '@/lib/types';

const resourceColors: Record<ResourceType, string> = {
  book: 'blue',
  tool: 'purple',
  course: 'green',
  link: 'gray',
  person: 'orange',
  framework: 'teal',
};

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

function FirstWordBold({ text }: { text: string }) {
  const firstSpace = text.indexOf(' ');

  if (firstSpace === -1) {
    return <strong>{text}</strong>;
  }

  return (
    <>
      <strong>{text.slice(0, firstSpace)}</strong>
      {text.slice(firstSpace)}
    </>
  );
}

export function ResultPage({ extraction }: { extraction: Extraction }) {
  const output = extraction.output;

  return (
    <main className="mx-auto max-w-[768px] px-4 py-10">
      <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">
        ← Library
      </Link>

      <div className="mt-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{output.main_topic}</h1>
          <div className="mt-4 flex flex-wrap gap-2">
            {output.tags.map((tag) => (
              <Badge key={tag} color="gray">
                {tag}
              </Badge>
            ))}
          </div>
          <p className="mt-3 text-sm text-gray-400">Extracted {relativeTime(extraction.created_at)}</p>
        </div>
        <CopyLinkButton />
      </div>

      <section className="mt-8 rounded-xl bg-gray-50 p-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Overview
        </h2>
        <p className="leading-relaxed text-gray-700">{output.summary}</p>
      </section>

      {output.key_insights.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Key Insights
          </h2>
          <ol className="list-none space-y-4 border-l-2 border-gray-200 pl-4">
            {output.key_insights.map((insight, index) => (
              <li key={insight} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <p className="text-gray-700">{insight}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {output.action_steps.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Action Steps
          </h2>
          <div className="space-y-3">
            {output.action_steps.map((step) => (
              <div key={step} className="flex gap-3 text-gray-700">
                <span className="font-semibold text-green-600">✓</span>
                <p>
                  <FirstWordBold text={step} />
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {output.resources.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Resources & Tools
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {output.resources.map((resource) => (
              <div key={`${resource.type}-${resource.name}`} className="rounded-lg border border-gray-200 bg-white p-4">
                <Badge color={resourceColors[resource.type]}>{resource.type}</Badge>
                <h3 className="mt-3 font-semibold text-gray-900">{resource.name}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">{resource.description}</p>
                {resource.url && (
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex text-sm font-medium text-gray-900 hover:text-gray-600"
                  >
                    Open ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {output.concepts.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Concepts Explained
          </h2>
          <dl className="rounded-xl bg-white">
            {output.concepts.map((concept) => (
              <div key={concept.term} className="border-b border-gray-100 py-4 last:border-0">
                <dt className="font-semibold text-gray-900">{concept.term}</dt>
                <dd className="mt-1 text-sm leading-6 text-gray-600">{concept.definition}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {output.learning_path.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Learning Path
          </h2>
          <div>
            {output.learning_path.map((step, index) => (
              <div key={step} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  {index < output.learning_path.length - 1 && <span className="h-8 w-0.5 bg-gray-200" />}
                </div>
                <p className="pb-6 text-gray-700">{step}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-12 border-t border-gray-100 pt-8 text-center">
        <Link
          href="/extract"
          className="inline-flex rounded-lg bg-gray-900 px-6 py-3 text-base font-medium text-white hover:bg-gray-700"
        >
          Extract another carousel →
        </Link>
      </div>
    </main>
  );
}
