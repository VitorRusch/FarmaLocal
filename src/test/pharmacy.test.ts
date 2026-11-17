import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { webcrypto } from "node:crypto";
import * as XLSX from "xlsx";
import {
  db,
  saveMedication,
  moveStock,
  removeMedication,
  calculateBalance,
  status,
  summary,
  createBackup,
  restoreBackup,
  validateBackup,
  addSamples,
  clearSamples,
  type MedicationInput,
} from "@/lib/pharmacy/database";
import { autoMap, prepareRows, applyImport, stockWorkbook } from "@/lib/pharmacy/excel";
Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
const input: MedicationInput = {
  name: "Dipirona",
  internalCode: "D01",
  activeIngredient: "Dipirona",
  concentration: "500 mg",
  presentation: "Comprimido",
  unitOfMeasure: "Comprimido",
  currentQuantity: 10,
  minimumStock: 3,
  notes: "",
};
beforeEach(async () => {
  await db().medications.clear();
  await db().movements.clear();
  await db().settings.clear();
});
describe("Local pharmacy rules", () => {
  it("starts with no medications or movements", async () => {
    expect(await db().medications.count()).toBe(0);
    expect(await db().movements.count()).toBe(0);
  });
  it("rejects negative stock", () => {
    expect(() => calculateBalance(2, 3, "saida")).toThrow();
    expect(() => calculateBalance(0, -1, "entrada")).toThrow();
  });
  it("requires positive incoming and outgoing amounts", () => {
    expect(() => calculateBalance(2, 0, "entrada")).toThrow();
    expect(() => calculateBalance(2, 0, "saida")).toThrow();
  });
  it("low stock includes the minimum but excludes zero", () => {
    expect(status({ currentQuantity: 3, minimumStock: 3 })).toBe("baixo");
    expect(status({ currentQuantity: 0, minimumStock: 3 })).toBe("zerado");
    expect(status({ currentQuantity: 4, minimumStock: 3 })).toBe("normal");
  });
  it("records initial stock and transactional incoming/outgoing", async () => {
    const med = await saveMedication(input);
    await moveStock(med.id, "entrada", 5);
    await moveStock(med.id, "saida", 4);
    expect((await db().medications.get(med.id))?.currentQuantity).toBe(11);
    expect(await db().movements.count()).toBe(3);
    await expect(moveStock(med.id, "saida", 12)).rejects.toThrow();
    expect(await db().movements.count()).toBe(3);
  });
  it("records +1 and -1 quick operations", async () => {
    const m = await saveMedication(input);
    await moveStock(m.id, "entrada", 1);
    await moveStock(m.id, "saida", 1);
    expect(await db().movements.count()).toBe(3);
    expect((await db().medications.get(m.id))?.currentQuantity).toBe(10);
  });
  it("requires a reason for adjustment and preserves balances", async () => {
    const m = await saveMedication(input);
    await expect(moveStock(m.id, "ajuste", 4)).rejects.toThrow();
    await moveStock(m.id, "ajuste", 4, "Contagem física");
    const movement = (await db().movements.toArray()).find((x) => x.type === "ajuste");
    expect(movement).toMatchObject({
      previousBalance: 10,
      resultingBalance: 4,
      quantity: -6,
      notes: "Contagem física",
    });
  });
  it("editing quantity creates an adjustment", async () => {
    const m = await saveMedication(input);
    await expect(saveMedication({ ...input, currentQuantity: 8 }, m.id)).rejects.toThrow();
    await saveMedication(
      { ...input, name: "Dipirona editada", currentQuantity: 8 },
      m.id,
      false,
      "Conferência",
    );
    expect(await db().movements.count()).toBe(2);
  });
  it("forbids duplicate codes even after explicit name confirmation", async () => {
    await saveMedication(input);
    await expect(saveMedication({ ...input, name: "Outro" }, undefined, true)).rejects.toThrow();
  });
  it("requires explicit confirmation for repeated names", async () => {
    await saveMedication(input);
    await expect(saveMedication({ ...input, internalCode: "D02" })).rejects.toThrow(
      "DUPLICATE_NAME",
    );
    await saveMedication({ ...input, internalCode: "D02" }, undefined, true);
    expect(await db().medications.count()).toBe(2);
  });
  it("never deletes medication history", async () => {
    const m = await saveMedication(input);
    await expect(removeMedication(m.id)).rejects.toThrow();
    expect(await db().medications.count()).toBe(1);
  });
  it("can delete an item without history", async () => {
    const m = await saveMedication({ ...input, currentQuantity: 0 });
    await removeMedication(m.id);
    expect(await db().medications.count()).toBe(0);
  });
  it("calculates totals and todays incoming/outgoing from records", async () => {
    await saveMedication(input);
    await saveMedication({ ...input, name: "Soro", internalCode: "S01", currentQuantity: 0 });
    await saveMedication({
      ...input,
      name: "Amoxicilina",
      internalCode: "A01",
      currentQuantity: 3,
    });
    expect(
      summary(
        await db().medications.toArray(),
        await db().movements.toArray(),
        new Date().toLocaleDateString("pt-BR"),
      ),
    ).toEqual({ total: 3, units: 13, low: 1, zero: 1, today: 2 });
  });
  it("recognizes different column names and validates rows", () => {
    const map = autoMap(["Produto", "Saldo", "Mínimo", "Código"]);
    expect(map).toMatchObject({
      name: "Produto",
      currentQuantity: "Saldo",
      minimumStock: "Mínimo",
      internalCode: "Código",
    });
    const rows = prepareRows(
      [
        { Produto: "A", Saldo: 3 },
        { Produto: "A", Saldo: 2 },
        { Produto: "B", Saldo: -1 },
        { Produto: "", Saldo: 4 },
      ],
      map,
      [],
    );
    expect(rows[0]?.error).toBe("");
    expect(rows[1]?.duplicate).toBe(true);
    expect(rows[2]?.error).toBeTruthy();
    expect(rows[3]?.error).toBeTruthy();
  });
  it("never merges ambiguous names", async () => {
    await saveMedication(input);
    await saveMedication({ ...input, internalCode: "D02" }, undefined, true);
    expect(
      prepareRows(
        [{ Nome: "Dipirona", Qtd: 2 }],
        { name: "Nome", currentQuantity: "Qtd" },
        await db().medications.toArray(),
      )[0]?.error,
    ).toContain("ambígua");
  });
  it("update import preserves current stock", async () => {
    const m = await saveMedication(input);
    const mapping = { name: "Nome", currentQuantity: "Qtd" };
    await applyImport(
      prepareRows([{ Nome: "Dipirona", Qtd: 100 }], mapping, [m]),
      "update",
      mapping,
    );
    expect((await db().medications.get(m.id))?.currentQuantity).toBe(10);
    expect(await db().movements.count()).toBe(1);
  });
  it("add import increases stock and records it", async () => {
    const m = await saveMedication(input);
    const mapping = { name: "Nome", currentQuantity: "Qtd" };
    await applyImport(prepareRows([{ Nome: "Dipirona", Qtd: 5 }], mapping, [m]), "add", mapping);
    expect((await db().medications.get(m.id))?.currentQuantity).toBe(15);
    expect(await db().movements.count()).toBe(2);
  });
  it("replace import reconciles stock with complete history", async () => {
    const m = await saveMedication(input);
    const mapping = { name: "Nome", currentQuantity: "Qtd" };
    await applyImport(
      prepareRows([{ Nome: "Dipirona", Qtd: 2 }], mapping, [m]),
      "replace",
      mapping,
    );
    expect((await db().medications.get(m.id))?.currentQuantity).toBe(2);
    expect((await db().movements.toArray()).find((x) => x.type === "reconciliacao")).toMatchObject({
      previousBalance: 10,
      resultingBalance: 2,
      quantity: -8,
    });
  });
  it("rolls back a partially invalid import", async () => {
    const mapping = { name: "Nome", currentQuantity: "Qtd" };
    await expect(
      applyImport(
        prepareRows(
          [
            { Nome: "A", Qtd: 5 },
            { Nome: "B", Qtd: -1 },
          ],
          mapping,
          [],
        ),
        "add",
        mapping,
      ),
    ).rejects.toThrow();
    expect(await db().medications.count()).toBe(0);
  });
  it("exports a real three-sheet workbook with numeric quantities", async () => {
    await saveMedication(input);
    const wb = stockWorkbook(await db().medications.toArray(), await db().movements.toArray());
    const roundtrip = XLSX.read(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
    expect(roundtrip.SheetNames).toEqual(["Estoque Atual", "Histórico de Movimentações", "Resumo"]);
    expect(roundtrip.Sheets["Estoque Atual"]?.["G2"]?.v).toBe(10);
  });
  it("blank mapped minimum stock and unit preserve existing values", async () => {
    const m = await saveMedication(input);
    const mapping = {
      name: "Nome",
      currentQuantity: "Qtd",
      minimumStock: "Min",
      unitOfMeasure: "Unidade",
    };
    await applyImport(
      prepareRows([{ Nome: "Dipirona", Qtd: 4, Min: "", Unidade: "" }], mapping, [m]),
      "update",
      mapping,
    );
    expect((await db().medications.get(m.id))?.minimumStock).toBe(3);
    expect((await db().medications.get(m.id))?.unitOfMeasure).toBe("Comprimido");
  });
  it("exports header filters and sorting over all rows in each worksheet", async () => {
    await saveMedication(input);
    await saveMedication({ ...input, name: "Paracetamol", internalCode: "P01" });
    const wb = stockWorkbook(await db().medications.toArray(), await db().movements.toArray());
    const roundtrip = XLSX.read(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
    expect(roundtrip.Sheets["Estoque Atual"]?.["!autofilter"]?.ref).toBe("A1:I3");
    expect(roundtrip.Sheets["Histórico de Movimentações"]?.["!autofilter"]?.ref).toBe("A1:I3");
    expect(roundtrip.Sheets["Resumo"]?.["!autofilter"]?.ref).toBe("A1:B6");
  });
  it("exports usable header filters even with an empty inventory", () => {
    const roundtrip = XLSX.read(XLSX.write(stockWorkbook([], []), { type: "array", bookType: "xlsx" }));
    expect(roundtrip.Sheets["Estoque Atual"]?.["!autofilter"]?.ref).toBe("A1:I2");
    expect(roundtrip.Sheets["Histórico de Movimentações"]?.["!autofilter"]?.ref).toBe("A1:I2");
  });
  it("backs up and restores medications, history, settings", async () => {
    await saveMedication(input);
    await db().settings.put({ id: "test", value: true });
    const backup = await createBackup();
    await db().medications.clear();
    await db().movements.clear();
    await restoreBackup(backup);
    expect(await db().medications.count()).toBe(1);
    expect(await db().movements.count()).toBe(1);
    expect((await db().settings.get("test"))?.value).toBe(true);
  });
  it("rejects incompatible and corrupt backups", async () => {
    const b = await createBackup();
    expect(() => validateBackup({ ...b, version: 2 })).toThrow();
    expect(() => validateBackup({})).toThrow();
  });
  it("clears samples without touching real inventory", async () => {
    await saveMedication({ ...input, name: "Real" });
    await addSamples();
    await clearSamples();
    expect((await db().medications.toArray()).map((x) => x.name)).toEqual(["Real"]);
    expect(await db().movements.count()).toBe(1);
  });
});
