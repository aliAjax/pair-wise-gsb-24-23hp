import { useState } from "react";
import type { Draft, Point, ViewKind, ViewState } from "../types";
import { latestRevision, minPoints, VIEW_LABEL } from "../store";
import { OutlineCanvas, type OldLine } from "./OutlineCanvas";
import { CandidateResolver } from "./CandidateResolver";

interface Props {
  view: ViewKind;
  state: ViewState;
  draft: Draft | null;
  onStartDraft: () => void;
  onAddPoint: (p: Point) => void;
  onUndoPoint: () => void;
  onClearPoints: () => void;
  onAbandonDraft: () => void;
  onSubmit: () => void;
  onConfirmReview: () => void;
  onDecision: (index: number, choice: "current" | "candidate") => void;
  onAdoptCandidate: () => void;
  onDiscardCandidate: () => void;
}

const LOG_ICON: Record<string, string> = {
  commit: "✏️",
  review: "✅",
  candidate: "⚠️",
  adopt: "🔀",
  discard: "🗑",
  stale: "🔔",
};

/** 单个视图（平面图/剖面图）的绘制、复核与修订记录面板 */
export function ViewPanel(props: Props) {
  const { view, state, draft } = props;
  const [showOld, setShowOld] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const current = latestRevision(state);
  const drawing = draft !== null;
  const baseExpired = drawing && draft.baseRevisionId !== current.id;
  const enough = drawing && draft.points.length >= minPoints(view);

  const oldLines: OldLine[] = showOld
    ? state.revisions.slice(0, -1).map((r, i) => ({
        id: r.id,
        label: `旧线 ${i + 1}`,
        points: r.points,
      }))
    : [];
  const previewRev = previewId ? state.revisions.find((r) => r.id === previewId) ?? null : null;

  const statusPill = state.candidate
    ? <span className="pill pill-candidate">候选线待处理</span>
    : state.stale
      ? <span className="pill pill-warn">待复核</span>
      : <span className="pill pill-ok">有效</span>;

  return (
    <section className="view-panel">
      <header className="view-head">
        <h3>{VIEW_LABEL[view]}</h3>
        {statusPill}
      </header>

      <OutlineCanvas
        kind={view}
        committed={current.points}
        draft={draft?.points ?? null}
        oldLines={oldLines}
        preview={previewRev ? { id: previewRev.id, label: previewRev.note, points: previewRev.points } : null}
        drawing={drawing}
        onAddPoint={props.onAddPoint}
      />

      {state.stale && !state.candidate && (
        <p className="view-alert">另一侧视图已改动，本视图边界失效，请复核确认或重新绘制。</p>
      )}
      {baseExpired && (
        <p className="view-alert warn">他人已更新本视图，你的草稿基于旧版，提交时将转为候选线。</p>
      )}

      <div className="view-controls">
        {drawing ? (
          <>
            <span className="draft-meta">草稿 {draft.points.length} 点 · 已实时暂存</span>
            <button onClick={props.onUndoPoint} disabled={draft.points.length === 0}>撤销点</button>
            <button onClick={props.onClearPoints} disabled={draft.points.length === 0}>清空</button>
            <button onClick={props.onAbandonDraft}>放弃草稿</button>
            <button className="primary-action" onClick={props.onSubmit} disabled={!enough}>
              提交{VIEW_LABEL[view]}
            </button>
          </>
        ) : (
          <>
            <button
              className="primary-action"
              onClick={props.onStartDraft}
              disabled={state.candidate !== null}
              title={state.candidate ? "请先处理候选线" : undefined}
            >
              {state.stale ? "重新绘制" : "修改轮廓"}
            </button>
            {state.stale && !state.candidate && (
              <button className="confirm-action" onClick={props.onConfirmReview}>复核确认</button>
            )}
            {state.revisions.length > 1 && (
              <button onClick={() => setShowOld((v) => !v)}>
                {showOld ? "隐藏旧线" : `显示旧线（${state.revisions.length - 1}）`}
              </button>
            )}
          </>
        )}
      </div>
      {drawing && !enough && (
        <p className="hint">{VIEW_LABEL[view]}至少需要 {minPoints(view)} 个点才能提交，点击画布加点。</p>
      )}

      {state.candidate && (
        <CandidateResolver
          view={view}
          current={current.points}
          candidate={state.candidate}
          onDecision={props.onDecision}
          onAdopt={props.onAdoptCandidate}
          onDiscard={props.onDiscardCandidate}
        />
      )}

      <details className="history" open={state.revisions.length > 1}>
        <summary>修订记录（{state.revisions.length} 版）</summary>
        <ul>
          {[...state.revisions].reverse().map((r, i) => (
            <li key={r.id} className={previewId === r.id ? "previewing" : ""}>
              <div>
                <strong>{i === 0 ? "当前版" : `旧线 ${state.revisions.length - 1 - i + 1}`}</strong>
                <span>{r.time} · {r.author}</span>
                <em>{r.note}（{r.points.length} 点）</em>
              </div>
              <button
                onClick={() => setPreviewId(previewId === r.id ? null : r.id)}
              >
                {previewId === r.id ? "隐藏" : "查看"}
              </button>
            </li>
          ))}
        </ul>
      </details>

      <details className="history">
        <summary>操作日志（{state.log.length}）</summary>
        <ul>
          {[...state.log].reverse().map((entry) => (
            <li key={entry.id}>
              <div>
                <strong>{LOG_ICON[entry.kind] ?? "•"} {entry.time} · {entry.author}</strong>
                <em>{entry.text}</em>
              </div>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
