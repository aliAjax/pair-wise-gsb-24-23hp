import {
  Candidate,
  DiffChoice,
  DiffItem,
  DrawPoint,
  Draft,
  Revision,
  Unit,
  ViewType,
} from "./types";
import { seedUnits } from "./seed";

export const USERS = ["队员甲", "队员乙", "领队"];

export const VIEW_LABEL: Record<ViewType, string> = {
  plan: "平面图",
  section: "剖面图",
};

export const SOURCE_LABEL: Record<Revision["source"], string> = {
  initial: "初始测绘",
  direct: "直接保存",
  merged: "候选合并",
};

const UNITS_KEY = "arch-wb-units-v1";
const DRAFTS_KEY = "arch-wb-drafts-v1";

export interface Notice {
  kind: "info" | "success" | "error";
  text: string;
}

export interface Editing {
  unitId: string;
  view: ViewType;
  user: string;
}

export interface State {
  units: Unit[];
  currentUser: string;
  selectedUnitId: string;
  editing: Editing | null;
  drafts: Record<string, Draft>; // key: unitId:view:user
  historyView: Record<string, number | null>; // key: unitId:view -> 正在查看的旧线版本
  decisions: Record<string, Record<number, DiffChoice>>; // candidateId -> 差异序号 -> 裁决
  inspecting: string | null; // 正在图上对比的候选线 id
  simulateFailure: boolean;
  notice: Notice | null;
}

export type Action =
  | { type: "SELECT_UNIT"; unitId: string }
  | { type: "SET_USER"; user: string }
  | { type: "TOGGLE_FAILURE" }
  | { type: "DISMISS_NOTICE" }
  | { type: "START_EDIT"; unitId: string; view: ViewType }
  | { type: "CANCEL_EDIT" }
  | { type: "DISCARD_DRAFT" }
  | { type: "ADD_POINT"; point: DrawPoint }
  | { type: "MOVE_POINT"; index: number; point: DrawPoint }
  | { type: "UNDO_POINT" }
  | { type: "CLEAR_POINTS" }
  | { type: "RESET_POINTS" }
  | { type: "SAVE_DRAFT"; note: string }
  | { type: "CONFIRM_VIEW"; unitId: string; view: ViewType }
  | { type: "VIEW_HISTORY"; unitId: string; view: ViewType; version: number | null }
  | { type: "INSPECT_CANDIDATE"; candidateId: string | null }
  | { type: "RESOLVE_DIFF"; candidateId: string; diffIndex: number; choice: DiffChoice }
  | { type: "ADOPT_CANDIDATE"; unitId: string; view: ViewType; candidateId: string; merged: DrawPoint[] }
  | { type: "DISCARD_CANDIDATE"; unitId: string; view: ViewType; candidateId: string };

export const draftKey = (unitId: string, view: ViewType, user: string) =>
  `${unitId}:${view}:${user}`;

const viewKey = (unitId: string, view: ViewType) => `${unitId}:${view}`;

const otherView = (view: ViewType): ViewType => (view === "plan" ? "section" : "plan");

function loadUnits(): Unit[] {
  try {
    const raw = localStorage.getItem(UNITS_KEY);
    if (raw) return JSON.parse(raw) as Unit[];
  } catch {
    // 存储不可用时退回种子数据
  }
  return seedUnits;
}

function loadDrafts(): Record<string, Draft> {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    if (raw) return JSON.parse(raw) as Record<string, Draft>;
  } catch {
    // ignore
  }
  return {};
}

export function persistUnits(units: Unit[]) {
  try {
    localStorage.setItem(UNITS_KEY, JSON.stringify(units));
  } catch {
    // ignore
  }
}

export function persistDrafts(drafts: Record<string, Draft>) {
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    // ignore
  }
}

export function initState(): State {
  const units = loadUnits();
  const drafts = loadDrafts();
  const restored = Object.values(drafts).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))[0];
  return {
    units,
    currentUser: restored?.user ?? USERS[0],
    selectedUnitId: restored?.unitId ?? units[0]?.id ?? "",
    editing: restored ? { unitId: restored.unitId, view: restored.view, user: restored.user } : null,
    drafts,
    historyView: {},
    decisions: {},
    inspecting: null,
    simulateFailure: false,
    notice: restored
      ? {
          kind: "info",
          text: `检测到 ${restored.user} 未完成的绘图（${restored.unitId} · ${VIEW_LABEL[restored.view]}，${restored.points.length} 点），已恢复，可继续改绘。`,
        }
      : null,
  };
}

/** 提交一条新当前线：本视图解除失效；若本次不是对另一侧变更的响应，则另一侧失效待复核。 */
function applyCommit(unit: Unit, view: ViewType, rev: Revision): Unit {
  const other = otherView(view);
  const vs = unit.views[view];
  const wasStale = vs.staleSince !== null;
  const views = { ...unit.views };
  views[view] = {
    committed: rev,
    history: [...vs.history, rev],
    staleSince: null,
  };
  views[other] = wasStale
    ? unit.views[other]
    : { ...unit.views[other], staleSince: rev.time };
  return { ...unit, views };
}

function updateUnit(units: Unit[], unitId: string, fn: (u: Unit) => Unit): Unit[] {
  return units.map((u) => (u.id === unitId ? fn(u) : u));
}

function editingDraft(state: State): { key: string; draft: Draft } | null {
  if (!state.editing) return null;
  const key = draftKey(state.editing.unitId, state.editing.view, state.editing.user);
  const draft = state.drafts[key];
  return draft ? { key, draft } : null;
}

function patchDraft(state: State, points: DrawPoint[]): State {
  const found = editingDraft(state);
  if (!found) return state;
  return {
    ...state,
    drafts: {
      ...state.drafts,
      [found.key]: { ...found.draft, points, updatedAt: new Date().toISOString() },
    },
  };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SELECT_UNIT":
      return { ...state, selectedUnitId: action.unitId, inspecting: null };

    case "SET_USER":
      return { ...state, currentUser: action.user };

    case "TOGGLE_FAILURE":
      return {
        ...state,
        simulateFailure: !state.simulateFailure,
        notice: {
          kind: "info",
          text: state.simulateFailure
            ? "已关闭故障模拟，保存恢复正常。"
            : "已开启故障模拟：保存将失败，绘图点会暂存本地，重开页面可继续。",
        },
      };

    case "DISMISS_NOTICE":
      return { ...state, notice: null };

    case "START_EDIT": {
      const key = draftKey(action.unitId, action.view, state.currentUser);
      const unit = state.units.find((u) => u.id === action.unitId);
      if (!unit) return state;
      const existing = state.drafts[key];
      const drafts = existing
        ? state.drafts
        : {
            ...state.drafts,
            [key]: {
              unitId: action.unitId,
              view: action.view,
              user: state.currentUser,
              baseVersion: unit.views[action.view].committed.version,
              points: [...unit.views[action.view].committed.points],
              updatedAt: new Date().toISOString(),
            } satisfies Draft,
          };
      return {
        ...state,
        drafts,
        editing: { unitId: action.unitId, view: action.view, user: state.currentUser },
        notice: existing
          ? { kind: "info", text: `继续未完成的草稿（${existing.points.length} 点，基于 v${existing.baseVersion}）。` }
          : null,
      };
    }

    case "CANCEL_EDIT":
      // 退出改绘但保留草稿，之后可续作
      return { ...state, editing: null };

    case "DISCARD_DRAFT": {
      const found = editingDraft(state);
      if (!found) return { ...state, editing: null };
      const drafts = { ...state.drafts };
      delete drafts[found.key];
      return {
        ...state,
        drafts,
        editing: null,
        notice: { kind: "info", text: "草稿已放弃。" },
      };
    }

    case "ADD_POINT": {
      const found = editingDraft(state);
      if (!found) return state;
      return patchDraft(state, [...found.draft.points, action.point]);
    }

    case "MOVE_POINT": {
      const found = editingDraft(state);
      if (!found) return state;
      const points = found.draft.points.map((p, i) => (i === action.index ? action.point : p));
      return patchDraft(state, points);
    }

    case "UNDO_POINT": {
      const found = editingDraft(state);
      if (!found) return state;
      return patchDraft(state, found.draft.points.slice(0, -1));
    }

    case "CLEAR_POINTS":
      return patchDraft(state, []);

    case "RESET_POINTS": {
      if (!state.editing) return state;
      const unit = state.units.find((u) => u.id === state.editing!.unitId);
      if (!unit) return state;
      return patchDraft(state, [...unit.views[state.editing.view].committed.points]);
    }

    case "SAVE_DRAFT": {
      const found = editingDraft(state);
      if (!found || !state.editing) return state;
      const { unitId, view } = state.editing;
      const { draft, key } = found;

      if (state.simulateFailure) {
        return {
          ...state,
          notice: {
            kind: "error",
            text: "保存失败：网络异常（模拟）。绘图点已暂存本地，重开页面后可继续改绘。",
          },
        };
      }
      if (draft.points.length < 3) {
        return {
          ...state,
          notice: { kind: "error", text: "至少需要 3 个绘图点才能保存轮廓。" },
        };
      }

      const unit = state.units.find((u) => u.id === unitId);
      if (!unit) return state;
      const vs = unit.views[view];
      const now = new Date().toISOString();
      const drafts = { ...state.drafts };
      delete drafts[key];
      const note = action.note.trim();

      if (draft.baseVersion === vs.committed.version) {
        // 基准版本未变：直接成为当前线
        const rev: Revision = {
          version: vs.committed.version + 1,
          author: draft.user,
          time: now,
          note: note || "边界修订",
          points: draft.points,
          source: "direct",
        };
        const wasStale = vs.staleSince !== null;
        return {
          ...state,
          units: updateUnit(state.units, unitId, (u) => applyCommit(u, view, rev)),
          drafts,
          editing: null,
          notice: {
            kind: "success",
            text: wasStale
              ? `${VIEW_LABEL[view]} v${rev.version} 已保存，本视图复核完成。`
              : `${VIEW_LABEL[view]} v${rev.version} 已保存，${VIEW_LABEL[otherView(view)]}已标记失效，待复核。`,
          },
        };
      }

      // 基准版本已落后：只生成候选线，不覆盖当前线
      const candidate: Candidate = {
        id: `c-${now}`,
        author: draft.user,
        time: now,
        baseVersion: draft.baseVersion,
        points: draft.points,
        note: note || "边界修订",
      };
      return {
        ...state,
        units: updateUnit(state.units, unitId, (u) => ({
          ...u,
          candidates: {
            ...u.candidates,
            [view]: [...u.candidates[view], candidate],
          },
        })),
        drafts,
        editing: null,
        notice: {
          kind: "info",
          text: `${VIEW_LABEL[view]}已被他人更新为 v${vs.committed.version}，你的提交已转为候选线，需逐点处理差异后才可采纳。`,
        },
      };
    }

    case "CONFIRM_VIEW": {
      const unit = state.units.find((u) => u.id === action.unitId);
      if (!unit || unit.views[action.view].staleSince === null) return state;
      return {
        ...state,
        units: updateUnit(state.units, action.unitId, (u) => ({
          ...u,
          views: {
            ...u.views,
            [action.view]: { ...u.views[action.view], staleSince: null },
          },
        })),
        notice: {
          kind: "success",
          text: `${unit.name} ${VIEW_LABEL[action.view]}复核确认：与${VIEW_LABEL[otherView(action.view)]}一致，恢复有效。`,
        },
      };
    }

    case "VIEW_HISTORY":
      return {
        ...state,
        historyView: { ...state.historyView, [viewKey(action.unitId, action.view)]: action.version },
      };

    case "INSPECT_CANDIDATE":
      return { ...state, inspecting: action.candidateId };

    case "RESOLVE_DIFF":
      return {
        ...state,
        decisions: {
          ...state.decisions,
          [action.candidateId]: {
            ...state.decisions[action.candidateId],
            [action.diffIndex]: action.choice,
          },
        },
      };

    case "ADOPT_CANDIDATE": {
      const unit = state.units.find((u) => u.id === action.unitId);
      const candidate = unit?.candidates[action.view].find((c) => c.id === action.candidateId);
      if (!unit || !candidate) return state;
      const vs = unit.views[action.view];
      const rev: Revision = {
        version: vs.committed.version + 1,
        author: candidate.author,
        time: new Date().toISOString(),
        note: `合并候选线（基于 v${candidate.baseVersion}，逐点校核后采纳）`,
        points: action.merged,
        source: "merged",
      };
      const decisions = { ...state.decisions };
      delete decisions[action.candidateId];
      return {
        ...state,
        units: updateUnit(state.units, action.unitId, (u) => ({
          ...applyCommit(u, action.view, rev),
          candidates: {
            ...u.candidates,
            [action.view]: u.candidates[action.view].filter((c) => c.id !== action.candidateId),
          },
        })),
        decisions,
        inspecting: state.inspecting === action.candidateId ? null : state.inspecting,
        notice: {
          kind: "success",
          text: `候选线已采纳为${VIEW_LABEL[action.view]} v${rev.version}。`,
        },
      };
    }

    case "DISCARD_CANDIDATE": {
      const decisions = { ...state.decisions };
      delete decisions[action.candidateId];
      return {
        ...state,
        units: updateUnit(state.units, action.unitId, (u) => ({
          ...u,
          candidates: {
            ...u.candidates,
            [action.view]: u.candidates[action.view].filter((c) => c.id !== action.candidateId),
          },
        })),
        decisions,
        inspecting: state.inspecting === action.candidateId ? null : state.inspecting,
        notice: { kind: "info", text: "候选线已放弃。" },
      };
    }

    default:
      return state;
  }
}

// ---------- 派生状态 ----------

export function pendingReasons(unit: Unit): string[] {
  const reasons: string[] = [];
  (Object.keys(unit.views) as ViewType[]).forEach((view) => {
    if (unit.views[view].staleSince !== null) {
      reasons.push(`${VIEW_LABEL[view]}失效待复核`);
    }
    if (unit.candidates[view].length > 0) {
      reasons.push(`${VIEW_LABEL[view]}有 ${unit.candidates[view].length} 条候选线待处理`);
    }
  });
  return reasons;
}

export function isVerified(unit: Unit): boolean {
  return pendingReasons(unit).length === 0;
}

// ---------- 差异计算 ----------

const TOLERANCE = 4;

export function computeDiff(current: DrawPoint[], candidate: DrawPoint[]): DiffItem[] {
  const items: DiffItem[] = [];
  const n = Math.max(current.length, candidate.length);
  for (let i = 0; i < n; i++) {
    const c = current[i];
    const k = candidate[i];
    if (c && k) {
      if (Math.hypot(c.x - k.x, c.y - k.y) > TOLERANCE) {
        items.push({ kind: "modify", index: i, current: c, candidate: k });
      }
    } else if (k) {
      items.push({ kind: "add", index: i, candidate: k });
    } else if (c) {
      items.push({ kind: "remove", index: i, current: c });
    }
  }
  return items;
}

/** 全部差异都有裁决时返回合并后的点列，否则返回 null。 */
export function buildMerged(
  current: DrawPoint[],
  candidate: DrawPoint[],
  decisions: Record<number, DiffChoice>
): DrawPoint[] | null {
  const diffs = computeDiff(current, candidate);
  for (let i = 0; i < diffs.length; i++) {
    if (!decisions[i]) return null;
  }
  const byIndex = new Map<number, { item: DiffItem; choice: DiffChoice }>();
  diffs.forEach((item, i) => byIndex.set(item.index, { item, choice: decisions[i] }));

  const out: DrawPoint[] = [];
  const n = Math.max(current.length, candidate.length);
  for (let i = 0; i < n; i++) {
    const c = current[i];
    const k = candidate[i];
    const diff = byIndex.get(i);
    if (!diff) {
      if (c) out.push(c);
      continue;
    }
    switch (diff.item.kind) {
      case "modify":
        out.push(diff.choice === "candidate" ? diff.item.candidate : diff.item.current);
        break;
      case "add":
        if (diff.choice === "add") out.push(diff.item.candidate);
        break;
      case "remove":
        if (diff.choice === "keep") out.push(diff.item.current);
        break;
    }
  }
  return out;
}

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
