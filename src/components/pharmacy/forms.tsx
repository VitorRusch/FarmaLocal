import { useState } from "react";
import { Plus, ArrowDownLeft, ArrowUpRight, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  saveMedication,
  moveStock,
  type Medication,
  type MedicationInput,
  type MovementType,
} from "@/lib/pharmacy/database";
export async function perform(action: () => Promise<unknown>, message: string) {
  try {
    const result = await action();
    toast.success(message);
    return result;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Não foi possível concluir a operação.");
    return undefined;
  }
}
export function MedicationForm({
  med,
  onClose,
}: {
  med?: Medication | undefined;
  onClose: () => void;
}) {
  const [form, setForm] = useState<MedicationInput>(
    med ?? {
      name: "",
      internalCode: "",
      activeIngredient: "",
      concentration: "",
      presentation: "",
      unitOfMeasure: "Unidade",
      currentQuantity: 0,
      minimumStock: 0,
      notes: "",
    },
  );
  const [reason, setReason] = useState("");
  const [duplicate, setDuplicate] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(confirmed = false) {
    setSaving(true);
    setError("");
    try {
      await saveMedication(form, med?.id, confirmed, reason);
      toast.success(med ? "Medicamento atualizado." : "Medicamento cadastrado.");
      onClose();
    } catch (e) {
      if (e instanceof Error && e.message === "DUPLICATE_NAME") setDuplicate(true);
      else setError(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }
  const textField = (
    label: string,
    key: "name" | "internalCode" | "activeIngredient" | "concentration" | "notes",
    required = false,
  ) => (
    <label className={key === "name" || key === "notes" ? "field field-wide" : "field"}>
      {label}
      {required ? " *" : ""}
      <input
        required={required}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={key === "name" ? "Ex.: Dipirona" : key === "internalCode" ? "Opcional" : "—"}
      />
    </label>
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="form-dialog">
        <DialogHeader>
          <DialogTitle>{med ? "Editar medicamento" : "Novo medicamento"}</DialogTitle>
          <DialogDescription>
            {med
              ? "Atualize o cadastro e registre alterações no saldo."
              : "Cadastre um item no estoque da farmácia."}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="form-grid">
            {textField("Nome do medicamento", "name", true)}
            {textField("Princípio ativo", "activeIngredient")}
            {textField("Concentração", "concentration")}
            <label className="field">
              Apresentação
              <select
                value={form.presentation}
                onChange={(e) => setForm({ ...form, presentation: e.target.value })}
              >
                <option value="">Selecione</option>
                {[
                  "Comprimido",
                  "Cápsula",
                  "Ampola",
                  "Frasco",
                  "Solução",
                  "Suspensão",
                  "Bisnaga",
                  "Caixa",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Unidade de medida *
              <select
                value={form.unitOfMeasure}
                onChange={(e) => setForm({ ...form, unitOfMeasure: e.target.value })}
              >
                {["Unidade", "Comprimido", "Cápsula", "Ampola", "Frasco", "Caixa", "mL", "mg"].map(
                  (v) => (
                    <option key={v}>{v}</option>
                  ),
                )}
              </select>
            </label>
            {(["currentQuantity", "minimumStock"] as const).map((key) => (
              <label className="field" key={key}>
                {key === "currentQuantity" ? "Quantidade atual" : "Estoque mínimo"} *
                <input
                  required
                  type="number"
                  min="0"
                  step="any"
                  value={form[key]}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      [key]: e.target.value === "" ? NaN : Number(e.target.value),
                    })
                  }
                />
              </label>
            ))}
            {textField("Código interno", "internalCode")}
            {textField("Observações", "notes")}
            {med && med.currentQuantity !== form.currentQuantity && (
              <label className="field field-wide">
                Motivo do ajuste *
                <input required value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>
            )}
          </div>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {duplicate && (
            <div className="duplicate-confirm">
              <p>Já existe um medicamento com este nome. Confirma que são itens diferentes?</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => void submit(true)}
                disabled={saving}
              >
                Sim, são itens diferentes
              </Button>
            </div>
          )}
          <div className="dialog-actions">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button disabled={saving} type="submit">
              <Plus />
              {saving ? "Salvando…" : med ? "Salvar alterações" : "Cadastrar medicamento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function MovementForm({
  meds,
  initial,
  onClose,
}: {
  meds: Medication[];
  initial?: Medication;
  onClose: () => void;
}) {
  const [id, setId] = useState(initial?.id ?? "");
  const [type, setType] = useState<MovementType>("entrada");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const med = meds.find((m) => m.id === id);
  const q = Number(quantity);
  const balance = med
    ? type === "ajuste"
      ? q
      : type === "saida"
        ? med.currentQuantity - q
        : med.currentQuantity + q
    : 0;
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="form-dialog">
        <DialogHeader>
          <DialogTitle>Movimentar estoque</DialogTitle>
          <DialogDescription>
            Todos os lançamentos ficam registrados no histórico.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              if (!quantity) throw new Error("Informe a quantidade.");
              const result = await moveStock(id, type, q, notes);
              toast.success(
                `Movimentação registrada. Novo saldo: ${result.toLocaleString("pt-BR")}.`,
              );
              onClose();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Erro na movimentação.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="segmented movement-types">
            {(
              [
                { value: "entrada", label: "Entrada", icon: ArrowDownLeft },
                { value: "saida", label: "Saída", icon: ArrowUpRight },
                { value: "ajuste", label: "Ajuste", icon: SlidersHorizontal },
              ] as const
            ).map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                type="button"
                variant="ghost"
                className={type === value ? "selected" : ""}
                onClick={() => {
                  setType(value);
                  setError("");
                }}
              >
                <Icon />
                {label}
              </Button>
            ))}
          </div>
          <label className="field">
            Medicamento *
            <select required value={id} onChange={(e) => setId(e.target.value)}>
              <option value="">Selecione o medicamento</option>
              {meds
                .filter((m) => m.isActive)
                .map((m) => (
                  <option value={m.id} key={m.id}>
                    {m.name} {m.concentration}
                  </option>
                ))}
            </select>
          </label>
          {med && (
            <div className="balance-line">
              Saldo atual{" "}
              <strong>
                {med.currentQuantity.toLocaleString("pt-BR")} {med.unitOfMeasure.toLowerCase()}(s)
              </strong>
            </div>
          )}
          <label className="field">
            {type === "ajuste" ? "Nova quantidade" : "Quantidade"} *
            <input
              required
              type="number"
              min={type === "ajuste" ? 0 : 0.000001}
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
          <label className="field">
            {type === "ajuste" ? "Motivo do ajuste *" : "Observações"}
            <textarea
              required={type === "ajuste"}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </label>
          {quantity && med && (
            <div className="balance-line">
              Saldo após o lançamento{" "}
              <strong className={balance < 0 ? "text-destructive" : ""}>
                {balance.toLocaleString("pt-BR")}
              </strong>
            </div>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button disabled={busy || !id} type="submit">
              {busy ? "Registrando…" : "Confirmar movimentação"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function Confirmation({
  title,
  description,
  onConfirm,
  onClose,
  destructive = false,
}: {
  title: string;
  description: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  destructive?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="dialog-actions">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onClose();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Operação não concluída.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Aguarde…" : "Confirmar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
