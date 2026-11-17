import { createFileRoute } from "@tanstack/react-router";
import { Inventory } from "@/components/pharmacy/inventory";
import { pageHead } from "@/lib/pharmacy/metadata";
export const Route = createFileRoute("/estoque")({
  head: () =>
    pageHead(
      "Estoque de Medicamentos",
      "Cadastro, consulta e controle de medicamentos da farmácia.",
    ),
  component: Inventory,
});
