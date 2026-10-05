import { useRef, useState } from "react";
import { DrawPoint, ViewType } from "../types";

export interface Marker {
  x: number;
  y: number;
  label: string;
  settled: boolean;
}

interface Props {
  view: ViewType;
  committed: DrawPoint[];
  stale: boolean;
  editing: boolean;
  draft: DrawPoint[] | null;
  ghost: DrawPoint[] | null; // 旧线
  ghostLabel: string | null;
  overlay: DrawPoint[] | null; // 候选线
  markers: Marker[];
  onAddPoint?: (p: DrawPoint) => void;
  onMovePoint?: (index: number, p: DrawPoint) => void;
}

const W = 420;
const H = 300;

const VIEW_COLOR: Record<ViewType, string> = {
  plan: "#854d0e",
  section: "#047857",
};

function toPath(points: DrawPoint[], close: boolean): string {
  if (points.length === 0) return "";
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  return close ? `${d} Z` : d;
}

export default function OutlineCanvas(props: Props) {
  const { view, committed, stale, editing, draft, ghost, ghostLabel, overlay, markers } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const color = VIEW_COLOR[view];
  const closed = view === "plan"; // 平面图闭合，剖面图为开口剖面线

  const toSvg = (clientX: number, clientY: number): DrawPoint | null => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Math.max(0, Math.min(W, Math.round(((clientX - rect.left) / rect.width) * W))),
      y: Math.max(0, Math.min(H, Math.round(((clientY - rect.top) / rect.height) * H))),
    };
  };

  const gridLines = [];
  for (let x = 30; x < W; x += 30) {
    gridLines.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={H} className="grid-line" />);
  }
  for (let y = 30; y < H; y += 30) {
    gridLines.push(<line key={`h${y}`} x1={0} y1={y} x2={W} y2={y} className="grid-line" />);
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className={`outline-canvas${editing ? " editing" : ""}`}
      onPointerDown={(e) => {
        if (!editing || dragIndex !== null || !props.onAddPoint) return;
        const p = toSvg(e.clientX, e.clientY);
        if (p) props.onAddPoint(p);
      }}
      onPointerMove={(e) => {
        if (dragIndex === null || !props.onMovePoint) return;
        const p = toSvg(e.clientX, e.clientY);
        if (p) props.onMovePoint(dragIndex, p);
      }}
      onPointerUp={() => setDragIndex(null)}
      onPointerLeave={() => setDragIndex(null)}
    >
      {gridLines}
      <text x={W - 8} y={H - 8} className="axis-label" textAnchor="end">
        {view === "plan" ? "东 →" : "水平 →"}
      </text>
      <text x={8} y={16} className="axis-label">
        {view === "plan" ? "北 ↑" : "深度 ↓"}
      </text>

      {/* 旧线（历史版本） */}
      {ghost && (
        <g className="ghost-line">
          <path d={toPath(ghost, closed)} fill="none" />
          {ghost.map((p, i) => (
            <rect key={i} x={p.x - 3} y={p.y - 3} width={6} height={6} />
          ))}
        </g>
      )}

      {/* 当前线 */}
      <path
        d={toPath(committed, closed)}
        fill={closed ? color : "none"}
        fillOpacity={0.1}
        stroke={color}
        strokeWidth={2}
        strokeDasharray={stale ? "7 4" : undefined}
      />
      {committed.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={color} />
      ))}

      {/* 候选线叠加 */}
      {overlay && (
        <g className="candidate-line">
          <path d={toPath(overlay, closed)} fill="none" />
          {overlay.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={3.5} />
          ))}
        </g>
      )}

      {/* 差异点标记 */}
      {markers.map((m, i) => (
        <g key={i} className={`diff-marker${m.settled ? " settled" : ""}`}>
          <circle cx={m.x} cy={m.y} r={9} />
          <text x={m.x} y={m.y + 3.5} textAnchor="middle">
            {m.label}
          </text>
        </g>
      ))}

      {/* 草稿线 */}
      {editing && draft && (
        <g>
          <path d={toPath(draft, closed)} fill="none" className="draft-line" />
          {draft.map((p, i) => (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r={6}
                className="draft-point"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setDragIndex(i);
                }}
              />
              <text x={p.x + 8} y={p.y - 6} className="point-index">
                {i + 1}
              </text>
            </g>
          ))}
        </g>
      )}

      {ghostLabel && (
        <text x={8} y={H - 10} className="ghost-label">
          {ghostLabel}
        </text>
      )}
    </svg>
  );
}
