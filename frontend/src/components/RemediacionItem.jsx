export default function RemediacionItem({ item }) {
  const esPrioritario = item.peso >= 8;

  return (
    <div className="bg-slate-800 rounded-lg p-5 border border-slate-700">
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-slate-200 text-sm font-medium leading-snug">{item.pregunta}</p>
        <span
          className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${
            esPrioritario ? 'bg-red-900 text-red-300' : 'bg-yellow-900 text-yellow-300'
          }`}
        >
          {esPrioritario ? 'Prioritario' : 'Recomendado'}
        </span>
      </div>
      <p className="text-slate-400 text-sm mb-3 leading-relaxed">{item.remediacion}</p>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">{item.referencia}</span>
        <span
          className={`font-medium ${
            item.valor === 'parcialmente' ? 'text-yellow-500' : 'text-red-500'
          }`}
        >
          Respondido: {item.valor === 'parcialmente' ? 'Parcialmente' : 'No'}
        </span>
      </div>
    </div>
  );
}
