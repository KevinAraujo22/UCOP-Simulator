import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Campaign, DieSize, Member, Role, RollRecord, RollRequest, Scene, SceneState, Sheet, Token } from '@ucop/shared';
import { api } from '../api';
import { useAuth } from '../auth';
import { Board } from '../components/Board';
import { CopyButton } from '../components/CopyButton';
import { GmPanel } from '../components/GmPanel';
import { PlayerPanel } from '../components/PlayerPanel';
import { DiceOverlay, RollLog } from '../components/Rolls';
import { SheetsPanel, SheetWindow } from '../components/sheet/SheetWindow';
import { GameContext, type GameContextValue } from '../game';
import { createSocket, type GameSocket } from '../socket';

type Status = 'connecting' | 'online' | 'offline';
type SideTab = 'mesa' | 'fichas' | 'criaturas' | 'dados';

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((t) => t.id === item.id);
  if (i === -1) return [...list, item];
  const copy = list.slice();
  copy[i] = item;
  return copy;
}

export function TablePage() {
  const { campaignId = '' } = useParams();
  const { user, token: authToken } = useAuth();
  const userId = user?.id ?? '';

  const [socket, setSocket] = useState<GameSocket | null>(null);
  const [status, setStatus] = useState<Status>('connecting');
  const [fatal, setFatal] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  /** Cena exibida no tabuleiro (jogadores: sempre a ativa). */
  const [view, setView] = useState<SceneState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [rolls, setRolls] = useState<RollRecord[]>([]);
  const [openSheetId, setOpenSheetId] = useState<string | null>(null);
  const [tab, setTab] = useState<SideTab>('mesa');
  const [secret, setSecret] = useState(false);
  /** Link público do túnel (só existe quando a mesa roda pelo UCOP.exe com cloudflared). */
  const [publicUrl, setPublicUrl] = useState<string | null>(null);

  // O túnel leva alguns segundos para subir: o mestre consulta por até ~2 minutos.
  useEffect(() => {
    if (role !== 'gm') return;
    let tries = 0;
    let timer: number | undefined;
    const poll = () => {
      api<{ publicUrl: string | null }>('/api/server-info')
        .then(({ publicUrl: url }) => {
          setPublicUrl(url);
          if (!url && ++tries < 24) timer = window.setTimeout(poll, 5000);
        })
        .catch(() => {});
    };
    poll();
    return () => window.clearTimeout(timer);
  }, [role]);

  const viewIdRef = useRef<string | null>(null);
  viewIdRef.current = view?.scene.id ?? null;

  const flash = useCallback((msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice((m) => (m === msg ? null : m)), 3500);
  }, []);

  // Conexão em tempo real
  useEffect(() => {
    if (!authToken) return;
    const s = createSocket(authToken);
    setSocket(s);

    const join = () => {
      s.emit('campaign:join', campaignId, (res) => {
        if (!res.ok) {
          setFatal(res.error);
          return;
        }
        const data = res.data;
        setFatal(null);
        setCampaign(data.campaign);
        setRole(data.role);
        setMembers(data.members);
        setScenes(data.scenes);
        setSheets(data.sheets);
        setRolls(data.rolls);
        setActiveSceneId(data.campaign.activeSceneId);
        if (data.role === 'player') {
          setView(data.activeScene);
          return;
        }
        // Mestre: mantém a cena que estava vendo (reconexão) ou abre a ativa/primeira.
        const keep = viewIdRef.current && data.scenes.some((sc) => sc.id === viewIdRef.current);
        const target = keep ? viewIdRef.current : (data.activeScene?.scene.id ?? data.scenes[0]?.id ?? null);
        if (!target) setView(null);
        else if (target === data.activeScene?.scene.id) setView(data.activeScene);
        else s.emit('scene:view', target, (r) => r.ok && setView(r.data));
      });
    };

    s.on('connect', () => {
      setStatus('online');
      join();
    });
    s.on('disconnect', () => setStatus('offline'));
    s.on('connect_error', (err) => {
      setStatus('offline');
      if (err.message === 'Não autenticado') setFatal('Sessão expirada. Entre novamente.');
    });

    s.on('campaign:updated', (c) => setCampaign((prev) => (prev ? { ...c, inviteCode: c.inviteCode ?? prev.inviteCode } : c)));
    s.on('scene:list', (list) => setScenes(list));
    s.on('scene:active', (id) => setActiveSceneId(id));
    s.on('scene:state', (state) => {
      setView(state);
      setSelectedId(null);
    });
    s.on('scene:updated', (scene) => {
      setScenes((list) => list.map((sc) => (sc.id === scene.id ? scene : sc)));
      setView((v) => (v && v.scene.id === scene.id ? { ...v, scene } : v));
    });
    s.on('scene:deleted', (sceneId) => {
      setScenes((list) => list.filter((sc) => sc.id !== sceneId));
      setView((v) => (v && v.scene.id === sceneId ? null : v));
    });
    s.on('token:upserted', (token) => {
      setView((v) => (v && v.scene.id === token.sceneId ? { ...v, tokens: upsert(v.tokens, token) } : v));
    });
    s.on('token:removed', ({ sceneId, tokenId }) => {
      setView((v) => (v && v.scene.id === sceneId ? { ...v, tokens: v.tokens.filter((t) => t.id !== tokenId) } : v));
      setSelectedId((id) => (id === tokenId ? null : id));
    });
    s.on('member:joined', (member) => {
      setMembers((list) => (list.some((m) => m.userId === member.userId) ? list : [...list, member]));
    });
    s.on('sheet:upserted', (sheet) => setSheets((list) => upsert(list, sheet)));
    s.on('sheet:removed', (sheetId) => {
      setSheets((list) => list.filter((x) => x.id !== sheetId));
      setOpenSheetId((id) => (id === sheetId ? null : id));
    });
    s.on('roll:new', (roll) => setRolls((list) => (list.some((r) => r.id === roll.id) ? list : [...list, roll].slice(-100))));

    return () => {
      s.removeAllListeners();
      s.disconnect();
      setSocket(null);
    };
  }, [authToken, campaignId]);

  /** Mestre: abre uma cena no tabuleiro. */
  const viewScene = useCallback(
    (sceneId: string | null) => {
      if (!socket) return;
      setSelectedId(null);
      if (!sceneId) {
        setView(null);
        return;
      }
      socket.emit('scene:view', sceneId, (res) => {
        if (res.ok) setView(res.data);
        else flash(res.error);
      });
    },
    [socket, flash],
  );

  /** Movimento otimista: aplica localmente e desfaz se o servidor recusar. */
  const moveToken = useCallback(
    (token: Token, x: number, y: number) => {
      if (!socket || (token.x === x && token.y === y)) return;
      setView((v) => (v ? { ...v, tokens: upsert(v.tokens, { ...token, x, y }) } : v));
      socket.emit('token:move', { id: token.id, x, y }, (res) => {
        if (res.ok) {
          setView((v) => (v && v.scene.id === res.data.sceneId ? { ...v, tokens: upsert(v.tokens, res.data) } : v));
        } else {
          setView((v) => (v && v.scene.id === token.sceneId ? { ...v, tokens: upsert(v.tokens, token) } : v));
          flash(res.error);
        }
      });
    },
    [socket, flash],
  );

  const sendRoll = useCallback(
    async (req: RollRequest): Promise<RollRecord | null> => {
      if (!socket) return null;
      const res = await socket.emitWithAck('roll', req);
      if (!res.ok) {
        flash(res.error);
        return null;
      }
      // Garante o resultado na tela mesmo antes do broadcast chegar.
      setRolls((list) => (list.some((r) => r.id === res.data.id) ? list : [...list, res.data].slice(-100)));
      return res.data;
    },
    [socket, flash],
  );

  const ctx = useMemo<GameContextValue | null>(() => {
    if (!socket || !campaign || !role) return null;
    const isGm = role === 'gm';
    return {
      socket,
      campaign,
      role,
      userId,
      members,
      sheets,
      flash,
      openSheet: setOpenSheetId,
      rollExpr: (expression: string, label: string) => sendRoll({ type: 'expr', expression, label, secret: isGm && secret }),
      rollOp2: (dice: DieSize[], fear: DieSize | null, label: string) =>
        sendRoll({ type: 'op2', dice, fear, label, secret: isGm && secret }),
      castRitual: async (input) => {
        const res = await socket.emitWithAck('ritual:cast', { ...input, secret: isGm && secret });
        if (!res.ok) {
          flash(res.error);
          return null;
        }
        setRolls((list) => (list.some((r) => r.id === res.data.id) ? list : [...list, res.data].slice(-100)));
        return res.data;
      },
    };
  }, [socket, campaign, role, userId, members, sheets, flash, sendRoll, secret]);

  /** Mestre: cria um token ligado à ficha no centro da cena aberta. */
  const placeToken = useCallback(
    (sheet: Sheet) => {
      if (!socket || !view) return flash('Abra uma cena para pôr o token no mapa');
      const portrait = (sheet.data as { portrait?: string | null }).portrait ?? null;
      socket.emit(
        'token:create',
        {
          sceneId: view.scene.id,
          name: sheet.name,
          sheetId: sheet.id,
          imageUrl: portrait,
          ownerId: sheet.system === 'creature' ? null : sheet.ownerId,
          hidden: sheet.system === 'creature',
          color: sheet.system === 'creature' ? '#b91c1c' : '#7c3aed',
          x: Math.floor(view.scene.width / 2),
          y: Math.floor(view.scene.height / 2),
        },
        (res) => (res.ok ? flash(sheet.system === 'creature' ? 'Token criado (oculto) no centro da cena' : 'Token criado no centro da cena') : flash(res.error)),
      );
    },
    [socket, view, flash],
  );

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

  const isGm = role === 'gm';
  const activeScene = scenes.find((s) => s.id === activeSceneId);
  const openSheet = sheets.find((s) => s.id === openSheetId) ?? null;
  const tabs: { id: SideTab; label: string; icon: string }[] = [
    { id: 'mesa', label: 'Mesa', icon: '◫' },
    { id: 'fichas', label: 'Fichas', icon: '☰' },
    ...(isGm ? [{ id: 'criaturas' as const, label: 'Criaturas', icon: '☠' }] : []),
    { id: 'dados', label: 'Dados', icon: '⬢' },
  ];

  const body = (
    <div className="table-layout">
      <header className="topbar">
        <Link to="/campanhas" className="button">
          ← Campanhas
        </Link>
        <strong>{campaign?.name ?? 'Carregando…'}</strong>
        {role && <span className={`badge ${role}`}>{isGm ? 'Mestre' : 'Jogador'}</span>}
        {isGm && campaign?.inviteCode && (
          <span className="invite">
            Convite: <code>{campaign.inviteCode}</code> <CopyButton text={campaign.inviteCode} />
          </span>
        )}
        {isGm && publicUrl && (
          <span className="invite" title="Link criado pelo Cloudflare Tunnel — mande para os jogadores junto com o convite">
            Link: <code className="public-url">{publicUrl}</code> <CopyButton text={publicUrl} />
          </span>
        )}
        <span className="spacer" />
        {view && (
          <span className="muted small">
            {view.scene.name}
            {isGm && (view.scene.id === activeSceneId ? ' · ativa para os jogadores' : ' · não visível aos jogadores')}
          </span>
        )}
        <span className={`status ${status}`} title={status === 'online' ? 'Conectado' : 'Desconectado'}>
          {status === 'online' ? 'online' : status === 'connecting' ? 'conectando…' : 'offline'}
        </span>
        <span className="muted">{user?.name}</span>
      </header>

      <div className="table-body">
        <section className="board-wrap">
          {view ? (
            <Board
              scene={view.scene}
              tokens={view.tokens}
              userId={userId}
              isGm={isGm}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onMove={moveToken}
              onOpenSheet={(id) => (sheets.some((s) => s.id === id) ? setOpenSheetId(id) : undefined)}
              playersMoveOwnOnly={campaign?.playersMoveOwnOnly ?? true}
              onDropSheet={(sheetId, x, y) =>
                socket?.emit('token:place', { sheetId, sceneId: view.scene.id, x, y }, (res) => {
                  if (!res.ok) flash(res.error);
                  else if (res.data.hidden) flash('Token criado oculto — revele no painel Mesa quando quiser');
                })
              }
            />
          ) : (
            <div className="center-screen muted">
              {role === null
                ? 'Conectando à mesa…'
                : isGm
                  ? 'Crie ou selecione uma cena no painel ao lado.'
                  : 'Aguardando o mestre ativar uma cena…'}
            </div>
          )}
          {openSheet && (
            <SheetWindow
              key={openSheet.id}
              sheet={openSheet}
              onClose={() => setOpenSheetId(null)}
              onPlaceToken={isGm ? placeToken : undefined}
            />
          )}
          {notice && <div className="toast">{notice}</div>}
        </section>

        <aside className="sidebar">
          <nav className="side-tabs">
            {tabs.map((t) => (
              <button key={t.id} type="button" className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)} title={t.label}>
                <span aria-hidden>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>
          <div className="side-content">
            {tab === 'mesa' &&
              (isGm && socket && campaign ? (
                <GmPanel
                  socket={socket}
                  campaign={campaign}
                  scenes={scenes}
                  activeSceneId={activeSceneId}
                  view={view}
                  members={members}
                  sheets={sheets}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onViewScene={viewScene}
                  onSceneSaved={(scene) => {
                    setScenes((list) => upsert(list, scene));
                    setView((v) => (v && v.scene.id === scene.id ? { ...v, scene } : v));
                  }}
                  onCampaignSaved={setCampaign}
                  flash={flash}
                />
              ) : role === 'player' ? (
                <PlayerPanel members={members} userId={userId} view={view} activeScene={activeScene ?? view?.scene ?? null} />
              ) : null)}
            {tab === 'fichas' && ctx && <SheetsPanel />}
            {tab === 'criaturas' && ctx && <SheetsPanel creatures />}
            {tab === 'dados' && ctx && (
              <RollLog rolls={rolls} isGm={isGm} secret={secret} onSecret={setSecret} onRoll={(e) => void ctx.rollExpr(e, 'Rolagem livre')} />
            )}
          </div>
        </aside>
      </div>
      <DiceOverlay rolls={rolls} />
    </div>
  );

  return ctx ? <GameContext.Provider value={ctx}>{body}</GameContext.Provider> : body;
}
