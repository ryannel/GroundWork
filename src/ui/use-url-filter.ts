import { useSearchParams } from 'react-router-dom'

/**
 * List filters kept in the query string. A value equal to its default is removed so shared URLs stay
 * short, and filter changes replace the history entry instead of adding one per click.
 */
export function useUrlFilter<K extends string>(defaults: Record<K, string>) {
  const [params, setParams] = useSearchParams()
  const get = (key: K) => params.get(key) ?? defaults[key]
  const set = (key: K, value: string) => setParams(previous => {
    const next = new URLSearchParams(previous)
    if (value === defaults[key]) next.delete(key)
    else next.set(key, value)
    return next
  }, { replace: true })
  const reset = () => setParams({}, { replace: true })
  return { params, get, set, reset }
}
