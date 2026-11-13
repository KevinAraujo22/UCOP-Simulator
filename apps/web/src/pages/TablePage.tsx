import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Campaign, Member, Role, Scene, SceneState, Token } from '@ucop/shared';
import { useAuth } from '../auth';
import { Board } from '../components/Board';
import { CopyButton } from '../components/CopyButton';
import { GmPanel } from '../components/GmPanel';
import { PlayerPanel } from '../components/PlayerPanel';
import { createSocket, type GameSocket } from '../socket';

type Status = 'connecting' | 'online' | 'offline';

function upsert(list: Token[], token: Token): Token[] {
  const i = list.findIndex((t) => t.id === token.id);
  if (i === -1) return [...list, token];
  const copy = list.slice();
  copy[i] = token;
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

    s.on('scene:list', (list) => {
      setScenes(list);
    });
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

  return (
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
          {notice && <div className="toast">{notice}</div>}
        </section>

        <aside className="sidebar">
          {isGm && socket && campaign ? (
            <GmPanel
              socket={socket}
              campaignId={campaign.id}
              scenes={scenes}
              activeSceneId={activeSceneId}
              view={view}
              members={members}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onViewScene={viewScene}
              onSceneSaved={(scene) => {
                setScenes((list) => (list.some((s) => s.id === scene.id) ? list.map((s) => (s.id === scene.id ? scene : s)) : [...list, scene]));
                setView((v) => (v && v.scene.id === scene.id ? { ...v, scene } : v));
              }}
              flash={flash}
            />
          ) : role === 'player' ? (
            <PlayerPanel members={members} userId={userId} view={view} activeScene={activeScene ?? view?.scene ?? null} />
          ) : null}
        </aside>
      </div>
    </div>
  );
}
