export default function Loading(){return <div className="space-y-3">{[1,2,3].map(x=><div key={x} className="skeleton h-28 rounded-2xl"/>)}</div>}
