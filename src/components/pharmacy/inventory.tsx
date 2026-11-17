import { useState } from "react";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  FileDown,
  Pencil,
  Plus,
  Minus,
  Search,
  Archive,
  Trash2,
  RotateCcw,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInventory } from "./store";
import { PageHeading, EmptyState, StockBadge, LoadingState, num } from "./shared";
import { MedicationForm, MovementForm, Confirmation, perform } from "./forms";
import {
  normalize,
  status,
  moveStock,
  removeMedication,
  toggleMedication,
  type Medication,
} from "@/lib/pharmacy/database";
import { Link } from "@tanstack/react-router";
export function Inventory() {
  const { meds, ready, error } = useInventory();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("todos");
  const [sort, setSort] = useState<"name" | "currentQuantity" | "minimumStock">("name");
  const [asc, setAsc] = useState(true);
  const [editing, setEditing] = useState<Medication | true | null>(null);
  const [moving, setMoving] = useState<Medication | null>(null);
  const [destructive, setDestructive] = useState<{
    med: Medication;
    type: "delete" | "toggle";
  } | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const visible = meds
    .filter(
      (m) =>
        (showInactive || m.isActive) &&
        [m.name, m.activeIngredient, m.concentration, m.internalCode].some((v) =>
          normalize(v).includes(normalize(search)),
        ) &&
        (filter === "todos" || status(m) === filter),
    )
    .sort(
      (a, b) =>
        (sort === "name" ? a.name.localeCompare(b.name, "pt-BR") : a[sort] - b[sort]) *
        (asc ? 1 : -1),
    );
  function changeSort(key: typeof sort) {
    if (sort === key) setAsc(!asc);
    else {
      setSort(key);
      setAsc(true);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="CADASTRO E CONTROLE"
        title="Estoque de Medicamentos"
        description="Consulte e gerencie todos os itens da sua farmácia."
      >
        <Button variant="outline" asChild>
          <Link to="/exportar">
            <FileDown />
            Exportar
          </Link>
        </Button>
        <Button onClick={() => setEditing(true)}>
          <Plus />
          Novo medicamento
        </Button>
      </PageHeading>
      <LoadingState ready={ready} error={error} />
      <div className="inventory-toolbar">
        <label className="search-box">
          <Search size={17} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar medicamento, princípio ativo ou código…"
            aria-label="Buscar medicamentos"
          />
        </label>
        <div className="segmented">
          {(
            [
              ["todos", "Todos"],
              ["normal", "Normal"],
              ["baixo", "Estoque baixo"],
              ["zerado", "Zerado"],
            ] as const
          ).map(([v, l]) => (
            <Button
              key={v}
              variant="ghost"
              className={filter === v ? "selected" : ""}
              onClick={() => setFilter(v)}
            >
              {l}
            </Button>
          ))}
        </div>
      </div>
      <div className="table-meta">
        <span>{num(visible.length)} medicamentos</span>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Mostrar inativos
        </label>
      </div>
      <section className="table-frame">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {(
                  [
                    ["name", "Medicamento"],
                    ["activeIngredient", "Princípio ativo"],
                    ["concentration", "Concentração"],
                    ["presentation", "Apresentação"],
                    ["unit", "Unidade"],
                    ["currentQuantity", "Quantidade"],
                    ["minimumStock", "Mínimo"],
                    ["status", "Status"],
                    ["actions", "Ações"],
                  ] as const
                ).map(([k, l]) => (
                  <th key={k}>
                    {["name", "currentQuantity", "minimumStock"].includes(k) ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => changeSort(k as typeof sort)}
                      >
                        {l}
                        {sort === k ? asc ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : null}
                      </Button>
                    ) : (
                      l
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.name}</strong>
                    <small>{m.internalCode || "Sem código"}</small>
                  </td>
                  <td>{m.activeIngredient || "—"}</td>
                  <td>{m.concentration || "—"}</td>
                  <td>{m.presentation || "—"}</td>
                  <td>{m.unitOfMeasure}</td>
                  <td className="numeric-cell">{num(m.currentQuantity)}</td>
                  <td className="numeric-cell muted-number">{num(m.minimumStock)}</td>
                  <td>
                    <StockBadge med={m} />
                  </td>
                  <td>
                    <div className="row-actions">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="+1 Entrada"
                        aria-label={`+1 Entrada ${m.name}`}
                        disabled={!m.isActive}
                        onClick={() =>
                          void perform(
                            () => moveStock(m.id, "entrada", 1),
                            "Entrada de 1 unidade registrada.",
                          )
                        }
                      >
                        <Plus className="text-success" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="-1 Saída"
                        aria-label={`-1 Saída ${m.name}`}
                        disabled={!m.isActive || m.currentQuantity < 1}
                        onClick={() =>
                          void perform(
                            () => moveStock(m.id, "saida", 1),
                            "Saída de 1 unidade registrada.",
                          )
                        }
                      >
                        <Minus />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Movimentar"
                        aria-label={`Movimentar ${m.name}`}
                        disabled={!m.isActive}
                        onClick={() => setMoving(m)}
                      >
                        <ArrowLeftRight />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar"
                        aria-label={`Editar ${m.name}`}
                        onClick={() => setEditing(m)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={m.isActive ? "Desativar" : "Reativar"}
                        aria-label={`${m.isActive ? "Desativar" : "Reativar"} ${m.name}`}
                        onClick={() => setDestructive({ med: m, type: "toggle" })}
                      >
                        {m.isActive ? <Archive /> : <RotateCcw />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Excluir"
                        aria-label={`Excluir ${m.name}`}
                        onClick={() => setDestructive({ med: m, type: "delete" })}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length && (
          <EmptyState
            icon={Package}
            title={meds.length ? "Nenhum medicamento encontrado" : "Estoque ainda vazio"}
            description={
              meds.length
                ? "Tente outra busca ou altere os filtros."
                : "Cadastre um medicamento ou importe uma planilha para começar."
            }
          >
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Plus />
              Novo medicamento
            </Button>
          </EmptyState>
        )}
      </section>
      {editing && (
        <MedicationForm
          med={editing === true ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}{" "}
      {moving && <MovementForm meds={meds} initial={moving} onClose={() => setMoving(null)} />}{" "}
      {destructive && (
        <Confirmation
          destructive
          title={
            destructive.type === "delete"
              ? "Excluir medicamento?"
              : destructive.med.isActive
                ? "Desativar medicamento?"
                : "Reativar medicamento?"
          }
          description={
            destructive.type === "delete"
              ? "Só é possível excluir itens sem movimentações. Itens com histórico devem ser desativados."
              : "O histórico será preservado. Medicamentos inativos não aparecem nos totais e não podem ser movimentados."
          }
          onClose={() => setDestructive(null)}
          onConfirm={async () => {
            if (destructive.type === "delete") await removeMedication(destructive.med.id);
            else await toggleMedication(destructive.med);
          }}
        />
      )}
    </>
  );
}
