const tipos = {
  success: 'badge-success', danger: 'badge-danger',
  warning: 'badge-warning', info: 'badge-info', gray: 'badge-gray'
}
export default function Badge({ tipo = 'gray', children }) {
  return <span className={`badge ${tipos[tipo]}`}>{children}</span>
}
