import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/pharmacy/dashboard";
import { pageHead } from "@/lib/pharmacy/metadata";
export const Route = createFileRoute("/")({
  head: () =>
    pageHead(
      "Visão Geral",
      "Controle local do estoque da farmácia hospitalar, alertas e movimentações.",
    ),
  component: Dashboard,
});
