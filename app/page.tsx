"use client";

import { useState } from "react";

type Grid = number[][];
type Mode = "diagonal" | "anti-diagonal" | "one-of-each";
type DiggingMethod = "single" | "double";
type CandidateRemoval = { cell: number; digit: number };
type WalkthroughStep = { technique: string; values: number[]; candidates: number[]; affectedCells: number[]; placedCells: number[]; removed: CandidateRemoval[]; message: string };
type DifficultyRating = { rating: string; score: number; techniques: string[]; logical: boolean; walkthrough: WalkthroughStep[]; tally: Record<string, number> };
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

// This is a GPL-3.0 adaptation of sudokUI's board/rating approach.
// Source: https://github.com/AImenes/sudokUI (board.ts, ratings.ts and its
// human solver).  It adds the two X-Sudoku units to the board model.  As in
// sudokUI, a score is the sum of the techniques in the solve path; Brute Force
// is a legitimate last-resort technique worth 10,000 points, not a score cap.
function rateDiagonalPuzzle(startGrid: Grid): DifficultyRating {
  const values = startGrid.flat();
  const units = [
    ...Array.from({ length: 9 }, (_, row) => Array.from({ length: 9 }, (_, column) => row * 9 + column)),
    ...Array.from({ length: 9 }, (_, column) => Array.from({ length: 9 }, (_, row) => row * 9 + column)),
    ...Array.from({ length: 9 }, (_, box) => {
      const boxRow = Math.floor(box / 3) * 3, boxColumn = (box % 3) * 3;
      return Array.from({ length: 9 }, (_, cell) => (boxRow + Math.floor(cell / 3)) * 9 + boxColumn + (cell % 3));
    }),
    Array.from({ length: 9 }, (_, index) => index * 10),
    Array.from({ length: 9 }, (_, index) => (index + 1) * 8),
  ];
  const unitsFor = Array.from({ length: 81 }, (_, index) => units.map((unit, unitIndex) => unit.includes(index) ? unitIndex : -1).filter(unit => unit >= 0));
  const peers = Array.from({ length: 81 }, (_, index) => [...new Set(unitsFor[index].flatMap(unit => units[unit]))].filter(cell => cell !== index));
  const candidates = Array.from({ length: 81 }, (_, index) => {
    if (values[index]) return 0;
    const used = new Set(peers[index].map(cell => values[cell]).filter(Boolean));
    return Array.from({ length: 9 }, (_, offset) => offset + 1).filter(digit => !used.has(digit)).reduce((mask, digit) => mask | (1 << (digit - 1)), 0);
  });
  const digits = (mask: number) => Array.from({ length: 9 }, (_, offset) => offset + 1).filter(digit => mask & (1 << (digit - 1)));
  const popcount = (mask: number) => digits(mask).length;
  const steps: string[] = [];
  const walkthrough: WalkthroughStep[] = [];
  const place = (cell: number, digit: number) => {
    values[cell] = digit; candidates[cell] = 0;
    const mask = ~(1 << (digit - 1));
    peers[cell].forEach(peer => { candidates[peer] &= mask; });
  };
  const eliminate = (items: Array<[number, number]>) => items.forEach(([cell, digit]) => { candidates[cell] &= ~(1 << (digit - 1)); });
  const combinations = <T,>(items: T[], size: number): T[][] => {
    if (size === 0) return [[]];
    if (items.length < size) return [];
    return items.flatMap((item, index) => combinations(items.slice(index + 1), size - 1).map(rest => [item, ...rest]));
  };
  const add = (name: string, action: () => void) => {
    const beforeValues = [...values];
    const beforeCandidates = [...candidates];
    action();
    const placed = values.map((value, cell) => value && value !== beforeValues[cell] ? cell : -1).filter(cell => cell >= 0);
    const removed = beforeCandidates.flatMap((mask, cell) =>
      placed.includes(cell) ? [] : digits(mask & ~candidates[cell]).map(digit => ({ cell, digit })),
    );
    const affectedCells = [...new Set([...placed, ...removed.map(item => item.cell)])];
    const placedNames = placed.map(cell => `R${Math.floor(cell / 9) + 1}C${cell % 9 + 1}`);
    const removedNames = [...new Set(removed.map(item => `R${Math.floor(item.cell / 9) + 1}C${item.cell % 9 + 1}`))];
    const message = placed.length
      ? `Placed ${placed.map(cell => values[cell]).join(", ")} in ${placedNames.join(", ")}.`
      : `Eliminated candidates in ${removedNames.join(", ")}.`;
    steps.push(name);
    walkthrough.push({ technique: name, values: [...values], candidates: [...candidates], affectedCells, placedCells: placed, removed, message });
  };

  walkthrough.push({
    technique: "Starting position",
    values: [...values],
    candidates: [...candidates],
    affectedCells: [],
    placedCells: [],
    removed: [],
    message: "Starting board with all available Snyder notations.",
  });

  // This matches sudokUI's order for these applicable techniques, while each
  // finder uses 29 units so diagonal deductions are included as well.
  while (values.some(value => !value)) {
    let moveMade = false;
    for (let unitIndex = 0; unitIndex < units.length && !moveMade; unitIndex++) {
      const blank = units[unitIndex].filter(cell => !values[cell]);
      if (blank.length === 1 && candidates[blank[0]]) { add("Full House", () => place(blank[0], digits(candidates[blank[0]])[0])); moveMade = true; }
    }
    if (moveMade) continue;
    const naked = values.findIndex((value, cell) => !value && popcount(candidates[cell]) === 1);
    if (naked >= 0) { add("Naked Single", () => place(naked, digits(candidates[naked])[0])); continue; }
    for (const unit of units) {
      for (let digit = 1; digit <= 9; digit++) {
        const locations = unit.filter(cell => !values[cell] && (candidates[cell] & (1 << (digit - 1))));
        if (locations.length === 1) { add("Hidden Single", () => place(locations[0], digit)); moveMade = true; break; }
      }
      if (moveMade) break;
    }
    if (moveMade) continue;

    // Pointing and claiming are sudokUI's two Locked Candidates techniques.
    for (let box = 18; box < 27 && !moveMade; box++) for (let digit = 1; digit <= 9 && !moveMade; digit++) {
      const bit = 1 << (digit - 1), locations = units[box].filter(cell => !values[cell] && candidates[cell] & bit);
      for (const line of [0, 1]) {
        const group = locations.map(cell => line ? Math.floor(cell / 9) : cell % 9);
        if (group.length > 1 && new Set(group).size === 1) {
          const lineUnit = line ? group[0] : 9 + group[0];
          const targets = units[lineUnit].filter(cell => !units[box].includes(cell) && !values[cell] && candidates[cell] & bit);
          if (targets.length) { add("Locked Candidates (Pointing)", () => eliminate(targets.map(cell => [cell, digit]))); moveMade = true; }
        }
      }
    }
    if (moveMade) continue;
    for (let line = 0; line < 18 && !moveMade; line++) for (let digit = 1; digit <= 9 && !moveMade; digit++) {
      const bit = 1 << (digit - 1), locations = units[line].filter(cell => !values[cell] && candidates[cell] & bit);
      const boxes = locations.map(cell => 18 + Math.floor(Math.floor(cell / 9) / 3) * 3 + Math.floor((cell % 9) / 3));
      if (locations.length > 1 && new Set(boxes).size === 1) {
        const targets = units[boxes[0]].filter(cell => !units[line].includes(cell) && !values[cell] && candidates[cell] & bit);
        if (targets.length) { add("Locked Candidates (Claiming)", () => eliminate(targets.map(cell => [cell, digit]))); moveMade = true; }
      }
    }
    if (moveMade) continue;

    for (const size of [2, 3, 4]) for (let unitIndex = 0; unitIndex < units.length && !moveMade; unitIndex++) {
      const cells = units[unitIndex].filter(cell => !values[cell] && popcount(candidates[cell]) <= size);
      for (const group of combinations(cells, size)) {
        const mask = group.reduce((total, cell) => total | candidates[cell], 0);
        if (popcount(mask) !== size) continue;
        const targets = units[unitIndex].filter(cell => !group.includes(cell) && !values[cell]).flatMap(cell => digits(candidates[cell] & mask).map(digit => [cell, digit] as [number, number]));
        if (targets.length) { add(`Naked ${["", "", "Pair", "Triple", "Quadruple"][size]}`, () => eliminate(targets)); moveMade = true; break; }
      }
    }
    if (moveMade) continue;
    for (const size of [2, 3, 4]) for (const unit of units) {
      const empty = unit.filter(cell => !values[cell]);
      for (const digitGroup of combinations(Array.from({ length: 9 }, (_, index) => index + 1), size)) {
        const mask = digitGroup.reduce((total, digit) => total | (1 << (digit - 1)), 0);
        const cells = empty.filter(cell => candidates[cell] & mask);
        const targets = cells.flatMap(cell => digits(candidates[cell] & ~mask).map(digit => [cell, digit] as [number, number]));
        if (cells.length === size && targets.length) { add(`Hidden ${["", "", "Pair", "Triple", "Quadruple"][size]}`, () => eliminate(targets)); moveMade = true; break; }
      }
      if (moveMade) break;
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
        if (targets.length) { add(["", "", "X-Wing", "Swordfish", "Jellyfish"][size], () => eliminate(targets)); moveMade = true; break; }
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
        const options = Array.from({ length: 9 }, (_, offset) => offset + 1).filter(digit => !used.has(digit));
        if (!options.length) return false;
        if (best < 0 || options.length < bestOptions.length) { best = index; bestOptions = options; }
      }
      if (best < 0) return true;
      for (const digit of bestOptions) { draft[best] = digit; if (solveFromHere()) return true; draft[best] = 0; }
      return false;
    };
    if (cell < 0 || !solveFromHere()) break;
    add("Brute Force", () => place(cell, draft[cell]));
  }

  const scores: Record<string, number> = { "Full House": 4, "Naked Single": 4, "Hidden Single": 14, "Locked Candidates (Pointing)": 50, "Locked Candidates (Claiming)": 50, "Naked Pair": 60, "Naked Triple": 80, "Hidden Pair": 70, "Hidden Triple": 100, "Naked Quadruple": 120, "Hidden Quadruple": 150, "X-Wing": 140, "Swordfish": 150, "Jellyfish": 160, "Brute Force": 10000 };
  const levels: Record<string, string> = { "Full House": "Beginner", "Naked Single": "Beginner", "Hidden Single": "Beginner", "Locked Candidates (Pointing)": "Medium", "Locked Candidates (Claiming)": "Medium", "Naked Pair": "Medium", "Naked Triple": "Medium", "Hidden Pair": "Medium", "Hidden Triple": "Medium", "Naked Quadruple": "Hard", "Hidden Quadruple": "Hard", "X-Wing": "Hard", "Swordfish": "Hard", "Jellyfish": "Hard", "Brute Force": "Extreme" };
  const order = ["Beginner", "Easy", "Medium", "Tricky", "Hard", "Unfair", "Extreme", "Nightmare"];
  const maxScore: Record<string, number> = { Beginner: 400, Easy: 800, Medium: 1000, Tricky: 1150, Hard: 1600, Unfair: 1800, Extreme: 3000, Nightmare: Number.MAX_SAFE_INTEGER };
  const score = steps.reduce((total, step) => total + scores[step], 0);
  let rating = steps.reduce((hardest, step) => order.indexOf(levels[step]) > order.indexOf(hardest) ? levels[step] : hardest, "Beginner");
  while (order.indexOf(rating) < order.length - 1 && score > maxScore[rating]) rating = order[order.indexOf(rating) + 1];
  const tally = steps.reduce<Record<string, number>>((counts, step) => ({ ...counts, [step]: (counts[step] ?? 0) + 1 }), {});
  return { rating, score, techniques: [...new Set(steps)], logical: !steps.includes("Brute Force"), walkthrough, tally };
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
  const [difficulty, setDifficulty] = useState<DifficultyRating | null>(null);
  const [walkthroughIndex, setWalkthroughIndex] = useState(0);
  const generate = () => {
    const started = performance.now();
    if (mode === "diagonal") {
      const dug = digDiagonal(diggingMethod);
      setGrid(dug.puzzle); setSolution(dug.solution);
      setDifficulty(rateDiagonalPuzzle(dug.puzzle));
    } else { setGrid(generateGrid(mode)); setSolution(null); setDifficulty(null); }
    setWalkthroughIndex(0);
    setElapsed(performance.now() - started);
  };
  const selectMode = (nextMode: Mode) => { setMode(nextMode); setGrid(emptyGrid()); setSolution(null); setElapsed(null); setDifficulty(null); setWalkthroughIndex(0); };
  const descriptions: Record<Mode, string> = {
    diagonal: "Normal Sudoku rules apply. Digits along the indicated diagonals cannot repeat.",
    "anti-diagonal": "Normal Sudoku rules apply. Exactly three distinct numbers appear along each marked diagonal.",
    "one-of-each": "Normal Sudoku rules apply. Digits along one diagonal cannot repeat, while digits along the other diagonal each appear three times. It is up to the solver to determine which diagonal follows which rule.",
  };

  return (
    <main className="page">
      <style>{`.diagonal-guides line { stroke-width: 1.8 !important; stroke-dasharray: 1.5 2.4 !important; }`}</style>
      <h1>Diagonalize My Sudoku</h1>
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
        <p>{grid.flat().filter(Boolean).length} givens · Difficulty: {difficulty?.rating ?? "Unrated"} ({difficulty?.score ?? 0}) · {(elapsed ?? 0).toFixed(0)} ms</p>
        {difficulty && <div className="technique-tally">
          <h2>Technique tally</h2>
          <table>
            <thead><tr><th>Technique</th><th>Used in steps</th></tr></thead>
            <tbody>{Object.entries(difficulty.tally).map(([technique]) => {
              const usedSteps = difficulty.walkthrough.slice(1).flatMap((step, index) => step.technique === technique ? [index + 1] : []);
              return <tr key={technique}><td>{technique}</td><td>{usedSteps.join(", ")}</td></tr>;
            })}</tbody>
          </table>
        </div>}
        {difficulty && <p className="difficulty-note">{difficulty.logical ? "Solved with the adapted sudokUI logical technique path." : "Includes sudokUI’s Brute Force last resort (+10,000 per step), so totals above 10,000 are valid."}</p>}
        {difficulty && difficulty.walkthrough.length > 0 && (() => {
          const step = difficulty.walkthrough[walkthroughIndex];
          return <section className="walkthrough" aria-label="Interactive solution walkthrough">
            <h2>Solution walkthrough</h2>
            <div className="grid-frame walkthrough-frame">
              <svg className="diagonal-guides" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <line x1="0" y1="0" x2="50" y2="50" /><line x1="100" y1="100" x2="50" y2="50" />
                <line x1="100" y1="0" x2="50" y2="50" /><line x1="0" y1="100" x2="50" y2="50" />
              </svg>
              <div className="grid walkthrough-grid" aria-label={`Board after ${step.technique}`}>
                {step.values.map((value, cell) => <div className={`cell ${step.affectedCells.includes(cell) ? "walkthrough-focus" : ""} ${step.placedCells.includes(cell) ? "walkthrough-placed" : ""}`} key={cell}>
                  {value || <div className="snyder-notes" aria-label={`Candidates for row ${Math.floor(cell / 9) + 1}, column ${cell % 9 + 1}`}>
                    {Array.from({ length: 9 }, (_, index) => index + 1).map(digit => {
                      const removed = step.removed.some(item => item.cell === cell && item.digit === digit);
                      const available = Boolean(step.candidates[cell] & (1 << (digit - 1)));
                      return <span className={removed ? "snyder-digit removed" : "snyder-digit"} key={digit}>{available || removed ? digit : ""}</span>;
                    })}
                  </div>}
                </div>)}
              </div>
            </div>
            <p className="walkthrough-step">Step {walkthroughIndex} of {difficulty.walkthrough.length - 1} · <strong>{step.technique}</strong></p>
            <p className="walkthrough-message">{step.message}{step.removed.length > 0 ? ` ${step.removed.length} Snyder notation${step.removed.length === 1 ? "" : "s"} removed in red.` : ""}</p>
            <div className="walkthrough-controls">
              <button onClick={() => setWalkthroughIndex(index => Math.max(0, index - 1))} disabled={walkthroughIndex === 0}>Previous</button>
              <button onClick={() => setWalkthroughIndex(index => Math.min(difficulty.walkthrough.length - 1, index + 1))} disabled={walkthroughIndex === difficulty.walkthrough.length - 1}>Next</button>
            </div>
          </section>;
        })()}
        <h2>Completed grid</h2>
        <div className="grid solution-grid" aria-label="Completed sudoku grid">
          {solution.flatMap((row, rowIndex) => row.map((value, columnIndex) => <div className={grid[rowIndex][columnIndex] ? "cell given" : "cell solved"} key={`${rowIndex}-${columnIndex}`}>{value}</div>))}
        </div>
      </section>}
    </main>
  );
}
