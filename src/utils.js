/**
 * utils.js — 순수 유틸리티 함수 모음
 * 다른 모듈에 의존하지 않습니다.
 */

/** ID로 DOM 요소 가져오기 */
export const $ = (id) => document.getElementById(id);

/** 고유 ID 생성 */
export const uid = () =>
  'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

/** 컬러 테마 프리셋 — 노드 색상 팔레트 */
export const COLOR_THEMES = {
  default: ['#f85149', '#1f6feb', '#8957e5', '#3fb950', '#e3b341', '#39c5cf', '#ff7b72', '#d2a8ff'],
  dawn:    ['#ff7eb6', '#ffa07a', '#ffb86c', '#f1c40f', '#74c0fc', '#b197fc', '#ff8cc8', '#e599f7'],
  ocean:   ['#4dabf7', '#74c0fc', '#3bc9db', '#66d9e8', '#20c997', '#51cf66', '#22b8cf', '#15aabf'],
  forest:  ['#51cf66', '#94d82d', '#a9e34b', '#fcc419', '#ff922b', '#74c0fc', '#82c91e', '#37b24d'],
  sunset:  ['#ff6b6b', '#ff8787', '#ffa94d', '#ffd43b', '#ff8cc8', '#e599f7', '#fa5252', '#f76707'],
  mono:    ['#495057', '#6c757d', '#adb5bd', '#868e96', '#343a40', '#71717a', '#52525b', '#9ca3af'],
};

export const THEME_NAMES = {
  default: 'Default',
  dawn:    'Dawn',
  ocean:   'Ocean',
  forest:  'Forest',
  sunset:  'Sunset',
  mono:    'Mono',
};

/** 기본 노드 색상 팔레트 (하위 호환) */
export const COLORS = COLOR_THEMES.default;

/** 현재 활성 팔레트 반환 (state 참조) */
export function currentPalette(state) {
  return COLOR_THEMES[state?.style?.theme] ?? COLOR_THEMES.default;
}

/** 연결선 두께 매핑 */
export const LINE_WIDTHS = { thin: 1.5, normal: 2.5, thick: 4 };

/** 노드용 폰트 패밀리 (외부 의존 없음, 시스템 폰트만) */
export const FONT_FAMILIES = {
  default: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
  gothic:  `'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif`,
  serif:   `'AppleMyungjo', 'Batang', '바탕', Georgia, 'Times New Roman', serif`,
  mono:    `Consolas, Menlo, 'Courier New', monospace`,
};

export const FONT_NAMES = {
  default: '기본',
  gothic:  '고딕',
  serif:   '명조',
  mono:    '고정폭',
};

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
  return { drive: '📄', youtube: '▶️', image: '🖼️', url: '🔗' }[type] ?? '🔗';
}

/** 링크 타입별 기본 라벨 */
export function linkDefault(type) {
  return { drive: 'Drive', youtube: 'YouTube', image: '이미지', url: '링크' }[type] ?? '링크';
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
    textStyle: {
      bold: false, italic: false, underline: false, strikethrough: false,
      size: 'medium',   // 'small' | 'medium' | 'large'
      align: 'center',  // 'left' | 'center' | 'right'
    },
    shape: 'rounded',     // 'rounded' | 'sharp' | 'pill'
    borderWidth: 'thin',  // 'none' | 'thin' | 'normal' | 'thick'
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

/** 점선 패턴 (stroke-dasharray) */
export const DASH_PATTERNS = {
  solid:  '',
  dashed: '6 4',
  dotted: '1.5 4',
};

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
export const NODE_BORDERS = { none: '0', thin: '1px', normal: '2px', thick: '4px' };

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
