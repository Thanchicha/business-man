import '@fontsource/mitr/400.css';
import '@fontsource/mitr/500.css';
import '@fontsource/mitr/600.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import './ui/style.css';
import { Engine } from './three/engine';
import { go, initFlow } from './game/flow';
import { registerAll } from './screens';
import { loadMiyu, preloadExtras } from './three/models/miyu';
import { LOOKS } from './three/chars/extra/character/looks';
import { openingSeen } from './screens/opening';
import { G, setMenus } from './sim/GameState';
import { initSound } from './ui/sfx';
import { initCoopUI } from './screens/coopLobby';

async function start() {
  try {
    await Promise.all([document.fonts.load('400 20px Mitr', 'ก'), document.fonts.load('600 20px Mitr', 'ก'), document.fonts.load('700 20px Fredoka', 'B'), document.fonts.load('600 20px Fredoka', 'B')]);
  } catch {
    // fall back to system fonts
  }
  initSound();
  await loadMiyu();
  const app = document.getElementById('app')!;
  const engine = new Engine(app);
  const ui = document.createElement('div');
  ui.id = 'ui';
  app.appendChild(ui);
  initFlow(engine);
  registerAll();
  initCoopUI();
  if (import.meta.env.DEV) Object.assign(window, { __engine: engine, __go: go, __state: () => G, __setMenus: setMenus });
  // first visit: the short opening film, then the title; later visits go straight to the title
  go(new URLSearchParams(location.search).get('screen') ?? (openingSeen() ? 'title' : 'opening'));
  void preloadExtras(Object.values(LOOKS));
}

start();
