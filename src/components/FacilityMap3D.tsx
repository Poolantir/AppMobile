import React, { useMemo } from 'react';

// ─── Public types ─────────────────────────────────────────────────────────────
export type MapNodeStatus = 'recommended' | 'good' | 'warn' | 'offline';

export interface MapNode {
  id: string;
  name: string;
  sublabel?: string;
  status: MapNodeStatus;
  mapX: number; // 0–100 coordinate
  mapY: number; // 0–100 coordinate
}

// ─── Isometric grid helpers ──────────────────────────────────────────────────
const TW = 60;
const TH = 30;
const PAD = 32;

function tc(col: number, row: number): [number, number] {
  return [(col - row) * TW / 2, (col + row) * TH / 2];
}

function diamond(cx: number, cy: number): string {
  return `${cx},${cy - TH / 2} ${cx + TW / 2},${cy} ${cx},${cy + TH / 2} ${cx - TW / 2},${cy}`;
}

// ─── Styling ──────────────────────────────────────────────────────────────────
const FACES: Record<MapNodeStatus, { topF: string; leftF: string; rightF: string; label: string; glow: number }> = {
  recommended: { topF: '#38bdf8', leftF: '#0369a1', rightF: '#0284c7', label: '#7dd3fc', glow: 6 },
  good:        { topF: '#34d399', leftF: '#064e3b', rightF: '#065f46', label: '#6ee7b7', glow: 3 },
  warn:        { topF: '#fbbf24', leftF: '#78350f', rightF: '#92400e', label: '#fde68a', glow: 3 },
  offline:     { topF: '#334155', leftF: '#0f172a', rightF: '#1e293b', label: '#64748b', glow: 0 },
};

const HEIGHTS: Record<MapNodeStatus, number> = {
  recommended: 52, good: 34, warn: 30, offline: 16,
};

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  nodes: MapNode[];
  onSelect: (id: string) => void;
  cols?: number;
  rows?: number;
  header?: string;
}

export const FacilityMap3D: React.FC<Props> = ({
  nodes,
  onSelect,
  cols: COLS = 9,
  rows: ROWS = 7,
  header,
}) => {
  // Map 0–100 coordinates to grid indices
  const gridNodes = useMemo(() =>
    nodes.map(n => ({
      ...n,
      col: Math.round((n.mapX / 100) * (COLS - 1)),
      row: Math.round((n.mapY / 100) * (ROWS - 1)),
    })),
    [nodes, COLS, ROWS]
  );

  // Floor tiles back → front
  const floorTiles = useMemo(() => {
    const t: { col: number; row: number }[] = [];
    for (let c = 0; c < COLS; c++)
      for (let r = 0; r < ROWS; r++)
        t.push({ col: c, row: r });
    return t.sort((a, b) => (a.col + a.row) - (b.col + b.row));
  }, [COLS, ROWS]);

  const sortedNodes = useMemo(() =>
    [...gridNodes].sort((a, b) => (a.col + a.row) - (b.col + b.row)),
    [gridNodes]
  );

  // ViewBox
  const BLOCK_H_MAX = 56;
  const LABEL_H = 52;
  const minX = -(ROWS - 1) * TW / 2 - PAD;
  const maxX =  (COLS - 1) * TW / 2 + PAD;
  const minY = -BLOCK_H_MAX - LABEL_H - PAD;
  const maxY = ((COLS - 1) + (ROWS - 1)) * TH / 2 + TH / 2 + PAD;
  const vbW = maxX - minX;
  const vbH = maxY - minY;

  const [northX, northY] = tc(0, 0);

  return (
    <div className="w-full rounded-2xl overflow-hidden bg-[#080d1a] border border-white/10">
      {header && (
        <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{header}</span>
        </div>
      )}
      <svg
        width="100%"
        viewBox={`${minX} ${minY} ${vbW} ${vbH}`}
        style={{ display: 'block' }}
        aria-label="Facility map"
      >
        <defs>
          {(Object.entries(FACES) as [MapNodeStatus, typeof FACES[MapNodeStatus]][]).map(([key, f]) => {
            if (f.glow === 0) return null;
            return (
              <filter key={key} id={`glow-${key}`} x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur in="SourceGraphic" stdDeviation={f.glow} result="blur" />
                <feFlood floodColor={f.topF} floodOpacity="0.5" result="color" />
                <feComposite in="color" in2="blur" operator="in" result="colorBlur" />
                <feMerge>
                  <feMergeNode in="colorBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            );
          })}
        </defs>

        {/* Floor tiles */}
        {floorTiles.map(({ col, row }) => {
          const [cx, cy] = tc(col, row);
          const shade = (col + row) % 2 === 0 ? '#0c1424' : '#0f172a';
          const isEdge = col === 0 || col === COLS - 1 || row === 0 || row === ROWS - 1;
          return (
            <polygon
              key={`f-${col}-${row}`}
              points={diamond(cx, cy)}
              fill={isEdge ? '#0a1020' : shade}
              stroke="#1e2d45"
              strokeWidth="0.6"
            />
          );
        })}

        {/* Compass */}
        <text
          x={northX}
          y={northY - TH / 2 - 8}
          textAnchor="middle"
          fill="#334155"
          fontSize="9"
          fontWeight="900"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="2"
        >
          N ↑
        </text>

        {/* Blocks */}
        {sortedNodes.map(node => {
          const [cx, cy] = tc(node.col, node.row);
          const f = FACES[node.status];
          const blockH = HEIGHTS[node.status];
          const ty = cy - blockH;
          const topPts   = `${cx},${ty - TH/2} ${cx + TW/2},${ty} ${cx},${ty + TH/2} ${cx - TW/2},${ty}`;
          const leftPts  = `${cx - TW/2},${ty} ${cx},${ty + TH/2} ${cx},${cy + TH/2} ${cx - TW/2},${cy}`;
          const rightPts = `${cx + TW/2},${ty} ${cx},${ty + TH/2} ${cx},${cy + TH/2} ${cx + TW/2},${cy}`;
          const labelY    = ty - TH / 2 - 6;
          const sublabelY = labelY - 13;

          return (
            <g
              key={node.id}
              onClick={() => onSelect(node.id)}
              style={{ cursor: 'pointer' }}
              filter={node.status !== 'offline' ? `url(#glow-${node.status})` : undefined}
            >
              <polygon points={rightPts} fill={f.rightF} />
              <polygon points={leftPts}  fill={f.leftF}  />
              <polygon points={topPts}   fill={f.topF}   />
              {node.status === 'recommended' && (
                <polygon
                  points={topPts}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2"
                  opacity="0.6"
                  filter="url(#glow-recommended)"
                />
              )}
              {node.sublabel !== undefined && (
                <text
                  x={cx}
                  y={sublabelY}
                  textAnchor="middle"
                  fill={f.label}
                  fontSize="7"
                  fontWeight="900"
                  fontFamily="system-ui, -apple-system, sans-serif"
                  letterSpacing="1.2"
                  opacity="0.9"
                >
                  {node.status === 'recommended' ? '★ BEST OPTION' : node.sublabel}
                </text>
              )}
              <text
                x={cx}
                y={labelY}
                textAnchor="middle"
                fill="white"
                fontSize="9"
                fontWeight="700"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                {node.name}
              </text>
            </g>
          );
        })}

        {nodes.length === 0 && (
          <text
            x="0" y="0"
            textAnchor="middle"
            fill="#334155"
            fontSize="11"
            fontWeight="700"
            fontFamily="system-ui, sans-serif"
          >
            No data
          </text>
        )}
      </svg>

      {/* Legend */}
      <div className="px-5 pb-4 pt-1 flex flex-wrap gap-x-5 gap-y-2 justify-center border-t border-white/5">
        {([
          ['recommended', 'Best Option'],
          ['good',        'Available'],
          ['warn',        'Issues'],
          ['offline',     'Offline'],
        ] as [MapNodeStatus, string][]).map(([s, label]) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: FACES[s].topF }} />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
