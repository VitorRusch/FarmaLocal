import * as XLSX from "xlsx";
import * as StyledXLSX from "xlsx-js-style";
import { format } from "date-fns";
import {
  db,
  normalize,
  numberValid,
  status,
  moveStock,
  type Medication,
  type MedicationInput,
  type Movement,
} from "./database";
export const fieldLabels = {
  name: "Medicamento",
  activeIngredient: "Princípio ativo",
  concentration: "Concentração",
  presentation: "Apresentação",
  unitOfMeasure: "Unidade",
  currentQuantity: "Quantidade",
  minimumStock: "Estoque mínimo",
  internalCode: "Código interno",
  notes: "Observações",
};
export type Field = keyof typeof fieldLabels;
export type Mapping = Partial<Record<Field, string | undefined>>;
const synonyms: Record<Field, string[]> = {
  name: ["medicamento", "nome", "produto", "descricao", "item"],
  activeIngredient: ["principio ativo", "composicao", "substancia"],
  concentration: ["concentracao", "dosagem"],
  presentation: ["apresentacao", "forma farmaceutica"],
  unitOfMeasure: ["unidade", "unidade de medida"],
  currentQuantity: ["quantidade", "qtd", "estoque", "saldo", "total", "quantidade atual"],
  minimumStock: ["estoque minimo", "minimo", "min"],
  internalCode: ["codigo", "codigo interno", "referencia"],
  notes: ["observacoes", "notas"],
};
const clean = (s: string) =>
  normalize(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
export function autoMap(headers: string[]): Mapping {
  const mapping: Mapping = {};
  for (const field of Object.keys(synonyms) as Field[]) {
    const header = headers.find((h) => synonyms[field].includes(clean(h)));
    if (header) mapping[field] = header;
  }
  return mapping;
}
export function parseQuantity(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string" || !value.trim()) return NaN;
  const text = value.trim();
  return Number(text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text);
}
export type ImportRow = {
  index: number;
  item: MedicationInput;
  error: string;
  matchId?: string | undefined;
  duplicate: boolean;
  providedFields: Field[];
};
export function prepareRows(
  rows: Record<string, unknown>[],
  mapping: Mapping,
  meds: Medication[],
): ImportRow[] {
  const seen = new Set<string>();
  return rows.map((row, index) => {
    const text = (field: Field) => String(row[mapping[field] ?? ""] ?? "").trim();
    const item: MedicationInput = {
      name: text("name"),
      activeIngredient: text("activeIngredient"),
      concentration: text("concentration"),
      presentation: text("presentation"),
      unitOfMeasure: text("unitOfMeasure") || "Unidade",
      currentQuantity: parseQuantity(row[mapping.currentQuantity ?? ""]),
      minimumStock:
        mapping.minimumStock && text("minimumStock") ? parseQuantity(row[mapping.minimumStock]) : 0,
      internalCode: text("internalCode"),
      notes: text("notes"),
    };
    const code = normalize(item.internalCode);
    const matches = code ? meds.filter((m) => normalize(m.internalCode) === code) : [];
    const candidates = matches.length
      ? matches
      : meds.filter((m) => normalize(m.name) === normalize(item.name));
    let error = "";
    if (!item.name) error = "Nome ausente";
    else if (!Number.isFinite(item.currentQuantity) || item.currentQuantity < 0)
      error = "Quantidade inválida";
    else if (!Number.isFinite(item.minimumStock) || item.minimumStock < 0)
      error = "Estoque mínimo inválido";
    else if (candidates.length > 1) error = "Correspondência ambígua: confira o código interno";
    else if (
      candidates[0] &&
      code &&
      candidates[0].internalCode &&
      normalize(candidates[0].internalCode) !== code
    )
      error = "Código diferente do item existente";
    const key = candidates[0]?.id ?? (code || normalize(item.name));
    const duplicate = seen.has(key);
    if (duplicate) error = "Medicamento duplicado na planilha";
    seen.add(key);
    return {
      index: index + 2,
      item,
      error,
      matchId: candidates[0]?.id,
      duplicate,
      providedFields: (Object.keys(fieldLabels) as Field[]).filter(
        (field) => !!mapping[field] && text(field) !== "",
      ),
    };
  });
}
export type Strategy = "update" | "add" | "replace";
export async function applyImport(rows: ImportRow[], strategy: Strategy, mapping: Mapping) {
  await db().transaction("rw", db().medications, db().movements, async () => {
    for (const row of rows) {
      if (row.error) throw new Error("Remova as linhas inválidas antes de importar.");
      numberValid(row.item.currentQuantity);
      const current = row.matchId ? await db().medications.get(row.matchId) : undefined;
      if (row.matchId && !current) throw new Error("O estoque foi alterado. Revise a importação.");
      if (current) {
        const details: Partial<Medication> = { updatedAt: new Date().toISOString() };
        for (const field of Object.keys(fieldLabels) as Field[])
          if (field !== "currentQuantity" && mapping[field] && row.providedFields.includes(field))
            Object.assign(details, { [field]: row.item[field] });
        await db().medications.update(current.id, details);
        if (strategy === "add" && row.item.currentQuantity > 0)
          await moveStock(
            current.id,
            "importacao",
            row.item.currentQuantity,
            "Quantidade somada por importação de planilha",
          );
        if (strategy === "replace")
          await moveStock(
            current.id,
            "reconciliacao",
            row.item.currentQuantity,
            "Reconciliação por importação de planilha",
          );
      } else {
        const now = new Date().toISOString();
        const med: Medication = {
          ...row.item,
          id: crypto.randomUUID(),
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };
        await db().medications.add(med);
        await db().movements.add({
          id: crypto.randomUUID(),
          medicationId: med.id,
          medicationName: med.name,
          type: "importacao",
          quantity: med.currentQuantity,
          previousBalance: 0,
          resultingBalance: med.currentQuantity,
          notes: "Cadastro por importação de planilha",
          createdAt: now,
        });
      }
    }
  });
}
export const typeLabels: Record<string, string> = {
  entrada: "Entrada",
  saida: "Saída",
  ajuste: "Ajuste",
  importacao: "Importação",
  reconciliacao: "Reconciliação",
};
export function stockWorkbook(meds: Medication[], moves: Movement[]) {
  const wb = XLSX.utils.book_new();
  const active = meds.filter((m) => m.isActive);
  const sheets: [string, Record<string, unknown>[]][] = [
    [
      "Estoque Atual",
      meds.map((m) => ({
        Código: m.internalCode,
        Medicamento: m.name,
        "Princípio Ativo": m.activeIngredient,
        Concentração: m.concentration,
        Apresentação: m.presentation,
        Unidade: m.unitOfMeasure,
        "Quantidade Atual": m.currentQuantity,
        "Estoque Mínimo": m.minimumStock,
        Status: !m.isActive
          ? "Inativo"
          : { normal: "Normal", baixo: "Baixo", zerado: "Zerado" }[status(m)],
      })),
    ],
    [
      "Histórico de Movimentações",
      moves.map((m) => ({
        ID: m.id,
        Data: format(new Date(m.createdAt), "dd/MM/yyyy"),
        Hora: format(new Date(m.createdAt), "HH:mm:ss"),
        Medicamento: m.medicationName,
        Tipo: typeLabels[m.type],
        Quantidade: m.quantity,
        "Saldo Anterior": m.previousBalance,
        "Saldo Final": m.resultingBalance,
        Observações: m.notes,
      })),
    ],
    [
      "Resumo",
      [
        { Indicador: "Total de medicamentos", Valor: active.length },
        {
          Indicador: "Total de unidades",
          Valor: active.reduce((n, m) => n + m.currentQuantity, 0),
        },
        { Indicador: "Estoque baixo", Valor: active.filter((m) => status(m) === "baixo").length },
        { Indicador: "Estoque zerado", Valor: active.filter((m) => status(m) === "zerado").length },
        { Indicador: "Total de movimentações", Valor: moves.length },
      ],
    ],
  ];
  for (const [name, rows] of sheets) {
    const sheet = XLSX.utils.json_to_sheet(
      rows.length
        ? rows
        : [
            name === "Estoque Atual"
              ? {
                  Código: "",
                  Medicamento: "",
                  "Princípio Ativo": "",
                  Concentração: "",
                  Apresentação: "",
                  Unidade: "",
                  "Quantidade Atual": "",
                  "Estoque Mínimo": "",
                  Status: "",
                }
              : name === "Histórico de Movimentações"
                ? {
                    ID: "",
                    Data: "",
                    Hora: "",
                    Medicamento: "",
                    Tipo: "",
                    Quantidade: "",
                    "Saldo Anterior": "",
                    "Saldo Final": "",
                    Observações: "",
                  }
                : {},
          ],
    );
    sheet["!cols"] = Array.from({ length: 12 }, () => ({ wch: 24 }));
    const range = sheet["!ref"];
    if (range) sheet["!autofilter"] = { ref: range };
    if (range) {
      const bounds = XLSX.utils.decode_range(range);
      for (let column = bounds.s.c; column <= bounds.e.c; column++) {
        const cell = sheet[XLSX.utils.encode_cell({ r: 0, c: column })];
        if (cell)
          cell.s = {
            font: { name: "Arial", sz: 11, bold: true, color: { rgb: "F5F9F7" } },
            fill: { patternType: "solid", fgColor: { rgb: "285C55" } },
            alignment: { vertical: "center", wrapText: true },
          };
      }
      sheet["!rows"] = [{ hpt: 30 }];
    }
    XLSX.utils.book_append_sheet(wb, sheet, name);
  }
  return wb;
}
export function exportStock(meds: Medication[], moves: Movement[], filename: string) {
  StyledXLSX.writeFile(stockWorkbook(meds, moves), filename);
}
export function downloadJson(value: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
