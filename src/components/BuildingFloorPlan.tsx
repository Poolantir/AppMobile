import React, { useMemo } from 'react';
import { Restroom, Stall, Issue } from '../types';
import { motion } from 'motion/react';

type RoomStatus = 'recommended' | 'good' | 'warn' | 'offline';

interface Props {
  restrooms: Restroom[];
  stalls: Stall[];
  issues: Issue[];
  recommendedId: string | null;
  onSelect: (r: Restroom) => void;
}

const STATUS = {
  recommended: { fill: '#38bdf8', stroke: '#0ea5e9', label: '#7dd3fc', text: 'Best Option', pulse: true },
  good:        { fill: '#34d399', stroke: '#10b981', label: '#6ee7b7', text: 'Available',   pulse: false },
  warn:        { fill: '#fbbf24', stroke: '#f59e0b', label: '#fde68a', text: 'Issues',      pulse: false },
  offline:     { fill: '#334155', stroke: '#475569', label: '#64748b', text: 'Offline',     pulse: false },
};

// Spread positions evenly in a grid-like layout inside the building footprint
const DEFAULT_POS: [number, number][] = [
  [28, 35], [72, 35], [28, 65], [72, 65],
  [50, 50], [50, 22], [50, 78], [18, 50], [82, 50],
];

export const BuildingFloorPlan: React.FC<Props> = ({
  restrooms,
  stalls,
  issues,
  recommendedId,
  onSelect,
}) => {
  const W = 400;
  const H = 260;
  const ROOM_R = 24; // radius of restroom pin circle

  const rooms = useMemo(() =>
    restrooms.map((r, i) => {
      const [dx, dy] = DEFAULT_POS[i % DEFAULT_POS.length];
      const x = ((r.mapX ?? dx) / 100) * (W - 80) + 40;
      const y = ((r.mapY ?? dy) / 100) * (H - 80) + 40;

      const rs = stalls.filter(s => s.restroomId === r.id);
      const online = rs.filter(s => s.status === 'online').length;
      const hasIssues = issues.some(iss => iss.restroomId === r.id);
      const isRec = r.id === recommendedId;

      const status: RoomStatus = isRec ? 'recommended'
        : rs.length > 0 && online === 0 ? 'offline'
        : hasIssues ? 'warn' : 'good';

      return { ...r, x, y, status, online, total: rs.length };
    }),
    [restrooms, stalls, issues, recommendedId, W, H]
  );

  if (restrooms.length === 0) {
    return (
      <div className="glass-card py-16 text-center border-dashed">
        <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">No Restrooms Configured</p>
        <p className="text-xs text-slate-600 mt-2">No restrooms have been assigned to this building yet.</p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl overflow-hidden bg-[#080d1a] border border-white/10">
      {/* Floor plan SVG */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ display: 'block' }}
          aria-label="Building floor plan"
        >
          {/* Building footprint */}
          <rect
            x="12" y="12" width={W - 24} height={H - 24}
            rx="14" ry="14"
            fill="#0c1525"
            stroke="#1e2d45"
            strokeWidth="1.5"
          />
          {/* Interior floor texture lines */}
          {Array.from({ length: 8 }).map((_, i) => (
            <line
              key={`h${i}`}
              x1="24" y1={30 + i * 28} x2={W - 24} y2={30 + i * 28}
              stroke="#131e30" strokeWidth="0.8"
            />
          ))}
          {Array.from({ length: 14 }).map((_, i) => (
            <line
              key={`v${i}`}
              x1={28 + i * 28} y1="24" x2={28 + i * 28} y2={H - 24}
              stroke="#131e30" strokeWidth="0.8"
            />
          ))}

          {/* ── Restroom nodes ── */}
          {rooms.map(room => {
            const s = STATUS[room.status];
            return (
              <g
                key={room.id}
                onClick={() => onSelect(room)}
                style={{ cursor: 'pointer' }}
              >
                {/* Pulse ring for recommended */}
                {s.pulse && (
                  <circle
                    cx={room.x} cy={room.y} r={ROOM_R + 10}
                    fill={s.fill} opacity="0.15"
                  >
                    <animate attributeName="r" values={`${ROOM_R + 6};${ROOM_R + 18};${ROOM_R + 6}`} dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.25;0;0.25" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}

                {/* Outer ring */}
                <circle
                  cx={room.x} cy={room.y} r={ROOM_R + 4}
                  fill="none"
                  stroke={s.stroke}
                  strokeWidth="1.5"
                  opacity="0.4"
                />

                {/* Main circle */}
                <circle
                  cx={room.x} cy={room.y} r={ROOM_R}
                  fill={s.fill}
                  opacity="0.15"
                />
                <circle
                  cx={room.x} cy={room.y} r={ROOM_R}
                  fill="none"
                  stroke={s.stroke}
                  strokeWidth="2"
                />

                {/* Icon: restroom symbol (simple person) */}
                <text
                  x={room.x} y={room.y + 5}
                  textAnchor="middle"
                  fontSize="16"
                  style={{ userSelect: 'none' }}
                >
                  🚻
                </text>

                {/* Stall count badge */}
                {room.total > 0 && (
                  <>
                    <circle
                      cx={room.x + ROOM_R - 2} cy={room.y - ROOM_R + 4}
                      r="10"
                      fill="#0f172a"
                      stroke={s.stroke}
                      strokeWidth="1.5"
                    />
                    <text
                      x={room.x + ROOM_R - 2} y={room.y - ROOM_R + 8}
                      textAnchor="middle"
                      fill={s.label}
                      fontSize="8"
                      fontWeight="900"
                      fontFamily="system-ui,-apple-system,sans-serif"
                    >
                      {room.online}
                    </text>
                  </>
                )}

                {/* Name label */}
                <text
                  x={room.x}
                  y={room.y + ROOM_R + 16}
                  textAnchor="middle"
                  fill="white"
                  fontSize="9"
                  fontWeight="700"
                  fontFamily="system-ui,-apple-system,sans-serif"
                >
                  {room.name}
                </text>
                <text
                  x={room.x}
                  y={room.y + ROOM_R + 27}
                  textAnchor="middle"
                  fill={s.label}
                  fontSize="7"
                  fontWeight="800"
                  fontFamily="system-ui,-apple-system,sans-serif"
                  letterSpacing="0.8"
                  style={{ textTransform: 'uppercase' }}
                >
                  {s.text}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="px-5 pb-4 pt-1 flex flex-wrap gap-x-5 gap-y-1.5 justify-center border-t border-white/5">
        {(Object.entries(STATUS) as [RoomStatus, typeof STATUS[RoomStatus]][]).map(([key, s]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.fill }} />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{s.text}</span>
          </div>
        ))}
        <div className="w-full text-center text-[9px] text-slate-700 uppercase tracking-widest mt-1">
          Badge = online stalls · Tap to view details
        </div>
      </div>
    </div>
  );
};
