
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Company, Employee, TimeRecord, UserRole, AuthState } from './types';
import LandingView from './views/LandingView';
import LoginView from './views/LoginView';
import EmployeeDashboard from './views/EmployeeDashboard';
import CompanyDashboard from './views/CompanyDashboard';
import { LogOut } from 'lucide-react';
import { supabase } from './supabase';
import { calculateRecordHash } from './utils';
import { registerSW } from 'virtual:pwa-register';

// Register service worker and handle updates
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Nueva versión disponible. ¿Deseas actualizar?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('App lista para uso offline');
  },
});

const STORAGE_KEYS = {
  AUTH: 'jornify_auth_current',
};

const Header: React.FC<{ auth: AuthState; onLogout: () => void }> = ({ auth, onLogout }) => {
  const navigate = useNavigate();

  return (
    <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-50">
      <div className="max-w-7xl auto flex justify-between items-center mx-auto w-full">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => auth.role ? navigate('/dashboard') : navigate('/')}>
          <div className="w-10 h-10 bg-blue-600 flex items-center justify-center rounded-lg rotate-3 shadow-md" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white -rotate-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="text-2xl font-bold text-slate-800 tracking-tight">Jornify</span>
        </div>

        {auth.role && (
          <div className="flex items-center gap-4">
            <div className="hidden md:block text-right">
              <p className="text-sm font-semibold text-slate-700">{auth.user?.name}</p>
              <p className="text-xs text-slate-500 capitalize">{auth.role === 'employee' ? 'Empleado' : 'Administrador'}</p>
            </div>
            <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              <LogOut size={16} />
              <span className="hidden sm:inline">Cerrar Sesión</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>({ user: null, role: null, rememberMe: false });
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [signatures, setSignatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch initial data from Supabase
  const fetchData = async () => {
    try {
      const { data: companiesData } = await supabase.from('companies').select('*');
      const { data: employeesData } = await supabase.from('employees').select('*');
      const { data: recordsData } = await supabase.from('time_records').select('*');
      const { data: signaturesData } = await supabase.from('monthly_signatures').select('*');

      if (companiesData) setCompanies(companiesData);
      if (employeesData) setEmployees(employeesData);
      if (recordsData) setRecords(recordsData);
      if (signaturesData) setSignatures(signaturesData);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    const init = async () => {
      await fetchData();
      const savedAuth = localStorage.getItem(STORAGE_KEYS.AUTH);
      if (savedAuth) {
        const parsed = JSON.parse(savedAuth);
        // Refresh the user data from the live data we just fetched
        if (parsed.role === 'company') {
          // This will be updated by the useEffect below too, but let's do it here for immediate effect
          setAuth(parsed);
        } else {
          setAuth(parsed);
        }
      }
      setLoading(false);
    };
    init();

    // Subscribe to changes
    const companiesSub = supabase.channel('companies_changes')
      .on('postgres_changes' as any, { event: '*', table: 'companies' }, fetchData)
      .subscribe();

    const employeesSub = supabase.channel('employees_changes')
      .on('postgres_changes' as any, { event: '*', table: 'employees' }, fetchData)
      .subscribe();

    const recordsSub = supabase.channel('records_changes')
      .on('postgres_changes' as any, { event: '*', table: 'time_records' }, fetchData)
      .subscribe();

    const signaturesSub = supabase.channel('signatures_changes')
      .on('postgres_changes' as any, { event: '*', table: 'monthly_signatures' }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(companiesSub);
      supabase.removeChannel(employeesSub);
      supabase.removeChannel(recordsSub);
      supabase.removeChannel(signaturesSub);
    };
  }, []);

  // Synchronize auth.user with the live companies/employees data
  useEffect(() => {
    if (auth.user && auth.role) {
      if (auth.role === 'company') {
        const liveComp = companies.find(c => c.id === auth.user?.id);
        if (liveComp && (
          liveComp.tax_id !== (auth.user as Company).tax_id ||
          liveComp.subscription_status !== (auth.user as Company).subscription_status ||
          liveComp.address_line1 !== (auth.user as Company).address_line1
        )) {
          setAuth(prev => ({ ...prev, user: liveComp }));
        }
      } else {
        const liveEmp = employees.find(e => e.id === auth.user?.id);
        if (liveEmp && JSON.stringify(liveEmp) !== JSON.stringify(auth.user)) {
          setAuth(prev => ({ ...prev, user: liveEmp }));
        }
      }
    }
  }, [companies, employees, auth.role, auth.user?.id]);

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEYS.AUTH);
    setAuth({ user: null, role: null, rememberMe: false });
  };

  const handleLogin = (user: Company | Employee, role: UserRole, remember: boolean) => {
    const newAuth = { user, role, rememberMe: remember };
    setAuth(newAuth);
    localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(newAuth));
  };

  const handleUpdateEmployee = async (updatedEmp: Employee) => {
    const { error } = await supabase
      .from('employees')
      .update(updatedEmp)
      .eq('id', updatedEmp.id);
    if (error) console.error('Error updating employee:', error);
  };

  const handleUpdateCompany = async (updatedComp: Company) => {
    const { error } = await supabase
      .from('companies')
      .update(updatedComp)
      .eq('id', updatedComp.id);
    if (error) console.error('Error updating company:', error);
  };

  const handleRegisterCompany = async (c: Company) => {
    const { error } = await supabase.from('companies').insert([c]);
    if (error) console.error('Error registering company:', error);
  };

  const handleRegisterEmployee = async (e: Employee) => {
    const { error } = await supabase.from('employees').insert([e]);
    if (error) {
      console.error('Error registering employee:', error);
      alert('Error al registrar empleado: ' + error.message);
    } else {
      // Sync Subscription Quantity
      try {
        await supabase.functions.invoke('update-subscription', {
          body: { companyId: e.company_id }
        });
      } catch (err) {
        console.error('Error syncing subscription:', err);
        // We don't block the user, but we log it. Billing will catch up on next sync.
      }
    }
  };

  const handleNewRecord = async (r: TimeRecord) => {
    // Get the latest record for this employee to link the hash chain
    const employeeRecords = records
      .filter(rec => rec.employee_id === r.employee_id)
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

    const latestRecord = employeeRecords[0];
    const parentHash = latestRecord?.row_hash || '';

    // Calculate initial hash (may be updated later when record is closed)
    const rowHash = await calculateRecordHash(r, parentHash);

    const recordWithHash = {
      ...r,
      parent_hash: parentHash,
      row_hash: rowHash
    };

    const { error } = await supabase.from('time_records').insert([recordWithHash]);
    if (error) console.error('Error creating record:', error);
  };

  const handleUpdateRecord = async (r: TimeRecord) => {
    // Recalculate hash because content (end_time, duration) changed
    const rowHash = await calculateRecordHash(r, r.parent_hash || '');
    const recordWithUpdatedHash = { ...r, row_hash: rowHash };

    const { error } = await supabase
      .from('time_records')
      .update(recordWithUpdatedHash)
      .eq('id', r.id);
    if (error) console.error('Error updating record:', error);
  };

  if (loading) return null;

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Header auth={auth} onLogout={handleLogout} />

        <main className="flex-1">
          <Routes>
            <Route path="/" element={
              auth.role ? <Navigate to="/dashboard" /> : <LandingView />
            } />

            <Route path="/login/employee" element={
              auth.role ? <Navigate to="/dashboard" /> : <LoginView
                role="employee"
                companies={companies}
                employees={employees}
                onSuccess={handleLogin}
                onRegisterEmployee={handleRegisterEmployee}
                onUpdateEmployee={handleUpdateEmployee}
              />
            } />

            <Route path="/login/company" element={
              auth.role ? <Navigate to="/dashboard" /> : <LoginView
                role="company"
                companies={companies}
                employees={employees}
                onSuccess={handleLogin}
                onRegisterCompany={handleRegisterCompany}
                onUpdateCompany={handleUpdateCompany}
              />
            } />

            <Route path="/dashboard" element={
              !auth.role ? <Navigate to="/" /> : (
                auth.role === 'employee' ? (
                  <EmployeeDashboard
                    employee={employees.find(e => e.id === auth.user?.id) || (auth.user as Employee)}
                    company={companies.find(c => c.pin === (auth.user as Employee).company_pin)}
                    records={records.filter(r => r.employee_id === auth.user?.id)}
                    signatures={signatures.filter(s => s.employee_id === auth.user?.id)}
                    onNewRecord={handleNewRecord}
                    onUpdateRecord={handleUpdateRecord}
                  />
                ) : (
                  <CompanyDashboard
                    company={auth.user as Company}
                    employees={employees.filter(e => e.company_pin === (auth.user as Company).pin)}
                    records={records.filter(r => employees.some(e => e.id === r.employee_id && e.company_pin === (auth.user as Company).pin))}
                    signatures={signatures}
                    onUpdateEmployee={handleUpdateEmployee}
                  />
                )
              )
            } />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>

        <footer className="bg-slate-900 text-slate-400 py-8 px-4 text-center">
          <p className="text-sm">© 2024 Jornify. Gestión Inteligente de Jornada Laboral.</p>
        </footer>
      </div>
    </Router>
  );
};

export default App;
