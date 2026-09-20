"use client";

import { useState } from "react";

type Grid = number[][];
type Mode = "diagonal" | "anti-diagonal" | "one-of-each";
type DiggingMethod = "single" | "double";
const emptyGrid = () => Array.from({ length: 9 }, () => Array(9).fill(0));
const allDigits = 0b111111111;
const bitCount = (value: number) => value.toString(2).replaceAll("0", "").length;
const antiDiagonalTemplate = [
  [1, 6, 5, 2, 3, 8, 7, 9, 4],
  [4, 2, 7, 6, 1, 9, 3, 5, 8],
  [8, 9, 3, 4, 5, 7, 2, 1, 6],
  [5, 3, 9, 1, 7, 4, 6, 8, 2],
  [7, 4, 8, 9, 2, 6, 5, 3, 1],
  [6, 1, 2, 5, 8, 3, 4, 7, 9],
  [3, 7, 4, 8, 9, 2, 1, 6, 5],
  [9, 5, 6, 3, 4, 1, 8, 2, 7],
  [2, 8, 1, 7, 6, 5, 9, 4, 3],
];

function shuffle(values: number[]) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function generateOneOfEach(): Grid {
  const grid = emptyGrid();
  const rows = Array(9).fill(0);
  const columns = Array(9).fill(0);
  const houses = Array(9).fill(0);
  let mainDiagonal = 0;
  const repeatedDiagonal = [4, 5, 2, 4, 2, 5, 4, 5, 2];

  const place = (row: number, column: number, digit: number) => {
    const bit = 1 << (digit - 1);
    const house = Math.floor(row / 3) * 3 + Math.floor(column / 3);
    grid[row][column] = digit;
    rows[row] |= bit; columns[column] |= bit; houses[house] |= bit;
    if (row === column) mainDiagonal |= bit;
  };

  const remove = (row: number, column: number, digit: number) => {
    const bit = 1 << (digit - 1);
    const house = Math.floor(row / 3) * 3 + Math.floor(column / 3);
    grid[row][column] = 0;
    rows[row] ^= bit; columns[column] ^= bit; houses[house] ^= bit;
    if (row === column) mainDiagonal ^= bit;
  };

  // Seed one diagonal with three repeated digits, then solve while requiring
  // the other diagonal to contain all nine digits exactly once.
  for (let row = 0; row < 9; row++) place(row, 8 - row, repeatedDiagonal[row]);

  const solve = (): boolean => {
    let bestRow = -1, bestColumn = -1, bestChoices = 0, fewest = 10;
    for (let row = 0; row < 9; row++) {
      for (let column = 0; column < 9; column++) {
        if (grid[row][column]) continue;
        const house = Math.floor(row / 3) * 3 + Math.floor(column / 3);
        let used = rows[row] | columns[column] | houses[house];
        if (row === column) used |= mainDiagonal;
        const choices = allDigits & ~used;
        const count = bitCount(choices);
        if (count < fewest) { bestRow = row; bestColumn = column; bestChoices = choices; fewest = count; }
      }
    }
    if (bestRow === -1) return true;
    if (fewest === 0) return false;
    for (const digit of shuffle(Array.from({ length: 9 }, (_, i) => i + 1).filter(digit => bestChoices & (1 << (digit - 1))))) {
      place(bestRow, bestColumn, digit);
      if (solve()) return true;
      remove(bestRow, bestColumn, digit);
    }
    return false;
  };

  solve();
  const digitMap = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const mapped = grid.map(row => row.map(digit => digitMap[digit - 1]));
  return Math.random() < 0.5 ? mapped : mapped[0].map((_, column) => mapped.map(row => row[column]));
}

function generateGrid(mode: Mode): Grid {
  if (mode === "one-of-each") return generateOneOfEach();

  if (mode === "anti-diagonal") {
    const digitMap = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const firstBand = shuffle([0, 1, 2]);
    const middleBand = Math.random() < 0.5 ? [0, 1, 2] : [2, 1, 0];
    // Coupling the bottom band to the top one keeps both diagonals inside
    // their three-digit sets while still permuting each visible section.
    const lastBand = [
      2 - firstBand[2],
      2 - firstBand[1],
      2 - firstBand[0],
    ];
    const bandPermutations = [firstBand, middleBand, lastBand];

    return Array.from({ length: 9 }, (_, row) =>
      Array.from({ length: 9 }, (_, column) => {
        const sourceRow = Math.floor(row / 3) * 3 + bandPermutations[Math.floor(row / 3)][row % 3];
        const sourceColumn = Math.floor(column / 3) * 3 + bandPermutations[Math.floor(column / 3)][column % 3];
        return digitMap[antiDiagonalTemplate[sourceRow][sourceColumn] - 1];
      }),
    );
  }

  const grid = emptyGrid();
  const rows = Array(9).fill(0);
  const columns = Array(9).fill(0);
  const houses = Array(9).fill(0);
  const diagonals = [0, 0];

  const candidates = (row: number, column: number) => {
    const house = Math.floor(row / 3) * 3 + Math.floor(column / 3);
    let used = rows[row] | columns[column] | houses[house];
    if (mode === "diagonal" && row === column) used |= diagonals[0];
    if (mode === "diagonal" && row + column === 8) used |= diagonals[1];
    return allDigits & ~used;
  };

  const place = (row: number, column: number, digit: number) => {
    const bit = 1 << (digit - 1);
    const house = Math.floor(row / 3) * 3 + Math.floor(column / 3);
    grid[row][column] = digit;
    rows[row] |= bit; columns[column] |= bit; houses[house] |= bit;
    if (mode === "diagonal" && row === column) diagonals[0] |= bit;
    if (mode === "diagonal" && row + column === 8) diagonals[1] |= bit;
  };

  const remove = (row: number, column: number, digit: number) => {
    const bit = 1 << (digit - 1);
    const house = Math.floor(row / 3) * 3 + Math.floor(column / 3);
    grid[row][column] = 0;
    rows[row] ^= bit; columns[column] ^= bit; houses[house] ^= bit;
    if (mode === "diagonal" && row === column) diagonals[0] ^= bit;
    if (mode === "diagonal" && row + column === 8) diagonals[1] ^= bit;
  };

  const solve = (): boolean => {
    let bestRow = -1, bestColumn = -1, bestChoices = 0, fewest = 10;
    for (let row = 0; row < 9; row++) {
      for (let column = 0; column < 9; column++) {
        if (grid[row][column]) continue;
        const choices = candidates(row, column);
        const count = bitCount(choices);
        if (count < fewest) {
          bestRow = row; bestColumn = column; bestChoices = choices; fewest = count;
          if (count === 1) break;
        }
      }
      if (fewest === 1) break;
    }
    if (bestRow === -1) return true;
    if (fewest === 0) return false;
    for (const digit of shuffle(Array.from({ length: 9 }, (_, i) => i + 1).filter(digit => bestChoices & (1 << (digit - 1))))) {
      place(bestRow, bestColumn, digit);
      if (solve()) return true;
      remove(bestRow, bestColumn, digit);
    }
    return false;
  };

  solve();
  return grid;
}

function countDiagonalSolutions(startGrid: Grid, limit = 2) {
  const grid = startGrid.map(row => [...row]);
  const rows = Array(9).fill(0), columns = Array(9).fill(0), houses = Array(9).fill(0), diagonals = [0, 0];
  for (let row = 0; row < 9; row++) for (let column = 0; column < 9; column++) {
    const digit = grid[row][column];
    if (!digit) continue;
    const bit = 1 << (digit - 1), house = Math.floor(row / 3) * 3 + Math.floor(column / 3);
    rows[row] |= bit; columns[column] |= bit; houses[house] |= bit;
    if (row === column) diagonals[0] |= bit;
    if (row + column === 8) diagonals[1] |= bit;
  }
  const search = (): number => {
    let bestRow = -1, bestColumn = -1, bestChoices = 0, fewest = 10;
    for (let row = 0; row < 9; row++) for (let column = 0; column < 9; column++) if (!grid[row][column]) {
      const house = Math.floor(row / 3) * 3 + Math.floor(column / 3);
      let used = rows[row] | columns[column] | houses[house];
      if (row === column) used |= diagonals[0];
      if (row + column === 8) used |= diagonals[1];
      const choices = allDigits & ~used, count = bitCount(choices);
      if (count < fewest) { bestRow = row; bestColumn = column; bestChoices = choices; fewest = count; }
    }
    if (bestRow < 0) return 1;
    let found = 0;
    for (let digit = 1; digit <= 9 && found < limit; digit++) if (bestChoices & (1 << (digit - 1))) {
      const bit = 1 << (digit - 1), house = Math.floor(bestRow / 3) * 3 + Math.floor(bestColumn / 3);
      grid[bestRow][bestColumn] = digit; rows[bestRow] |= bit; columns[bestColumn] |= bit; houses[house] |= bit;
      if (bestRow === bestColumn) diagonals[0] |= bit;
      if (bestRow + bestColumn === 8) diagonals[1] |= bit;
      found += search();
      grid[bestRow][bestColumn] = 0; rows[bestRow] ^= bit; columns[bestColumn] ^= bit; houses[house] ^= bit;
      if (bestRow === bestColumn) diagonals[0] ^= bit;
      if (bestRow + bestColumn === 8) diagonals[1] ^= bit;
    }
    return found;
  };
  return search();
}

function digDiagonal(method: DiggingMethod) {
  const solution = generateGrid("diagonal");
  const puzzle = solution.map(row => [...row]);
  const cells = method === "single"
    ? Array.from({ length: 81 }, (_, index) => [Math.floor(index / 9), index % 9])
    : Array.from({ length: 81 }, (_, index) => [Math.floor(index / 9), index % 9])
      .filter(([row, column]) => row < 4 || (row === 4 && column <= 4));

  for (const [row, column] of shuffle(cells.map(([row, column]) => row * 9 + column)).map(cell => [Math.floor(cell / 9), cell % 9])) {
    const mirrorRow = 8 - row, mirrorColumn = 8 - column;
    const value = puzzle[row][column], mirrorValue = puzzle[mirrorRow][mirrorColumn];
    puzzle[row][column] = 0;
    if (method === "double") puzzle[mirrorRow][mirrorColumn] = 0;
    if (countDiagonalSolutions(puzzle) !== 1) {
      puzzle[row][column] = value;
      if (method === "double") puzzle[mirrorRow][mirrorColumn] = mirrorValue;
    }
  }
  return { puzzle, solution };
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("diagonal");
  const [grid, setGrid] = useState<Grid>(emptyGrid);
  const [solution, setSolution] = useState<Grid | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [diggingMethod, setDiggingMethod] = useState<DiggingMethod>("double");
  const generate = () => {
    const started = performance.now();
    if (mode === "diagonal") {
      const dug = digDiagonal(diggingMethod);
      setGrid(dug.puzzle); setSolution(dug.solution);
    } else { setGrid(generateGrid(mode)); setSolution(null); }
    setElapsed(performance.now() - started);
  };
  const selectMode = (nextMode: Mode) => { setMode(nextMode); setGrid(emptyGrid()); setSolution(null); setElapsed(null); };
  const descriptions: Record<Mode, string> = {
    diagonal: "Normal Sudoku rules apply. Digits along the indicated diagonals cannot repeat.",
    "anti-diagonal": "Normal Sudoku rules apply. Exactly three distinct numbers appear along each marked diagonal.",
    "one-of-each": "Normal Sudoku rules apply. Digits along one diagonal cannot repeat, while digits along the other diagonal each appear three times. It is up to the solver to determine which diagonal follows which rule.",
  };

  return (
    <main className="page">
      <h1>Diagonal or not</h1>
      <div className="mode-picker" aria-label="Puzzle type">
        <button className={mode === "diagonal" ? "active" : ""} onClick={() => selectMode("diagonal")}>Diagonal</button>
        <button className={mode === "anti-diagonal" ? "active" : ""} onClick={() => selectMode("anti-diagonal")}>Anti-diagonal</button>
        <button className={mode === "one-of-each" ? "active" : ""} onClick={() => selectMode("one-of-each")}>One of each</button>
      </div>
      <p className="rule-description">{descriptions[mode]}</p>
      <div className="grid-frame">
        <svg className="diagonal-guides" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" y1="0" x2="50" y2="50" /><line x1="100" y1="100" x2="50" y2="50" />
          <line x1="100" y1="0" x2="50" y2="50" /><line x1="0" y1="100" x2="50" y2="50" />
        </svg>
        <div className="grid" aria-label="9 by 9 sudoku grid">
          {grid.flatMap((row, rowIndex) => row.map((value, columnIndex) => <div className="cell" key={`${rowIndex}-${columnIndex}`}>{value || ""}</div>))}
        </div>
      </div>
      <label className="digging-method">
        Digging method:
        <select value={diggingMethod} onChange={event => setDiggingMethod(event.target.value as DiggingMethod)}>
          <option value="single">Single cell digging</option>
          <option value="double">Double cell digging</option>
        </select>
      </label>
      <button className="generate-button" onClick={generate}>Generate a grid</button>
      {mode === "diagonal" && solution && <section className="dig-results">
        <p>{grid.flat().filter(Boolean).length} givens · {(elapsed ?? 0).toFixed(0)} ms</p>
        <h2>Completed grid</h2>
        <div className="grid solution-grid" aria-label="Completed sudoku grid">
          {solution.flatMap((row, rowIndex) => row.map((value, columnIndex) => <div className={grid[rowIndex][columnIndex] ? "cell given" : "cell solved"} key={`${rowIndex}-${columnIndex}`}>{value}</div>))}
        </div>
      </section>}
    </main>
  );
}
