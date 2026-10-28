import type { Stage } from '../three/engine';
import { btn, h, mount } from '../ui/dom';
import { Advisor, Hud, modal, toast } from '../ui/components';
import { go } from '../game/flow';
import { G } from '../sim/GameState';
import { baht } from '../game/format';
import { cleanCode } from '../net/room';
import { ROLE, ROLES, type RoleId } from '../coop/roles';
import { act, coopActive, getPlayers, hostRoom, inRoom, isHost, joinRoom, leaveRoom, me, myId, on, roomCode, shareLink, type Player } from '../coop/session';
import { islandBackdrop } from './common';
import { sfx } from '../ui/sfx';

const ACTIVITY: Record<string, string> = {
  title: 'อยู่หน้าแรก',
  intro: 'กำลังคุยกับ มิว',
  shopType: 'เลือกรูปแบบร้าน',
  invest: 'วางแผนเงินลงทุน',
  menuSelect: 'เลือกเมนู',
  market: 'ซื้อวัตถุดิบ',
  hire: 'จ้างพนักงาน',
  townMap: 'เลือกทำเล',
  strategy: 'เลือกกลยุทธ์ร้าน',
  furnitureStore: 'ซื้อเฟอร์นิเจอร์',
  delivery: 'รอเฟอร์นิเจอร์มาส่ง',
  furnish: 'จัดร้าน',
  research: 'สำรวจตลาด',
  map: 'ดูแผนที่เมือง',
  landlord: 'คุยกับเจ้าของที่',
  bank: 'ไปธนาคาร',
  shopDay: 'เปิดร้านอยู่ (รอบนี้เล่นคนเดียว)',
};

export const activityText = (name: string): string => ACTIVITY[name] ?? 'กำลังเตรียมร้าน';

/** One job as a small card: icon, name, morning and daytime duties. */
export function roleCard(id: RoleId, extra?: HTMLElement): HTMLElement {
  const r = ROLE[id];
  return h('div', { class: 'role-card' }, h('b', {}, `${r.icon} ${r.name}`), h('div', {}, `🌅 เช้า: ${r.morning}`), h('div', {}, `☀ เปิดร้าน: ${r.day}`), extra ?? '');
}

function playerRow(p: Player): HTMLElement {
  const mine = p.id === myId();
  const sel = h('select', { class: 'role-select' }) as HTMLSelectElement;
  for (const r of ROLES) sel.append(h('option', { value: r.id }, `${r.icon} ${r.name}`));
  sel.value = p.role;
  sel.disabled = !(mine || isHost());
  sel.addEventListener('change', () => act({ k: 'role', id: p.id, role: sel.value as RoleId }));
  return h('div', 'row player-row', h('span', {}, `${p.host ? '👑' : '🙂'} ${p.name}${mine ? ' (คุณ)' : ''}`), sel, p.ready ? h('span', 'pill good', 'พร้อม') : '');
}

/** Who is in the room and which job each has. */
export function playersPanel(): HTMLElement {
  const box = h('div', { class: 'col', style: { gap: '6px' } });
  const draw = () => {
    const ps = getPlayers();
    const missing = ROLES.filter((r) => !ps.some((p) => p.role === r.id));
    box.replaceChildren(
      ...ps.map(playerRow),
      ...(coopActive() ? missing.map((r) => h('div', { class: 'muted', style: { fontSize: '14px' } }, `${r.icon} ${r.name} ยังว่าง — ${r.fallback}`)) : []),
    );
  };
  draw();
  const off = on('lobby', () => (box.isConnected ? draw() : off()));
  return box;
}

/** Room code, share link, players and jobs. */
export function openLobby(): void {
  if (!inRoom()) return playWithFriends();
  const link = shareLink();
  const copy = btn('📋 คัดลอกลิงก์', 'mint', () => {
    navigator.clipboard?.writeText(link).then(() => toast('คัดลอกลิงก์แล้ว ส่งให้เพื่อนได้เลย', 'good'), () => toast(link));
  }, 'small');
  const { close } = modal(
    [
      h('h2', {}, '👥 ห้องเล่นกับเพื่อน'),
      h('div', 'row wrap', h('span', {}, 'รหัสห้อง'), h('span', 'room-code', roomCode()), copy),
      h('div', { class: 'muted', style: { fontSize: '14px', wordBreak: 'break-all' } }, link),
      h('p', { class: 'muted', style: { fontSize: '15px' } }, 'เล่นได้ 1-4 คน แต่ละคนเลือกหน้าที่ หน้าที่ไหนว่างระบบหรือพนักงานที่จ้างจะช่วยทำให้ จบวันแล้วสลับหน้าที่ได้'),
      playersPanel(),
      h('div', { class: 'grid3', style: { marginTop: '10px' } }, ...ROLES.map((r) => roleCard(r.id))),
      h(
        'div',
        { class: 'row', style: { justifyContent: 'center', marginTop: '12px' } },
        isHost() && coopActive() ? btn('🔄 หมุนเวียนหน้าที่', 'gold', () => act({ k: 'rotate' })) : '',
        btn(isHost() ? 'ปิดห้อง' : 'ออกจากห้อง', '', () => {
          close();
          leaveRoom();
          if (!isHost()) go('title');
        }),
        btn('ตกลง', 'pink', () => close()),
      ),
    ],
    { width: '760px' },
  );
}

/** From the title: open a room for your game, or join a friend's. */
export function playWithFriends(prefill = ''): void {
  const code = h('input', { class: 'name-input', placeholder: 'รหัสห้อง 5 ตัว', value: prefill, maxlength: 8 }) as HTMLInputElement;
  const name = h('input', { class: 'name-input', placeholder: 'ชื่อของคุณ', maxlength: 20 }) as HTMLInputElement;
  try {
    name.value = localStorage.getItem('bubble-tea-journey-name') ?? '';
  } catch {
    // no storage
  }
  for (const i of [code, name]) i.addEventListener('keydown', (e) => e.stopPropagation());
  let look: Player['look'] = 'player_m';
  const looks = h('div', 'row');
  const drawLooks = () =>
    looks.replaceChildren(
      ...(['player_m', 'player_f'] as const).map((k) => {
        const b = btn(k === 'player_m' ? '👦 ผู้ชาย' : '👧 ผู้หญิง', look === k ? 'lav' : '', () => {
          look = k;
          drawLooks();
        }, 'small');
        return b;
      }),
    );
  drawLooks();
  const status = h('div', { class: 'muted', style: { minHeight: '22px' } });
  const join = btn('เข้าห้องเพื่อน ›', 'pink', async () => {
    const c = cleanCode(code.value);
    if (c.length !== 5) return void (status.textContent = 'รหัสห้องต้องมี 5 ตัว');
    join.disabled = true;
    status.textContent = 'กำลังเชื่อมต่อ...';
    try {
      localStorage.setItem('bubble-tea-journey-name', name.value.trim());
    } catch {
      // no storage
    }
    try {
      await joinRoom(c, name.value.trim() || 'เพื่อน', look);
      close();
      sfx('done');
      go('coopWait', { activity: '' });
    } catch (err) {
      join.disabled = false;
      status.textContent = (err as Error)?.message === 'no-room' ? 'ไม่พบห้องนี้ ลองเช็กรหัสอีกครั้ง' : 'เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง (ต้องต่ออินเทอร์เน็ต)';
    }
  });
  const create = btn('สร้างห้องใหม่ (เป็นเจ้าของร้าน)', 'mint', async () => {
    create.disabled = true;
    status.textContent = 'กำลังสร้างห้อง...';
    try {
      await hostRoom();
      close();
      sfx('done');
      openLobby();
      toast('สร้างห้องแล้ว! เริ่มเกมหรือเล่นต่อได้เลย เพื่อนจะเข้ามาช่วยตอนเปิดร้าน', 'good');
    } catch {
      create.disabled = false;
      status.textContent = 'สร้างห้องไม่ได้ ลองใหม่อีกครั้ง (ต้องต่ออินเทอร์เน็ต)';
    }
  });
  const { close } = modal(
    [
      h('h2', {}, '👥 เล่นกับเพื่อน (1-4 คน)'),
      h('p', { class: 'muted' }, 'ช่วยกันเปิดร้าน: แคชเชียร์ดูเงิน คนชงทำน้ำ นักสำรวจฟังเสียงลูกค้า'),
      h('h3', {}, 'เป็นเจ้าของร้าน'),
      create,
      h('h3', { style: { marginTop: '14px' } }, 'เข้าร้านของเพื่อน'),
      h('div', 'col', code, name, looks, join),
      status,
      h('div', { style: { textAlign: 'center', marginTop: '8px' } }, btn('ปิด', '', () => close(), 'small')),
    ],
    { width: '460px' },
  );
}

let badge: HTMLElement | null = null;

function drawBadge(): void {
  if (!badge) {
    badge = h('div', 'coop-badge pill');
    badge.addEventListener('click', () => openLobby());
    document.getElementById('app')!.appendChild(badge);
  }
  badge.style.display = inRoom() ? '' : 'none';
  const mine = me();
  badge.textContent = `👥 ห้อง ${roomCode()} • ${getPlayers().length} คน${coopActive() && mine ? ` • ${ROLE[mine.role].icon} ${ROLE[mine.role].name}` : ''}`;
}

/** Room badge, error toasts and what happens when the room closes. */
export function initCoopUI(): void {
  on('lobby', drawBadge);
  on('error', (text: string) => toast(text, 'bad'));
  on('closed', (reason: string) => {
    drawBadge();
    if (reason === 'host-left') {
      toast('เจ้าของร้านปิดห้องแล้ว', 'bad');
      go('title');
    }
  });
  const code = new URLSearchParams(location.search).get('room');
  if (code) setTimeout(() => playWithFriends(cleanCode(code)), 800);
}

/** A friend's screen while the host does things only the host does (setup, solo screens). */
export function coopWaitScreen(stage: Stage, data: { activity?: string } = {}): () => void {
  islandBackdrop(stage);
  const hud = new Hud('ร้านของเพื่อน');
  const doing = h('b', {}, activityText(data.activity ?? ''));
  const info = h('div', 'muted');
  const drawInfo = () => {
    hud.refresh();
    info.textContent = G.location ? `วันที่ ${G.day} • เงินสด ${baht(G.cash)} • เมนู ${G.menus.length} อย่าง` : 'ร้านยังไม่ได้เปิด เจ้าของร้านกำลังวางแผนอยู่';
  };
  drawInfo();
  const mine = me();
  mount(
    h(
      'div',
      { class: 'panel col content', style: { position: 'absolute', left: '20px', top: '80px', width: '440px', maxHeight: 'calc(100% - 120px)', overflowY: 'auto' } },
      h('h2', {}, '⏳ รอเจ้าของร้านแป๊บนะ'),
      h('div', {}, 'ตอนนี้เจ้าของร้าน: ', doing),
      info,
      h('h3', {}, 'คนในห้อง'),
      playersPanel(),
      mine ? h('h3', {}, 'หน้าที่ของคุณ') : '',
      mine ? roleCard(mine.role) : '',
    ),
  );
  const adv = new Advisor('bottom-right');
  adv.say('ช่วงเตรียมร้านเจ้าของร้านจะทำเอง พอถึงเช้าวันเปิดร้าน ทุกคนจะได้ทำหน้าที่ของตัวเอง เปลี่ยนหน้าที่ได้ในห้องนะ~', 'happy');
  const offs = [on('activity', (n: string) => (doing.textContent = activityText(n))), on('state', drawInfo)];
  return () => offs.forEach((f) => f());
}
