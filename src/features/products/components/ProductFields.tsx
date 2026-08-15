import { TextInput } from '@/src/components/atoms/FormControls'
import { cn } from '@/src/utils/classNames'

export type ProductFieldName = 'description' | 'price' | 'title'

type ProductFieldValues = {
  title: string
  description?: string
  price?: string
}

type ProductFieldsProps = {
  value: ProductFieldValues
  onChange: (field: ProductFieldName, value: string) => void
  showDescription?: boolean
  showPrice?: boolean
  showLabels?: boolean
  autoFocus?: boolean
  className?: string
  titlePlaceholder?: string
  descriptionPlaceholder?: string
  pricePlaceholder?: string
  labelTone?: 'accent' | 'muted'
}

export function ProductFields({
  value,
  onChange,
  showDescription = false,
  showPrice = false,
  showLabels = true,
  autoFocus = false,
  className,
  titlePlaceholder = 'Nombre del producto *',
  descriptionPlaceholder = 'Marca, tamaño o notas...',
  pricePlaceholder = 'Precio estimado (EUR)',
  labelTone = 'accent',
}: ProductFieldsProps) {
  const labelClassName = cn(
    'ml-1 text-xs font-bold',
    labelTone === 'accent'
      ? 'uppercase tracking-widest text-secondary'
      : 'text-muted-foreground',
  )

  const field = (label: string, input: React.ReactNode) => (
    <div className={showLabels ? 'space-y-2' : undefined}>
      {showLabels && <label className={labelClassName}>{label}</label>}
      {input}
    </div>
  )

  return (
    <div className={cn('grid gap-4', className)}>
      {field('Nombre del producto', (
        <TextInput
          type="text"
          value={value.title}
          onChange={(event) => onChange('title', event.target.value)}
          placeholder={titlePlaceholder}
          autoFocus={autoFocus}
          required
        />
      ))}
      {showDescription && field('Descripción', (
        <TextInput
          type="text"
          value={value.description ?? ''}
          onChange={(event) => onChange('description', event.target.value)}
          placeholder={descriptionPlaceholder}
        />
      ))}
      {showPrice && field('Precio inicial (EUR)', (
        <TextInput
          type="number"
          step="0.01"
          min="0"
          value={value.price ?? ''}
          onChange={(event) => onChange('price', event.target.value)}
          placeholder={pricePlaceholder}
        />
      ))}
    </div>
  )
}
