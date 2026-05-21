import Link from "next/link";

/**
 * Root 404 page.
 *
 * Rendered when no route matches. This is a Server Component.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="space-y-2">
        <h1 className="text-6xl font-bold tracking-tighter text-foreground">
          404
        </h1>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Page not found
        </h2>
        <p className="text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
      >
        Go home
      </Link>
    </div>
  );
}
