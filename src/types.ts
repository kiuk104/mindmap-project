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
export interface NodeBranchStyle {
  color?: string | null;
  width?: number | null;
  dash?: 'solid' | 'dashed' | 'dotted' | null;
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
  cp1?: { x: number; y: number };
  cp2?: { x: number; y: number };
}

// ── 콜아웃 ──
export interface Callout {
  id: string;
  parentId: string;
  text: string;
  x: number;
  y: number;
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
