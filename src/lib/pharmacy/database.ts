import Dexie, { type Table } from "dexie";
export type MovementType = "entrada" | "saida" | "ajuste" | "importacao" | "reconciliacao";
export interface Medication {
  id: string;
  internalCode: string;
  name: string;
  activeIngredient: string;
  concentration: string;
  presentation: string;
  unitOfMeasure: string;
  currentQuantity: number;
  minimumStock: number;
  notes: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  isSample?: boolean;
}
export interface Movement {
  id: string;
  medicationId: string;
  medicationName: string;
  type: MovementType;
  quantity: number;
  previousBalance: number;
  resultingBalance: number;
  notes: string;
  createdAt: string;
}
export interface Setting {
  id: string;
  value: unknown;
}
class PharmacyDB extends Dexie {
  declare medications: Table<Medication, string>;
  declare movements: Table<Movement, string>;
  declare settings: Table<Setting, string>;
  constructor() {
    super("farmacia-hospitalar-local");
    this.version(1).stores({
      medications: "id,internalCode,name,isActive",
      movements: "id,medicationId,createdAt,type",
      settings: "id",
    });
  }
}
// Construct lazily: SSR never opens IndexedDB.
let instance: PharmacyDB | undefined;
export function db() {
  return (instance ??= new PharmacyDB());
}
export const normalize = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
export const status = (m: Pick<Medication, "currentQuantity" | "minimumStock">) =>
  m.currentQuantity === 0 ? "zerado" : m.currentQuantity <= m.minimumStock ? "baixo" : "normal";
export function numberValid(n: number) {
  if (!Number.isFinite(n) || n < 0)
    throw new Error("A quantidade deve ser um número maior ou igual a zero.");
}
export function calculateBalance(previous: number, quantity: number, type: MovementType) {
  numberValid(previous);
  numberValid(quantity);
  if ((type === "entrada" || type === "saida") && quantity === 0)
    throw new Error("Informe uma quantidade maior que zero.");
  const next =
    type === "saida"
      ? previous - quantity
      : type === "ajuste" || type === "reconciliacao"
        ? quantity
        : previous + quantity;
  if (next < 0) throw new Error("Estoque insuficiente para esta saída.");
  return next;
}
export function summary(meds: Medication[], moves: Movement[], day: string) {
  const active = meds.filter((m) => m.isActive);
  return {
    total: active.length,
    units: active.reduce((n, m) => n + m.currentQuantity, 0),
    low: active.filter((m) => status(m) === "baixo").length,
    zero: active.filter((m) => status(m) === "zerado").length,
    today: moves.filter(
      (m) =>
        new Date(m.createdAt).toLocaleDateString("pt-BR") === day &&
        ["entrada", "saida"].includes(m.type),
    ).length,
  };
}
export type MedicationInput = Omit<Medication, "id" | "createdAt" | "updatedAt" | "isActive">;
export async function saveMedication(
  input: MedicationInput,
  id?: string,
  confirmDuplicate = false,
  adjustmentReason = "",
) {
  if (!input.name.trim() || !input.unitOfMeasure.trim())
    throw new Error("Preencha o nome e a unidade.");
  numberValid(input.currentQuantity);
  numberValid(input.minimumStock);
  return db().transaction("rw", db().medications, db().movements, async () => {
    const all = await db().medications.toArray();
    if (
      input.internalCode.trim() &&
      all.some((m) => m.id !== id && normalize(m.internalCode) === normalize(input.internalCode))
    )
      throw new Error("Este código interno já está cadastrado.");
    if (
      !confirmDuplicate &&
      all.some((m) => m.id !== id && normalize(m.name) === normalize(input.name))
    )
      throw new Error("DUPLICATE_NAME");
    const previous = id ? await db().medications.get(id) : undefined;
    if (id && !previous) throw new Error("Este medicamento não existe mais.");
    const now = new Date().toISOString();
    const medication: Medication = {
      ...input,
      name: input.name.trim(),
      internalCode: input.internalCode.trim(),
      id: previous?.id ?? crypto.randomUUID(),
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
      isActive: previous?.isActive ?? true,
    };
    if (previous && previous.currentQuantity !== input.currentQuantity && !adjustmentReason.trim())
      throw new Error("Informe o motivo do ajuste de estoque.");
    await db().medications.put(medication);
    if (previous && previous.currentQuantity !== input.currentQuantity)
      await recordMovement(
        medication,
        "ajuste",
        previous.currentQuantity,
        input.currentQuantity,
        adjustmentReason,
      );
    else if (!previous && input.currentQuantity > 0)
      await recordMovement(medication, "entrada", 0, input.currentQuantity, "Estoque inicial");
    return medication;
  });
}
async function recordMovement(
  med: Medication,
  type: MovementType,
  previous: number,
  next: number,
  notes: string,
) {
  await db().movements.add({
    id: crypto.randomUUID(),
    medicationId: med.id,
    medicationName: med.name,
    type,
    quantity: next - previous,
    previousBalance: previous,
    resultingBalance: next,
    notes,
    createdAt: new Date().toISOString(),
  });
}
export async function moveStock(id: string, type: MovementType, quantity: number, notes = "") {
  return db().transaction("rw", db().medications, db().movements, async () => {
    const med = await db().medications.get(id);
    if (!med || !med.isActive) throw new Error("Medicamento não disponível.");
    if (type === "ajuste" && !notes.trim()) throw new Error("Informe o motivo do ajuste.");
    const next = calculateBalance(med.currentQuantity, quantity, type);
    await recordMovement(med, type, med.currentQuantity, next, notes);
    await db().medications.update(id, {
      currentQuantity: next,
      updatedAt: new Date().toISOString(),
    });
    return next;
  });
}
export async function removeMedication(id: string) {
  return db().transaction("rw", db().medications, db().movements, async () => {
    if (await db().movements.where("medicationId").equals(id).count())
      throw new Error("Este medicamento tem histórico. Desative-o em vez de excluir.");
    await db().medications.delete(id);
  });
}
export async function toggleMedication(m: Medication) {
  await db().medications.update(m.id, {
    isActive: !m.isActive,
    updatedAt: new Date().toISOString(),
  });
}
export interface Backup {
  application: "farmacia-hospitalar-local";
  version: 1;
  createdAt: string;
  data: { medications: Medication[]; movements: Movement[]; settings: Setting[] };
}
export async function createBackup(): Promise<Backup> {
  return db().transaction("r", db().medications, db().movements, db().settings, async () => ({
    application: "farmacia-hospitalar-local",
    version: 1,
    createdAt: new Date().toISOString(),
    data: {
      medications: await db().medications.toArray(),
      movements: await db().movements.toArray(),
      settings: await db().settings.toArray(),
    },
  }));
}
export function validateBackup(value: unknown): Backup {
  const b = value as Backup;
  if (
    !b ||
    b.application !== "farmacia-hospitalar-local" ||
    b.version !== 1 ||
    !Number.isFinite(Date.parse(b.createdAt)) ||
    !b.data ||
    !Array.isArray(b.data.medications) ||
    !Array.isArray(b.data.movements) ||
    !Array.isArray(b.data.settings)
  )
    throw new Error("Backup inválido ou versão não compatível.");
  const ids = new Set<string>();
  const codes = new Set<string>();
  for (const m of b.data.medications) {
    if (
      typeof m.id !== "string" ||
      ids.has(m.id) ||
      typeof m.name !== "string" ||
      !m.name.trim() ||
      typeof m.unitOfMeasure !== "string" ||
      !m.unitOfMeasure.trim() ||
      typeof m.isActive !== "boolean" ||
      !Number.isFinite(Date.parse(m.createdAt)) ||
      !Number.isFinite(Date.parse(m.updatedAt)) ||
      ["internalCode", "activeIngredient", "concentration", "presentation", "notes"].some(
        (k) => typeof m[k as keyof Medication] !== "string",
      )
    )
      throw new Error("Medicamento inválido no backup.");
    numberValid(m.currentQuantity);
    numberValid(m.minimumStock);
    ids.add(m.id);
    const code = normalize(m.internalCode);
    if (code && codes.has(code)) throw new Error("Código duplicado no backup.");
    if (code) codes.add(code);
  }
  const movementIds = new Set<string>();
  for (const m of b.data.movements) {
    if (
      typeof m.id !== "string" ||
      movementIds.has(m.id) ||
      !ids.has(m.medicationId) ||
      typeof m.medicationName !== "string" ||
      typeof m.notes !== "string" ||
      !["entrada", "saida", "ajuste", "importacao", "reconciliacao"].includes(m.type) ||
      !Number.isFinite(m.quantity) ||
      m.resultingBalance - m.previousBalance !== m.quantity ||
      !Number.isFinite(Date.parse(m.createdAt))
    )
      throw new Error("Movimentação inválida no backup.");
    numberValid(m.previousBalance);
    numberValid(m.resultingBalance);
    movementIds.add(m.id);
  }
  const settingsIds = new Set<string>();
  for (const s of b.data.settings) {
    if (typeof s.id !== "string" || settingsIds.has(s.id) || !("value" in s))
      throw new Error("Configuração inválida no backup.");
    settingsIds.add(s.id);
  }
  return b;
}
export async function restoreBackup(b: Backup) {
  validateBackup(b);
  await db().transaction("rw", db().medications, db().movements, db().settings, async () => {
    await db().medications.clear();
    await db().movements.clear();
    await db().settings.clear();
    await db().medications.bulkAdd(b.data.medications);
    await db().movements.bulkAdd(b.data.movements);
    await db().settings.bulkAdd(b.data.settings);
  });
}
export async function addSamples() {
  const samples = [
    ["Dipirona", "500 mg", "Comprimido", 120, 30],
    ["Amoxicilina", "500 mg", "Cápsula", 18, 20],
    ["Soro fisiológico", "0,9%", "Frasco", 0, 10],
    ["Paracetamol", "750 mg", "Comprimido", 85, 20],
    ["Omeprazol", "20 mg", "Cápsula", 12, 15],
  ] as const;
  await db().transaction("rw", db().medications, db().movements, async () => {
    for (const [name, concentration, unit, currentQuantity, minimumStock] of samples)
      await saveMedication(
        {
          name,
          concentration,
          unitOfMeasure: unit,
          presentation: unit,
          currentQuantity,
          minimumStock,
          internalCode: "",
          activeIngredient: name,
          notes: "Dados de exemplo",
          isSample: true,
        },
        undefined,
        true,
      );
  });
}
export async function clearSamples() {
  await db().transaction("rw", db().medications, db().movements, async () => {
    const samples = (await db().medications.toArray()).filter((m) => m.isSample);
    for (const m of samples) {
      await db().movements.where("medicationId").equals(m.id).delete();
      await db().medications.delete(m.id);
    }
  });
}
