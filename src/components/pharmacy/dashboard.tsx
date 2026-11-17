import { useState } from "react";
import { Link, useHydrated } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CircleAlert,
  ClipboardList,
  Package,
  Plus,
  TriangleAlert,
  Upload,
  Boxes,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInventory } from "./store";
import {
  PageHeading,
  EmptyState,
  StockBadge,
  LoadingState,
  num,
  dateLabel,
  timeLabel,
} from "./shared";
import { MedicationForm, MovementForm, perform } from "./forms";
import { addSamples, status, summary } from "@/lib/pharmacy/database";
import { typeLabels } from "@/lib/pharmacy/excel";
export function Dashboard() {
  const hydrated = useHydrated();
  const { meds, moves, ready, error } = useInventory();
  const [form, setForm] = useState(false);
  const [movement, setMovement] = useState(false);
  const stats = summary(meds, moves, new Date().toLocaleDateString("pt-BR"));
  const alerts = meds
    .filter((m) => m.isActive && status(m) !== "normal")
    .sort((a, b) => a.currentQuantity - b.currentQuantity);
  const cards = [
    {
      label: "Total de Medicamentos",
      value: stats.total,
      unit: "itens cadastrados",
      icon: Package,
      tone: "navy",
    },
    {
      label: "Unidades em Estoque",
      value: stats.units,
      unit: "unidades disponíveis",
      icon: Boxes,
      tone: "green",
    },
    {
      label: "Estoque Baixo",
      value: stats.low,
      unit: "itens precisam de atenção",
      icon: TriangleAlert,
      tone: "amber",
    },
    {
      label: "Estoque Zerado",
      value: stats.zero,
      unit: "itens sem disponibilidade",
      icon: CircleAlert,
      tone: "red",
    },
    {
      label: "Movimentações Hoje",
      value: stats.today,
      unit: "entradas e saídas",
      icon: ArrowLeftRight,
      tone: "blue",
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="PAINEL DE CONTROLE"
        title="Visão Geral"
        description="Um olhar completo sobre o estoque da sua farmácia."
      >
        <Button variant="outline" asChild>
          <Link to="/importar">
            <Upload />
            Importar planilha
          </Link>
        </Button>
        <Button onClick={() => setForm(true)}>
          <Plus />
          Novo medicamento
        </Button>
      </PageHeading>
      <div className="dashboard-date">
        <span className="local-dot" />
        Estoque atualizado em tempo real
        <span className="date-right">
          <CalendarDays size={14} />
          {hydrated
            ? new Date().toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })
            : "—"}
        </span>
      </div>
      <LoadingState ready={ready} error={error} />
      <section className="stats-grid">
        {cards.map(({ label, value, unit, icon: Icon, tone }) => (
          <article className="stat-card" key={label}>
            <div className="stat-top">
              <span>{label}</span>
              <span className={`stat-icon tone-${tone}`}>
                <Icon size={18} />
              </span>
            </div>
            <strong className="stat-value">{num(value)}</strong>
            <small>{unit}</small>
          </article>
        ))}
      </section>
      <section className="quick-band">
        <div>
          <span className="quick-icon">
            <ArrowLeftRight size={20} />
          </span>
          <div>
            <h3>Registrar uma movimentação</h3>
            <p>Entradas, saídas e ajustes de estoque em um só lugar.</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => setMovement(true)}
          disabled={!meds.some((m) => m.isActive)}
        >
          Movimentar estoque
          <ArrowRight />
        </Button>
      </section>
      <div className="dashboard-columns">
        <section className="data-section">
          <div className="section-heading">
            <div>
              <h2>
                <TriangleAlert size={18} />
                Alertas de Estoque <span className="count-pill">{alerts.length}</span>
              </h2>
              <p>Medicamentos que precisam da sua atenção.</p>
            </div>
            <Button variant="link" asChild>
              <Link to="/estoque">
                Ver estoque
                <ArrowRight />
              </Link>
            </Button>
          </div>
          {alerts.length ? (
            <div className="alerts-list">
              {alerts.slice(0, 5).map((m) => (
                <div className="alert-row" key={m.id}>
                  <span
                    className={`alert-item-icon tone-${status(m) === "zerado" ? "red" : "amber"}`}
                  >
                    <Package size={18} />
                  </span>
                  <div className="alert-name">
                    <strong>{m.name}</strong>
                    <small>
                      {m.concentration} {m.concentration && m.presentation ? "·" : ""}{" "}
                      {m.presentation}
                    </small>
                  </div>
                  <div className="alert-balance">
                    <strong>
                      {num(m.currentQuantity)} <small>{m.unitOfMeasure.toLowerCase()}(s)</small>
                    </strong>
                    <small>Mínimo: {num(m.minimumStock)}</small>
                  </div>
                  <StockBadge med={m} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={ShieldCheck}
              title={stats.total ? "Estoque em dia" : "Nenhum alerta por aqui"}
              description={
                stats.total
                  ? "Todos os medicamentos estão acima do estoque mínimo."
                  : "Os alertas aparecerão quando houver itens com estoque baixo ou zerado."
              }
            />
          )}
          <div className="section-foot">
            <span className="status-dot-warning" />
            Estoque baixo: quantidade igual ou inferior ao mínimo.
          </div>
        </section>
        <section className="data-section">
          <div className="section-heading">
            <div>
              <h2>
                <ArrowLeftRight size={18} />
                Últimas Movimentações
              </h2>
              <p>Os registros mais recentes do seu estoque.</p>
            </div>
            <Button variant="link" asChild>
              <Link to="/movimentacoes">
                Ver histórico
                <ArrowRight />
              </Link>
            </Button>
          </div>
          {moves.length ? (
            <div className="recent-list">
              {moves.slice(0, 5).map((m) => (
                <div className="recent-row" key={m.id}>
                  <span className={`movement-icon ${m.quantity < 0 ? "tone-red" : "tone-green"}`}>
                    {m.quantity < 0 ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                  </span>
                  <div>
                    <strong>{m.medicationName}</strong>
                    <small>
                      {typeLabels[m.type]} · {dateLabel(m.createdAt)} às {timeLabel(m.createdAt)}
                    </small>
                  </div>
                  <div className="recent-quantity">
                    <strong className={m.quantity < 0 ? "text-destructive" : "text-success"}>
                      {m.quantity > 0 ? "+" : ""}
                      {num(m.quantity)}
                    </strong>
                    <small>Saldo: {num(m.resultingBalance)}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={ClipboardList}
              title="Nenhuma movimentação ainda"
              description="As entradas, saídas e ajustes registrados aparecerão aqui."
            />
          )}
          <div className="section-foot">
            <ShieldCheck size={13} />
            Histórico preservado automaticamente neste computador.
          </div>
        </section>
      </div>
      {ready && !meds.length && (
        <section className="first-steps">
          <div className="first-steps-text">
            <span className="first-step-icon">
              <Package size={22} />
            </span>
            <div>
              <h3>Seu estoque começa aqui</h3>
              <p>Cadastre o primeiro medicamento ou importe sua planilha atual.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void perform(addSamples, "Dados de exemplo adicionados.")}
            >
              <Sparkles />
              Experimentar com exemplos
            </Button>
            <Button variant="outline" onClick={() => setForm(true)}>
              Cadastrar primeiro item
              <ArrowRight />
            </Button>
          </div>
        </section>
      )}
      <div className="backup-reminder">
        <ShieldCheck size={17} />
        <span>
          Seu estoque, sob seu controle. Faça backups periódicos para manter seus dados seguros.
        </span>
        <Link to="/backup">
          Criar backup
          <ArrowRight size={14} />
        </Link>
      </div>
      {form && <MedicationForm onClose={() => setForm(false)} />}{" "}
      {movement && <MovementForm meds={meds} onClose={() => setMovement(false)} />}
    </>
  );
}
