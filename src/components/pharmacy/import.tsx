import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Check, ChevronRight, FileSpreadsheet, Upload, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useInventory } from "./store";
import { PageHeading, Notice } from "./shared";
import { Confirmation } from "./forms";
import {
  autoMap,
  prepareRows,
  applyImport,
  fieldLabels,
  type Field,
  type Mapping,
  type Strategy,
} from "@/lib/pharmacy/excel";
export function ImportPage() {
  const { meds } = useInventory();
  const ref = useRef<HTMLInputElement>(null);
  const [book, setBook] = useState<XLSX.WorkBook | null>(null);
  const [sheet, setSheet] = useState("");
  const [filename, setFilename] = useState("");
  const [mapping, setMapping] = useState<Mapping>({});
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [strategy, setStrategy] = useState<Strategy>("update");
  const [confirm, setConfirm] = useState(false);
  const [step, setStep] = useState(1);
  const [done, setDone] = useState("");
  const [reading, setReading] = useState(false);
  const raw =
    book && sheet
      ? XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[sheet] ?? {}, { defval: "" })
      : [];
  const headerRow =
    book && sheet
      ? (XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[sheet] ?? {}, { header: 1 })[0] ?? [])
      : [];
  const headers = headerRow.map(String);
  const rows = prepareRows(raw, mapping, meds);
  const selected = rows.filter((r) => !excluded.has(r.index));
  const invalid = rows.filter((r) => r.error);
  const valid = rows.filter((r) => !r.error);
  const newCount = selected.filter((r) => !r.matchId).length;
  async function read(file: File) {
    setReading(true);
    setDone("");
    try {
      if (!/\.(xlsx|xls|csv)$/i.test(file.name))
        throw new Error("Selecione um arquivo .xlsx, .xls ou .csv.");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const name = wb.SheetNames[0];
      if (!name) throw new Error("A planilha não contém abas.");
      setBook(wb);
      setSheet(name);
      setFilename(file.name);
      setMapping(
        autoMap(
          (XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name] ?? {}, { header: 1 })[0] ?? []).map(
            String,
          ),
        ),
      );
      setExcluded(new Set());
      setStep(2);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ler a planilha.");
    } finally {
      setReading(false);
    }
  }
  const mappingValid = !!mapping.name && !!mapping.currentQuantity;
  return (
    <>
      <PageHeading
        eyebrow="DADOS DA FARMÁCIA"
        title="Importar Planilha"
        description="Traga os dados da sua planilha para o estoque local."
      />
      <div className="import-steps">
        {["Selecionar arquivo", "Mapear colunas", "Revisar e importar"].map((l, i) => (
          <div
            className={step === i + 1 ? "step-current" : step > i + 1 ? "step-done" : ""}
            key={l}
          >
            <span>{step > i + 1 ? <Check size={15} /> : i + 1}</span>
            <strong>{l}</strong>
            {i < 2 && <ChevronRight size={16} />}
          </div>
        ))}
      </div>
      {done ? (
        <Notice tone="success">
          <strong>Importação concluída.</strong>
          <p>{done}</p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => {
              setBook(null);
              setDone("");
              setStep(1);
            }}
          >
            Importar outra planilha
          </Button>
        </Notice>
      ) : null}
      {step === 1 && !done && (
        <>
          <div
            className="upload-area"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) void read(f);
            }}
          >
            <span className="upload-icon">
              <FileSpreadsheet size={38} />
            </span>
            <h2>Selecione sua planilha de estoque</h2>
            <p>Arraste o arquivo para cá ou selecione no computador.</p>
            <Button disabled={reading} onClick={() => ref.current?.click()}>
              <Upload />
              {reading ? "Lendo planilha…" : "Selecionar arquivo"}
            </Button>
            <small>Formatos aceitos: XLSX, XLS e CSV</small>
          </div>
          <Notice>O arquivo é lido neste computador. Nenhum dado é enviado para a internet.</Notice>
        </>
      )}
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        aria-label="Arquivo de planilha"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void read(f);
          e.target.value = "";
        }}
      />
      {book && step === 2 && (
        <section>
          <div className="file-summary">
            <FileSpreadsheet size={25} />
            <div>
              <strong>{filename}</strong>
              <small>{raw.length} linhas encontradas</small>
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                setBook(null);
                setStep(1);
              }}
            >
              Trocar arquivo
            </Button>
          </div>
          <label className="field sheet-select">
            Aba da planilha
            <select
              value={sheet}
              onChange={(e) => {
                const s = e.target.value;
                setSheet(s);
                setMapping(
                  autoMap(
                    (
                      XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[s] ?? {}, { header: 1 })[0] ??
                      []
                    ).map(String),
                  ),
                );
                setExcluded(new Set());
              }}
            >
              {book.SheetNames.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <div className="section-heading plain-heading">
            <div>
              <h2>Correspondência das colunas</h2>
              <p>Confira as colunas identificadas na planilha.</p>
            </div>
          </div>
          <div className="mapping-grid">
            {(Object.keys(fieldLabels) as Field[]).map((field) => (
              <label className="field" key={field}>
                {fieldLabels[field]}
                {["name", "currentQuantity"].includes(field) ? " *" : ""}
                <select
                  value={mapping[field] ?? ""}
                  onChange={(e) => {
                    setMapping({ ...mapping, [field]: e.target.value || undefined });
                    setExcluded(new Set());
                  }}
                >
                  <option value="">Não importar</option>
                  {headers.map((h, i) => (
                    <option key={`${h}-${i}`} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="dialog-actions">
            <Button variant="outline" onClick={() => setStep(1)}>
              Voltar
            </Button>
            <Button disabled={!mappingValid || !raw.length} onClick={() => setStep(3)}>
              Revisar dados
              <ChevronRight />
            </Button>
          </div>
        </section>
      )}
      {book && step === 3 && !done && (
        <>
          <div className="import-summary">
            <div>
              <strong>{rows.length}</strong>
              <span>Linhas detectadas</span>
            </div>
            <div>
              <strong className="text-success">{valid.length}</strong>
              <span>Linhas válidas</span>
            </div>
            <div>
              <strong className="text-destructive">{invalid.length}</strong>
              <span>Linhas inválidas</span>
            </div>
            <div>
              <strong>{rows.filter((r) => r.duplicate).length}</strong>
              <span>Duplicados</span>
            </div>
          </div>
          {invalid.length > 0 && (
            <Notice tone="warning">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <span>
                  {invalid.length} linhas precisam de revisão. Exclua-as da importação ou ajuste a
                  planilha.
                </span>
                <Button
                  variant="outline"
                  onClick={() => setExcluded(new Set(invalid.map((r) => r.index)))}
                >
                  Excluir linhas inválidas
                </Button>
              </div>
            </Notice>
          )}
          <div className="table-frame import-preview">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {[
                      "Importar",
                      "Linha",
                      "Medicamento",
                      "Código",
                      "Quantidade",
                      "Estoque mínimo",
                      "Validação",
                    ].map((v) => (
                      <th key={v}>{v}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr className={r.error ? "invalid-row" : ""} key={r.index}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Importar linha ${r.index}`}
                          checked={!excluded.has(r.index)}
                          onChange={(e) => {
                            const s = new Set(excluded);
                            if (e.target.checked) s.delete(r.index);
                            else s.add(r.index);
                            setExcluded(s);
                          }}
                        />
                      </td>
                      <td>{r.index}</td>
                      <td>
                        <strong>{r.item.name || "—"}</strong>
                        <small>{r.item.concentration}</small>
                      </td>
                      <td>{r.item.internalCode || "—"}</td>
                      <td>
                        {Number.isFinite(r.item.currentQuantity)
                          ? r.item.currentQuantity
                          : "Inválida"}
                      </td>
                      <td>
                        {Number.isFinite(r.item.minimumStock) ? r.item.minimumStock : "Inválido"}
                      </td>
                      <td>{r.error || (r.matchId ? "Item existente" : "Novo medicamento")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="section-heading plain-heading">
            <h2>Como importar as quantidades?</h2>
          </div>
          <div className="strategy-options">
            {(
              [
                {
                  value: "update",
                  title: "Adicionar ou atualizar",
                  description:
                    "Cadastra novos itens e atualiza descrições. Preserva o saldo dos itens existentes.",
                },
                {
                  value: "add",
                  title: "Somar quantidades",
                  description:
                    "Soma as quantidades importadas ao saldo atual. Cada alteração gera um registro.",
                },
                {
                  value: "replace",
                  title: "Substituir quantidades",
                  description: "Substitui o saldo atual e registra uma reconciliação no histórico.",
                },
              ] as const
            ).map((s) => (
              <label
                className={`strategy-option ${strategy === s.value ? "strategy-selected" : ""}`}
                key={s.value}
              >
                <input
                  type="radio"
                  name="strategy"
                  value={s.value}
                  checked={strategy === s.value}
                  onChange={() => setStrategy(s.value)}
                />
                <div>
                  <strong>{s.title}</strong>
                  <p>{s.description}</p>
                </div>
                {s.value === "replace" && <AlertTriangle size={18} />}
              </label>
            ))}
          </div>
          <div className="dialog-actions">
            <Button variant="outline" onClick={() => setStep(2)}>
              Voltar ao mapeamento
            </Button>
            <Button
              disabled={!selected.length || selected.some((r) => !!r.error)}
              onClick={() => setConfirm(true)}
            >
              Confirmar importação ({selected.length} itens)
            </Button>
          </div>
        </>
      )}
      {confirm && (
        <Confirmation
          destructive={strategy === "replace"}
          title={strategy === "replace" ? "Substituir o estoque atual?" : "Confirmar importação?"}
          description={`${newCount} novos medicamentos; ${selected.length - newCount} itens existentes; ${strategy === "update" ? newCount : selected.length} registros de quantidade; ${excluded.size} linhas ignoradas; ${selected.filter((r) => r.error).length} erros. ${strategy === "replace" ? "ATENÇÃO: os saldos existentes serão substituídos. O histórico será preservado." : "As alterações serão salvas neste computador."}`}
          onClose={() => setConfirm(false)}
          onConfirm={async () => {
            await applyImport(selected, strategy, mapping);
            setDone(
              `${selected.length} itens processados: ${newCount} novos, ${selected.length - newCount} atualizados e ${excluded.size} linhas ignoradas.`,
            );
            toast.success("Planilha importada com sucesso.");
          }}
        />
      )}
    </>
  );
}
