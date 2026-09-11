export default function Loading() {
  return <div className="mx-auto max-w-[1220px]" role="status" aria-label="Loading dashboard"><div className="skeleton h-16 rounded-xl"/><div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{[0,1,2,3].map(i=><div key={i} className="skeleton h-28 rounded-xl"/>)}</div></div>;
}
