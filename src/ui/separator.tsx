import { cn } from '@/lib/cn'
export function Separator({ vertical, className }: { vertical?: boolean; className?: string }) {
  return <div role="separator" className={cn('shrink-0 bg-border', vertical ? 'h-full w-px' : 'h-px w-full', className)} />
}
