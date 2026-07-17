/// <reference types="vite/client" />

import type { TextGameState } from './types/game';

declare global {
  interface Window {
    render_game_to_text: () => string;
    advanceTime: (milliseconds: number) => Promise<void>;
    __SUI_GAME_STATE__?: TextGameState;
  }
}

export {};
