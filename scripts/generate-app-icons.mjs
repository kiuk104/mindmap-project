/**
 * generate-app-icons.mjs — public/icon-512.svg를 iOS/PWA 용 PNG로 변환
 *
 * 사용: npm run gen-icons
 *
 * 생성물 (public/icons/app/):
 *   apple-touch-icon.png            (180x180) — iOS 기본 home screen 아이콘
 *   apple-touch-icon-180.png        (180x180) — sizes 명시용 (iPhone)
 *   apple-touch-icon-167.png        (167x167) — iPad Pro
 *   apple-touch-icon-152.png        (152x152) — iPad
 *   apple-touch-icon-120.png        (120x120) — iPhone @2x
 *   icon-192.png                    (192x192) — Android/Chrome PWA
 *   icon-512.png                    (512x512) — PWA maskable + 큰 사이즈
 *   icon-maskable-512.png           (512x512) — safe area padding 포함 maskable
 */

import sharp from 'sharp';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const ROOT       = resolve(__dirname, '..');
const SRC_SVG    = join(ROOT, 'public', 'icon-512.svg');
const OUT_DIR    = join(ROOT, 'public', 'icons', 'app');

const ANY_SIZES = [
  { name: 'apple-touch-icon.png',     size: 180 },
  { name: 'apple-touch-icon-180.png', size: 180 },
  { name: 'apple-touch-icon-167.png', size: 167 },
  { name: 'apple-touch-icon-152.png', size: 152 },
  { name: 'apple-touch-icon-120.png', size: 120 },
  { name: 'icon-192.png',             size: 192 },
  { name: 'icon-512.png',             size: 512 },
];

/** maskable SVG는 iOS/Android 마스킹을 고려해 safe-area(중앙 80%)에 그림이 들어가도록 padding 추가 */
function makeMaskableSvg(innerSvg, totalSize = 512, safeRatio = 0.8) {
  const pad = Math.round((totalSize * (1 - safeRatio)) / 2);
  const inner = totalSize - pad * 2;
  // 배경색은 원본 SVG 첫 rect의 fill과 동일하게 (#1f6feb)
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}">
  <rect width="${totalSize}" height="${totalSize}" fill="#1f6feb"/>
  <g transform="translate(${pad} ${pad}) scale(${inner / 512})">
    ${innerSvg}
  </g>
</svg>`;
}

async function main() {
  const svg = await readFile(SRC_SVG, 'utf8');
  await mkdir(OUT_DIR, { recursive: true });

  // 일반 사이즈 — 원본 SVG 그대로 비율 유지 렌더
  for (const { name, size } of ANY_SIZES) {
    const out = join(OUT_DIR, name);
    await sharp(Buffer.from(svg), { density: 384 })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(out);
    console.log(`✓ ${name} (${size}x${size})`);
  }

  // maskable 512 — 중앙 80% safe-area에 들어가도록 padding 추가
  // 원본 SVG 안쪽 그래픽만 추출 (xmlns 선언 + <svg> 래퍼 제거)
  const innerMatch = svg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  const inner = innerMatch ? innerMatch[1] : svg;
  const maskableSvg = makeMaskableSvg(inner, 512, 0.8);
  await sharp(Buffer.from(maskableSvg), { density: 384 })
    .resize(512, 512)
    .png({ compressionLevel: 9 })
    .toFile(join(OUT_DIR, 'icon-maskable-512.png'));
  console.log(`✓ icon-maskable-512.png (512x512, safe-area 80%)`);

  console.log(`\n📁 출력: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error('아이콘 생성 실패:', err);
  process.exit(1);
});
