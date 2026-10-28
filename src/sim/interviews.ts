import { MENUS, type Segment } from '../data/menus';
import { LOCATION } from '../data/locations';
import { rng } from './rng';

/** Menu ids a group likes best, first. */
const menuRankingFor = (_loc: unknown, segment: Segment): string[] =>
  MENUS.filter((m) => !m.signature)
    .sort((a, b) => b.appeal[segment] - a.appeal[segment])
    .map((m) => m.id);

/**
 * Field interviews: everybody walking around an area is a person with their own mood and their
 * own answers, so asking different people gives different information, and not everybody has
 * time to talk.
 */
export type Mood = 'friendly' | 'busy' | 'shy';
export type Approach = 'ask' | 'tea';

export interface Persona {
  /** Look id plus a seed, unique per person on the street. */
  id: string;
  look: string;
  name: string;
  tag: string;
  icon: string;
  segment: Segment;
  mood: Mood;
}

/** A finished conversation, as kept in the notebook. */
export interface Talk {
  id: string;
  look: string;
  name: string;
  tag: string;
  icon: string;
  quote: string;
  /** Short chips: what this person cares about. */
  chips: string[];
  /** Highest price they would pay for a cup. */
  price: number;
  /** Menu they like best. */
  likes: string;
  gotTea: boolean;
}

interface Kind {
  tag: string;
  icon: string;
  segment: Segment;
  male: boolean;
  /** Chance of each mood: friendly, busy, rest is shy. */
  moods: [number, number];
  names: string[];
}

const KINDS: Record<string, Kind> = {
  uni_boy: { tag: 'นักศึกษา', icon: '🎓', segment: 'student', male: true, moods: [0.55, 0.2], names: ['บอส', 'เจ', 'ก้อง', 'ภูมิ'] },
  uni_girl: { tag: 'นักศึกษา', icon: '🎓', segment: 'student', male: false, moods: [0.6, 0.2], names: ['มิ้นท์', 'ฟ้า', 'แพรว', 'ใบเตย'] },
  student_boy: { tag: 'นักเรียน', icon: '🎒', segment: 'student', male: true, moods: [0.45, 0.15], names: ['พีท', 'ไอซ์', 'กัน'] },
  student_girl: { tag: 'นักเรียน', icon: '🎒', segment: 'student', male: false, moods: [0.4, 0.15], names: ['น้ำฝน', 'ปุ๊กกี้', 'เฟิร์น'] },
  office_man: { tag: 'วัยทำงาน', icon: '💼', segment: 'worker', male: true, moods: [0.3, 0.55], names: ['คุณวิทย์', 'คุณเอก', 'คุณนที'] },
  office_woman: { tag: 'วัยทำงาน', icon: '💼', segment: 'worker', male: false, moods: [0.35, 0.5], names: ['คุณนุ่น', 'คุณแอน', 'คุณมุก'] },
  part_timer: { tag: 'พนักงานร้านค้า', icon: '🧢', segment: 'worker', male: true, moods: [0.5, 0.35], names: ['เอ็ม', 'ต้อม', 'นัท'] },
  parent_dad: { tag: 'คุณพ่อ', icon: '👨‍👧', segment: 'family', male: true, moods: [0.6, 0.2], names: ['พ่อต้น', 'พ่อโอ๊ต', 'พ่อเอก'] },
  parent_mom: { tag: 'คุณแม่', icon: '👩‍👧', segment: 'family', male: false, moods: [0.65, 0.15], names: ['แม่ปลา', 'แม่แพร', 'แม่มด'] },
  kid: { tag: 'เด็กน้อย', icon: '🧒', segment: 'family', male: true, moods: [0.35, 0.05], names: ['น้องปอ', 'น้องบีม', 'น้องภู'] },
  kid_girl: { tag: 'เด็กน้อย', icon: '👧', segment: 'family', male: false, moods: [0.3, 0.05], names: ['น้องมาย', 'น้องแพร', 'น้องฟิล์ม'] },
  elder: { tag: 'ผู้สูงอายุ', icon: '👴', segment: 'family', male: true, moods: [0.8, 0.05], names: ['ลุงชาติ', 'ตาสม', 'ลุงบุญ'] },
  grandma: { tag: 'ผู้สูงอายุ', icon: '👵', segment: 'family', male: false, moods: [0.8, 0.05], names: ['ยายบัว', 'ป้าหน่อย', 'ยายแจ๋ว'] },
  influencer: { tag: 'สายคอนเทนต์', icon: '📸', segment: 'student', male: false, moods: [0.55, 0.2], names: ['ลูกพีช', 'คุณสวีท', 'เบลล่า'] },
};

const kindOf = (look: string): Kind => KINDS[look] ?? KINDS.uni_girl;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function personaFor(look: string, seed: number): Persona {
  const k = kindOf(look);
  const r = rng(hash(`${look}|${seed}`));
  const roll = r();
  const mood: Mood = roll < k.moods[0] ? 'friendly' : roll < k.moods[0] + k.moods[1] ? 'busy' : 'shy';
  return { id: `${look}#${seed}`, look, name: k.names[Math.floor(r() * k.names.length)], tag: k.tag, icon: k.icon, segment: k.segment, mood };
}

export const MOOD_HINT: Record<Mood, string> = { friendly: '', busy: '💨 ดูรีบ', shy: '😳 ดูเขินๆ' };
export const TEA_PRICE = 20;

/** Will they stop and talk? Deterministic for each person and approach. */
export function willTalk(p: Persona, approach: Approach): boolean {
  const chance: Record<Mood, [number, number]> = { friendly: [0.9, 1], busy: [0.1, 0.6], shy: [0.35, 0.85] };
  return rng(hash(`${p.id}|${approach}`))() < chance[p.mood][approach === 'tea' ? 1 : 0];
}

/** What they say when they walk away. */
export function refusal(p: Persona): string {
  if (p.mood === 'busy') return 'ขอโทษนะ รีบมากเลย ไม่มีเวลาจริงๆ!';
  if (p.mood === 'shy') return 'เอ่อ... ไม่ดีกว่าค่ะ เขินอ่ะ';
  return 'วันนี้ขอผ่านนะ ไว้คราวหน้า';
}

const ALT: Record<string, string> = {
  student: 'ถูก คุ้ม มีที่นั่งทำงาน',
  worker: 'เร็ว ไม่ต้องรอ สั่งผ่านแอป',
  family: 'นั่งสบาย ลดหวานได้ เมนูเด็ก',
};

/** The answers a person gives. Different people in the same area give different answers. */
export function talkWith(locId: string, p: Persona, gotTea: boolean): Talk {
  const loc = LOCATION[locId];
  const rank = menuRankingFor(loc, p.segment);
  const r = rng(hash(`${p.id}|talk`));
  const likeId = rank[Math.floor(r() * Math.min(3, rank.length))];
  const likes = MENUS.find((m) => m.id === likeId)!.short;
  const grumble = loc.competitors.length ? `ร้าน ${loc.competitors[Math.floor(r() * loc.competitors.length)].name}` : 'ร้านแถวนี้';
  const cheap = p.segment === 'student' ? 35 : p.segment === 'worker' ? 55 : 45;
  const price = Math.round((cheap + (r() - 0.5) * 12) / 5) * 5;
  let quote: string;
  let chips: string[];
  switch (p.look) {
    case 'uni_boy':
    case 'uni_girl':
      quote = r() < 0.5 ? `ชอบ${likes} แต่ค่าขนมจำกัด เกิน ${price} บาทไม่ซื้อทุกวัน` : 'อยากได้ร้านที่นั่งอ่านหนังสือได้ มีปลั๊กไฟด้วยก็ดี';
      chips = ['ประหยัด', 'ที่นั่งทำงาน', 'โปรนักศึกษา'];
      break;
    case 'student_boy':
    case 'student_girl':
      quote = `หนูซื้อหลังเลิกเรียน งบวันละ ${price - 5} บาท ชอบ${likes}`;
      chips = ['งบน้อย', 'หวานๆ', 'ซื้อกลับ'];
      break;
    case 'office_man':
    case 'office_woman':
      quote = r() < 0.5 ? `พักเที่ยงสั้นมาก อยากได้${likes}แบบไม่ต้องรอ ${price} บาทจ่ายได้` : 'ถ้าสั่งผ่านแอปไปส่งที่ออฟฟิศได้ก็ดี จะสั่งประจำ';
      chips = ['รีบ', 'สั่งผ่านแอป', 'ไม่ชอบรอ'];
      break;
    case 'part_timer':
      quote = `เงินเดือนไม่เยอะ ซื้อได้แค่ ${price - 5} บาท ถ้ามีแต้มสะสมจะดีมาก`;
      chips = ['ประหยัด', 'แต้มสะสม'];
      break;
    case 'parent_dad':
    case 'parent_mom':
      quote = `พาลูกมาบ่อย ลูกชอบ${likes} อยากได้โปรซื้อหลายแก้ว`;
      chips = ['ซื้อหลายแก้ว', 'มีที่นั่ง', 'เมนูเด็ก'];
      break;
    case 'kid':
    case 'kid_girl':
      quote = `หนูชอบไข่มุกเยอะๆ! ชอบ${likes} หวานๆ`;
      chips = ['ไข่มุกเยอะ', 'หวานมาก'];
      break;
    case 'elder':
    case 'grandma':
      quote = r() < 0.5 ? 'ขอหวานน้อยนะ หมอสั่งให้ระวังน้ำตาล มีชาร้อนไหม?' : `ชอบ${likes} แต่ต้องลดหวาน แก้วเล็กๆ ก็พอ`;
      chips = ['หวานน้อย', 'แก้วเล็ก', 'ชาร้อน'];
      break;
    case 'influencer':
      quote = r() < 0.5 ? 'แก้วต้องน่ารักถ่ายรูปขึ้น ร้านมีมุมสวยๆ หนูโพสต์ให้เลย' : `${grumble}ไม่มีอะไรใหม่เลย อยากเจอเมนูแปลกๆ ถ่ายคอนเทนต์`;
      chips = ['ถ่ายรูป', 'เมนูใหม่', 'รีวิวให้'];
      break;
    default:
      quote = `ชอบ${likes} ${ALT[p.segment]}`;
      chips = ['คุ้มค่า'];
  }
  if (gotTea) quote = `ขอบคุณสำหรับชานมนะ! ${quote}`;
  return { id: p.id, look: p.look, name: p.name, tag: p.tag, icon: p.icon, quote, chips, price, likes, gotTea };
}
