import { useTranslation } from 'react-i18next';

const OPCIONES = [
  { valor: 'si', labelKey: 'options.yes', activa: 'bg-green-600 hover:bg-green-700 text-white ring-2 ring-white ring-offset-2 ring-offset-slate-800' },
  { valor: 'parcialmente', labelKey: 'options.partial', activa: 'bg-yellow-500 hover:bg-yellow-600 text-white ring-2 ring-white ring-offset-2 ring-offset-slate-800' },
  { valor: 'no', labelKey: 'options.no', activa: 'bg-red-600 hover:bg-red-700 text-white ring-2 ring-white ring-offset-2 ring-offset-slate-800' },
];

const INACTIVA = 'bg-slate-600 hover:bg-slate-500 text-slate-300';

export default function BloquePreguntas({ bloque, respuestas, onRespuesta }) {
  const { t } = useTranslation();

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-white bg-slate-700 rounded-lg px-4 py-3 mb-4">
        {bloque.nombre}
      </h2>
      <div className="space-y-6">
        {bloque.preguntas.map((pregunta) => (
          <div key={pregunta.id} className="bg-slate-800 rounded-lg p-5 border border-slate-700">
            <p className="text-slate-200 text-sm mb-4 leading-relaxed">{pregunta.pregunta}</p>
            <div className="flex flex-wrap gap-2">
              {OPCIONES.map((opcion) => {
                const seleccionada = respuestas[pregunta.id] === opcion.valor;
                return (
                  <button
                    key={opcion.valor}
                    onClick={() => onRespuesta(pregunta.id, opcion.valor)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      seleccionada ? opcion.activa : INACTIVA
                    }`}
                  >
                    {t(opcion.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
