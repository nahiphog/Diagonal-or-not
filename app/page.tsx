"use client";
import { useState } from "react";

type Grid = number[][];
type Mode = "diagonal" | "anti-diagonal";
const template = [
[1,6,5,2,3,8,7,9,4],[4,2,7,6,1,9,3,5,8],[8,9,3,4,5,7,2,1,6],
[5,3,9,1,7,4,6,8,2],[7,4,8,9,2,6,5,3,1],[6,1,2,5,8,3,4,7,9],
[3,7,4,8,9,2,1,6,5],[9,5,6,3,4,1,8,2,7],[2,8,1,7,6,5,9,4,3],
];
const shuffle = (values: number[]) => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

function generateAntiDiagonal(): Grid {
  const digits = shuffle([1,2,3,4,5,6,7,8,9]);
  const top = shuffle([0,1,2]);
  const middle = Math.random() < .5 ? [0,1,2] : [2,1,0];
  const bottom = [2 - top[2], 2 - top[1], 2 - top[0]];
  const permutations = [top, middle, bottom];
  return Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => {
    const sr = Math.floor(r / 3) * 3 + permutations[Math.floor(r / 3)][r % 3];
    const sc = Math.floor(c / 3) * 3 + permutations[Math.floor(c / 3)][c % 3];
    return digits[template[sr][sc] - 1];
  }));
}

function generateDiagonal(): Grid {
  const grid = Array.from({ length: 9 }, () => Array(9).fill(0));
  const rows = Array(9).fill(0), columns = Array(9).fill(0), houses = Array(9).fill(0), diagonals = [0,0];
  const choices = (r: number, c: number) => {
    const h = Math.floor(r / 3) * 3 + Math.floor(c / 3);
    let used = rows[r] | columns[c] | houses[h];
    if (r === c) used |= diagonals[0];
    if (r + c === 8) used |= diagonals[1];
    return 0b111111111 & ~used;
  };
  const put = (r: number, c: number, d: number, add: boolean) => {
    const bit = 1 << (d - 1), h = Math.floor(r / 3) * 3 + Math.floor(c / 3);
    grid[r][c] = add ? d : 0;
    rows[r] = add ? rows[r] | bit : rows[r] ^ bit;
    columns[c] = add ? columns[c] | bit : columns[c] ^ bit;
    houses[h] = add ? houses[h] | bit : houses[h] ^ bit;
    if (r === c) diagonals[0] = add ? diagonals[0] | bit : diagonals[0] ^ bit;
    if (r + c === 8) diagonals[1] = add ? diagonals[1] | bit : diagonals[1] ^ bit;
  };
  const solve = (): boolean => {
    let br = -1, bc = -1, mask = 0, fewest = 10;
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (!grid[r][c]) {
      const next = choices(r,c), count = next.toString(2).replaceAll("0", "").length;
      if (count < fewest) { br = r; bc = c; mask = next; fewest = count; }
    }
    if (br < 0) return true;
    for (const d of shuffle([1,2,3,4,5,6,7,8,9].filter(d => mask & (1 << (d - 1))))) {
      put(br,bc,d,true); if (solve()) return true; put(br,bc,d,false);
    }
    return false;
  };
  solve(); return grid;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("diagonal");
  const [grid, setGrid] = useState<Grid>(() => Array.from({ length: 9 }, () => Array(9).fill(0)));
  return <main className="page">
    <h1>Diagonal or not</h1>
    <div className="mode-picker" aria-label="Puzzle type">
      <button className={mode === "diagonal" ? "active" : ""} onClick={() => setMode("diagonal")}>Diagonal</button>
      <button className={mode === "anti-diagonal" ? "active" : ""} onClick={() => setMode("anti-diagonal")}>Anti-diagonal</button>
    </div>
    <div className="grid-frame"><svg className="diagonal-guides" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" y1="0" x2="50" y2="50"/><line x1="100" y1="100" x2="50" y2="50"/>
      <line x1="100" y1="0" x2="50" y2="50"/><line x1="0" y1="100" x2="50" y2="50"/>
    </svg><div className="grid" aria-label="9 by 9 sudoku grid">
      {grid.flatMap((row,r) => row.map((value,c) => <div className="cell" key={r + "-" + c}>{value || ""}</div>))}
    </div></div>
    <button className="generate-button" onClick={() => setGrid(mode === "diagonal" ? generateDiagonal() : generateAntiDiagonal())}>Generate a grid</button>
  </main>;
}
