import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Campaign, DieSize, Member, Role, RollRecord, RollRequest, Sheet } from '@ucop/shared';
import { useAuth } from '@web/auth';
import { DiceOverlay, RollLog } from '@web/components/Rolls';
import { SheetsPanel, SheetWindow } from '@web/components/sheet/SheetWindow';
import { GameContext, type GameContextValue } from '@web/game';
import { createSocket, type GameSocket } from '@web/socket';

type Tab = 'fichas' | 'dados';

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [...list, item];
  const copy = list.slice();
  copy[i] = item;
  return copy;
}

/**
 * Mesa no celular: só fichas e dados (sem tabuleiro). Tudo passa pelo mesmo servidor,
 * então as rolagens e conjurações feitas aqui aparecem no tabuleiro para todos.
 */
export function MobileTablePage() {
  const { campaignId = '' } = useParams();
  const { user, token } = useAuth();
  const [socket, setSocket] = useState<GameSocket | null>(null);
  const [online, setOnline] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [rolls, setRolls] = useState<RollRecord[]>([]);
  const [openSheetId, setOpenSheetId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('fichas');

  const flash = useCallback((msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice((m) => (m === msg ? null : m)), 3500);
  }, []);

  useEffect(() => {
    if (!token) return;
    const s = createSocket(token);
    setSocket(s);
    s.on('connect', () => {
      setOnline(true);
      s.emit('campaign:join', campaignId, (res) => {
        if (!res.ok) return setFatal(res.error);
        setFatal(null);
        setCampaign(res.data.campaign);
        setRole(res.data.role);
        setMembers(res.data.members);
        setSheets(res.data.sheets);
        setRolls(res.data.rolls);
      });
    });
    s.on('disconnect', () => setOnline(false));
    s.on('connect_error', (err) => {
      setOnline(false);
      if (err.message === 'Não autenticado') setFatal('Sessão expirada. Entre novamente.');
    });
    s.on('campaign:updated', (c) => setCampaign((prev) => (prev ? { ...c, inviteCode: c.inviteCode ?? prev.inviteCode } : c)));
    s.on('member:joined', (m) => setMembers((list) => (list.some((x) => x.userId === m.userId) ? list : [...list, m])));
    s.on('sheet:upserted', (sheet) => setSheets((list) => upsert(list, sheet)));
    s.on('sheet:removed', (id) => {
      setSheets((list) => list.filter((x) => x.id !== id));
      setOpenSheetId((cur) => (cur === id ? null : cur));
    });
    s.on('roll:new', (roll) => setRolls((list) => (list.some((r) => r.id === roll.id) ? list : [...list, roll].slice(-100))));
    return () => {
      s.removeAllListeners();
      s.disconnect();
      setSocket(null);
    };
  }, [token, campaignId]);

  const addRoll = useCallback((roll: RollRecord) => {
    setRolls((list) => (list.some((r) => r.id === roll.id) ? list : [...list, roll].slice(-100)));
  }, []);

  const sendRoll = useCallback(
    async (req: RollRequest) => {
      if (!socket) return null;
      const res = await socket.emitWithAck('roll', req);
      if (!res.ok) {
        flash(res.error);
        return null;
      }
      addRoll(res.data);
      return res.data;
    },
    [socket, flash, addRoll],
  );

  const ctx = useMemo<GameContextValue | null>(() => {
    if (!socket || !campaign || !role || !user) return null;
    return {
      socket,
      campaign,
      role,
      userId: user.id,
      members,
      sheets,
      flash,
      openSheet: setOpenSheetId,
      rollExpr: (expression: string, label: string) => sendRoll({ type: 'expr', expression, label }),
      rollOp2: (dice: DieSize[], fear: DieSize | null, label: string) => sendRoll({ type: 'op2', dice, fear, label }),
      castRitual: async (input) => {
        const res = await socket.emitWithAck('ritual:cast', input);
        if (!res.ok) {
          flash(res.error);
          return null;
        }
        addRoll(res.data);
        return res.data;
      },
    };
  }, [socket, campaign, role, user, members, sheets, flash, sendRoll, addRoll]);

  if (fatal) {
    return (
      <div className="center-screen">
        <div className="card stack">
          <p className="error">{fatal}</p>
          <Link className="button" to="/campanhas">
            Voltar às campanhas
          </Link>
        </div>
      </div>
    );
  }

  const openSheet = sheets.find((s) => s.id === openSheetId) ?? null;

  return (
    <div className="mobile-table">
      <header className="mobile-top">
        <Link to="/campanhas" className="button small" aria-label="Voltar às campanhas">
          ←
        </Link>
        <strong className="grow ellipsis">{campaign?.name ?? 'Conectando…'}</strong>
        <span className={`status ${online ? 'online' : 'offline'}`}>{online ? 'online' : 'offline'}</span>
      </header>

      <main className="mobile-body">
        {!ctx ? (
          <div className="center-screen muted">Conectando à mesa…</div>
        ) : (
          <GameContext.Provider value={ctx}>
            {openSheet ? (
              <div className="mobile-sheet">
                <SheetWindow key={openSheet.id} sheet={openSheet} onClose={() => setOpenSheetId(null)} />
              </div>
            ) : tab === 'fichas' ? (
              <SheetsPanel />
            ) : (
              <RollLog rolls={rolls} isGm={false} secret={false} onSecret={() => {}} onRoll={(e) => void ctx.rollExpr(e, 'Rolagem livre')} />
            )}
          </GameContext.Provider>
        )}
        {notice && <div className="toast">{notice}</div>}
      </main>

      <nav className="mobile-tabs">
        <button
          type="button"
          className={tab === 'fichas' && !openSheet ? 'active' : ''}
          onClick={() => {
            setOpenSheetId(null);
            setTab('fichas');
          }}
        >
          <span aria-hidden>☰</span>
          Fichas
        </button>
        <button
          type="button"
          className={tab === 'dados' && !openSheet ? 'active' : ''}
          onClick={() => {
            setOpenSheetId(null);
            setTab('dados');
          }}
        >
          <span aria-hidden>⬢</span>
          Dados
        </button>
      </nav>

      <DiceOverlay rolls={rolls} dice3d={false} />
    </div>
  );
}
