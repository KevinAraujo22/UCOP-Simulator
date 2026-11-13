import type Konva from 'konva';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Circle, Group, Image as KonvaImage, Layer, Rect, Shape, Stage, Text } from 'react-konva';
import { clamp, snapToGrid, type Scene, type Token } from '@ucop/shared';
import { useImage } from '../useImage';

interface BoardProps {
  scene: Scene;
  tokens: Token[];
  userId: string;
  isGm: boolean;
  selectedId: string | null;
  onSelect(tokenId: string | null): void;
  /** Chamado ao soltar um token já encaixado na grade (em células). */
  onMove(token: Token, x: number, y: number): void;
}

interface View {
  x: number;
  y: number;
  scale: number;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const ZOOM_STEP = 1.1;

function fitView(scene: Scene, width: number, height: number): View {
  const mapW = scene.width * scene.gridSize;
  const mapH = scene.height * scene.gridSize;
  const scale = clamp(Math.min(width / mapW, height / mapH) * 0.92, MIN_SCALE, MAX_SCALE);
  return { scale, x: (width - mapW * scale) / 2, y: (height - mapH * scale) / 2 };
}

export function canMoveToken(token: Token, userId: string, isGm: boolean): boolean {
  return isGm || (token.ownerId === userId && !token.hidden);
}

export function Board({ scene, tokens, userId, isGm, selectedId, onSelect, onMove }: BoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const background = useImage(scene.backgroundUrl);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Enquadra o mapa ao trocar de cena (ou quando o tamanho do contêiner é conhecido).
  const fittedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!size.width || !size.height || fittedFor.current === scene.id) return;
    fittedFor.current = scene.id;
    setView(fitView(scene, size.width, size.height));
  }, [scene, size]);

  const recenter = useCallback(() => setView(fitView(scene, size.width, size.height)), [scene, size]);

  // Zoom pela roda do mouse, mantendo fixo o ponto sob o cursor.
  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!stage || !pointer) return;
    setView((v) => {
      const scale = clamp(e.evt.deltaY > 0 ? v.scale / ZOOM_STEP : v.scale * ZOOM_STEP, MIN_SCALE, MAX_SCALE);
      const worldX = (pointer.x - v.x) / v.scale;
      const worldY = (pointer.y - v.y) / v.scale;
      return { scale, x: pointer.x - worldX * scale, y: pointer.y - worldY * scale };
    });
  };

  const gs = scene.gridSize;
  const mapW = scene.width * gs;
  const mapH = scene.height * gs;

  return (
    <div className="board" ref={containerRef}>
      {size.width > 0 && (
        <Stage
          width={size.width}
          height={size.height}
          x={view.x}
          y={view.y}
          scaleX={view.scale}
          scaleY={view.scale}
          draggable
          onWheel={onWheel}
          onDragEnd={(e) => {
            const stage = e.target.getStage();
            if (e.target === stage) setView((v) => ({ ...v, x: stage.x(), y: stage.y() }));
          }}
          onMouseDown={(e) => {
            if (e.target === e.target.getStage() || e.target.name() === 'map') onSelect(null);
          }}
        >
          <Layer listening={false}>
            <Rect name="map" width={mapW} height={mapH} fill="#1c1a24" shadowColor="black" shadowBlur={24} shadowOpacity={0.6} />
            {background && <KonvaImage image={background} width={mapW} height={mapH} />}
            <Shape
              stroke="rgba(255,255,255,0.22)"
              strokeWidth={1}
              strokeScaleEnabled={false}
              sceneFunc={(ctx, shape) => {
                ctx.beginPath();
                for (let i = 0; i <= scene.width; i++) {
                  ctx.moveTo(i * gs, 0);
                  ctx.lineTo(i * gs, mapH);
                }
                for (let j = 0; j <= scene.height; j++) {
                  ctx.moveTo(0, j * gs);
                  ctx.lineTo(mapW, j * gs);
                }
                ctx.strokeShape(shape);
              }}
            />
          </Layer>
          <Layer>
            {tokens.map((token) => (
              <TokenNode
                key={token.id}
                token={token}
                gridSize={gs}
                draggable={canMoveToken(token, userId, isGm)}
                own={!isGm && token.ownerId === userId}
                selected={token.id === selectedId}
                onSelect={() => onSelect(token.id)}
                onDrop={(px, py) => {
                  const pos = snapToGrid(px, py, gs, token.size, scene);
                  onMove(token, pos.x, pos.y);
                  return pos;
                }}
              />
            ))}
          </Layer>
        </Stage>
      )}
      <div className="board-controls">
        <button onClick={() => setView((v) => ({ ...v, scale: clamp(v.scale * ZOOM_STEP, MIN_SCALE, MAX_SCALE) }))} title="Aproximar">
          +
        </button>
        <button onClick={() => setView((v) => ({ ...v, scale: clamp(v.scale / ZOOM_STEP, MIN_SCALE, MAX_SCALE) }))} title="Afastar">
          −
        </button>
        <button onClick={recenter} title="Enquadrar mapa">
          ⤢
        </button>
        <span className="muted small">{Math.round(view.scale * 100)}%</span>
      </div>
    </div>
  );
}

interface TokenNodeProps {
  token: Token;
  gridSize: number;
  draggable: boolean;
  own: boolean;
  selected: boolean;
  onSelect(): void;
  /** Recebe a posição solta em pixels e devolve a célula encaixada. */
  onDrop(px: number, py: number): { x: number; y: number };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

function TokenNode({ token, gridSize, draggable, own, selected, onSelect, onDrop }: TokenNodeProps) {
  const image = useImage(token.imageUrl);
  const px = token.size * gridSize;
  const r = px / 2 - Math.max(2, gridSize * 0.05);
  const stroke = selected ? '#ffffff' : own ? '#facc15' : 'rgba(0,0,0,0.7)';

  const setCursor = (e: Konva.KonvaEventObject<MouseEvent>, cursor: string) => {
    const container = e.target.getStage()?.container();
    if (container) container.style.cursor = cursor;
  };

  return (
    <Group
      x={token.x * gridSize}
      y={token.y * gridSize}
      draggable={draggable}
      opacity={token.hidden ? 0.5 : 1}
      onMouseDown={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
      onTap={onSelect}
      onMouseEnter={(e) => setCursor(e, draggable ? 'grab' : 'pointer')}
      onMouseLeave={(e) => setCursor(e, '')}
      onDragStart={(e) => {
        e.target.moveToTop();
        setCursor(e, 'grabbing');
      }}
      onDragEnd={(e) => {
        e.cancelBubble = true;
        const node = e.target;
        const cell = onDrop(node.x(), node.y());
        // Encaixa imediatamente (mesmo se a célula não mudou e o React não re-renderizar).
        node.position({ x: cell.x * gridSize, y: cell.y * gridSize });
        setCursor(e, 'grab');
      }}
    >
      <Circle
        x={px / 2}
        y={px / 2}
        radius={r}
        fill={token.color}
        stroke={stroke}
        strokeWidth={Math.max(2, gridSize * 0.05)}
        dash={token.hidden ? [8, 6] : undefined}
        shadowColor="black"
        shadowBlur={8}
        shadowOpacity={0.5}
      />
      {image ? (
        <Group
          clipFunc={(ctx) => {
            ctx.arc(px / 2, px / 2, r - 1, 0, Math.PI * 2, false);
          }}
        >
          <KonvaImage image={image} width={px} height={px} />
        </Group>
      ) : (
        <Text
          text={initials(token.name)}
          width={px}
          height={px}
          align="center"
          verticalAlign="middle"
          fontSize={Math.max(10, px * 0.32)}
          fontStyle="bold"
          fill="#ffffff"
          shadowColor="black"
          shadowBlur={4}
          listening={false}
        />
      )}
      <Text
        text={token.hidden ? `${token.name} (oculto)` : token.name}
        x={-px / 2}
        y={px + 2}
        width={px * 2}
        align="center"
        fontSize={Math.max(11, gridSize * 0.2)}
        fill="#f4f4f5"
        shadowColor="black"
        shadowBlur={4}
        shadowOpacity={1}
        listening={false}
      />
    </Group>
  );
}
