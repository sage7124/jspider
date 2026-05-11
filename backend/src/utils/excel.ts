import * as exceljs from 'exceljs';

export const getTraineeReportData = (user: any, attendances: any[], year: number, mon: number, daysInMonth: number, holidays: any[] = [], leaves: any[] = []) => {
  let totalWorkedMinutes = 0;
  let totalLateMinutes = 0;
  let totalEarlyMinutes = 0;
  let totalExtraMinutes = 0;

  const rows = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const now = new Date();

  // Build a distinct sorted set of slot numbers actually assigned to this user
  const assignedSlotNos: number[] = (user.slots || []).map((s: any) => Number(s.slotNo)).filter((v: number, i: number, a: number[]) => a.indexOf(v) === i).sort((a: number, b: number) => a - b);
  const hasExtraSlots = assignedSlotNos.some(n => n > 3);

  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(year, mon - 1, day);
    const dayStr = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][currentDate.getDay()];
    const fullDayStr = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][currentDate.getDay()];
    
    const isFutureDay = currentDate.getTime() > today.getTime();
    const isToday = currentDate.getTime() === today.getTime();

    const daySlots = user.slots?.filter((s: any) => s.dayOfWeek === dayStr).sort((a: any, b: any) => a.slotNo - b.slotNo) || [];
    const att = attendances.find((a: any) => new Date(a.date).getDate() === day && new Date(a.date).getMonth() === (mon - 1));

    // Check for Holiday
    const holiday = holidays.find(h => {
      const hDate = new Date(h.date);
      return hDate.getDate() === day && hDate.getMonth() === (mon - 1) && hDate.getFullYear() === year;
    });

    // Check for Approved Leave
    const leave = leaves.find(l => {
      const d = new Date(year, mon - 1, day);
      const start = new Date(l.startDate);
      start.setHours(0,0,0,0);
      const end = new Date(l.endDate);
      end.setHours(23,59,59,999);
      return d >= start && d <= end && l.status === 'APPROVED';
    });

    // Base row object populated dynamically later
    const rowData: any = {
      slNo: day,
      day: fullDayStr,
      date: currentDate.toLocaleDateString('en-IN'),
      late: '0m',
      earlyDeparture: '0m',
      extraWork: '0m'
    };

    if (holiday || leave) {
      // Pre-fill only assigned slots with labels
      assignedSlotNos.forEach((si, idx) => {
        if (idx === 0) {
          rowData[`s${si}In`] = holiday ? 'HOLIDAY' : 'LEAVE';
          rowData[`s${si}Out`] = holiday ? holiday.name : (leave?.reason || 'Leave');
        } else {
          rowData[`s${si}In`] = '--';
          rowData[`s${si}Out`] = '--';
        }
        rowData[`s${si}Start`] = '--';
        rowData[`s${si}End`] = '--';
        rowData[`s${si}Late`] = '--';
        rowData[`s${si}Early`] = '--';
      });
      rows.push(rowData);
      continue;
    }

    const getSlotStartTime = (slot: any) => {
      if (!slot) return null;
      const [time, mod] = slot.startTime.split(' ');
      let [h, m] = time.split(':').map(Number);
      if (mod === 'PM' && h < 12) h += 12;
      if (mod === 'AM' && h === 12) h = 0;
      const d = new Date(currentDate);
      d.setHours(h, m, 0, 0);
      return d;
    };

    let dayLateMins = 0;
    let dayEarlyMins = 0;
    let dayExtraMins = 0;
    const isSunday = currentDate.getDay() === 0;

    const calcLate = (slot: any, dayInTime: Date, slotInTime?: Date, isExtra?: boolean) => {
      if (!slot) return '--';
      if (isExtra) return '--'; // EXEMPT Extra Work from Lateness logic
      
      const inTime = slotInTime || dayInTime;
      if (!inTime) {
        if (isFutureDay || isSunday) return '--';
        const start = getSlotStartTime(slot);
        if (isToday && start && start.getTime() > now.getTime()) return '--';
        return 'ABSENT';
      }
      
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
        return isSunday ? '--' : 'ABSENT';
      }
      if (inTime.getTime() > start.getTime()) {
        return Math.floor((inTime.getTime() - start.getTime()) / 60000);
      }
      return 0;
    };

    const calcEarly = (slot: any, dayOutTime: Date, dayInTime: Date, slotOutTime?: Date, slotInTime?: Date, isExtra?: boolean) => {
      if (!slot) return '--';
      if (isExtra) return '--'; // EXEMPT Extra Work from early departure logic
      
      const outTime = slotOutTime || dayOutTime;
      const inTime = slotInTime || dayInTime;

      const [eTime, eMod] = slot.endTime.split(' ');
      let [eh, em] = eTime.split(':').map(Number);
      if (eMod === 'PM' && eh < 12) eh += 12;
      if (eMod === 'AM' && eh === 12) eh = 0;
      const slotEnd = new Date(currentDate);
      slotEnd.setHours(eh, em, 0, 0);

      if (inTime && inTime.getTime() > slotEnd.getTime()) return '--';
      if (!outTime) {
        if (isFutureDay || isSunday) return '--';
        if (isToday && slotEnd.getTime() > now.getTime()) return '--';
        return '--';
      }
      
      if (outTime.getTime() < slotEnd.getTime()) {
        return Math.floor((slotEnd.getTime() - outTime.getTime()) / 60000);
      }
      return 0;
    };

    const getDefaultStatus = (slot: any, isExtra?: boolean) => {
      if (!slot) return '--';
      if (isExtra) return '--'; // Extra slots are implicitly non-mandatory, return -- instead of ABSENT
      if (isFutureDay || isSunday) return '--';
      const start = getSlotStartTime(slot);
      if (isToday && start && start.getTime() > now.getTime()) return '--';
      return 'ABSENT';
    };

    const getSlotInTimeStatus = (slot: any, slotInTime?: Date, isExtra?: boolean) => {
      if (slotInTime) return new Date(slotInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return getDefaultStatus(slot, isExtra);
    };

    const getSlotOutTimeStatus = (slot: any, slotOutTime?: Date, hasIn?: boolean, isExtra?: boolean) => {
      if (slotOutTime) return new Date(slotOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (!slot) return '--';
      if (isExtra) return '--'; // Never display absent/missing on an empty extra slot.
      if (isFutureDay) return '--';
      const start = getSlotStartTime(slot);
      if (isToday && start && start.getTime() > now.getTime()) return '--';
      return hasIn ? 'MISSING OUT' : 'ABSENT';
    };

    // Core iteration — only process slots that are actually assigned
    for (const si of assignedSlotNos) {
      const slot = daySlots.find((s: any) => s.slotNo === si);
      const isExtra = si > 3; // Definition of Extra Slot
      
      let rawIn = att ? att[`inTime${si}`] : null;
      let rawOut = att ? att[`outTime${si}`] : null;

      // Support legacy fields for Slot 1
      if (si === 1 && att && !rawIn) rawIn = att.inTime;
      if (si === 1 && att && !rawOut) rawOut = att.outTime;

      const sIn = rawIn ? new Date(rawIn) : undefined;
      const sOut = rawOut ? new Date(rawOut) : undefined;

      rowData[`s${si}Start`] = slot?.startTime || '--';
      rowData[`s${si}End`] = slot?.endTime || '--';
      rowData[`s${si}In`] = getSlotInTimeStatus(slot, sIn, isExtra);
      rowData[`s${si}Out`] = getSlotOutTimeStatus(slot, sOut, !!sIn, isExtra);

      let finalLate: any = '--';
      let finalEarly: any = '--';

      if (att) {
        // ── Calculation for Regular Slots ────────────────────────────────────
        if (!isExtra) {
          const safeIn = att.inTime ? new Date(att.inTime) : undefined;
          const safeOut = att.outTime ? new Date(att.outTime) : undefined;
          
          const l = calcLate(slot, safeIn, sIn, false);
          const e = calcEarly(slot, safeOut, safeIn, sOut, sIn, false);
          
          if (typeof l === 'number') { dayLateMins += l; finalLate = `${l}m`; } else { finalLate = l; }
          
          if (finalLate === 'ABSENT') {
            finalEarly = 'ABSENT';
          } else {
            if (typeof e === 'number') { dayEarlyMins += e; finalEarly = `${e}m`; } else { finalEarly = e; }
          }
          
          // Overwrite missing out for overall record safety
          if (!att.outTime && !att.outTime1 && !att.outTime2 && !att.outTime3 && !att.outTime4 && !att.outTime5) {
            if (finalLate !== 'ABSENT' && finalLate !== '--') finalEarly = 'MISSING OUT';
          }
        } 
        // ── Calculation for Extra Slots ──────────────────────────────────────
        else if (slot && sIn && sOut) {
          // Only calculate duration IF they have a full set of punches!
          const durationMins = Math.floor((sOut.getTime() - sIn.getTime()) / 60000);
          if (durationMins > 0) {
            dayExtraMins += durationMins;
          }
        }
      } else {
        // Explicit absent logic fallback
        finalLate = getDefaultStatus(slot, isExtra);
        finalEarly = getDefaultStatus(slot, isExtra);
      }

      rowData[`s${si}Late`] = finalLate;
      rowData[`s${si}Early`] = finalEarly;
    }

    totalLateMinutes += dayLateMins;
    totalEarlyMinutes += dayEarlyMins;
    totalExtraMinutes += dayExtraMins;

    // Update final row strings
    rowData.late = dayLateMins > 0 ? `${Math.floor(dayLateMins / 60)}h ${dayLateMins % 60}m` : '0m';
    rowData.earlyDeparture = dayEarlyMins > 0 ? `${Math.floor(dayEarlyMins / 60)}h ${dayEarlyMins % 60}m` : '0m';
    rowData.extraWork = dayExtraMins > 0 ? `${Math.floor(dayExtraMins / 60)}h ${dayExtraMins % 60}m` : '0m';

    rows.push(rowData);
  }

  return {
    rows,
    totals: {
      late: `${Math.floor(totalLateMinutes / 60)}h ${totalLateMinutes % 60}m`,
      earlyDeparture: `${Math.floor(totalEarlyMinutes / 60)}h ${totalEarlyMinutes % 60}m`,
      extraWork: `${Math.floor(totalExtraMinutes / 60)}h ${totalExtraMinutes % 60}m`
    },
    assignedSlotNos,
    hasExtraSlots
  };
};


export const generateTraineeWorksheet = (ws: exceljs.Worksheet, user: any, attendances: any[], year: number, mon: number, daysInMonth: number, holidays: any[] = [], leaves: any[] = []) => {
  // Build distinct sorted set of slot numbers — only columns for these will appear
  const assignedSlotNos: number[] = (user.slots || []).map((s: any) => Number(s.slotNo)).filter((v: number, i: number, a: number[]) => a.indexOf(v) === i).sort((a: number, b: number) => a - b);
  const hasExtraSlots = assignedSlotNos.some(n => n > 3);

  const baseColumns = [
    { header: 'Sl No', key: 'slNo', width: 8 },
    { header: 'Day', key: 'day', width: 12 },
    { header: 'Date', key: 'date', width: 15 },
  ];

  const slotColumns: any[] = [];
  for (const i of assignedSlotNos) {
    const isExtra = i > 3;
    const prefix = isExtra ? `🔥 Extra Slot ${i - 3}` : `Slot ${i}`;
    
    slotColumns.push({ header: `${prefix} In`, key: `s${i}In`, width: 15 });
    slotColumns.push({ header: `${prefix} Out`, key: `s${i}Out`, width: 15 });
    
    // Only show Start/End/Late/Early for regular slots, not extra work slots
    if (!isExtra) {
      slotColumns.push({ header: `${prefix} Start`, key: `s${i}Start`, width: 12 });
      slotColumns.push({ header: `${prefix} End`, key: `s${i}End`, width: 12 });
      slotColumns.push({ header: `S${i} Late Arrival`, key: `s${i}Late`, width: 18 });
      slotColumns.push({ header: `S${i} Early Dep`, key: `s${i}Early`, width: 18 });
    }
  }

  const endColumns = [
    { header: 'Total Late', key: 'late', width: 15 },
    { header: 'Total Early', key: 'earlyDeparture', width: 15 },
  ];
  // Only add extra work column if the user actually has extra slots
  if (hasExtraSlots) {
    endColumns.push({ header: 'TOTAL EXTRA WORK', key: 'extraWork', width: 20 });
  }

  const allColumns = [...baseColumns, ...slotColumns, ...endColumns];
  ws.columns = allColumns.map(c => ({ key: c.key, width: c.width }));

  // Add merged header row
  ws.addRow([]);
  ws.addRow([]);
  
  const totalCols = allColumns.length;
  ws.mergeCells(1, 1, 1, totalCols);
  
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `ATTENDANCE REPORT: ${user.fullName}   |   PHONE: ${user.identifier}`;
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.font = { bold: true, size: 14 };

  // Set Sub-header values for each col on Row 3
  const headerRow = ws.getRow(3);
  headerRow.values = allColumns.map(c => c.header);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  
  // Style regular slots different from extra slots in the header for visual delight
  headerRow.eachCell((cell, colNum) => {
    const headerName = allColumns[colNum - 1]?.header || '';
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerName.includes('EXTRA') ? 'FFEA580C' : 'FF1976D2' } };
  });

  const reportData = getTraineeReportData(user, attendances, year, mon, daysInMonth, holidays, leaves);

  for (const row of reportData.rows) {
    ws.addRow(row);
  }

  const totalRowData: any = {
    slNo: 'GRAND TOTAL',
    late: reportData.totals.late,
    earlyDeparture: reportData.totals.earlyDeparture,
  };
  if (hasExtraSlots) {
    totalRowData.extraWork = reportData.totals.extraWork;
  }
  const totalRow = ws.addRow(totalRowData);
  totalRow.font = { bold: true };
  totalRow.eachCell((cell) => {
     cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  });
};
