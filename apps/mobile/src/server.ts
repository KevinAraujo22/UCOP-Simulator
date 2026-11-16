import { setApiBase } from '@web/api';

const SERVER_KEY = 'ucop.server';

/** Endereço do servidor salvo no aparelho (ex.: https://xxxx.trycloudflare.com). */
export function getSavedServer(): string | null {
  try {
    return localStorage.getItem(SERVER_KEY);
  } catch {
    return null;
  }
}

export function saveServer(url: string | null): void {
  try {
    if (url) localStorage.setItem(SERVER_KEY, url);
    else localStorage.removeItem(SERVER_KEY);
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
  setApiBase(url ?? '');
}

/** Normaliza o que a pessoa digitou: tira espaços e barras finais, completa o protocolo. */
export function normalizeServer(input: string): string {
  let url = input.trim().replace(/\/+$/, '');
  if (url && !/^https?:\/\//i.test(url)) {
    // IPs e "localhost" da rede local costumam ser http; o resto (túnel), https.
    url = /^(\d{1,3}(\.\d{1,3}){3}|localhost)(:\d+)?$/i.test(url) ? `http://${url}` : `https://${url}`;
  }
  return url;
}

/** Confere se o endereço responde como um servidor do UCOP. */
export async function probeServer(url: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${url}/api/health`, { signal: controller.signal });
    const body = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    if (!res.ok || !body?.ok) throw new Error('O endereço respondeu, mas não parece ser uma mesa do UCOP.');
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw new Error('O servidor não respondeu a tempo.');
    if (err instanceof TypeError) throw new Error('Não foi possível conectar. Confira o endereço e se a mesa está aberta.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
