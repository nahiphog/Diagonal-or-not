"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Grid = number[][];
export type Mode = "diagonal" | "anti-diagonal" | "one-of-each" | "double-diagonal" | "bent-diagonal" | "triple-diagonal" | "queen";
type DiggingMethod = "single" | "double";
type CandidateRemoval = { cell: number; digit: number };
type WalkthroughStep = { technique: string; values: number[]; candidates: number[]; affectedCells: number[]; placedCells: number[]; removed: CandidateRemoval[]; involved: CandidateRemoval[]; highlightedDiagonals: number[]; message: string };
type DifficultyRating = { rating: string; score: number; techniques: string[]; logical: boolean; walkthrough: WalkthroughStep[]; tally: Record<string, number>; givens: number[] };
type QueenDiagonal = { label: string; cells: number[] };
const emptyGrid = () => Array.from({ length: 9 }, () => Array(9).fill(0));
const allDigits = 0b111111111;
const bitCount = (value: number) => value.toString(2).replaceAll("0", "").length;
export const modePaths: Record<Mode, string> = {
  diagonal: "/diagonal/",
  "anti-diagonal": "/anti_diagonal/",
  "one-of-each": "/one_of_each/",
  "double-diagonal": "/double_diagonal/",
  "bent-diagonal": "/bent_diagonal/",
  "triple-diagonal": "/triple_diagonal/",
  queen: "/queen_sudoku/",
};
const queenDiagonals: QueenDiagonal[] = [
  ...[0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6, 6, -7, 7].map(offset => ({
    label: `↘ diagonal (r − c = ${offset})`,
    cells: Array.from({ length: 9 }, (_, row) => [row, row - offset]).filter(([, column]) => column >= 0 && column < 9).map(([row, column]) => row * 9 + column),
  })),
  ...[8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15].map(sum => ({
    label: `↙ diagonal (r + c = ${sum + 2})`,
    cells: Array.from({ length: 9 }, (_, row) => [row, sum - row]).filter(([, column]) => column >= 0 && column < 9).map(([row, column]) => row * 9 + column),
  })),
].filter(({ cells }) => new Set(cells.map(cell => Math.floor(Math.floor(cell / 9) / 3) * 3 + Math.floor((cell % 9) / 3))).size > 1);
// The sudokUI ratings define the technique order: easy methods come first,
// while the harder ones follow below.
const sudokUiTechniqueDifficulty: Record<string, number> = {
  "Full House": 4,
  "Naked Single": 4,
  "Hidden Single": 14,
  "Locked Candidates (Pointing)": 50,
  "Locked Candidates (Claiming)": 50,
  "Locked Candidates (Diagonal)": 50,
  "Locked Candidates (9 Diagonal)": 50,
  "Naked Pair": 60,
  "Hidden Pair": 70,
  "Naked Triple": 80,
  "Hidden Triple": 100,
  "Naked Quadruple": 120,
  "X-Wing": 140,
  "Hidden Quadruple": 150,
  "Swordfish": 150,
  "Jellyfish": 160,
  "W-Wing": 150,
  "XY-Wing": 160,
  "XYZ-Wing": 180,
  "Brute Force": 10000,
};
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

function generateQueenSudoku(): Grid {
  // Place the nine 9s first as a 9-queen arrangement which also respects
  // Sudoku columns and 3×3 boxes, then complete the ordinary Sudoku.
  const grid = emptyGrid();
  const rows = Array(9).fill(0), columns = Array(9).fill(0), houses = Array(9).fill(0);
  const queenRows = new Set<number>(), queenColumns = new Set<number>(), queenDescending = new Set<number>(), queenAscending = new Set<number>(), queenHouses = new Set<number>();
  const houseFor = (row: number, column: number) => Math.floor(row / 3) * 3 + Math.floor(column / 3);

  const placeQueens = (row: number): boolean => {
    if (row === 9) return true;
    for (const column of shuffle(Array.from({ length: 9 }, (_, index) => index))) {
      const house = houseFor(row, column), descending = row - column, ascending = row + column;
      if (queenRows.has(row) || queenColumns.has(column) || queenDescending.has(descending) || queenAscending.has(ascending) || queenHouses.has(house)) continue;
      queenRows.add(row); queenColumns.add(column); queenDescending.add(descending); queenAscending.add(ascending); queenHouses.add(house);
      grid[row][column] = 9;
      if (placeQueens(row + 1)) return true;
      grid[row][column] = 0;
      queenRows.delete(row); queenColumns.delete(column); queenDescending.delete(descending); queenAscending.delete(ascending); queenHouses.delete(house);
    }
    return false;
  };
  placeQueens(0);

  for (let row = 0; row < 9; row++) for (let column = 0; column < 9; column++) if (grid[row][column] === 9) {
    const bit = 1 << 8, house = houseFor(row, column);
    rows[row] |= bit; columns[column] |= bit; houses[house] |= bit;
  }
  const solve = (): boolean => {
    let bestRow = -1, bestColumn = -1, bestChoices = 0, fewest = 10;
    for (let row = 0; row < 9; row++) for (let column = 0; column < 9; column++) if (!grid[row][column]) {
      const choices = allDigits & ~(rows[row] | columns[column] | houses[houseFor(row, column)]);
      const count = bitCount(choices);
      if (count < fewest) { bestRow = row; bestColumn = column; bestChoices = choices; fewest = count; }
    }
    if (bestRow < 0) return true;
    if (fewest === 0) return false;
    for (const digit of shuffle(Array.from({ length: 9 }, (_, index) => index + 1).filter(digit => bestChoices & (1 << (digit - 1))))) {
      const bit = 1 << (digit - 1), house = houseFor(bestRow, bestColumn);
      grid[bestRow][bestColumn] = digit; rows[bestRow] |= bit; columns[bestColumn] |= bit; houses[house] |= bit;
      if (solve()) return true;
      grid[bestRow][bestColumn] = 0; rows[bestRow] ^= bit; columns[bestColumn] ^= bit; houses[house] ^= bit;
    }
    return false;
  };
  solve();
  return grid;
}

function generateGrid(mode: Mode): Grid {
  if (mode === "one-of-each") return generateOneOfEach();
  if (mode === "queen") return generateQueenSudoku();

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

function countAntiDiagonalSolutions(startGrid: Grid, limit = 2) {
  const grid = startGrid.map(row => [...row]);
  const rows = Array(9).fill(0), columns = Array(9).fill(0), houses = Array(9).fill(0);
  const diagonalMasks = [0, 0];
  const diagonalCounts = [Array(10).fill(0), Array(10).fill(0)];
  const diagonalsFor = (row: number, column: number) => [row === column ? 0 : -1, row + column === 8 ? 1 : -1].filter(index => index >= 0);
  const addDiagonalDigit = (row: number, column: number, digit: number) => {
    for (const diagonal of diagonalsFor(row, column)) {
      diagonalCounts[diagonal][digit] += 1;
      diagonalMasks[diagonal] |= 1 << (digit - 1);
    }
  };
  const removeDiagonalDigit = (row: number, column: number, digit: number) => {
    for (const diagonal of diagonalsFor(row, column)) {
      diagonalCounts[diagonal][digit] -= 1;
      if (!diagonalCounts[diagonal][digit]) diagonalMasks[diagonal] &= ~(1 << (digit - 1));
    }
  };

  for (let row = 0; row < 9; row++) for (let column = 0; column < 9; column++) {
    const digit = grid[row][column];
    if (!digit) continue;
    if (digit < 1 || digit > 9) return 0;
    const bit = 1 << (digit - 1), house = Math.floor(row / 3) * 3 + Math.floor(column / 3);
    if ((rows[row] | columns[column] | houses[house]) & bit) return 0;
    rows[row] |= bit; columns[column] |= bit; houses[house] |= bit;
    addDiagonalDigit(row, column, digit);
    if (diagonalsFor(row, column).some(diagonal => bitCount(diagonalMasks[diagonal]) > 3)) return 0;
  }

  const choicesFor = (row: number, column: number) => {
    const house = Math.floor(row / 3) * 3 + Math.floor(column / 3);
    let choices = allDigits & ~(rows[row] | columns[column] | houses[house]);
    for (const diagonal of diagonalsFor(row, column)) {
      // Once three digits have appeared on a diagonal, only those digits may
      // fill its remaining cells. Before then, a new digit is still allowed.
      if (bitCount(diagonalMasks[diagonal]) === 3) choices &= diagonalMasks[diagonal];
    }
    return choices;
  };
  const search = (): number => {
    let bestRow = -1, bestColumn = -1, bestChoices = 0, fewest = 10;
    for (let row = 0; row < 9; row++) for (let column = 0; column < 9; column++) if (!grid[row][column]) {
      const choices = choicesFor(row, column), count = bitCount(choices);
      if (!count) return 0;
      if (count < fewest) { bestRow = row; bestColumn = column; bestChoices = choices; fewest = count; }
    }
    if (bestRow < 0) return 1;
    let found = 0;
    for (let digit = 1; digit <= 9 && found < limit; digit += 1) if (bestChoices & (1 << (digit - 1))) {
      const bit = 1 << (digit - 1), house = Math.floor(bestRow / 3) * 3 + Math.floor(bestColumn / 3);
      grid[bestRow][bestColumn] = digit; rows[bestRow] |= bit; columns[bestColumn] |= bit; houses[house] |= bit;
      addDiagonalDigit(bestRow, bestColumn, digit);
      found += search();
      removeDiagonalDigit(bestRow, bestColumn, digit);
      grid[bestRow][bestColumn] = 0; rows[bestRow] ^= bit; columns[bestColumn] ^= bit; houses[house] ^= bit;
    }
    return found;
  };
  return search();
}

function countQueenSolutions(startGrid: Grid, limit = 2) {
  const grid = startGrid.map(row => [...row]);
  const rows = Array(9).fill(0), columns = Array(9).fill(0), houses = Array(9).fill(0);
  const queenDescending = new Set<number>(), queenAscending = new Set<number>();
  const queenBit = 1 << 8;
  const houseFor = (row: number, column: number) => Math.floor(row / 3) * 3 + Math.floor(column / 3);
  const add = (row: number, column: number, digit: number) => {
    const bit = 1 << (digit - 1), house = houseFor(row, column);
    rows[row] |= bit; columns[column] |= bit; houses[house] |= bit;
    if (digit === 9) { queenDescending.add(row - column); queenAscending.add(row + column); }
  };
  const remove = (row: number, column: number, digit: number) => {
    const bit = 1 << (digit - 1), house = houseFor(row, column);
    rows[row] ^= bit; columns[column] ^= bit; houses[house] ^= bit;
    if (digit === 9) { queenDescending.delete(row - column); queenAscending.delete(row + column); }
  };

  for (let row = 0; row < 9; row++) for (let column = 0; column < 9; column++) {
    const digit = grid[row][column];
    if (!digit) continue;
    if (digit < 1 || digit > 9) return 0;
    const bit = 1 << (digit - 1), house = houseFor(row, column);
    if ((rows[row] | columns[column] | houses[house]) & bit) return 0;
    if (digit === 9 && (queenDescending.has(row - column) || queenAscending.has(row + column))) return 0;
    add(row, column, digit);
  }

  const search = (): number => {
    let bestRow = -1, bestColumn = -1, bestChoices = 0, fewest = 10;
    for (let row = 0; row < 9; row++) for (let column = 0; column < 9; column++) if (!grid[row][column]) {
      const house = houseFor(row, column);
      let choices = allDigits & ~(rows[row] | columns[column] | houses[house]);
      if (queenDescending.has(row - column) || queenAscending.has(row + column)) choices &= ~queenBit;
      const count = bitCount(choices);
      if (!count) return 0;
      if (count < fewest) { bestRow = row; bestColumn = column; bestChoices = choices; fewest = count; }
    }
    if (bestRow < 0) return 1;
    let found = 0;
    for (let digit = 1; digit <= 9 && found < limit; digit += 1) if (bestChoices & (1 << (digit - 1))) {
      grid[bestRow][bestColumn] = digit;
      add(bestRow, bestColumn, digit);
      found += search();
      remove(bestRow, bestColumn, digit);
      grid[bestRow][bestColumn] = 0;
    }
    return found;
  };
  return search();
}

function solveDiagonalGrid(startGrid: Grid): Grid | null {
  const grid = startGrid.map(row => [...row]);
  const rows = Array(9).fill(0), columns = Array(9).fill(0), houses = Array(9).fill(0), diagonals = [0, 0];
  for (let row = 0; row < 9; row++) for (let column = 0; column < 9; column++) {
    const digit = grid[row][column];
    if (!digit) continue;
    const bit = 1 << (digit - 1), house = Math.floor(row / 3) * 3 + Math.floor(column / 3);
    let used = rows[row] | columns[column] | houses[house];
    if (row === column) used |= diagonals[0];
    if (row + column === 8) used |= diagonals[1];
    if (digit < 1 || digit > 9 || used & bit) return null;
    rows[row] |= bit; columns[column] |= bit; houses[house] |= bit;
    if (row === column) diagonals[0] |= bit;
    if (row + column === 8) diagonals[1] |= bit;
  }
  const search = (): boolean => {
    let bestRow = -1, bestColumn = -1, bestChoices = 0, fewest = 10;
    for (let row = 0; row < 9; row++) for (let column = 0; column < 9; column++) if (!grid[row][column]) {
      const house = Math.floor(row / 3) * 3 + Math.floor(column / 3);
      let used = rows[row] | columns[column] | houses[house];
      if (row === column) used |= diagonals[0];
      if (row + column === 8) used |= diagonals[1];
      const choices = allDigits & ~used, count = bitCount(choices);
      if (!count) return false;
      if (count < fewest) { bestRow = row; bestColumn = column; bestChoices = choices; fewest = count; }
    }
    if (bestRow < 0) return true;
    for (let digit = 1; digit <= 9; digit++) if (bestChoices & (1 << (digit - 1))) {
      const bit = 1 << (digit - 1), house = Math.floor(bestRow / 3) * 3 + Math.floor(bestColumn / 3);
      grid[bestRow][bestColumn] = digit; rows[bestRow] |= bit; columns[bestColumn] |= bit; houses[house] |= bit;
      if (bestRow === bestColumn) diagonals[0] |= bit;
      if (bestRow + bestColumn === 8) diagonals[1] |= bit;
      if (search()) return true;
      grid[bestRow][bestColumn] = 0; rows[bestRow] ^= bit; columns[bestColumn] ^= bit; houses[house] ^= bit;
      if (bestRow === bestColumn) diagonals[0] ^= bit;
      if (bestRow + bestColumn === 8) diagonals[1] ^= bit;
    }
    return false;
  };
  return search() ? grid : null;
}

// This is a GPL-3.0 adaptation of sudokUI's board/rating approach.
// Source: https://github.com/AImenes/sudokUI (board.ts, ratings.ts and its
// human solver).  It adds the two X-Sudoku units to the board model.  As in
// sudokUI, a score is the sum of the techniques in the solve path; Brute Force
// is a legitimate last-resort technique worth 10,000 points, not a score cap.
function rateDiagonalPuzzle(startGrid: Grid, solvedGrid: Grid, variant: "diagonal" | "standard" | "queen" = "diagonal"): DifficultyRating {
  const values = startGrid.flat();
  const givens = [...values];
  // Digging has already verified that this is the puzzle's unique diagonal
  // solution. Keep that solution as an invariant for the explanation engine:
  // a valid Snyder elimination can never discard the solution digit.
  const solutionValues = solvedGrid.flat();
  const standardUnits = [
    ...Array.from({ length: 9 }, (_, row) => Array.from({ length: 9 }, (_, column) => row * 9 + column)),
    ...Array.from({ length: 9 }, (_, column) => Array.from({ length: 9 }, (_, row) => row * 9 + column)),
    ...Array.from({ length: 9 }, (_, box) => {
      const boxRow = Math.floor(box / 3) * 3, boxColumn = (box % 3) * 3;
      return Array.from({ length: 9 }, (_, cell) => (boxRow + Math.floor(cell / 3)) * 9 + boxColumn + (cell % 3));
    }),
  ];
  const diagonalUnits = [
    Array.from({ length: 9 }, (_, index) => index * 10),
    Array.from({ length: 9 }, (_, index) => (index + 1) * 8),
  ];
  const units = [...standardUnits, ...diagonalUnits];
  // Anti-diagonal uses a global "at most three digits" condition, not a
  // no-repeat house. Its standard deductions must therefore only use rows,
  // columns and boxes; the two diagonals are not peer units in that variant.
  const hasDistinctDiagonals = variant === "diagonal";
  const activeUnits = hasDistinctDiagonals ? units : standardUnits;
  const unitsFor = Array.from({ length: 81 }, (_, index) => activeUnits.map((unit, unitIndex) => unit.includes(index) ? unitIndex : -1).filter(unit => unit >= 0));
  const peers = Array.from({ length: 81 }, (_, index) => [...new Set(unitsFor[index].flatMap(unit => activeUnits[unit]))].filter(cell => cell !== index));
  const queenDiagonalPeers = Array.from({ length: 81 }, (_, index) => variant === "queen"
    ? [...new Set(queenDiagonals.filter(diagonal => diagonal.cells.includes(index)).flatMap(diagonal => diagonal.cells))].filter(cell => cell !== index)
    : []);
  const candidates = Array.from({ length: 81 }, (_, index) => {
    if (values[index]) return 0;
    const used = new Set(peers[index].map(cell => values[cell]).filter(Boolean));
    if (variant === "queen" && queenDiagonalPeers[index].some(cell => values[cell] === 9)) used.add(9);
    return Array.from({ length: 9 }, (_, offset) => offset + 1).filter(digit => !used.has(digit)).reduce((mask, digit) => mask | (1 << (digit - 1)), 0);
  });
  const digits = (mask: number) => Array.from({ length: 9 }, (_, offset) => offset + 1).filter(digit => mask & (1 << (digit - 1)));
  const popcount = (mask: number) => digits(mask).length;
  const steps: string[] = [];
  const walkthrough: WalkthroughStep[] = [];
  const place = (cell: number, digit: number) => {
    if (values[cell] || solutionValues[cell] !== digit) return false;
    values[cell] = digit; candidates[cell] = 0;
    const mask = ~(1 << (digit - 1));
    peers[cell].forEach(peer => { candidates[peer] &= mask; });
    if (variant === "queen" && digit === 9) queenDiagonalPeers[cell].forEach(peer => { candidates[peer] &= ~(1 << 8); });
    return true;
  };
  const eliminate = (items: Array<[number, number]>) => items.forEach(([cell, digit]) => {
    // Do not remove a placed value, nor the digit required by the unique
    // solution. This keeps every unsolved cell's candidates truthful.
    if (!values[cell] && solutionValues[cell] !== digit) candidates[cell] &= ~(1 << (digit - 1));
  });
  const combinations = <T,>(items: T[], size: number): T[][] => {
    if (size === 0) return [[]];
    if (items.length < size) return [];
    return items.flatMap((item, index) => combinations(items.slice(index + 1), size - 1).map(rest => [item, ...rest]));
  };
  const cellName = (cell: number) => `R${Math.floor(cell / 9) + 1}C${cell % 9 + 1}`;
  const unitName = (unit: number) => unit < 9 ? `row ${unit + 1}` : unit < 18 ? `column ${unit - 8}` : unit < 27 ? `the ${Math.floor((unit - 18) / 3) + 1}${["st", "nd", "rd"][((unit - 18) % 3)] ?? "th"} 3×3 box` : unit === 27 ? "the diagonal from R1C1 to R9C9" : "the diagonal from R1C9 to R9C1";
  const add = (name: string, action: () => void, involved: CandidateRemoval[] = [], explanation?: string, highlightedDiagonals: number[] = []) => {
    const beforeValues = [...values];
    const beforeCandidates = [...candidates];
    action();
    // Do not publish an invalid deduction. This guard also ensures that a
    // later walkthrough slide can never contain an empty unsolved cell.
    if (values.some((value, cell) => !value && candidates[cell] === 0)) {
      values.splice(0, values.length, ...beforeValues);
      candidates.splice(0, candidates.length, ...beforeCandidates);
      return false;
    }
    const placed = values.map((value, cell) => value && value !== beforeValues[cell] ? cell : -1).filter(cell => cell >= 0);
    const removed = beforeCandidates.flatMap((mask, cell) =>
      placed.includes(cell) ? [] : digits(mask & ~candidates[cell]).map(digit => ({ cell, digit })),
    );
    const uniqueInvolved = [...new Map(involved.map(item => [`${item.cell}-${item.digit}`, item])).values()];
    const affectedCells = [...new Set([...placed, ...removed.map(item => item.cell), ...uniqueInvolved.map(item => item.cell)])];
    const placedNames = placed.map(cell => `R${Math.floor(cell / 9) + 1}C${cell % 9 + 1}`);
    const removedNames = [...new Set(removed.map(item => `R${Math.floor(item.cell / 9) + 1}C${item.cell % 9 + 1}`))];
    const baseMessage = placed.length
      ? `Placed ${placed.map(cell => values[cell]).join(", ")} in ${placedNames.join(", ")}.`
      : `Eliminated candidates in ${removedNames.join(", ")}.`;
    const involvedDigits = [...new Set(uniqueInvolved.map(item => item.digit))];
    const involvedCells = [...new Set(uniqueInvolved.map(item => `R${Math.floor(item.cell / 9) + 1}C${item.cell % 9 + 1}`))];
    const defaultMessage = uniqueInvolved.length
      ? `${baseMessage} Highlighted digits ${involvedDigits.join(", ")} are the ${name.toLowerCase()} set in ${involvedCells.join(", ")}.`
      : baseMessage;
    const message = explanation ?? defaultMessage;
    if (!placed.length && !removed.length) return false;
    steps.push(name);
    walkthrough.push({ technique: name, values: [...values], candidates: [...candidates], affectedCells, placedCells: placed, removed, involved: uniqueInvolved, highlightedDiagonals, message });
    return true;
  };

  walkthrough.push({
    technique: "Starting position",
    values: [...values],
    candidates: [...candidates],
    affectedCells: [],
    placedCells: [],
    removed: [],
    involved: [],
    highlightedDiagonals: [],
    message: "Starting board with all available Snyder notations.",
  });

  // This matches sudokUI's order for these applicable techniques, while each
  // finder uses the valid house set for the selected puzzle variant.
  while (values.some(value => !value)) {
    let moveMade = false;
    for (let unitIndex = 0; unitIndex < activeUnits.length && !moveMade; unitIndex++) {
      const blank = activeUnits[unitIndex].filter(cell => !values[cell]);
      if (blank.length === 1 && candidates[blank[0]] && add("Full House", () => place(blank[0], digits(candidates[blank[0]])[0]))) moveMade = true;
    }
    if (moveMade) continue;

    const naked = values.findIndex((value, cell) => !value && popcount(candidates[cell]) === 1);
    if (naked >= 0 && add("Naked Single", () => place(naked, digits(candidates[naked])[0]))) continue;
    for (const unit of activeUnits) {
      for (let digit = 1; digit <= 9; digit++) {
        const locations = unit.filter(cell => !values[cell] && (candidates[cell] & (1 << (digit - 1))));
        if (locations.length === 1 && add("Hidden Single", () => place(locations[0], digit))) { moveMade = true; break; }
      }
      if (moveMade) break;
    }
    if (moveMade) continue;

    // Try both forms of each subset size before moving to a larger subset.
    // In particular, a hidden pair is preferred over any triple/quadruple.
    for (const size of [2, 3, 4]) {
      for (let unitIndex = 0; unitIndex < activeUnits.length && !moveMade; unitIndex++) {
        const cells = activeUnits[unitIndex].filter(cell => !values[cell] && popcount(candidates[cell]) <= size);
        for (const group of combinations(cells, size)) {
          const mask = group.reduce((total, cell) => total | candidates[cell], 0);
          if (popcount(mask) !== size) continue;
          const targets = activeUnits[unitIndex].filter(cell => !group.includes(cell) && !values[cell]).flatMap(cell => digits(candidates[cell] & mask).map(digit => [cell, digit] as [number, number]));
          const involved = group.flatMap(cell => digits(candidates[cell] & mask).map(digit => ({ cell, digit })));
          if (targets.length && add(`Naked ${["", "", "Pair", "Triple", "Quadruple"][size]}`, () => eliminate(targets), involved)) { moveMade = true; break; }
        }
      }
      if (moveMade) break;
      for (const unit of activeUnits) {
        const empty = unit.filter(cell => !values[cell]);
        const missingDigits = Array.from({ length: 9 }, (_, index) => index + 1).filter(digit => !unit.some(cell => values[cell] === digit));
        for (const digitGroup of combinations(missingDigits, size)) {
          const mask = digitGroup.reduce((total, digit) => total | (1 << (digit - 1)), 0);
          // A hidden set is only valid when every selected, still-missing digit
          // occurs in at least one candidate cell. Without this guard, a digit
          // already placed in the unit can create a phantom pair/triple/quad.
          if (digitGroup.some(digit => !empty.some(cell => candidates[cell] & (1 << (digit - 1))))) continue;
          const cells = empty.filter(cell => candidates[cell] & mask);
          const targets = cells.flatMap(cell => digits(candidates[cell] & ~mask).map(digit => [cell, digit] as [number, number]));
          const involved = cells.flatMap(cell => digitGroup.filter(digit => candidates[cell] & (1 << (digit - 1))).map(digit => ({ cell, digit })));
          if (cells.length === size && targets.length && add(`Hidden ${["", "", "Pair", "Triple", "Quadruple"][size]}`, () => eliminate(targets), involved)) { moveMade = true; break; }
        }
        if (moveMade) break;
      }
      if (moveMade) break;
    }
    if (moveMade) continue;

    // Pointing and claiming apply to rows and columns in every variant, and
    // to the two diagonals only when they are distinct-digit houses.
    for (let box = 18; box < 27 && !moveMade; box++) for (let digit = 1; digit <= 9 && !moveMade; digit++) {
      const bit = 1 << (digit - 1), locations = units[box].filter(cell => !values[cell] && candidates[cell] & bit);
      const lineUnits = [
        ...[0, 1].map(line => ({
          unit: locations.length ? (line ? Math.floor(locations[0] / 9) : 9 + locations[0] % 9) : -1,
          matches: (cell: number) => line ? Math.floor(cell / 9) === Math.floor(locations[0] / 9) : cell % 9 === locations[0] % 9,
        })),
        ...(hasDistinctDiagonals ? [
          { unit: 27, matches: (cell: number) => cell % 10 === 0 },
          { unit: 28, matches: (cell: number) => cell > 0 && cell < 80 && cell % 8 === 0 },
        ] : []),
      ];
      for (const line of lineUnits) if (locations.length > 1 && locations.every(line.matches)) {
        const targets = units[line.unit].filter(cell => !units[box].includes(cell) && !values[cell] && candidates[cell] & bit);
        const explanation = `In ${unitName(box)}, the green ${digit}s can occur only at ${locations.map(cellName).join(", ")}. All of those positions lie on ${unitName(line.unit)}, so the ${digit} for this box must be on that line. The red ${digit}s outside the box are therefore impossible and are removed.`;
        if (targets.length && add("Locked Candidates (Pointing)", () => eliminate(targets.map(cell => [cell, digit])), locations.map(cell => ({ cell, digit })), explanation, line.unit >= 27 ? [line.unit] : [])) moveMade = true;
      }
    }
    if (moveMade) continue;
    for (const line of [...Array.from({ length: 18 }, (_, index) => index), ...(hasDistinctDiagonals ? [27, 28] : [])]) for (let digit = 1; digit <= 9 && !moveMade; digit++) {
      const bit = 1 << (digit - 1), locations = units[line].filter(cell => !values[cell] && candidates[cell] & bit);
      const boxes = locations.map(cell => 18 + Math.floor(Math.floor(cell / 9) / 3) * 3 + Math.floor((cell % 9) / 3));
      if (locations.length > 1 && new Set(boxes).size === 1) {
        const targets = units[boxes[0]].filter(cell => !units[line].includes(cell) && !values[cell] && candidates[cell] & bit);
        const explanation = `On ${unitName(line)}, the green ${digit}s can occur only at ${locations.map(cellName).join(", ")}, all inside ${unitName(boxes[0])}. Therefore ${digit} must occupy that box through this line, making the red ${digit}s elsewhere in the box impossible.`;
        if (targets.length && add("Locked Candidates (Claiming)", () => eliminate(targets.map(cell => [cell, digit])), locations.map(cell => ({ cell, digit })), explanation, line >= 27 ? [line] : [])) moveMade = true;
      }
    }
    if (moveMade) continue;

    // Every standard row, column and box contains one 9. When all of a
    // unit's possible 9s lie on one of Queen Sudoku's 22 relevant diagonals,
    // that diagonal must receive the unit's 9, so no other cell on it can be
    // 9. This is the Queen-specific locked-candidate rule, at the same
    // priority and score as the other locked-candidate techniques.
    if (variant === "queen") for (const unit of standardUnits) for (const diagonal of queenDiagonals) {
      const bit = 1 << 8;
      const locations = unit.filter(cell => !values[cell] && candidates[cell] & bit);
      if (locations.length < 2 || !locations.every(cell => diagonal.cells.includes(cell))) continue;
      const targets = diagonal.cells.filter(cell => !unit.includes(cell) && !values[cell] && candidates[cell] & bit);
      const explanation = `In a standard Sudoku unit, 9 must appear exactly once. Its green candidates at ${locations.map(cellName).join(", ")} all lie on this Queen diagonal, so one of them must be the unit's 9. A second 9 anywhere else on the same diagonal would attack it, so the red 9s are removed.`;
      if (targets.length && add("Locked Candidates (9 Diagonal)", () => eliminate(targets.map(cell => [cell, 9])), locations.map(cell => ({ cell, digit: 9 })), explanation)) { moveMade = true; break; }
    }
    if (moveMade) continue;

    // This rule assumes that each diagonal contains every digit exactly once.
    // Anti-diagonal Sudoku permits repeats on both diagonals, so this finder
    // is explicitly disabled for an Anti-diagonal walkthrough.
    if (hasDistinctDiagonals) for (const diagonal of [27, 28]) for (let digit = 1; digit <= 9 && !moveMade; digit++) {
      const bit = 1 << (digit - 1), locations = units[diagonal].filter(cell => !values[cell] && candidates[cell] & bit);
      if (locations.length !== 2) continue;
      const firstPeers = new Set(peers[locations[0]]);
      const targets = peers[locations[1]].filter(cell => firstPeers.has(cell) && !values[cell] && candidates[cell] & bit);
      // Preserve the two diagonal candidates as the supporting evidence for
      // this deduction. The walkthrough renders them in green, while the
      // same digit in the peer-intersection targets is struck through red.
      const involved = locations.map(cell => ({ cell, digit }));
      const explanation = `On ${unitName(diagonal)}, the green ${digit}s at ${locations.map(cellName).join(" and ")} are the only two possible places for ${digit}. Every red ${digit} shares a Sudoku unit with both green candidates. If any red ${digit} were true, it would eliminate both green candidates and leave no place for ${digit} on ${unitName(diagonal)}. The red ${digit}s are therefore removed.`;
      if (targets.length && add("Locked Candidates (Diagonal)", () => eliminate(targets.map(cell => [cell, digit])), involved, explanation, [diagonal])) moveMade = true;
    }
    if (moveMade) continue;

    // Wings from sudokUI's `wings.ts`. They use this solver's peer graph, so
    // a diagonal is naturally a valid link whenever its cells see each other.
    const bivalues = values.map((value, cell) => !value && popcount(candidates[cell]) === 2 ? cell : -1).filter(cell => cell >= 0);
    for (const pivot of bivalues) {
      const [x, y] = digits(candidates[pivot]);
      const wingCells = bivalues.filter(cell => cell !== pivot && peers[pivot].includes(cell));
      for (const firstWing of wingCells) {
        if (!(candidates[firstWing] & (1 << (x - 1))) || candidates[firstWing] === candidates[pivot]) continue;
        const z = digits(candidates[firstWing]).find(digit => digit !== x)!;
        if (z === y) continue;
        for (const secondWing of wingCells) {
          if (secondWing === firstWing || candidates[secondWing] !== ((1 << (y - 1)) | (1 << (z - 1)))) continue;
          const firstPeers = new Set(peers[firstWing]);
          const targets = peers[secondWing].filter(cell => firstPeers.has(cell) && !values[cell] && candidates[cell] & (1 << (z - 1)));
          const involved = [pivot, firstWing, secondWing].flatMap(cell => digits(candidates[cell]).map(digit => ({ cell, digit })));
          const explanation = `The green candidates form an XY-Wing: ${cellName(pivot)} is the pivot with {${x}, ${y}}, while ${cellName(firstWing)} has {${x}, ${z}} and ${cellName(secondWing)} has {${y}, ${z}}. The pivot sees both wing cells. If the pivot is ${x}, ${z} is forced in ${cellName(secondWing)}; if it is ${y}, ${z} is forced in ${cellName(firstWing)}. Thus ${z} must be in one of the two wings, so no cell that sees both wings can be ${z}. The red ${z}s are those eliminations.`;
          if (targets.length && add("XY-Wing", () => eliminate(targets.map(cell => [cell, z])), involved, explanation)) { moveMade = true; break; }
        }
        if (moveMade) break;
      }
      if (moveMade) break;
    }
    if (moveMade) continue;
    for (let pivot = 0; pivot < 81 && !moveMade; pivot++) {
      if (values[pivot] || popcount(candidates[pivot]) !== 3) continue;
      const pivotMask = candidates[pivot];
      const wingCells = peers[pivot].filter(cell => !values[cell] && popcount(candidates[cell]) === 2 && (candidates[cell] & pivotMask) === candidates[cell]);
      for (const firstWing of wingCells) for (const secondWing of wingCells) {
        if (secondWing <= firstWing) continue;
        const shared = candidates[firstWing] & candidates[secondWing];
        if (popcount(shared) !== 1 || (candidates[firstWing] | candidates[secondWing]) !== pivotMask) continue;
        const z = digits(shared)[0];
        const firstPeers = new Set(peers[firstWing]);
        const targets = peers[secondWing].filter(cell => cell !== pivot && peers[pivot].includes(cell) && firstPeers.has(cell) && !values[cell] && candidates[cell] & (1 << (z - 1)));
        const involved = [pivot, firstWing, secondWing].flatMap(cell => digits(candidates[cell]).map(digit => ({ cell, digit })));
        const explanation = `The green candidates form an XYZ-Wing: the pivot ${cellName(pivot)} has {${digits(pivotMask).join(", ")}}, with wings ${cellName(firstWing)} {${digits(candidates[firstWing]).join(", ")}} and ${cellName(secondWing)} {${digits(candidates[secondWing]).join(", ")}}. Both wings share ${z}, and both see the pivot. If a common peer were ${z}, it would remove ${z} from the pivot and both wings; the two wings would then force the pivot's other two digits away, leaving the pivot with no value. Therefore the red ${z}s in cells seeing the pivot and both wings are impossible.`;
        if (targets.length && add("XYZ-Wing", () => eliminate(targets.map(cell => [cell, z])), involved, explanation)) moveMade = true;
        if (moveMade) break;
      }
    }
    if (moveMade) continue;
    for (let firstIndex = 0; firstIndex < bivalues.length && !moveMade; firstIndex++) for (let secondIndex = firstIndex + 1; secondIndex < bivalues.length && !moveMade; secondIndex++) {
      const first = bivalues[firstIndex], second = bivalues[secondIndex];
      if (candidates[first] !== candidates[second] || peers[first].includes(second)) continue;
      const [x, y] = digits(candidates[first]);
      for (const [linkDigit, eliminationDigit] of [[x, y], [y, x]]) {
        const bit = 1 << (linkDigit - 1);
        for (const unit of units) {
          const locations = unit.filter(cell => !values[cell] && candidates[cell] & bit);
          if (locations.length !== 2 || locations.includes(first) || locations.includes(second)) continue;
          const [linkA, linkB] = locations;
          const connects = (peers[linkA].includes(first) && peers[linkB].includes(second)) || (peers[linkA].includes(second) && peers[linkB].includes(first));
          if (!connects) continue;
          const firstPeers = new Set(peers[first]);
          const targets = peers[second].filter(cell => firstPeers.has(cell) && !values[cell] && candidates[cell] & (1 << (eliminationDigit - 1)) && !locations.includes(cell));
          const involved = [first, second].flatMap(cell => digits(candidates[cell]).map(digit => ({ cell, digit }))).concat([{ cell: linkA, digit: linkDigit }, { cell: linkB, digit: linkDigit }]);
          const explanation = `The green candidates show a W-Wing. ${cellName(first)} and ${cellName(second)} are the matching {${x}, ${y}} endpoints, and ${linkDigit} appears only at ${cellName(linkA)} and ${cellName(linkB)} in one house. One of those green ${linkDigit}s must be true. Whichever one is true removes ${linkDigit} from its connected endpoint, forcing that endpoint to ${eliminationDigit}. Therefore ${eliminationDigit} must occupy one of the two endpoints, so every common peer cannot be ${eliminationDigit}. The red ${eliminationDigit}s are removed.`;
          if (targets.length && add("W-Wing", () => eliminate(targets.map(cell => [cell, eliminationDigit])), involved, explanation)) { moveMade = true; break; }
        }
        if (moveMade) break;
      }
    }
    if (moveMade) continue;

    // Basic fish (X-Wing, Swordfish and Jellyfish) from sudokUI's solve order.
    for (const size of [2, 3, 4]) for (let digit = 1; digit <= 9 && !moveMade; digit++) for (const byRows of [true, false]) {
      const bit = 1 << (digit - 1);
      const bases = Array.from({ length: 9 }, (_, base) => {
        const cells = Array.from({ length: 9 }, (_, cross) => byRows ? base * 9 + cross : cross * 9 + base).filter(cell => !values[cell] && candidates[cell] & bit);
        return { base, crosses: cells.map(cell => byRows ? cell % 9 : Math.floor(cell / 9)) };
      }).filter(item => item.crosses.length >= 2 && item.crosses.length <= size);
      for (const group of combinations(bases, size)) {
        const crosses = [...new Set(group.flatMap(item => item.crosses))];
        if (crosses.length !== size) continue;
        const baseSet = new Set(group.map(item => item.base));
        const targets = crosses.flatMap(cross => Array.from({ length: 9 }, (_, base) => byRows ? base * 9 + cross : cross * 9 + base).filter(cell => !baseSet.has(byRows ? Math.floor(cell / 9) : cell % 9) && !values[cell] && candidates[cell] & bit).map(cell => [cell, digit] as [number, number]));
        const sourceCells = group.flatMap(item => item.crosses.map(cross => byRows ? item.base * 9 + cross : cross * 9 + item.base));
        const involved = sourceCells.map(cell => ({ cell, digit }));
        const technique = ["", "", "X-Wing", "Swordfish", "Jellyfish"][size];
        const baseLabel = byRows ? "rows" : "columns";
        const crossLabel = byRows ? "columns" : "rows";
        const baseNames = group.map(item => `${byRows ? "R" : "C"}${item.base + 1}`).join(", ");
        const crossNames = crosses.map(cross => `${byRows ? "C" : "R"}${cross + 1}`).join(", ");
        const explanation = `The green ${digit}s form a ${technique}: in ${baseLabel} ${baseNames}, candidate ${digit} is restricted to the same ${crossLabel} ${crossNames}. Because each of these ${baseLabel} must place one ${digit}, the ${digit}s must occupy the green intersections of those ${baseLabel} and ${crossLabel}. No other cell on ${crossLabel} ${crossNames} can be ${digit}; those conflicting candidate ${digit}s are shown in red and removed.`;
        if (targets.length && add(technique, () => eliminate(targets), involved, explanation)) { moveMade = true; break; }
      }
      if (moveMade) break;
    }
    if (moveMade) continue;

    // Keep sudokUI's documented last-resort behaviour, rather than falsely
    // labelling every non-single puzzle 10,000 before these techniques run.
    const cell = values.findIndex(value => !value);
    const draft = [...values];
    const solveFromHere = (): boolean => {
      let best = -1, bestOptions: number[] = [];
      for (let index = 0; index < 81; index++) if (!draft[index]) {
        const used = new Set(peers[index].map(peer => draft[peer]).filter(Boolean));
        const options = Array.from({ length: 9 }, (_, offset) => offset + 1).filter(digit => !used.has(digit) && (digit !== 9 || variant !== "queen" || !queenDiagonalPeers[index].some(peer => draft[peer] === 9)));
        if (!options.length) return false;
        if (best < 0 || options.length < bestOptions.length) { best = index; bestOptions = options; }
      }
      if (best < 0) return true;
      for (const digit of bestOptions) { draft[best] = digit; if (solveFromHere()) return true; draft[best] = 0; }
      return false;
    };
    if (cell < 0 || !solveFromHere()) break;
    if (!add("Brute Force", () => place(cell, draft[cell]))) break;
  }

  const scores = sudokUiTechniqueDifficulty;
  const levels: Record<string, string> = { "Full House": "Beginner", "Naked Single": "Beginner", "Hidden Single": "Beginner", "Locked Candidates (Pointing)": "Medium", "Locked Candidates (Claiming)": "Medium", "Locked Candidates (Diagonal)": "Medium", "Locked Candidates (9 Diagonal)": "Medium", "Naked Pair": "Medium", "Naked Triple": "Medium", "Hidden Pair": "Medium", "Hidden Triple": "Medium", "Naked Quadruple": "Hard", "Hidden Quadruple": "Hard", "X-Wing": "Hard", "Swordfish": "Hard", "Jellyfish": "Hard", "W-Wing": "Hard", "XY-Wing": "Hard", "XYZ-Wing": "Hard", "Brute Force": "Extreme" };
  const order = ["Beginner", "Easy", "Medium", "Tricky", "Hard", "Unfair", "Extreme", "Nightmare"];
  const maxScore: Record<string, number> = { Beginner: 400, Easy: 800, Medium: 1000, Tricky: 1150, Hard: 1600, Unfair: 1800, Extreme: 3000, Nightmare: Number.MAX_SAFE_INTEGER };
  const score = steps.reduce((total, step) => total + scores[step], 0);
  let rating = steps.reduce((hardest, step) => order.indexOf(levels[step]) > order.indexOf(hardest) ? levels[step] : hardest, "Beginner");
  while (order.indexOf(rating) < order.length - 1 && score > maxScore[rating]) rating = order[order.indexOf(rating) + 1];
  const tally = steps.reduce<Record<string, number>>((counts, step) => ({ ...counts, [step]: (counts[step] ?? 0) + 1 }), {});
  return { rating, score, techniques: [...new Set(steps)], logical: !steps.includes("Brute Force"), walkthrough, tally, givens };
}

function digDiagonal(method: DiggingMethod, protectedCells = Array(81).fill(false)) {
  const solution = generateGrid("diagonal");
  const puzzle = solution.map(row => [...row]);
  const cells = method === "single"
    ? Array.from({ length: 81 }, (_, index) => [Math.floor(index / 9), index % 9])
      .filter(([row, column]) => !protectedCells[row * 9 + column])
    : Array.from({ length: 81 }, (_, index) => [Math.floor(index / 9), index % 9])
      .filter(([row, column]) => {
        const mirrorRow = 8 - row, mirrorColumn = 8 - column;
        return (row < 4 || (row === 4 && column <= 4)) && !protectedCells[row * 9 + column] && !protectedCells[mirrorRow * 9 + mirrorColumn];
      });

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

function digQueen(method: DiggingMethod) {
  const solution = generateGrid("queen");
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
    if (countQueenSolutions(puzzle) !== 1) {
      puzzle[row][column] = value;
      if (method === "double") puzzle[mirrorRow][mirrorColumn] = mirrorValue;
    }
  }
  return { puzzle, solution };
}

export default function Home({ initialMode = "diagonal" }: { initialMode?: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [grid, setGrid] = useState<Grid>(emptyGrid);
  const [solution, setSolution] = useState<Grid | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [diggingMethod, setDiggingMethod] = useState<DiggingMethod>("double");
  const [difficulty, setDifficulty] = useState<DifficultyRating | null>(null);
  const [walkthroughIndex, setWalkthroughIndex] = useState(0);
  const [copiedGrid, setCopiedGrid] = useState<"puzzle" | "puzzle-image" | "puzzle-image-download" | "solution" | "solution-image" | "solution-image-download" | null>(null);
  const [puzzleInput, setPuzzleInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [protectedCells, setProtectedCells] = useState<boolean[]>(() => Array(81).fill(false));
  const [builderError, setBuilderError] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isBuiltPuzzle, setIsBuiltPuzzle] = useState(false);
  const [buildAttempts, setBuildAttempts] = useState(0);
  const [minimumDifficulty, setMinimumDifficulty] = useState("500");
  const [maximumDifficulty, setMaximumDifficulty] = useState("10000");
  const [isBuilderExpanded, setIsBuilderExpanded] = useState(false);
  const [simulationTrials, setSimulationTrials] = useState("1000");
  const [simulationTally, setSimulationTally] = useState<Record<number, number>>({});
  const [completedSimulationTrials, setCompletedSimulationTrials] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const buildStartedAt = useRef(0);
  const simulationCancelled = useRef(false);
  const showsDiagonalGuides = mode === "diagonal" || mode === "anti-diagonal" || mode === "one-of-each";
  const generate = () => {
    const started = performance.now();
    setIsBuiltPuzzle(false);
    if (mode === "diagonal") {
      const dug = digDiagonal(diggingMethod);
      setGrid(dug.puzzle); setSolution(dug.solution);
      setDifficulty(rateDiagonalPuzzle(dug.puzzle, dug.solution));
    } else if (mode === "queen") {
      const dug = digQueen(diggingMethod);
      setGrid(dug.puzzle); setSolution(dug.solution); setDifficulty(rateDiagonalPuzzle(dug.puzzle, dug.solution, "queen"));
    } else {
      const generated = generateGrid(mode);
      setGrid(generated); setSolution(generated); setDifficulty(rateDiagonalPuzzle(generated, generated, "standard"));
    }
    setWalkthroughIndex(0);
    setCopiedGrid(null);
    setElapsed(performance.now() - started);
  };
  const selectMode = (nextMode: Mode) => { simulationCancelled.current = true; setIsSimulating(false); setIsBuilding(false); setIsBuiltPuzzle(false); setMode(nextMode); setGrid(emptyGrid()); setSolution(null); setElapsed(null); setDifficulty(null); setWalkthroughIndex(0); setCopiedGrid(null); router.push(modePaths[nextMode]); };
  const toggleProtectedCell = (cell: number) => setProtectedCells(cells => cells.map((selected, index) => index === cell ? !selected : selected));
  const buildPuzzle = () => {
    setIsBuilderExpanded(true);
    if (mode !== "diagonal" && mode !== "anti-diagonal") { setBuilderError("The custom builder currently supports Diagonal and Anti-diagonal puzzles. Select one of those modes to build a puzzle."); return; }
    const minimum = Number(minimumDifficulty), maximum = Number(maximumDifficulty);
    if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || minimum < 0 || maximum < minimum) {
      setBuilderError("Enter whole-number difficulty scores where the maximum is at least the minimum.");
      return;
    }
    if (protectedCells.every(Boolean) && (minimum > 0 || maximum < 0)) {
      setBuilderError("All 81 cells are selected, so the finished grid has a difficulty score of 0. Set the minimum difficulty to 0 to build it.");
      return;
    }
    buildStartedAt.current = performance.now();
    setBuildAttempts(0); setBuilderError(null); setIsBuilding(true);
  };
  const haltBuilding = () => { setIsBuilding(false); setBuilderError(`Building halted after ${buildAttempts} attempted completed grids.`); };
  const runQueenSimulation = () => {
    const trials = Number(simulationTrials);
    if (!Number.isInteger(trials) || trials < 1 || trials > 10000) return;
    simulationCancelled.current = false;
    setIsSimulating(true); setSimulationTally({}); setCompletedSimulationTrials(0);
    const tally: Record<number, number> = {};
    let completed = 0;
    const runBatch = () => {
      const batchSize = Math.min(5, trials - completed);
      for (let index = 0; index < batchSize; index++) {
        const result = digQueen("single");
        const givens = result.puzzle.flat().filter(Boolean).length;
        tally[givens] = (tally[givens] ?? 0) + 1;
      }
      completed += batchSize;
      setSimulationTally({ ...tally }); setCompletedSimulationTrials(completed);
      if (simulationCancelled.current || completed >= trials) { setIsSimulating(false); return; }
      window.setTimeout(runBatch, 0);
    };
    window.setTimeout(runBatch, 0);
  };
  useEffect(() => {
    if (!isBuilding) return;
    let cancelled = false;
    let nextAttempt: number | undefined;
    const searchForPattern = () => {
      let attemptsThisPass = 0;
      while (attemptsThisPass < 2 && !cancelled) {
        const candidateSolution = generateGrid(mode);
        const candidatePuzzle = candidateSolution.map((row, rowIndex) => row.map((digit, columnIndex) => protectedCells[rowIndex * 9 + columnIndex] ? digit : 0));
        attemptsThisPass += 1;
        const unique = mode === "diagonal"
          ? countDiagonalSolutions(candidatePuzzle) === 1
          : countAntiDiagonalSolutions(candidatePuzzle) === 1;
        if (unique) {
          // The anti-diagonal rating uses standard Sudoku houses only. Its
          // special repeated-diagonal condition is used for uniqueness, but
          // does not create a false distinct-diagonal deduction.
          const candidateDifficulty = rateDiagonalPuzzle(candidatePuzzle, candidateSolution, mode === "diagonal" ? "diagonal" : "standard");
          const minimum = Number(minimumDifficulty), maximum = Number(maximumDifficulty);
          if (candidateDifficulty.score < minimum || candidateDifficulty.score > maximum) continue;
          setBuildAttempts(total => total + attemptsThisPass);
          setGrid(candidatePuzzle); setSolution(candidateSolution); setDifficulty(candidateDifficulty);
          setIsBuiltPuzzle(true);
          setWalkthroughIndex(0); setCopiedGrid(null); setElapsed(performance.now() - buildStartedAt.current);
          setIsBuilding(false);
          return;
        }
      }
      if (!cancelled) {
        setBuildAttempts(total => total + attemptsThisPass);
        nextAttempt = window.setTimeout(searchForPattern, 0);
      }
    };
    nextAttempt = window.setTimeout(searchForPattern, 0);
    return () => { cancelled = true; if (nextAttempt !== undefined) window.clearTimeout(nextAttempt); };
  }, [isBuilding, protectedCells, minimumDifficulty, maximumDifficulty, mode]);
  const loadPuzzle = () => {
    const text = puzzleInput.replaceAll(/\s/g, "");
    if (!/^[1-9.]{81}$/.test(text)) { setInputError("Enter exactly 81 digits or periods."); return; }
    const puzzle = Array.from({ length: 9 }, (_, row) => text.slice(row * 9, row * 9 + 9).split("").map(value => value === "." ? 0 : Number(value)));
    const solved = solveDiagonalGrid(puzzle);
    if (!solved || countDiagonalSolutions(puzzle) !== 1) { setInputError("This must be a valid diagonal sudoku with one solution."); return; }
    setMode("diagonal"); setGrid(puzzle); setSolution(solved); setDifficulty(rateDiagonalPuzzle(puzzle, solved));
    setElapsed(null); setWalkthroughIndex(0); setCopiedGrid(null); setInputError(null); setIsBuiltPuzzle(false);
  };
  const copyGrid = async (board: Grid, kind: "puzzle" | "solution") => {
    // Keep the export at exactly 81 characters; a period represents an empty cell.
    await navigator.clipboard.writeText(board.flat().map(value => value || ".").join(""));
    setCopiedGrid(kind);
  };
  const copyGridImage = async (
    board: Grid,
    kind: "puzzle-image" | "puzzle-image-download" | "solution-image" | "solution-image-download",
    filename: string,
    completed = false,
  ) => {
    const size = 900, cellSize = size / 9;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#ffffff"; context.fillRect(0, 0, size, size);
    context.strokeStyle = "#6b7280"; context.lineWidth = 1;
    for (let line = 1; line < 9; line += 1) {
      context.beginPath(); context.moveTo(line * cellSize, 0); context.lineTo(line * cellSize, size); context.stroke();
      context.beginPath(); context.moveTo(0, line * cellSize); context.lineTo(size, line * cellSize); context.stroke();
    }
    context.strokeStyle = "#111827"; context.lineWidth = 8;
    for (const line of [0, 3, 6, 9]) {
      context.beginPath(); context.moveTo(line * cellSize, 0); context.lineTo(line * cellSize, size); context.stroke();
      context.beginPath(); context.moveTo(0, line * cellSize); context.lineTo(size, line * cellSize); context.stroke();
    }
    if (showsDiagonalGuides) {
      context.strokeStyle = "#2563eb"; context.lineWidth = 5; context.setLineDash([14, 20]);
      context.beginPath(); context.moveTo(0, 0); context.lineTo(size, size); context.stroke();
      context.beginPath(); context.moveTo(size, 0); context.lineTo(0, size); context.stroke();
    }
    context.setLineDash([]); context.textAlign = "center"; context.textBaseline = "middle"; context.font = "600 58px Arial";
    board.flat().forEach((value, cell) => {
      if (!value) return;
      context.fillStyle = completed ? (grid.flat()[cell] ? "#111827" : "#2563eb") : "#111827";
      context.fillText(String(value), (cell % 9 + 0.5) * cellSize, (Math.floor(cell / 9) + 0.54) * cellSize);
    });
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopiedGrid(kind.endsWith("-download") ? kind.replace("-download", "") as "puzzle-image" | "solution-image" : kind);
      return;
    }
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl; link.download = filename; link.click();
    URL.revokeObjectURL(downloadUrl);
    setCopiedGrid(kind.endsWith("-download") ? kind : `${kind}-download` as "puzzle-image-download" | "solution-image-download");
  };
  const copySolutionImage = () => solution && copyGridImage(solution, "solution-image", "completed-sudoku.png", true);
  const descriptions: Record<Mode, string> = {
    diagonal: "Digits along the indicated diagonals cannot repeat.",
    "anti-diagonal": "Exactly three distinct numbers appear along each marked diagonal.",
    "one-of-each": "Digits along one diagonal cannot repeat, while digits along the other diagonal each appear three times. It is up to the solver to determine which diagonal follows which rule.",
    "double-diagonal": "Digits may not repeat along any of the four straight diagonal lines.",
    "bent-diagonal": "Each of the four bent diagonals must contain the digits 1-9.",
    "triple-diagonal": "Digits must not repeat along any marked diagonal.",
    queen: "9s cannot see each other along a diagonal.",
  };
  const modeOptions: { mode: Mode; label: string }[] = [
    { mode: "diagonal", label: "Diagonal" },
    { mode: "anti-diagonal", label: "Anti-diagonal" },
    { mode: "one-of-each", label: "One of each" },
    { mode: "double-diagonal", label: "Double Diagonal" },
    { mode: "bent-diagonal", label: "Bent diagonal" },
    { mode: "triple-diagonal", label: "Triple diagonal" },
    { mode: "queen", label: "Queen sudoku" },
  ];

  return (
    <main className="page">
      <style>{`.diagonal-guides line { stroke-width: 1.8 !important; stroke-dasharray: 1.5 2.4 !important; }`}</style>
      <header className="site-header">
        <h1>Diagonalize My Sudoku</h1>
      </header>
      <div className="app-layout">
        <aside className="mode-dashboard" aria-label="Puzzle modes">
          <p className="dashboard-title">Puzzle modes</p>
          <div className="mode-picker">
            {modeOptions.map(option => <div className="mode-card" key={option.mode}>
              <button className={mode === option.mode ? "active" : ""} onClick={() => selectMode(option.mode)}>
                <span>{option.label}</span>
                {mode === option.mode && <span className="mode-description">{descriptions[option.mode]}</span>}
              </button>
            </div>)}
          </div>
          <div className="dashboard-difficulty" role="group" aria-label="Required difficulty score range">
            <p className="dashboard-title">Build difficulty</p>
            <label>Minimum score
              <select value={minimumDifficulty} onChange={event => setMinimumDifficulty(event.target.value)} disabled={isBuilding}>
                <option value="0">0</option>
                <option value="500">500</option>
                <option value="600">600</option>
                <option value="800">800</option>
                <option value="1000">1000</option>
              </select>
            </label>
            <label>Maximum score
              <select value={maximumDifficulty} onChange={event => setMaximumDifficulty(event.target.value)} disabled={isBuilding}>
                <option value="500">500</option>
                <option value="1000">1000</option>
                <option value="2000">2000</option>
                <option value="10000">10000</option>
                <option value="100000">100000</option>
              </select>
            </label>
          </div>
          <label className="dashboard-digging-method">
            Digging method:
            <select value={diggingMethod} onChange={event => setDiggingMethod(event.target.value as DiggingMethod)} disabled={isBuilding}>
              <option value="single">Single cell digging</option>
              <option value="double">Double cell digging</option>
            </select>
          </label>
        </aside>
        <div className="workspace">
      <div className="puzzle-actions">
        <button className="generate-button" onClick={generate} disabled={isBuilding}>Generate a grid</button>
        <button className="generate-button build-button" onClick={buildPuzzle} disabled={isBuilding}>Build a puzzle</button>
        <button className="halt-button" onClick={haltBuilding} disabled={!isBuilding}>Halt building puzzle</button>
      </div>
      <section className="puzzle-builder" aria-label="Build a puzzle">
        <div className="builder-heading">
          <h2>Build a puzzle</h2>
          <button className="builder-caret" type="button" onClick={() => setIsBuilderExpanded(expanded => !expanded)} aria-expanded={isBuilderExpanded} aria-label={`${isBuilderExpanded ? "Hide" : "Show"} Build a puzzle settings`}>{isBuilderExpanded ? "⌃" : "⌄"}</button>
        </div>
        {isBuilderExpanded && <>
        <p>Select the positions that must be givens. Green cells are the complete clue pattern: every other cell will be blank in the finished puzzle.</p>
        <p className="builder-count">{protectedCells.filter(Boolean).length} protected givens</p>
        <p className="difficulty-range-note">{mode === "anti-diagonal"
          ? "The builder keeps trying until the exact clue pattern has one Anti-diagonal solution. Its score uses standard Sudoku techniques without treating either repeating diagonal as a no-repeat house."
          : "The builder keeps trying until the exact clue pattern has one solution and its score falls within this range."}</p>
        <div className="grid-frame builder-frame">
          {showsDiagonalGuides && <svg className="diagonal-guides" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <line x1="0" y1="0" x2="50" y2="50" /><line x1="100" y1="100" x2="50" y2="50" />
            <line x1="100" y1="0" x2="50" y2="50" /><line x1="0" y1="100" x2="50" y2="50" />
          </svg>}
          <div className="grid builder-grid" aria-label="Select required givens">
            {protectedCells.map((selected, cell) => <button className={`cell builder-cell ${selected ? "protected" : ""}`} aria-pressed={selected} aria-label={`${selected ? "Keep" : "Allow removal of"} row ${Math.floor(cell / 9) + 1}, column ${cell % 9 + 1}`} key={cell} onClick={() => toggleProtectedCell(cell)} disabled={isBuilding}>{selected ? "•" : ""}</button>)}
          </div>
        </div>
        <div className="builder-actions">
          <button className="copy-grid-button" onClick={() => setProtectedCells(Array(81).fill(true))} disabled={isBuilding}>Select all</button>
          <button className="copy-grid-button" onClick={() => setProtectedCells(Array(81).fill(false))} disabled={isBuilding}>Clear selection</button>
        </div>
        {isBuilding && <p className="builder-status" role="status">Building from this exact pattern · {buildAttempts} completed grids tested.</p>}
        {builderError && <p className="builder-error" role="alert">{builderError}</p>}
        </>}
      </section>
      {mode === "queen" && <section className="queen-simulation" aria-label="Queen Sudoku simulation">
        <h2>Simulation</h2>
        <p>Run repeated Queen Sudoku generations using single cell digging only.</p>
        <div className="simulation-actions">
          <label htmlFor="simulation-trials">Trials
            <input id="simulation-trials" type="number" min="1" max="10000" step="1" value={simulationTrials} onChange={event => setSimulationTrials(event.target.value)} disabled={isSimulating} />
          </label>
          <button className="generate-button" onClick={runQueenSimulation} disabled={isSimulating}>Run simulation</button>
          <button className="halt-button" onClick={() => { simulationCancelled.current = true; }} disabled={!isSimulating}>Halt simulation</button>
        </div>
        {completedSimulationTrials > 0 && (() => {
          const bins = Object.entries(simulationTally).map(([givens, tally]) => ({ givens: Number(givens), tally })).sort((first, second) => first.givens - second.givens);
          const maximum = Math.max(...bins.map(bin => bin.tally), 1);
          return <div className="simulation-chart" aria-label="Histogram of empirical tally by number of given cells">
            <div className="simulation-y-axis"><strong>Empirical tally</strong><span>{maximum}</span><span>0</span></div>
            <div className="simulation-plot">
              <div className="simulation-bars">{bins.map(bin => <div className="simulation-bar-column" key={bin.givens}>
                <span className="simulation-bar-value">{bin.tally}</span>
                <div className="simulation-bar" style={{ height: `${Math.max(4, (bin.tally / maximum) * 100)}%` }} />
                <span className="simulation-bin-label">{bin.givens}</span>
              </div>)}</div>
              <strong className="simulation-x-axis">Number of given cells</strong>
            </div>
            <p className="simulation-progress">{completedSimulationTrials} of {simulationTrials} trials complete{isSimulating ? "…" : "."}</p>
          </div>;
        })()}
      </section>}
      <div className={`puzzle-output ${solution && difficulty ? "puzzle-output-built" : ""}`}>
        <div className="puzzle-display">
          <div className="grid-frame">
            {showsDiagonalGuides && <svg className="diagonal-guides" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <line x1="0" y1="0" x2="50" y2="50" /><line x1="100" y1="100" x2="50" y2="50" />
              <line x1="100" y1="0" x2="50" y2="50" /><line x1="0" y1="100" x2="50" y2="50" />
            </svg>}
            <div className="grid" aria-label="9 by 9 sudoku grid">
              {grid.flatMap((row, rowIndex) => row.map((value, columnIndex) => <div className="cell" key={`${rowIndex}-${columnIndex}`}>{value || ""}</div>))}
            </div>
          </div>
          <div className="grid-copy-actions">
            <button className="copy-grid-button" onClick={() => copyGrid(grid, "puzzle")} disabled={!grid.flat().some(Boolean)}>
              {copiedGrid === "puzzle" ? "Copied 81 cells" : isBuiltPuzzle ? "Copy built 81-cell puzzle" : "Copy 81-cell grid"}
            </button>
            <button className="copy-grid-button" onClick={() => copyGridImage(grid, "puzzle-image", "sudoku-grid.png")} disabled={!grid.flat().some(Boolean)}>
              {copiedGrid === "puzzle-image" ? "Copied grid image" : copiedGrid === "puzzle-image-download" ? "Downloaded grid image" : "Copy grid image"}
            </button>
          </div>
        </div>
        {solution && difficulty && <aside className="built-difficulty-panel" aria-label="Puzzle difficulty and technique tally">
          <h2>Difficulty rating</h2>
          <p>{grid.flat().filter(Boolean).length} givens · {difficulty.rating} ({difficulty.score}) · {(elapsed ?? 0).toFixed(0)} ms</p>
          <div className="technique-tally">
            <h2>Technique tally</h2>
            <table>
              <thead><tr><th>Technique</th><th>Used in steps</th></tr></thead>
              <tbody>{Object.entries(difficulty.tally).sort(([first], [second]) =>
                (sudokUiTechniqueDifficulty[first] ?? Number.MAX_SAFE_INTEGER) - (sudokUiTechniqueDifficulty[second] ?? Number.MAX_SAFE_INTEGER)
                || first.localeCompare(second),
              ).map(([technique]) => {
                const usedSteps = difficulty.walkthrough.slice(1).flatMap((step, index) => step.technique === technique ? [index + 1] : []);
                return <tr key={technique}><td>{technique}</td><td>{usedSteps.join(", ")}</td></tr>;
              })}</tbody>
            </table>
          </div>
          <p className="difficulty-note">{difficulty.logical ? "Solved with the adapted sudokUI logical technique path." : "Includes sudokUI’s Brute Force last resort (+10,000 per step), so totals above 10,000 are valid."}</p>
        </aside>}
      </div>
      <section className="puzzle-loader">
        <label htmlFor="puzzle-input">Load an 81-cell diagonal puzzle</label>
        <textarea id="puzzle-input" value={puzzleInput} onChange={event => setPuzzleInput(event.target.value)} placeholder="Use digits 1–9 and . for blanks" rows={3} />
        <button className="copy-grid-button" onClick={loadPuzzle}>Load grid</button>
        {inputError && <p role="alert">{inputError}</p>}
      </section>
      {solution && <section className="dig-results">
        {difficulty && difficulty.walkthrough.length > 0 && (() => {
          const step = difficulty.walkthrough[walkthroughIndex];
          return <section className="walkthrough" aria-label="Interactive solution walkthrough">
            <h2>Solution walkthrough</h2>
            <div className="walkthrough-layout">
              <div className="grid-frame walkthrough-frame">
                {showsDiagonalGuides && <svg className="diagonal-guides" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <line className={step.highlightedDiagonals.includes(27) ? "diagonal-active" : ""} x1="0" y1="0" x2="50" y2="50" /><line className={step.highlightedDiagonals.includes(27) ? "diagonal-active" : ""} x1="100" y1="100" x2="50" y2="50" />
                  <line className={step.highlightedDiagonals.includes(28) ? "diagonal-active" : ""} x1="100" y1="0" x2="50" y2="50" /><line className={step.highlightedDiagonals.includes(28) ? "diagonal-active" : ""} x1="0" y1="100" x2="50" y2="50" />
                </svg>}
                <div className="grid walkthrough-grid" aria-label={`Board after ${step.technique}`}>
                  {step.values.map((value, cell) => <div className={`cell ${step.affectedCells.includes(cell) ? "walkthrough-focus" : ""}`} key={cell}>
                    {value ? <span className={difficulty.givens[cell] ? "" : "walkthrough-placed"}>{value}</span> : <div className="snyder-notes" aria-label={`Candidates for row ${Math.floor(cell / 9) + 1}, column ${cell % 9 + 1}`}>
                      {Array.from({ length: 9 }, (_, index) => index + 1).map(digit => {
                        const available = Boolean(step.candidates[cell] & (1 << (digit - 1)));
                        // Cross-outs document this step's eliminations only.
                        // On the following step they disappear with the removed candidate.
                        const removed = step.removed.some(item => item.cell === cell && item.digit === digit);
                        const involved = step.involved.some(item => item.cell === cell && item.digit === digit);
                        return <span className={`snyder-digit ${removed ? "removed" : involved ? "involved" : ""}`} key={digit}>{available || removed ? digit : ""}</span>;
                      })}
                    </div>}
                  </div>)}
                </div>
              </div>
              <aside className="walkthrough-details">
                <p className="walkthrough-step">Step {walkthroughIndex} of {difficulty.walkthrough.length - 1} · <strong>{step.technique}</strong></p>
                <p className="walkthrough-message">{step.message}</p>
              </aside>
            </div>
            <div className="walkthrough-controls">
              <button aria-label="Go to step 0" title="Go to step 0" onClick={() => setWalkthroughIndex(0)} disabled={walkthroughIndex === 0}>&lt;&lt;</button>
              <button aria-label="Previous step" title="Previous step" onClick={() => setWalkthroughIndex(index => Math.max(0, index - 1))} disabled={walkthroughIndex === 0}>&lt;</button>
              <button aria-label="Next step" title="Next step" onClick={() => setWalkthroughIndex(index => Math.min(difficulty.walkthrough.length - 1, index + 1))} disabled={walkthroughIndex === difficulty.walkthrough.length - 1}>&gt;</button>
              <button aria-label="Go to last step" title="Go to last step" onClick={() => setWalkthroughIndex(difficulty.walkthrough.length - 1)} disabled={walkthroughIndex === difficulty.walkthrough.length - 1}>&gt;&gt;</button>
            </div>
          </section>;
        })()}
        <h2>Completed grid</h2>
        <div className="grid-frame">
          {showsDiagonalGuides && <svg className="diagonal-guides" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <line x1="0" y1="0" x2="50" y2="50" /><line x1="100" y1="100" x2="50" y2="50" />
            <line x1="100" y1="0" x2="50" y2="50" /><line x1="0" y1="100" x2="50" y2="50" />
          </svg>}
          <div className="grid solution-grid" aria-label="Completed sudoku grid">
            {solution.flatMap((row, rowIndex) => row.map((value, columnIndex) => <div className={grid[rowIndex][columnIndex] ? "cell given" : "cell solved"} key={`${rowIndex}-${columnIndex}`}>{value}</div>))}
          </div>
        </div>
        <div className="solution-copy-actions">
          <button className="copy-grid-button" onClick={() => copyGrid(solution, "solution")}>
            {copiedGrid === "solution" ? "Copied 81-cell text" : "Copy 81-cell text"}
          </button>
          <button className="copy-grid-button" onClick={copySolutionImage}>
            {copiedGrid === "solution-image" ? "Copied grid image" : copiedGrid === "solution-image-download" ? "Downloaded grid image" : "Copy grid image"}
          </button>
        </div>
      </section>}
        </div>
      </div>
    </main>
  );
}
