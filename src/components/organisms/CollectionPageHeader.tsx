'use client'

type CollectionPageHeaderProps = {
  title: string
  eyebrow?: string
  subtitle?: string
  search: string
  searchPlaceholder: string
  onSearchChange: (value: string) => void
  onCreate: () => void
}

export function CollectionPageHeader({
  title,
  eyebrow,
  subtitle,
  search,
  searchPlaceholder,
  onSearchChange,
  onCreate,
}: CollectionPageHeaderProps) {
  return (
    <header className="flex min-h-[9rem] flex-col justify-between gap-6 sm:min-h-[9.5rem]">
      <div className="space-y-1.5 px-1">
        {eyebrow && (
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
            {eyebrow}
          </span>
        )}
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl bg-clip-text text-transparent bg-gradient-to-br from-foreground via-foreground/90 to-foreground/60">
          {title}
        </h1>
        {subtitle && (
          <p className="max-w-2xl text-sm font-medium tracking-tight text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="group relative flex-1">
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-muted-foreground group-focus-within:text-secondary transition-colors">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-2xl border border-border bg-muted/20 py-4 pl-14 pr-6 text-sm text-foreground placeholder-muted-foreground outline-none backdrop-blur-md transition-all focus:border-secondary/50 focus:bg-muted/40 focus:ring-4 focus:ring-secondary/10"
          />
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-secondary to-secondary/80 text-secondary-foreground shadow-xl shadow-secondary/20 transition-all hover:scale-105 active:scale-95"
          aria-label="Crear"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      </div>
    </header>
  )
}
