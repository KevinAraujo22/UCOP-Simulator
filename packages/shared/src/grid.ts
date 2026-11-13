/** Utilidades de grade compartilhadas entre cliente e servidor. */

export interface GridBounds {
  /** Largura do mapa, em células. */
  width: number;
  /** Altura do mapa, em células. */
  height: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Converte uma coordenada em células para pixels. */
export function cellToPixel(cell: number, gridSize: number): number {
  return cell * gridSize;
}

/** Garante que um token de `size` células caiba inteiro dentro do mapa. */
export function clampTokenCell(
  x: number,
  y: number,
  size: number,
  bounds: GridBounds,
): { x: number; y: number } {
  return {
    x: clamp(Math.round(x), 0, Math.max(0, bounds.width - size)),
    y: clamp(Math.round(y), 0, Math.max(0, bounds.height - size)),
  };
}

/**
 * Encaixa uma posição em pixels (canto superior esquerdo do token) na célula
 * mais próxima, mantendo o token inteiro dentro do mapa.
 */
export function snapToGrid(
  px: number,
  py: number,
  gridSize: number,
  size: number,
  bounds: GridBounds,
): { x: number; y: number } {
  return clampTokenCell(px / gridSize, py / gridSize, size, bounds);
}
