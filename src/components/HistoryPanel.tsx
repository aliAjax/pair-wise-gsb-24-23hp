import { useState } from "react";
import { Unit, ViewType } from "../types";
import { Action, SOURCE_LABEL, VIEW_LABEL, fmtTime } from "../store";

interface Props {
  unit: Unit;
  historyView: Record<string, number | null>;
  dispatch: React.Dispatch<Action>;
}

export default function HistoryPanel({ unit, historyView, dispatch }: Props) {
  const [tab, setTab] = useState<ViewType>("plan");
  const vs = unit.views[tab];
  const viewing = historyView[`${unit.id}:${tab}`] ?? null;
  const revisions = [...vs.history].reverse();

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>修订记录</p>
          <h2>旧线档案</h2>
        </div>
        <div className="tabs">
          {(["plan", "section"] as ViewType[]).map((v) => (
            <button
              key={v}
              className={tab === v ? "active" : ""}
              onClick={() => setTab(v)}
            >
              {VIEW_LABEL[v]}
            </button>
          ))}
        </div>
      </div>
      <ul className="history-list">
        {revisions.map((rev) => {
          const isCurrent = rev.version === vs.committed.version;
          const isViewing = viewing === rev.version;
          return (
            <li key={rev.version} className={isViewing ? "viewing" : ""}>
              <div className="history-main">
                <strong>
                  v{rev.version}
                  {isCurrent && <em className="tag-current">当前线</em>
                  }
                </strong>
                <span>
                  {rev.author} · {fmtTime(rev.time)} · {rev.points.length} 点 ·{" "}
                  {SOURCE_LABEL[rev.source]}
                </span>
                <p>{rev.note}</p>
              </div>
              {!isCurrent && (
                <button
                  onClick={() =>
                    dispatch({
                      type: "VIEW_HISTORY",
                      unitId: unit.id,
                      view: tab,
                      version: isViewing ? null : rev.version,
                    })
                  }
                >
                  {isViewing ? "隐藏旧线" : "查看旧线"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
