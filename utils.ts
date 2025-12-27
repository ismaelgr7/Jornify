import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const sanitizeFilename = (name: string): string => {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 20);
};

export const formatDate = (isoString: string): string => {
  try {
    return new Date(isoString).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return isoString;
  }
};

export const formatTime = (isoString: string): string => {
  try {
    return new Date(isoString).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoString;
  }
};

export const formatDuration = (minutes: number): string => {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

export const calculateDurationMinutes = (start: string, end: string): number => {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.floor((e - s) / (1000 * 60));
};

export const getWeekRange = (date: Date = new Date()) => {
  const curr = new Date(date);
  const first = curr.getDate() - curr.getDay() + (curr.getDay() === 0 ? -6 : 1);
  const firstDay = new Date(curr.setDate(first));
  firstDay.setHours(0, 0, 0, 0);
  const lastDay = new Date(new Date(firstDay).setDate(firstDay.getDate() + 6));
  lastDay.setHours(23, 59, 59, 999);
  return { start: firstDay, end: lastDay };
};

/**
 * Calculates a SHA-256 hash of the given data string.
 * Uses the browser's SubtleCrypto API.
 */
export const calculateSHA256 = async (data: string): Promise<string> => {
  const encoder = new TextEncoder();
  const dataUint8 = encoder.encode(data);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Generates a unique hash for a record based on its content and the parent hash.
 */
export const calculateRecordHash = async (record: any, parentHash: string = ''): Promise<string> => {
  const data = JSON.stringify({
    employee_id: record.employee_id,
    start_time: record.start_time,
    end_time: record.end_time,
    type: record.type,
    notes: record.notes || '',
    parent_hash: parentHash
  });
  return calculateSHA256(data);
};

/**
 * Verifies the integrity of a chain of records.
 * Returns true if all hashes match their content and parent link.
 */
export const verifyHashChain = async (records: any[]): Promise<{ isValid: boolean; brokenIdx: number | null }> => {
  const sorted = [...records].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  for (let i = 0; i < sorted.length; i++) {
    const record = sorted[i];
    const parentHash = i === 0 ? '' : sorted[i - 1].row_hash;

    if (record.parent_hash !== parentHash) {
      return { isValid: false, brokenIdx: i };
    }

    const recalculatedHash = await calculateRecordHash(record, parentHash);
    if (record.row_hash !== recalculatedHash) {
      return { isValid: false, brokenIdx: i };
    }
  }

  return { isValid: true, brokenIdx: null };
};

const generateVerificationHash = (companyName: string, range: { start: string; end: string }, records: any[]): string => {
  // Use the hash of the last record if available, otherwise fallback to the old logic
  const lastRecord = records[records.length - 1];
  if (lastRecord?.row_hash) {
    return lastRecord.row_hash.substring(0, 10).toUpperCase();
  }

  const data = `${companyName}-${range.start}-${range.end}-${records.length}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
};

const emergencyMinimalPDF = (companyName: string, range: { start: string; end: string }, records: any[], employeeName: string) => {
  try {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('REGISTRO DE JORNADA (MODO EMERGENCIA)', 14, 20);
    doc.setFontSize(10);
    doc.text(`Empresa: ${companyName} | Trabajador: ${employeeName}`, 14, 30);
    doc.text(`Periodo: ${formatDate(range.start)} - ${formatDate(range.end)}`, 14, 35);

    let y = 50;
    records.forEach(r => {
      doc.text(`${formatDate(r.start_time)} | ${formatTime(r.start_time)} - ${r.end_time ? formatTime(r.end_time) : '-'}`, 14, y);
      y += 6;
      if (y > 280) { doc.addPage(); y = 20; }
    });

    doc.save(`registro_emergencia_${Date.now()}.pdf`);
  } catch (e) {
    alert('Failed to generate even emergency PDF.');
  }
};

export const generatePDF = (
  companyName: string,
  range: { start: string; end: string },
  records: any[],
  employees: any[],
  employeeName: string = 'Todos',
  monthlySignatures?: { month: number; year: number; signature_data: string; employee_id: string }[]
) => {
  console.log('--- JORNIFY PDF ENGINE v18.0 (Multi-Employee + Signatures Fix) ---');

  try {
    const doc = new jsPDF();
    const vHash = generateVerificationHash(companyName, range, records);
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    // Group records by employee
    const recordsByEmployee: Record<string, any[]> = {};
    records.forEach(r => {
      if (!recordsByEmployee[r.employee_id]) recordsByEmployee[r.employee_id] = [];
      recordsByEmployee[r.employee_id].push(r);
    });

    const employeeIds = Object.keys(recordsByEmployee);

    if (employeeIds.length === 0) {
      alert('No hay registros para generar el PDF.');
      return;
    }

    employeeIds.forEach((empId, index) => {
      // Add new page for subsequent employees
      if (index > 0) doc.addPage();

      const empRecords = recordsByEmployee[empId];
      const currentEmployee = employees.find(e => e.id === empId);
      const currentEmployeeName = currentEmployee?.name || 'Desconocido';

      // Header per employee
      doc.setFontSize(18);
      doc.text('REGISTRO MENSUAL DE JORNADA', 14, 20);

      doc.setFontSize(10);
      doc.text(`Empresa: ${companyName}`, 14, 30);
      doc.text(`Trabajador: ${currentEmployeeName}`, 14, 35);
      doc.text(`Periodo: ${formatDate(range.start)} - ${formatDate(range.end)}`, 14, 40);
      doc.text(`ID Verificación: ${vHash}`, 14, 45); // Global hash for the batch

      // Sort records for this employee
      const sortedRecords = [...empRecords].sort((a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );

      // Track weekly totals for this employee
      const weeklyAccMinutes: Record<string, number> = {};
      const getWeekKey = (dateStr: string) => {
        const d = new Date(dateStr);
        const { start } = getWeekRange(d);
        return start.toISOString().split('T')[0];
      };

      const tableRows = sortedRecords.map(r => {
        const contractedWeeklyMinutes = (currentEmployee?.contracted_hours_per_week || 40) * 60;
        const weekKey = getWeekKey(r.start_time);
        const isBreak = r.type === 'break';

        const recordDate = new Date(r.start_time);
        const rMonth = recordDate.getMonth();
        const rYear = recordDate.getFullYear();

        // Check signatures matching month, year AND employee_id
        const isSigned = monthlySignatures?.some(s =>
          s.month === rMonth &&
          s.year === rYear &&
          s.employee_id === r.employee_id
        );

        const currentWeekTotalBefore = weeklyAccMinutes[weekKey] || 0;
        const duration = r.duration_minutes || 0;

        let extraMins = 0;
        if (!isBreak) {
          if (currentWeekTotalBefore >= contractedWeeklyMinutes) {
            extraMins = duration;
          } else if (currentWeekTotalBefore + duration > contractedWeeklyMinutes) {
            extraMins = (currentWeekTotalBefore + duration) - contractedWeeklyMinutes;
          }
          weeklyAccMinutes[weekKey] = currentWeekTotalBefore + duration;
        }

        const signatureBlock = isSigned ? 'Firmado Digitalmente' : '________________';
        const notesBlock = r.notes ? ` [Nota: ${r.notes}]` : '';

        return [
          formatDate(r.start_time),
          `${formatTime(r.start_time)} ${isBreak ? '(Pausa)' : ''}`,
          r.end_time ? formatTime(r.end_time) : '-',
          isBreak ? `(${formatDuration(duration)})` : formatDuration(duration),
          isBreak ? '00:00' : (extraMins > 0 ? formatDuration(extraMins) : '00:00'),
          signatureBlock + notesBlock
        ];
      });

      autoTable(doc, {
        startY: 55,
        head: [['Fecha', 'Entrada', 'Salida', 'Horas', 'Extra', 'Observaciones/Firma']],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [31, 41, 55], textColor: 255 },
        styles: { fontSize: 8, cellPadding: 2 },
        margin: { top: 55 }
      });

      // Footer & Signatures
      let currentY = (doc as any).lastAutoTable?.finalY || 150;
      currentY += 10;

      doc.setFontSize(10);
      doc.text('Firma del Trabajador: ___________________________', 14, currentY + 15);

      currentY += 25;

      doc.setFontSize(8);
      currentY += 5;
      if (currentY + 15 > 280) { doc.addPage(); currentY = 20; }

      doc.text('Este documento sirve como registro oficial de jornada según el Real Decreto-ley 8/2019.', 14, currentY);

      const integrityCode = sortedRecords[sortedRecords.length - 1]?.row_hash?.substring(0, 16).toUpperCase() || vHash;
      doc.text(`Código de Integridad (SHA-256): ${integrityCode} | Jornify.io`, 14, currentY + 5);
    });

    const fileName = `registro_${sanitizeFilename(companyName)}_completo.pdf`;
    doc.save(fileName);

    console.log('--- PDF v18.0 SUCCESS ---');

  } catch (err: any) {
    console.error('FATAL PDF ERROR:', err);
    // Emergency Fallback
    emergencyMinimalPDF(companyName, range, records, employeeName);
  }
};


