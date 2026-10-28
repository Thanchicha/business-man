import './ui/style.css';
import { readParams, type ViewName } from './app/params';
import { Viewer } from './app/Viewer';
import type { Gesture } from './character/anim/Animator';
import type { Expression } from './character/types';
import { mountControls } from './ui/Controls';

declare global {
  interface Window {
    __kuro?: {
      ready: boolean;
      /** The three.js scene (for debugging in the console). */
      scene: import('three').Scene;
      setView(name: ViewName): void;
      setExpression(expr: Expression): void;
      setWalking(on: boolean): void;
      setTalking(on: boolean): void;
      playGesture(g: Gesture): void;
    };
  }
}

const params = readParams();
const host = document.getElementById('app')!;
const viewer = new Viewer(host, params);
if (params.ui) mountControls(document.body, viewer, params);

let frames = 0;
window.__kuro = {
  ready: false,
  scene: viewer.scene,
  setView: (name) => viewer.setView(name, params.shot),
  setExpression: (expr) => viewer.setExpression(expr),
  setWalking: (on) => viewer.kuro.setWalking(on),
  setTalking: (on) => viewer.kuro.setTalking(on),
  playGesture: (g) => viewer.kuro.playGesture(g),
};
viewer.start(() => {
  // Flag readiness after a few frames so textures/programs are compiled before screenshots.
  if (++frames === 3) window.__kuro!.ready = true;
});
