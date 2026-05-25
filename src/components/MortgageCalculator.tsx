"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { calculate, formatMoney, formatMonths, MortgageParams } from "@/lib/mortgage";

const DEFAULT_PARAMS: MortgageParams = {
  propertyPrice: 12_000_000,
  downPayment: 3_000_000,
  annualRate: 12,
  totalMonthlyBudget: 120_000,
  earlyRepaymentType: "reduce_term",
  expectedAppreciationPercent: 8,
};

function NumericInput({
  label,
  value,
  onChange,
  suffix,
  min,
  max,
  step,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}) {
  const [raw, setRaw] = useState(String(value));

  const handleChange = (s: string) => {
    setRaw(s);
    const n = parseFloat(s.replace(/\s/g, "").replace(",", "."));
    if (!isNaN(n)) onChange(n);
  };

  const handleBlur = () => {
    setRaw(String(value));
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="relative">
        <Input
          className="pr-12"
          value={raw}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          min={min}
          max={max}
          step={step}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
  accent,
}: {
  title: string;
  value: string;
  sub?: string;
  accent?: "green" | "red" | "blue" | "default";
}) {
  const accentClass = {
    green: "text-emerald-600",
    red: "text-rose-600",
    blue: "text-blue-600",
    default: "",
  }[accent ?? "default"];

  return (
    <Card className="flex flex-col gap-1 p-4">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
      <p className={`text-2xl font-bold tabular-nums ${accentClass}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

const CHART_TICK_COUNT = 24;

function buildChartData(schedule: ReturnType<typeof calculate>["schedule"]) {
  if (!schedule.length) return [];
  const step = Math.max(1, Math.floor(schedule.length / CHART_TICK_COUNT));
  const points = [];
  for (let i = step - 1; i < schedule.length; i += step) {
    const s = schedule[i];
    points.push({
      month: s.month,
      balance: Math.round(s.balance / 1000),
      interest: Math.round(s.totalInterestPaid / 1000),
      paid: Math.round(s.totalPaid / 1000),
    });
  }
  const last = schedule[schedule.length - 1];
  if (points[points.length - 1]?.month !== last.month) {
    points.push({
      month: last.month,
      balance: 0,
      interest: Math.round(last.totalInterestPaid / 1000),
      paid: Math.round(last.totalPaid / 1000),
    });
  }
  return points;
}

function buildPaymentBreakdown(
  schedule: ReturnType<typeof calculate>["schedule"],
  loanAmount: number,
  downPayment: number,
  propertyValueAtEnd: number
) {
  return [
    { name: "Тело кредита", value: Math.round(loanAmount / 1000), fill: "#3b82f6" },
    {
      name: "Переплата %",
      value: Math.round((schedule[schedule.length - 1]?.totalInterestPaid ?? 0) / 1000),
      fill: "#f59e0b",
    },
    { name: "Первоначальный взнос", value: Math.round(downPayment / 1000), fill: "#10b981" },
    { name: "Ст-ть квартиры в конце", value: Math.round(propertyValueAtEnd / 1000), fill: "#8b5cf6" },
  ];
}

export function MortgageCalculator() {
  const [params, setParams] = useState<MortgageParams>(DEFAULT_PARAMS);

  const set = (key: keyof MortgageParams) => (v: number | string) =>
    setParams((p) => ({ ...p, [key]: v }));

  const result = useMemo(() => calculate(params), [params]);
  const chartData = useMemo(() => buildChartData(result.schedule), [result.schedule]);
  const breakdown = useMemo(
    () =>
      buildPaymentBreakdown(
        result.schedule,
        result.loanAmount,
        params.downPayment,
        result.propertyValueAtEnd
      ),
    [result, params.downPayment]
  );

  const roiPositive = result.roi > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <h1 className="text-xl font-bold">Ипотечный калькулятор</h1>
        <p className="text-sm text-muted-foreground">Аналитика и инвестиционный потенциал</p>
      </header>

      <div className="flex flex-col lg:flex-row gap-0">
        {/* Sidebar – parameters */}
        <aside className="w-full lg:w-80 shrink-0 border-r p-6 space-y-5 bg-muted/30">
          <div>
            <h2 className="text-sm font-semibold mb-4 uppercase tracking-wide text-muted-foreground">
              Параметры
            </h2>
            <div className="space-y-4">
              <NumericInput
                label="Цена квартиры"
                value={params.propertyPrice}
                onChange={set("propertyPrice")}
                suffix="₽"
                hint={formatMoney(params.propertyPrice)}
              />
              <NumericInput
                label="Первоначальный взнос"
                value={params.downPayment}
                onChange={set("downPayment")}
                suffix="₽"
                hint={`${((params.downPayment / params.propertyPrice) * 100).toFixed(1)}% от стоимости · ${formatMoney(params.downPayment)}`}
              />
              <NumericInput
                label="Ставка по ипотеке"
                value={params.annualRate}
                onChange={set("annualRate")}
                suffix="%"
                step={0.1}
              />
              <NumericInput
                label="Ежемесячный бюджет"
                value={params.totalMonthlyBudget}
                onChange={set("totalMonthlyBudget")}
                suffix="₽"
                hint={`Мин. платёж: ${formatMoney(result.monthlyPayment)}`}
              />
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Тип досрочного погашения</Label>
            <div className="mt-2 flex flex-col gap-2">
              {(["reduce_term", "reduce_payment"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => set("earlyRepaymentType")(type)}
                  className={`text-left px-3 py-2 rounded-md border text-sm transition-colors ${
                    params.earlyRepaymentType === type
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-accent"
                  }`}
                >
                  {type === "reduce_term" ? "↓ Уменьшить срок" : "↓ Уменьшить платёж"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold mb-3 uppercase tracking-wide text-muted-foreground">
              Инвестиции
            </h2>
            <NumericInput
              label="Ожидаемый прирост стоимости в год"
              value={params.expectedAppreciationPercent}
              onChange={set("expectedAppreciationPercent")}
              suffix="%"
              step={0.5}
              hint="Среднегодовой рост цены квартиры"
            />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6 space-y-6">
          {/* Key metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            <StatCard title="Сумма кредита" value={formatMoney(result.loanAmount)} />
            <StatCard
              title="Минимальный платёж"
              value={formatMoney(result.monthlyPayment)}
              sub="Аннуитет на 30 лет"
            />
            <StatCard
              title="Срок"
              value={formatMonths(result.totalMonths)}
              accent="blue"
            />
            <StatCard
              title="Всего выплачено"
              value={formatMoney(result.totalPaid)}
            />
            <StatCard
              title="Переплата"
              value={formatMoney(result.totalInterest)}
              sub={`${((result.totalInterest / result.loanAmount) * 100).toFixed(0)}% от суммы кредита`}
              accent="red"
            />
            <StatCard
              title="Средняя переплата/мес"
              value={formatMoney(result.avgMonthlyOverpayment)}
              sub="Переплата ÷ срок"
            />
          </div>

          {/* Investment block */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                Инвестиционный потенциал
                <Badge variant={roiPositive ? "default" : "destructive"}>
                  {roiPositive ? "Выгодно" : "Убыток"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Стоимость через {formatMonths(result.totalMonths)}</p>
                  <p className="text-lg font-bold text-violet-600">{formatMoney(result.propertyValueAtEnd)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Прирост стоимости</p>
                  <p className="text-lg font-bold text-emerald-600">+{formatMoney(result.investmentReturn)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ROI на все вложения</p>
                  <p className={`text-lg font-bold ${roiPositive ? "text-emerald-600" : "text-rose-600"}`}>
                    {result.roi > 0 ? "+" : ""}
                    {result.roi.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    взнос + платежи = {formatMoney(result.totalInvested)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Charts */}
          <Tabs defaultValue="balance">
            <TabsList>
              <TabsTrigger value="balance">Остаток долга</TabsTrigger>
              <TabsTrigger value="interest">Накопленные проценты</TabsTrigger>
              <TabsTrigger value="breakdown">Структура</TabsTrigger>
            </TabsList>

            <TabsContent value="balance" className="pt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground font-medium">
                    Остаток долга по месяцам (тыс ₽)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} label={{ value: "Месяц", position: "insideBottom", offset: -2, fontSize: 11 }} height={30} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => [`${v} тыс ₽`, "Остаток"]} labelFormatter={(l) => `Месяц ${l}`} />
                      <Area type="monotone" dataKey="balance" stroke="#3b82f6" fill="url(#balGrad)" strokeWidth={2} name="Остаток" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="interest" className="pt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground font-medium">
                    Накопленные проценты vs выплаченная сумма (тыс ₽)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="paidGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="intGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} label={{ value: "Месяц", position: "insideBottom", offset: -2, fontSize: 11 }} height={30} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v, n) => [`${v} тыс ₽`, n]} labelFormatter={(l) => `Месяц ${l}`} />
                      <Legend />
                      <Area type="monotone" dataKey="paid" stroke="#10b981" fill="url(#paidGrad)" strokeWidth={2} name="Всего выплачено" />
                      <Area type="monotone" dataKey="interest" stroke="#f59e0b" fill="url(#intGrad)" strokeWidth={2} name="Из них проценты" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="breakdown" className="pt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground font-medium">
                    Структура расходов (тыс ₽)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={breakdown} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={150} />
                      <Tooltip formatter={(v) => `${v} тыс ₽`} />
                      <Bar dataKey="value" name="Сумма">
                        {breakdown.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
