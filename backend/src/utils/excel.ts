import * as exceljs from 'exceljs';

export const generateTraineeWorksheet = (ws: exceljs.Worksheet, user: any, attendances: any[], year: number, mon: number, daysInMonth: number) => {
  const maxSlot = user.slots?.reduce((max: number, slot: any) => Math.max(max, slot.slotNo), 0) || 1;

  const baseColumns = [
    { header: 'Sl No', key: 'slNo', width: 8 },
    { header: 'Day', key: 'day', width: 12 },
    { header: 'Date', key: 'date', width: 15 },
    { header: 'In Time', key: 'inTime', width: 15 },
    { header: 'Out Time', key: 'outTime', width: 15 },
  ];

  const slotColumns: any[] = [];
  for (let i = 1; i <= maxSlot; i++) {
    slotColumns.push({ header: `Slot-${i} Start`, key: `s${i}Start`, width: 12 });
    slotColumns.push({ header: `Slot-${i} End`, key: `s${i}End`, width: 12 });
    slotColumns.push({ header: `s${i} late punch in`, key: `s${i}Late`, width: 18 });
    slotColumns.push({ header: `s${i} early departure`, key: `s${i}Early`, width: 18 });
  }

  const endColumns = [
    { header: 'Late Arrival', key: 'late', width: 15 },
    { header: 'Early Departure', key: 'earlyDeparture', width: 18 }
  ];

  // Configure all columns first
  const allColumns = [...baseColumns, ...slotColumns, ...endColumns];
  ws.columns = allColumns.map(c => ({ key: c.key, width: c.width }));

  // Add Name and Phone at the top, merged and centered
  ws.addRow([]); // Row 1
  ws.addRow([]); // Row 2 spacing
  
  const totalCols = allColumns.length;
  ws.mergeCells(1, 1, 1, totalCols);
  
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `Name: ${user.fullName}        |        Phone: ${user.identifier}`;
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.font = { bold: true, size: 14 };

  // Set header values starting from row 3
  ws.getRow(3).values = allColumns.map(c => c.header);
  ws.getRow(3).font = { bold: true };
  ws.getRow(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1976D2' } };
  ws.getRow(3).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  let totalWorkedMinutes = 0;
  let totalLateMinutes = 0;
  let totalEarlyMinutes = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(year, mon - 1, day);
    const dayStr = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][currentDate.getDay()];
    
    const daySlots = user.slots?.filter((s: any) => s.dayOfWeek === dayStr).sort((a: any, b: any) => a.slotNo - b.slotNo) || [];
    const att = attendances.find(a => a.date.getDate() === day && a.date.getMonth() === (mon - 1));

    const s1 = daySlots.find((s: any) => s.slotNo === 1);
    const s2 = daySlots.find((s: any) => s.slotNo === 2);
    const s3 = daySlots.find((s: any) => s.slotNo === 3);

    let totalLateMins = 0;
    let totalEarlyMins = 0;

    const calcLate = (slot: any, inTime: Date) => {
      if (!slot) return '--';
      if (!inTime) return 'ABSENT';
      
      const [time, mod] = slot.startTime.split(' ');
      let [h, m] = time.split(':').map(Number);
      if (mod === 'PM' && h < 12) h += 12;
      if (mod === 'AM' && h === 12) h = 0;
      
      const [eTime, eMod] = slot.endTime.split(' ');
      let [eh, em] = eTime.split(':').map(Number);
      if (eMod === 'PM' && eh < 12) eh += 12;
      if (eMod === 'AM' && eh === 12) eh = 0;

      const start = new Date(currentDate);
      start.setHours(h, m, 0, 0);
      
      const end = new Date(currentDate);
      end.setHours(eh, em, 0, 0);

      if (inTime.getTime() > end.getTime()) {
        return 'ABSENT';
      }

      if (inTime.getTime() > start.getTime()) {
        const diff = inTime.getTime() - start.getTime();
        return Math.floor(diff / 60000);
      }
      return 0;
    };

    const calcEarly = (slot: any, outTime: Date, inTime: Date) => {
      if (!slot) return '--';
      const [eTime, eMod] = slot.endTime.split(' ');
      let [eh, em] = eTime.split(':').map(Number);
      if (eMod === 'PM' && eh < 12) eh += 12;
      if (eMod === 'AM' && eh === 12) eh = 0;
      const slotEnd = new Date(currentDate);
      slotEnd.setHours(eh, em, 0, 0);

      if (inTime && inTime.getTime() > slotEnd.getTime()) return '--';
      if (!outTime) return '--';
      
      if (outTime.getTime() < slotEnd.getTime()) {
        const diff = slotEnd.getTime() - outTime.getTime();
        return Math.floor(diff / 60000);
      }
      return 0;
    };

    let s1L: any = '--', s1E: any = '--', s2L: any = '--', s2E: any = '--', s3L: any = '--', s3E: any = '--';

    if (att) {
      if (att.inTime && att.outTime) {
        const diff = att.outTime.getTime() - att.inTime.getTime();
        totalWorkedMinutes += Math.floor(diff / 60000);
      }

      if (att.inTime) {
        const l1 = calcLate(s1, att.inTime);
        const l2 = calcLate(s2, att.inTime);
        const l3 = calcLate(s3, att.inTime);
        if (typeof l1 === 'number') { s1L = `${l1}m`; totalLateMins += l1; } else { s1L = l1; }
        if (typeof l2 === 'number') { s2L = `${l2}m`; totalLateMins += l2; } else { s2L = l2; }
        if (typeof l3 === 'number') { s3L = `${l3}m`; totalLateMins += l3; } else { s3L = l3; }
      } else {
        s1L = s1 ? 'ABSENT' : '--';
        s2L = s2 ? 'ABSENT' : '--';
        s3L = s3 ? 'ABSENT' : '--';
      }

      if (att.outTime) {
        const e1 = calcEarly(s1, att.outTime, att.inTime!);
        const e2 = calcEarly(s2, att.outTime, att.inTime!);
        const e3 = calcEarly(s3, att.outTime, att.inTime!);
        if (typeof e1 === 'number') { s1E = `${e1}m`; totalEarlyMins += e1; } else { s1E = e1; }
        if (typeof e2 === 'number') { s2E = `${e2}m`; totalEarlyMins += e2; } else { s2E = e2; }
        if (typeof e3 === 'number') { s3E = `${e3}m`; totalEarlyMins += e3; } else { s3E = e3; }
      }
    }

    totalLateMinutes += totalLateMins;
    totalEarlyMinutes += totalEarlyMins;

    const fullDayStr = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][currentDate.getDay()];

    ws.addRow({
      slNo: day,
      day: fullDayStr,
      date: currentDate.toLocaleDateString('en-IN'),
      inTime: att?.inTime ? att.inTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
      outTime: att?.outTime ? att.outTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
      s1Start: s1?.startTime || '--',
      s1End: s1?.endTime || '--',
      s1Late: s1L,
      s1Early: s1E,
      s2Start: s2?.startTime || '--',
      s2End: s2?.endTime || '--',
      s2Late: s2L,
      s2Early: s2E,
      s3Start: s3?.startTime || '--',
      s3End: s3?.endTime || '--',
      s3Late: s3L,
      s3Early: s3E,
      late: totalLateMins > 0 ? `${Math.floor(totalLateMins / 60)}h ${totalLateMins % 60}m` : '0m',
      earlyDeparture: totalEarlyMins > 0 ? `${Math.floor(totalEarlyMins / 60)}h ${totalEarlyMins % 60}m` : '0m'
    });
  }

  // Add total row
  const totalRow = ws.addRow({
    slNo: 'TOTAL',
    late: `${Math.floor(totalLateMinutes / 60)}h ${totalLateMinutes % 60}m`,
    earlyDeparture: `${Math.floor(totalEarlyMinutes / 60)}h ${totalEarlyMinutes % 60}m`
  });
  totalRow.font = { bold: true };
};
