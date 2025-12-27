
import React from 'react';
import { useNavigate } from 'react-router-dom';

const LandingView: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-7xl mx-auto px-4 py-16 md:py-24 flex flex-col items-center text-center">
      <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-50 text-blue-700 text-sm font-medium mb-6">
        ✨ Nueva versión 2.0 disponible
      </div>

      <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 mb-6 tracking-tight">
        Control horario sin <span className="text-blue-600 underline decoration-blue-200">complicaciones</span>.
      </h1>

      <p className="text-xl text-slate-600 mb-12 max-w-2xl">
        La plataforma más intuitiva para registrar tu jornada laboral, gestionar horas extra y cumplir con la normativa vigente desde cualquier dispositivo.
      </p>

      <div className="grid md:grid-cols-2 gap-6 w-full max-w-2xl">
        <button
          onClick={() => navigate('/login/employee')}
          className="group relative p-8 bg-white border-2 border-slate-100 hover:border-blue-500 rounded-2xl shadow-sm hover:shadow-xl transition-all text-left"
        >
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-slate-800 mb-2">Soy Empleado</h3>
          <p className="text-slate-500">Ficha tu entrada y salida, controla tus horas extra y visualiza tu historial.</p>
        </button>

        <button
          onClick={() => navigate('/login/company')}
          className="group relative p-8 bg-white border-2 border-slate-100 hover:border-blue-500 rounded-2xl shadow-sm hover:shadow-xl transition-all text-left"
        >
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div className="flex items-baseline mb-4">
            <span className="text-4xl font-extrabold text-slate-900">2,50€</span>
            <span className="text-slate-500 font-medium">/mes</span>
          </div>
          <h3 className="text-2xl font-bold text-slate-800 mb-2">Soy Empresa</h3>
          <p className="text-slate-500">Gestiona tu equipo, revisa registros en tiempo real y exporta informes legales.</p>
        </button>
      </div>

      <div className="mt-20 flex flex-wrap justify-center gap-8 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
        <div className="text-2xl font-bold">🏢 CorpX</div>
        <div className="text-2xl font-bold">📦 LogiTrans</div>
        <div className="text-2xl font-bold">🛠️ TechMakers</div>
        <div className="text-2xl font-bold">🚀 StarApps</div>
      </div>
    </div>
  );
};

export default LandingView;
