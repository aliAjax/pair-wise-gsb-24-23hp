import type { CandidateLine, Point, ViewKind } from "../types";
import { diffPending, diffPoints, mergePoints, minPoints, VIEW_LABEL } from "../store";
import { OutlineCanvas } from "./OutlineCanvas";

interface Props {
  view: ViewKind;
  current: Point[];
  candidate: CandidateLine;
  onDecision: (index: number, choice: "current" | "candidate") => void;
  onAdopt: () => void;
  onDiscard: () => void;
}

function fmt(p?: Point): string {
  return p ? `(${p.x}, ${p.y})` : "— 无此点";
}

/** 冲突候选线：逐点处理差异，全部抉择后才可采纳 */
export function CandidateResolver({ view, current, candidate, onDecision, onAdopt, onDiscard }: Props) {
  const rows = diffPoints(current, candidate.points);
  const pending = diffPending(rows, candidate.decisions);
  const diffTotal = rows.filter((r) => !r.same).length;
  const done = diffTotal - pending.length;
  const allDone = pending.length === 0;
  const merged = allDone ? mergePoints(rows, candidate.decisions) : null;
  const adoptable = allDone && merged !== null && merged.length >= minPoints(view);

  return (
    <div className="candidate-resolver">
      <div className="resolver-head">
        <div>
          <p className="eyebrow">冲突处理 · {VIEW_LABEL[view]}</p>
          <h3>候选线待逐点核对</h3>
          <p className="resolver-meta">
            {candidate.author} 基于旧版提交（{candidate.time}）：{candidate.note}。
            当前线上已有他人更新的版本，请逐点选择保留哪一侧，全部处理后才可采纳。
          </p>
        </div>
        <div className="resolver-progress">
          <strong>{done}/{diffTotal}</strong>
          <span>差异点已处理</span>
        </div>
      </div>

      <div className="resolver-body">
        <div className="resolver-canvas">
          <OutlineCanvas
            kind={view}
            committed={current}
            candidate={candidate.points}
            merged={merged}
            showIndex
          />
          <div className="canvas-legend">
            <span><i className="lg lg-current" />当前生效线</span>
            <span><i className="lg lg-candidate" />候选线</span>
            {merged && <span><i className="lg lg-merged" />合并结果</span>}
          </div>
        </div>

        <table className="diff-table">
          <thead>
            <tr>
              <th>点</th>
              <th>当前线</th>
              <th>候选线</th>
              <th>处理</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if (row.same) {
                return (
                  <tr key={row.index} className="row-same">
                    <td>{row.index + 1}</td>
                    <td>{fmt(row.current)}</td>
                    <td>{fmt(row.candidate)}</td>
                    <td><span className="pill pill-ok">一致</span></td>
                  </tr>
                );
              }
              const decision = candidate.decisions[row.index];
              return (
                <tr key={row.index} className={decision ? "row-done" : "row-diff"}>
                  <td>{row.index + 1}</td>
                  <td>{fmt(row.current)}</td>
                  <td>{fmt(row.candidate)}</td>
                  <td>
                    <div className="diff-actions">
                      <button
                        className={decision === "current" ? "chosen" : ""}
                        onClick={() => onDecision(row.index, "current")}
                      >
                        留当前
                      </button>
                      <button
                        className={decision === "candidate" ? "chosen" : ""}
                        onClick={() => onDecision(row.index, "candidate")}
                      >
                        用候选
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="resolver-foot">
        {!allDone && <span className="hint">还有 {pending.length} 个差异点未处理</span>}
        {allDone && !adoptable && (
          <span className="hint danger">合并后点数不足（{VIEW_LABEL[view]}至少 {minPoints(view)} 点），请调整抉择</span>
        )}
        {adoptable && <span className="hint ok">差异已全部处理，可采纳合并结果</span>}
        <div className="resolver-buttons">
          <button className="danger-action" onClick={onDiscard}>放弃候选线</button>
          <button className="primary-action" disabled={!adoptable} onClick={onAdopt}>
            采纳候选线（{merged?.length ?? 0} 点）
          </button>
        </div>
      </div>
    </div>
  );
}
