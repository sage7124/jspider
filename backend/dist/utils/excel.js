"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTraineeWorksheet = exports.getTraineeReportData = void 0;
const getTraineeReportData = (user, attendances, year, mon, daysInMonth, holidays = [], leaves = [], earlyLeaves = []) => {
    let totalWorkedMinutes = 0;
    let totalLateMinutes = 0;
    let totalEarlyMinutes = 0;
    let totalExtraMinutes = 0;
    const rows = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();
    // Build a distinct sorted set of ACTIVE slot numbers actually assigned to this user
    const activeSlots = (user.slots || []).filter((s) => !s.effectiveTo);
    const assignedSlotNos = activeSlots.map((s) => Number(s.slotNo)).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
    const hasExtraSlots = assignedSlotNos.some(n => n > 3);
    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, mon - 1, day);
        const dayStr = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][currentDate.getDay()];
        const fullDayStr = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][currentDate.getDay()];
        const isFutureDay = currentDate.getTime() > today.getTime();
        const isToday = currentDate.getTime() === today.getTime();
        const daySlots = user.slots?.filter((s) => {
            if (s.dayOfWeek !== dayStr)
                return false;
            const effectiveFrom = s.effectiveFrom ? new Date(s.effectiveFrom) : (s.createdAt ? new Date(s.createdAt) : null);
            if (effectiveFrom) {
                effectiveFrom.setHours(0, 0, 0, 0);
                const current = new Date(currentDate);
                current.setHours(0, 0, 0, 0);
                if (current.getTime() < effectiveFrom.getTime()) {
                    return false;
                }
            }
            const effectiveTo = s.effectiveTo ? new Date(s.effectiveTo) : null;
            if (effectiveTo) {
                effectiveTo.setHours(0, 0, 0, 0);
                const current = new Date(currentDate);
                current.setHours(0, 0, 0, 0);
                if (current.getTime() > effectiveTo.getTime()) {
                    return false;
                }
            }
            return true;
        }).sort((a, b) => a.slotNo - b.slotNo) || [];
        const att = attendances.find((a) => {
            const aDate = new Date(new Date(a.date).getTime() + (5.5 * 60 * 60 * 1000));
            return aDate.getUTCDate() === day && (aDate.getUTCMonth() + 1) === mon;
        });
        // Check for Holiday
        const holiday = holidays.find(h => {
            const hDate = new Date(new Date(h.date).getTime() + (5.5 * 60 * 60 * 1000));
            return hDate.getUTCDate() === day && (hDate.getUTCMonth() + 1) === mon && hDate.getUTCFullYear() === year;
        });
        // Check for Approved Leaves
        const dayLeaves = leaves.filter(l => {
            const d = new Date(Date.UTC(year, mon - 1, day, 12, 0, 0));
            const start = new Date(new Date(l.startDate).getTime() + (5.5 * 60 * 60 * 1000));
            start.setUTCHours(0, 0, 0, 0);
            const end = new Date(new Date(l.endDate).getTime() + (5.5 * 60 * 60 * 1000));
            end.setUTCHours(23, 59, 59, 999);
            const dTime = d.getTime();
            return dTime >= start.getTime() && dTime <= end.getTime() && l.status === 'APPROVED';
        });
        const hasWholeDayLeave = dayLeaves.some(l => !l.slots);
        const activeLeave = dayLeaves.find(l => !l.slots);
        // Check if before Date of Joining
        let isBeforeJoining = false;
        if (user.dateOfJoining) {
            const joiningDate = new Date(user.dateOfJoining);
            joiningDate.setHours(0, 0, 0, 0);
            const cmpDate = new Date(currentDate);
            cmpDate.setHours(0, 0, 0, 0);
            if (cmpDate < joiningDate) {
                isBeforeJoining = true;
            }
        }
        // Base row object populated dynamically later
        const rowData = {
            slNo: day,
            day: fullDayStr,
            date: currentDate.toLocaleDateString('en-IN'),
            late: '0m',
            earlyDeparture: '0m',
            extraWork: '0m'
        };
        if (isBeforeJoining) {
            assignedSlotNos.forEach((si) => {
                rowData[`s${si}In`] = '---';
                rowData[`s${si}Out`] = '---';
                rowData[`s${si}Start`] = '---';
                rowData[`s${si}End`] = '---';
                rowData[`s${si}Late`] = '---';
                rowData[`s${si}Early`] = '---';
            });
            rows.push(rowData);
            continue;
        }
        if ((holiday || hasWholeDayLeave) && daySlots.length > 0) {
            // Pre-fill only assigned slots with labels
            assignedSlotNos.forEach((si, idx) => {
                if (idx === 0) {
                    rowData[`s${si}In`] = holiday ? 'HOLIDAY' : 'LEAVE';
                    rowData[`s${si}Out`] = holiday ? holiday.name : (activeLeave?.reason || 'Leave');
                }
                else {
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
        const getSlotStartTime = (slot) => {
            if (!slot)
                return null;
            const [time, mod] = slot.startTime.split(' ');
            let [h, m] = time.split(':').map(Number);
            if (mod === 'PM' && h < 12)
                h += 12;
            if (mod === 'AM' && h === 12)
                h = 0;
            const d = new Date(currentDate);
            d.setHours(h, m, 0, 0);
            return d;
        };
        let dayLateMins = 0;
        let dayEarlyMins = 0;
        let dayExtraMins = 0;
        const isSunday = currentDate.getDay() === 0;
        const calcLate = (slot, dayInTime, slotInTime, isExtra) => {
            if (!slot)
                return '--';
            if (isExtra)
                return '--'; // EXEMPT Extra Work from Lateness logic
            const inTime = slotInTime || dayInTime;
            if (!inTime) {
                if (isFutureDay || isSunday)
                    return '--';
                const start = getSlotStartTime(slot);
                if (isToday && start && start.getTime() > now.getTime())
                    return '--';
                return 'ABSENT';
            }
            const [time, mod] = slot.startTime.split(' ');
            let [h, m] = time.split(':').map(Number);
            if (mod === 'PM' && h < 12)
                h += 12;
            if (mod === 'AM' && h === 12)
                h = 0;
            const [eTime, eMod] = slot.endTime.split(' ');
            let [eh, em] = eTime.split(':').map(Number);
            if (eMod === 'PM' && eh < 12)
                eh += 12;
            if (eMod === 'AM' && eh === 12)
                eh = 0;
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
        const calcEarly = (slot, dayOutTime, dayInTime, slotOutTime, slotInTime, isExtra) => {
            if (!slot)
                return '--';
            if (isExtra)
                return '--'; // EXEMPT Extra Work from early departure logic
            const outTime = slotOutTime || dayOutTime;
            const inTime = slotInTime || dayInTime;
            const [eTime, eMod] = slot.endTime.split(' ');
            let [eh, em] = eTime.split(':').map(Number);
            if (eMod === 'PM' && eh < 12)
                eh += 12;
            if (eMod === 'AM' && eh === 12)
                eh = 0;
            const slotEnd = new Date(currentDate);
            slotEnd.setHours(eh, em, 0, 0);
            if (inTime && inTime.getTime() > slotEnd.getTime())
                return '--';
            if (!outTime) {
                if (isFutureDay || isSunday)
                    return '--';
                if (isToday && slotEnd.getTime() > now.getTime())
                    return '--';
                return '--';
            }
            if (outTime.getTime() < slotEnd.getTime()) {
                return Math.floor((slotEnd.getTime() - outTime.getTime()) / 60000);
            }
            return 0;
        };
        const getDefaultStatus = (slot, isExtra) => {
            if (!slot)
                return '--';
            if (isExtra)
                return '--'; // Extra slots are implicitly non-mandatory, return -- instead of ABSENT
            if (isFutureDay || isSunday)
                return '--';
            const start = getSlotStartTime(slot);
            if (isToday && start && start.getTime() > now.getTime())
                return '--';
            return 'ABSENT';
        };
        const getSlotInTimeStatus = (slot, slotInTime, isExtra, branchName, infoText) => {
            if (slotInTime) {
                const timeStr = new Date(slotInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const base = branchName ? `${timeStr}, ${branchName}` : timeStr;
                return infoText ? `${base} (${infoText})` : base;
            }
            return getDefaultStatus(slot, isExtra);
        };
        const getSlotOutTimeStatus = (slot, slotOutTime, hasIn, isExtra, branchName, infoText) => {
            if (slotOutTime) {
                const timeStr = new Date(slotOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const base = branchName ? `${timeStr}, ${branchName}` : timeStr;
                return infoText ? `${base} (${infoText})` : base;
            }
            if (!slot)
                return '--';
            if (isExtra)
                return '--'; // Never display absent/missing on an empty extra slot.
            if (isFutureDay)
                return '--';
            const start = getSlotStartTime(slot);
            if (isToday && start && start.getTime() > now.getTime())
                return '--';
            return hasIn ? 'MISSING OUT' : 'ABSENT';
        };
        // Core iteration — only process slots that are actually assigned
        for (const si of assignedSlotNos) {
            let slot = daySlots.find((s) => s.slotNo === si);
            const isExtra = si > 3; // Definition of Extra Slot
            // Check for approved slot-level leave
            const activeLeaveForSlot = dayLeaves.find(l => {
                if (!l.slots)
                    return false; // Full day leaves are handled by the pre-fill block
                const leaveSlots = l.slots.split(',').map(s => s.trim());
                return leaveSlots.some(s => parseInt(s.split('(')[0]) === si);
            });
            let leaveTimeStr = null;
            if (activeLeaveForSlot) {
                const slotString = activeLeaveForSlot.slots.split(',').map(s => s.trim()).find(s => parseInt(s.split('(')[0]) === si);
                const timeMatch = slotString ? slotString.match(/\(([^)]+)\)/) : null;
                leaveTimeStr = timeMatch ? timeMatch[1] : null;
            }
            if (activeLeaveForSlot && !leaveTimeStr) {
                rowData[`s${si}In`] = 'LEAVE';
                rowData[`s${si}Out`] = activeLeaveForSlot.reason || 'Leave';
                rowData[`s${si}Start`] = '--';
                rowData[`s${si}End`] = '--';
                rowData[`s${si}Late`] = '--';
                rowData[`s${si}Early`] = '--';
                continue;
            }
            // Override slot object with snapshotted timing if saved in Attendance record
            if (att && att[`slotStart${si}`] && att[`slotEnd${si}`]) {
                slot = {
                    slotNo: si,
                    startTime: att[`slotStart${si}`],
                    endTime: att[`slotEnd${si}`]
                };
            }
            if (slot && leaveTimeStr) {
                slot = {
                    ...slot,
                    endTime: leaveTimeStr
                };
            }
            let rawIn = att ? att[`inTime${si}`] : null;
            let rawOut = att ? att[`outTime${si}`] : null;
            // Clean legacy branch names starting with LEGACY_
            const cleanBranch = (bName) => {
                if (!bName)
                    return undefined;
                const trimmed = bName.trim();
                if (trimmed.toUpperCase().startsWith('LEGACY_'))
                    return undefined;
                return trimmed;
            };
            const cleanInfo = (iText) => {
                if (!iText)
                    return undefined;
                if (iText.includes('Legacy DB A Import') || iText.includes('Legacy DB B Import'))
                    return undefined;
                return iText;
            };
            let inBranch = att ? cleanBranch(att[`inBranch${si}`]) : undefined;
            let outBranch = att ? cleanBranch(att[`outBranch${si}`]) : undefined;
            const infoText = att ? cleanInfo(att[`info${si}`] || (si === 1 ? att.info : null)) : undefined;
            // Legacy fallback injection removed so overall punches no longer pollute Column D if Slot 1 is cleared.
            const sIn = rawIn ? new Date(rawIn) : undefined;
            const sOut = rawOut ? new Date(rawOut) : undefined;
            const dayPermission = earlyLeaves.find((el) => {
                const elDate = new Date(new Date(el.date).getTime() + (5.5 * 60 * 60 * 1000));
                return elDate.getUTCDate() === day &&
                    (elDate.getUTCMonth() + 1) === mon &&
                    elDate.getUTCFullYear() === year &&
                    (el.slotNo === si || el.slotNo === 0);
            });
            let adjustedOut = sOut;
            let earlyLeaveText = '';
            if (sOut && slot && !isExtra && dayPermission) {
                const [eTime, eMod] = slot.endTime.split(' ');
                let [eh, em] = eTime.split(':').map(Number);
                if (eMod === 'PM' && eh < 12)
                    eh += 12;
                if (eMod === 'AM' && eh === 12)
                    eh = 0;
                const slotEnd = new Date(currentDate);
                slotEnd.setHours(eh, em, 0, 0);
                const earlyDepartureMins = Math.floor((slotEnd.getTime() - sOut.getTime()) / 60000);
                if (earlyDepartureMins > 0) {
                    const allowed = dayPermission.allowedMinutes;
                    if (earlyDepartureMins <= allowed) {
                        adjustedOut = slotEnd;
                    }
                    else {
                        adjustedOut = new Date(sOut.getTime() + allowed * 60000);
                    }
                    const reasonPart = dayPermission.reason ? `: ${dayPermission.reason}` : '';
                    earlyLeaveText = `Early Leave${reasonPart}`;
                }
            }
            rowData[`s${si}In`] = getSlotInTimeStatus(slot, sIn, isExtra, inBranch, infoText);
            let outStatus = getSlotOutTimeStatus(slot, adjustedOut, !!sIn, isExtra, outBranch, infoText);
            if (earlyLeaveText && outStatus !== 'MISSING OUT' && outStatus !== 'ABSENT') {
                outStatus = `${outStatus} (${earlyLeaveText})`;
            }
            if (leaveTimeStr) {
                outStatus = `${outStatus} (Leave after ${leaveTimeStr})`;
            }
            rowData[`s${si}Out`] = outStatus;
            let finalLate = '--';
            let finalEarly = '--';
            if (att) {
                // ── Calculation for Regular Slots ────────────────────────────────────
                if (!isExtra) {
                    const safeIn = att.inTime ? new Date(att.inTime) : undefined;
                    const safeOut = att.outTime ? new Date(att.outTime) : undefined;
                    const l = calcLate(slot, safeIn, sIn, false);
                    const e = calcEarly(slot, safeOut, safeIn, adjustedOut, sIn, false);
                    if (typeof l === 'number') {
                        dayLateMins += l;
                        finalLate = `${l}m`;
                    }
                    else {
                        finalLate = l;
                    }
                    if (finalLate === 'ABSENT') {
                        finalEarly = 'ABSENT';
                    }
                    else {
                        if (typeof e === 'number') {
                            dayEarlyMins += e;
                            finalEarly = `${e}m`;
                        }
                        else {
                            finalEarly = e;
                        }
                    }
                    // Overwrite missing out for overall record safety
                    if (!att.outTime && !att.outTime1 && !att.outTime2 && !att.outTime3 && !att.outTime4 && !att.outTime5) {
                        if (finalLate !== 'ABSENT' && finalLate !== '--')
                            finalEarly = 'MISSING OUT';
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
            }
            else {
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
        const allInfos = att ? [att.info, att.info1, att.info2, att.info3, att.info4, att.info5]
            .filter(Boolean)
            .map(i => i)
            .filter(i => !i.includes('Legacy DB A Import') && !i.includes('Legacy DB B Import')) : [];
        rowData.infoText = allInfos.length > 0 ? Array.from(new Set(allInfos)).join('; ') : '--';
        rows.push(rowData);
    }
    return {
        rows,
        totals: {
            late: `${Math.floor(totalLateMinutes / 60)}h ${totalLateMinutes % 60}m`,
            earlyDeparture: `${Math.floor(totalEarlyMinutes / 60)}h ${totalEarlyMinutes % 60}m`,
            extraWork: `${Math.floor(totalExtraMinutes / 60)}h ${totalExtraMinutes % 60}m`
        },
        totalLateMinutes,
        totalEarlyMinutes,
        assignedSlotNos,
        hasExtraSlots,
        hasSlot1: assignedSlotNos.includes(1),
        hasSlot2: assignedSlotNos.includes(2),
        hasSlot3: assignedSlotNos.includes(3)
    };
};
exports.getTraineeReportData = getTraineeReportData;
const generateTraineeWorksheet = (ws, user, attendances, year, mon, daysInMonth, holidays = [], leaves = [], earlyLeaves = []) => {
    // Build distinct sorted set of ACTIVE slot numbers — only columns for these will appear
    const activeSlots = (user.slots || []).filter((s) => !s.effectiveTo);
    const assignedSlotNos = activeSlots.map((s) => Number(s.slotNo)).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
    const hasExtraSlots = assignedSlotNos.some(n => n > 3);
    const baseColumns = [
        { header: 'Day', key: 'day', width: 12 },
        { header: 'Date', key: 'date', width: 15 },
    ];
    const slotColumns = [];
    for (const i of assignedSlotNos.filter(n => n <= 3)) {
        const isExtra = i > 3;
        const prefix = isExtra ? `🔥 Extra Slot ${i - 3}` : `Slot ${i}`;
        slotColumns.push({ header: `${prefix} In`, key: `s${i}In`, width: 15 });
        slotColumns.push({ header: `${prefix} Out`, key: `s${i}Out`, width: 15 });
        if (!isExtra) {
            slotColumns.push({ header: `S${i} Late Arrival`, key: `s${i}Late`, width: 18 });
            slotColumns.push({ header: `S${i} Early Dep`, key: `s${i}Early`, width: 18 });
        }
    }
    const endColumns = [
        { header: 'Info', key: 'infoText', width: 25 },
        { header: 'Total Late', key: 'late', width: 15 },
        { header: 'Total Early', key: 'earlyDeparture', width: 15 },
    ];
    // Conditionally gating extra work column to hide functionally per user's instructions (can restore boolean check later if wanted)
    if (false && hasExtraSlots) {
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
    // Define color-coded theme mapping for the header row columns
    headerRow.eachCell((cell, colNum) => {
        const headerName = allColumns[colNum - 1]?.header || '';
        let color = 'FF475569'; // Standard Slate Grey for Day & Date
        if (headerName.includes('Slot 1') || headerName.includes('S1 ')) {
            color = 'FF2563EB'; // Vivid Bright Blue for Slot 1
        }
        else if (headerName.includes('Slot 2') || headerName.includes('S2 ')) {
            color = 'FF047857'; // Emerald/Teal for Slot 2
        }
        else if (headerName.includes('Slot 3') || headerName.includes('S3 ')) {
            color = 'FF6D28D9'; // Deep Purple for Slot 3
        }
        else if (headerName.includes('Total')) {
            color = 'FFBE123C'; // Crimson Red for Grand Totals
        }
        else if (headerName.includes('EXTRA')) {
            color = 'FFEA580C'; // Orange for any remaining Extra tasks
        }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    });
    const reportData = (0, exports.getTraineeReportData)(user, attendances, year, mon, daysInMonth, holidays, leaves, earlyLeaves);
    for (const row of reportData.rows) {
        const addedRow = ws.addRow(row);
        addedRow.eachCell((cell) => {
            const valStr = String(cell.value || '').toUpperCase();
            if (valStr === 'ABSENT') {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFEE2E2' } // Light red background
                };
                cell.font = {
                    color: { argb: 'FF991B1B' }, // Dark red text
                    bold: true
                };
            }
            else if (valStr === 'LEAVE' || valStr === 'HOLIDAY') {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFD1FAE5' } // Light green background
                };
                cell.font = {
                    color: { argb: 'FF065F46' }, // Dark green text
                    bold: true
                };
            }
        });
    }
    const totalRowData = {
        day: 'GRAND TOTAL',
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
    // Append user's assigned weekly schedule below the grand total
    ws.addRow([]);
    ws.addRow([]);
    const scheduleTitleRow = ws.addRow(['ASSIGNED WEEKLY SCHEDULE']);
    scheduleTitleRow.font = { bold: true, size: 12, color: { argb: 'FF1976D2' } };
    const daysOfWeek = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    for (const day of daysOfWeek) {
        const daySlots = (user.slots || []).filter((s) => s.dayOfWeek === day && !s.effectiveTo).sort((a, b) => a.slotNo - b.slotNo);
        if (daySlots.length > 0) {
            const scheduleString = daySlots.map((s) => `Slot ${s.slotNo}: ${s.startTime} - ${s.endTime}`).join('  |  ');
            const row = ws.addRow(['', day, scheduleString]);
            row.getCell(2).font = { bold: true };
        }
    }
};
exports.generateTraineeWorksheet = generateTraineeWorksheet;
//# sourceMappingURL=excel.js.map