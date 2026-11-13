import { useEffect, useState, type FormEvent } from 'react';
import { SYSTEM_LABELS, type Sheet } from '@ucop/shared';
import { memberName, useGame } from '../../game';
import { SHEET_DRAG_TYPE } from '../Board';
import { unwrap } from '../../socket';
import { CreatureSheetView } from './CreatureSheet';
import { Op1SheetView } from './Op1Sheet';
import { Op2SheetView } from './Op2Sheet';

/** Janela da ficha, aberta sobre o tabuleiro. */
export function SheetWindow({
  sheet,
  onClose,
  onPlaceToken,
}: {
  sheet: Sheet;
  onClose(): void;
  /** Mestre: cria um token desta ficha na cena aberta. */
  onPlaceToken?: (sheet: Sheet) => void;
}) {
  const { socket, role, members, flash } = useGame();
  const [name, setName] = useState(sheet.name);
  useEffect(() => {
    setName(sheet.name);
  }, [sheet.name]);
  const isGm = role === 'gm';

  const saveName = () => {
    const next = name.trim();
    if (!next || next === sheet.name) return setName(sheet.name);
    socket.emit('sheet:update', { id: sheet.id, name: next }, (res) => !res.ok && flash(res.error));
  };

  const remove = () => {
    if (!window.confirm(`Excluir a ficha "${sheet.name}"? Isso não pode ser desfeito.`)) return;
    socket.emit('sheet:delete', sheet.id, (res) => (res.ok ? onClose() : flash(res.error)));
  };

  return (
    <div className="sheet-window" role="dialog" aria-label={`Ficha de ${sheet.name}`}>
      <div className="sheet-titlebar">
        <input
          className="sheet-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          aria-label="Nome do personagem"
          maxLength={80}
        />
        <span className="badge">{sheet.system === 'creature' ? 'Criatura' : SYSTEM_LABELS[sheet.system]}</span>
        {isGm && sheet.system !== 'creature' ? (
          <select
            value={sheet.ownerId ?? ''}
            onChange={(e) =>
              socket.emit('sheet:update', { id: sheet.id, ownerId: e.target.value || null }, (res) => !res.ok && flash(res.error))
            }
            aria-label="Dono da ficha"
          >
            <option value="">NPC (só o mestre)</option>
            {members
              .filter((m) => m.role === 'player')
              .map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
          </select>
        ) : (
          sheet.system !== 'creature' && <span className="muted small">Jogador: {memberName(members, sheet.ownerId)}</span>
        )}
        <span className="spacer" />
        {isGm && onPlaceToken && (
          <button type="button" className="small" onClick={() => onPlaceToken(sheet)} title="Cria um token ligado a esta ficha na cena aberta">
            Pôr no mapa
          </button>
        )}
        <button type="button" className="small danger" onClick={remove}>
          Excluir
        </button>
        <button type="button" className="small" onClick={onClose} aria-label="Fechar ficha">
          ✕
        </button>
      </div>
      <div className="sheet-scroll">
        {sheet.system === 'op1' && <Op1SheetView sheet={sheet} />}
        {sheet.system === 'op2' && <Op2SheetView sheet={sheet} />}
        {sheet.system === 'creature' && <CreatureSheetView sheet={sheet} />}
      </div>
    </div>
  );
}

/** Lista de fichas (personagens ou criaturas) com criação. */
export function SheetsPanel({ creatures = false }: { creatures?: boolean }) {
  const { socket, role, members, sheets, campaign, flash, openSheet, userId } = useGame();
  const [name, setName] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const isGm = role === 'gm';
  const list = sheets.filter((s) => (creatures ? s.system === 'creature' : s.system !== 'creature'));

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    void socket
      .emitWithAck('sheet:create', { name, ownerId: isGm && !creatures ? ownerId || null : undefined, creature: creatures })
      .then((res) => {
        const sheet = unwrap(res);
        setName('');
        openSheet(sheet.id);
      })
      .catch((err: Error) => flash(err.message));
  };

  return (
    <div className="panel">
      <section>
        <h3>{creatures ? 'Criaturas e ameaças' : 'Fichas'}</h3>
        {!creatures && <p className="muted small">Sistema da campanha: {SYSTEM_LABELS[campaign.system]}</p>}
        {list.length === 0 && (
          <p className="muted small">{creatures ? 'Nenhuma criatura ainda.' : isGm ? 'Nenhuma ficha ainda.' : 'Você ainda não tem ficha.'}</p>
        )}
        <ul className="plain sheet-list">
          {list.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="sheet-item"
                onClick={() => openSheet(s.id)}
                draggable={isGm || s.ownerId === userId}
                title={isGm || s.ownerId === userId ? 'Clique para abrir · arraste para o mapa para criar o token' : undefined}
                onDragStart={(e) => {
                  e.dataTransfer.setData(SHEET_DRAG_TYPE, s.id);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
              >
                {(s.data as { portrait?: string | null }).portrait ? (
                  <img src={(s.data as { portrait: string }).portrait} alt="" />
                ) : (
                  <span className="sheet-avatar">{s.name.slice(0, 1).toUpperCase()}</span>
                )}
                <span className="grow left">
                  <strong>{s.name}</strong>
                  <span className="muted small">
                    {s.system === 'creature' ? 'Criatura' : memberName(members, s.ownerId)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <form className="stack compact" onSubmit={onCreate}>
          <input
            placeholder={creatures ? 'Nome da criatura' : 'Nome do personagem'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
          />
          {isGm && !creatures && (
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} aria-label="Dono da ficha">
              <option value="">NPC (só o mestre)</option>
              {members
                .filter((m) => m.role === 'player')
                .map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
            </select>
          )}
          <button className="primary">{creatures ? 'Nova criatura' : 'Nova ficha'}</button>
        </form>
      </section>
    </div>
  );
}
