import { useRef, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Database,
  Download,
  FileSpreadsheet,
  ShieldCheck,
  Upload,
  Sparkles,
  Trash2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInventory } from "./store";
import { PageHeading, Notice, num, dateLabel, LoadingState } from "./shared";
import { Confirmation, perform } from "./forms";
import { exportStock, downloadJson } from "@/lib/pharmacy/excel";
import {
  createBackup,
  validateBackup,
  restoreBackup,
  addSamples,
  clearSamples,
  type Backup,
} from "@/lib/pharmacy/database";
export function ExportPage() {
  const { meds, moves, ready, error } = useInventory();
  return (
    <>
      <PageHeading
        eyebrow="DADOS DA FARMÁCIA"
        title="Exportar Dados"
        description="Uma cópia completa do estoque e do histórico em Excel."
      />
      <LoadingState ready={ready} error={error} />
      <section className="export-section">
        <div className="file-feature-icon">
          <FileSpreadsheet size={38} />
        </div>
        <div>
          <h2>Relatório completo da farmácia</h2>
          <p>Arquivo Excel com todos os registros, inclusive os itens inativos.</p>
          <div className="export-sheets">
            {[
              ["Estoque Atual", `${num(meds.length)} medicamentos`],
              ["Histórico de Movimentações", `${num(moves.length)} registros`],
              ["Resumo", "Indicadores gerais do estoque"],
            ].map(([name, description]) => (
              <div key={name}>
                <Check size={18} />
                <div>
                  <strong>{name}</strong>
                  <small>{description}</small>
                </div>
              </div>
            ))}
          </div>
          <Button
            disabled={!ready || !!error}
            onClick={() => {
              try {
                exportStock(
                  meds,
                  moves,
                  `farmacia_hospitalar_estoque_${format(new Date(), "yyyy-MM-dd")}.xlsx`,
                );
                toast.success("Arquivo Excel exportado.");
              } catch {
                toast.error("Não foi possível gerar o arquivo.");
              }
            }}
          >
            <Download />
            Exportar arquivo Excel
          </Button>
        </div>
      </section>
      <Notice>
        O Excel é uma cópia para consulta. Para guardar todos os dados e restaurá-los depois, use o
        backup JSON.
      </Notice>
    </>
  );
}
export function BackupPage() {
  const { meds, moves, ready, error } = useInventory();
  const [backup, setBackup] = useState<Backup | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [samples, setSamples] = useState<"add" | "clear" | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <PageHeading
        eyebrow="SEGURANÇA DOS DADOS"
        title="Backup e Restauração"
        description="Proteja o estoque e mantenha uma cópia segura dos seus registros."
      />
      <LoadingState ready={ready} error={error} />
      <Notice tone="warning">
        <strong>Seus dados ficam neste navegador e computador.</strong>
        <p>
          Limpar os dados do navegador pode apagar seu estoque. Faça backups periódicos e guarde o
          arquivo em um local seguro.
        </p>
      </Notice>
      <section className="backup-layout">
        <div className="backup-section">
          <span className="file-feature-icon">
            <Database size={30} />
          </span>
          <h2>Criar backup</h2>
          <p>Salve medicamentos, movimentações e configurações em um único arquivo JSON.</p>
          <div className="backup-count">
            <span>{num(meds.length)} medicamentos</span>
            <span>{num(moves.length)} movimentações</span>
          </div>
          <Button
            disabled={!ready || !!error}
            onClick={() =>
              void perform(
                async () =>
                  downloadJson(
                    await createBackup(),
                    `farmacia_backup_${format(new Date(), "yyyy-MM-dd_HH-mm")}.json`,
                  ),
                "Backup criado com sucesso.",
              )
            }
          >
            <Download />
            Baixar backup completo
          </Button>
        </div>
        <div className="backup-section">
          <span className="file-feature-icon">
            <Upload size={30} />
          </span>
          <h2>Restaurar backup</h2>
          <p>
            Recupere os dados a partir de um backup do FarmaLocal. A restauração substitui o estoque
            atual.
          </p>
          <input
            type="file"
            accept=".json"
            ref={ref}
            className="hidden"
            aria-label="Arquivo de backup"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f)
                try {
                  setBackup(validateBackup(JSON.parse(await f.text())));
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Arquivo JSON inválido.");
                }
              e.target.value = "";
            }}
          />
          <Button variant="outline" onClick={() => ref.current?.click()}>
            <Upload />
            Selecionar backup
          </Button>
          {backup && (
            <div className="restore-preview">
              <strong>Backup de {dateLabel(backup.createdAt)}</strong>
              <p>
                {backup.data.medications.length} medicamentos · {backup.data.movements.length}{" "}
                movimentações
              </p>
              <Button variant="destructive" onClick={() => setConfirm(true)}>
                Restaurar estes dados
              </Button>
            </div>
          )}
        </div>
      </section>
      <section className="sample-section">
        <div>
          <h2>
            <Sparkles size={18} />
            Dados para teste
          </h2>
          <p>
            Experimente com itens de exemplo. A limpeza remove somente os exemplos e suas
            movimentações.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={meds.some((m) => m.isSample)}
            onClick={() => setSamples("add")}
          >
            <PlusIcon />
            Adicionar exemplos
          </Button>
          <Button
            variant="ghost"
            disabled={!meds.some((m) => m.isSample)}
            onClick={() => setSamples("clear")}
          >
            <Trash2 />
            Limpar exemplos
          </Button>
        </div>
      </section>
      <Notice>
        <ShieldCheck size={16} className="inline mr-2" />
        Use sempre o mesmo navegador e endereço para acessar o seu estoque local.
      </Notice>
      {confirm && backup && (
        <Confirmation
          destructive
          title="Substituir todos os dados locais?"
          description={`O backup de ${dateLabel(backup.createdAt)} substituirá todos os ${meds.length} medicamentos e ${moves.length} movimentos atuais. Faça um backup antes de continuar.`}
          onClose={() => setConfirm(false)}
          onConfirm={async () => {
            await restoreBackup(backup);
            setBackup(null);
            toast.success("Backup restaurado com sucesso.");
          }}
        />
      )}
      {samples && (
        <Confirmation
          destructive={samples === "clear"}
          title={samples === "add" ? "Adicionar dados de exemplo?" : "Limpar apenas os exemplos?"}
          description={
            samples === "add"
              ? "Serão cadastrados cinco medicamentos de teste, identificados como exemplos."
              : "Os medicamentos de exemplo e seus movimentos serão removidos. Outros itens não serão alterados."
          }
          onClose={() => setSamples(null)}
          onConfirm={async () => {
            if (samples === "add") await addSamples();
            else await clearSamples();
            toast.success("Dados de exemplo atualizados.");
          }}
        />
      )}
    </>
  );
}
function PlusIcon() {
  return <Sparkles size={16} />;
}
