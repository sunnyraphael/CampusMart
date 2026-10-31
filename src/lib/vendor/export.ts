// Neutralize spreadsheet formulas in text fields before making a CSV download.
export function csvCell(value: unknown) {
  let text = String(value ?? '')
  if (typeof value !== 'number' && (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text))) text = "'" + text
  return '"' + text.replaceAll('"', '""') + '"'
}
export function transactionsCsv(rows: { id?: string; created_at?: string; type?: string; description?: string; amount?: number | string; status?: string }[]) {
  const header = ['Reference', 'Date', 'Type', 'Description', 'Amount (NGN)', 'Status']
  return '\uFEFF' + [header.map(csvCell).join(','), ...rows.map(row => [row.id, row.created_at, row.type, row.description, Number.isFinite(Number(row.amount)) ? Number(row.amount) : '', row.status].map(csvCell).join(','))].join('\r\n')
}
