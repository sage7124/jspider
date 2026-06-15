import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import * as exceljs from 'exceljs';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware';
import { getTraineeReportData } from '../utils/excel';

const router = Router();
const prisma = new PrismaClient();

// Helper function to calculate all payslip parameters for a trainee
export const calculateTraineeSalaryData = async (
  trainee: any,
  year: number,
  mon: number,
  daysInMonth: number,
  startOfMonth: Date,
  endOfMonth: Date,
  passedSettings?: any
) => {
  // Fetch trainee's attendances, holidays, and approved leaves for this month
  const attendances = await prisma.attendance.findMany({
    where: {
      userId: trainee.id,
      date: { gte: startOfMonth, lte: endOfMonth }
    }
  });

  const holidays = await prisma.holiday.findMany({
    where: {
      date: { gte: startOfMonth, lte: endOfMonth }
    }
  });

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      userId: trainee.id,
      status: 'APPROVED',
      startDate: { lte: endOfMonth },
      endDate: { gte: startOfMonth }
    }
  });

  // Fetch count and hours of APPROVED extra classes and other center classes
  const extraClasses = await prisma.extraClassLog.findMany({
    where: {
      userId: trainee.id,
      status: 'APPROVED',
      date: { gte: startOfMonth, lte: endOfMonth }
    }
  });

  const otherCenterClasses = await prisma.otherCenterClassLog.findMany({
    where: {
      userId: trainee.id,
      status: 'APPROVED',
      date: { gte: startOfMonth, lte: endOfMonth }
    }
  });

  const extraClassesCount = extraClasses.length;
  const extraClassesHours = extraClasses.reduce((sum, item) => sum + (item.duration || 0.0), 0.0);
  const otherCenterClassesCount = otherCenterClasses.length;
  const otherCenterClassesHours = otherCenterClasses.reduce((sum, item) => sum + (item.duration || 0.0), 0.0);

  // Calculate approved leaves count for the selected month day-by-day
  let approvedLeavesCount = 0;
  for (let dIndex = 1; dIndex <= daysInMonth; dIndex++) {
    const currentDate = new Date(year, mon - 1, dIndex);
    const leave = leaves.find(l => {
      const dObj = new Date(Date.UTC(year, mon - 1, dIndex, 12, 0, 0));
      const start = new Date(new Date(l.startDate).getTime() + (5.5 * 60 * 60 * 1000));
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(new Date(l.endDate).getTime() + (5.5 * 60 * 60 * 1000));
      end.setUTCHours(23, 59, 59, 999);
      
      const dTime = dObj.getTime();
      return dTime >= start.getTime() && dTime <= end.getTime() && l.status === 'APPROVED';
    });
    if (leave) {
      approvedLeavesCount++;
    }
  }

  // Compute report rows using the utility
  const report = getTraineeReportData(trainee, attendances, year, mon, daysInMonth, holidays, leaves);
  
  let lateInstances = 0;
  let earlyInstances = 0;
  let absentDays = 0;

  report.rows.forEach(r => {
    let hasSlotsScheduled = false;
    let isRowAbsent = false;
    let isRowLate = false;
    let isRowEarly = false;

    [1, 2, 3].forEach(si => {
      const lateVal = r[`s${si}Late`];
      const earlyVal = r[`s${si}Early`];

      if (lateVal !== '---' && lateVal !== undefined) {
        hasSlotsScheduled = true;
      }
      if (lateVal === 'ABSENT' || earlyVal === 'ABSENT') {
        isRowAbsent = true;
      }
      if (typeof lateVal === 'number' && lateVal > 0) {
        isRowLate = true;
      } else if (typeof lateVal === 'string' && lateVal.endsWith('m') && parseInt(lateVal) > 0) {
        isRowLate = true;
      }

      if (typeof earlyVal === 'number' && earlyVal > 0) {
        isRowEarly = true;
      } else if (typeof earlyVal === 'string' && earlyVal.endsWith('m') && parseInt(earlyVal) > 0) {
        isRowEarly = true;
      }
    });

    if (hasSlotsScheduled) {
      if (isRowAbsent) {
        absentDays++;
      } else {
        if (isRowLate) lateInstances++;
        if (isRowEarly) earlyInstances++;
      }
    }
  });

  const settings = passedSettings || await prisma.instituteSettings.findUnique({ where: { id: 1 } });

  const baseSalary = trainee.baseSalary || 0.0;
  const trainingFee = trainee.trainingFee || 0.0;

  // Deduction values
  const lateRate = trainee.lateRate !== null && trainee.lateRate !== undefined ? trainee.lateRate : (settings?.lateRate !== undefined ? settings.lateRate : 30.0);
  const earlyRate = trainee.earlyRate !== null && trainee.earlyRate !== undefined ? trainee.earlyRate : (settings?.earlyRate !== undefined ? settings.earlyRate : 30.0);
  const absentRateSetting = trainee.absentRate !== null && trainee.absentRate !== undefined ? trainee.absentRate : (settings?.absentRate !== undefined ? settings.absentRate : 0.0);
  const eligibleCLs = 1;

  // Overrides for late/early types & intervals
  const lateDeductionType = (trainee.lateDeductionType !== null && trainee.lateDeductionType !== undefined && trainee.lateDeductionType !== "") ? trainee.lateDeductionType : (settings?.lateDeductionType || "instance");
  const lateIntervalValue = Math.max(1, (trainee.lateIntervalValue !== null && trainee.lateIntervalValue !== undefined) ? trainee.lateIntervalValue : (settings?.lateIntervalValue || 15));
  const earlyDeductionType = (trainee.earlyDeductionType !== null && trainee.earlyDeductionType !== undefined && trainee.earlyDeductionType !== "") ? trainee.earlyDeductionType : (settings?.earlyDeductionType || "instance");
  const earlyIntervalValue = Math.max(1, (trainee.earlyIntervalValue !== null && trainee.earlyIntervalValue !== undefined) ? trainee.earlyIntervalValue : (settings?.earlyIntervalValue || 15));

  const totalLateMinutes = (report as any).totalLateMinutes || 0;
  const totalEarlyMinutes = (report as any).totalEarlyMinutes || 0;

  // Helper to parse "Xh Ym" or "Ym" or "0m" into total minutes
  const parseMinutes = (str: string): number => {
    if (!str || str === '0m' || str === '--' || str === 'ABSENT' || str === 'MISSING OUT') return 0;
    let minutes = 0;
    const hourMatch = str.match(/(\d+)h/);
    const minMatch = str.match(/(\d+)m/);
    if (hourMatch) minutes += parseInt(hourMatch[1]) * 60;
    if (minMatch) minutes += parseInt(minMatch[1]);
    return minutes;
  };

  let lateDeduction = 0;
  if (lateDeductionType === 'instance') {
    lateDeduction = lateInstances * lateRate;
  } else if (lateDeductionType === 'minute') {
    lateDeduction = totalLateMinutes * lateRate;
  } else if (lateDeductionType === 'hour') {
    lateDeduction = (totalLateMinutes / 60) * lateRate;
  } else if (lateDeductionType === 'interval') {
    report.rows.forEach(r => {
      const dayLateMins = parseMinutes(r.late);
      if (dayLateMins > 0) {
        lateDeduction += Math.ceil(dayLateMins / lateIntervalValue) * lateRate;
      }
    });
  }

  let earlyDeduction = 0;
  if (earlyDeductionType === 'instance') {
    earlyDeduction = earlyInstances * earlyRate;
  } else if (earlyDeductionType === 'minute') {
    earlyDeduction = totalEarlyMinutes * earlyRate;
  } else if (earlyDeductionType === 'hour') {
    earlyDeduction = (totalEarlyMinutes / 60) * earlyRate;
  } else if (earlyDeductionType === 'interval') {
    report.rows.forEach(r => {
      const dayEarlyMins = parseMinutes(r.earlyDeparture);
      if (dayEarlyMins > 0) {
        earlyDeduction += Math.ceil(dayEarlyMins / earlyIntervalValue) * earlyRate;
      }
    });
  }

  // Round deductions to nearest integer to avoid decimal precision issues in display
  lateDeduction = Math.round(lateDeduction);
  earlyDeduction = Math.round(earlyDeduction);
  
  // Absent calculation:
  // C/F (ULD) = B/F (ULD) - Absent + CL = 0 - absentDays + 1
  const balanceForward = 0;
  const cfLeaves = balanceForward - absentDays + eligibleCLs;
  const unexcusedLeaves = cfLeaves < 0 ? Math.abs(cfLeaves) : 0;

  const dailyRate = daysInMonth > 0 ? (baseSalary / daysInMonth) : 0.0;
  const absentDeduction = absentRateSetting > 0 
    ? Math.round(absentRateSetting * unexcusedLeaves)
    : Math.round(dailyRate * unexcusedLeaves);

  // Custom additions and deductions from trainee overrides
  const otherAdditions = trainee.otherAdditions || 0.0;
  const otherDeductions = trainee.otherDeductions || 0.0;

  // TDS calculation: custom rate if present, else default 10%
  const tdsPercentage = trainee.tdsRate !== null && trainee.tdsRate !== undefined ? trainee.tdsRate : 10.0;
  const grossEarnings = baseSalary + trainingFee + otherAdditions;
  const netBeforeTax = Math.max(0, grossEarnings - lateDeduction - earlyDeduction - absentDeduction - otherDeductions);
  const tdsDeduction = Math.round(netBeforeTax * (tdsPercentage / 100.0));

  const totalDeductions = lateDeduction + earlyDeduction + absentDeduction + tdsDeduction + otherDeductions;
  const netTakeHome = Math.max(0, grossEarnings - totalDeductions);

  return {
    professionalFee: baseSalary,
    trainingFee,
    grossEarnings,
    lateInstances,
    totalLateMinutes,
    lateDeduction,
    earlyInstances,
    totalEarlyMinutes,
    earlyDeduction,
    absentDays,
    eligibleCLs,
    cfLeaves,
    unexcusedLeaves,
    absentDeduction,
    tdsDeduction,
    totalDeductions,
    netTakeHome,
    personalLateRate: trainee.lateRate,
    personalEarlyRate: trainee.earlyRate,
    personalAbsentRate: trainee.absentRate,
    panNo: trainee.panNumber || '--',
    aadhaarNo: trainee.aadhaarNumber || '--',
    otherAdditions,
    otherDeductions,
    personalTdsRate: trainee.tdsRate,
    personalLateDeductionType: trainee.lateDeductionType,
    personalEarlyDeductionType: trainee.earlyDeductionType,
    personalLateIntervalValue: trainee.lateIntervalValue,
    personalEarlyIntervalValue: trainee.earlyIntervalValue,
    extraClassesCount,
    extraClassesHours,
    otherCenterClassesCount,
    otherCenterClassesHours,
    approvedLeavesCount,
    tdsPercentage
  };
};

// Helper: Ensure user has either ADMIN role or SUPERVISOR role with MANAGE_SALARY_SLIPS permission
const checkSalarySlipsAccess = async (req: AuthRequest, res: any, next: () => void) => {
  if (req.user!.role === 'ADMIN') {
    return next();
  }
  if (req.user!.role === 'SUPERVISOR') {
    const supervisor = await prisma.user.findUnique({
      where: { id: req.user!.id }
    });
    const perms = supervisor?.permissions?.split(',') || [];
    if (perms.includes('MANAGE_SALARY_SLIPS')) {
      return next();
    }
  }
  return res.status(403).json({ error: 'Access denied: MANAGE_SALARY_SLIPS required' });
};

// 1. Update individual trainee base salary & training fee
router.put('/admin/trainees/:id/salary', authenticateToken, checkSalarySlipsAccess, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const {
      baseSalary,
      trainingFee,
      lateRate,
      earlyRate,
      absentRate,
      tdsRate,
      otherAdditions,
      otherDeductions,
      lateDeductionType,
      earlyDeductionType,
      lateIntervalValue,
      earlyIntervalValue
    } = req.body;
    
    const user = await prisma.user.update({
      where: { id: parseInt(id as string) },
      data: {
        baseSalary: parseFloat(baseSalary) || 0.0,
        trainingFee: parseFloat(trainingFee) || 0.0,
        lateRate: (lateRate !== undefined && lateRate !== "" && lateRate !== null) ? parseFloat(lateRate) : null,
        earlyRate: (earlyRate !== undefined && earlyRate !== "" && earlyRate !== null) ? parseFloat(earlyRate) : null,
        absentRate: (absentRate !== undefined && absentRate !== "" && absentRate !== null) ? parseFloat(absentRate) : null,
        tdsRate: (tdsRate !== undefined && tdsRate !== "" && tdsRate !== null) ? parseFloat(tdsRate) : null,
        otherAdditions: (otherAdditions !== undefined && otherAdditions !== "" && otherAdditions !== null) ? parseFloat(otherAdditions) : 0.0,
        otherDeductions: (otherDeductions !== undefined && otherDeductions !== "" && otherDeductions !== null) ? parseFloat(otherDeductions) : 0.0,
        lateDeductionType: (lateDeductionType !== undefined && lateDeductionType !== "" && lateDeductionType !== null) ? lateDeductionType : null,
        earlyDeductionType: (earlyDeductionType !== undefined && earlyDeductionType !== "" && earlyDeductionType !== null) ? earlyDeductionType : null,
        lateIntervalValue: (lateIntervalValue !== undefined && lateIntervalValue !== "" && lateIntervalValue !== null) ? parseInt(lateIntervalValue) : null,
        earlyIntervalValue: (earlyIntervalValue !== undefined && earlyIntervalValue !== "" && earlyIntervalValue !== null) ? parseInt(earlyIntervalValue) : null
      }
    });

    res.json({ message: 'Salary settings updated successfully', user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Fetch list of trainees with computed salary statistics for a selected month
router.get('/admin/reports/payslip/list', authenticateToken, checkSalarySlipsAccess, async (req: AuthRequest, res) => {
  try {
    const { month } = req.query; // format "YYYY-MM"
    if (!month || typeof month !== 'string') {
      return res.status(400).json({ error: 'Month is required' });
    }

    const [year, mon] = month.split('-').map(Number);
    const startOfMonth = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
    const endOfMonth = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999) - (5.5 * 60 * 60 * 1000));
    const daysInMonth = new Date(year, mon, 0).getDate();

    let traineesFilter: any = { role: 'TRAINEE', hasLeft: false };
    if (req.user!.role === 'SUPERVISOR') {
      traineesFilter.supervisors = { some: { id: req.user!.id } };
    }

    const trainees = await prisma.user.findMany({
      where: traineesFilter,
      include: { slots: true },
      orderBy: { fullName: 'asc' }
    });

    const settings = await prisma.instituteSettings.findUnique({ where: { id: 1 } });
    const result = [];
    for (const t of trainees) {
      const salData = await calculateTraineeSalaryData(t, year, mon, daysInMonth, startOfMonth, endOfMonth, settings);
      result.push({
        id: t.id,
        fullName: t.fullName,
        empCode: t.identifier,
        ...salData
      });
    }

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Export individual trainee's Pay Slip to Excel
router.get('/admin/reports/payslip/export/:userId', authenticateToken, checkSalarySlipsAccess, async (req: AuthRequest, res) => {
  try {
    const userId = parseInt(req.params.userId as string);
    const { month } = req.query; // format "YYYY-MM"
    if (!month || typeof month !== 'string') {
      return res.status(400).json({ error: 'Month is required' });
    }

    const trainee = await prisma.user.findUnique({
      where: { id: userId },
      include: { slots: true }
    });
    if (!trainee) {
      return res.status(404).json({ error: 'Trainee not found' });
    }

    // Verify supervisor ownership
    if (req.user!.role === 'SUPERVISOR') {
      const isAssigned = await prisma.user.findFirst({
        where: {
          id: userId,
          supervisors: { some: { id: req.user!.id } }
        }
      });
      if (!isAssigned) {
        return res.status(403).json({ error: 'Access denied: trainee not assigned to supervisor' });
      }
    }

    const [year, mon] = month.split('-').map(Number);
    const startOfMonth = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
    const endOfMonth = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999) - (5.5 * 60 * 60 * 1000));
    const daysInMonth = new Date(year, mon, 0).getDate();

    const settings = await prisma.instituteSettings.findUnique({ where: { id: 1 } });
    const salData = await calculateTraineeSalaryData(trainee, year, mon, daysInMonth, startOfMonth, endOfMonth, settings);

    const storedSlip = await prisma.salarySlip.findUnique({
      where: {
        userId_month: { userId, month }
      }
    });

    const workbook = new exceljs.Workbook();
    const ws = workbook.addWorksheet('Pay Slip');

    ws.columns = [
      { width: 28 }, // Col A: Earnings label
      { width: 15 }, // Col B: Earnings value
      { width: 30 }, // Col C: Deductions label
      { width: 12 }, // Col D: Deductions instance
      { width: 12 }, // Col E: Deductions remarks
      { width: 15 }  // Col F: Deductions amount
    ];

    // Align grid borders helper
    const applyGridBorders = (startRow: number, endRow: number, startCol: number, endCol: number) => {
      for (let r = startRow; r <= endRow; r++) {
        const row = ws.getRow(r);
        for (let c = startCol; c <= endCol; c++) {
          row.getCell(c).border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        }
      }
    };

    // Header Title Block
    ws.mergeCells('A1:F1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'NICT Computer Education';
    titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: '000080' } }; // navy blue
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    ws.mergeCells('A2:F2');
    const addressCell = ws.getCell('A2');
    addressCell.value = '# 52, "Bhagawathi Towers", 4th Floor, 33rd Cross, Jayanagar 4th Block, Bangalore - 560 011.';
    addressCell.font = { name: 'Calibri', size: 9, bold: false };
    addressCell.alignment = { horizontal: 'center', vertical: 'middle' };

    ws.mergeCells('A3:F3');
    const emailCell = ws.getCell('A3');
    emailCell.value = 'Email: info@nictcomputereducation.com';
    emailCell.font = { name: 'Calibri', size: 9, bold: false, underline: true, color: { argb: '0000FF' } };
    emailCell.alignment = { horizontal: 'center', vertical: 'middle' };

    applyGridBorders(1, 3, 1, 6);

    // Document Title
    ws.mergeCells('A5:F5');
    const docTitle = ws.getCell('A5');
    docTitle.value = 'NICT Pay Slip';
    docTitle.font = { name: 'Calibri', size: 18, bold: true, color: { argb: '800000' } }; // maroon
    docTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    applyGridBorders(5, 5, 1, 6);

    // Month Selector Line
    ws.mergeCells('A6:C6');
    const forMonthLabel = ws.getCell('A6');
    forMonthLabel.value = 'for the month of:';
    forMonthLabel.alignment = { horizontal: 'right', vertical: 'middle' };
    forMonthLabel.font = { bold: true };

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    ws.mergeCells('D6:E6');
    const monthVal = ws.getCell('D6');
    monthVal.value = monthNames[mon - 1];
    monthVal.font = { bold: true, color: { argb: '000000' } };
    monthVal.alignment = { horizontal: 'center', vertical: 'middle' };
    monthVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '00FFFF' } }; // cyan / light blue

    const yearVal = ws.getCell('F6');
    yearVal.value = year;
    yearVal.font = { bold: true };
    yearVal.alignment = { horizontal: 'center', vertical: 'middle' };

    applyGridBorders(6, 6, 1, 6);

    // Professional Name
    ws.mergeCells('A7:B7');
    const nameLabel = ws.getCell('A7');
    nameLabel.value = 'Name of the Professional:';
    nameLabel.alignment = { horizontal: 'right', vertical: 'middle' };

    ws.mergeCells('C7:F7');
    const nameVal = ws.getCell('C7');
    nameVal.value = trainee.fullName;
    nameVal.font = { name: 'Calibri', size: 11, bold: true, color: { argb: '0000FF' } }; // blue
    nameVal.alignment = { horizontal: 'center', vertical: 'middle' };

    applyGridBorders(7, 7, 1, 6);

    // PAN / Aadhaar line
    const panLabel = ws.getCell('A8');
    panLabel.value = 'PAN No:';
    panLabel.alignment = { horizontal: 'right', vertical: 'middle' };

    const panVal = ws.getCell('B8');
    panVal.value = salData.panNo;
    panVal.font = { bold: true };

    ws.mergeCells('C8:D8');
    const aadhLabel = ws.getCell('C8');
    aadhLabel.value = 'Aadhaar No:';
    aadhLabel.alignment = { horizontal: 'right', vertical: 'middle' };

    ws.mergeCells('E8:F8');
    const aadhVal = ws.getCell('E8');
    aadhVal.value = salData.aadhaarNo;
    aadhVal.font = { bold: true };

    applyGridBorders(8, 8, 1, 6);

    // Earnings / Deductions Headers
    ws.mergeCells('A9:B9');
    const earnHeader = ws.getCell('A9');
    earnHeader.value = 'Earnings';
    earnHeader.font = { bold: true, color: { argb: '800000' } }; // maroon
    earnHeader.alignment = { horizontal: 'center' };
    earnHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E0E0E0' } };

    ws.mergeCells('C9:F9');
    const dedHeader = ws.getCell('C9');
    dedHeader.value = 'Deductions';
    dedHeader.font = { bold: true, color: { argb: '800000' } }; // maroon
    dedHeader.alignment = { horizontal: 'center' };
    dedHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E0E0E0' } };

    applyGridBorders(9, 9, 1, 6);

    // Earnings & Deductions Details Rows
    if (storedSlip) {
      // Row 10:
      ws.getCell('A10').value = 'Basic Salary :';
      ws.getCell('B10').value = storedSlip.basicSalary;
      ws.getCell('B10').numFmt = '"₹"#,##0';
      ws.getCell('B10').alignment = { horizontal: 'right' };

      ws.getCell('C10').value = 'Description';
      ws.getCell('C10').font = { bold: true, size: 9 };
      ws.getCell('D10').value = 'Instance';
      ws.getCell('D10').font = { bold: true, size: 9 };
      ws.getCell('D10').alignment = { horizontal: 'center' };
      ws.getCell('E10').value = 'Remarks';
      ws.getCell('E10').font = { bold: true, size: 9 };
      ws.getCell('F10').value = 'Amount';
      ws.getCell('F10').font = { bold: true, size: 9 };
      ws.getCell('F10').alignment = { horizontal: 'right' };
      
      // Row 11:
      ws.getCell('A11').value = 'HRA :';
      ws.getCell('B11').value = storedSlip.hra;
      ws.getCell('B11').numFmt = '"₹"#,##0';
      ws.getCell('B11').alignment = { horizontal: 'right' };

      ws.getCell('C11').value = 'PF (Provident Fund) :';
      ws.getCell('D11').value = 1;
      ws.getCell('D11').alignment = { horizontal: 'center' };
      ws.getCell('E11').value = '--';
      ws.getCell('E11').alignment = { horizontal: 'center' };
      ws.getCell('F11').value = storedSlip.pf;
      ws.getCell('F11').numFmt = '"₹"#,##0';
      ws.getCell('F11').alignment = { horizontal: 'right' };

      // Row 12:
      ws.getCell('A12').value = 'Conveyance :';
      ws.getCell('B12').value = storedSlip.conveyance;
      ws.getCell('B12').numFmt = '"₹"#,##0';
      ws.getCell('B12').alignment = { horizontal: 'right' };

      ws.getCell('C12').value = 'Professional Tax :';
      ws.getCell('D12').value = 1;
      ws.getCell('D12').alignment = { horizontal: 'center' };
      ws.getCell('E12').value = '--';
      ws.getCell('E12').alignment = { horizontal: 'center' };
      ws.getCell('F12').value = storedSlip.professionalTax;
      ws.getCell('F12').numFmt = '"₹"#,##0';
      ws.getCell('F12').alignment = { horizontal: 'right' };

      // Row 13:
      ws.getCell('A13').value = 'Special Allowance :';
      ws.getCell('B13').value = storedSlip.specialAllowance;
      ws.getCell('B13').numFmt = '"₹"#,##0';
      ws.getCell('B13').alignment = { horizontal: 'right' };

      ws.getCell('C13').value = 'ESI :';
      ws.getCell('D13').value = 1;
      ws.getCell('D13').alignment = { horizontal: 'center' };
      ws.getCell('E13').value = '--';
      ws.getCell('E13').alignment = { horizontal: 'center' };
      ws.getCell('F13').value = storedSlip.esi;
      ws.getCell('F13').numFmt = '"₹"#,##0';
      ws.getCell('F13').alignment = { horizontal: 'right' };

      // Row 14:
      ws.getCell('A14').value = 'Other Allowance :';
      ws.getCell('B14').value = storedSlip.otherAllowance;
      ws.getCell('B14').numFmt = '"₹"#,##0';
      ws.getCell('B14').alignment = { horizontal: 'right' };

      ws.getCell('C14').value = 'TDS :';
      ws.getCell('D14').value = 1;
      ws.getCell('D14').alignment = { horizontal: 'center' };
      ws.getCell('E14').value = '--';
      ws.getCell('E14').alignment = { horizontal: 'center' };
      ws.getCell('F14').value = storedSlip.tds;
      ws.getCell('F14').numFmt = '"₹"#,##0';
      ws.getCell('F14').alignment = { horizontal: 'right' };

      // Row 15:
      ws.mergeCells('C15:E15');
      ws.getCell('C15').value = 'Other Deductions :';
      ws.getCell('F15').value = storedSlip.otherDeductions;
      ws.getCell('F15').numFmt = '"₹"#,##0';
      ws.getCell('F15').alignment = { horizontal: 'right' };

      // Row 16:
      ws.mergeCells('C16:E16');
      ws.getCell('C16').value = '--';
      ws.getCell('F16').value = 0;
      ws.getCell('F16').numFmt = '"₹"#,##0';
      ws.getCell('F16').alignment = { horizontal: 'right' };

      applyGridBorders(10, 16, 1, 6);

      // Row 17: Totals
      const totalEarnings = storedSlip.basicSalary + storedSlip.hra + storedSlip.conveyance + storedSlip.specialAllowance + storedSlip.otherAllowance;
      const totalDeductions = storedSlip.pf + storedSlip.professionalTax + storedSlip.esi + storedSlip.tds + storedSlip.otherDeductions;

      ws.getCell('A17').value = 'Total Earnings :';
      ws.getCell('A17').font = { bold: true, color: { argb: '800000' } };
      ws.getCell('B17').value = totalEarnings;
      ws.getCell('B17').font = { bold: true };
      ws.getCell('B17').numFmt = '"₹"#,##0';
      ws.getCell('B17').alignment = { horizontal: 'right' };

      ws.mergeCells('C17:E17');
      ws.getCell('C17').value = 'Total Deductions :';
      ws.getCell('C17').font = { bold: true, color: { argb: '800000' } };
      ws.getCell('F17').value = totalDeductions;
      ws.getCell('F17').font = { bold: true };
      ws.getCell('F17').numFmt = '"₹"#,##0';
      ws.getCell('F17').alignment = { horizontal: 'right' };

      applyGridBorders(17, 17, 1, 6);

      // Row 18: Nett Take Home
      ws.mergeCells('A18:B18');
      const netLabel = ws.getCell('A18');
      netLabel.value = 'Nett Take Home / NEFT done :';
      netLabel.font = { bold: true };
      netLabel.alignment = { horizontal: 'right', vertical: 'middle' };

      ws.mergeCells('C18:F18');
      const netVal = ws.getCell('C18');
      netVal.value = storedSlip.netSalary;
      netVal.font = { name: 'Calibri', size: 12, bold: true, color: { argb: '0000FF' } };
      netVal.numFmt = '"₹"#,##0';
      netVal.alignment = { horizontal: 'center', vertical: 'middle' };
      netVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F0F8FF' } };

      applyGridBorders(18, 18, 1, 6);
    } else {
      // Row 10:
      ws.getCell('A10').value = 'Professional Fee :';
      ws.getCell('B10').value = salData.professionalFee;
      ws.getCell('B10').numFmt = '"₹"#,##0';
      ws.getCell('B10').alignment = { horizontal: 'right' };

      ws.getCell('C10').value = 'Description';
      ws.getCell('C10').font = { bold: true, size: 9 };
      ws.getCell('D10').value = 'Details';
      ws.getCell('D10').font = { bold: true, size: 9 };
      ws.getCell('D10').alignment = { horizontal: 'center' };
      ws.getCell('E10').value = 'Remarks';
      ws.getCell('E10').font = { bold: true, size: 9 };
      ws.getCell('F10').value = 'Amount';
      ws.getCell('F10').font = { bold: true, size: 9 };
      ws.getCell('F10').alignment = { horizontal: 'right' };
      
      // Row 11:
      ws.getCell('A11').value = 'Training at College :';
      ws.getCell('B11').value = salData.trainingFee;
      ws.getCell('B11').numFmt = '"₹"#,##0';
      ws.getCell('B11').alignment = { horizontal: 'right' };

      ws.getCell('C11').value = 'Late Arrivals :';
      ws.getCell('D11').value = `${salData.totalLateMinutes}m (${(salData.totalLateMinutes / 60).toFixed(2)}h)`;
      ws.getCell('D11').alignment = { horizontal: 'center' };
      ws.getCell('E11').value = `${salData.lateInstances} times`;
      ws.getCell('E11').alignment = { horizontal: 'center' };
      ws.getCell('F11').value = salData.lateDeduction;
      ws.getCell('F11').numFmt = '"₹"#,##0';
      ws.getCell('F11').alignment = { horizontal: 'right' };

      // Row 12: Other Additions on Left, Early Depart on Right
      ws.getCell('A12').value = 'Other Additions :';
      ws.getCell('B12').value = salData.otherAdditions;
      ws.getCell('B12').numFmt = '"₹"#,##0';
      ws.getCell('B12').alignment = { horizontal: 'right' };

      ws.getCell('C12').value = 'Early Depart :';
      ws.getCell('D12').value = `${salData.totalEarlyMinutes}m (${(salData.totalEarlyMinutes / 60).toFixed(2)}h)`;
      ws.getCell('D12').alignment = { horizontal: 'center' };
      ws.getCell('E12').value = `${salData.earlyInstances} times`;
      ws.getCell('E12').alignment = { horizontal: 'center' };
      ws.getCell('F12').value = salData.earlyDeduction;
      ws.getCell('F12').numFmt = '"₹"#,##0';
      ws.getCell('F12').alignment = { horizontal: 'right' };

      // Row 13: Extra Classes on Left, Absent/Leave on Right
      ws.getCell('A13').value = 'Extra Classes :';
      ws.getCell('B13').value = `${salData.extraClassesCount} (${salData.extraClassesHours.toFixed(1)}h)`;
      ws.getCell('B13').alignment = { horizontal: 'right' };

      ws.getCell('C13').value = 'Absent/Leave :';
      ws.getCell('D13').value = `abs: ${salData.absentDays} / lvs: ${salData.approvedLeavesCount}`;
      ws.getCell('D13').alignment = { horizontal: 'center' };
      ws.getCell('E13').value = `${salData.unexcusedLeaves} unexcused`;
      ws.getCell('E13').alignment = { horizontal: 'center' };
      ws.getCell('F13').value = salData.absentDeduction;
      ws.getCell('F13').numFmt = '"₹"#,##0';
      ws.getCell('F13').alignment = { horizontal: 'right' };

      // Row 14: Other Center Classes on Left, Hourly on Right
      ws.getCell('A14').value = 'Other Center Classes :';
      ws.getCell('B14').value = `${salData.otherCenterClassesCount} (${salData.otherCenterClassesHours.toFixed(1)}h)`;
      ws.getCell('B14').alignment = { horizontal: 'right' };

      ws.getCell('C14').value = 'Hourly :';
      ws.getCell('D14').value = 0;
      ws.getCell('D14').alignment = { horizontal: 'center' };
      ws.getCell('E14').value = '--';
      ws.getCell('E14').alignment = { horizontal: 'center' };
      ws.getCell('F14').value = 0;
      ws.getCell('F14').numFmt = '"₹"#,##0';
      ws.getCell('F14').alignment = { horizontal: 'right' };

      // Row 15: Other Deductions
      ws.mergeCells('C15:E15');
      ws.getCell('C15').value = 'Other Deductions :';
      ws.getCell('F15').value = salData.otherDeductions;
      ws.getCell('F15').numFmt = '"₹"#,##0';
      ws.getCell('F15').alignment = { horizontal: 'right' };

      // Row 16: Tax Deducted at Source (TDS)
      ws.mergeCells('C16:E16');
      ws.getCell('C16').value = `Tax Deducted at Source (TDS, ${salData.tdsPercentage}%) :`;
      ws.getCell('F16').value = salData.tdsDeduction;
      ws.getCell('F16').numFmt = '"₹"#,##0';
      ws.getCell('F16').alignment = { horizontal: 'right' };

      applyGridBorders(10, 16, 1, 6);

      // Row 17: Totals
      ws.getCell('A17').value = 'Total Earnings :';
      ws.getCell('A17').font = { bold: true, color: { argb: '800000' } };
      ws.getCell('B17').value = salData.grossEarnings;
      ws.getCell('B17').font = { bold: true };
      ws.getCell('B17').numFmt = '"₹"#,##0';
      ws.getCell('B17').alignment = { horizontal: 'right' };

      ws.mergeCells('C17:E17');
      ws.getCell('C17').value = 'Total Deductions :';
      ws.getCell('C17').font = { bold: true, color: { argb: '800000' } };
      ws.getCell('F17').value = salData.totalDeductions;
      ws.getCell('F17').font = { bold: true };
      ws.getCell('F17').numFmt = '"₹"#,##0';
      ws.getCell('F17').alignment = { horizontal: 'right' };

      applyGridBorders(17, 17, 1, 6);

      // Row 18: Nett Take Home
      ws.mergeCells('A18:B18');
      const netLabel = ws.getCell('A18');
      netLabel.value = 'Nett Take Home / NEFT done :';
      netLabel.font = { bold: true };
      netLabel.alignment = { horizontal: 'right', vertical: 'middle' };

      ws.mergeCells('C18:F18');
      const netVal = ws.getCell('C18');
      netVal.value = salData.netTakeHome;
      netVal.font = { name: 'Calibri', size: 12, bold: true, color: { argb: '0000FF' } };
      netVal.numFmt = '"₹"#,##0';
      netVal.alignment = { horizontal: 'center', vertical: 'middle' };
      netVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F0F8FF' } }; // AliceBlue

      applyGridBorders(18, 18, 1, 6);
    }

    // Row 19: Attendance Details Section Header
    ws.mergeCells('A19:F19');
    const attSection = ws.getCell('A19');
    attSection.value = 'Attendance Details';
    attSection.font = { bold: true, color: { argb: 'FFFFFF' } };
    attSection.alignment = { horizontal: 'center', vertical: 'middle' };
    attSection.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '800000' } }; // maroon

    applyGridBorders(19, 19, 1, 6);

    // Row 20: Attendance Headers
    ws.getCell('A20').value = 'B/F (ULD)';
    ws.getCell('A20').font = { size: 9 };
    ws.getCell('A20').alignment = { horizontal: 'center' };
    ws.getCell('B20').value = 'Absent';
    ws.getCell('B20').font = { size: 9 };
    ws.getCell('B20').alignment = { horizontal: 'center' };
    ws.getCell('C20').value = "Eligible CL's";
    ws.getCell('C20').font = { size: 9 };
    ws.getCell('C20').alignment = { horizontal: 'center' };
    ws.getCell('D20').value = 'C/F (ULD)';
    ws.getCell('D20').font = { size: 9 };
    ws.getCell('D20').alignment = { horizontal: 'center' };
    ws.getCell('E20').value = 'Remarks';
    ws.getCell('E20').font = { size: 9 };
    ws.getCell('E20').alignment = { horizontal: 'center' };
    ws.getCell('F20').value = 'Approval Status';
    ws.getCell('F20').font = { size: 9 };
    ws.getCell('F20').alignment = { horizontal: 'center' };

    applyGridBorders(20, 20, 1, 6);

    // Row 21: Attendance Values
    ws.getCell('A21').value = 0;
    ws.getCell('A21').alignment = { horizontal: 'center' };
    ws.getCell('A21').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '00FFFF' } };

    ws.getCell('B21').value = salData.absentDays;
    ws.getCell('B21').alignment = { horizontal: 'center' };
    ws.getCell('B21').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '00FFFF' } };

    ws.getCell('C21').value = salData.eligibleCLs;
    ws.getCell('C21').alignment = { horizontal: 'center' };

    ws.getCell('D21').value = salData.cfLeaves;
    ws.getCell('D21').alignment = { horizontal: 'center' };

    ws.getCell('E21').value = '';

    ws.getCell('F21').value = 'SK & KK Approved';
    ws.getCell('F21').alignment = { horizontal: 'center' };

    applyGridBorders(21, 21, 1, 6);

    // Signatory
    ws.mergeCells('A23:C23');
    const sigName = ws.getCell('A23');
    sigName.value = 'Kushal Pabbi';
    sigName.font = { bold: true };
    sigName.alignment = { horizontal: 'center' };

    ws.mergeCells('A24:C24');
    const sigLabel = ws.getCell('A24');
    sigLabel.value = 'Authorised Signatory';
    sigLabel.font = { size: 9 };
    sigLabel.alignment = { horizontal: 'center' };

    applyGridBorders(23, 24, 1, 3);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=PaySlip_${trainee.fullName.replace(/\s+/g, '_')}_${month}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── NEW: Salary Slips CRUD & Upload Routes ───────────────────────────────────

// Fetch list of database stored salary slips for a month
router.get('/admin/salary-slips', authenticateToken, checkSalarySlipsAccess, async (req: AuthRequest, res) => {
  try {
    const { month } = req.query;
    if (!month || typeof month !== 'string') {
      return res.status(400).json({ error: 'Month is required' });
    }

    let traineesFilter: any = { role: 'TRAINEE', hasLeft: false };
    if (req.user!.role === 'SUPERVISOR') {
      traineesFilter.supervisors = { some: { id: req.user!.id } };
    }

    const slips = await prisma.salarySlip.findMany({
      where: {
        month,
        user: traineesFilter
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            identifier: true,
            email: true
          }
        }
      },
      orderBy: {
        user: {
          fullName: 'asc'
        }
      }
    });

    res.json(slips);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add or update a single salary slip manually
router.post('/admin/salary-slips', authenticateToken, checkSalarySlipsAccess, async (req: AuthRequest, res) => {
  try {
    const {
      userId,
      month,
      basicSalary,
      hra,
      conveyance,
      specialAllowance,
      otherAllowance,
      pf,
      professionalTax,
      esi,
      tds,
      otherDeductions
    } = req.body;

    if (!userId || !month) {
      return res.status(400).json({ error: 'userId and month are required' });
    }

    // Verify supervisor sandbox boundary
    if (req.user!.role === 'SUPERVISOR') {
      const isAssigned = await prisma.user.findFirst({
        where: {
          id: userId,
          supervisors: { some: { id: req.user!.id } }
        }
      });
      if (!isAssigned) {
        return res.status(403).json({ error: 'Access denied: trainee not assigned to supervisor' });
      }
    }

    const basic = parseFloat(basicSalary) || 0.0;
    const hraVal = parseFloat(hra) || 0.0;
    const conv = parseFloat(conveyance) || 0.0;
    const spec = parseFloat(specialAllowance) || 0.0;
    const othAllow = parseFloat(otherAllowance) || 0.0;
    const pfVal = parseFloat(pf) || 0.0;
    const ptVal = parseFloat(professionalTax) || 0.0;
    const esiVal = parseFloat(esi) || 0.0;
    const tdsVal = parseFloat(tds) || 0.0;
    const othDed = parseFloat(otherDeductions) || 0.0;

    const netSalary = (basic + hraVal + conv + spec + othAllow) - (pfVal + ptVal + esiVal + tdsVal + othDed);

    const slip = await prisma.salarySlip.upsert({
      where: {
        userId_month: { userId, month }
      },
      update: {
        basicSalary: basic,
        hra: hraVal,
        conveyance: conv,
        specialAllowance: spec,
        otherAllowance: othAllow,
        pf: pfVal,
        professionalTax: ptVal,
        esi: esiVal,
        tds: tdsVal,
        otherDeductions: othDed,
        netSalary
      },
      create: {
        userId,
        month,
        basicSalary: basic,
        hra: hraVal,
        conveyance: conv,
        specialAllowance: spec,
        otherAllowance: othAllow,
        pf: pfVal,
        professionalTax: ptVal,
        esi: esiVal,
        tds: tdsVal,
        otherDeductions: othDed,
        netSalary
      }
    });

    res.json({ message: 'Salary slip saved successfully', slip });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a salary slip
router.delete('/admin/salary-slips/:id', authenticateToken, checkSalarySlipsAccess, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const slip = await prisma.salarySlip.findUnique({
      where: { id }
    });

    if (!slip) {
      return res.status(404).json({ error: 'Salary slip not found' });
    }

    // Verify supervisor sandbox boundary
    if (req.user!.role === 'SUPERVISOR') {
      const isAssigned = await prisma.user.findFirst({
        where: {
          id: slip.userId,
          supervisors: { some: { id: req.user!.id } }
        }
      });
      if (!isAssigned) {
        return res.status(403).json({ error: 'Access denied: trainee not assigned to supervisor' });
      }
    }

    await prisma.salarySlip.delete({
      where: { id }
    });

    res.json({ message: 'Salary slip deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk upload salary slips via Excel
import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage() });

router.post('/admin/salary-slips/upload', authenticateToken, checkSalarySlipsAccess, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    const { month } = req.body;
    if (!month) {
      return res.status(400).json({ error: 'Month is required' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Excel file is required' });
    }

    const workbook = new exceljs.Workbook();
    await workbook.xlsx.load(req.file.buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      return res.status(400).json({ error: 'Sheet not found in Excel' });
    }

    // Determine header mapping
    let colReg = 1, colBasic = 2, colHra = 3, colConv = 4, colSpecial = 5, colOther = 6, colPf = 7, colPt = 8, colEsi = 9, colTds = 10, colOtherDed = 11;
    const row1 = sheet.getRow(1);
    row1.eachCell((cell, colNumber) => {
      const val = cell.value?.toString().toLowerCase().replace(/[^a-z0-9]/g, '') || '';
      if (val.includes('reg') || val.includes('id') || val.includes('emp')) colReg = colNumber;
      else if (val.includes('basic')) colBasic = colNumber;
      else if (val.includes('hra')) colHra = colNumber;
      else if (val.includes('conveyance') || val.includes('conv')) colConv = colNumber;
      else if (val.includes('special')) colSpecial = colNumber;
      else if (val.includes('otherallowance') || val.includes('otherallow')) colOther = colNumber;
      else if (val.includes('pf') || val.includes('provident')) colPf = colNumber;
      else if (val.includes('prof') || val.includes('tax') || val.includes('pt')) colPt = colNumber;
      else if (val.includes('esi')) colEsi = colNumber;
      else if (val.includes('tds')) colTds = colNumber;
      else if (val.includes('otherdeduction') || val.includes('otherded')) colOtherDed = colNumber;
    });

    let count = 0;
    const rows = sheet.getRows(2, sheet.rowCount - 1) || [];

    for (const row of rows) {
      const regNo = row.getCell(colReg).value?.toString().trim();
      if (!regNo) continue;

      // Find user
      const trainee = await prisma.user.findFirst({
        where: {
          OR: [
            { identifier: regNo },
            { email: regNo }
          ],
          role: 'TRAINEE'
        }
      });

      if (!trainee) continue;

      // Verify supervisor sandbox boundary
      if (req.user!.role === 'SUPERVISOR') {
        const isAssigned = await prisma.user.findFirst({
          where: {
            id: trainee.id,
            supervisors: { some: { id: req.user!.id } }
          }
        });
        if (!isAssigned) continue;
      }

      const basic = parseFloat(row.getCell(colBasic).value?.toString()) || 0.0;
      const hraVal = parseFloat(row.getCell(colHra).value?.toString()) || 0.0;
      const conv = parseFloat(row.getCell(colConv).value?.toString()) || 0.0;
      const spec = parseFloat(row.getCell(colSpecial).value?.toString()) || 0.0;
      const othAllow = parseFloat(row.getCell(colOther).value?.toString()) || 0.0;
      const pfVal = parseFloat(row.getCell(colPf).value?.toString()) || 0.0;
      const ptVal = parseFloat(row.getCell(colPt).value?.toString()) || 0.0;
      const esiVal = parseFloat(row.getCell(colEsi).value?.toString()) || 0.0;
      const tdsVal = parseFloat(row.getCell(colTds).value?.toString()) || 0.0;
      const othDed = parseFloat(row.getCell(colOtherDed).value?.toString()) || 0.0;

      const netSalary = (basic + hraVal + conv + spec + othAllow) - (pfVal + ptVal + esiVal + tdsVal + othDed);

      await prisma.salarySlip.upsert({
        where: {
          userId_month: { userId: trainee.id, month }
        },
        update: {
          basicSalary: basic,
          hra: hraVal,
          conveyance: conv,
          specialAllowance: spec,
          otherAllowance: othAllow,
          pf: pfVal,
          professionalTax: ptVal,
          esi: esiVal,
          tds: tdsVal,
          otherDeductions: othDed,
          netSalary
        },
        create: {
          userId: trainee.id,
          month,
          basicSalary: basic,
          hra: hraVal,
          conveyance: conv,
          specialAllowance: spec,
          otherAllowance: othAllow,
          pf: pfVal,
          professionalTax: ptVal,
          esi: esiVal,
          tds: tdsVal,
          otherDeductions: othDed,
          netSalary
        }
      });
      count++;
    }

    res.json({ message: `Successfully uploaded and processed ${count} salary slips` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk export all salary slips for a month to Excel
router.get('/admin/reports/payslip/export-all', authenticateToken, checkSalarySlipsAccess, async (req: AuthRequest, res) => {
  try {
    const { month } = req.query;
    if (!month || typeof month !== 'string') {
      return res.status(400).json({ error: 'Month is required' });
    }

    let traineesFilter: any = { role: 'TRAINEE', hasLeft: false };
    if (req.user!.role === 'SUPERVISOR') {
      traineesFilter.supervisors = { some: { id: req.user!.id } };
    }

    const trainees = await prisma.user.findMany({
      where: traineesFilter,
      include: { slots: true },
      orderBy: { fullName: 'asc' }
    });

    const [year, mon] = month.split('-').map(Number);
    const startOfMonth = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
    const endOfMonth = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999) - (5.5 * 60 * 60 * 1000));
    const daysInMonth = new Date(year, mon, 0).getDate();

    const workbook = new exceljs.Workbook();
    const ws = workbook.addWorksheet(`Salary Slips ${month}`);

    // Headers updated for our detailed dynamic calculations
    ws.addRow([
      'Sl. No',
      'Employee Name',
      'Registration No',
      'Month',
      'Professional Fee (Basic)',
      'Training Fee',
      'Other Additions',
      'Gross Earnings',
      'Late Arrival Total (Mins)',
      'Late Arrival Total (Hrs)',
      'Late Penalty',
      'Early Checkout Total (Mins)',
      'Early Checkout Total (Hrs)',
      'Early Penalty',
      'Absent Days',
      'Approved Leaves',
      'Unexcused Leaves',
      'Absenteeism Deduction',
      'Extra Classes Conducted (Count)',
      'Extra Classes Hours',
      'Other Center Classes Conducted (Count)',
      'Other Center Classes Hours',
      'Other Deductions',
      'TDS',
      'Total Deductions',
      'Net Salary (Take Home)'
    ]);

    // Style headers
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '0F766E' } // teal-700
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    const settings = await prisma.instituteSettings.findUnique({ where: { id: 1 } });

    for (let idx = 0; idx < trainees.length; idx++) {
      const t = trainees[idx];
      const salData = await calculateTraineeSalaryData(t, year, mon, daysInMonth, startOfMonth, endOfMonth, settings);
      ws.addRow([
        idx + 1,
        t.fullName,
        t.identifier,
        month,
        salData.professionalFee,
        salData.trainingFee,
        salData.otherAdditions,
        salData.grossEarnings,
        salData.totalLateMinutes,
        parseFloat((salData.totalLateMinutes / 60).toFixed(2)),
        salData.lateDeduction,
        salData.totalEarlyMinutes,
        parseFloat((salData.totalEarlyMinutes / 60).toFixed(2)),
        salData.earlyDeduction,
        salData.absentDays,
        salData.approvedLeavesCount,
        salData.unexcusedLeaves,
        salData.absentDeduction,
        salData.extraClassesCount,
        parseFloat(salData.extraClassesHours.toFixed(2)),
        salData.otherCenterClassesCount,
        parseFloat(salData.otherCenterClassesHours.toFixed(2)),
        salData.otherDeductions,
        salData.tdsDeduction,
        salData.totalDeductions,
        salData.netTakeHome
      ]);
    }

    // Formatting numbers
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      // Currency columns
      [5, 6, 7, 8, 11, 14, 18, 23, 24, 25, 26].forEach(c => {
        const cell = row.getCell(c);
        cell.numFmt = '"₹"#,##0';
        cell.alignment = { horizontal: 'right' };
      });
      // Center align columns
      [1, 4, 9, 10, 12, 13, 15, 16, 17, 19, 20, 21, 22].forEach(c => {
        const cell = row.getCell(c);
        cell.alignment = { horizontal: 'center' };
      });
    });

    // Autofit columns
    ws.columns.forEach((col) => {
      let maxLen = 10;
      col.values?.forEach((val) => {
        if (val) {
          const len = val.toString().length;
          if (len > maxLen) maxLen = len;
        }
      });
      col.width = maxLen + 3;
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=SalarySlips_Report_${month}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/salary-slips/my-slip
router.get('/salary-slips/my-slip', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { month } = req.query;
    if (!month || typeof month !== 'string') {
      return res.status(400).json({ error: 'Month is required (format: YYYY-MM)' });
    }

    const userId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { slots: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [year, mon] = month.split('-').map(Number);
    const startOfMonth = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
    const endOfMonth = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999) - (5.5 * 60 * 60 * 1000));
    const daysInMonth = new Date(year, mon, 0).getDate();

    const settings = await prisma.instituteSettings.findUnique({ where: { id: 1 } });

    const salData = await calculateTraineeSalaryData(user, year, mon, daysInMonth, startOfMonth, endOfMonth, settings);

    res.json({
      user: {
        fullName: user.fullName,
        identifier: user.identifier,
        role: user.role,
        email: user.email,
        bankName: user.bankName,
        bankAccountNo: user.bankAccountNo,
        bankIfscCode: user.bankIfscCode,
        bankBranchName: user.bankBranchName,
      },
      month,
      salaryData: salData
    });
  } catch (error) {
    console.error('Error fetching own salary slip:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
