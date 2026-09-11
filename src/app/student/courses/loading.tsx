export default function Loading() {
  return <div className="mx-auto max-w-5xl space-y-6" role="status" aria-label="Loading courses"><div className="skeleton h-28 rounded-xl"/><div className="flex gap-2">{[0,1,2].map(i=><div key={i} className="skeleton h-14 flex-1 rounded-xl"/>)}</div><div className="skeleton h-32 rounded-xl"/></div>;
}
