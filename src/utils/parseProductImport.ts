export interface ProductImportRow {
  name: string
  sku: string | null
  price: number
  stock: number
  category: string
}

export interface ParseResult {
  rows: ProductImportRow[]
  errors: string[]
}

const HEADER_ALIASES: Record<string, string> = {
  name: 'name',
  'product name': 'name',
  product: 'name',
  item: 'name',
  sku: 'sku',
  code: 'sku',
  'product code': 'sku',
  price: 'price',
  'unit price': 'price',
  cost: 'price',
  stock: 'stock',
  quantity: 'stock',
  qty: 'stock',
  inventory: 'stock',
  category: 'category',
  categories: 'category',
  type: 'category',
}

function normalizeHeader(h: string): string {
  const key = h.trim().toLowerCase().replace(/\s+/g, ' ')
  return HEADER_ALIASES[key] ?? key
}

function parseNumber(val: string): number | null {
  const cleaned = String(val).trim().replace(/,/g, '')
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isNaN(n) ? null : n
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQuotes = !inQuotes
    } else if ((c === ',' && !inQuotes) || c === '\t') {
      result.push(current.trim())
      current = ''
    } else {
      current += c
    }
  }
  result.push(current.trim())
  return result
}

export function parseCSV(text: string): ParseResult {
  const errors: string[] = []
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) {
    return { rows: [], errors: ['CSV must have a header row and at least one data row.'] }
  }

  const headerRow = parseCSVLine(lines[0])
  const colMap: Record<string, number> = {}
  headerRow.forEach((h, i) => {
    const norm = normalizeHeader(h)
    if (norm) colMap[norm] = i
  })

  if (!colMap.name && !colMap.product) {
    const first = headerRow[0]?.toLowerCase() ?? ''
    if (first.includes('name') || first.includes('product')) colMap.name = 0
  }
  const nameCol = colMap.name ?? 0

  const rows: ProductImportRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i])
    const name = (cells[nameCol] ?? '').trim()
    if (!name) {
      errors.push(`Row ${i + 1}: Product name is required.`)
      continue
    }

    const skuVal = colMap.sku != null ? cells[colMap.sku] : undefined
    const sku = skuVal != null && String(skuVal).trim() !== '' ? String(skuVal).trim() : null

    const priceCol = colMap.price ?? 2
    const priceNum = parseNumber(cells[priceCol] ?? '0')
    const price = priceNum != null && priceNum >= 0 ? priceNum : 0

    const stockCol = colMap.stock ?? 3
    const stockNum = parseNumber(cells[stockCol] ?? '0')
    const stock = stockNum != null && stockNum >= 0 ? Math.floor(stockNum) : 0

    const categoryCol = colMap.category ?? 4
    const category = (cells[categoryCol] ?? '').trim() || 'Uncategorized'

    rows.push({ name, sku, price, stock, category })
  }

  return { rows, errors }
}

export async function parseExcel(buffer: ArrayBuffer): Promise<ParseResult> {
  const errors: string[] = []
  try {
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(buffer, { type: 'array' })
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    if (!firstSheet) return { rows: [], errors: ['Excel file has no sheets.'] }
    const raw: unknown[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' })
    if (!raw.length) return { rows: [], errors: ['Sheet is empty.'] }

    const headerRow = (raw[0] ?? []).map((c) => String(c ?? ''))
    const colMap: Record<string, number> = {}
    headerRow.forEach((h, i) => {
      const norm = normalizeHeader(h)
      if (norm) colMap[norm] = i
    })
    const nameCol = colMap.name ?? 0

    const rows: ProductImportRow[] = []
    for (let i = 1; i < raw.length; i++) {
      const cells = (raw[i] ?? []).map((c) => String(c ?? '').trim())
      const name = (cells[nameCol] ?? '').trim()
      if (!name) {
        errors.push(`Row ${i + 1}: Product name is required.`)
        continue
      }

      const skuVal = colMap.sku != null ? cells[colMap.sku] : undefined
      const sku = skuVal != null && skuVal !== '' ? skuVal : null

      const priceCol = colMap.price ?? 2
      const priceNum = parseNumber(cells[priceCol] ?? '0')
      const price = priceNum != null && priceNum >= 0 ? priceNum : 0

      const stockCol = colMap.stock ?? 3
      const stockNum = parseNumber(cells[stockCol] ?? '0')
      const stock = stockNum != null && stockNum >= 0 ? Math.floor(stockNum) : 0

      const categoryCol = colMap.category ?? 4
      const category = (cells[categoryCol] ?? '').trim() || 'Uncategorized'

      rows.push({ name, sku, price, stock, category })
    }
    return { rows, errors }
  } catch (e) {
    return { rows: [], errors: [e instanceof Error ? e.message : 'Failed to parse Excel file.'] }
  }
}

export async function parseProductFile(file: File): Promise<ParseResult> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv')) {
    const text = await file.text()
    return parseCSV(text)
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const buffer = await file.arrayBuffer()
    return parseExcel(buffer)
  }
  return { rows: [], errors: ['Unsupported file type. Use .csv or .xlsx'] }
}
