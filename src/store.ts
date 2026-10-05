import type {
  CandidateLine,
  Draft,
  FeatureUnit,
  Point,
  Revision,
  ViewKind,
  ViewState,
} from "./types";

export const USERS = ["李岚 · 发掘队员", "王峥 · 领队", "赵敏 · 资料整理员"];

export const VIEW_LABEL: Record<ViewKind, string> = {
  plan: "平面图",
  section: "剖面图",
};

export const OTHER_VIEW: Record<ViewKind, ViewKind> = {
  plan: "section",
  section: "plan",
};

const UNITS_KEY = "hxwl10.units.v1";
const DRAFTS_KEY = "hxwl10.drafts.v1";
const USER_KEY = "hxwl10.user.v1";

let seq = 0;
export function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

export function now(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const P = (x: number, y: number): Point => ({ x, y });

function rev(id: string, author: string, time: string, note: string, pts: Point[]): Revision {
  return { id, author, time, note, points: pts };
}

function view(
  revisions: Revision[],
  stale: boolean,
  log: ViewState["log"],
  candidate: CandidateLine | null = null,
): ViewState {
  return { revisions, stale, candidate, log };
}

function seedUnits(): FeatureUnit[] {
  return [
    {
      id: "H12",
      name: "H12 灰坑",
      type: "灰坑",
      square: "T0204",
      layer: "第3层",
      soil: "黑褐土",
      artifacts: 26,
      plan: view(
        [
          rev("H12-P1", "李岚 · 发掘队员", "09-26 10:20", "开口线初测", [
            P(32, 18), P(52, 12), P(70, 22), P(72, 44), P(54, 56), P(34, 50), P(26, 32),
          ]),
          rev("H12-P2", "王峥 · 领队", "09-28 15:40", "东壁外扩，补袋状底边界", [
            P(32, 18), P(54, 10), P(74, 22), P(76, 46), P(54, 58), P(34, 50), P(24, 30),
          ]),
        ],
        false,
        [
          { id: "H12-L1", time: "09-26 10:20", author: "李岚 · 发掘队员", kind: "commit", text: "提交平面图：开口线初测" },
          { id: "H12-L2", time: "09-28 15:40", author: "王峥 · 领队", kind: "commit", text: "提交平面图：东壁外扩，补袋状底边界" },
          { id: "H12-L3", time: "09-28 15:40", author: "系统", kind: "stale", text: "平面图已修订，剖面图标记为待复核" },
          { id: "H12-L4", time: "09-29 09:12", author: "赵敏 · 资料整理员", kind: "review", text: "复核确认：平面图与剖面图边界一致" },
        ],
      ),
      section: view(
        [
          rev("H12-S1", "李岚 · 发掘队员", "09-26 11:05", "圜底剖面初测", [
            P(18, 16), P(30, 30), P(44, 42), P(58, 44), P(72, 30), P(84, 18),
          ]),
        ],
        true,
        [
          { id: "H12-L5", time: "09-26 11:05", author: "李岚 · 发掘队员", kind: "commit", text: "提交剖面图：圜底剖面初测" },
          { id: "H12-L6", time: "09-28 15:40", author: "系统", kind: "stale", text: "平面图已修订，剖面图标记为待复核" },
        ],
      ),
    },
    {
      id: "F2",
      name: "F2 房址",
      type: "房址",
      square: "T0301",
      layer: "第2层",
      soil: "夯土面",
      artifacts: 41,
      plan: view(
        [
          rev("F2-P1", "赵敏 · 资料整理员", "09-20 14:10", "房址范围初测", [
            P(24, 16), P(76, 16), P(76, 52), P(24, 52),
          ]),
          rev("F2-P2", "王峥 · 领队", "09-24 10:02", "西北角内收，避开扰坑", [
            P(28, 20), P(76, 16), P(76, 52), P(24, 52), P(24, 28),
          ]),
        ],
        false,
        [
          { id: "F2-L1", time: "09-20 14:10", author: "赵敏 · 资料整理员", kind: "commit", text: "提交平面图：房址范围初测" },
          { id: "F2-L2", time: "09-24 10:02", author: "王峥 · 领队", kind: "commit", text: "提交平面图：西北角内收，避开扰坑" },
          { id: "F2-L3", time: "09-24 16:30", author: "李岚 · 发掘队员", kind: "review", text: "复核确认：双视图边界一致" },
        ],
      ),
      section: view(
        [
          rev("F2-S1", "李岚 · 发掘队员", "09-21 09:40", "夯土面剖面", [
            P(16, 24), P(36, 26), P(52, 30), P(68, 26), P(86, 24),
          ]),
        ],
        false,
        [
          { id: "F2-L4", time: "09-21 09:40", author: "李岚 · 发掘队员", kind: "commit", text: "提交剖面图：夯土面剖面" },
        ],
      ),
    },
    {
      id: "M5",
      name: "M5 墓葬",
      type: "墓葬",
      square: "T0203",
      layer: "第3层",
      soil: "灰褐土",
      artifacts: 13,
      plan: view(
        [
          rev("M5-P1", "李岚 · 发掘队员", "09-27 11:20", "墓圹开口初测", [
            P(30, 14), P(66, 14), P(66, 50), P(30, 50),
          ]),
          rev("M5-P2", "王峥 · 领队", "09-29 16:05", "南壁校正，东壁外移", [
            P(30, 14), P(68, 16), P(64, 52), P(30, 50),
          ]),
        ],
        false,
        [
          { id: "M5-L1", time: "09-27 11:20", author: "李岚 · 发掘队员", kind: "commit", text: "提交平面图：墓圹开口初测" },
          { id: "M5-L2", time: "09-29 16:05", author: "王峥 · 领队", kind: "commit", text: "提交平面图：南壁校正，东壁外移" },
          { id: "M5-L3", time: "09-29 17:21", author: "李岚 · 发掘队员", kind: "candidate", text: "基于旧版提交，生成候选线，待逐点处理差异" },
        ],
        {
          id: "M5-C1",
          author: "李岚 · 发掘队员",
          time: "09-29 17:21",
          note: "墓圹四角复测（基于 09-27 旧版）",
          baseRevisionId: "M5-P1",
          points: [P(30, 14), P(70, 14), P(66, 54), P(28, 52)],
          decisions: {},
        },
      ),
      section: view(
        [
          rev("M5-S1", "李岚 · 发掘队员", "09-27 15:00", "平底墓圹剖面", [
            P(24, 18), P(40, 34), P(60, 34), P(78, 18),
          ]),
        ],
        false,
        [
          { id: "M5-L4", time: "09-27 15:00", author: "李岚 · 发掘队员", kind: "commit", text: "提交剖面图：平底墓圹剖面" },
        ],
      ),
    },
    {
      id: "G3",
      name: "G3 沟状遗迹",
      type: "沟状遗迹",
      square: "T0301",
      layer: "第2层",
      soil: "灰黑土",
      artifacts: 8,
      plan: view(
        [
          rev("G3-P1", "赵敏 · 资料整理员", "09-22 10:45", "沟形走向初测", [
            P(10, 30), P(30, 24), P(52, 28), P(74, 22), P(90, 26),
            P(88, 34), P(70, 32), P(50, 36), P(28, 32), P(12, 38),
          ]),
        ],
        false,
        [
          { id: "G3-L1", time: "09-22 10:45", author: "赵敏 · 资料整理员", kind: "commit", text: "提交平面图：沟形走向初测" },
          { id: "G3-L2", time: "09-23 09:10", author: "王峥 · 领队", kind: "review", text: "复核确认：双视图边界一致" },
        ],
      ),
      section: view(
        [
          rev("G3-S1", "赵敏 · 资料整理员", "09-22 11:30", "沟底剖面", [
            P(20, 22), P(36, 36), P(52, 38), P(68, 30), P(82, 20),
          ]),
        ],
        false,
        [
          { id: "G3-L3", time: "09-22 11:30", author: "赵敏 · 资料整理员", kind: "commit", text: "提交剖面图：沟底剖面" },
        ],
      ),
    },
  ];
}

/** 预置一份未完成草稿，演示“保存失败后重开可恢复续画” */
function seedDrafts(): Record<string, Draft> {
  const draft: Draft = {
    user: "李岚 · 发掘队员",
    unitId: "H12",
    view: "section",
    baseRevisionId: "H12-S1",
    points: [P(18, 16), P(32, 32), P(46, 44)],
    updatedAt: "10-04 17:12",
  };
  return { [draftKeyOf(draft.user, draft.unitId, draft.view)]: draft };
}

export function draftKeyOf(user: string, unitId: string, view: ViewKind): string {
  return `${user}|${unitId}|${view}`;
}

function read<T>(key: string, fallback: () => T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    // 存储不可用时退回种子数据
  }
  return fallback();
}

export function loadUnits(): FeatureUnit[] {
  return read(UNITS_KEY, seedUnits);
}

export function loadDrafts(): Record<string, Draft> {
  return read(DRAFTS_KEY, seedDrafts);
}

export function loadUser(): string {
  return read(USER_KEY, () => USERS[0]);
}

export function saveUnits(units: FeatureUnit[]): void {
  try {
    localStorage.setItem(UNITS_KEY, JSON.stringify(units));
  } catch {
    // 忽略写入失败，界面状态仍可用
  }
}

export function saveDrafts(drafts: Record<string, Draft>): void {
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    // 忽略写入失败
  }
}

export function saveUser(user: string): void {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // 忽略写入失败
  }
}

export function resetStorage(): void {
  try {
    localStorage.removeItem(UNITS_KEY);
    localStorage.removeItem(DRAFTS_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // 忽略
  }
}

// ---------- 校核逻辑 ----------

export function latestRevision(v: ViewState): Revision {
  return v.revisions[v.revisions.length - 1];
}

export type UnitStatus = "reviewed" | "pending" | "candidate";

export function unitStatus(u: FeatureUnit): UnitStatus {
  if (u.plan.candidate || u.section.candidate) return "candidate";
  if (u.plan.stale || u.section.stale) return "pending";
  return "reviewed";
}

export const UNIT_STATUS_LABEL: Record<UnitStatus, string> = {
  reviewed: "已复核",
  pending: "待复核",
  candidate: "候选线待处理",
};

/** 复核未完成的单位不计入出土物统计 */
export function countedInStats(u: FeatureUnit): boolean {
  return unitStatus(u) === "reviewed";
}

export function blockingReasons(u: FeatureUnit): string[] {
  const reasons: string[] = [];
  if (u.plan.candidate) reasons.push("平面图候选线待逐点处理");
  if (u.section.candidate) reasons.push("剖面图候选线待逐点处理");
  if (u.plan.stale) reasons.push("平面图待复核");
  if (u.section.stale) reasons.push("剖面图待复核");
  return reasons;
}

// ---------- 候选线逐点差异 ----------

export interface DiffRow {
  index: number;
  current?: Point;
  candidate?: Point;
  same: boolean;
}

export function diffPoints(current: Point[], candidate: Point[]): DiffRow[] {
  const n = Math.max(current.length, candidate.length);
  const rows: DiffRow[] = [];
  for (let i = 0; i < n; i += 1) {
    const c = current[i];
    const k = candidate[i];
    const same = Boolean(c && k && c.x === k.x && c.y === k.y);
    rows.push({ index: i, current: c, candidate: k, same });
  }
  return rows;
}

export function diffPending(rows: DiffRow[], decisions: CandidateLine["decisions"]): DiffRow[] {
  return rows.filter((r) => !r.same && decisions[r.index] == null);
}

export function mergePoints(rows: DiffRow[], decisions: CandidateLine["decisions"]): Point[] {
  const out: Point[] = [];
  for (const row of rows) {
    if (row.same) {
      if (row.current) out.push(row.current);
      continue;
    }
    const pick = decisions[row.index];
    const pt = pick === "candidate" ? row.candidate : row.current;
    if (pt) out.push(pt);
  }
  return out;
}

export function minPoints(kind: ViewKind): number {
  return kind === "plan" ? 3 : 2;
}
