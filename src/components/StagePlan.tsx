import { useState } from "react";
import { FIXTURES, LIGHT_TYPE_COLORS, type LightFixture, type LightType } from "../data/fixtures";
import { LightDetailPanel } from "./LightDetailPanel";

const STAGE_VIEWBOX = "0 0 900 600";

const ALL_TYPES: LightType[] = ["面光", "侧光", "逆光", "效果光"];

export function StagePlan() {
  const [selected, setSelected] = useState<LightFixture | null>(null);
  const [filter, setFilter] = useState<LightType | null>(null);

  const filtered = filter
    ? FIXTURES.filter((f) => f.type === filter)
    : FIXTURES;

  const handleFixtureClick = (fixture: LightFixture) => {
    setSelected((prev) => (prev?.id === fixture.id ? null : fixture));
  };

  return (
    <section className="stage-plan-module">
      <div className="stage-plan-header">
        <div>
          <p className="stage-plan-label">灯位布局</p>
          <h2>舞台平面灯位图</h2>
        </div>
        <div className="stage-plan-chips">
          <button
            className={!filter ? "chip active" : "chip"}
            onClick={() => setFilter(null)}
          >
            全部
          </button>
          {ALL_TYPES.map((t) => (
            <button
              key={t}
              className={filter === t ? "chip active" : "chip"}
              style={
                filter === t
                  ? { background: LIGHT_TYPE_COLORS[t], borderColor: LIGHT_TYPE_COLORS[t], color: "#fff" }
                  : {}
              }
              onClick={() => setFilter(filter === t ? null : t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="stage-plan-body">
        <div className="stage-plan-canvas">
          <svg viewBox={STAGE_VIEWBOX} className="stage-svg" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
              </pattern>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <rect x="0" y="0" width="900" height="600" fill="#f8fafc" />

            <rect x="140" y="40" width="620" height="440" rx="4" fill="url(#grid)" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="6 3" />

            <rect x="140" y="470" width="620" height="6" rx="3" fill="#94a3b8" />

            <text x="450" y="496" textAnchor="middle" fill="#94a3b8" fontSize="13" fontWeight="600">台 口 · Proscenium</text>

            <text x="450" y="570" textAnchor="middle" fill="#cbd5e1" fontSize="14" letterSpacing="8">观 众 席</text>

            <text x="450" y="32" textAnchor="middle" fill="#94a3b8" fontSize="12">↑ 上场门 (Upstage)</text>

            <text x="130" y="280" textAnchor="middle" fill="#94a3b8" fontSize="12" transform="rotate(-90, 130, 280)">下场门</text>
            <text x="780" y="280" textAnchor="middle" fill="#94a3b8" fontSize="12" transform="rotate(90, 780, 280)">上场门</text>

            <text x="450" y="62" textAnchor="middle" fill="#cbd5e1" fontSize="10">一幕线</text>
            <line x1="160" y1="66" x2="740" y2="66" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 2" />

            <text x="450" y="260" textAnchor="middle" fill="#e2e8f0" fontSize="10">二幕线</text>
            <line x1="160" y1="264" x2="740" y2="264" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 2" />

            {filtered.map((fixture) => {
              const color = LIGHT_TYPE_COLORS[fixture.type];
              const isSelected = selected?.id === fixture.id;
              const isOff = fixture.brightness === 0;
              const radius = isOff ? 8 : 10 + (fixture.brightness / 100) * 4;

              return (
                <g
                  key={fixture.id}
                  className="fixture-group"
                  onClick={() => handleFixtureClick(fixture)}
                  style={{ cursor: "pointer" }}
                >
                  {fixture.brightness > 0 && (
                    <circle cx={fixture.x} cy={fixture.y} r={radius + 6} fill={color} opacity={fixture.brightness / 300} filter="url(#glow)" />
                  )}
                  <circle
                    cx={fixture.x}
                    cy={fixture.y}
                    r={radius}
                    fill={isOff ? "#e2e8f0" : color}
                    stroke={isSelected ? "#fff" : "transparent"}
                    strokeWidth={isSelected ? 3 : 0}
                    opacity={isOff ? 0.5 : 1}
                  />
                  <circle cx={fixture.x} cy={fixture.y} r={radius - 3} fill={isOff ? "#cbd5e1" : "#fff"} opacity={0.9} />
                  <circle cx={fixture.x} cy={fixture.y} r={radius - 5} fill={isOff ? "#e2e8f0" : color} opacity={isOff ? 0.3 : 0.6 + (fixture.brightness / 250)} />

                  <text x={fixture.x} y={fixture.y - radius - 8} textAnchor="middle" fill="#334155" fontSize="10" fontWeight="700">{fixture.number}</text>
                  <text x={fixture.x} y={fixture.y + radius + 14} textAnchor="middle" fill="#64748b" fontSize="9">{fixture.channel}</text>
                  <text x={fixture.x} y={fixture.y + radius + 26} textAnchor="middle" fill={isOff ? "#94a3b8" : color} fontSize="9" fontWeight="600">
                    {fixture.brightness}%
                  </text>
                </g>
              );
            })}
          </svg>

          <div className="stage-plan-legend">
            {ALL_TYPES.map((t) => (
              <span key={t} className="legend-item">
                <span className="legend-dot" style={{ background: LIGHT_TYPE_COLORS[t] }} />
                {t}
              </span>
            ))}
          </div>
        </div>

        <LightDetailPanel fixture={selected} onClose={() => setSelected(null)} />
      </div>
    </section>
  );
}
