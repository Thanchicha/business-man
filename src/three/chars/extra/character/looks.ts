/**
 * Looks for the background cast. Pure data (no three.js) so the game's character specs can use
 * it: one rigged model is built per look, from the shared body and face, by choosing the hair,
 * the clothes, the colours and the overall size (children are smaller, older people a little).
 */
export type HairStyle = 'short' | 'long';
export type TopKind = 'tee' | 'shirt' | 'jacket';
export type BottomKind = 'shorts' | 'pants' | 'skirt';
export type HatKind = 'none' | 'visor';

export interface LookColors {
  skin: string;
  hair: string;
  iris: string;
  /** Tee, shirt or jacket. */
  top: string;
  /** Shirt worn under a jacket. */
  inner: string;
  bottom: string;
  shoe: string;
  /** Tie, apron and hat; also the inner ear. */
  accent: string;
  /** Cat ear colour (defaults to the hair). */
  ear?: string;
}

export interface ExtraLook {
  id: string;
  hair: HairStyle;
  top: TopKind;
  long: boolean; // long sleeves
  bottom: BottomKind;
  tie?: boolean;
  apron?: boolean;
  hat?: HatKind;
  glasses?: boolean;
  /** Cat ears on the head. */
  ears?: boolean;
  /** Overall height multiplier against the main cast. */
  scale: number;
  colors: LookColors;
}

const LIGHT = '#fdf1ec';
const TAN = '#f1cfb4';
const BROWN = '#7b5236';
const DARK_EYE = '#4a3b4f';

/** Kid in a tee and shorts. */
export const KID: ExtraLook = {
  id: 'kid', hair: 'short', top: 'tee', long: false, bottom: 'shorts', scale: 0.84,
  colors: { skin: LIGHT, hair: '#8a5f45', iris: BROWN, top: '#ff9a52', inner: '#ffffff', bottom: '#46557d', shoe: '#ff7a6b', accent: '#ffffff' },
};

/** Schoolboy: white short-sleeved shirt, red tie, navy trousers. */
export const STUDENT_BOY: ExtraLook = {
  id: 'student_boy', hair: 'short', top: 'shirt', long: false, bottom: 'pants', tie: true, scale: 0.93,
  colors: { skin: TAN, hair: '#2a2530', iris: DARK_EYE, top: '#fbfbfd', inner: '#ffffff', bottom: '#2d3a63', shoe: '#2b2830', accent: '#d8434f' },
};

/** Schoolgirl: white blouse, red ribbon tie, navy pleated skirt, long black hair. */
export const STUDENT_GIRL: ExtraLook = {
  id: 'student_girl', hair: 'long', top: 'shirt', long: false, bottom: 'skirt', tie: true, scale: 0.93,
  colors: { skin: LIGHT, hair: '#2b2328', iris: DARK_EYE, top: '#fbfbfd', inner: '#ffffff', bottom: '#2d3a63', shoe: '#3a2f38', accent: '#d8434f' },
};

/** Office worker (man): grey suit jacket, white shirt, blue tie, glasses. */
export const OFFICE_MAN: ExtraLook = {
  id: 'office_man', hair: 'short', top: 'jacket', long: true, bottom: 'pants', tie: true, glasses: true, scale: 1,
  colors: { skin: TAN, hair: '#1f1c24', iris: DARK_EYE, top: '#646d82', inner: '#ffffff', bottom: '#444a5c', shoe: '#2a2024', accent: '#2f56a6' },
};

/** Office worker (woman): beige jacket over a white blouse, charcoal skirt, long brown hair. */
export const OFFICE_WOMAN: ExtraLook = {
  id: 'office_woman', hair: 'long', top: 'jacket', long: true, bottom: 'skirt', scale: 0.98,
  colors: { skin: LIGHT, hair: '#5a3a2c', iris: BROWN, top: '#e4cba3', inner: '#ffffff', bottom: '#4d4856', shoe: '#5a3e34', accent: '#ffffff' },
};

/** Part-timer at a shop: red tee, brown apron, red visor cap. */
export const PART_TIMER: ExtraLook = {
  id: 'part_timer', hair: 'short', top: 'tee', long: false, bottom: 'pants', apron: true, hat: 'visor', scale: 0.97,
  colors: { skin: TAN, hair: '#2a2530', iris: DARK_EYE, top: '#e8484f', inner: '#ffffff', bottom: '#36343c', shoe: '#f4f1f5', accent: '#8a5a3c' },
};

/** Barista: dark brown shirt, cream apron, short black hair. */
export const BARISTA: ExtraLook = {
  id: 'barista', hair: 'short', top: 'shirt', long: false, bottom: 'pants', apron: true, scale: 1,
  colors: { skin: TAN, hair: '#2a2530', iris: DARK_EYE, top: '#5b4636', inner: '#ffffff', bottom: '#34323a', shoe: '#2b2830', accent: '#f1e3cf' },
};

/** Service staff: pink blouse, white apron, long hair, a skirt. */
export const SERVER: ExtraLook = {
  id: 'server', hair: 'long', top: 'shirt', long: false, bottom: 'skirt', apron: false, tie: true, scale: 0.98,
  colors: { skin: LIGHT, hair: '#6b4a3a', iris: BROWN, top: '#ffb6d2', inner: '#ffffff', bottom: '#fff4f8', shoe: '#f6dce8', accent: '#ff7eb6' },
};

/** Elderly customer: lilac cardigan, khaki trousers, grey hair, glasses. */
export const ELDER: ExtraLook = {
  id: 'elder', hair: 'short', top: 'jacket', long: true, bottom: 'pants', glasses: true, scale: 0.94,
  colors: { skin: '#f6dccb', hair: '#cfcfd8', iris: BROWN, top: '#a58bc2', inner: '#fff6e8', bottom: '#a09070', shoe: '#6a4a3a', accent: '#ffffff' },
};

/** Owner of a rival shop: black shirt, a long apron in the shop's colour and bleached hair. */
export function rivalOwner(shopColor: string): ExtraLook {
  return {
    id: `rival_owner_${shopColor.replace('#', '')}`, hair: 'short', top: 'shirt', long: true, bottom: 'pants', apron: true, glasses: false, scale: 1,
    colors: { skin: TAN, hair: '#f0d28a', iris: '#3d5ea8', top: '#2d2d38', inner: '#ffffff', bottom: '#2f2d36', shoe: '#e9e4ea', accent: shopColor },
  };
}

/** Child in a pink tee and skirt. */
export const KID_GIRL: ExtraLook = {
  id: 'kid_girl', hair: 'long', top: 'tee', long: false, bottom: 'skirt', scale: 0.84,
  colors: { skin: LIGHT, hair: '#4a3328', iris: BROWN, top: '#f58fb4', inner: '#ffffff', bottom: '#8fc8f0', shoe: '#ffffff', accent: '#ffffff' },
};

/** University student (man): hooded jacket, jeans, trainers. */
export const UNI_BOY: ExtraLook = {
  id: 'uni_boy', hair: 'short', top: 'jacket', long: true, bottom: 'pants', scale: 0.98,
  colors: { skin: TAN, hair: '#3a2c26', iris: DARK_EYE, top: '#7fb2d8', inner: '#ffffff', bottom: '#4f5f86', shoe: '#f4f1f5', accent: '#ffffff' },
};

/** University student (woman): cropped tee, skirt, long hair. */
export const UNI_GIRL: ExtraLook = {
  id: 'uni_girl', hair: 'long', top: 'tee', long: false, bottom: 'skirt', scale: 0.95,
  colors: { skin: LIGHT, hair: '#6b4630', iris: BROWN, top: '#ffe59a', inner: '#ffffff', bottom: '#6a7aa6', shoe: '#ffffff', accent: '#ffffff' },
};

/** Dad: polo shirt, khaki trousers. */
export const PARENT_DAD: ExtraLook = {
  id: 'parent_dad', hair: 'short', top: 'tee', long: false, bottom: 'pants', scale: 1,
  colors: { skin: TAN, hair: '#2d2420', iris: DARK_EYE, top: '#5fa8a0', inner: '#ffffff', bottom: '#b09a72', shoe: '#5a4636', accent: '#ffffff' },
};

/** Mum: blouse and a long skirt. */
export const PARENT_MOM: ExtraLook = {
  id: 'parent_mom', hair: 'long', top: 'shirt', long: false, bottom: 'skirt', scale: 0.98,
  colors: { skin: LIGHT, hair: '#3a2820', iris: BROWN, top: '#f6d9d4', inner: '#ffffff', bottom: '#8aa690', shoe: '#e9ddd0', accent: '#ffffff' },
};

/** Grandmother: lilac-grey cardigan, long skirt, silver hair, glasses. */
export const GRANDMA: ExtraLook = {
  id: 'grandma', hair: 'long', top: 'jacket', long: true, bottom: 'skirt', glasses: true, scale: 0.92,
  colors: { skin: '#f6dccb', hair: '#d4d2da', iris: BROWN, top: '#c9a3b4', inner: '#fff6e8', bottom: '#7a6a8a', shoe: '#6a4a3a', accent: '#ffffff' },
};

/** Content-loving influencer: pastel hair, a bright top, a short skirt, a visor cap. */
export const INFLUENCER: ExtraLook = {
  id: 'influencer', hair: 'long', top: 'tee', long: false, bottom: 'skirt', hat: 'visor', scale: 0.97,
  colors: { skin: LIGHT, hair: '#f2a6d0', iris: '#8a4fa8', top: '#b9a6ff', inner: '#ffffff', bottom: '#ff9fc6', shoe: '#ffffff', accent: '#ffffff' },
};

/** Regular: sleepy white cat boy. */
export const REGULAR_SLEEPY: ExtraLook = {
  id: 'regular_sleepy', hair: 'short', top: 'tee', long: true, bottom: 'pants', ears: true, scale: 0.97,
  colors: { skin: LIGHT, hair: '#eeeaec', iris: '#e27b9e', top: '#fbfbfb', inner: '#ffffff', bottom: '#cfcbd2', shoe: '#2a262c', accent: '#ffbfd2', ear: '#eeeaec' },
};

/** Regular: shy girl with black cat ears. */
export const REGULAR_SHY: ExtraLook = {
  id: 'regular_shy', hair: 'long', top: 'tee', long: false, bottom: 'pants', ears: true, scale: 0.95,
  colors: { skin: LIGHT, hair: '#5d4c4a', iris: '#6b5452', top: '#3a3338', inner: '#ffffff', bottom: '#f1ebed', shoe: '#221e22', accent: '#4a4248', ear: '#2a2529' },
};

/** Furniture delivery driver: orange shirt, cap. */
export const DRIVER: ExtraLook = {
  id: 'driver', hair: 'short', top: 'shirt', long: false, bottom: 'pants', hat: 'visor', scale: 1,
  colors: { skin: TAN, hair: '#2d2420', iris: DARK_EYE, top: '#ff9a3c', inner: '#ffffff', bottom: '#3d4a63', shoe: '#3a3340', accent: '#ffffff' },
};

/** Landlord: grey hair, brown shirt, glasses. */
export const LANDLORD: ExtraLook = {
  id: 'landlord', hair: 'short', top: 'shirt', long: true, bottom: 'pants', glasses: true, scale: 0.97,
  colors: { skin: '#f6d6c2', hair: '#c9c4c8', iris: BROWN, top: '#7a5a44', inner: '#f1e3cf', bottom: '#3a363e', shoe: '#2b2830', accent: '#f1e3cf' },
};

/** Bank teller: blue shirt with a white tie. */
export const TELLER: ExtraLook = {
  id: 'teller', hair: 'long', top: 'shirt', long: false, bottom: 'skirt', tie: true, scale: 0.98,
  colors: { skin: LIGHT, hair: '#5a3a2c', iris: BROWN, top: '#2f6fae', inner: '#ffffff', bottom: '#2a3550', shoe: '#2b2830', accent: '#ffffff' },
};

/** Delivery rider: green jacket and cap. */
export const RIDER: ExtraLook = {
  id: 'rider', hair: 'short', top: 'tee', long: true, bottom: 'pants', hat: 'visor', scale: 0.98,
  colors: { skin: TAN, hair: '#2a2530', iris: DARK_EYE, top: '#3fb36b', inner: '#ffffff', bottom: '#2f2d36', shoe: '#f4f1f5', accent: '#ffffff' },
};

export const LOOKS: Record<string, ExtraLook> = {
  kid: KID,
  kid_girl: KID_GIRL,
  uni_boy: UNI_BOY,
  uni_girl: UNI_GIRL,
  parent_dad: PARENT_DAD,
  parent_mom: PARENT_MOM,
  grandma: GRANDMA,
  influencer: INFLUENCER,
  regular_sleepy: REGULAR_SLEEPY,
  regular_shy: REGULAR_SHY,
  driver: DRIVER,
  landlord: LANDLORD,
  teller: TELLER,
  rider: RIDER,
  student_boy: STUDENT_BOY,
  student_girl: STUDENT_GIRL,
  office_man: OFFICE_MAN,
  office_woman: OFFICE_WOMAN,
  part_timer: PART_TIMER,
  barista: BARISTA,
  server: SERVER,
  elder: ELDER,
  rival_owner: rivalOwner('#5cc9a7'),
};
