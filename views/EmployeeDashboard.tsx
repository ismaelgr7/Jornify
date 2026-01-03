import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Employee, Company, TimeRecord } from '../types';
import { formatDate, formatTime, calculateDurationMinutes, formatDuration, getWeekRange, generatePDF } from '../utils';
import { Clock, Play, Square, Calendar, Building, AlertCircle, History, PenTool, Download, BellRing, ShieldCheck } from 'lucide-react';
import { supabase } from '../supabase';
import { subscribeUserToPush } from '../src/utils/pushNotifications';
import SignatureModal from '../components/SignatureModal';

interface EmployeeDashboardProps {
  employee: Employee;
  company?: Company;
  records: TimeRecord[];
  signatures?: any[];
  onNewRecord: (r: TimeRecord) => void;
  onUpdateRecord: (r: TimeRecord) => void;
}

const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ employee, company, records, signatures = [], onNewRecord, onUpdateRecord }) => {
  const [activeRecord, setActiveRecord] = useState<TimeRecord | null>(null);
  const [timer, setTimer] = useState(0);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [nudge, setNudge] = useState(employee.clock_out_nudge || false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  // Ref to prevent spamming the nudge API call
  const nudgeRequestedRef = useRef(false);

  useEffect(() => {
    if (employee.clock_out_nudge && !nudge) {
      // Trigger native notification if permission is granted
      if (notifPermission === 'granted') {
        new Notification("Jornify: Recordatorio", {
          body: "Parece que olvidaste cerrar tu jornada. ¡Ficha la salida ahora!",
          icon: "/pwa-192x192.png",
          vibrate: [200, 100, 200]
        } as any);
      }
      // Reset so it can be triggered again
      resetNudge();
    }
    setNudge(employee.clock_out_nudge || false);
    // Reset the ref if the prop becomes false (meaning it was handled/reset)
    if (!employee.clock_out_nudge) {
      nudgeRequestedRef.current = false;
    }
  }, [employee.clock_out_nudge, notifPermission]);

  // Date selection for history and custom export
  const defaultStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const defaultEnd = new Date().toISOString().split('T')[0];
  const [filterRange, setFilterRange] = useState({ start: defaultStart, end: defaultEnd });

  // Current Month Data
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const currentMonthSignature = useMemo(() =>
    signatures.find(s => s.month === currentMonth && s.year === currentYear),
    [signatures, currentMonth, currentYear]);

  const hasRecordsThisMonth = useMemo(() => records.some(r => {
    const d = new Date(r.start_time);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }), [records, currentMonth, currentYear]);

  // Optimize Active Record detection
  useEffect(() => {
    const active = records.find(r => r.end_time === null);
    if (active) {
      // Only update if ID changes to avoid timer reset on trivial updates
      setActiveRecord(prev => prev?.id === active.id ? active : active);

      // Calculate timer only on mount or if active record ID changes
      if (!activeRecord || activeRecord.id !== active.id) {
        const start = new Date(active.start_time).getTime();
        const now = new Date().getTime();
        setTimer(Math.floor((now - start) / 1000));
      }
    } else {
      setActiveRecord(null);
      setTimer(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records]);

  useEffect(() => {
    let interval: any;
    if (activeRecord) {
      // Function to calculate exact elapsed time
      const updateTimer = () => {
        const start = new Date(activeRecord.start_time).getTime();
        const now = Date.now();
        const diff = Math.max(0, Math.floor((now - start) / 1000));
        setTimer(diff);

        // Check for scheduled nudge
        if (employee.nudge_time && !nudge && !nudgeRequestedRef.current) {
          const nowTime = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
          if (nowTime === employee.nudge_time) {
            handleAutoNudge();
          }
        }
      };

      // Initial call to set immediate state
      updateTimer();

      // Update every second (even if throttled, the math will correct itself on next tick)
      interval = setInterval(updateTimer, 1000);
    }
    return () => clearInterval(interval);
  }, [activeRecord, employee.nudge_time, nudge]);

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      subscribeUserToPush(employee.id);
    }
  }, [employee.id]);

  const handleAutoNudge = async () => {
    // Immediate local guard
    if (nudgeRequestedRef.current) return;
    nudgeRequestedRef.current = true;

    try {
      await supabase.from('employees').update({ clock_out_nudge: true }).eq('id', employee.id);
      // We don't setNudge(true) here because the real-time sub in App.tsx 
      // will update the employee prop, which triggers the nudge effect.
    } catch (e) {
      console.error('Error triggering auto nudge:', e);
      nudgeRequestedRef.current = false; // Reset on error so we can retry
    }
  };

  const handleToggleWork = async () => {
    // Subscription / Trial enforcement
    const creationDate = company?.created_at ? new Date(company.created_at) : new Date();
    const trialEndDate = new Date(creationDate.getTime() + 14 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const isWithinInitialTrial = now <= trialEndDate;
    const hasActiveSubscription = company?.subscription_status === 'active' || company?.subscription_status === 'trialing';

    if (!isWithinInitialTrial && !hasActiveSubscription) {
      if (!activeRecord) {
        alert('El periodo de prueba de Jornify para tu empresa ha finalizado. Por favor, pide al administrador que active la suscripción para continuar registrando la jornada.');
        return;
      }
    }

    if (activeRecord) {
      const endTime = new Date().toISOString();
      const updatedRecord: TimeRecord = {
        ...activeRecord,
        end_time: endTime,
        duration_minutes: calculateDurationMinutes(activeRecord.start_time, endTime)
      };
      onUpdateRecord(updatedRecord);

      // Cancel any pending reminder for this work session
      try {
        await supabase.from('scheduled_reminders')
          .update({ sent_at: new Date().toISOString() })
          .eq('time_record_id', activeRecord.id)
          .is('sent_at', null);
      } catch (e) {
        console.error('Error canceling reminder:', e);
      }
    } else {
      const newRecord: TimeRecord = {
        id: crypto.randomUUID(),
        employee_id: employee.id,
        employee_name: employee.name,
        start_time: new Date().toISOString(),
        end_time: null,
        duration_minutes: 0,
        type: 'work'
      };
      onNewRecord(newRecord);

      // Schedule automatic reminder based on employee's typical shift duration
      try {
        const clockInTime = new Date();
        const shiftHours = employee.typical_shift_hours || 8; // Default to 8h if not set
        const reminderTime = new Date(clockInTime.getTime() + shiftHours * 60 * 60 * 1000);

        await supabase.from('scheduled_reminders').insert({
          employee_id: employee.id,
          time_record_id: newRecord.id,
          scheduled_time: reminderTime.toISOString()
        });
      } catch (e) {
        console.error('Error scheduling reminder:', e);
      }
    }
    if (nudge) resetNudge();
  };

  const handleToggleBreak = () => {
    const isBreakActive = activeRecord?.type === 'break';
    const endTime = new Date().toISOString();

    if (activeRecord) {
      const updatedRecord: TimeRecord = {
        ...activeRecord,
        end_time: endTime,
        duration_minutes: calculateDurationMinutes(activeRecord.start_time, endTime)
      };
      onUpdateRecord(updatedRecord);
    }

    const newRecord: TimeRecord = {
      id: crypto.randomUUID(),
      employee_id: employee.id,
      employee_name: employee.name,
      start_time: endTime,
      end_time: null,
      duration_minutes: 0,
      type: isBreakActive ? 'work' : 'break'
    };
    onNewRecord(newRecord);
    if (nudge) resetNudge();
  };

  const resetNudge = async () => {
    try {
      await supabase.from('employees').update({ clock_out_nudge: false }).eq('id', employee.id);
      setNudge(false);
      nudgeRequestedRef.current = false;
    } catch (e) {
      console.error('Error resetting nudge:', e);
    }
  };

  const requestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') {
      alert("Tu navegador no soporta notificaciones.");
      return;
    }
    try {
      console.log("Requesting permission...");
      const permission = await Notification.requestPermission();
      console.log("Permission result:", permission);
      setNotifPermission(permission);

      if (permission === 'granted') {
        await subscribeUserToPush(employee.id);
      }

      if (permission === 'denied') {
        alert("Has bloqueado las notificaciones. Debes habilitarlas manualmente en la configuración del navegador.");
      } else if (permission === 'default') {
        alert("No se ha seleccionado ninguna opción. Inténtalo de nuevo.");
      }
    } catch (e) {
      console.error("Error asking for permission:", e);
      alert("Error al solicitar permisos: " + e);
    }
  };

  const handleSaveSignature = async (signatureData: string) => {
    try {
      const { error } = await supabase.from('monthly_signatures').upsert({
        employee_id: employee.id,
        month: currentMonth,
        year: currentYear,
        signature_data: signatureData,
        signed_at: new Date().toISOString()
      }, { onConflict: 'employee_id, month, year' });

      if (error) {
        throw error;
      }

      setIsSignModalOpen(false);
      alert('¡Registro mensual firmado correctamente!');
    } catch (err: any) {
      alert('Error al guardar la firma: ' + (err.message || 'Error desconocido'));
    }
  };

  const handleDownloadPDF = () => {
    if (!company) return;

    const monthRecords = records.filter(r => {
      const d = new Date(r.start_time);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const startOfMonth = new Date(currentYear, currentMonth, 1).toISOString();
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).toISOString();

    const isSubActive = company.subscription_status === 'active' || (company.subscription_status === 'trialing' && !!company.stripe_customer_id);
    const isTrialing = company.subscription_status === 'trialing' && !company.stripe_customer_id;
    const isExpired = !isSubActive && company.trial_end && new Date() > new Date(company.trial_end);

    if (isExpired) {
      alert('La suscripción de la empresa ha caducado. Contacta con tu administrador para activar el plan premium y poder descargar informes.');
      return;
    }

    generatePDF(
      company.name,
      { start: startOfMonth, end: endOfMonth },
      monthRecords,
      [employee],
      employee.name,
      currentMonthSignature ? [currentMonthSignature] : []
    );
  };

  const handleDownloadCustomPDF = () => {
    if (!company) return;

    const filteredRecords = records.filter(r => {
      const d = new Date(r.start_time).toISOString().split('T')[0];
      return d >= filterRange.start && d <= filterRange.end;
    });

    if (filteredRecords.length === 0) {
      alert('No hay registros en el rango seleccionado.');
      return;
    }

    // Filter signatures for the range
    const rangeSignatures = signatures.filter(s => {
      const start = new Date(filterRange.start);
      const end = new Date(filterRange.end);
      const sDate = new Date(s.year, s.month, 1);
      return sDate >= new Date(start.getFullYear(), start.getMonth(), 1) &&
        sDate <= new Date(end.getFullYear(), end.getMonth(), 1);
    });

    const isSubActive = company.subscription_status === 'active';
    const isExpired = !isSubActive && company.trial_end && new Date() > new Date(company.trial_end);

    if (isExpired) {
      alert('La suscripción de la empresa ha caducado. Contacta con tu administrador para activar el plan premium.');
      return;
    }

    generatePDF(
      company.name,
      { start: filterRange.start, end: filterRange.end },
      filteredRecords,
      [employee],
      employee.name,
      rangeSignatures
    );
  };

  const weeklyHours = useMemo(() => {
    const { start, end } = getWeekRange();
    const weekRecords = records.filter(r => {
      const d = new Date(r.start_time);
      return d >= start && d <= end && r.end_time !== null && r.type !== 'break';
    });
    return weekRecords.reduce((acc, r) => acc + r.duration_minutes, 0);
  }, [records]);

  const weeklyContractedMins = (employee.contracted_hours_per_week || 40) * 60;
  const progress = Math.min((weeklyHours / weeklyContractedMins) * 100, 100);
  const isOvertimeWeek = weeklyHours > weeklyContractedMins;

  const currentMonthMinutes = useMemo(() => {
    return records.filter(r => {
      const d = new Date(r.start_time);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && r.end_time !== null && r.type !== 'break';
    }).reduce((acc, r) => acc + r.duration_minutes, 0);
  }, [records, currentMonth, currentYear]);

  const sortedFilteredRecords = useMemo(() => {
    return [...records].filter(r => {
      const d = new Date(r.start_time).toISOString().split('T')[0];
      return d >= filterRange.start && d <= filterRange.end;
    }).reverse();
  }, [records, filterRange]);

  const formatTimer = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Trial Status Notice */}
      {company && company.subscription_status !== 'active' && company.trial_end && (
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl mb-6 flex items-center gap-3 text-amber-800">
          <ShieldCheck size={18} className="text-amber-500" />
          <p className="text-xs">
            Modo de Prueba: {new Date() > new Date(company.trial_end)
              ? <span className="font-bold text-red-600">CADUCADO</span>
              : <span>Finaliza el <span className="font-bold">{new Date(company.trial_end).toLocaleDateString()}</span></span>
            }
          </p>
        </div>
      )}

      {/* Notification Permission Nudge */}
      {notifPermission === 'default' && (
        <div className="bg-blue-600 text-white p-4 rounded-2xl mb-6 flex items-center justify-between gap-4 shadow-md border border-blue-400/30">
          <div className="flex items-center gap-3">
            <BellRing size={20} className="text-blue-100" />
            <p className="text-sm font-medium">¿Quieres recibir recordatorios en tu móvil?</p>
          </div>
          <button
            onClick={requestNotificationPermission}
            className="text-xs bg-white text-blue-600 px-4 py-2 rounded-xl font-bold hover:bg-blue-50 transition-colors"
          >
            Activar avisos
          </button>
        </div>
      )}

      {/* Nudge Alert */}
      {nudge && (
        <div className="bg-red-600 text-white p-4 rounded-2xl mb-8 flex items-center justify-between gap-4 shadow-lg animate-bounce-subtle">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <AlertCircle size={24} />
            </div>
            <div>
              <p className="font-bold">¡Recordatorio de Fichaje!</p>
              <p className="text-sm text-red-100">Parece que olvidaste cerrar tu jornada. Por favor, ficha la salida.</p>
            </div>
          </div>
          <button
            onClick={resetNudge}
            className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg font-bold transition-colors uppercase tracking-wider"
          >
            Entendido
          </button>
        </div>
      )}

      {/* Welcome & Time Entry Section */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex-1 w-full">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-3xl font-bold text-slate-900">Hola, {employee.name}</h2>
          </div>
          <p className="text-slate-500 mb-6 flex items-center gap-2">
            <Building size={16} className="text-blue-500" />
            Empresa: <span className="font-semibold text-slate-700">{company?.name}</span>
          </p>

          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-slate-600 flex items-center gap-2">
                <Clock size={16} />
                Progreso Semanal
              </span>
              <span className="text-slate-500 font-medium">{formatDuration(weeklyHours)} / {employee.contracted_hours_per_week}h</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 ${isOvertimeWeek ? 'bg-orange-500' : 'bg-blue-600'}`}
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center bg-slate-900 p-8 rounded-3xl shadow-xl w-full md:w-auto min-w-[280px]">
          {activeRecord ? (
            <div className="mb-6 text-center">
              <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2 flex items-center justify-center gap-2">
                <span className={`w-2 h-2 rounded-full animate-pulse ${activeRecord.type === 'break' ? 'bg-amber-400' : 'bg-blue-400'}`}></span>
                {activeRecord.type === 'break' ? 'En descanso' : 'En curso'}
              </p>
              <p className="text-5xl font-black text-white font-mono tracking-tighter">{formatTimer(timer)}</p>
            </div>
          ) : (
            <div className="mb-6 text-center">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Listo para empezar</p>
              <p className="text-5xl font-black text-slate-700 font-mono tracking-tighter">00:00:00</p>
            </div>
          )}

          <div className="w-full space-y-3">
            <button
              onClick={handleToggleWork}
              className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3 ${activeRecord ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
            >
              {activeRecord ? <Square size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
              {activeRecord ? 'FIN DE JORNADA' : 'INICIAR JORNADA'}
            </button>

            {activeRecord && (
              <button
                onClick={handleToggleBreak}
                className={`w-full py-3 rounded-xl font-bold text-md shadow-md transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3 ${activeRecord.type === 'break' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'
                  }`}
              >
                {activeRecord.type === 'break' ? <Play size={18} fill="currentColor" /> : <Clock size={18} />}
                {activeRecord.type === 'break' ? 'REANUDAR TRABAJO' : 'PAUSAR DESCANSO'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Custom Export Selector */}
      <div className="bg-slate-900 rounded-3xl shadow-xl p-6 mb-8 text-white flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex-1">
          <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Exportar Historial</h4>
          <p className="text-slate-400 text-xs mb-4 md:mb-0">Selecciona un rango personalizado para descargar tus registros.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-end gap-4 w-full md:w-auto">
          <div className="w-full sm:w-auto">
            <label className="text-[10px] text-slate-500 uppercase block mb-1 px-1">Desde</label>
            <input
              type="date"
              className="bg-slate-800 border-none rounded-xl text-sm p-3 outline-none focus:ring-1 focus:ring-blue-500 w-full"
              value={filterRange.start}
              onChange={(e) => setFilterRange(prev => ({ ...prev, start: e.target.value }))}
            />
          </div>
          <div className="w-full sm:w-auto">
            <label className="text-[10px] text-slate-500 uppercase block mb-1 px-1">Hasta</label>
            <input
              type="date"
              className="bg-slate-800 border-none rounded-xl text-sm p-3 outline-none focus:ring-1 focus:ring-blue-500 w-full"
              value={filterRange.end}
              onChange={(e) => setFilterRange(prev => ({ ...prev, end: e.target.value }))}
            />
          </div>
          <button
            onClick={handleDownloadCustomPDF}
            className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-lg w-full sm:w-auto flex items-center justify-center gap-2"
          >
            <Download size={20} />
            <span className="sm:hidden lg:inline text-sm font-bold tracking-tight">Exportar</span>
          </button>
        </div>
      </div>

      {/* Monthly Signature Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Registro de {monthNames[currentMonth]}</h4>
            {currentMonthSignature ? (
              <p className="text-green-600 font-bold flex items-center gap-2">
                <PenTool size={16} />
                Firmado Digitalmente
              </p>
            ) : (
              <p className="text-amber-500 font-bold flex items-center gap-2">
                <AlertCircle size={16} />
                Pendiente de firma
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {!currentMonthSignature && hasRecordsThisMonth && (
              <button
                onClick={() => setIsSignModalOpen(true)}
                className="p-3 bg-amber-100 text-amber-600 rounded-xl hover:bg-amber-200 transition-colors shadow-sm"
                title="Firmar registro mensual"
              >
                <PenTool size={20} />
              </button>
            )}
            <button
              onClick={handleDownloadPDF}
              className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors shadow-sm"
              title="Descargar PDF Mensual"
            >
              <Download size={20} />
            </button>
          </div>
        </div>

        <div className="bg-indigo-600 rounded-3xl shadow-lg p-6 text-white flex items-center justify-between">
          <div>
            <p className="text-indigo-100 text-sm font-medium mb-1">Total este mes</p>
            <h3 className="text-3xl font-black">
              {formatDuration(currentMonthMinutes)}
            </h3>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
            <Calendar size={24} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <History size={20} className="text-blue-600" />
            Historial de Registros
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/80 text-slate-400 text-xs uppercase tracking-wider">
                <th className="px-8 py-4 font-semibold">Día</th>
                <th className="px-8 py-4 font-semibold">Actividad</th>
                <th className="px-8 py-4 font-semibold">Entrada</th>
                <th className="px-8 py-4 font-semibold">Salida</th>
                <th className="px-8 py-4 text-right">Duración</th>
                <th className="px-8 py-4 text-center">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedFilteredRecords.map(record => (
                <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-2 font-medium text-slate-700">
                      <Calendar size={14} className="text-slate-400" />
                      {formatDate(record.start_time)}
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${record.type === 'break'
                      ? 'bg-amber-100 text-amber-700 border border-amber-200'
                      : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                      }`}>
                      {record.type === 'break' ? 'Descanso' : 'Trabajo'}
                    </span>
                  </td>
                  <td className="px-8 py-4 text-slate-600 font-mono text-sm">{formatTime(record.start_time)}</td>
                  <td className="px-8 py-4 text-slate-600 font-mono text-sm">
                    {record.end_time ? (
                      formatTime(record.end_time)
                    ) : (
                      <span className="text-blue-600 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-ping"></span>
                        En curso
                      </span>
                    )}
                  </td>
                  <td className="px-8 py-4 text-right font-mono font-bold text-slate-800">
                    {record.end_time ? formatDuration(record.duration_minutes) : '-'}
                  </td>
                  <td className="px-8 py-4 text-center">
                    <button
                      onClick={() => {
                        const note = window.prompt('Añade una nota para este registro:', record.notes || '');
                        if (note !== null) {
                          onUpdateRecord({ ...record, notes: note });
                        }
                      }}
                      className={`p-2 rounded-lg transition-colors ${record.notes ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:bg-slate-100'}`}
                      title={record.notes || 'Añadir nota'}
                    >
                      <PenTool size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400 italic">No hay registros de tiempo.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SignatureModal
        isOpen={isSignModalOpen}
        onClose={() => setIsSignModalOpen(false)}
        onSave={handleSaveSignature}
        monthName={`${monthNames[currentMonth]} ${currentYear}`}
      />
    </div>
  );
};

export default EmployeeDashboard;
