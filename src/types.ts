export type ViewType = "plan" | "section";

export interface DrawPoint {
  x: number;
  y: number;
}

export type RevisionSource = "initial" | "direct" | "merged";

export interface Revision {
  version: number;
  author: string;
  time: string; // ISO
  note: string;
  points: DrawPoint[];
  source: RevisionSource;
}

export interface ViewState {
  committed: Revision;
  history: Revision[]; // 按版本升序
  staleSince: string | null; // 非空 = 另一侧已改动，本视图失效待复核
}

export interface Candidate {
  id: string;
  author: string;
  time: string;
  baseVersion: number; // 提交时基于的版本
  points: DrawPoint[];
  note: string;
}

export interface Artifact {
  name: string;
  count: number;
}

export interface Unit {
  id: string;
  name: string;
  type: string;
  square: string; // 探方
  artifacts: Artifact[];
  views: Record<ViewType, ViewState>;
  candidates: Record<ViewType, Candidate[]>;
}

export interface Draft {
  unitId: string;
  view: ViewType;
  user: string;
  baseVersion: number;
  points: DrawPoint[];
  updatedAt: string;
}

export type DiffChoice = "current" | "candidate" | "add" | "drop" | "keep" | "remove";

export type DiffItem =
  | { kind: "modify"; index: number; current: DrawPoint; candidate: DrawPoint }
  | { kind: "add"; index: number; candidate: DrawPoint }
  | { kind: "remove"; index: number; current: DrawPoint };
