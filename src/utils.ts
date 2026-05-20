/**
 * utils.ts — 순수 유틸리티 함수 모음
 * 다른 모듈에 의존하지 않습니다.
 *
 * 점진 마이그레이션 — TS-3 단계에서 핵심 함수 시그니처만 어노테이션.
 * 나머지(폰트 매핑, 색상 유틸 등 큰 부분)는 TS-4 strict 강화 시 정리.
 */

import type { MindNode, LinkType } from './types.js';

/** ID로 DOM 요소 가져오기. TS-4 단계에서는 호출처마다 input.value / button.disabled 등
 *  다양한 element 속성을 쓰므로 반환 타입을 any로 두고, strict 강화 단계에서
 *  제네릭 또는 narrow 캐스팅으로 정밀화한다. */
export const $ = (id: string): any => document.getElementById(id);

/** 고유 ID 생성 */
export const uid = (): string =>
  'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

/** 컬러 테마 프리셋 — 노드 색상 팔레트 (각 8색) */
export const COLOR_THEMES = {
  // ── Colorful ──────────────────────────────────────────
  default: ['#f85149', '#1f6feb', '#8957e5', '#3fb950', '#e3b341', '#39c5cf', '#ff7b72', '#d2a8ff'],
  dawn:    ['#ff7eb6', '#ffa07a', '#ffb86c', '#f1c40f', '#74c0fc', '#b197fc', '#ff8cc8', '#e599f7'],
  ocean:   ['#4dabf7', '#74c0fc', '#3bc9db', '#66d9e8', '#20c997', '#51cf66', '#22b8cf', '#15aabf'],
  forest:  ['#51cf66', '#94d82d', '#a9e34b', '#fcc419', '#ff922b', '#74c0fc', '#82c91e', '#37b24d'],
  sunset:  ['#ff6b6b', '#ff8787', '#ffa94d', '#ffd43b', '#ff8cc8', '#e599f7', '#fa5252', '#f76707'],
  roses:        ['#fce8ec', '#f8b7c5', '#f088a3', '#e94e7c', '#d62c5f', '#a01a48', '#7a1338', '#5c0e2a'],
  mint:         ['#e8f8f1', '#a7e8d4', '#5dd4b1', '#1fb898', '#0e9b7e', '#0a7c66', '#08604f', '#06463a'],
  greenTea:     ['#d4d9a3', '#a8b270', '#7f9152', '#5b7438', '#3e5524', '#857c33', '#5a4d1e', '#2a3b18'],
  space:        ['#bcd4e8', '#8eb3d6', '#5e8fc2', '#3a6bab', '#1d4a8b', '#10336a', '#082248', '#031529'],
  sophisticated:['#92400e', '#f5e6d3', '#a8a29e', '#dc2626', '#5c3a1e', '#2d1810', '#1f2937', '#0c0a09'],
  innocence:    ['#f4a4bc', '#f9c4d4', '#fce7f3', '#b8d4f0', '#7fa7d4', '#3b5b85', '#6b7280', '#374151'],
  macaron:      ['#f8c2b8', '#e8d5b5', '#fef3c7', '#d4e8d4', '#c2e0e0', '#d4c5e6', '#e8d5e8', '#7c7470'],
  woodland:     ['#d4cd5a', '#a8b260', '#7d8c4d', '#4d6837', '#3a4a25', '#857c33', '#bdb76b', '#2c2616'],
  cream:        ['#f7e0c2', '#f0c896', '#e0a566', '#b87a3d', '#8c5524', '#5a3416', '#3a200d', '#1e1006'],
  hawaii:       ['#ffd166', '#f8961e', '#f3722c', '#f94144', '#06d6a0', '#0a9396', '#0096c7', '#90e0ef'],

  // ── Classic ───────────────────────────────────────────
  mono:    ['#495057', '#6c757d', '#adb5bd', '#868e96', '#343a40', '#71717a', '#52525b', '#9ca3af'],
  constancy:    ['#3b66c4', '#dc2f3e', '#e8c632', '#2d8e54', '#3680c4', '#7a3ba8', '#e07a3a', '#ad2e58'],
  classicCream: ['#3680c4', '#dc2f3e', '#f0b132', '#e87a2c', '#3a9a91', '#5ab5a0', '#d6dca3', '#874e1e'],
  flowers:      ['#c92a2a', '#e88a18', '#bd2c34', '#3b66c4', '#1f7a7a', '#2d7a3a', '#1f3f8a', '#5e2e8a'],
  coral:        ['#f4a4a8', '#88c0d0', '#e88a82', '#e0c6a0', '#a8d4c0', '#7fadb8', '#3a5a78', '#c46060'],
  gorgeous:     ['#6e3416', '#a02828', '#d49a32', '#cc4a40', '#2d6a3e', '#2d5a9a', '#1f3a6e', '#0e1f3e'],
  champagne:    ['#e8d4a8', '#d4b890', '#c4a378', '#a89060', '#807050', '#605040', '#454040', '#2a2a2a'],
  perfume:      ['#a8a058', '#e08038', '#c43838', '#a07a40', '#6a5028', '#4a3818', '#382a1e', '#1f1814'],
  zen:          ['#f3f4f6', '#d1d5db', '#9ca3af', '#6b7280', '#4b5563', '#374151', '#1f2937', '#000000'],
  groove:       ['#e93b2d', '#f57c00', '#fbc02d', '#7cb342', '#039be5', '#3949ab', '#8e24aa', '#d81b60'],
};

export const THEME_NAMES = {
  default: 'Default',
  dawn:    'Dawn',
  ocean:   'Ocean',
  forest:  'Forest',
  sunset:  'Sunset',
  mono:    'Mono',
  roses:         'Roses',
  mint:          'Mint',
  greenTea:      'Green Tea',
  space:         'Space',
  sophisticated: 'Sophisticated',
  innocence:     'Innocence',
  macaron:       'Macaron',
  woodland:      'Woodland',
  cream:         'Cream',
  hawaii:        'Hawaii',
  constancy:     'Constancy',
  classicCream:  'Cream Classic',
  flowers:       'Flowers',
  coral:         'Coral',
  gorgeous:      'Gorgeous',
  champagne:     'Champagne',
  perfume:       'Perfume',
  zen:           'Zen',
  groove:        'Groove',
};

/** 스타일 패널의 테마 그리드 탭 구조 */
export const THEME_CATEGORIES = {
  Colorful: [
    'default', 'dawn', 'ocean', 'forest', 'sunset',
    'roses', 'mint', 'greenTea', 'space', 'sophisticated',
    'innocence', 'macaron', 'woodland', 'cream', 'hawaii',
  ],
  Classic: [
    'mono', 'constancy', 'classicCream', 'flowers', 'coral',
    'gorgeous', 'champagne', 'perfume', 'zen', 'groove',
  ],
};

/** 기본 노드 색상 팔레트 (하위 호환) */
export const COLORS = COLOR_THEMES.default;

/**
 * 테마 키 → 색상 배열. 빌트인이 우선이고, 없으면 customThemes에서 검색.
 * @param {string} themeKey
 * @param {Array<{id, name, palette: string[]}>} [customThemes]
 */
export function resolvePalette(themeKey, customThemes = []) {
  if (COLOR_THEMES[themeKey]) return COLOR_THEMES[themeKey];
  const custom = customThemes.find((t) => t.id === themeKey);
  return custom?.palette?.length ? custom.palette : COLOR_THEMES.default;
}

/** 현재 활성 팔레트 반환 (state 참조, customThemes는 선택적 인자) */
export function currentPalette(state: any, customThemes?: any) {
  return resolvePalette(state?.style?.theme, customThemes);
}

/** 연결선 두께 매핑 */
export const LINE_WIDTHS = { thin: 1.5, normal: 2.5, thick: 4 };

/**
 * 노드용 폰트 패밀리 — 시스템 폰트 위주(외부 다운로드 없음).
 * 각 항목은 한글+영문 글리프를 모두 커버하도록 적절히 fallback 체인 구성.
 */
export const FONT_FAMILIES = {
  // 시스템 기본
  default:    `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', sans-serif`,
  // 한글 고딕 계열
  gothic:     `'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif`,
  notoSans:   `'Noto Sans KR', 'Pretendard', 'Malgun Gothic', sans-serif`,
  pretendard: `'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif`,
  spoqa:      `'Spoqa Han Sans Neo', 'Spoqa Han Sans', 'Malgun Gothic', sans-serif`,
  nanumGothic:`'Nanum Gothic', 'Malgun Gothic', sans-serif`,
  // 한글 명조 계열
  serif:      `'AppleMyungjo', 'Batang', '바탕', Georgia, 'Times New Roman', serif`,
  nanumMyeong:`'Nanum Myeongjo', 'Batang', '바탕', Georgia, serif`,
  // 영문 위주
  helvetica:  `'Helvetica Neue', 'Helvetica', Arial, 'Malgun Gothic', sans-serif`,
  georgia:    `Georgia, 'Times New Roman', 'AppleMyungjo', 'Batang', serif`,
  garamond:   `Garamond, 'EB Garamond', Georgia, 'Batang', serif`,
  verdana:    `Verdana, Geneva, '맑은 고딕', sans-serif`,
  inter:      `'Inter', system-ui, '맑은 고딕', sans-serif`,
  // 둥근 / 디스플레이 / 손글씨
  rounded:    `'Nunito', 'Pretendard', system-ui, '맑은 고딕', sans-serif`,
  display:    `Impact, 'Arial Black', 'Malgun Gothic', sans-serif`,
  handwriting:`'Comic Sans MS', 'Brush Script MT', cursive`,
  // 고정폭
  mono:       `Consolas, Menlo, 'Courier New', monospace`,
  courier:    `'Courier New', Courier, monospace`,
};

export const FONT_NAMES = {
  default:    '기본 (시스템)',
  gothic:     '맑은 고딕',
  notoSans:   'Noto Sans',
  pretendard: 'Pretendard',
  spoqa:      'Spoqa Han Sans',
  nanumGothic:'나눔 고딕',
  serif:      '명조 (Batang)',
  nanumMyeong:'나눔 명조',
  helvetica:  'Helvetica',
  georgia:    'Georgia',
  garamond:   'Garamond',
  verdana:    'Verdana',
  inter:      'Inter',
  rounded:    '둥근 (Rounded)',
  display:    '디스플레이 (Impact)',
  handwriting:'손글씨 (Comic Sans)',
  mono:       'Consolas',
  courier:    'Courier New',
};

/**
 * 영문 전용 글리프 폰트 (한글은 다음 fallback이 처리).
 * 사용자가 fontEn / fontKr을 분리 지정하면 두 체인을 합성해 font-family로 사용.
 */
export const ENGLISH_FONTS = {
  system:      `system-ui, -apple-system, 'Segoe UI'`,
  helvetica:   `'Helvetica Neue', Helvetica, Arial`,
  georgia:     `Georgia, 'Times New Roman'`,
  garamond:    `Garamond, 'EB Garamond'`,
  verdana:     `Verdana, Geneva`,
  inter:       `'Inter'`,
  rounded:     `'Nunito'`,
  impact:      `Impact, 'Arial Black'`,
  courier:     `'Courier New', Courier`,
  consolas:    `Consolas, Menlo`,
  handwriting: `'Comic Sans MS', 'Brush Script MT'`,
};
export const ENGLISH_FONT_NAMES = {
  system:      'System',
  helvetica:   'Helvetica',
  georgia:     'Georgia',
  garamond:    'Garamond',
  verdana:     'Verdana',
  inter:       'Inter',
  rounded:     'Nunito (둥근)',
  impact:      'Impact',
  courier:     'Courier',
  consolas:    'Consolas',
  handwriting: 'Comic Sans',
};

/** 한글 전용 글리프 폰트 */
export const KOREAN_FONTS = {
  malgun:      `'Malgun Gothic', 'Apple SD Gothic Neo'`,
  notoSans:    `'Noto Sans KR'`,
  pretendard:  `'Pretendard'`,
  spoqa:       `'Spoqa Han Sans Neo', 'Spoqa Han Sans'`,
  nanumGothic: `'Nanum Gothic'`,
  batang:      `'Batang', '바탕', 'AppleMyungjo'`,
  nanumMyeong: `'Nanum Myeongjo'`,
};
export const KOREAN_FONT_NAMES = {
  malgun:      '맑은 고딕',
  notoSans:    'Noto Sans KR',
  pretendard:  'Pretendard',
  spoqa:       'Spoqa Han Sans',
  nanumGothic: '나눔 고딕',
  batang:      '바탕 (명조)',
  nanumMyeong: '나눔 명조',
};

/**
 * state.style의 폰트 설정을 CSS font-family 문자열로 합성.
 * customFonts 배열을 두 번째 인자로 받아 빌트인 외 사용자 폰트도 조회.
 */
export function composeFontFamily(style, customFonts = []) {
  const fEn = style?.fontEn;
  const fKr = style?.fontKr;
  if (fEn || fKr) {
    const parts = [];
    if (fEn && ENGLISH_FONTS[fEn]) parts.push(ENGLISH_FONTS[fEn]);
    if (fKr && KOREAN_FONTS[fKr])  parts.push(KOREAN_FONTS[fKr]);
    parts.push('sans-serif');
    return parts.join(', ');
  }
  // 빌트인 우선
  if (FONT_FAMILIES[style?.font]) return FONT_FAMILIES[style.font];
  // 커스텀 (settings.customFonts) 조회
  const cf = customFonts.find((c) => c.id === style?.font);
  if (cf && cf.family) return cf.family;
  return FONT_FAMILIES.default;
}

/** 기본 스타일 객체 */
export function defaultStyle() {
  return {
    theme: 'default',
    bgColor: null,           // null = CSS 변수 사용 (테마 따라감)
    lineWidth: 'normal',     // 'thin' | 'normal' | 'thick'
    coloredBranch: false,    // true: 자식 색상으로 연결선 표시
    font: 'default',         // FONT_FAMILIES 키
  };
}

/** 링크 타입별 이모지 아이콘 */
export function linkIcon(type: string): string {
  return ({
    drive: '📁', gdocs: '📄', gphotos: '📷', youtube: '▶️',
    image: '🖼️', notion: 'N', url: '🔗',
  } as Record<string, string>)[type] ?? '🔗';
}

/** 링크 타입별 기본 라벨 */
export function linkDefault(type: string): string {
  return ({
    drive: 'Drive', gdocs: 'Google Docs', gphotos: 'Google Photos',
    youtube: 'YouTube', image: '이미지', notion: 'Notion', url: '링크',
  } as Record<string, string>)[type] ?? '링크';
}

/**
 * 텍스트에서 http(s) URL들을 찾아 배열로 반환.
 * 끝에 붙은 문장부호(. , ; : ! ? ) ] }) 는 자동으로 제거.
 */
const URL_RE = /\bhttps?:\/\/\S+/gi;
export function findUrlsInText(text) {
  if (!text) return [];
  return [...text.matchAll(URL_RE)].map((m) => m[0].replace(/[.,;:!?)\]}>]+$/, ''));
}

/** URL 문자열에서 어떤 link type인지 자동 감지 */
export function detectLinkType(url) {
  if (!url) return 'url';
  const u = url.toLowerCase();
  if (/^https?:\/\/(www\.)?(notion\.so|notion\.site)/.test(u)) return 'notion';
  // Google Workspace 문서 — Docs/Sheets/Slides는 모두 docs.google.com 도메인
  if (/^https?:\/\/docs\.google\.com\/(document|spreadsheets|presentation)\//.test(u)) return 'gdocs';
  // Google Photos — 일반 공유 페이지 + 단축 URL
  if (/^https?:\/\/photos\.google\.com\//.test(u)) return 'gphotos';
  if (/^https?:\/\/photos\.app\.goo\.gl\//.test(u)) return 'gphotos';
  // 일반 Drive (파일·폴더 공유 등)
  if (/^https?:\/\/(www\.)?drive\.google\.com/.test(u)) return 'drive';
  if (/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/.test(u)) return 'youtube';
  if (/\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/.test(u)) return 'image';
  return 'url';
}

/**
 * Google Docs/Sheets/Slides URL을 iframe 임베드 가능한 /preview URL로 변환.
 * 예: .../document/d/{ID}/edit → .../document/d/{ID}/preview
 *     .../spreadsheets/d/{ID}/edit → .../spreadsheets/d/{ID}/preview
 *     .../presentation/d/{ID}/edit → .../presentation/d/{ID}/preview
 *
 * Google이 /preview 엔드포인트에 iframe 임베드를 허용 (편집 불가, 읽기 전용).
 * @returns {string|null} 변환된 URL, 또는 매칭 실패 시 null
 */
export function googleDocsPreviewUrl(url) {
  if (!url) return null;
  const m = url.match(/^(https?:\/\/docs\.google\.com\/(?:document|spreadsheets|presentation)\/d\/[a-zA-Z0-9_-]+)(?:\/(?:edit|view|preview|pub|htmlview))?(?:[?#].*)?$/);
  if (!m) return null;
  return m[1] + '/preview';
}

/**
 * 배경 색에 대비되는 글자 색 자동 선택 (WCAG 상대 휘도 기반).
 *   밝은 배경 → 짙은 회색 (#1f2937)
 *   어두운 배경 → 흰색 (#ffffff)
 * @param {string} bgHex - '#RRGGBB' 또는 'rgba(...)'
 * @returns {string} '#1f2937' 또는 '#ffffff'
 */
export function contrastingTextColor(bgHex) {
  if (!bgHex) return '#ffffff';
  let r, g, b;
  if (bgHex.startsWith('rgba') || bgHex.startsWith('rgb')) {
    const m = bgHex.match(/\d+(\.\d+)?/g);
    if (!m) return '#ffffff';
    r = Number(m[0]); g = Number(m[1]); b = Number(m[2]);
  } else {
    const hex = bgHex.replace('#', '');
    if (hex.length !== 6) return '#ffffff';
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  }
  // WCAG 상대 휘도 (간이 — sRGB 감마 보정 생략, 0..1)
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.6 ? '#1f2937' : '#ffffff';
}

/**
 * hex 색상을 밝게 만들기
 * @param {string} hex   예: '#1f6feb'
 * @param {number} pct   밝기 증가량 (0~255)
 */
export function lighten(hex, pct) {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.min(255, r + pct);
  g = Math.min(255, g + pct);
  b = Math.min(255, b + pct);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/**
 * 유튜브 URL에서 썸네일 이미지 URL 추출
 * @param {string} url
 * @returns {string|null}
 */
/**
 * URL이 비디오인지 자동 감지 — 확장자 + 알려진 video CDN 패턴.
 * data:video/* MIME도 비디오로 인식.
 */
export function isVideoUrl(url) {
  if (!url) return false;
  if (/^data:video\//i.test(url)) return true;
  // .mp4 / .webm / .mov / .ogv / .m4v / .ogg 확장자 (쿼리스트링 허용)
  if (/\.(mp4|webm|mov|m4v|ogv|ogg)(\?|#|$)/i.test(url)) return true;
  return false;
}

export function ytThumb(url) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null;
}

/** 새 노드 객체 생성 */
export function makeNode(
  id: string,
  text: string,
  x: number,
  y: number,
  parentId: string | null,
  color?: string,
): MindNode {
  return {
    id, text, x, y, parentId,
    color: color ?? '#1f6feb',
    links: [],
    icon: '',
    collapsed: false,    // true면 하위 트리 숨김
    image: null,         // {url, fit, height} 또는 null. url은 http(s) 또는 data:image/* 가능
    iconColor: null,     // Sticker(단색 SVG) 아이콘 색 오버라이드. null = 노드 텍스트 색 사용
    textColor: null,     // 명시적 글자 색. null = 배경 색에 대비되는 자동 색 (contrastingTextColor)
    note: '',            // 노드에 연결된 긴 노트 (모달에서 편집). 빈 문자열이면 없음.
    tasks: [],           // [{id, text, done}] — 노드 내부 체크박스 할 일 목록
    numbering: 'none',   // 'none' | '1' | 'A' | 'a' | 'I' — 자식 노드 텍스트에 자동 prefix
    textStyle: {
      bold: false, italic: false, underline: false, strikethrough: false,
      size: 'medium',   // 'small' | 'medium' | 'large'
      align: 'center',  // 'left' | 'center' | 'right'
      strokeWidth: 0,    // 텍스트 스트로크 두께 (px). 0이면 없음.
      strokeColor: null, // null = 폰트 색을 따름 (textColor 또는 자동 대비), 명시 시 hex
    },
    shape: 'rounded',     // 'rounded' | 'sharp' | 'pill'
    borderWidth: 'thin',  // 'none' | 'thin' | 'normal' | 'thick' | 'xthick' | 'huge'
    outlineWidth: 'none', // 'none' | 'thin' | 'normal' | 'thick' | 'huge' (box-shadow 후광 링)
    outlineColor: null,   // null = node.color에서 자동 (밝게). hex로 지정 가능
    branchStyle: {
      color: null,        // 부모-이 노드 연결선 색 오버라이드. null = 기본/coloredBranch 따름
      width: null,        // 두께 오버라이드. null = 전역 lineWidth
      dash:  null,        // 'solid' | 'dashed' | 'dotted'. null = 실선
    },
  };
}

/**
 * collapsed 노드의 후손 ID Set을 계산.
 * 어떤 노드의 조상 중 하나라도 collapsed면 그 노드는 hidden.
 * 외부 사용처: render(접힌 노드 후손 스킵), search(검색 매치 이동 시 조상 펴기).
 *
 * @returns 숨겨진 노드 ID 집합 (접힌 부모 자신은 포함되지 않음)
 */
export function computeHiddenIds(nodes: Record<string, MindNode>): Set<string> {
  // 부모ID → 자식 ID 배열 캐시 (한 번만 순회)
  const childrenOf: Record<string, string[]> = {};
  Object.values(nodes).forEach((n) => {
    if (n.parentId) {
      (childrenOf[n.parentId] ||= []).push(n.id);
    }
  });

  const hidden = new Set<string>();
  const stack: string[] = [];
  Object.values(nodes).forEach((n) => {
    if (n.collapsed) (childrenOf[n.id] ?? []).forEach((cid) => stack.push(cid));
  });
  while (stack.length) {
    const id = stack.pop() as string;
    if (hidden.has(id)) continue;
    hidden.add(id);
    (childrenOf[id] ?? []).forEach((cid) => stack.push(cid));
  }
  return hidden;
}

/** 자식을 가진 부모 노드 ID 집합 */
export function parentIdsSet(nodes: Record<string, MindNode>): Set<string> {
  const s = new Set<string>();
  Object.values(nodes).forEach((n) => {
    if (n.parentId) s.add(n.parentId);
  });
  return s;
}

/** 넘버링 포맷 키 → 표시 라벨 */
export const NUMBERING_FORMATS = {
  'none': 'None',
  '1':    '1.2.3.',
  'A':    'A.B.C.',
  'a':    'a.b.c.',
  'I':    'I.II.III.',
};

/** 정수 → 로마 숫자 (1~3999) */
function toRoman(n: number): string {
  if (n <= 0) return '';
  const map: Array<[string, number]> = [
    ['M', 1000], ['CM', 900], ['D', 500], ['CD', 400],
    ['C', 100], ['XC', 90], ['L', 50], ['XL', 40],
    ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1],
  ];
  let r = '';
  for (const [s, v] of map) {
    while (n >= v) { r += s; n -= v; }
  }
  return r;
}

/**
 * 넘버링 prefix 생성. 0-based index를 받아 1-based 라벨 반환.
 * @param {string} format - 'none' | '1' | 'A' | 'a' | 'I'
 * @param {number} index
 * @returns {string} 'A.' 등 (없으면 빈 문자열)
 */
export function formatNumber(format, index) {
  if (!format || format === 'none') return '';
  const i = index + 1;
  switch (format) {
    case '1': return `${i}.`;
    case 'A': {
      // Excel 컬럼식 — 26개 넘으면 AA, AB, ...
      let s = '';
      let n = i;
      while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
      return `${s}.`;
    }
    case 'a': {
      let s = '';
      let n = i;
      while (n > 0) { n--; s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26); }
      return `${s}.`;
    }
    case 'I': return `${toRoman(i)}.`;
    default:  return '';
  }
}

/** 점선 패턴 (stroke-dasharray) — dash gap [dash gap ...] 형식.
 *  stroke-linecap이 butt(직각)이라 dash가 정확히 표기된 길이만큼 보임.
 *  'wavy'는 dasharray가 아닌 SVG filter로 처리 (render.js에서 분기).
 */
export const DASH_PATTERNS = {
  solid:      '',                  // ─────────
  longDash:   '24 10',             // ────  ────  ────
  dashed:     '12 8',              // ──  ──  ──   (기본 점선)
  denseDash:  '6 4',               // - - - - - -
  dashDot:    '14 6 2 6',          // ──  ·  ──  ·
  dashDotDot: '14 5 2 5 2 5',      // ──  ·  ·  ──  ·  ·
  dotted:     '2 7',               // ·   ·   ·   ·
  wavy:       'wavy',              // ~~~~~~~~ (filter 기반)
};

/** 점선 패턴 한국어 라벨 — UI 옵션 */
export const DASH_NAMES = {
  solid:      '실선',
  longDash:   '긴 점선',
  dashed:     '점선',
  denseDash:  '촘촘한 점선',
  dashDot:    '점-쇄선',
  dashDotDot: '두점-쇄선',
  dotted:     '점',
  wavy:       '물결 (~)',
};

/**
 * 부모-자식 연결선의 cubic Bezier 제어점 두 개 계산 (curved 스타일 전용).
 *
 *   - n.branchStyle.handles.c1, c2 가 있으면 그 값을 사용 (사용자 수동 조정)
 *   - 없으면 strength 기반 기본 제어점 (c1=(p.x+dx*strength, p.y), c2=(n.x-dx*strength, n.y))
 *
 * 핸들 dx/dy는 endpoint(c1=parent, c2=child) 기준 상대 오프셋.
 *
 * @param {{x,y}} p 부모 노드 좌표
 * @param {{x,y, branchStyle?}} n 자식 노드 (branchStyle.handles 검사)
 * @param {number} strength 0..1
 * @returns {{c1:{x,y}, c2:{x,y}}}
 */
export function getBranchControls(p, n, strength) {
  const h = n?.branchStyle?.handles;
  if (h?.c1 && h?.c2) {
    return {
      c1: { x: p.x + h.c1.dx, y: p.y + h.c1.dy },
      c2: { x: n.x + h.c2.dx, y: n.y + h.c2.dy },
    };
  }
  const s  = Math.max(0, Math.min(1, strength ?? 0.5));
  const dx = n.x - p.x;
  return {
    c1: { x: p.x + dx * s, y: p.y },
    c2: { x: n.x - dx * s, y: n.y },
  };
}

/**
 * 관계선의 cubic Bezier 제어점 두 개 계산.
 *
 *   - r.handles.c1, c2 가 있으면 그 값을 사용 (사용자 조정 결과)
 *   - 옛 r.curveOffset (quadratic) 만 있으면 cubic 두 점으로 변환
 *   - 둘 다 없으면 기본 수직 오프셋
 *
 * @param {{handles?, curveOffset?}} r
 * @param {{x:number,y:number}} a 시작 노드
 * @param {{x:number,y:number}} b 끝 노드
 * @returns {{c1:{x,y}, c2:{x,y}}}
 */
export function getRelationControls(r, a, b) {
  // 사용자 조정 — 두 핸들 모두 있을 때
  if (r?.handles?.c1 && r?.handles?.c2) {
    return {
      c1: { x: a.x + r.handles.c1.dx, y: a.y + r.handles.c1.dy },
      c2: { x: b.x + r.handles.c2.dx, y: b.y + r.handles.c2.dy },
    };
  }

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const curve = Math.min(80, len * 0.25);
  const px = -dy / len * curve;
  const py =  dx / len * curve;

  // 옛 quadratic 데이터 변환 — curveOffset(중점 기준) 을 양쪽 control에 그대로 적용
  if (r?.curveOffset && typeof r.curveOffset.dx === 'number') {
    return {
      c1: { x: a.x + dx / 3   + r.curveOffset.dx, y: a.y + dy / 3   + r.curveOffset.dy },
      c2: { x: a.x + 2*dx / 3 + r.curveOffset.dx, y: a.y + 2*dy / 3 + r.curveOffset.dy },
    };
  }

  // 기본: 1/3·2/3 지점에 수직 오프셋
  return {
    c1: { x: a.x + dx / 3   + px, y: a.y + dy / 3   + py },
    c2: { x: a.x + 2*dx / 3 + px, y: a.y + 2*dy / 3 + py },
  };
}

/** 노드 텍스트 크기 매핑 (px) — 6단계 */
export const NODE_SIZES = {
  xsmall: '10px',
  small:  '12px',
  medium: '14px',   // 기본
  large:  '17px',
  xlarge: '22px',
  huge:   '28px',
};

/** UI 라벨 */
export const NODE_SIZE_NAMES = {
  xsmall: '아주 작게 (10px)',
  small:  '작게 (12px)',
  medium: '보통 (14px)',
  large:  '크게 (17px)',
  xlarge: '아주 크게 (22px)',
  huge:   '거대 (28px)',
};
/** 노드 모양 → border-radius */
export const NODE_SHAPES = { rounded: '14px', sharp: '3px', pill: '50px' };
/** 노드 테두리 두께 */
export const NODE_BORDERS = {
  none: '0', thin: '1px', normal: '2px', thick: '4px',
  xthick: '6px', huge: '10px',
};

/**
 * 노드 외곽 스트로크 (border 외부에 떠 있는 후광 링) — box-shadow `0 0 0 N` 패턴.
 * border와 별개로 적용되며 콘텐츠 영역을 잠식하지 않음.
 */
export const NODE_OUTLINES = {
  none: 0, thin: 3, normal: 6, thick: 10, huge: 14,
};

/**
 * 이모지 라이브러리 — Marker / Sticker / Illustration 세 탭, 카테고리별 그룹.
 *
 * 카테고리 키는 영어 (XMind 스타일 정렬)이고, 사용자에게는 ICON_CAT_NAMES_KR로 번역해 표시.
 * Marker: 작은 표식 (태그, 우선순위, 태스크, 플래그)
 * Sticker: 평면 이모지 아이콘 (업무·교육·기술 등)
 * Illustration: 장식적인 일러스트 (장면·테마성)
 */
export const ICON_GROUPS = {
  marker: {
    'Tag':       ['🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '🟤', '⚫', '⚪'],
    'Priority':  ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'],
    'Task':      ['✅', '☑️', '⬜', '⏳', '🔄', '❌', '🔁', '⏸️', '▶️'],
    'Flag':      ['🚩', '🏁', '🎌', '📍', '📌', '🔖'],
    'Star':      ['⭐', '🌟', '✨', '⚡', '💫', '🔥', '💯'],
    'People':    ['👤', '👥', '🧑', '👨', '👩', '👶', '🎓', '👑'],
    'Symbol':    ['💡', '⚠️', '❓', '❗', '❕', '🔔', '🎯', '❤️', '👍', '👎', '🆗', '🆕'],
  },
  sticker: {
    'Business':       ['💼', '💰', '💳', '📊', '📈', '📉', '🧮', '🗂️', '📁', '📋', '📑', '📰', '🖇️', '📎', '✉️', '🆗'],
    'Education':      ['🎓', '📚', '📖', '📓', '✏️', '📝', '🖋️', '🖊️', '🔬', '🧪', '🌍', '🗺️', '📐', '📏', '🎒', '🧑‍🎓'],
    'Communication':  ['💬', '💭', '📞', '📟', '📧', '📨', '📤', '📥', '📢', '📣', '🎤', '📻', '🔔'],
    'Tech':           ['💻', '📱', '⌨️', '🖱️', '🖥️', '🌐', '📡', '🛰️', '🔌', '🔋', '⚙️', '🔧', '🛠️', '🚀', '💾', '📷'],
    'Time':           ['📅', '🗓️', '⏰', '⏱️', '⏲️', '⌛', '⏳', '🕐', '🕒', '🕘'],
  },
  illustration: {
    'Productivity':   ['📊', '📈', '📉', '💼', '🧮', '💰', '🗓️', '📋', '📂', '🎨', '💡', '📝', '🖼️'],
    'Travel':         ['🏝️', '🏞️', '🌌', '🗺️', '🛳️', '✈️', '🚐', '🚌', '🎈', '🚁', '⛰️', '🏖️', '🗽', '🏔️', '🚂', '🛫'],
    'Holiday':        ['🎂', '🎃', '🎅', '⛄', '🎆', '🎇', '🎉', '🎁', '🎮', '🎪', '🌲', '🎄', '🎀', '🪅', '🧨'],
    'Food & Drink':   ['🍔', '🍣', '🍜', '🥗', '🍇', '🌮', '🍰', '🍩', '☕', '🍵', '🍺', '🍕', '🌭', '🍱', '🥐', '🍷'],
    'Nature':         ['🌳', '🌲', '🌴', '🌵', '🌷', '🌹', '🌻', '🌼', '🍀', '🌈', '🌊', '🔥', '❄️', '⭐', '🌙', '☀️'],
    'Animals':        ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🦋', '🐝', '🐬', '🐢'],
  },
};

/** 탭 라벨 (스크린샷처럼 영문) */
export const ICON_TAB_NAMES = {
  marker:       'Marker',
  sticker:      'Sticker',
  illustration: 'Illustration',
};

/** 카테고리 영어 → 한국어 보조 라벨 (드롭다운에 같이 표시) */
export const ICON_CAT_NAMES_KR = {
  Tag:           '태그',
  Priority:      '우선순위',
  Task:          '태스크',
  Flag:          '플래그',
  Star:          '별/포인트',
  People:        '사람',
  Symbol:        '기호',
  Business:      '비즈니스',
  Education:     '교육',
  Communication: '소통',
  Tech:          '기술',
  Time:          '시간',
  Productivity:  '생산성',
  Travel:        '여행',
  Holiday:       '휴일',
  'Food & Drink':'음식·음료',
  Nature:        '자연',
  Animals:       '동물',
};

/**
 * 노드 다중 선택 헬퍼 — state.selectedIds와 state.selectedId를 일관되게 갱신.
 * 단일 선택은 selectedId에 반영하고, 다중일 땐 selectedId = null.
 * 노드 선택이 변경되면 콜아웃/존 선택은 자동 해제 — 동시에 두 종류가 선택돼
 * 시각 표시가 누적되는 것을 막음.
 */
export function setNodeSelection(state, ids) {
  state.selectedIds = Array.isArray(ids) ? [...ids] : [];
  state.selectedId  = state.selectedIds.length === 1 ? state.selectedIds[0] : null;
  state.selectedCalloutId = null;
  state.selectedZoneId    = null;
}

/** 노드 선택 모두 해제 (콜아웃·존 선택도 함께 해제) */
export function clearNodeSelection(state) {
  state.selectedIds = [];
  state.selectedId  = null;
  state.selectedCalloutId = null;
  state.selectedZoneId    = null;
}

/** 관계선 다중 선택 — selectedRelationIds와 selectedRelationId를 일관되게 갱신.
 *  마찬가지로 콜아웃/존 선택도 자동 해제. */
export function setRelationSelection(state, ids) {
  state.selectedRelationIds = Array.isArray(ids) ? [...ids] : [];
  state.selectedRelationId  = state.selectedRelationIds.length === 1 ? state.selectedRelationIds[0] : null;
  state.selectedCalloutId = null;
  state.selectedZoneId    = null;
}

/** 관계선 선택 모두 해제 (콜아웃·존 선택도 함께 해제) */
export function clearRelationSelection(state) {
  state.selectedRelationIds = [];
  state.selectedRelationId  = null;
  state.selectedCalloutId = null;
  state.selectedZoneId    = null;
}

/**
 * 카카오톡·라인·페이스북 등 인앱 브라우저 감지.
 * Google OAuth는 보안 정책상 임베디드 웹뷰에서의 로그인을 차단하므로,
 * 사용자에게 외부 브라우저로 열도록 안내해야 한다.
 * @returns {{name:string, label:string}|null}
 */
export function detectInAppBrowser() {
  const ua = navigator.userAgent || '';
  if (/KAKAOTALK/i.test(ua))       return { name: 'kakaotalk', label: '카카오톡' };
  if (/NAVER\(inapp/i.test(ua))    return { name: 'naver',     label: '네이버 앱' };
  if (/Line\//i.test(ua))          return { name: 'line',      label: '라인' };
  if (/FBAN|FBAV/i.test(ua))       return { name: 'facebook',  label: '페이스북' };
  if (/Instagram/i.test(ua))       return { name: 'instagram', label: '인스타그램' };
  if (/MicroMessenger/i.test(ua))  return { name: 'wechat',    label: '위챗' };
  if (/Daum/i.test(ua))            return { name: 'daum',      label: '다음 앱' };
  if (/everytimeApp/i.test(ua))    return { name: 'everytime', label: '에브리타임' };
  if (/zumApp/i.test(ua))          return { name: 'zum',       label: 'zum 앱' };
  // 일반적인 in-app webview 의심: iOS는 Safari가 빠짐, Android는 wv가 있음
  // 너무 공격적이라 위양성 위험. 위 명시적 케이스만 처리.
  return null;
}
