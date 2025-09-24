import React, { useMemo, useState } from "react";

// TypeScript-safe single-file React component (App.tsx)
// Updates:
// - LMC supports CP1 and CP5
// - Distribution table: weight emphasized, max muted in brackets
// - LMC note moved to a separate bottom line for better visual flow

type CP = "CP1" | "CP2" | "CP3" | "CP4" | "CP5";

type MaxMap = Record<CP, number>;

type PieceAlloc = Record<CP, number>;

type WeightMap = Record<CP, number>;

type ExceedsMap = Record<CP, boolean>;

export default function App(): JSX.Element {
  const [totalKgStr, setTotalKgStr] = useState<string>("0");
  const [piecesStr, setPiecesStr] = useState<string>("0");
  const [aviKgStr, setAviKgStr] = useState<string>("0");

  const [lmcCp, setLmcCp] = useState<CP>("CP3");
  const [lmcPiecesStr, setLmcPiecesStr] = useState<string>("0");

  const totalKg = toNumber(totalKgStr);
  const piecesRaw = toInt(piecesStr);
  const aviKg = toNumber(aviKgStr);
  const lmcPiecesRequested = Math.max(0, toInt(lmcPiecesStr));

  const MAX: MaxMap = { CP1: 2202, CP2: 3468, CP3: 3587, CP4: 2083, CP5: 800 };

  const base = useMemo(() => {
    const adjustedTotal = Math.max(0, totalKg - aviKg);
    const pcs = Math.max(0, Math.floor(piecesRaw));
    const perPiece = pcs > 0 ? adjustedTotal / pcs : 0;

    const cp2PiecesBase = Math.floor(pcs * 0.30);
    const cp3PiecesBase = Math.floor(pcs * 0.40);
    const cp4PiecesBase = Math.floor(pcs * 0.30);
    const usedBase = cp2PiecesBase + cp3PiecesBase + cp4PiecesBase;
    const remainder = pcs - usedBase;

    const pieceAlloc: PieceAlloc = { CP1: 0, CP2: cp2PiecesBase, CP3: cp3PiecesBase + remainder, CP4: cp4PiecesBase, CP5: 0 };

    const weightsBeforeOverflow: WeightMap = computeWeights(pieceAlloc, perPiece, aviKg);
    const { pieceAlloc: afterOverflowAlloc, weights: afterOverflowWeights } =
      redistributeOverflow(pieceAlloc, weightsBeforeOverflow, perPiece, aviKg, MAX);

    const totals = {
      pieces: pcs,
      perPiece,
      totalAdjKg: afterOverflowWeights.CP1 + afterOverflowWeights.CP2 + afterOverflowWeights.CP3 + afterOverflowWeights.CP4,
      totalShownKg: afterOverflowWeights.CP1 + afterOverflowWeights.CP2 + afterOverflowWeights.CP3 + afterOverflowWeights.CP4 + afterOverflowWeights.CP5,
      distributedKg: afterOverflowWeights.CP2 + afterOverflowWeights.CP3 + afterOverflowWeights.CP4,
    } as const;

    const exceeds: ExceedsMap = {
      CP1: afterOverflowWeights.CP1 > MAX.CP1,
      CP2: afterOverflowWeights.CP2 > MAX.CP2,
      CP3: afterOverflowWeights.CP3 > MAX.CP3,
      CP4: afterOverflowWeights.CP4 > MAX.CP4,
      CP5: afterOverflowWeights.CP5 > MAX.CP5,
    };

    return { pieceAlloc: afterOverflowAlloc, weights: afterOverflowWeights, totals, perPiece, exceeds };
  }, [totalKg, piecesRaw, aviKg]);

  const after = useMemo(() => {
    const pieceAlloc = { ...base.pieceAlloc };
    const perPiece = base.perPiece;

    const maxRemovable = pieceAlloc[lmcCp];
    const removePieces = Math.min(lmcPiecesRequested, maxRemovable);
    if (removePieces > 0) pieceAlloc[lmcCp] -= removePieces;

    const weights = computeWeights(pieceAlloc, perPiece, aviKg);

    const distributedKg = weights.CP1 + weights.CP2 + weights.CP3 + weights.CP4;
    const totalAdjKg = distributedKg;
    const totalShownKg = totalAdjKg + weights.CP5;

    const exceeds: ExceedsMap = {
      CP1: weights.CP1 > MAX.CP1,
      CP2: weights.CP2 > MAX.CP2,
      CP3: weights.CP3 > MAX.CP3,
      CP4: weights.CP4 > MAX.CP4,
      CP5: weights.CP5 > MAX.CP5,
    };

    return {
      pieceAlloc,
      weights,
      exceeds,
      totals: { pieces: pieceAlloc.CP1 + pieceAlloc.CP2 + pieceAlloc.CP3 + pieceAlloc.CP4, perPiece, totalAdjKg, totalShownKg, distributedKg },
      lmc: { target: lmcCp, removePieces, removalKg: removePieces * perPiece, maxRemovable },
    };
  }, [base, lmcCp, lmcPiecesRequested, aviKg]);

  const warnAny = Object.values(after.exceeds).some(Boolean);
  const ordered: CP[] = ["CP1", "CP2", "CP3", "CP4", "CP5"];

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900 flex flex-col items-center p-2">
      <header className="w-full max-w-3xl text-center pb-1">
        <h1 className="text-lg font-semibold">Cargo Distributor</h1>
        <p className="text-[11px] text-slate-600">30% · 40% · 30% — CP3 remainder — Overflow → CP5 then CP1 — AVI in CP5</p>
      </header>

      <main className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 gap-2">
        <section className="grid gap-2">
          <Card>
            <div className="grid grid-cols-3 gap-2 text-[13px] max-[400px]:grid-cols-1">
              <Field label="TOTAL (kg)"><InputNumber value={totalKgStr} setValue={setTotalKgStr} normalize={normalizeNumberString} /></Field>
              <Field label="Pieces"><InputNumber value={piecesStr} setValue={setPiecesStr} normalize={normalizeIntString} /></Field>
              <Field label="AVI (kg)"><InputNumber value={aviKgStr} setValue={setAviKgStr} normalize={normalizeNumberString} /></Field>
            </div>
            <div className="mt-2 text-[12px] text-slate-600 flex flex-wrap gap-x-3 gap-y-1">
              <span>Per piece: <b>{fmtKg(base.perPiece || 0)}</b></span>
              <span>Adj. total pre-LMC: <b>{fmtKg(base.totals.totalAdjKg)}</b></span>
              <span>AVI: <b>{fmtKg(aviKg)}</b></span>
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold mb-1">LMC</h2>
            <div className="grid grid-cols-3 gap-2 text-[13px] max-[400px]:grid-cols-1">
              <Field label="CP">
                <select className="w-full rounded-lg border p-2 bg-white" value={lmcCp} onChange={(e) => setLmcCp(e.target.value as CP)}>
                  <option value="CP1">CP1</option>
                  <option value="CP2">CP2</option>
                  <option value="CP3">CP3</option>
                  <option value="CP4">CP4</option>
                  <option value="CP5">CP5</option>
                </select>
              </Field>
              <Field label="Remove pcs"><InputNumber value={lmcPiecesStr} setValue={setLmcPiecesStr} normalize={normalizeIntString} /></Field>
              <div className="text-[12px] text-slate-600 p-2 rounded-lg bg-slate-50 border">
                Max: <b>{fmtNum(base.pieceAlloc[lmcCp])}</b> pcs<br />
                Removed: <b>{fmtNum(after.lmc.removePieces)}</b> pcs ≈ <b>{fmtKg(after.lmc.removalKg)}</b>
              </div>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">Note: Removing from CP5 affects overflow pieces only — AVI remains in CP5.</div>
          </Card>
        </section>

        <section className="grid gap-2">
          <Card>
            <h2 className="text-sm font-semibold mb-1">Distribution</h2>
            <div className="grid grid-cols-5 text-[11px] font-medium text-slate-500 border-b pb-1">
              <div>CP</div>
              <div className="text-right">Weight</div>
              <div className="text-right">Pieces</div>
              <div className="text-right">(Max)</div>
              <div className="text-right">Status</div>
            </div>
            {ordered.map((cp) => (
              <RowEmphasized key={cp} cp={cp} pieces={after.pieceAlloc[cp]} weight={after.weights[cp]} max={MAX[cp]} over={after.exceeds[cp]} />
            ))}
          </Card>

          {warnAny && (
            <div className="rounded-lg bg-amber-100 border border-amber-300 text-amber-900 text-[12px] p-2">
              <b>Limit warning:</b>
              <ul className="list-disc pl-5 mt-1">
                {ordered.map((cp) => after.exceeds[cp] ? (<li key={cp}>{cp} exceeds by {fmtKg(after.weights[cp] - MAX[cp])}</li>) : null)}
              </ul>
            </div>
          )}

          <div className="rounded-lg bg-slate-900 text-slate-50 p-2 grid grid-cols-2 gap-2 text-[12px]">
            <div>Adj. excl. AVI: <b>{fmtKg(after.totals.totalAdjKg)}</b></div>
            <div>Total incl. AVI: <b>{fmtKg(after.totals.totalShownKg)}</b></div>
          </div>
        </section>
      </main>

      <footer className="w-full max-w-3xl pt-2 pb-3 text-[11px] text-slate-500 text-center">
        Assumptions: uniform piece weight; AVI is single item in CP5; Overflow moves pieces CP2/3/4 → CP5 → CP1; LMC does not redistribute.
      </footer>
    </div>
  );
}

function computeWeights(pieceAlloc: PieceAlloc, perPiece: number, aviKg: number): WeightMap {
  return { CP1: pieceAlloc.CP1 * perPiece, CP2: pieceAlloc.CP2 * perPiece, CP3: pieceAlloc.CP3 * perPiece, CP4: pieceAlloc.CP4 * perPiece, CP5: pieceAlloc.CP5 * perPiece + aviKg };
}

function redistributeOverflow(initialAlloc: PieceAlloc, initialWeights: WeightMap, perPiece: number, aviKg: number, MAX: MaxMap): { pieceAlloc: PieceAlloc; weights: WeightMap } {
  const alloc: PieceAlloc = { ...initialAlloc };
  let weights = { ...initialWeights };
  if (perPiece <= 0) return { pieceAlloc: alloc, weights };

  const capacityPieces = (cp: CP): number => { const remainingKg = Math.max(0, MAX[cp] - weights[cp]); return Math.floor(remainingKg / perPiece); };
  const recalc = () => { weights = computeWeights(alloc, perPiece, aviKg); };
  const sources: CP[] = ["CP2", "CP3", "CP4"];

  for (const src of sources) {
    recalc();
    let overKg = Math.max(0, weights[src] - MAX[src]);
    while (overKg > 0 && alloc[src] > 0) {
      let needPieces = Math.min(alloc[src], Math.ceil(overKg / perPiece));
      const cap5 = capacityPieces("CP5");
      const move5 = Math.min(needPieces, cap5);
      if (move5 > 0) { alloc[src] -= move5; alloc["CP5"] += move5; recalc(); overKg = Math.max(0, weights[src] - MAX[src]); needPieces -= move5; }
      if (needPieces <= 0) break;
      const cap1 = capacityPieces("CP1");
      const move1 = Math.min(needPieces, cap1);
      if (move1 > 0) { alloc[src] -= move1; alloc["CP1"] += move1; recalc(); overKg = Math.max(0, weights[src] - MAX[src]); needPieces -= move1; }
      if (needPieces <= 0) break;
      if (cap5 === 0 && cap1 === 0) break;
    }
  }

  recalc();
  return { pieceAlloc: alloc, weights };
}

function toNumber(s: string): number { if (s.trim() === "") return 0; const n = Number(s); return isNaN(n) || n < 0 ? 0 : n; }
function toInt(s: string): number { if (s.trim() === "") return 0; const n = Math.floor(Number(s)); return isNaN(n) || n < 0 ? 0 : n; }
function normalizeNumberString(s: string): string { if (s.trim() === "") return "0"; const n = Number(s); if (isNaN(n) || n < 0) return "0"; return String(n); }
function normalizeIntString(s: string): string { if (s.trim() === "") return "0"; const n = Math.floor(Number(s)); if (isNaN(n) || n < 0) return "0"; return String(n); }
function fmtKg(n: number): string { return `${Math.round(n).toLocaleString()} kg`; }
function fmtNum(n: number): string { return n.toLocaleString(); }

function Card({ children }: { children: React.ReactNode }) { return <div className="bg-white rounded-xl shadow p-3">{children}</div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return (<label className="flex flex-col gap-1"><span className="text-[11px] text-slate-600">{label}</span>{children}</label>); }
function InputNumber({ value, setValue, normalize }: { value: string; setValue: (v: string) => void; normalize: (s: string) => string }) { return (<input type="number" inputMode="numeric" className="w-full rounded-lg border p-2" value={value} onChange={(e) => setValue(e.target.value)} onBlur={() => setValue(normalize(value))} placeholder="0"/>); }
function RowEmphasized({ cp, pieces, weight, max, over }: { cp: string; pieces: number; weight: number; max: number; over: boolean }) {
  return (
    <div className="grid grid-cols-5 py-1.5 border-b last:border-b-0 items-center">
      <div className="text-[12px] font-semibold">{cp}</div>
      <div className="text-right text-[14px] font-bold">{fmtKg(weight)}</div>
      <div className="text-right text-[12px]">{fmtNum(pieces)}</div>
      <div className="text-right text-[11px] text-slate-500">({fmtKg(max)})</div>
      <div className={`text-right text-[12px] ${over ? "text-rose-600" : "text-emerald-600"}`}>{over ? "Over" : "OK"}</div>
    </div>
  );
}
