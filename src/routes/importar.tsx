import { createFileRoute } from "@tanstack/react-router";
import { ImportPage } from "@/components/pharmacy/import";
import { pageHead } from "@/lib/pharmacy/metadata";
export const Route = createFileRoute("/importar")({
  head: () =>
    pageHead(
      "Importar Planilha",
      "Importe planilhas Excel com validação e mapeamento das colunas.",
    ),
  component: ImportPage,
});
