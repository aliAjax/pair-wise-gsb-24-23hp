import { useState } from "react";
import { Unit, ViewType } from "../types";
import {
  Action,
  Editing,
  VIEW_LABEL,
  computeDiff,
  draftKey,
  fmtTime,
} from "../store";
import { Draft, DiffChoice } from "../types";
import OutlineCanvas, { Marker } from "./OutlineCanvas";

interface Props {
  unit: Unit;
  view: ViewType;
  editing: Editing | null;
  drafts: Record<string, Draft>;
  decisions: Record<string, Record<number, DiffChoice>>;
  currentUser: string;
  historyVersion: number | null;
  inspecting: string | null;
  dispatch: React.Dispatch<Action>;
}

export default function ViewCard(props: Props) {
  const { unit, view, editing, drafts, currentUser, dispatch } = props;
  const [note, setNote] = useState("");
  const vs = unit.views[view];
  const stale = vs.staleSince !== null;

  const isEditing =
    editing !== null && editing.unitId === unit.id && editing.view === view;
  const draft = isEditing
    ? drafts[draftKey(unit.id, view, editing!.user)] ?? null
    : null;
  const myDraft = drafts[draftKey(unit.id, view, currentUser)] ?? null;

  const ghostRev =
    props.historyVersion !== null
      ? vs.history.find((r) => r.version === props.historyVersion) ?? null
      : null;

  const inspected = unit.candidates[view].find((c) => c.id === props.inspecting) ?? null;
  const markers: Marker[] = inspected
    ? computeDiff(vs.committed.points, inspected.points).map((item, i) => {
        const at = item.kind === "remove" ? item.current : item.candidate;
        return {
          x: at.x,
          y: at.y,
          label: String(i + 1),
          settled: Boolean(props.decisions[inspected.id]?.[i]),
        };
      })
    : [];

  return (
    <section className={`view-card${stale ? " stale" : ""}`}>
      <header className="view-head">
        <div>
          <h3>
            {VIEW_LABEL[view]}
            <span className="version-tag">v{vs.committed.version}</span>
          </h3>
          <p>
            {vs.committed.author} · {fmtTime(vs.committed.time)} · {vs.committed.note}
          </p>
        </div>
        {stale ? (
          <span className="badge badge-stale">失效待复核</span>
        ) : (
          <span className="badge badge-ok">有效</span>
        )}
      </header>

      <OutlineCanvas
        view={view}
        committed={vs.committed.points}
        stale={stale}
        editing={isEditing}
        draft={draft?.points ?? null}
        ghost={ghostRev?.points ?? null}
        ghostLabel={ghostRev ? `旧线 v${ghostRev.version} · ${ghostRev.author}` : null}
        overlay={inspected?.points ?? null}
        markers={markers}
        onAddPoint={(p) => dispatch({ type: "ADD_POINT", point: p })}
        onMovePoint={(index, p) => dispatch({ type: "MOVE_POINT", index, point: p })}
      />

      {isEditing ? (
        <div className="toolbar">
          <input
            value={note}
            placeholder="修订说明（如：北缘外扩 0.5m）"
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="toolbar-row">
            <button
              className="primary-action"
              onClick={() => {
                dispatch({ type: "SAVE_DRAFT", note });
                setNote("");
              }}
            >
              保存（基于 v{draft?.baseVersion}）
            </button>
            <button onClick={() => dispatch({ type: "UNDO_POINT" })}>撤销点</button>
            <button onClick={() => dispatch({ type: "CLEAR_POINTS" })}>清空</button>
            <button onClick={() => dispatch({ type: "RESET_POINTS" })}>重置为当前线</button>
            <button onClick={() => dispatch({ type: "CANCEL_EDIT" })}>退出（保留草稿）</button>
            <button
              className="danger-action"
              onClick={() => dispatch({ type: "DISCARD_DRAFT" })}
            >
              放弃草稿
            </button>
          </div>
          <p className="hint">
            点击空白处加点，拖动蓝点微调。草稿实时暂存本地，保存失败或关闭页面后可恢复续画。
          </p>
        </div>
      ) : (
        <div className="toolbar">
          <div className="toolbar-row">
            <button onClick={() => dispatch({ type: "START_EDIT", unitId: unit.id, view })}>
              {myDraft ? `继续改绘（草稿 ${myDraft.points.length} 点）` : "改绘轮廓"}
            </button>
            {stale && (
              <button
                className="primary-action"
                onClick={() => dispatch({ type: "CONFIRM_VIEW", unitId: unit.id, view })}
              >
                复核确认：与{VIEW_LABEL[view === "plan" ? "section" : "plan"]}一致
              </button>
            )}
            {editing && editing.unitId === unit.id && editing.view !== view && (
              <span className="hint">正在改绘本单位的{VIEW_LABEL[editing.view]}</span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
