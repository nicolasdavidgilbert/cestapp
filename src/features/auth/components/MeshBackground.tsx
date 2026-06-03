'use client'

export function MeshBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-background">
      {/* Immersive Gradients */}
      <div
        className="absolute -left-[10%] -top-[10%] h-[60%] w-[60%] animate-pulse opacity-20 dark:opacity-40"
        style={{ background: 'radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--primary) 15%, transparent) 0%, transparent 50%)' }}
      />
      <div
        className="absolute -right-[5%] top-[20%] h-[50%] w-[50%] animate-pulse opacity-15 dark:opacity-25 [animation-delay:2s]"
        style={{ background: 'radial-gradient(circle at 80% 20%, color-mix(in srgb, var(--secondary) 10%, transparent) 0%, transparent 40%)' }}
      />
      <div
        className="absolute bottom-[0%] left-[20%] h-[40%] w-[40%] animate-pulse opacity-10 dark:opacity-15 [animation-delay:4s]"
        style={{ background: 'radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--primary) 15%, transparent) 0%, transparent 50%)' }}
      />
      
      {/* Noise Texture Overlay */}
      <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.03] mix-blend-overlay" 
           style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} 
      />

      {/* Grid Pattern */}
      <div
        className="absolute inset-x-0 top-0 h-full w-full bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"
        style={{
          backgroundImage:
            'linear-gradient(to right, color-mix(in srgb, var(--foreground) 2%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--foreground) 2%, transparent) 1px, transparent 1px)',
        }}
      />
    </div>
  )
}
