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
  summary: string;
  tags: string[];
}
