/**
 * config.js — 외부 서비스 설정
 *
 * 구글 드라이브 연동을 사용하려면:
 *   1. https://console.cloud.google.com 에서 OAuth 2.0 클라이언트 ID 발급
 *   2. 자세한 단계: DRIVE_SETUP.md 참조
 *   3. 발급받은 클라이언트 ID를 아래 GOOGLE_CLIENT_ID에 붙여넣기
 *
 * 비어 있으면 Drive 기능이 비활성화되고 다른 기능은 정상 동작합니다.
 * OAuth 클라이언트 ID는 공개되어도 안전 — 보안은 "승인된 자바스크립트 원본"으로 통제됩니다.
 */

export const GOOGLE_CLIENT_ID = '';
