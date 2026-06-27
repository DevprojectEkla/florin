import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { TransactionWithCategory } from '../../db/transactions';

interface TransactionChartsProps {
  transactions: TransactionWithCategory[];
}

const COLORS = [
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#f97316', // orange-500
];

export default function TransactionCharts({ transactions }: TransactionChartsProps) {
  const { t } = useTranslation();

  // Calculate data for charts
  const chartData = useMemo(() => {
    // 1. Transactions by category (pie chart)
    const byCategory = transactions.reduce((acc, tx) => {
      const categoryLabel = tx.category_label || t('transaction.unclassified');
      const amount = tx.debit || 0; // Only count expenses
      
      if (amount > 0) {
        if (!acc[categoryLabel]) {
          acc[categoryLabel] = {
            name: categoryLabel,
            value: 0,
            color: tx.category_color || '#64748b',
          };
        }
        acc[categoryLabel].value += amount;
      }
      return acc;
    }, {} as Record<string, { name: string; value: number; color: string }>);

    const categoryData = Object.values(byCategory)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 categories

    // 2. Top 5 expenses (bar chart)
    const expenseTransactions = transactions
      .filter(tx => tx.debit && tx.debit > 0)
      .sort((a, b) => (b.debit || 0) - (a.debit || 0))
      .slice(0, 5);

    const topExpenses = expenseTransactions.map(tx => ({
      name: (tx.label_clean || tx.label).slice(0, 25) + '...',
      amount: tx.debit || 0,
      category: tx.category_label || t('transaction.unclassified'),
      color: tx.category_color || '#64748b',
    }));

    // 3. Transactions over time (line chart - by day)
    const byDate = transactions.reduce((acc, tx) => {
      const date = tx.date.slice(0, 10); // YYYY-MM-DD
      if (!acc[date]) {
        acc[date] = { date, debit: 0, credit: 0, count: 0 };
      }
      acc[date].debit += tx.debit || 0;
      acc[date].credit += tx.credit || 0;
      acc[date].count += 1;
      return acc;
    }, {} as Record<string, { date: string; debit: number; credit: number; count: number }>);

    const timelineData = Object.values(byDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30); // Last 30 days

    return {
      categoryData,
      topExpenses,
      timelineData,
    };
  }, [transactions, t]);

  if (transactions.length === 0) {
    return (
      <div className="bg-slate-800/40 rounded-lg border border-slate-700/50 p-8 text-center text-slate-500">
        {t('common.empty')}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 1. Category Distribution (Pie Chart) */}
      <div className="bg-slate-800/40 rounded-lg border border-slate-700/50 p-4">
        <h3 className="text-sm font-medium text-slate-300 mb-3">
          📊 {t('charts.by_category')}
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={chartData.categoryData}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.categoryData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#e2e8f0',
              }}
              formatter={(value: number) => `${value.toFixed(0)} €`}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-2 space-y-1 text-xs">
          {chartData.categoryData.slice(0, 4).map((cat, idx) => (
            <div key={idx} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="text-slate-400 truncate">{cat.name}</span>
              </div>
              <span className="text-slate-300 font-mono">{cat.value.toFixed(0)}€</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Top 5 Expenses (Bar Chart) */}
      <div className="bg-slate-800/40 rounded-lg border border-slate-700/50 p-4">
        <h3 className="text-sm font-medium text-slate-300 mb-3">
          💰 {t('charts.top_expenses')}
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData.topExpenses} layout="vertical">
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" hide />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#e2e8f0',
              }}
              formatter={(value: number) => `${value.toFixed(2)} €`}
            />
            <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
              {chartData.topExpenses.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-2 space-y-1 text-xs">
          {chartData.topExpenses.map((exp, idx) => (
            <div key={idx} className="flex items-center justify-between">
              <span className="text-slate-400 truncate flex-1">{exp.name}</span>
              <span className="text-red-400 font-mono ml-2">{exp.amount.toFixed(0)}€</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Timeline (Line Chart) */}
      <div className="bg-slate-800/40 rounded-lg border border-slate-700/50 p-4">
        <h3 className="text-sm font-medium text-slate-300 mb-3">
          📈 {t('charts.timeline')}
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData.timelineData}>
            <XAxis
              dataKey="date"
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickFormatter={(value) => value.slice(5)} // Show MM-DD
            />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#e2e8f0',
              }}
              labelFormatter={(value) => `Date: ${value}`}
              formatter={(value: number, name: string) =>
                name === 'count'
                  ? [`${value} tx`, t('charts.transactions')]
                  : [`${value.toFixed(0)} €`, name === 'debit' ? t('transaction.debit') : t('transaction.credit')]
              }
            />
            <Line
              type="monotone"
              dataKey="debit"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="credit"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-2 flex items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-red-500" />
            <span className="text-slate-400">{t('transaction.debit')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-emerald-500" />
            <span className="text-slate-400">{t('transaction.credit')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
