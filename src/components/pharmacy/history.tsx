import { useState } from "react";
import { ArrowLeftRight, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInventory } from "./store";
import { PageHeading, LoadingState, EmptyState, dateLabel, timeLabel, num } from "./shared";
import { MovementForm } from "./forms";
import { typeLabels } from "@/lib/pharmacy/excel";
export function History() {
  const { meds, moves, ready, error } = useInventory();
  const [date, setDate] = useState("");
  const [id, setId] = useState("");
  const [type, setType] = useState("");
  const [open, setOpen] = useState(false);
  const visible = moves.filter(
    (m) =>
      (!date || new Date(m.createdAt).toLocaleDateString("sv-SE") === date) &&
      (!id || m.medicationId === id) &&
      (!type || m.type === type),
  );
  return (
    <>
      <PageHeading
        eyebrow="RASTREABILIDADE"
        title="Movimentações"
        description="O histórico completo de entradas, saídas e ajustes do seu estoque."
      >
        <Button disabled={!meds.some((m) => m.isActive)} onClick={() => setOpen(true)}>
          <Plus />
          Nova movimentação
        </Button>
      </PageHeading>
      <LoadingState ready={ready} error={error} />
      <div className="history-filters">
        <label className="field">
          Data
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          Medicamento
          <select value={id} onChange={(e) => setId(e.target.value)}>
            <option value="">Todos os medicamentos</option>
            {meds.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} {m.concentration}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Tipo de movimentação
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Todos os tipos</option>
            {Object.entries(typeLabels).map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="ghost"
          onClick={() => {
            setDate("");
            setId("");
            setType("");
          }}
        >
          Limpar filtros
        </Button>
      </div>
      <div className="table-meta">
        <span>{num(visible.length)} registros</span>
        <span className="flex items-center gap-2">
          <ShieldCheck size={14} />
          Histórico protegido
        </span>
      </div>
      <section className="table-frame">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "Data e hora",
                  "Medicamento",
                  "Tipo",
                  "Quantidade",
                  "Saldo anterior",
                  "Saldo final",
                  "Observações",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((m) => (
                <tr key={m.id}>
                  <td>
                    {dateLabel(m.createdAt)}
                    <small>{timeLabel(m.createdAt)}</small>
                  </td>
                  <td>
                    <strong>{m.medicationName}</strong>
                  </td>
                  <td>
                    <span
                      className={`movement-badge ${m.quantity < 0 ? "tone-red" : "tone-green"}`}
                    >
                      {typeLabels[m.type]}
                    </span>
                  </td>
                  <td
                    className={`numeric-cell ${m.quantity < 0 ? "text-destructive" : "text-success"}`}
                  >
                    {m.quantity > 0 ? "+" : ""}
                    {num(m.quantity)}
                  </td>
                  <td>{num(m.previousBalance)}</td>
                  <td className="numeric-cell">{num(m.resultingBalance)}</td>
                  <td>{m.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length && (
          <EmptyState
            icon={ArrowLeftRight}
            title="Nenhuma movimentação encontrada"
            description={
              moves.length
                ? "Altere os filtros para ver outros registros."
                : "Os lançamentos do estoque serão registrados aqui."
            }
          />
        )}
      </section>
      {open && <MovementForm meds={meds} onClose={() => setOpen(false)} />}
    </>
  );
}
