import { createFileRoute } from "@tanstack/react-router";
import { ExportPage } from "@/components/pharmacy/files";
import { pageHead } from "@/lib/pharmacy/metadata";
export const Route = createFileRoute("/exportar")({
  head: () =>
    pageHead("Exportar Dados", "Exporte o estoque completo e o histórico para um arquivo Excel."),
  component: ExportPage,
});
