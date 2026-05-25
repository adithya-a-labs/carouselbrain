import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/server';

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main>
      <section className="mx-auto max-w-[600px] px-4 py-24 text-center">
        <h1 className="text-4xl font-bold leading-tight text-gray-900">
          Turn Instagram carousels into structured knowledge
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          Upload educational carousel screenshots. Get a clean summary, actionable steps, and an
          organized knowledge page — in seconds.
        </p>
        <Link
          href={user ? '/dashboard' : '/extract'}
          className="mt-8 inline-flex rounded-lg bg-gray-900 px-6 py-3 text-base font-medium text-white hover:bg-gray-700"
        >
          {user ? 'Go to dashboard' : 'Start extracting for free →'}
        </Link>
      </section>

      <section className="border-t border-gray-100 bg-white py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center text-2xl font-bold text-gray-900">How it works</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              ['📤', 'Upload', 'Add 1-10 screenshots from an educational carousel.'],
              ['🔍', 'AI reads', 'OCR extracts the text and the LLM structures the ideas.'],
              ['📄', 'You get structure', 'Review a clean knowledge page with steps, concepts, and tags.'],
            ].map(([icon, title, text]) => (
              <div key={title} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-xl">
                  {icon}
                </div>
                <h3 className="mt-4 font-semibold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[640px] px-4 py-16">
        <h2 className="text-center text-2xl font-bold text-gray-900">What you'll get</h2>
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-xl font-bold text-gray-900">AI Engineer Roadmap 2025</h3>
            <Badge>Example</Badge>
          </div>
          <p className="mt-4 leading-7 text-gray-700">
            A practical roadmap for becoming an AI engineer, covering foundations, model tooling,
            deployment habits, and portfolio projects.
          </p>
          <h4 className="mt-6 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Key Insights
          </h4>
          <ul className="mt-3 space-y-2 text-sm text-gray-700">
            <li>Strong Python and data fundamentals make advanced AI work easier to debug.</li>
            <li>Shipping small model-backed projects is more valuable than collecting courses.</li>
            <li>Understanding evaluation helps separate demos from reliable systems.</li>
          </ul>
          <h4 className="mt-6 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Action Steps
          </h4>
          <ul className="mt-3 space-y-2 text-sm text-gray-700">
            <li>Build a retrieval app using one focused dataset.</li>
            <li>Document model tradeoffs in every portfolio project.</li>
            <li>Practice deploying a small API with monitoring notes.</li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-2">
            {['ai-engineering', 'career', 'python'].map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
        </div>
      </section>

      <footer className="py-8 text-center text-sm text-gray-400">
        CarouselBrain · Turn social media into your second brain
      </footer>
    </main>
  );
}
