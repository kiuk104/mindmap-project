/**
 * popular-fonts.js — Google Fonts 인기 목록 (큐레이션).
 *
 * 사용자가 폰트 찾기 모달에서 검색·선택할 후보. 카테고리별로 ~80개.
 * Google Fonts API 키 없이도 사용 가능 — 이름만 알면 CDN으로 자동 다운로드.
 */

export const POPULAR_FONTS = [
  // ── 한글 ───────────────────────────────────────────
  { name: 'Noto Sans KR',       cat: 'Korean Sans' },
  { name: 'Noto Serif KR',      cat: 'Korean Serif' },
  { name: 'Nanum Gothic',       cat: 'Korean Sans' },
  { name: 'Nanum Myeongjo',     cat: 'Korean Serif' },
  { name: 'Nanum Pen Script',   cat: 'Korean Handwriting' },
  { name: 'Nanum Brush Script', cat: 'Korean Handwriting' },
  { name: 'Black Han Sans',     cat: 'Korean Display' },
  { name: 'Black And White Picture', cat: 'Korean Display' },
  { name: 'Do Hyeon',           cat: 'Korean Display' },
  { name: 'Hi Melody',          cat: 'Korean Handwriting' },
  { name: 'Jua',                cat: 'Korean Display' },
  { name: 'Stylish',            cat: 'Korean Sans' },
  { name: 'Sunflower',          cat: 'Korean Sans' },
  { name: 'Cute Font',          cat: 'Korean Handwriting' },
  { name: 'Gugi',               cat: 'Korean Display' },
  { name: 'Gaegu',              cat: 'Korean Handwriting' },
  { name: 'Pretendard',         cat: 'Korean Sans' },
  { name: 'IBM Plex Sans KR',   cat: 'Korean Sans' },

  // ── 영문 Sans-serif ────────────────────────────────
  { name: 'Roboto',             cat: 'Sans-serif' },
  { name: 'Open Sans',          cat: 'Sans-serif' },
  { name: 'Lato',               cat: 'Sans-serif' },
  { name: 'Montserrat',         cat: 'Sans-serif' },
  { name: 'Poppins',            cat: 'Sans-serif' },
  { name: 'Inter',              cat: 'Sans-serif' },
  { name: 'Raleway',            cat: 'Sans-serif' },
  { name: 'Source Sans 3',      cat: 'Sans-serif' },
  { name: 'Nunito',             cat: 'Sans-serif' },
  { name: 'Nunito Sans',        cat: 'Sans-serif' },
  { name: 'Work Sans',          cat: 'Sans-serif' },
  { name: 'Mulish',             cat: 'Sans-serif' },
  { name: 'Manrope',            cat: 'Sans-serif' },
  { name: 'DM Sans',            cat: 'Sans-serif' },
  { name: 'Karla',              cat: 'Sans-serif' },
  { name: 'Quicksand',          cat: 'Sans-serif' },
  { name: 'Rubik',              cat: 'Sans-serif' },
  { name: 'Ubuntu',             cat: 'Sans-serif' },
  { name: 'Oswald',             cat: 'Sans-serif' },
  { name: 'PT Sans',            cat: 'Sans-serif' },
  { name: 'Hind',               cat: 'Sans-serif' },
  { name: 'Barlow',             cat: 'Sans-serif' },
  { name: 'Heebo',              cat: 'Sans-serif' },

  // ── 영문 Serif ────────────────────────────────────
  { name: 'Roboto Slab',        cat: 'Serif' },
  { name: 'Merriweather',       cat: 'Serif' },
  { name: 'Playfair Display',   cat: 'Serif' },
  { name: 'Lora',               cat: 'Serif' },
  { name: 'PT Serif',           cat: 'Serif' },
  { name: 'Source Serif 4',     cat: 'Serif' },
  { name: 'EB Garamond',        cat: 'Serif' },
  { name: 'Crimson Text',       cat: 'Serif' },
  { name: 'Bitter',             cat: 'Serif' },
  { name: 'Cormorant Garamond', cat: 'Serif' },
  { name: 'Libre Baskerville',  cat: 'Serif' },
  { name: 'Cardo',              cat: 'Serif' },
  { name: 'Spectral',           cat: 'Serif' },
  { name: 'Vollkorn',           cat: 'Serif' },

  // ── 모노스페이스 (코드 친화) ──────────────────────
  { name: 'JetBrains Mono',     cat: 'Monospace' },
  { name: 'Fira Code',          cat: 'Monospace' },
  { name: 'Source Code Pro',    cat: 'Monospace' },
  { name: 'IBM Plex Mono',      cat: 'Monospace' },
  { name: 'Roboto Mono',        cat: 'Monospace' },
  { name: 'Inconsolata',        cat: 'Monospace' },
  { name: 'Space Mono',         cat: 'Monospace' },
  { name: 'Cousine',            cat: 'Monospace' },

  // ── 손글씨·캘리그래피 ────────────────────────────
  { name: 'Caveat',             cat: 'Handwriting' },
  { name: 'Dancing Script',     cat: 'Handwriting' },
  { name: 'Pacifico',           cat: 'Handwriting' },
  { name: 'Shadows Into Light', cat: 'Handwriting' },
  { name: 'Indie Flower',       cat: 'Handwriting' },
  { name: 'Architects Daughter',cat: 'Handwriting' },
  { name: 'Permanent Marker',   cat: 'Handwriting' },
  { name: 'Kalam',              cat: 'Handwriting' },

  // ── 디스플레이·장식 ──────────────────────────────
  { name: 'Bebas Neue',         cat: 'Display' },
  { name: 'Anton',              cat: 'Display' },
  { name: 'Righteous',          cat: 'Display' },
  { name: 'Lobster',            cat: 'Display' },
  { name: 'Comfortaa',          cat: 'Display' },
  { name: 'Press Start 2P',     cat: 'Display' },
  { name: 'Abril Fatface',      cat: 'Display' },
  { name: 'Archivo Black',      cat: 'Display' },
];
