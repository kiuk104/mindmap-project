/**
 * utils.js — 순수 유틸리티 함수 모음
 * 다른 모듈에 의존하지 않습니다.
 */

/** ID로 DOM 요소 가져오기 */
export const $ = (id) => document.getElementById(id);

/** 고유 ID 생성 */
export const uid = () =>
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
export function currentPalette(state, customThemes) {
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
 * 우선순위:
 *   1) fontEn / fontKr이 하나라도 있으면 영문→한글→fallback 체인으로 조합
 *   2) 아니면 단일 프리셋 FONT_FAMILIES[font] 사용
 *   3) 둘 다 없으면 default
 */
export function composeFontFamily(style) {
  const fEn = style?.fontEn;
  const fKr = style?.fontKr;
  if (fEn || fKr) {
    const parts = [];
    if (fEn && ENGLISH_FONTS[fEn]) parts.push(ENGLISH_FONTS[fEn]);
    if (fKr && KOREAN_FONTS[fKr])  parts.push(KOREAN_FONTS[fKr]);
    parts.push('sans-serif');
    return parts.join(', ');
  }
  return FONT_FAMILIES[style?.font] ?? FONT_FAMILIES.default;
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
export function linkIcon(type) {
  return {
    drive: '📁', gdocs: '📄', youtube: '▶️', image: '🖼️', notion: 'N', url: '🔗',
  }[type] ?? '🔗';
}

/** 링크 타입별 기본 라벨 */
export function linkDefault(type) {
  return {
    drive: 'Drive', gdocs: 'Google Docs', youtube: 'YouTube',
    image: '이미지', notion: 'Notion', url: '링크',
  }[type] ?? '링크';
}

/** URL 문자열에서 어떤 link type인지 자동 감지 */
export function detectLinkType(url) {
  if (!url) return 'url';
  const u = url.toLowerCase();
  if (/^https?:\/\/(www\.)?(notion\.so|notion\.site)/.test(u)) return 'notion';
  // Google Workspace 문서 — Docs/Sheets/Slides는 모두 docs.google.com 도메인
  if (/^https?:\/\/docs\.google\.com\/(document|spreadsheets|presentation)\//.test(u)) return 'gdocs';
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
export function ytThumb(url) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null;
}

/** 새 노드 객체 생성 */
export function makeNode(id, text, x, y, parentId, color) {
  return {
    id, text, x, y, parentId,
    color: color ?? '#1f6feb',
    links: [],
    icon: '',
    collapsed: false,    // true면 하위 트리 숨김
    image: null,         // {url, fit, height} 또는 null. url은 http(s) 또는 data:image/* 가능
    iconColor: null,     // Sticker(단색 SVG) 아이콘 색 오버라이드. null = 노드 텍스트 색 사용
    textStyle: {
      bold: false, italic: false, underline: false, strikethrough: false,
      size: 'medium',   // 'small' | 'medium' | 'large'
      align: 'center',  // 'left' | 'center' | 'right'
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
 * @param {Object.<string,Node>} nodes
 * @returns {Set<string>} 숨겨진 노드 ID 집합 (접힌 부모 자신은 포함되지 않음)
 */
export function computeHiddenIds(nodes) {
  // 부모ID → 자식 ID 배열 캐시 (한 번만 순회)
  const childrenOf = {};
  Object.values(nodes).forEach((n) => {
    if (n.parentId) {
      (childrenOf[n.parentId] ||= []).push(n.id);
    }
  });

  const hidden = new Set();
  const stack = [];
  Object.values(nodes).forEach((n) => {
    if (n.collapsed) (childrenOf[n.id] ?? []).forEach((cid) => stack.push(cid));
  });
  while (stack.length) {
    const id = stack.pop();
    if (hidden.has(id)) continue;
    hidden.add(id);
    (childrenOf[id] ?? []).forEach((cid) => stack.push(cid));
  }
  return hidden;
}

/**
 * 어떤 노드가 자식을 가지는지 빠르게 알기 위한 Set 생성.
 * @param {Object.<string,Node>} nodes
 * @returns {Set<string>} 자식을 가진 부모 노드 ID 집합
 */
export function parentIdsSet(nodes) {
  const s = new Set();
  Object.values(nodes).forEach((n) => {
    if (n.parentId) s.add(n.parentId);
  });
  return s;
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

/** 노드 텍스트 크기 매핑 (px) */
export const NODE_SIZES = { small: '11px', medium: '13px', large: '17px' };
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
 */
export function setNodeSelection(state, ids) {
  state.selectedIds = Array.isArray(ids) ? [...ids] : [];
  state.selectedId  = state.selectedIds.length === 1 ? state.selectedIds[0] : null;
}

/** 노드 선택 모두 해제 */
export function clearNodeSelection(state) {
  state.selectedIds = [];
  state.selectedId  = null;
}

/** 관계선 다중 선택 — selectedRelationIds와 selectedRelationId를 일관되게 갱신 */
export function setRelationSelection(state, ids) {
  state.selectedRelationIds = Array.isArray(ids) ? [...ids] : [];
  state.selectedRelationId  = state.selectedRelationIds.length === 1 ? state.selectedRelationIds[0] : null;
}

/** 관계선 선택 모두 해제 */
export function clearRelationSelection(state) {
  state.selectedRelationIds = [];
  state.selectedRelationId  = null;
}
