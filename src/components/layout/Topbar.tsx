export default function Topbar() {
  return (
    <header className="h-20 border-b border-slate-200 bg-white/90 backdrop-blur-sm px-6 flex items-center justify-between shadow-sm">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">
          Super Catering Manager
        </h1>
        <p className="text-sm text-slate-500">
          Gestión operativa y comercial
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button className="h-10 w-10 rounded-full border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition">
          🔔
        </button>
        <div className="h-10 w-10 rounded-full bg-[#CDB4DB] text-slate-800 flex items-center justify-center font-medium">
          F
        </div>
      </div>
    </header>
  )
}