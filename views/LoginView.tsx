
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Company, Employee, UserRole } from '../types';
import { ArrowLeft, Mail, Lock, User, Building, Phone, Key, CheckCircle } from 'lucide-react';

interface LoginViewProps {
  role: UserRole;
  companies: Company[];
  employees: Employee[];
  onSuccess: (user: Company | Employee, role: UserRole, remember: boolean) => void;
  onRegisterCompany?: (c: Company) => void;
  onRegisterEmployee?: (e: Employee) => void;
  onUpdateCompany?: (c: Company) => void;
  onUpdateEmployee?: (e: Employee) => void;
}

import { supabase } from '../supabase.ts';

// Helper to find user by email
const findUserByEmail = async (email: string, role: string) => {
  const table = role === 'company' ? 'companies' : 'employees';
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error) throw error;
  return data;
};

// ... (rest of imports)

const LoginView: React.FC<LoginViewProps> = ({
  role,
  companies, // Keeping props for compatibility but not using them for auth
  employees,
  onSuccess,
  onRegisterCompany,
  onRegisterEmployee,
  onUpdateCompany,
  onUpdateEmployee
}) => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'login' | 'register' | 'recovery' | 'reset'>('login');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    companyPin: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [targetUser, setTargetUser] = useState<Company | Employee | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [successPin, setSuccessPin] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const key = `remembered_${role}`;
    const saved = localStorage.getItem(key);
    if (saved && viewMode === 'login') {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.email && parsed.password) {
          setFormData(prev => ({ ...prev, email: parsed.email, password: parsed.password }));
          setRememberMe(true);
        }
      } catch (e) {
        console.error('Error loading saved credentials', e);
        localStorage.removeItem(key);
      }
    }
  }, [role, viewMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (viewMode === 'register') {
        if (role === 'company') {
          const newPin = Math.floor(100000 + Math.random() * 900000).toString();
          const newCompany: any = {
            id: crypto.randomUUID(),
            name: formData.name,
            email: formData.email,
            password: formData.password,
            pin: newPin,
            owner_id: crypto.randomUUID()
          };
          onRegisterCompany?.(newCompany);
          setSuccessPin(newPin);
          setViewMode('login');
        } else {
          // Verify PIN remotely
          const { data: company, error } = await supabase
            .from('companies')
            .select('id')
            .eq('pin', formData.companyPin)
            .maybeSingle();

          if (error || !company) {
            setError('El PIN de la empresa no es válido.');
            setLoading(false);
            return;
          }

          const newEmployee: any = {
            id: crypto.randomUUID(),
            name: formData.name,
            email: formData.email,
            password: formData.password,
            company_pin: formData.companyPin,
            company_id: company.id,
            contracted_hours_per_week: 40,
            user_id: crypto.randomUUID()
          };
          onRegisterEmployee?.(newEmployee);
          setViewMode('login');
        }
      } else if (viewMode === 'login') {
        const user = await findUserByEmail(formData.email, role || 'employee'); // Safe fallback

        if (user && (user.password === formData.password || !user.password)) {
          handleSuccessLogin(user);
        } else {
          setError('Credenciales incorrectas.');
        }
      } else if (viewMode === 'recovery') {
        const user = await findUserByEmail(formData.email, role || 'employee');

        if (user) {
          setTargetUser(user);
          setViewMode('reset');
        } else {
          setError('No se ha encontrado ninguna cuenta con ese email.');
        }
      } else if (viewMode === 'reset') {
        if (formData.newPassword !== formData.confirmPassword) {
          setError('Las contraseñas no coinciden.');
          setLoading(false);
          return;
        }
        if (formData.newPassword.length < 4) {
          setError('La contraseña debe tener al menos 4 caracteres.');
          setLoading(false);
          return;
        }

        if (targetUser) {
          const updatedUser = { ...targetUser, password: formData.newPassword } as any;
          if (role === 'company') onUpdateCompany?.(updatedUser);
          else onUpdateEmployee?.(updatedUser);

          setSuccessMsg('Contraseña actualizada con éxito. Ya puedes iniciar sesión.');
          setViewMode('login');
        }
      }
    } catch (err: any) {
      console.error(err);
      setError('Error de conexión: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessLogin = (user: Company | Employee) => {
    const key = `remembered_${role}`;
    if (rememberMe) {
      localStorage.setItem(key, JSON.stringify({ email: formData.email, password: formData.password }));
    } else {
      localStorage.removeItem(key);
    }
    onSuccess(user, role, rememberMe);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <button onClick={() => navigate('/')} className="mb-8 flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft size={20} />
        Volver
      </button>

      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">
            {viewMode === 'login' && '¡Hola de nuevo!'}
            {viewMode === 'register' && 'Crear cuenta'}
            {viewMode === 'recovery' && 'Recuperar acceso'}
            {viewMode === 'reset' && 'Nueva contraseña'}
          </h2>
          <p className="text-slate-500">
            {viewMode === 'recovery' ? 'Introduce tu email para resetear tu clave' : `Acceso para ${role === 'employee' ? 'empleados' : 'empresas'}`}
          </p>
        </div>

        {successPin && viewMode === 'login' && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700">
            <p className="font-bold text-lg mb-1 flex items-center gap-2">
              <CheckCircle size={20} />
              ¡Empresa registrada!
            </p>
            <p>Tu PIN de empresa es: <span className="font-mono font-black text-2xl tracking-widest">{successPin}</span></p>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm font-medium flex items-center gap-2">
            <CheckCircle size={18} />
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {viewMode === 'register' && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre {role === 'company' ? 'de la empresa' : 'completo'}</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  {role === 'company' ? <Building size={18} /> : <User size={18} />}
                </span>
                <input
                  type="text"
                  required
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>
          )}

          {(viewMode === 'login' || viewMode === 'register' || viewMode === 'recovery') && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <Mail size={18} />
                </span>
                <input
                  type="email"
                  required
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>
          )}

          {(viewMode === 'login' || viewMode === 'register') && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Contraseña</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock size={18} />
                </span>
                <input
                  type="password"
                  required
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
              {viewMode === 'login' && (
                <button
                  type="button"
                  onClick={() => setViewMode('recovery')}
                  className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
                >
                  ¿Has olvidado tu contraseña?
                </button>
              )}
            </div>
          )}

          {viewMode === 'reset' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nueva Contraseña</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Key size={18} />
                  </span>
                  <input type="password" required className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={formData.newPassword} onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Confirmar Contraseña</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Key size={18} />
                  </span>
                  <input type="password" required className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} />
                </div>
              </div>
            </>
          )}

          {viewMode === 'register' && role === 'employee' && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">PIN de Empresa (6 dígitos)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <Phone size={18} />
                </span>
                <input type="text" maxLength={6} required className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono tracking-widest" value={formData.companyPin} onChange={(e) => setFormData({ ...formData, companyPin: e.target.value })} />
              </div>
            </div>
          )}

          {viewMode === 'login' && (
            <div className="flex items-center gap-2 py-2">
              <input type="checkbox" id="remember" className="w-4 h-4 text-blue-600 rounded" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
              <label htmlFor="remember" className="text-sm text-slate-600 cursor-pointer font-medium">Mantener sesión iniciada</label>
            </div>
          )}

          {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg border border-red-100 font-medium">{error}</p>}

          <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all">
            {viewMode === 'login' && 'Entrar'}
            {viewMode === 'register' && 'Registrarse'}
            {viewMode === 'recovery' && 'Verificar Email'}
            {viewMode === 'reset' && 'Actualizar Contraseña'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-600">
          {viewMode === 'login' && (
            <>
              ¿No tienes cuenta?
              <button onClick={() => { setViewMode('register'); setError(''); setSuccessPin(''); }} className="ml-2 text-blue-600 font-bold hover:underline">
                Regístrate
              </button>
            </>
          )}
          {(viewMode === 'register' || viewMode === 'recovery' || viewMode === 'reset') && (
            <button onClick={() => { setViewMode('login'); setError(''); }} className="text-blue-600 font-bold hover:underline">
              Volver al inicio de sesión
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginView;
