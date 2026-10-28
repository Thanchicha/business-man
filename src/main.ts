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
import { G, setMenus } from './sim/GameState';
import { initSound } from './ui/sfx';
import { initCoopUI } from './screens/coopLobby';

async function start() {
  try {
    // never hold the page for more than 1.5s on fonts
    await Promise.race([
      new Promise((r) => setTimeout(r, 1500)),
      Promise.all([document.fonts.load('400 20px Mitr', 'ก'), document.fonts.load('600 20px Mitr', 'ก'), document.fonts.load('700 20px Fredoka', 'B'), document.fonts.load('600 20px Fredoka', 'B')]),
    ]);
  } catch {
    // fall back to system fonts
  }
  initSound();
  const app = document.getElementById('app')!;
  document.getElementById('boot')?.remove();
  const engine = new Engine(app);
  const ui = document.createElement('div');
  ui.id = 'ui';
  app.appendChild(ui);
  initFlow(engine);
  registerAll();
  initCoopUI();
  if (import.meta.env.DEV) Object.assign(window, { __engine: engine, __go: go, __state: () => G, __setMenus: setMenus });
  // the title (cover) screen is the first thing shown
  go(new URLSearchParams(location.search).get('screen') ?? 'title');
  // warm up the other character models after the first screen is up, one per frame
  void loadMiyu().then(() => preloadExtras(Object.values(LOOKS)));
}

start();
