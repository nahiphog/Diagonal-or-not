import { notFound } from "next/navigation";
import Home, { Mode } from "../page";

const pathModes: Record<string, Mode> = {
  diagonal: "diagonal",
  anti_diagonal: "anti-diagonal",
  one_of_each: "one-of-each",
  double_diagonal: "double-diagonal",
  bent_diagonal: "bent-diagonal",
  triple_diagonal: "triple-diagonal",
  queen_sudoku: "queen",
};

export default async function PuzzleModePage({ params }: { params: Promise<{ mode: string }> }) {
  const { mode } = await params;
  const puzzleMode = pathModes[mode];
  if (!puzzleMode) notFound();
  return <Home initialMode={puzzleMode} />;
}
