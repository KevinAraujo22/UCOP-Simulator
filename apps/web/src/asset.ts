import { useEffect, useState } from 'react';
import { apiUrl, getApiBase, getStoredToken } from './api';

const cache = new Map<string, Promise<string>>();

/**
 * URL utilizável numa <img> para um arquivo do servidor (/uploads/...).
 * No site, os uploads chegam pelo cookie de sessão; no app de celular (servidor em outro
 * endereço) baixa a imagem com o token no cabeçalho e devolve uma URL local (blob:).
 */
export function useAssetUrl(url: string | null | undefined): string | null {
  const remote = !!getApiBase();
  const [resolved, setResolved] = useState<string | null>(remote ? null : (url ?? null));
  useEffect(() => {
    if (!url) {
      setResolved(null);
      return;
    }
    if (!remote || !url.startsWith('/uploads/')) {
      setResolved(url);
      return;
    }
    let alive = true;
    let pending = cache.get(url);
    if (!pending) {
      pending = fetch(apiUrl(url), { headers: { Authorization: `Bearer ${getStoredToken() ?? ''}` } })
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((b) => URL.createObjectURL(b));
      pending.catch(() => cache.delete(url!));
      cache.set(url, pending);
    }
    pending.then((u) => alive && setResolved(u)).catch(() => alive && setResolved(null));
    return () => {
      alive = false;
    };
  }, [url, remote]);
  return resolved;
}
