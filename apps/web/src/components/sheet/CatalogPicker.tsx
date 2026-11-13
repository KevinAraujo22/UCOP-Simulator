import { useMemo, useState } from 'react';
import { matches } from './common';

export interface PickerEntry {
  id: string;
  name: string;
  /** Rótulo do filtro (ex.: "Combatente", "Sangue", "Arma"). */
  group: string;
  subtitle?: string;
  summary: string;
  page: string;
  /** Já está na ficha. */
  taken?: boolean;
}

/** Janela para escolher entradas do catálogo (habilidades, rituais, itens). */
export function CatalogPicker({
  title,
  entries,
  initialGroup,
  onPick,
  onClose,
}: {
  title: string;
  entries: PickerEntry[];
  initialGroup?: string;
  onPick(id: string): void;
  onClose(): void;
}) {
  const groups = useMemo(() => [...new Set(entries.map((e) => e.group))], [entries]);
  const [group, setGroup] = useState<string>(initialGroup && groups.includes(initialGroup) ? initialGroup : '');
  const [filter, setFilter] = useState('');
  // Ao buscar por texto, procura no catálogo inteiro (o filtro de grupo vale só para navegar).
  const searching = filter.trim().length > 0;
  const list = entries.filter(
    (e) => (searching || !group || e.group === group) && matches(filter, e.name, e.summary, e.subtitle ?? ''),
  );

  return (
    <div className="picker-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="picker" role="dialog" aria-label={title}>
        <div className="row">
          <h3 className="grow">{title}</h3>
          <button type="button" className="small" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        <input className="txt" autoFocus value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar pelo nome ou efeito" />
        <div className={`chips ${searching ? 'dimmed' : ''}`} title={searching ? 'Buscando em todo o catálogo' : undefined}>
          <button type="button" className={!group ? 'active' : ''} onClick={() => setGroup('')}>
            Todos
          </button>
          {groups.map((g) => (
            <button key={g} type="button" className={group === g ? 'active' : ''} onClick={() => setGroup(g)}>
              {g}
            </button>
          ))}
        </div>
        <ul className="picker-list">
          {list.length === 0 && <li className="muted small">Nada encontrado.</li>}
          {list.map((e) => (
            <li key={e.id}>
              <div className="grow">
                <div className="row">
                  <strong>{e.name}</strong>
                  {e.subtitle && <span className="muted small">{e.subtitle}</span>}
                </div>
                <div className="small">{e.summary}</div>
                <div className="muted tiny">{e.page}</div>
              </div>
              <button type="button" className={e.taken ? 'small' : 'small primary'} onClick={() => onPick(e.id)}>
                {e.taken ? 'Adicionar de novo' : 'Adicionar'}
              </button>
            </li>
          ))}
        </ul>
        <p className="muted tiny">
          Resumos não oficiais escritos para o UCOP; o texto completo está no livro indicado. Você pode completar a descrição na
          sua ficha.
        </p>
      </div>
    </div>
  );
}
