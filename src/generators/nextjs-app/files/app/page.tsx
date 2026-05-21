/**
 * Home page — Server Component.
 *
 * This is the landing page for the application. Replace this with
 * your actual home page content.
 */
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="space-y-2 text-center">
        <h1 className="text-4xl font-bold tracking-tighter text-foreground">
          <%= className %>
        </h1>
        <p className="text-muted-foreground">
          Your Next.js application is running.
        </p>
      </div>
    </main>
  );
}
