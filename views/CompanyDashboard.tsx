import React, { useState } from 'react';
import { Company, Employee, TimeRecord } from '../types';
import { jsPDF } from 'jspdf';
import { formatDate, formatDuration, generatePDF, getWeekRange } from '../utils';
import { Users, Briefcase, FileText, Edit2, Calendar, Clock, AlertTriangle, CheckCircle2, Search, Building, User, Bell, CreditCard, ShieldCheck, Trash2 } from 'lucide-react';
import { supabase } from '../supabase';
import { createCheckoutSession, createPortalSession } from '../stripeUtils';

interface CompanyDashboardProps {
  company: Company;
  employees: Employee[];
  records: TimeRecord[];
  signatures: any[];
  onUpdateEmployee: (emp: Employee) => void;
}

const CompanyDashboard: React.FC<CompanyDashboardProps> = ({ company, employees, records, signatures, onUpdateEmployee }) => {
  const [editingHours, setEditingHours] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [isLoadingStripe, setIsLoadingStripe] = useState(false);

  const getWeeklyHours = (employeeId: string) => {
    const { start, end } = getWeekRange();
    return records
      .filter(r => r.employee_id === employeeId && r.end_time !== null && new Date(r.start_time) >= start && new Date(r.start_time) <= end)
      .reduce((acc, r) => acc + r.duration_minutes, 0);
  };

  const getStatus = (employeeId: string) => {
    const active = records.find(r => r.employee_id === employeeId && r.end_time === null);
    return active ? 'Fichado' : 'Ausente';
  };

  const handleUpdateWeeklyHours = (emp: Employee, hours: string) => {
    const num = parseInt(hours);
    if (!isNaN(num)) {
      onUpdateEmployee({ ...emp, contracted_hours_per_week: num });
    }
    setEditingHours(null);
  };

  const handleUpdateNudgeTime = async (empId: string, time: string) => {
    try {
      const { error } = await supabase.from('employees').update({ nudge_time: time }).eq('id', empId);
      if (error) throw error;
    } catch (e) {
      console.error(e);
      alert('Error al actualizar la hora de aviso.');
    }
  };

  const handleNudge = async (empId: string) => {
    try {
      const { error } = await supabase.from('employees').update({ clock_out_nudge: true }).eq('id', empId);
      if (error) throw error;
      alert('Recordatorio enviado correctamente.');
      if (error) throw error;
      alert('Recordatorio enviado correctamente.');
    } catch (e) {
      console.error(e);
      alert('Error al enviar el recordatorio.');
    }
  };

  const handleDeleteEmployee = async (empId: string) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar a este empleado? Esta acción no se puede deshacer y ajustará tu facturación inmediatamente.')) {
      return;
    }

    try {
      const { error } = await supabase.from('employees').delete().eq('id', empId);
      if (error) throw error;

      // Sync Subscription (Downgrade)
      await supabase.functions.invoke('update-subscription', {
        body: { companyId: company.id }
      });

      // No need to alert, list updates via subscription
    } catch (e) {
      console.error(e);
      alert('Error al eliminar empleado.');
    }
  };

  const handleExport = () => {
    if (!dateRange.start || !dateRange.end) {
      alert('Selecciona un rango de fechas.');
      return;
    }

    setIsExporting(true);
    // NO SETTIMEOUT here. Must be perfectly sync to keep User Activation.
    try {
      const filtered = records.filter(r => {
        const date = new Date(r.start_time).toISOString().split('T')[0];
        const dateMatch = date >= dateRange.start && date <= dateRange.end;
        const employeeMatch = selectedEmployeeId === 'all' || r.employee_id === selectedEmployeeId;
        return dateMatch && employeeMatch;
      });

      if (filtered.length === 0) {
        alert('No hay registros.');
        setIsExporting(false);
        return;
      }

      const employeeName = selectedEmployeeId === 'all'
        ? 'Todos'
        : employees.find(e => e.id === selectedEmployeeId)?.name || 'Empleado';

      // Find signatures if a specific employee is selected
      // Find signatures
      let relevantSignatures = [];
      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);

      relevantSignatures = signatures.filter(s => {
        const sDate = new Date(s.year, s.month, 1);
        const dateMatch = sDate >= new Date(start.getFullYear(), start.getMonth(), 1) &&
          sDate <= new Date(end.getFullYear(), end.getMonth(), 1);

        if (selectedEmployeeId === 'all') {
          return dateMatch;
        } else {
          return dateMatch && s.employee_id === selectedEmployeeId;
        }
      });

      generatePDF(company.name, dateRange, filtered, employees, employeeName, relevantSignatures);
    } catch (e) {
      console.error(e);
      alert('Error en exportación.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSupportTest = () => {
    try {
      const doc = new jsPDF();
      doc.text("Direct Test v11.0", 10, 10);
      doc.save("test_v11.pdf");
    } catch (e) {
      alert("Error: " + e);
    }
  };

  const handleSubscription = async () => {
    setIsLoadingStripe(true);
    try {
      if (company.stripe_customer_id && (company.subscription_status === 'active' || company.subscription_status === 'trialing')) {
        // Open customer portal for existing subscribers (or trialing with card)
        const url = await createPortalSession(company.stripe_customer_id);
        window.location.href = url;
      } else {
        // Create new checkout session
        const url = await createCheckoutSession(
          company.id,
          company.email,
          employees.length
        );
        window.location.href = url;
      }
    } catch (error) {
      console.error('Error:', error);
      alert(error instanceof Error ? error.message : 'Error al procesar la suscripción');
    } finally {
      setIsLoadingStripe(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('¿Estás seguro de que quieres CANCELAR tu suscripción? Se desactivará tu facturación y perderás acceso premium.')) {
      return;
    }

    setIsLoadingStripe(true);
    try {
      const { error } = await supabase.functions.invoke('cancel-subscription', {
        body: { companyId: company.id }
      });

      if (error) throw error;

      alert('Suscripción cancelada correctamente.');
      // Refresh page or data
      window.location.reload();
    } catch (e: any) {
      console.error(e);
      alert('Error al cancelar: ' + (e.message || 'Inténtalo de nuevo'));
    } finally {
      setIsLoadingStripe(false);
    }
  };

  const activeEmployeesCount = employees.filter(e => getStatus(e.id) === 'Fichado').length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Building size={80} />
          </div>
          <p className="text-slate-400 text-xs font-bold uppercase mb-2 flex items-center gap-2">
            <Briefcase size={14} className="text-blue-500" />
            Empresa
          </p>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">{company.name}</h2>
          <div className="p-3 bg-blue-50 rounded-xl inline-flex items-center gap-3 mb-4">
            <span className="text-[10px] text-blue-500 font-bold uppercase">PIN</span>
            <span className="font-mono font-black text-blue-700 tracking-widest text-lg">{company.pin}</span>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Suscripción</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${company.subscription_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                {(company.subscription_status || 'trialing').toUpperCase()}
              </span>
            </div>
            {company.subscription_status !== 'active' && company.trial_end && (
              <p className="text-[10px] text-slate-500 mb-3">
                Tu prueba gratuita termina en: <span className="font-bold">{new Date(company.trial_end).toLocaleDateString()}</span>
              </p>
            )}
            <button
              onClick={handleSubscription}
              disabled={isLoadingStripe}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
              <CreditCard size={14} />
              {isLoadingStripe ? 'Cargando...' : ((company.subscription_status === 'active' || (company.subscription_status === 'trialing' && company.stripe_customer_id)) ? 'Gestionar Facturas (Portal)' : 'Activar Suscripción')}
            </button>

            {(company.subscription_status === 'active' || company.subscription_status === 'trialing') && (
              <button
                onClick={handleCancelSubscription}
                disabled={isLoadingStripe}
                className="w-full mt-2 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
              >
                Cancelar Suscripción
              </button>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Users size={80} />
          </div>
          <p className="text-slate-400 text-xs font-bold uppercase mb-2 flex items-center gap-2">
            <Users size={14} className="text-green-500" />
            Equipo
          </p>
          <div className="flex items-end justify-between">
            <h2 className="text-5xl font-black text-slate-800">{employees.length}</h2>
            <div className="text-right">
              <span className="text-green-600 font-bold text-sm flex items-center gap-1 justify-end">
                <CheckCircle2 size={16} />
                {activeEmployeesCount} activos
              </span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-3xl shadow-xl text-white relative overflow-hidden">
          <p className="text-slate-400 text-xs font-bold uppercase mb-4 flex items-center gap-2">
            <FileText size={14} className="text-blue-400" />
            Exportar PDF
          </p>
          <div className="flex gap-2 mb-2">
            <div className="flex-1">
              <label className="text-[10px] text-slate-500 uppercase block mb-1 px-1">Inicio</label>
              <input type="date" className="w-full bg-slate-800 border-none rounded-xl text-xs p-2.5 outline-none focus:ring-1 focus:ring-blue-500" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-slate-500 uppercase block mb-1 px-1">Fin</label>
              <input type="date" className="w-full bg-slate-800 border-none rounded-xl text-xs p-2.5 outline-none focus:ring-1 focus:ring-blue-500" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} />
            </div>
          </div>
          <div className="mb-4">
            <label className="text-[10px] text-slate-500 uppercase block mb-1 px-1">Filtro</label>
            <select
              className="w-full bg-slate-800 border-none rounded-xl text-xs p-2.5 outline-none focus:ring-1 focus:ring-blue-500 text-slate-200"
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
            >
              <option value="all">Todo el equipo</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className={`w-full py-3 mb-2 ${isExporting ? 'bg-slate-700' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2`}
          >
            <FileText size={18} />
            {isExporting ? 'Descargando...' : 'Descargar PDF'}
          </button>

          <button
            onClick={handleSupportTest}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] font-bold rounded-lg transition-colors border border-slate-700"
          >
            TEST v11: Prueba Directa
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/30">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Search size={20} className="text-slate-400" />
            Gestión
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest">
                <th className="px-8 py-4 font-bold">Empleado</th>
                <th className="px-8 py-4 font-bold text-center">Estado</th>
                <th className="px-8 py-4 font-bold text-center">Contrato</th>
                <th className="px-8 py-4 font-bold text-center">Aviso Salida</th>
                <th className="px-8 py-4 font-bold text-right">Horas</th>
                <th className="px-8 py-4 font-bold text-right">Extras</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map(emp => {
                const weeklyMins = getWeeklyHours(emp.id);
                const contractedMins = (emp.contracted_hours_per_week || 40) * 60;
                const status = getStatus(emp.id);
                const isOvertime = weeklyMins > contractedMins;

                return (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-500 transition-colors">
                          <User size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{emp.name}</p>
                          <p className="text-xs text-slate-400">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className={`text-[10px] font-black px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 ${status === 'Fichado' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {status === 'Fichado' && <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>}
                        {status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      {editingHours === emp.id ? (
                        <input
                          type="number"
                          className="w-20 px-3 py-1.5 border-2 border-blue-500 rounded-lg text-center text-sm font-bold focus:outline-none"
                          defaultValue={emp.contracted_hours_per_week}
                          onBlur={(e) => handleUpdateWeeklyHours(emp, e.target.value)}
                          autoFocus
                        />
                      ) : (
                        <div
                          className="cursor-pointer hover:bg-blue-50 px-3 py-1.5 rounded-lg inline-flex items-center gap-2 text-slate-600 transition-colors group/edit"
                          onClick={() => setEditingHours(emp.id)}
                        >
                          <span className="font-bold tracking-tight">{emp.contracted_hours_per_week || 40}h</span>
                          <Edit2 size={12} className="opacity-0 group-hover/edit:opacity-100 transition-opacity text-blue-500" />
                        </div>
                      )}
                    </td>
                    <td className="px-8 py-5 text-center">
                      <input
                        type="time"
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        defaultValue={emp.nudge_time || ''}
                        onBlur={(e) => handleUpdateNudgeTime(emp.id, e.target.value)}
                      />
                    </td>
                    <td className="px-8 py-5 text-right font-mono font-bold text-slate-700">
                      {formatDuration(weeklyMins)}
                    </td>
                    <td className="px-8 py-5 text-right flex items-center justify-end gap-3">
                      {isOvertime ? (
                        <span className="text-orange-600 font-black text-xs flex items-center justify-end gap-1">
                          <AlertTriangle size={12} />
                          +{formatDuration(weeklyMins - contractedMins)}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-[10px] font-bold uppercase">Sin extras</span>
                      )}

                      {status === 'Fichado' && (
                        <button
                          onClick={() => handleNudge(emp.id)}
                          className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Recordar cerrar fichaje"
                        >
                          <Bell size={16} />
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteEmployee(emp.id)}
                        className="p-2 text-red-300 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors"
                        title="Eliminar empleado (Ajustar facturación)"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CompanyDashboard;
