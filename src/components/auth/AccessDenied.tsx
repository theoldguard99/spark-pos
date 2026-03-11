export default function AccessDenied({ title = 'Access denied' }: { title?: string }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-slate-50">
      <div className="text-center px-6">
        <h2 className="text-xl font-semibold text-slate-700">{title}</h2>
        <p className="text-slate-500 mt-2">Your account does not have permission to view this page.</p>
      </div>
    </div>
  )
}
