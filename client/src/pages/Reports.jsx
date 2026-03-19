import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, IndianRupee, Package, CreditCard } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { reportsApi } from '../api/reports.api';
import useShopStore from '../store/shopStore';
import StatCard from '../components/StatCard';
import LoadingSpinner from '../components/LoadingSpinner';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function Reports() {
  const { activeShop } = useShopStore();
  const shopId = activeShop?._id;

  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate,   setEndDate]   = useState(format(new Date(), 'yyyy-MM-dd'));
  const [groupBy,   setGroupBy]   = useState('day');

  const params = { shopId, startDate, endDate };

  const { data: plData, isLoading: plLoading } = useQuery({
    queryKey: ['profit-loss', shopId, startDate, endDate],
    queryFn: () => reportsApi.profitLoss(params),
  });

  const { data: trendData, isLoading: trendLoading } = useQuery({
    queryKey: ['sales-trend', shopId, groupBy, startDate, endDate],
    queryFn: () => reportsApi.salesTrend({ ...params, groupBy }),
  });

  const { data: bestsData } = useQuery({
    queryKey: ['best-sellers', shopId, startDate, endDate],
    queryFn: () => reportsApi.bestSellers({ ...params, limit: 8 }),
  });

  const { data: payData } = useQuery({
    queryKey: ['payment-breakdown', shopId, startDate, endDate],
    queryFn: () => reportsApi.paymentBreakdown(params),
  });

  const pl = plData?.data || {};
  const trend = (trendData?.data?.trend || []).map((t) => ({
    name: t._id.day ? `${t._id.day}/${t._id.month}` : `${t._id.month}`,
    Revenue: Math.round(t.revenue),
    Profit:  Math.round(t.profit),
    Orders:  t.count,
  }));

  const bestSellers = bestsData?.data?.products || [];
  const payBreakdown = payData?.data?.breakdown || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-sm text-gray-500">{activeShop?.name || 'All shops'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" value={endDate}   onChange={(e) => setEndDate(e.target.value)}   className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="day">Daily</option>
            <option value="month">Monthly</option>
          </select>
        </div>
      </div>

      {/* P&L cards */}
      {plLoading ? <div className="flex justify-center py-8"><LoadingSpinner /></div> : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={IndianRupee} label="Revenue"      value={fmt(pl.revenue)}     color="blue"   />
          <StatCard icon={TrendingUp}  label="Gross Profit" value={fmt(pl.grossProfit)} color="green"  />
          <StatCard icon={Package}     label="Expenses"     value={fmt(pl.expenses)}    color="red"    />
          <StatCard icon={CreditCard}  label="Net Profit"   value={fmt(pl.netProfit)}   color={pl.netProfit >= 0 ? 'green' : 'red'} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales trend */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Sales Trend</h3>
          {trendLoading ? <div className="flex justify-center py-8"><LoadingSpinner /></div> : trend.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={trend} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v, name) => name === 'Orders' ? v : fmt(v)} />
                <Legend />
                <Bar dataKey="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Profit"  fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">No data for this period</div>
          )}
        </div>

        {/* Payment breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Payment Methods</h3>
          {payBreakdown.length ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={payBreakdown.map((p) => ({ name: p._id, value: p.total }))} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {payBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {payBreakdown.map((p, i) => (
                  <div key={p._id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="capitalize">{p._id}</span>
                    </span>
                    <span className="font-medium">{fmt(p.total)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <div className="text-center py-8 text-gray-400 text-sm">No payment data</div>}
        </div>
      </div>

      {/* Best sellers */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-4">🏆 Best Selling Products</h3>
        {bestSellers.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-gray-500 border-b">
                <tr>
                  <th className="text-left py-2 pr-4">#</th>
                  <th className="text-left py-2 pr-4">Product</th>
                  <th className="text-right py-2 pr-4">Qty Sold</th>
                  <th className="text-right py-2 pr-4">Revenue</th>
                  <th className="text-right py-2">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bestSellers.map((p, i) => (
                  <tr key={p._id} className="hover:bg-gray-50">
                    <td className="py-2.5 pr-4">
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    </td>
                    <td className="py-2.5 pr-4 font-medium text-gray-900">{p.name}</td>
                    <td className="py-2.5 pr-4 text-right text-gray-600">{p.totalQty}</td>
                    <td className="py-2.5 pr-4 text-right font-semibold text-blue-600">{fmt(p.totalRevenue)}</td>
                    <td className="py-2.5 text-right font-semibold text-green-600">{fmt(p.totalProfit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="text-center py-8 text-gray-400 text-sm">No sales data for this period</div>}
      </div>
    </div>
  );
}
