import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Sheet, SheetData } from '@ucop/shared';
import { uploadImage } from '../../api';
import { useAssetUrl } from '../../asset';
import { useGame } from '../../game';

const SAVE_DELAY = 500;

/**
 * Cópia local editável da ficha. Cada alteração marca a seção (chave de 1º
 * nível) como pendente e envia só as seções alteradas após uma pausa curta.
 * Atualizações do servidor só sobrescrevem a cópia local quando não há envio pendente.
 */
export function useSheetEditor<T extends SheetData>(sheet: Sheet) {
  const { socket, flash } = useGame();
  const [data, setData] = useState<T>(sheet.data as T);
  const pending = useRef<Partial<T>>({});
  const timer = useRef<number | null>(null);
  const latest = useRef(data);
  latest.current = data;

  useEffect(() => {
    if (timer.current === null && Object.keys(pending.current).length === 0) setData(sheet.data as T);
  }, [sheet.data, sheet.updatedAt]);

  const flush = useCallback(() => {
    timer.current = null;
    const patch = pending.current;
    pending.current = {};
    if (!Object.keys(patch).length) return;
    socket.emit('sheet:update', { id: sheet.id, patch }, (res) => {
      if (!res.ok) flash(res.error);
    });
  }, [socket, sheet.id, flash]);

  // Ao fechar a ficha, envia o que estiver pendente.
  useEffect(
    () => () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        flush();
      }
    },
    [flush],
  );

  const set = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      setData((d) => ({ ...d, [key]: value }));
      pending.current = { ...pending.current, [key]: value };
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, SAVE_DELAY);
    },
    [flush],
  );

  /** Atualiza campos dentro de uma seção-objeto (ex.: attributes.agi). */
  const setIn = useCallback(
    <K extends keyof T>(key: K, partial: Partial<T[K]>) => {
      set(key, { ...(latest.current[key] as object), ...(partial as object) } as T[K]);
    },
    [set],
  );

  return { data, set, setIn };
}

export function newId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ---------------------------------------------------------------------------
// Campos
// ---------------------------------------------------------------------------
export function Num({
  value,
  onChange,
  min,
  max,
  className = '',
  title,
  disabled,
}: {
  value: number;
  onChange(v: number): void;
  min?: number;
  max?: number;
  className?: string;
  title?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText(String(value));
  }, [value]);
  return (
    <input
      className={`num ${className}`}
      inputMode="numeric"
      value={text}
      title={title}
      aria-label={title}
      disabled={disabled}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value.trim() !== '' && Number.isFinite(n)) {
          const clamped = Math.round(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n)));
          onChange(clamped);
        }
      }}
      onBlur={() => setText(String(value))}
    />
  );
}

export function Txt({
  value,
  onChange,
  placeholder,
  className = '',
  label,
  maxLength,
  disabled,
}: {
  value: string;
  onChange(v: string): void;
  placeholder?: string;
  className?: string;
  label?: string;
  maxLength?: number;
  disabled?: boolean;
}) {
  return (
    <input
      className={`txt ${className}`}
      value={value}
      placeholder={placeholder}
      aria-label={label ?? placeholder}
      maxLength={maxLength}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Area({
  value,
  onChange,
  placeholder,
  rows = 4,
  label,
  disabled,
}: {
  value: string;
  onChange(v: string): void;
  placeholder?: string;
  rows?: number;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <textarea
      className="area"
      rows={rows}
      value={value}
      placeholder={placeholder}
      aria-label={label ?? placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Barra de recurso com « ‹ › » (−5, −1, +1, +5). */
export function ResourceBar({
  label,
  current,
  max,
  color,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  current: number;
  max: number;
  color: string;
  onChange(v: number): void;
  disabled?: boolean;
  /** Detalhamento do máximo (mostrado ao passar o mouse). */
  hint?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  return (
    <div className="resource">
      <div className="resource-label" title={hint}>
        {label}
        {hint && <span className="hint-dot"> ⓘ</span>}
      </div>
      <div className="resource-bar" style={{ ['--bar' as string]: color }}>
        <div className="resource-fill" style={{ width: `${pct}%` }} />
        <button type="button" disabled={disabled} onClick={() => onChange(current - 5)} title="−5" aria-label={`${label} −5`}>
          «
        </button>
        <button type="button" disabled={disabled} onClick={() => onChange(current - 1)} title="−1" aria-label={`${label} −1`}>
          ‹
        </button>
        <span className="resource-value">
          <Num value={current} onChange={onChange} title={`${label} atual`} disabled={disabled} />
          <button
            type="button"
            className="resource-max"
            disabled={disabled}
            onClick={() => onChange(max)}
            title="Restaurar ao máximo"
            aria-label={`${label}: restaurar ao máximo`}
          >
            / {max}
          </button>
        </span>
        <button type="button" disabled={disabled} onClick={() => onChange(current + 1)} title="+1" aria-label={`${label} +1`}>
          ›
        </button>
        <button type="button" disabled={disabled} onClick={() => onChange(current + 5)} title="+5" aria-label={`${label} +5`}>
          »
        </button>
      </div>
    </div>
  );
}

/** Ícone de dado clicável (rolar). */
export function DieButton({ onClick, title }: { onClick(): void; title: string }) {
  return (
    <button type="button" className="die-btn" onClick={onClick} title={title} aria-label={title}>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
        <path d="M12 2 21 7v10l-9 5-9-5V7z" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 2v6m0 0 9-1M12 8 3 7m9 1-5 9m5-9 5 9M7 17h10" fill="none" stroke="currentColor" strokeWidth="1.1" />
      </svg>
    </button>
  );
}

/** Card retrátil de lista (habilidades, rituais, itens, ataques). */
export function Collapsible({
  title,
  subtitle,
  extra,
  children,
  defaultOpen = false,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`collapsible ${open ? 'open' : ''}`}>
      <div className="collapsible-head">
        <button type="button" className="chevron" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? '▴' : '▾'}
        </button>
        <div className="grow collapsible-title" onClick={() => setOpen((o) => !o)}>
          <strong>{title}</strong>
          {subtitle && <div className="collapsible-sub">{subtitle}</div>}
        </div>
        {extra}
      </div>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}

/** Retrato clicável para enviar imagem. */
export function Portrait({
  url,
  onChange,
  disabled,
}: {
  url: string | null;
  onChange(url: string | null): void;
  disabled?: boolean;
}) {
  const { campaign, flash } = useGame();
  const [busy, setBusy] = useState(false);
  const src = useAssetUrl(url);
  return (
    <label className={`portrait ${disabled ? 'disabled' : ''}`} title={disabled ? undefined : 'Trocar retrato'}>
      {src ? <img src={src} alt="Retrato" /> : <span className="muted small">{busy ? 'Enviando…' : 'Retrato'}</span>}
      {!disabled && (
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setBusy(true);
            uploadImage(campaign.id, file)
              .then(onChange)
              .catch((err) => flash(String(err?.message ?? err)))
              .finally(() => setBusy(false));
          }}
        />
      )}
    </label>
  );
}

/** Filtro de texto simples para listas. */
export function matches(filter: string, ...fields: string[]): boolean {
  const f = filter.trim().toLowerCase();
  return !f || fields.some((x) => x.toLowerCase().includes(f));
}
