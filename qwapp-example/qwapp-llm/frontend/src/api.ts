export interface FamilySummary {
  name: string;
  label: string;
  author: string;
}

export interface ModelSummary {
  id: string;
  variant: string;
  downloads: number;
  likes: number;
  parameters: number | null;
  gated: string | null;
  createdAt: string | null;
  lastModified: string | null;
}

export interface FamilyModels extends FamilySummary {
  models: ModelSummary[];
}

export interface ModelDetail {
  id: string;
  author: string;
  variant: string;
  task: string | null;
  library: string | null;
  license: string | null;
  baseModels: string[];
  languages: string[];
  downloads: number;
  likes: number;
  parameters: number | null;
  gated: string | null;
  createdAt: string | null;
  lastModified: string | null;
  files: string[];
  spaces: string[];
}

export interface FamilyModel {
  family: string;
  familyLabel: string;
  model: ModelDetail;
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`/api/llm/families${path}`);
  if (!response.ok) {
    throw new Error(response.status === 404 ? 'Not found' : `Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

export const loadFamilies = () => get<FamilySummary[]>('');
export const loadFamily = (name: string) => get<FamilyModels>(`/${encodeURIComponent(name)}`);
export const loadModel = (name: string, variant: string) =>
  get<FamilyModel>(`/${encodeURIComponent(name)}/${encodeURIComponent(variant)}`);

/** The id of a model view is `family/variant`; a variant has no slash. */
export const modelViewId = (family: string, variant: string) => `${family}/${variant}`;

export function parseModelViewId(id: string): { family: string; variant: string } {
  const slash = id.indexOf('/');
  return { family: id.substring(0, slash), variant: id.substring(slash + 1) };
}

const numbers = new Intl.NumberFormat('en');

export const formatCount = (count: number) => numbers.format(count);

export function formatParameters(parameters: number | null): string {
  if (parameters === null) {
    return '–';
  }
  return parameters >= 1e9 ? `${(parameters / 1e9).toFixed(1)}B` : `${Math.round(parameters / 1e6)}M`;
}

export const formatDate = (date: string | null) => (date ? date.substring(0, 10) : '–');
