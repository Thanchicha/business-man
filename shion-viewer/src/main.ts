import './ui/style.css';
import { readParams, type ViewName } from './app/params';
import { Viewer } from './app/Viewer';
import type { Gesture } from './character/anim/Animator';
import type { Expression } from './character/types';
import { mountControls } from './ui/Controls';

declare global {
  interface Window {
    __shion?: {
      ready: boolean;
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
window.__shion = {
  ready: false,
  setView: (name) => viewer.setView(name, params.shot),
  setExpression: (expr) => viewer.setExpression(expr),
  setWalking: (on) => viewer.shion.setWalking(on),
  setTalking: (on) => viewer.shion.setTalking(on),
  playGesture: (g) => viewer.shion.playGesture(g),
};
viewer.start(() => {
  // Flag readiness after a few frames so textures/programs are compiled before screenshots.
  if (++frames === 3) window.__shion!.ready = true;
});
