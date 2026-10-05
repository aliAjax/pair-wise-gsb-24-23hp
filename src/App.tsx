import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import type { Draft, FeatureUnit, Point, ViewKind } from "./types";
import {
  blockingReasons,
  countedInStats,
  diffPending,
  diffPoints,
  draftKeyOf,
  latestRevision,
  loadDrafts,
  loadUnits,
  loadUser,
  mergePoints,
  minPoints,
  now,
  OTHER_VIEW,
  resetStorage,
  saveDrafts,
  saveUnits,
  saveUser,
  uid,
  unitStatus,
  UNIT_STATUS_LABEL,
  USERS,
  VIEW_LABEL,
} from "./store";
import { ViewPanel } from "./components/ViewPanel";

interface Notice {
  type: "ok" | "err" | "info";
  text: string;
}

function App() {
  const [units, setUnits] = useState<FeatureUnit[]>(loadUnits);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(loadDrafts);
  const [user, setUser] = useState<string>(loadUser);
  const [offline, setOffline] = useState(false);
  const [selectedId, setSelectedId] = useState(() => loadUnits()[0]?.id ?? "");
  const [notice, setNotice] = useState<Notice | null>(null);
  // 首次加载时检测到的未完成草稿数量（保存失败/关页重开后恢复）
  const [restoredCount, setRestoredCount] = useState(() => Object.keys(loadDrafts()).length);

  useEffect(() => saveUnits(units), [units]);
  useEffect(() => saveDrafts(drafts), [drafts]);
  useEffect(() => saveUser(user), [user]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const unit = units.find((u) => u.id === selectedId) ?? units[0];

  const updateUnit = (unitId: string, fn: (u: FeatureUnit) => FeatureUnit) => {
    setUnits((prev) => prev.map((u) => (u.id === unitId ? fn(u) : u)));
  };

  const patchDraft = (key: string, fn: (d: Draft) => Draft) => {
    setDrafts((prev) => {
      const d = prev[key];
      if (!d) return prev;
      return { ...prev, [key]: { ...fn(d), updatedAt: now() } };
    });
  };

  const removeDraft = (key: string) => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // ---------- 绘图 ----------

  const startDraft = (unitId: string, view: ViewKind) => {
    const target = units.find((u) => u.id === unitId);
    if (!target) return;
    if (target[view].candidate) {
      setNotice({ type: "err", text: `${VIEW_LABEL[view]}存在待处理的候选线，逐点处理或放弃后才能继续绘图。` });
      return;
    }
    const key = draftKeyOf(user, unitId, view);
    if (drafts[key]) return;
    const current = latestRevision(target[view]);
    setDrafts((prev) => ({
      ...prev,
      [key]: {
        user,
        unitId,
        view,
        baseRevisionId: current.id,
        points: current.points.map((p) => ({ ...p })),
        updatedAt: now(),
      },
    }));
    setNotice({ type: "info", text: `已在当前轮廓上起稿，点击画布加点、撤销点调整；草稿实时暂存，中断后可继续。` });
  };

  const addPoint = (unitId: string, view: ViewKind, p: Point) => {
    patchDraft(draftKeyOf(user, unitId, view), (d) => ({ ...d, points: [...d.points, p] }));
  };

  const undoPoint = (unitId: string, view: ViewKind) => {
    patchDraft(draftKeyOf(user, unitId, view), (d) => ({ ...d, points: d.points.slice(0, -1) }));
  };

  const clearPoints = (unitId: string, view: ViewKind) => {
    patchDraft(draftKeyOf(user, unitId, view), (d) => ({ ...d, points: [] }));
  };

  const abandonDraft = (unitId: string, view: ViewKind) => {
    removeDraft(draftKeyOf(user, unitId, view));
    setNotice({ type: "info", text: "草稿已放弃。" });
  };

  const submitDraft = (unitId: string, view: ViewKind) => {
    const key = draftKeyOf(user, unitId, view);
    const draft = drafts[key];
    const target = units.find((u) => u.id === unitId);
    if (!draft || !target) return;
    if (draft.points.length < minPoints(view)) {
      setNotice({ type: "err", text: `${VIEW_LABEL[view]}至少需要 ${minPoints(view)} 个点。` });
      return;
    }
    // 模拟保存失败：草稿保留在本地，重开页面可恢复续画
    if (offline) {
      setNotice({ type: "err", text: "保存失败：网络不可用。绘图点已暂存本地，重新打开页面可继续修改。" });
      return;
    }

    const vs = target[view];
    const current = latestRevision(vs);
    const time = now();

    if (vs.candidate) {
      setNotice({ type: "err", text: "本视图已有待处理的候选线，请先逐点处理或放弃后再提交。" });
      return;
    }

    if (draft.baseRevisionId === current.id) {
      // 正常提交：本视图生效，另一侧失效待复核
      const revision = {
        id: uid("rev"),
        author: user,
        time,
        note: `${VIEW_LABEL[view]}修订（${draft.points.length} 点）`,
        points: draft.points,
      };
      updateUnit(unitId, (u) => {
        const other = OTHER_VIEW[view];
        return {
          ...u,
          [view]: {
            ...u[view],
            revisions: [...u[view].revisions, revision],
            stale: false,
            log: [
              ...u[view].log,
              { id: uid("log"), time, author: user, kind: "commit" as const, text: `提交${VIEW_LABEL[view]}：${revision.note}` },
            ],
          },
          [other]: {
            ...u[other],
            stale: true,
            log: [
              ...u[other].log,
              { id: uid("log"), time, author: "系统", kind: "stale" as const, text: `${VIEW_LABEL[view]}已修订，${VIEW_LABEL[other]}标记为待复核` },
            ],
          },
        };
      });
      removeDraft(key);
      setNotice({ type: "ok", text: `${VIEW_LABEL[view]}已提交生效，${VIEW_LABEL[OTHER_VIEW[view]]}已标记待复核。` });
    } else {
      // 冲突：他人已先提交，本次只生成候选线
      const candidate = {
        id: uid("cand"),
        author: user,
        time,
        note: `基于旧版 ${draft.baseRevisionId} 的${VIEW_LABEL[view]}（${draft.points.length} 点）`,
        baseRevisionId: draft.baseRevisionId,
        points: draft.points,
        decisions: {},
      };
      updateUnit(unitId, (u) => ({
        ...u,
        [view]: {
          ...u[view],
          candidate,
          log: [
            ...u[view].log,
            { id: uid("log"), time, author: user, kind: "candidate" as const, text: "基于旧版提交，生成候选线，待逐点处理差异" },
          ],
        },
      }));
      removeDraft(key);
      setNotice({ type: "info", text: "他人已先行提交，你的线已存为候选线，需逐点处理差异后才可采纳。" });
    }
  };

  // ---------- 复核 ----------

  const confirmReview = (unitId: string, view: ViewKind) => {
    const time = now();
    updateUnit(unitId, (u) => ({
      ...u,
      [view]: {
        ...u[view],
        stale: false,
        log: [
          ...u[view].log,
          { id: uid("log"), time, author: user, kind: "review" as const, text: `复核确认：${VIEW_LABEL[view]}与另一侧边界一致` },
        ],
      },
    }));
    setNotice({ type: "ok", text: `${VIEW_LABEL[view]}复核通过。` });
  };

  // ---------- 候选线 ----------

  const setDecision = (unitId: string, view: ViewKind, index: number, choice: "current" | "candidate") => {
    updateUnit(unitId, (u) => {
      const cand = u[view].candidate;
      if (!cand) return u;
      return {
        ...u,
        [view]: { ...u[view], candidate: { ...cand, decisions: { ...cand.decisions, [index]: choice } } },
      };
    });
  };

  const adoptCandidate = (unitId: string, view: ViewKind) => {
    const target = units.find((u) => u.id === unitId);
    const cand = target?.[view].candidate;
    if (!target || !cand) return;
    const current = latestRevision(target[view]);
    const rows = diffPoints(current.points, cand.points);
    if (diffPending(rows, cand.decisions).length > 0) {
      setNotice({ type: "err", text: "仍有差异点未处理，逐点抉择后才可采纳。" });
      return;
    }
    const merged = mergePoints(rows, cand.decisions);
    if (merged.length < minPoints(view)) {
      setNotice({ type: "err", text: `合并后点数不足，${VIEW_LABEL[view]}至少需要 ${minPoints(view)} 点。` });
      return;
    }
    const time = now();
    const revision = {
      id: uid("rev"),
      author: cand.author,
      time,
      note: `候选线逐点核对后采纳（${merged.length} 点）`,
      points: merged,
    };
    updateUnit(unitId, (u) => {
      const other = OTHER_VIEW[view];
      return {
        ...u,
        [view]: {
          ...u[view],
          revisions: [...u[view].revisions, revision],
          candidate: null,
          stale: false,
          log: [
            ...u[view].log,
            { id: uid("log"), time, author: user, kind: "adopt" as const, text: `候选线逐点核对后采纳为新版${VIEW_LABEL[view]}` },
          ],
        },
        [other]: {
          ...u[other],
          stale: true,
          log: [
            ...u[other].log,
            { id: uid("log"), time, author: "系统", kind: "stale" as const, text: `${VIEW_LABEL[view]}已修订，${VIEW_LABEL[other]}标记为待复核` },
          ],
        },
      };
    });
    setNotice({ type: "ok", text: `候选线已采纳为新版${VIEW_LABEL[view]}，${VIEW_LABEL[OTHER_VIEW[view]]}待复核。` });
  };

  const discardCandidate = (unitId: string, view: ViewKind) => {
    const time = now();
    updateUnit(unitId, (u) => ({
      ...u,
      [view]: {
        ...u[view],
        candidate: null,
        log: [
          ...u[view].log,
          { id: uid("log"), time, author: user, kind: "discard" as const, text: "放弃候选线，维持当前生效线" },
        ],
      },
    }));
    setNotice({ type: "info", text: "候选线已放弃，维持当前生效线。" });
  };

  // ---------- 统计 ----------

  const stats = useMemo(() => {
    const included = units.filter(countedInStats);
    const excluded = units.filter((u) => !countedInStats(u));
    return {
      included,
      excluded,
      total: included.reduce((s, u) => s + u.artifacts, 0),
      staleViews: units.reduce((s, u) => s + (u.plan.stale ? 1 : 0) + (u.section.stale ? 1 : 0), 0),
      candidates: units.reduce((s, u) => s + (u.plan.candidate ? 1 : 0) + (u.section.candidate ? 1 : 0), 0),
    };
  }, [units]);

  const myDrafts = useMemo(
    () => Object.values(drafts).filter((d) => d.user === user),
    [drafts, user],
  );

  const resetAll = () => {
    resetStorage();
    const fresh = loadUnits();
    setUnits(fresh);
    setDrafts(loadDrafts());
    setSelectedId(fresh[0]?.id ?? "");
    setRestoredCount(0);
    setNotice({ type: "info", text: "已重置为初始示例数据。" });
  };

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-10 · 考古发掘 · 双视图校核台</p>
          <h1>考古绘图校核台</h1>
          <p className="subtitle">
            每处遗迹单位分别保存平面图与剖面图轮廓及修订记录；一侧改动后另一侧自动失效待复核，旧线可随时回看。
            两人同时提交时，后到者仅生成候选线，逐点处理差异后才可采纳；复核未完成的遗迹不计入出土物统计。
          </p>
        </div>
        <div className="stack-card">
          <span>当前用户（切换可模拟两人协作）</span>
          <select value={user} onChange={(e) => setUser(e.target.value)}>
            {USERS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
          <label className="offline-toggle">
            <input
              type="checkbox"
              checked={offline}
              onChange={(e) => setOffline(e.target.checked)}
            />
            <span>模拟保存失败（断网）</span>
          </label>
          <button onClick={resetAll}>重置示例数据</button>
        </div>
      </section>

      {restoredCount > 0 && (
        <div className="banner banner-info">
          <span>检测到 {restoredCount} 处未保存的绘图点，已从本地恢复，可继续修改后提交。</span>
          <button onClick={() => setRestoredCount(0)}>知道了</button>
        </div>
      )}
      {notice && (
        <div className={`banner banner-${notice.type}`}>
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)}>关闭</button>
        </div>
      )}

      <section className="metrics-grid">
        <article className="metric-card">
          <span>遗迹单位</span>
          <strong>{units.length}</strong>
          <i className="status-ok" />
        </article>
        <article className="metric-card">
          <span>待复核视图</span>
          <strong>{stats.staleViews}</strong>
          <i className="status-watch" />
        </article>
        <article className="metric-card">
          <span>候选线待处理</span>
          <strong>{stats.candidates}</strong>
          <i className="status-danger" />
        </article>
        <article className="metric-card">
          <span>计入统计出土物</span>
          <strong>{stats.total}</strong>
          <i className="status-ok" />
        </article>
      </section>

      <section className="workspace">
        <aside className="panel narrow">
          <h2>遗迹单位</h2>
          <div className="unit-list">
            {units.map((u) => {
              const status = unitStatus(u);
              const draftsHere = myDrafts.filter((d) => d.unitId === u.id);
              return (
                <button
                  key={u.id}
                  className={`unit-item${u.id === unit?.id ? " active" : ""}`}
                  onClick={() => setSelectedId(u.id)}
                >
                  <div className="unit-item-head">
                    <strong>{u.name}</strong>
                    <span className={`pill pill-${status === "reviewed" ? "ok" : status === "pending" ? "warn" : "candidate"}`}>
                      {UNIT_STATUS_LABEL[status]}
                    </span>
                  </div>
                  <span className="unit-meta">{u.square} · {u.layer} · 出土物 {u.artifacts}</span>
                  {draftsHere.length > 0 && (
                    <span className="unit-draft">
                      草稿：{draftsHere.map((d) => `${VIEW_LABEL[d.view]} ${d.points.length} 点`).join("、")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="side-hint">
            协作提示：切换用户后各自绘图互不影响；若他人已先提交同一视图，你的提交将转为候选线。
          </p>
        </aside>

        {unit && (
          <section className="panel workbench">
            <div className="section-heading">
              <div>
                <p>{unit.type} · {unit.square} · {unit.layer} · {unit.soil}</p>
                <h2>{unit.name}</h2>
              </div>
              <div className="unit-head-right">
                <span className={`pill pill-${countedInStats(unit) ? "ok" : "warn"}`}>
                  {countedInStats(unit) ? "已计入出土物统计" : "复核未完成，暂不计入统计"}
                </span>
              </div>
            </div>
            {!countedInStats(unit) && (
              <p className="exclude-note">
                以下事项完成前，本遗迹 {unit.artifacts} 件出土物不进入统计：{blockingReasons(unit).join("；")}
              </p>
            )}
            <div className="view-grid">
              {(["plan", "section"] as ViewKind[]).map((view) => (
                <ViewPanel
                  key={view}
                  view={view}
                  state={unit[view]}
                  draft={drafts[draftKeyOf(user, unit.id, view)] ?? null}
                  onStartDraft={() => startDraft(unit.id, view)}
                  onAddPoint={(p) => addPoint(unit.id, view, p)}
                  onUndoPoint={() => undoPoint(unit.id, view)}
                  onClearPoints={() => clearPoints(unit.id, view)}
                  onAbandonDraft={() => abandonDraft(unit.id, view)}
                  onSubmit={() => submitDraft(unit.id, view)}
                  onConfirmReview={() => confirmReview(unit.id, view)}
                  onDecision={(i, c) => setDecision(unit.id, view, i, c)}
                  onAdoptCandidate={() => adoptCandidate(unit.id, view)}
                  onDiscardCandidate={() => discardCandidate(unit.id, view)}
                />
              ))}
            </div>
          </section>
        )}
      </section>

      <section className="records panel">
        <div className="section-heading">
          <div>
            <p>出土物统计</p>
            <h2>统计口径：仅已复核遗迹</h2>
          </div>
          <strong className="stats-total">合计 {stats.total} 件</strong>
        </div>
        <table className="stats-table">
          <thead>
            <tr>
              <th>遗迹单位</th>
              <th>探方</th>
              <th>出土物</th>
              <th>是否计入</th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.id} className={countedInStats(u) ? "" : "excluded"}>
                <td>{u.name}</td>
                <td>{u.square}</td>
                <td>{u.artifacts} 件</td>
                <td>
                  {countedInStats(u)
                    ? <span className="pill pill-ok">计入</span>
                    : <span className="pill pill-warn">暂不计入：{blockingReasons(u).join("；")}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

export default App;
