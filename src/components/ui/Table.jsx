export default function Table({ cols, data, renderRow, loading, emptyMsg = 'Sin datos.' }) {
  if (loading) return (
    <div className="loading-state">
      <div className="spinner"></div>
      <span>Cargando...</span>
    </div>
  )
  return (
    <div className="table-wrapper">
      <table>
        <thead><tr>{cols.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
        <tbody>
          {data.length === 0
            ? <tr><td colSpan={cols.length} style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>{emptyMsg}</td></tr>
            : data.map((row, i) => renderRow(row, i))
          }
        </tbody>
      </table>
    </div>
  )
}
