import type { Concept, ExtractionOutput, Resource, ResourceType } from '@/lib/types';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const RESOURCE_TYPES: ResourceType[] = ['book', 'tool', 'course', 'link', 'person', 'framework'];

const SYSTEM_PROMPT = `You are a knowledge extraction specialist. Analyze OCR-extracted text from educational social media carousels and transform it into structured, actionable knowledge.

Respond with valid JSON only. No preamble, no markdown fences, no explanation. Just the raw JSON object.

Required schema:
{
  "main_topic": "core subject of the carousel",
  "summary": "2-3 sentence plain-English summary for someone who hasn't seen it",
  "key_insights": ["3-7 complete, useful sentences - the most important ideas"],
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
- If OCR text is noisy, infer meaning from context - do not refuse to answer.
- If the carousel is shallow or motivational rather than educational, say so briefly in the summary.`;

interface GroqResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function normalizeResources(value: unknown): Resource[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item): Resource[] => {
    if (!isRecord(item)) {
      return [];
    }

    const type = stringValue(item.type);

    return [
      {
        name: stringValue(item.name, 'Untitled resource'),
        type: RESOURCE_TYPES.includes(type as ResourceType) ? (type as ResourceType) : 'link',
        url: typeof item.url === 'string' ? item.url : null,
        description: stringValue(item.description),
      },
    ];
  });
}

function normalizeConcepts(value: unknown): Concept[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item): Concept[] => {
    if (!isRecord(item)) {
      return [];
    }

    return [
      {
        term: stringValue(item.term),
        definition: stringValue(item.definition),
      },
    ];
  });
}

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
    throw new Error(`Groq API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as GroqResponse;
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Empty response from Groq');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    throw new Error(`Failed to parse Groq response: ${content.slice(0, 200)}`);
  }

  if (!isRecord(parsed)) {
    throw new Error('Groq response was not a JSON object');
  }

  return {
    main_topic: stringValue(parsed.main_topic, 'Untitled'),
    summary: stringValue(parsed.summary),
    key_insights: stringArray(parsed.key_insights),
    action_steps: stringArray(parsed.action_steps),
    resources: normalizeResources(parsed.resources),
    concepts: normalizeConcepts(parsed.concepts),
    learning_path: stringArray(parsed.learning_path),
    tags: stringArray(parsed.tags),
  };
}
