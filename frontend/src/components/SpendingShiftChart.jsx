import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { formatCompactCurrency, formatCurrency } from '../utils/formatters';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-panel" style={{ padding: '12px' }}>
        <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color, margin: '4px 0', fontSize: '0.875rem' }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const SpendingShiftChart = ({ data, xAxisKey = 'name', bar1Key = 'inacbg', bar2Key = 'simulasi', title }) => {
  const isVertical = data && data.length > 8;
  const chartHeight = isVertical ? Math.max(500, data.length * 35) : 350;

  return (
    <div className="glass-card" style={{ padding: '24px', height: '100%' }}>
      <h3 className="text-secondary" style={{ marginBottom: '24px', fontSize: '1rem', fontWeight: 500 }}>{title}</h3>
      <div style={{ width: '100%', height: chartHeight, minHeight: `${chartHeight}px` }}>
        <ResponsiveContainer width="100%" height="100%" minHeight={chartHeight}>
          <BarChart
            layout={isVertical ? "vertical" : "horizontal"}
            data={data}
            margin={{ top: 20, right: 30, left: isVertical ? 0 : 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={!isVertical} horizontal={isVertical} />
            {isVertical ? (
              <>
                <XAxis type="number" tickFormatter={(val) => formatCompactCurrency(val)} tick={{ fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                <YAxis dataKey={xAxisKey} type="category" width={220} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
              </>
            ) : (
              <>
                <XAxis dataKey={xAxisKey} tick={{ fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(val) => formatCompactCurrency(val)} tick={{ fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} width={80} />
              </>
            )}
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(56, 189, 248, 0.05)' }} />
            <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '0.9rem', fontWeight: 500 }} iconType="circle" />
            {isVertical ? <ReferenceLine x={0} stroke="var(--glass-border)" /> : <ReferenceLine y={0} stroke="var(--glass-border)" />}
            <Bar 
              dataKey={bar1Key} 
              name="Tarif INA-CBG" 
              fill="url(#colorIna)" 
              radius={isVertical ? [0, 6, 6, 0] : [6, 6, 0, 0]} 
              barSize={isVertical ? 14 : 32} 
            />
            <Bar 
              dataKey={bar2Key} 
              name="Tarif Simulasi" 
              fill="url(#colorSim)" 
              radius={isVertical ? [0, 6, 6, 0] : [6, 6, 0, 0]} 
              barSize={isVertical ? 14 : 32} 
            />
            
            <defs>
              <linearGradient id="colorIna" x1="0" y1="0" x2={isVertical ? "1" : "0"} y2={isVertical ? "0" : "1"}>
                <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.9}/>
                <stop offset="95%" stopColor="#475569" stopOpacity={0.7}/>
              </linearGradient>
              <linearGradient id="colorSim" x1="0" y1="0" x2={isVertical ? "1" : "0"} y2={isVertical ? "0" : "1"}>
                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={1}/>
                <stop offset="95%" stopColor="#0284c7" stopOpacity={0.8}/>
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SpendingShiftChart;
