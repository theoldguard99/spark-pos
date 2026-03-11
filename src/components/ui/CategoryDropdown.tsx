import Select from './Select'

interface CategoryDropdownProps {
  value: string
  options: string[]
  onChange: (value: string) => void
  className?: string
}

export default function CategoryDropdown({
  value,
  options,
  onChange,
  className = '',
}: CategoryDropdownProps) {
  return (
    <div className={className}>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((cat) => (
          <option key={cat} value={cat}>
            {cat === 'all' ? 'All categories' : cat}
          </option>
        ))}
      </Select>
    </div>
  )
}
