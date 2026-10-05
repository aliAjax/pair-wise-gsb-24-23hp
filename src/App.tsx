import { useEffect, useReducer } from "react";
import "./styles.css";
import {
  USERS,
  initState,
  isVerified,
  pendingReasons,
  persistDrafts,
  persistUnits,
  reducer,
} from "./store";
import ViewCard from "./components/ViewCard";
import HistoryPanel from "./components/HistoryPanel";
import CandidatePanel from "./components/CandidatePanel";
import StatsPanel from "./components/StatsPanel";

function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initState);

  useEffect(() => {
    persistUnits(state.units);
  }, [state.units]);

  useEffect(() => {
    persistDrafts(state.drafts);
  }, [state.drafts]);

  const unit = state.units.find((u) => u.id === state.selectedUnitId) ?? state.units[0];

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-10 · 考古发掘</p>
          <h1>遗迹绘图双视图校核台</h1>
          <p className="subtitle">
            每处遗迹单位分别保存平面图与剖面图轮廓及修订记录；一侧改动后另一侧失效待复核，
            旧线可随时调看。两人同时提交时，后到的只生成候选线，逐点处理差异后才可采纳。
            复核完成前，该遗迹不计入出土物统计。
          </p>
        </div>
        <div className="stack-card">
          <span>当前用户（模拟两人协作）</span>
          <div className="user-switch">
            {USERS.map((u) => (
              <button
                key={u}
                className={state.currentUser === u ? "active" : ""}
                onClick={() => dispatch({ type: "SET_USER", user: u })}
              >
                {u}
              </button>
            ))}
          </div>
          <label className="failure-toggle">
            <input
              type="checkbox"
              checked={state.simulateFailure}
              onChange={() => dispatch({ type: "TOGGLE_FAILURE" })}
            />
            模拟保存失败（测试草稿恢复）
          </label>
        </div>
      </section>

      {state.notice && (
        <div className={`notice notice-${state.notice.kind}`}>
          <span>{state.notice.text}</span>
          <button onClick={() => dispatch({ type: "DISMISS_NOTICE" })}>知道了</button>
        </div>
      )}

      <div className="workbench">
        <aside className="panel unit-list">
          <h2>遗迹单位</h2>
          {state.units.map((u) => {
            const ok = isVerified(u);
            return (
              <button
                key={u.id}
                className={`unit-item${u.id === unit?.id ? " active" : ""}`}
                onClick={() => dispatch({ type: "SELECT_UNIT", unitId: u.id })}
              >
                <span className="unit-name">
                  {u.name}
                  <span className="unit-sub">
                    {u.square} · {u.type}
                  </span>
                </span>
                <span className={`badge ${ok ? "badge-ok" : "badge-stale"}`}>
                  {ok ? "已校核" : "待复核"}
                </span>
              </button>
            );
          })}
        </aside>

        {unit && (
          <div className="unit-workspace">
            <section className="panel unit-head">
              <div>
                <h2>
                  {unit.name}
                  <span className="unit-sub">
                    {unit.square} · {unit.type}
                  </span>
                </h2>
                {!isVerified(unit) && (
                  <p className="pending-reasons">
                    {pendingReasons(unit).map((r) => (
                      <span key={r} className="badge badge-stale">
                        {r}
                      </span>
                    ))}
                    <em>复核完成前，本单位出土物暂不计入统计。</em>
                  </p>
                )}
                {isVerified(unit) && (
                  <p className="pending-reasons">
                    <span className="badge badge-ok">双视图一致，已校核</span>
                    <em>本单位出土物已计入统计。</em>
                  </p>
                )}
              </div>
            </section>

            <div className="views-grid">
              <ViewCard
                unit={unit}
                view="plan"
                editing={state.editing}
                drafts={state.drafts}
                decisions={state.decisions}
                currentUser={state.currentUser}
                historyVersion={state.historyView[`${unit.id}:plan`] ?? null}
                inspecting={state.inspecting}
                dispatch={dispatch}
              />
              <ViewCard
                unit={unit}
                view="section"
                editing={state.editing}
                drafts={state.drafts}
                decisions={state.decisions}
                currentUser={state.currentUser}
                historyVersion={state.historyView[`${unit.id}:section`] ?? null}
                inspecting={state.inspecting}
                dispatch={dispatch}
              />
            </div>

            <div className="bottom-grid">
              <HistoryPanel
                unit={unit}
                historyView={state.historyView}
                dispatch={dispatch}
              />
              <CandidatePanel
                unit={unit}
                decisions={state.decisions}
                inspecting={state.inspecting}
                dispatch={dispatch}
              />
            </div>

            <StatsPanel units={state.units} />
          </div>
        )}
      </div>
    </main>
  );
}

export default App;
