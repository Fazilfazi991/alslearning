"use client";
export default function Error({ reset }: { reset: () => void }) { return <section role="alert" className="card p-6"><h2 className="font-bold">Recorded classes could not be loaded.</h2><p className="my-3 text-sm text-muted">Check your connection and try again.</p><button onClick={reset} className="min-h-11 rounded bg-brand px-4 text-white">Try again</button></section>; }
