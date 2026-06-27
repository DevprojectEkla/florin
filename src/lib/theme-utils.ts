/**
 * Theme utility functions for consistent light/dark styling
 */

export function getTooltipStyle(theme: 'light' | 'dark') {
  return {
    backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
    border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`,
    borderRadius: '8px',
    color: theme === 'dark' ? '#e2e8f0' : '#0f172a',
  };
}

export function getChartColors(theme: 'light' | 'dark') {
  return theme === 'dark'
    ? {
        primary: ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'],
        text: '#94a3b8',
        grid: '#334155',
      }
    : {
        primary: ['#059669', '#d97706', '#dc2626', '#2563eb', '#7c3aed', '#db2777', '#0d9488', '#ea580c'],
        text: '#475569',
        grid: '#cbd5e1',
      };
}
