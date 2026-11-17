import { createFileRoute } from "@tanstack/react-router";
import { History } from "@/components/pharmacy/history";
import { pageHead } from "@/lib/pharmacy/metadata";
export const Route = createFileRoute("/movimentacoes")({
  head: () =>
    pageHead("Movimentações", "Histórico local de entradas, saídas, ajustes e reconciliações."),
  component: History,
});
