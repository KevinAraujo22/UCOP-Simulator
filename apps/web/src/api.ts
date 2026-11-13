const TOKEN_KEY = 'ucop.token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // armazenamento indisponível: segue só em memória
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  form?: FormData;
}

/** Chamada à API REST com o token JWT atual. */
export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(path, { method: opts.method ?? (body ? 'POST' : 'GET'), headers, body });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `Erro ${res.status}`);
  return data as T;
}

/** Envia uma imagem para a campanha e devolve a URL em /uploads. */
export async function uploadImage(campaignId: string, file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const { url } = await api<{ url: string }>(`/api/campaigns/${campaignId}/uploads`, { form });
  return url;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
