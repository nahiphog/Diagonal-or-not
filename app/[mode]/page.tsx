import { notFound } from "next/navigation";
import Home, { QueenSubpage } from "../../page";

const queenSections: Record<string, QueenSubpage> = {
  randomly_generate: "randomly-generate",
  custom_build: "custom-build",
  import_grid: "import-grid",
  simulation: "simulation",
};

export default async function QueenSudokuSectionPage({ params }: { params: Promise<{ mode: string; section: string }> }) {
  const { mode, section } = await params;
  const queenSubpage = mode === "queen_sudoku" ? queenSections[section] : undefined;
  if (!queenSubpage) notFound();
  return <Home initialMode="queen" initialQueenSubpage={queenSubpage} />;
}
