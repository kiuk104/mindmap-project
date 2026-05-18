/**
 * icon-manifest.mjs — 자산 다운로드 목록 (사람이 편집)
 *
 *   - sticker: Lucide 아이콘 이름 (kebab-case)
 *   - illustration: OpenMoji 이모지 { name, code }
 *     · code는 OpenMoji 저장소의 SVG 파일명 (변형 선택자 FE0F 제외 코드포인트)
 *     · 다운로드 실패 시 fetch-icons.mjs가 'CODE-FE0F'로 한 번 더 시도
 *
 * 새 아이콘을 원하면 여기 추가 후 `npm run icons` 재실행.
 */

export const MANIFEST = {
  // ── Sticker — Lucide (ISC) ──
  sticker: {
    Business: [
      'briefcase', 'banknote', 'credit-card', 'calculator',
      'chart-line', 'chart-bar', 'archive', 'folder',
      'file-text', 'paperclip', 'mail', 'target',
    ],
    Education: [
      'graduation-cap', 'book', 'book-open', 'pencil',
      'flask-conical', 'beaker', 'globe', 'map',
      'ruler', 'scissors',
    ],
    Communication: [
      'message-square', 'message-circle', 'phone', 'send',
      'mic', 'megaphone', 'bell', 'radio',
    ],
    Tech: [
      'laptop', 'smartphone', 'monitor', 'mouse-pointer',
      'satellite', 'plug', 'battery', 'settings',
      'wrench', 'rocket', 'save', 'camera',
    ],
    Time: [
      'calendar', 'calendar-days', 'clock', 'hourglass',
      'timer', 'alarm-clock', 'history', 'watch',
    ],
  },

  // ── Illustration — OpenMoji (CC BY-SA 4.0) ──
  illustration: {
    Productivity: [
      { name: 'chart',       code: '1F4CA' },  // 📊
      { name: 'trending-up', code: '1F4C8' },  // 📈
      { name: 'briefcase',   code: '1F4BC' },  // 💼
      { name: 'money-bag',   code: '1F4B0' },  // 💰
      { name: 'calendar',    code: '1F5D3' },  // 🗓️
      { name: 'palette',     code: '1F3A8' },  // 🎨
      { name: 'bulb',        code: '1F4A1' },  // 💡
      { name: 'memo',        code: '1F4DD' },  // 📝
    ],
    Travel: [
      { name: 'island',      code: '1F3DD' },  // 🏝️
      { name: 'landscape',   code: '1F3DE' },  // 🏞️
      { name: 'airplane',    code: '2708'  },  // ✈️
      { name: 'ship',        code: '1F6F3' },  // 🛳️
      { name: 'map',         code: '1F5FA' },  // 🗺️
      { name: 'helicopter',  code: '1F681' },  // 🚁
      { name: 'beach',       code: '1F3D6' },  // 🏖️
      { name: 'mountain',    code: '1F3D4' },  // 🏔️
    ],
    Holiday: [
      { name: 'birthday',    code: '1F382' },  // 🎂
      { name: 'pumpkin',     code: '1F383' },  // 🎃
      { name: 'santa',       code: '1F385' },  // 🎅
      { name: 'snowman',     code: '26C4'  },  // ⛄
      { name: 'fireworks',   code: '1F386' },  // 🎆
      { name: 'party',       code: '1F389' },  // 🎉
      { name: 'gift',        code: '1F381' },  // 🎁
      { name: 'tree',        code: '1F384' },  // 🎄
    ],
    'Food & Drink': [
      { name: 'burger',      code: '1F354' },  // 🍔
      { name: 'sushi',       code: '1F363' },  // 🍣
      { name: 'ramen',       code: '1F35C' },  // 🍜
      { name: 'salad',       code: '1F957' },  // 🥗
      { name: 'taco',        code: '1F32E' },  // 🌮
      { name: 'cake',        code: '1F370' },  // 🍰
      { name: 'donut',       code: '1F369' },  // 🍩
      { name: 'coffee',      code: '2615'  },  // ☕
      { name: 'beer',        code: '1F37A' },  // 🍺
      { name: 'pizza',       code: '1F355' },  // 🍕
    ],
    Nature: [
      { name: 'tree',        code: '1F333' },  // 🌳
      { name: 'evergreen',   code: '1F332' },  // 🌲
      { name: 'tulip',       code: '1F337' },  // 🌷
      { name: 'rose',        code: '1F339' },  // 🌹
      { name: 'sunflower',   code: '1F33B' },  // 🌻
      { name: 'rainbow',     code: '1F308' },  // 🌈
      { name: 'wave',        code: '1F30A' },  // 🌊
      { name: 'fire',        code: '1F525' },  // 🔥
      { name: 'snowflake',   code: '2744'  },  // ❄️
      { name: 'star',        code: '2B50'  },  // ⭐
    ],
    Animals: [
      { name: 'dog',         code: '1F436' },  // 🐶
      { name: 'cat',         code: '1F431' },  // 🐱
      { name: 'fox',         code: '1F98A' },  // 🦊
      { name: 'bear',        code: '1F43B' },  // 🐻
      { name: 'panda',       code: '1F43C' },  // 🐼
      { name: 'lion',        code: '1F981' },  // 🦁
      { name: 'cow',         code: '1F42E' },  // 🐮
      { name: 'frog',        code: '1F438' },  // 🐸
      { name: 'butterfly',   code: '1F98B' },  // 🦋
      { name: 'bee',         code: '1F41D' },  // 🐝
    ],
  },
};
