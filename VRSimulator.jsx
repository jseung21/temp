import { useState, useMemo } from "react";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from "recharts";

// ─── TQQQ 시뮬레이션 가격 (40사이클 = 80주) ─────────────────────────────────
// 상승 → 급락(매수구간) → 회복 → 급등(매도구간) → 조정(매수) → 강세(매도) 패턴
const PRICES = [
  50,   54,   58,   55,   62,   68,   73,   66,   74,   63,
  55,   47,   40,   44,   51,   58,   66,   74,   80,   75,
  85,   94,  103,   95,  108,   97,   82,   92,  102,  111,
  102,  117,  129,  120,  135,  146,  158,  148,  164,  173,  184
];

// ─── 시뮬레이션 엔진 ──────────────────────────────────────────────────────────
function runSimulation({ initialV, initialPool, G, contribution, bandPct, poolLimit }) {
  let V = initialV;
  let pool = initialPool;
  let shares = initialV / PRICES[0];
  const result = [];
  const cycles = PRICES.length - 1;

  for (let i = 0; i <= cycles; i++) {
    const price = PRICES[i];
    const minBand = V * (1 - bandPct);
    const maxBand = V * (1 + bandPct);
    let evaluation = shares * price;
    let action = null;
    let actionAmount = 0;
    let evalBefore = evaluation;

    if (i > 0) {
      if (evaluation < minBand && pool > 0) {
        const needed = V - evaluation;
        const buyAmt = Math.min(needed, pool * poolLimit);
        if (buyAmt > 0) {
          shares += buyAmt / price;
          pool -= buyAmt;
          evaluation = shares * price;
          action = "BUY";
          actionAmount = buyAmt;
        }
      } else if (evaluation > maxBand) {
        const excess = evaluation - V;
        shares -= excess / price;
        pool += excess;
        evaluation = shares * price;
        action = "SELL";
        actionAmount = excess;
      }
    }

    result.push({
      cycle: i,
      week: i * 2,
      eval: Math.round(evaluation),
      evalBefore: Math.round(evalBefore),
      V: Math.round(V),
      min: Math.round(minBand),
      max: Math.round(maxBand),
      pool: Math.round(pool),
      price,
      action,
      actionAmount: Math.round(actionAmount),
      totalAsset: Math.round(evaluation + pool),
    });

    if (i < cycles) {
      const poolBefore = pool;
      pool += contribution;
      V = V + poolBefore / G + contribution;
    }
  }
  return result;
}

// ─── 커스텀 dot 렌더러 ────────────────────────────────────────────────────────
const EvalDot = (props) => {
  const { cx, cy, payload } = props;
  if (!cx || !cy) return null;
  if (payload.action === "BUY") {
    return (
      <g key={`buy-${payload.cycle}`}>
        <circle cx={cx} cy={cy} r={9} fill="#00cc77" fillOpacity={0.18} />
        <circle cx={cx} cy={cy} r={5} fill="#00cc77" stroke="#fff" strokeWidth={1} />
        <text x={cx} y={cy - 16} textAnchor="middle" fill="#00cc77" fontSize={9} fontFamily="monospace" fontWeight="bold">매수</text>
      </g>
    );
  }
  if (payload.action === "SELL") {
    return (
      <g key={`sell-${payload.cycle}`}>
        <circle cx={cx} cy={cy} r={9} fill="#ff4444" fillOpacity={0.18} />
        <circle cx={cx} cy={cy} r={5} fill="#ff4444" stroke="#fff" strokeWidth={1} />
        <text x={cx} y={cy - 16} textAnchor="middle" fill="#ff4444" fontSize={9} fontFamily="monospace" fontWeight="bold">매도</text>
      </g>
    );
  }
  return <circle key={`dot-${payload.cycle}`} cx={cx} cy={cy} r={2} fill="#4da6ff" fillOpacity={0.5} />;
};

// ─── 커스텀 툴팁 ─────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{
      background: "#0d1117", border: "1px solid #30363d", borderRadius: 8,
      padding: "12px 16px", fontSize: 11, fontFamily: "monospace", lineHeight: 1.7
    }}>
      <div style={{ color: "#8892b0", marginBottom: 6, fontWeight: 700 }}>
        {d.week}주차 (사이클 {d.cycle})
      </div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>${Number(p.value).toLocaleString()}</strong>
        </div>
      ))}
      <div style={{ color: "#6e7681", marginTop: 4 }}>
        TQQQ 가격: ${d.price} · Pool: ${d.pool?.toLocaleString()}
      </div>
      {d.action && (
        <div style={{
          marginTop: 8, padding: "6px 10px", borderRadius: 4,
          background: d.action === "BUY" ? "rgba(0,200,100,0.12)" : "rgba(255,60,60,0.12)",
          color: d.action === "BUY" ? "#00cc77" : "#ff5555",
          fontWeight: 700
        }}>
          {d.action === "BUY" ? "▲ 매수" : "▼ 매도"} ${d.actionAmount?.toLocaleString()}
        </div>
      )}
    </div>
  );
};

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function VRSimulator() {
  const [G, setG] = useState(10);
  const [contribution, setContribution] = useState(250);
  const [bandPct, setBandPct] = useState(15);

  const data = useMemo(() =>
    runSimulation({
      initialV: 5000, initialPool: 1000,
      G, contribution,
      bandPct: bandPct / 100,
      poolLimit: 0.75,
    }), [G, contribution, bandPct]
  );

  const buys = data.filter((d) => d.action === "BUY");
  const sells = data.filter((d) => d.action === "SELL");
  const final = data[data.length - 1];
  const totalInvested = 5000 + 1000 + contribution * (data.length - 1);
  const roi = ((final.totalAsset / totalInvested - 1) * 100).toFixed(1);

  const S = styles;

  return (
    <div style={S.root}>
      {/* 헤더 */}
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h1 style={S.title}>TQQQ · VR 전략 시뮬레이터</h1>
          <span style={S.badge}>적립식 · G={G} · ±{bandPct}%</span>
        </div>
        <p style={S.subtitle}>
          초기투자 $5,000 &nbsp;|&nbsp; Pool $1,000 &nbsp;|&nbsp; 적립 ${contribution}/사이클 &nbsp;|&nbsp; {data.length - 1}사이클 ({(data.length - 1) * 2}주)
        </p>
      </div>

      {/* KPI */}
      <div style={S.kpiGrid}>
        {[
          { label: "최종 평가금", value: `$${final.eval.toLocaleString()}`, sub: "주식 보유 잔액", color: "#4da6ff" },
          { label: "총 자산 (평가금+Pool)", value: `$${final.totalAsset.toLocaleString()}`, sub: `Pool $${final.pool.toLocaleString()} 포함`, color: "#3fb950" },
          { label: "총 투자금 (원금)", value: `$${totalInvested.toLocaleString()}`, sub: `초기 + 적립 ${data.length - 1}회`, color: "#e3b341" },
          { label: "총 수익률", value: `+${roi}%`, sub: `매수 ${buys.length}회 · 매도 ${sells.length}회`, color: Number(roi) >= 0 ? "#3fb950" : "#ff5555" },
        ].map((s) => (
          <div key={s.label} style={S.kpiCard}>
            <div style={S.kpiLabel}>{s.label}</div>
            <div style={{ ...S.kpiValue, color: s.color }}>{s.value}</div>
            <div style={S.kpiSub}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* 차트 */}
      <div style={S.chartCard}>
        <div style={S.chartHeader}>
          <span style={{ color: "#8892b0", fontSize: 12 }}>📊 평가금 · V(기준값) · 밴드 추이</span>
          <span style={{ marginLeft: 20, fontSize: 11 }}>
            <span style={{ color: "#00cc77" }}>● 매수 발생점</span>
            <span style={{ color: "#ff5555", marginLeft: 12 }}>● 매도 발생점</span>
          </span>
        </div>
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart data={data} margin={{ top: 20, right: 20, left: -4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="2 5" stroke="#1c2332" />
            <XAxis
              dataKey="week"
              tick={{ fill: "#6e7681", fontSize: 10, fontFamily: "monospace" }}
              tickFormatter={(v) => `${v}w`}
              stroke="#21262d"
              interval={3}
            />
            <YAxis
              tick={{ fill: "#6e7681", fontSize: 10, fontFamily: "monospace" }}
              tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
              stroke="#21262d"
              domain={["auto", "auto"]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, fontFamily: "monospace", paddingTop: 12, paddingLeft: 16 }}
              formatter={(v) => <span style={{ color: "#8892b0" }}>{v}</span>}
            />
            {/* 밴드 점선 */}
            <Line type="monotone" dataKey="max" stroke="#2a5a3a" strokeWidth={1.2}
              strokeDasharray="6 3" dot={false} name="최대(V×1.15)" />
            <Line type="monotone" dataKey="min" stroke="#2a3a6a" strokeWidth={1.2}
              strokeDasharray="6 3" dot={false} name="최소(V×0.85)" />
            {/* V 기준선 */}
            <Line type="monotone" dataKey="V" stroke="#e3b341" strokeWidth={2}
              dot={false} name="V (기준값)" strokeDasharray="none" />
            {/* 평가금 (매수/매도 dot 포함) */}
            <Line
              type="monotone" dataKey="eval" stroke="#4da6ff" strokeWidth={2.5}
              dot={<EvalDot />}
              activeDot={{ r: 6, fill: "#4da6ff", stroke: "#fff", strokeWidth: 1.5 }}
              name="평가금"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 파라미터 슬라이더 */}
      <div style={S.sliderGrid}>
        {[
          { label: "G 값 (클수록 보수적)", value: G, min: 5, max: 30, step: 5, set: setG, unit: "" },
          { label: "사이클당 적립금", value: contribution, min: 0, max: 1000, step: 50, set: setContribution, unit: "$" },
          { label: "밴드 폭 (%)", value: bandPct, min: 5, max: 20, step: 5, set: setBandPct, unit: "%" },
        ].map((c) => (
          <div key={c.label} style={S.sliderCard}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={S.kpiLabel}>{c.label}</span>
              <span style={{ color: "#4da6ff", fontWeight: 700, fontSize: 14 }}>
                {c.unit === "$" ? `$${c.value}` : `${c.value}${c.unit}`}
              </span>
            </div>
            <input type="range" min={c.min} max={c.max} step={c.step} value={c.value}
              onChange={(e) => c.set(Number(e.target.value))}
              style={{ width: "100%", accentColor: "#4da6ff", cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
              <span style={{ fontSize: 9, color: "#444c56" }}>{c.unit === "$" ? `$${c.min}` : `${c.min}${c.unit}`}</span>
              <span style={{ fontSize: 9, color: "#444c56" }}>{c.unit === "$" ? `$${c.max}` : `${c.max}${c.unit}`}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 매매 기록 */}
      <div style={S.tableCard}>
        <div style={{ fontSize: 12, color: "#8892b0", marginBottom: 12 }}>
          📋 매매 발생 기록 &nbsp;
          <span style={{ color: "#00cc77" }}>매수 {buys.length}건</span>
          <span style={{ color: "#6e7681" }}> / </span>
          <span style={{ color: "#ff5555" }}>매도 {sells.length}건</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "monospace" }}>
            <thead>
              <tr>
                {["주차", "구분", "거래금액", "평가금(후)", "V 기준값", "밴드 하단", "밴드 상단", "잔여 Pool"].map((h) => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.filter((d) => d.action).map((d, idx) => (
                <tr key={idx} style={{
                  borderBottom: "1px solid #0d1117",
                  background: d.action === "BUY" ? "rgba(0,200,100,0.05)" : "rgba(255,60,60,0.05)",
                }}>
                  <td style={S.td}>{d.week}주</td>
                  <td style={{ ...S.td, color: d.action === "BUY" ? "#3fb950" : "#ff5555", fontWeight: 700 }}>
                    {d.action === "BUY" ? "▲ 매수" : "▼ 매도"}
                  </td>
                  <td style={{ ...S.td, color: "#e3b341" }}>${d.actionAmount.toLocaleString()}</td>
                  <td style={{ ...S.td, color: "#4da6ff" }}>${d.eval.toLocaleString()}</td>
                  <td style={{ ...S.td, color: "#d4a030" }}>${d.V.toLocaleString()}</td>
                  <td style={{ ...S.td, color: "#5585a8" }}>${d.min.toLocaleString()}</td>
                  <td style={{ ...S.td, color: "#55a88a" }}>${d.max.toLocaleString()}</td>
                  <td style={{ ...S.td, color: "#8892b0" }}>${d.pool.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 범례 설명 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginTop: 12 }}>
        <div style={S.legendCard}>
          <div style={{ color: "#3fb950", fontSize: 11, fontWeight: 700, marginBottom: 6 }}>🟢 매수 조건</div>
          <div style={{ color: "#8892b0", fontSize: 10, lineHeight: 1.8 }}>
            평가금 {"<"} V × {(1 - bandPct / 100).toFixed(2)}<br />
            Pool의 75%까지 사용하여 매수<br />
            평가금을 V 수준으로 복귀시킴
          </div>
        </div>
        <div style={S.legendCard}>
          <div style={{ color: "#ff5555", fontSize: 11, fontWeight: 700, marginBottom: 6 }}>🔴 매도 조건</div>
          <div style={{ color: "#8892b0", fontSize: 10, lineHeight: 1.8 }}>
            평가금 {">"} V × {(1 + bandPct / 100).toFixed(2)}<br />
            초과분(평가금 − V)만큼 매도<br />
            매도 대금은 Pool로 귀환
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 스타일 상수 ──────────────────────────────────────────────────────────────
const styles = {
  root: {
    background: "linear-gradient(160deg, #0a0e1a 0%, #0d1117 100%)",
    minHeight: "100vh",
    fontFamily: '"Courier New", "Lucida Console", monospace',
    color: "#e6edf3",
    padding: "20px",
    boxSizing: "border-box",
  },
  header: {
    borderBottom: "1px solid #21262d",
    paddingBottom: 16,
    marginBottom: 20,
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    color: "#4da6ff",
    letterSpacing: "0.08em",
  },
  badge: {
    fontSize: 11,
    color: "#3fb950",
    border: "1px solid #238636",
    borderRadius: 4,
    padding: "2px 8px",
  },
  subtitle: {
    margin: "6px 0 0",
    fontSize: 11,
    color: "#6e7681",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    background: "#161b22",
    border: "1px solid #21262d",
    borderRadius: 8,
    padding: "12px 14px",
  },
  kpiLabel: { fontSize: 10, color: "#6e7681", marginBottom: 4 },
  kpiValue: { fontSize: 18, fontWeight: 700 },
  kpiSub: { fontSize: 10, color: "#6e7681", marginTop: 3 },
  chartCard: {
    background: "#161b22",
    border: "1px solid #21262d",
    borderRadius: 8,
    padding: "14px 6px 8px",
    marginBottom: 16,
  },
  chartHeader: {
    paddingLeft: 12,
    marginBottom: 10,
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
  },
  sliderGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
    marginBottom: 16,
  },
  sliderCard: {
    background: "#161b22",
    border: "1px solid #21262d",
    borderRadius: 8,
    padding: "12px 14px",
  },
  tableCard: {
    background: "#161b22",
    border: "1px solid #21262d",
    borderRadius: 8,
    padding: "14px",
    marginBottom: 12,
  },
  th: {
    color: "#6e7681",
    padding: "6px 10px",
    textAlign: "left",
    fontWeight: 500,
    borderBottom: "1px solid #21262d",
    whiteSpace: "nowrap",
  },
  td: { padding: "8px 10px", color: "#c9d1d9", whiteSpace: "nowrap" },
  legendCard: {
    background: "#161b22",
    border: "1px solid #21262d",
    borderRadius: 8,
    padding: "12px 14px",
  },
};
