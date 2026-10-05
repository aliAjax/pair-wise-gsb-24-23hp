import { useRef } from "react";
import type { Point, ViewKind } from "../types";

export interface OldLine {
  id: string;
  label: string;
  points: Point[];
}

interface Props {
  kind: ViewKind;
  committed: Point[];
  draft?: Point[] | null;
  candidate?: Point[] | null;
  merged?: Point[] | null;
  oldLines?: OldLine[];
  preview?: OldLine | null;
  drawing?: boolean;
  showIndex?: boolean;
  onAddPoint?: (p: Point) => void;
}

const W = 100;
const H = 70;

function toAttr(points: Point[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

function VertexLabels({ points, color }: { points: Point[]; color: string }) {
  return (
    <>
      {points.map((p, i) => (
        <g key={`${p.x}-${p.y}-${i}`}>
          <circle cx={p.x} cy={p.y} r={1.7} fill="#fff" stroke={color} strokeWidth={0.7} />
          <text x={p.x + 1.2} y={p.y - 1.2} fontSize={3.4} fill={color} fontWeight={700}>
            {i + 1}
          </text>
        </g>
      ))}
    </>
  );
}

/** 双视图共用的绘图画布：平面图按闭合多边形渲染，剖面图按开口折线渲染 */
export function OutlineCanvas({
  kind,
  committed,
  draft,
  candidate,
  merged,
  oldLines = [],
  preview = null,
  drawing = false,
  showIndex = false,
  onAddPoint,
}: Props) {
  const ref = useRef<SVGSVGElement>(null);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!drawing || !onAddPoint || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    onAddPoint({ x: Math.round(x), y: Math.round(y) });
  };

  const closed = kind === "plan";
  const Shape = closed ? "polygon" : "polyline";

  const grid: React.ReactNode[] = [];
  for (let x = 0; x <= W; x += 5) {
    grid.push(
      <line key={`v${x}`} x1={x} y1={0} x2={x} y2={H}
        stroke={x % 10 === 0 ? "#dbe3ef" : "#eef2f8"} strokeWidth={0.3} />,
    );
  }
  for (let y = 0; y <= H; y += 5) {
    grid.push(
      <line key={`h${y}`} x1={0} y1={y} x2={W} y2={y}
        stroke={y % 10 === 0 ? "#dbe3ef" : "#eef2f8"} strokeWidth={0.3} />,
    );
  }

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${W} ${H}`}
      className={`outline-canvas${drawing ? " drawing" : ""}`}
      onClick={handleClick}
      role="img"
      aria-label={closed ? "平面图绘图画布" : "剖面图绘图画布"}
    >
      {grid}
      <text x={2} y={5} fontSize={3.2} fill="#94a3b8">
        {closed ? "N↑ 网格 1m" : "深度↓ 网格 1m"}
      </text>

      {/* 旧线（历史版本） */}
      {oldLines.map((l) => (
        <Shape
          key={l.id}
          points={toAttr(l.points)}
          fill="none"
          stroke="#94a3b8"
          strokeWidth={0.6}
          strokeDasharray="2 1.6"
          opacity={0.75}
        />
      ))}

      {/* 历史版本预览（在时间线中点“查看”） */}
      {preview && (
        <Shape
          points={toAttr(preview.points)}
          fill={closed ? "rgba(124,58,237,0.08)" : "none"}
          stroke="#7c3aed"
          strokeWidth={0.9}
          strokeDasharray="3 1.6"
        />
      )}

      {/* 当前生效线 */}
      {committed.length > 0 && (
        <Shape
          points={toAttr(committed)}
          fill={closed ? "rgba(71,85,105,0.10)" : "none"}
          stroke="#475569"
          strokeWidth={1}
        />
      )}
      {showIndex && <VertexLabels points={committed} color="#475569" />}

      {/* 候选线 */}
      {candidate && candidate.length > 0 && (
        <Shape
          points={toAttr(candidate)}
          fill="none"
          stroke="#d97706"
          strokeWidth={0.9}
          strokeDasharray="2.6 1.6"
        />
      )}
      {showIndex && candidate && <VertexLabels points={candidate} color="#d97706" />}

      {/* 候选线逐点合并结果预览 */}
      {merged && merged.length > 0 && (
        <Shape
          points={toAttr(merged)}
          fill={closed ? "rgba(4,120,87,0.10)" : "none"}
          stroke="#047857"
          strokeWidth={1}
        />
      )}

      {/* 正在绘制的草稿 */}
      {draft && draft.length > 0 && (
        <>
          <polyline
            points={toAttr(draft)}
            fill="none"
            stroke="#047857"
            strokeWidth={1}
          />
          {closed && draft.length > 2 && (
            <line
              x1={draft[draft.length - 1].x}
              y1={draft[draft.length - 1].y}
              x2={draft[0].x}
              y2={draft[0].y}
              stroke="#047857"
              strokeWidth={0.6}
              strokeDasharray="2 1.6"
            />
          )}
          <VertexLabels points={draft} color="#047857" />
        </>
      )}
    </svg>
  );
}
