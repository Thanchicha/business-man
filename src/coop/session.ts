import { Room, cleanCode } from '../net/room';
import { G, replaceGame, type GameState } from '../sim/GameState';
import { go, isBusy, onScreen } from '../game/flow';
import { autoRole, rotateRoles, type RoleId } from './roles';
import { applyAction, type Action } from './actions';

export interface Player {
  id: string;
  name: string;
  look: GameState['playerKey'];
  role: RoleId;
  host: boolean;
  ready: boolean;
}

type Msg =
  | { t: 'hello'; name: string; look: Player['look'] }
  | { t: 'lobby'; players: Player[] }
  | { t: 'state'; g: GameState }
  | { t: 'screen'; name: string; data: unknown }
  | { t: 'act'; a: Action }
  | { t: 'day'; op: unknown }
  | { t: 'frame'; f: unknown }
  | { t: 'fx'; fx: unknown }
  | { t: 'err'; text: string };

/** Screens friends see as they are; any other host screen shows the waiting room. */
const MIRRORED = new Set(['coopMorning', 'coopDay', 'summary', 'night', 'ending']);

let room: Room | null = null;
let players: Player[] = [];
let meId = 'host';
let hostScreen: { name: string; data: unknown } | null = null;
let guestScreen = '';
let ticker = 0;

type Ev = 'lobby' | 'state' | 'frame' | 'fx' | 'day' | 'activity' | 'error' | 'closed';
const bus = new Map<Ev, Set<(x: any, from: string) => void>>();

/** Listens to room events; returns a function that stops listening. */
export function on(ev: Ev, fn: (x: any, from: string) => void): () => void {
  if (!bus.has(ev)) bus.set(ev, new Set());
  bus.get(ev)!.add(fn);
  return () => bus.get(ev)!.delete(fn);
}

function emit(ev: Ev, x?: unknown, from = meId): void {
  for (const fn of [...(bus.get(ev) ?? [])]) fn(x, from);
}

export const inRoom = (): boolean => !!room;
export const roomCode = (): string => room?.code ?? '';
/** Co-op rules apply once at least one friend is in the room. */
export const coopActive = (): boolean => !!room && players.length > 1;
export const isHost = (): boolean => !room || room.host;
export const getPlayers = (): Player[] => players;
export const me = (): Player | undefined => players.find((p) => p.id === meId);
export const myId = (): string => meId;
export const myRole = (): RoleId | null => (coopActive() ? (me()?.role ?? null) : null);
export const nameOf = (id: string): string => players.find((p) => p.id === id)?.name ?? 'เพื่อน';
export const roleFilled = (role: RoleId): boolean => coopActive() && players.some((p) => p.role === role);
/** Whether this player may work on a job: their own, one nobody took, or anything when playing alone. */
export const canDo = (role: RoleId): boolean => !coopActive() || myRole() === role || !roleFilled(role);
/** Host check for a friend's move: the same rule as canDo, for any player. */
export const mayDo = (id: string, role: RoleId): boolean => !coopActive() || players.find((p) => p.id === id)?.role === role || !roleFilled(role);
export const shareLink =(): string => `${location.origin}${location.pathname}?room=${roomCode()}`;

const hostName = (): string => G.playerName?.trim() || 'เจ้าของร้าน';

function send(msg: Msg, to?: string): void {
  room?.send(msg, to);
}

function broadcastLobby(): void {
  const h = players.find((p) => p.host);
  if (h) {
    h.name = hostName();
    h.look = G.playerKey;
  }
  send({ t: 'lobby', players });
  emit('lobby', players);
}

export function broadcastState(): void {
  if (room?.host) send({ t: 'state', g: G });
}

/** Host only: positions and panels of the open shop, many times a second. */
export function sendFrame(f: unknown): void {
  if (room?.host && room.size) send({ t: 'frame', f });
}

/** Host only: a one-off effect (toast, sound, floating text) for everyone. */
export function sendFx(fx: unknown): void {
  if (room?.host && room.size) send({ t: 'fx', fx });
}

/** A player's move during opening hours; the host's shop screen handles it. */
export function dayOp(op: unknown): void {
  if (isHost()) emit('day', op, meId);
  else send({ t: 'day', op });
}

/** Asks for a change to the game. The host applies it at once; a friend sends it to the host. */
export function act(a: Action): void {
  if (!isHost()) return send({ t: 'act', a });
  hostApply(a, meId);
}

function hostApply(a: Action, from: string): void {
  let err: string | null = null;
  if (a.k === 'role') {
    const p = players.find((x) => x.id === a.id);
    if (p && (from === 'host' || from === a.id)) p.role = a.role;
  } else if (a.k === 'ready') {
    const p = players.find((x) => x.id === from);
    if (p) p.ready = a.on;
  } else if (a.k === 'rotate') {
    if (from === 'host') rotateRoles(players);
  } else err = applyAction(G, a, nameOf(from));
  if (a.k === 'role' || a.k === 'ready' || a.k === 'rotate') broadcastLobby();
  else {
    broadcastState();
    emit('state', G);
  }
  if (err) {
    if (from === meId) emit('error', err);
    else send({ t: 'err', text: err }, from);
  }
}

/** Host only: clears everyone's ready flag for a new morning. */
export function resetReady(): void {
  for (const p of players) p.ready = false;
  if (room) broadcastLobby();
}

export const allReady = (): boolean => players.every((p) => p.ready || p.host);

function goWhenFree(name: string, data?: unknown): void {
  if (isBusy()) return void setTimeout(() => goWhenFree(name, data), 200);
  go(name, data);
}

function mirror(name: string, data: unknown): void {
  // the host only passes through these on the way to the team screens
  if (name === 'map' || name === 'shopDay') return;
  if (MIRRORED.has(name)) {
    guestScreen = name;
    goWhenFree(name, { ...(data as object), guest: true });
    return;
  }
  emit('activity', name);
  if (guestScreen !== 'coopWait') {
    guestScreen = 'coopWait';
    goWhenFree('coopWait', { activity: name });
  }
}

function wireHost(r: Room): void {
  r.onMessage = (raw, from) => {
    const m = raw as Msg;
    if (m.t === 'hello') {
      if (players.some((p) => p.id === from)) return;
      players.push({ id: from, name: m.name.slice(0, 20) || 'เพื่อน', look: m.look, role: autoRole(players.map((p) => p.role)), host: false, ready: false });
      broadcastLobby();
      send({ t: 'state', g: G }, from);
      if (hostScreen) send({ t: 'screen', name: hostScreen.name, data: MIRRORED.has(hostScreen.name) ? hostScreen.data : null }, from);
      // the first friend arrives while the host is choosing where to go: start the team morning
      if (hostScreen?.name === 'map' && players.length === 2) goWhenFree('coopMorning');
    } else if (m.t === 'act') hostApply(m.a, from);
    else if (m.t === 'day') emit('day', m.op, from);
  };
  r.onLeave = (id) => {
    players = players.filter((p) => p.id !== id);
    broadcastLobby();
  };
  onScreen((name, data) => {
    hostScreen = { name, data };
    if (!room?.size) return;
    broadcastState();
    send({ t: 'screen', name, data: MIRRORED.has(name) ? data : null });
  });
  clearInterval(ticker);
  // older screens change the game directly; keep friends roughly in step (not needed while the shop runs)
  ticker = window.setInterval(() => {
    if (room?.size && hostScreen?.name !== 'coopDay') broadcastState();
  }, 3000);
}

function wireGuest(r: Room): void {
  r.onMessage = (raw) => {
    const m = raw as Msg;
    if (m.t === 'lobby') {
      players = m.players;
      emit('lobby', players);
    } else if (m.t === 'state') {
      replaceGame(m.g);
      emit('state', G);
    } else if (m.t === 'screen') mirror(m.name, m.data);
    else if (m.t === 'frame') emit('frame', m.f);
    else if (m.t === 'fx') emit('fx', m.fx);
    else if (m.t === 'err') emit('error', m.text);
  };
}

function reset(): void {
  room = null;
  players = [];
  meId = 'host';
  guestScreen = '';
  clearInterval(ticker);
  onScreen((name, data) => (hostScreen = { name, data }));
}

/** Opens a room for the current game and makes this browser its host. */
export async function hostRoom(): Promise<string> {
  if (room) return room.code;
  const r = await Room.create();
  room = r;
  meId = 'host';
  players = [{ id: 'host', name: hostName(), look: G.playerKey, role: 'cashier', host: true, ready: false }];
  r.onClose = () => {
    reset();
    emit('closed', 'left');
  };
  wireHost(r);
  emit('lobby', players);
  return r.code;
}

export async function joinRoom(code: string, name: string, look: Player['look']): Promise<void> {
  if (room) leaveRoom();
  const r = await Room.join(cleanCode(code));
  room = r;
  meId = r.myId;
  r.onClose = (reason) => {
    reset();
    emit('closed', reason);
  };
  wireGuest(r);
  send({ t: 'hello', name, look });
}

export function leaveRoom(): void {
  const r = room;
  reset();
  r?.close();
  emit('lobby', players);
}

// track the host's screen even before a room exists, so a room opened later knows where we are
onScreen((name, data) => (hostScreen = { name, data }));
