/**
 * types.ts — 앱 전체에서 공유되는 핵심 타입 정의
 *
 * 실제 state.js / utils.js(makeNode) / render.js 코드를 기준으로 작성.
 * strict=false 상태에서 시작하며, 점진 마이그레이션 이후 strict 강화 시
 * 누락된 필드/optional 여부를 조정한다.
 */

// ── 링크 ──
export type LinkType = 'drive' | 'youtube' | 'image' | 'url' | 'gphotos';
export interface Link {
  type: LinkType;
  url: string;
  label: string;
}

// ── 노드 내부 텍스트 스타일 ──
export interface NodeTextStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  size?: 'small' | 'medium' | 'large';
  align?: 'left' | 'center' | 'right';
  strokeWidth?: number;
  strokeColor?: string | null;
}

// ── 노드 → 부모 연결선 스타일 오버라이드 ──
export interface CurveHandle {
  c1: { dx: number; dy: number };
  c2: { dx: number; dy: number };
}
export interface NodeBranchStyle {
  color?: string | null;
  width?: number | null;
  dash?: 'solid' | 'dashed' | 'dotted' | null;
  /** 사용자가 곡선 핸들을 드래그해 조정한 control point 오프셋 */
  handles?: CurveHandle;
}

// ── 노드 본문 임베드 이미지/비디오 ──
export interface NodeMedia {
  url: string;
  fit?: 'cover' | 'contain';
  height?: number;
  type?: 'image' | 'video';
}

// ── 노드 내부 체크박스 할 일 ──
export interface Task {
  id: string;
  text: string;
  done: boolean;
}

// ── 노드 ──
export interface MindNode {
  id: string;
  text: string;
  x: number;
  y: number;
  parentId: string | null;
  color: string;
  links: Link[];
  icon?: string;
  iconColor?: string | null;
  textColor?: string | null;
  collapsed?: boolean;
  image?: NodeMedia | null;
  note?: string;
  tasks?: Task[];
  numbering?: 'none' | '1' | 'A' | 'a' | 'I';
  textStyle?: NodeTextStyle;
  shape?: 'rounded' | 'sharp' | 'pill';
  borderWidth?: 'none' | 'thin' | 'normal' | 'thick' | 'xthick' | 'huge';
  outlineWidth?: 'none' | 'thin' | 'normal' | 'thick' | 'huge';
  outlineColor?: string | null;
  branchStyle?: NodeBranchStyle;
}

// ── 관계선 ──
export interface RelationStyle {
  color?: string;
  dash?: 'solid' | 'dashed' | 'dotted';
  width?: number;
  arrow?: 'end' | 'start' | 'both' | 'none';
}
export interface Relation {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
  style?: RelationStyle;
  /** 사용자 조정 곡선 핸들 (utils.getRelationControls 참고) */
  handles?: CurveHandle;
  /** 옛 quadratic 데이터 — 중점 기준 단일 오프셋 (점진적으로 handles로 마이그레이션) */
  curveOffset?: { dx: number; dy: number };
}

// ── 콜아웃 (부모 노드 기준 dx/dy 오프셋으로 위치 표현) ──
export interface Callout {
  id: string;
  parentId: string;
  dx: number;
  dy: number;
  text: string;
  color?: string;
  textColor?: string;
}

// ── 존 ──
export interface Zone {
  id: string;
  nodeIds: string[];
  label?: string;
  color?: string;
  opacity?: number;
  borderColor?: string;
  borderDash?: string;
  borderWidth?: number;
}

// ── 맵 전체 스타일 ──
export interface MapStyle {
  theme: string;
  bgColor: string | null;
  lineWidth: 'thin' | 'normal' | 'thick';
  coloredBranch: boolean;
  font: string;
  fontEn: string | null;
  fontKr: string | null;
  curveStrength: number;
}

// ── 앱 전체 상태 ──
export type LineStyle = 'straight' | 'curved' | 'stepped';

export interface AppState {
  nodes: Record<string, MindNode>;
  relations: Relation[];
  callouts: Callout[];
  zones: Zone[];
  selectedId: string | null;
  selectedIds: string[];
  selectedRelationId: string | null;
  selectedRelationIds: string[];
  selectedCalloutId: string | null;
  selectedZoneId: string | null;
  relationDraft: { fromId: string } | null;
  ctxTargetId: string | null;
  modalKind: string | null;
  searchQuery: string;
  searchHits: string[];
  searchIdx: number;
  lineStyle: LineStyle;
  style: MapStyle;
}

// ── Drive ──
export interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
}
export interface AuthSnapshot {
  available: boolean;
  initialized: boolean;
  signedIn: boolean;
  email: string | null;
}

// ── 직렬화 포맷 (io.serialize / io.loadFromString) ──
export interface SerializedMap {
  nodes: Record<string, MindNode>;
  relations: Relation[];
  callouts: Callout[];
  zones: Zone[];
  style: MapStyle;
  lineStyle: LineStyle;
  /** lastSave.name이 truth source — 외부 공유 시 이름 보존용 */
  title?: string;
  version: number;
}

// ── 마지막 저장 위치 (io.js) ──
export interface LastSave {
  kind: 'download' | 'drive';
  name: string;
  driveFileId?: string;
}

// ── Google API 글로벌 (drive.ts) ──
// gapi.client.drive 및 google.accounts.oauth2는 외부 스크립트로 로드되므로
// 자세한 타입을 강제하지 않고 any로 두되 typecheck를 통과시키기 위해 선언만 추가.
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}
export {};
