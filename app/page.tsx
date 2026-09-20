"use client";

import { useState } from "react";

type Grid = number[][];
type Mode = "diagonal" | "anti-diagonal";
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

function generateGrid(mode: Mode): Grid {
  if (mode === "anti-diagonal") {
    const digitMap = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    return antiDiagonalTemplate.map(row => row.map(digit => digitMap[digit - 1]));
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

export default function Home() {
  const [mode, setMode] = useState<Mode>("diagonal");
  const [grid, setGrid] = useState<Grid>(emptyGrid);
  const generate = () => setGrid(generateGrid(mode));

  return (
    <main className="page">
      <h1>Diagonal or not</h1>
      <div className="mode-picker" aria-label="Puzzle type">
        <button className={mode === "diagonal" ? "active" : ""} onClick={() => setMode("diagonal")}>Diagonal</button>
        <button className={mode === "anti-diagonal" ? "active" : ""} onClick={() => setMode("anti-diagonal")}>Anti-diagonal</button>
      </div>
      <div className="grid-frame">
        <svg className="diagonal-guides" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" y1="0" x2="50" y2="50" /><line x1="100" y1="100" x2="50" y2="50" />
          <line x1="100" y1="0" x2="50" y2="50" /><line x1="0" y1="100" x2="50" y2="50" />
        </svg>
        <div className="grid" aria-label="9 by 9 sudoku grid">
          {grid.flatMap((row, rowIndex) => row.map((value, columnIndex) => <div className="cell" key={`${rowIndex}-${columnIndex}`}>{value || ""}</div>))}
        </div>
      </div>
      <button className="generate-button" onClick={generate}>Generate a grid</button>
    </main>
  );
}
