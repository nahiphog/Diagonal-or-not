import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Diagonalize My Sudoku",
  description: "Generate diagonal and anti-diagonal sudoku grids.",
  other: { "codex-preview": "development" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="antialiased">{children}</body></html>;
}
