import React from 'react';
import { formatCompactCurrency } from '../utils/formatters';

const StatCard = ({ title, value, type = 'currency', icon: Icon, delta, deltaType }) => {
  return (
    <div className="glass-card" style={{ padding: '24px' }}>
      <div className="flex-between" style={{ marginBottom: '16px' }}>
        <h3 className="text-secondary" style={{ fontSize: '1rem', fontWeight: 500, margin: 0 }}>
          {title}
        </h3>
        {Icon && (
          <div style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
            <Icon size={20} className="text-muted" />
          </div>
        )}
      </div>
      
      <div>
        <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {type === 'currency' ? formatCompactCurrency(value) : value.toLocaleString('en-US')}
        </div>
        
        {delta !== undefined && (
          <div style={{ 
            marginTop: '8px', 
            fontSize: '0.875rem', 
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: deltaType === 'positive' ? 'var(--accent-success)' : 
                   deltaType === 'negative' ? 'var(--accent-danger)' : 'var(--text-muted)'
          }}>
            {delta > 0 ? '+' : ''}{type === 'currency' ? formatCompactCurrency(delta) : delta}
            <span className="text-muted" style={{ fontWeight: 400, marginLeft: '4px' }}>vs INA-CBG</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
