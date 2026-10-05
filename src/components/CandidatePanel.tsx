import {
  Candidate,
  DiffChoice,
  Unit,
  ViewType,
} from "../types";
import {
  Action,
  VIEW_LABEL,
  buildMerged,
  computeDiff,
  fmtTime,
} from "../store";

interface Props {
  unit: Unit;
  decisions: Record<string, Record<number, DiffChoice>>;
  inspecting: string | null;
  dispatch: React.Dispatch<Action>;
}

function ChoiceButton(props: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`choice-btn${props.active ? " active" : ""}`}
      onClick={props.onClick}
    >
      {props.label}
    </button>
  );
}

function CandidateCard(props: {
  unitId: string;
  view: ViewType;
  candidate: Candidate;
  currentPoints: { x: number; y: number }[];
  currentVersion: number;
  decisions: Record<number, DiffChoice>;
  inspecting: boolean;
  dispatch: React.Dispatch<Action>;
}) {
  const { candidate, currentPoints, currentVersion, decisions, dispatch } = props;
  const diffs = computeDiff(currentPoints, candidate.points);
  const settled = diffs.filter((_, i) => decisions[i]).length;
  const merged = buildMerged(currentPoints, candidate.points, decisions);
  const allSettled = diffs.length > 0 && merged !== null;

  return (
    <article className="candidate-card">
      <header>
        <strong>{VIEW_LABEL[props.view]}候选线</strong>
        <span>
          {candidate.author} · {fmtTime(candidate.time)} · 基于 v{candidate.baseVersion}（当前 v
          {currentVersion}）
        </span>
      </header>
      <p className="candidate-note">{candidate.note}</p>
      <div className="candidate-actions">
        <button
          onClick={() =>
            dispatch({
              type: "INSPECT_CANDIDATE",
              candidateId: props.inspecting ? null : candidate.id,
            })
          }
        >
          {props.inspecting ? "隐藏图上对比" : "图上对比"}
        </button>
        <span className={`diff-progress${allSettled ? " done" : ""}`}>
          差异处理 {settled}/{diffs.length}
        </span>
      </div>

      {diffs.length === 0 ? (
        <p className="diff-empty">候选线与当前线一致，无需合并，可直接放弃。</p>
      ) : (
        <ul className="diff-list">
          {diffs.map((item, i) => {
            const choice = decisions[i];
            return (
              <li key={i} className={choice ? "settled" : ""}>
                <span className="diff-title">
                  #{i + 1} 点 {item.index + 1}：
                  {item.kind === "modify" &&
                    `当前 (${item.current.x}, ${item.current.y}) ↔ 候选 (${item.candidate.x}, ${item.candidate.y})`}
                  {item.kind === "add" && `候选新增 (${item.candidate.x}, ${item.candidate.y})`}
                  {item.kind === "remove" &&
                    `当前多出 (${item.current.x}, ${item.current.y})，候选未包含`}
                </span>
                <span className="diff-choices">
                  {item.kind === "modify" && (
                    <>
                      <ChoiceButton
                        active={choice === "current"}
                        label="保留当前"
                        onClick={() =>
                          dispatch({
                            type: "RESOLVE_DIFF",
                            candidateId: candidate.id,
                            diffIndex: i,
                            choice: "current",
                          })
                        }
                      />
                      <ChoiceButton
                        active={choice === "candidate"}
                        label="采用候选"
                        onClick={() =>
                          dispatch({
                            type: "RESOLVE_DIFF",
                            candidateId: candidate.id,
                            diffIndex: i,
                            choice: "candidate",
                          })
                        }
                      />
                    </>
                  )}
                  {item.kind === "add" && (
                    <>
                      <ChoiceButton
                        active={choice === "add"}
                        label="加入此点"
                        onClick={() =>
                          dispatch({
                            type: "RESOLVE_DIFF",
                            candidateId: candidate.id,
                            diffIndex: i,
                            choice: "add",
                          })
                        }
                      />
                      <ChoiceButton
                        active={choice === "drop"}
                        label="舍弃"
                        onClick={() =>
                          dispatch({
                            type: "RESOLVE_DIFF",
                            candidateId: candidate.id,
                            diffIndex: i,
                            choice: "drop",
                          })
                        }
                      />
                    </>
                  )}
                  {item.kind === "remove" && (
                    <>
                      <ChoiceButton
                        active={choice === "keep"}
                        label="保留此点"
                        onClick={() =>
                          dispatch({
                            type: "RESOLVE_DIFF",
                            candidateId: candidate.id,
                            diffIndex: i,
                            choice: "keep",
                          })
                        }
                      />
                      <ChoiceButton
                        active={choice === "remove"}
                        label="删除"
                        onClick={() =>
                          dispatch({
                            type: "RESOLVE_DIFF",
                            candidateId: candidate.id,
                            diffIndex: i,
                            choice: "remove",
                          })
                        }
                      />
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="candidate-actions">
        <button
          className="primary-action"
          disabled={!allSettled}
          title={allSettled ? "" : "需先逐点处理全部差异"}
          onClick={() => {
            if (!merged) return;
            dispatch({
              type: "ADOPT_CANDIDATE",
              unitId: props.unitId,
              view: props.view,
              candidateId: candidate.id,
              merged,
            });
          }}
        >
          采纳合并结果
        </button>
        <button
          className="danger-action"
          onClick={() =>
            dispatch({
              type: "DISCARD_CANDIDATE",
              unitId: props.unitId,
              view: props.view,
              candidateId: candidate.id,
            })
          }
        >
          放弃候选线
        </button>
      </div>
    </article>
  );
}

export default function CandidatePanel({ unit, decisions, inspecting, dispatch }: Props) {
  const views: ViewType[] = ["plan", "section"];
  const total = views.reduce((n, v) => n + unit.candidates[v].length, 0);

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>并发提交</p>
          <h2>候选线校核</h2>
        </div>
        <span className="count-badge">{total} 条待处理</span>
      </div>
      {total === 0 && <p className="empty-hint">暂无候选线。两人基于同一版本同时改绘时，后提交的会自动转为候选线，在此逐点校核。</p>}
      {views.map((view) =>
        unit.candidates[view].map((candidate) => (
          <CandidateCard
            key={candidate.id}
            unitId={unit.id}
            view={view}
            candidate={candidate}
            currentPoints={unit.views[view].committed.points}
            currentVersion={unit.views[view].committed.version}
            decisions={decisions[candidate.id] ?? {}}
            inspecting={inspecting === candidate.id}
            dispatch={dispatch}
          />
        ))
      )}
    </section>
  );
}
