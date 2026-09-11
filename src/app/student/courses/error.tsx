"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <section role="alert" className="rounded-xl border border-line bg-white p-5"><h2 className="font-bold">Courses could not be loaded</h2><p className="mt-2 text-sm text-muted">Please check your connection and try again.</p><button onClick={reset} className="mt-3 min-h-11 rounded-lg bg-brand px-4 text-sm font-semibold text-white">Try again</button></section>;
}
