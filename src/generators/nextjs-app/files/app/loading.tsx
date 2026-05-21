/**
 * Root loading UI.
 *
 * Rendered as a fallback while the page is loading. Next.js wraps
 * the page component in a Suspense boundary using this component.
 */
export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
    </div>
  );
}
