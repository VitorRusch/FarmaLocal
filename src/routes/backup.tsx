import { createFileRoute } from "@tanstack/react-router";
import { BackupPage } from "@/components/pharmacy/files";
import { pageHead } from "@/lib/pharmacy/metadata";
export const Route = createFileRoute("/backup")({
  head: () =>
    pageHead(
      "Backup e Restauração",
      "Crie e restaure backups locais seguros dos dados da farmácia.",
    ),
  component: BackupPage,
});
