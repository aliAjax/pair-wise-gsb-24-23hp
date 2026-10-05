import { Unit } from "../types";
import { isVerified, pendingReasons } from "../store";

export default function StatsPanel({ units }: { units: Unit[] }) {
  const verified = units.filter(isVerified);
  const total = verified.reduce(
    (sum, u) => sum + u.artifacts.reduce((s, a) => s + a.count, 0),
    0
  );

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>出土物统计</p>
          <h2>仅计入已校核遗迹</h2>
        </div>
        <span className="count-badge">
          合计 {total} 件 · {verified.length}/{units.length} 处入统
        </span>
      </div>
      <table className="stats-table">
        <thead>
          <tr>
            <th>遗迹单位</th>
            <th>出土物</th>
            <th>校核状态</th>
            <th>是否入统</th>
          </tr>
        </thead>
        <tbody>
          {units.map((u) => {
            const ok = isVerified(u);
            const subtotal = u.artifacts.reduce((s, a) => s + a.count, 0);
            return (
              <tr key={u.id} className={ok ? "" : "excluded"}>
                <td>
                  {u.name}
                  <span className="unit-sub">{u.square}</span>
                </td>
                <td>{u.artifacts.map((a) => `${a.name}×${a.count}`).join("、")}</td>
                <td>{ok ? "已校核" : pendingReasons(u).join("；")}</td>
                <td>{ok ? `计入 ${subtotal} 件` : "复核中，暂不计入"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
