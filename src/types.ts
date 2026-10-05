// 双视图校核台领域类型

export type ViewKind = "plan" | "section";

export interface Point {
  x: number;
  y: number;
}

/** 一次正式提交的轮廓版本 */
export interface Revision {
  id: string;
  author: string;
  time: string;
  note: string;
  points: Point[];
}

/** 冲突提交生成的候选线：逐点处理差异后才可采纳 */
export interface CandidateLine {
  id: string;
  author: string;
  time: string;
  note: string;
  /** 绘制时所基于的版本，用于说明冲突来源 */
  baseRevisionId: string;
  points: Point[];
  /** 差异点抉择：差异序号 -> 保留当前线 / 采用候选线 */
  decisions: Record<number, "current" | "candidate">;
}

export type LogKind = "commit" | "review" | "candidate" | "adopt" | "discard" | "stale";

export interface LogEntry {
  id: string;
  time: string;
  author: string;
  kind: LogKind;
  text: string;
}

/** 单个视图（平面图或剖面图）的校核状态 */
export interface ViewState {
  revisions: Revision[]; // 末位为当前生效线
  stale: boolean; // 另一侧改动后置 true，待复核
  candidate: CandidateLine | null;
  log: LogEntry[];
}

/** 遗迹单位 */
export interface FeatureUnit {
  id: string;
  name: string;
  type: string;
  square: string; // 探方
  layer: string; // 地层
  soil: string; // 土色
  artifacts: number; // 出土物数量
  plan: ViewState;
  section: ViewState;
}

/** 未完成的绘图草稿：实时落盘，保存失败/重开可恢复续画 */
export interface Draft {
  user: string;
  unitId: string;
  view: ViewKind;
  baseRevisionId: string;
  points: Point[];
  updatedAt: string;
}
