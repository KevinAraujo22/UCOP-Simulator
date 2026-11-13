declare module '@3d-dice/dice-box-threejs' {
  export interface DiceBoxConfig {
    assetPath?: string;
    framerate?: number;
    sounds?: boolean;
    volume?: number;
    shadows?: boolean;
    theme_surface?: string;
    theme_colorset?: string;
    theme_texture?: string;
    theme_material?: 'none' | 'metal' | 'wood' | 'glass' | 'plastic';
    theme_customColorset?: {
      background: string | string[];
      foreground: string;
      texture?: string;
      material?: string;
      outline?: string;
    } | null;
    gravity_multiplier?: number;
    light_intensity?: number;
    baseScale?: number;
    strength?: number;
    onRollComplete?: (results: unknown) => void;
  }

  export default class DiceBox {
    constructor(selector: string, config?: DiceBoxConfig);
    initialize(): Promise<void>;
    roll(notation: string): Promise<unknown>;
    clearDice(): void;
    resizeWorld(): void;
    updateConfig(config: DiceBoxConfig): Promise<void>;
  }
}
