import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import * as exceljs from 'exceljs';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware';
import { getTraineeReportData } from '../utils/excel';

const router = Router();
const prisma = new PrismaClient();

// Helper function to calculate carry-forward casual leaves starting from June 2026
async function calculateCarryForwardLeaves(
  traineeId: number,
  targetYear: number,
  targetMonth: number,
  globalDefaultLimit: number,
  personalPaidLeavesLimit: number
) {
  const startYear = 2026;
  const startMonth = 6; // June

  // If the target month is before June 2026, no carry forward balance is available
  if (targetYear < startYear || (targetYear === startYear && targetMonth < startMonth)) {
    return {
      previousMonthBalance: 0,
      totalAvailable: personalPaidLeavesLimit
    };
  }

  let currentYear = startYear;
  let currentMonth = startMonth;
  let accumulatedBalance = 0; // Carry-forward balance from previous months

  while (
    currentYear < targetYear ||
    (currentYear === targetYear && currentMonth < targetMonth)
  ) {
    const daysInCurrentMonth = new Date(currentYear, currentMonth, 0).getDate();
    const startOfCurrentMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfCurrentMonth = new Date(currentYear, currentMonth - 1, daysInCurrentMonth, 23, 59, 59, 999);

    // Fetch approved leave requests for this month
    const leaves = await prisma.leaveRequest.findMany({
      where: {
        userId: traineeId,
        status: 'APPROVED',
        startDate: { lte: endOfCurrentMonth },
        endDate: { gte: startOfCurrentMonth }
      }
    });

    let approvedLeavesCount = 0;
    for (let dIndex = 1; dIndex <= daysInCurrentMonth; dIndex++) {
      const currentDate = new Date(currentYear, currentMonth - 1, dIndex);
      const leave = leaves.find(l => {
        const dObj = new Date(Date.UTC(currentYear, currentMonth - 1, dIndex, 12, 0, 0));
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

    const currentLimit = personalPaidLeavesLimit;
    const totalAvailable = currentLimit + accumulatedBalance;
    const paidLeavesUsed = Math.min(approvedLeavesCount, totalAvailable);
    accumulatedBalance = totalAvailable - paidLeavesUsed;

    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
  }

  const targetMonthLimit = personalPaidLeavesLimit;
  const totalAvailableForTargetMonth = targetMonthLimit + accumulatedBalance;

  return {
    previousMonthBalance: accumulatedBalance,
    totalAvailable: totalAvailableForTargetMonth
  };
}

// Helper to compute daily working hours based strictly on active slot timings
function calculateDailyHoursFromSlots(slots: any[]): number {
  if (!slots || slots.length === 0) {
    return 0.0; // Return 0 if no slots, meaning no deductions
  }

  const parseTimeToMinutes = (timeStr: string): number => {
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return 0;
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const ampm = match[3].toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  const dayHoursMap: { [day: string]: number } = {};
  slots.forEach(slot => {
    const startMins = parseTimeToMinutes(slot.startTime);
    const endMins = parseTimeToMinutes(slot.endTime);
    let durationMins = endMins - startMins;
    if (durationMins < 0) durationMins += 24 * 60; 
    
    const day = slot.dayOfWeek.toUpperCase();
    dayHoursMap[day] = (dayHoursMap[day] || 0) + (durationMins / 60);
  });

  const days = Object.keys(dayHoursMap);
  if (days.length === 0) return 0.0;

  const totalHours = Object.values(dayHoursMap).reduce((sum, h) => sum + h, 0);
  return totalHours / days.length; // Average scheduled hours per day
}

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

  const collegeVisits = await prisma.breakLog.findMany({
    where: {
      userId: trainee.id,
      status: 'APPROVED',
      collegeName: { not: null },
      date: { gte: startOfMonth, lte: endOfMonth }
    }
  });

  const extraClassesCount = extraClasses.length;
  const extraClassesHours = extraClasses.reduce((sum, item) => sum + (item.duration || 0.0), 0.0);
  const otherCenterClassesCount = otherCenterClasses.length;
  const otherCenterClassesHours = otherCenterClasses.reduce((sum, item) => sum + (item.duration || 0.0), 0.0);
  const collegeVisitHours = collegeVisits.reduce((sum, item) => {
    const hrs = parseFloat(item.numberOfHours || '0');
    return sum + (isNaN(hrs) ? 0 : hrs);
  }, 0.0);

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
  const { totalLateMinutes, totalEarlyMinutes } = report;
  
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

  // Extra class, other center class, and college visit rates
  const extraClassRate = trainee.extraClassRate !== null && trainee.extraClassRate !== undefined ? trainee.extraClassRate : (settings?.extraClassRate !== undefined ? settings.extraClassRate : 0.0);
  const otherCenterClassRate = trainee.otherCenterClassRate !== null && trainee.otherCenterClassRate !== undefined ? trainee.otherCenterClassRate : (settings?.otherCenterClassRate !== undefined ? settings.otherCenterClassRate : 0.0);
  const collegeVisitRate = trainee.collegeVisitRate !== null && trainee.collegeVisitRate !== undefined ? trainee.collegeVisitRate : (settings?.collegeVisitRate !== undefined ? settings.collegeVisitRate : 0.0);

  const extraClassEarnings = Math.round(extraClassesHours * extraClassRate);
  const otherCenterClassEarnings = Math.round(otherCenterClassesHours * otherCenterClassRate);
  const collegeVisitEarnings = Math.round(collegeVisitHours * collegeVisitRate);

  // Fetch trainee slots to calculate daily hours
  const traineeSlots = await prisma.slot.findMany({
    where: { userId: trainee.id }
  });

  // Calculate daily working hours H
  let dailyHours = 0.0;
  if (trainee.workingHoursOverride !== null && trainee.workingHoursOverride !== undefined) {
    dailyHours = trainee.workingHoursOverride;
  } else {
    dailyHours = calculateDailyHoursFromSlots(traineeSlots);
  }

  // Calculate late/early deductions per minute
  let lateDeduction = 0;
  let earlyDeduction = 0;
  if (dailyHours > 0) {
    const perMinuteRate = baseSalary / (daysInMonth * dailyHours * 60);
    lateDeduction = Math.round(totalLateMinutes * perMinuteRate);
    earlyDeduction = Math.round(totalEarlyMinutes * perMinuteRate);
  }

  const eligibleCLs = 1;
  const cfLeaves = 0;
  const unexcusedLeaves = 0;

  const dailyRate = daysInMonth > 0 ? (baseSalary / daysInMonth) : 0.0;
  const absentDeduction = Math.round(absentDays * dailyRate);

  // Paid vs Unpaid Leaves with Carry-Forward
  const paidLeavesLimit = trainee.paidLeavesLimit !== null && trainee.paidLeavesLimit !== undefined ? trainee.paidLeavesLimit : (settings?.paidLeavesLimit !== undefined ? settings.paidLeavesLimit : 0.0);
  
  const carryForwardInfo = await calculateCarryForwardLeaves(
    trainee.id,
    year,
    mon,
    settings?.paidLeavesLimit || 0.0,
    paidLeavesLimit
  );

  const totalAvailablePaidLeaves = carryForwardInfo.totalAvailable;
  const unpaidApprovedLeaves = Math.max(0, approvedLeavesCount - totalAvailablePaidLeaves);
  const unpaidApprovedLeavesDeduction = Math.round(unpaidApprovedLeaves * dailyRate);
  const paidLeavesUsed = Math.min(approvedLeavesCount, totalAvailablePaidLeaves);

  // Conveyance and Food allowances
  const conveyanceAllowance = trainee.conveyanceAllowance || 0.0;
  const foodAllowance = trainee.foodAllowance || 0.0;

  // Custom additions and deductions from trainee overrides
  const otherAdditions = trainee.otherAdditions || 0.0;
  const otherDeductions = trainee.otherDeductions || 0.0;

  // TDS calculation: TDS taxable income excludes Conveyance and Food
  const tdsPercentage = trainee.tdsRate !== null && trainee.tdsRate !== undefined ? trainee.tdsRate : 10.0;
  const tdsTaxableIncome = baseSalary + collegeVisitEarnings + otherAdditions + extraClassEarnings + otherCenterClassEarnings;
  const tdsDeduction = Math.round(tdsTaxableIncome * (tdsPercentage / 100.0));

  const grossEarnings = tdsTaxableIncome + conveyanceAllowance + foodAllowance;
  const totalDeductions = lateDeduction + earlyDeduction + absentDeduction + unpaidApprovedLeavesDeduction + tdsDeduction + otherDeductions;
  const netTakeHome = Math.max(0, grossEarnings - totalDeductions);

  // Group Other Center Classes by institute (centerName)
  const centerBreakdown: { [key: string]: number } = {};
  otherCenterClasses.forEach(item => {
    const name = item.centerName || 'Unknown';
    centerBreakdown[name] = (centerBreakdown[name] || 0) + (item.duration || 0.0);
  });
  const centerBreakdownStr = Object.entries(centerBreakdown)
    .map(([name, hrs]) => `${name}: ${hrs.toFixed(1)}h`)
    .join(', ');

  return {
    professionalFee: baseSalary,
    basicSalary: baseSalary,
    trainingFee: collegeVisitEarnings, // Set trainingFee to collegeVisitEarnings for backward compatibility
    collegeVisitHours,
    collegeVisitRate,
    collegeVisitEarnings,
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
    paidLeavesLimit: totalAvailablePaidLeaves, // Return carry-forward total available limit
    unpaidApprovedLeaves,
    unpaidApprovedLeavesDeduction,
    tdsDeduction,
    totalDeductions,
    netTakeHome,
    personalLateRate: trainee.lateRate,
    personalEarlyRate: trainee.earlyRate,
    personalAbsentRate: trainee.absentRate,
    personalPaidLeavesLimit: trainee.paidLeavesLimit,
    panNo: trainee.panNumber || '--',
    aadhaarNo: trainee.aadhaarNumber || '--',
    otherAdditions,
    additions: otherAdditions,
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
    tdsPercentage,
    extraClassRate,
    otherCenterClassRate,
    extraClassEarnings,
    otherCenterClassEarnings,
    personalExtraClassRate: trainee.extraClassRate,
    personalOtherCenterClassRate: trainee.otherCenterClassRate,
    personalCollegeVisitRate: trainee.collegeVisitRate,
    // New fields
    conveyance: conveyanceAllowance,
    food: foodAllowance,
    workingHours: dailyHours,
    carryForwardBalance: carryForwardInfo.previousMonthBalance,
    paidLeavesUsed,
    otherCenterClassesBreakdown: centerBreakdownStr,
    personalWorkingHoursOverride: trainee.workingHoursOverride,
    personalConveyanceAllowance: trainee.conveyanceAllowance,
    personalFoodAllowance: trainee.foodAllowance,
    personalAllowPayslipView: trainee.allowPayslipView
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
      paidLeavesLimit,
      extraClassRate,
      otherCenterClassRate,
      collegeVisitRate,
      tdsRate,
      otherAdditions,
      otherDeductions,
      lateDeductionType,
      earlyDeductionType,
      lateIntervalValue,
      earlyIntervalValue,
      conveyanceAllowance,
      foodAllowance,
      workingHoursOverride,
      allowPayslipView
    } = req.body;
    
    const user = await prisma.user.update({
      where: { id: parseInt(id as string) },
      data: {
        baseSalary: parseFloat(baseSalary) || 0.0,
        trainingFee: parseFloat(trainingFee) || 0.0,
        lateRate: (lateRate !== undefined && lateRate !== "" && lateRate !== null) ? parseFloat(lateRate) : null,
        earlyRate: (earlyRate !== undefined && earlyRate !== "" && earlyRate !== null) ? parseFloat(earlyRate) : null,
        absentRate: (absentRate !== undefined && absentRate !== "" && absentRate !== null) ? parseFloat(absentRate) : null,
        paidLeavesLimit: (paidLeavesLimit !== undefined && paidLeavesLimit !== "" && paidLeavesLimit !== null) ? parseFloat(paidLeavesLimit) : null,
        extraClassRate: (extraClassRate !== undefined && extraClassRate !== "" && extraClassRate !== null) ? parseFloat(extraClassRate) : null,
        otherCenterClassRate: (otherCenterClassRate !== undefined && otherCenterClassRate !== "" && otherCenterClassRate !== null) ? parseFloat(otherCenterClassRate) : null,
        collegeVisitRate: (collegeVisitRate !== undefined && collegeVisitRate !== "" && collegeVisitRate !== null) ? parseFloat(collegeVisitRate) : null,
        tdsRate: (tdsRate !== undefined && tdsRate !== "" && tdsRate !== null) ? parseFloat(tdsRate) : null,
        otherAdditions: (otherAdditions !== undefined && otherAdditions !== "" && otherAdditions !== null) ? parseFloat(otherAdditions) : 0.0,
        otherDeductions: (otherDeductions !== undefined && otherDeductions !== "" && otherDeductions !== null) ? parseFloat(otherDeductions) : 0.0,
        lateDeductionType: (lateDeductionType !== undefined && lateDeductionType !== "" && lateDeductionType !== null) ? lateDeductionType : null,
        earlyDeductionType: (earlyDeductionType !== undefined && earlyDeductionType !== "" && earlyDeductionType !== null) ? earlyDeductionType : null,
        lateIntervalValue: (lateIntervalValue !== undefined && lateIntervalValue !== "" && lateIntervalValue !== null) ? parseInt(lateIntervalValue) : null,
        earlyIntervalValue: (earlyIntervalValue !== undefined && earlyIntervalValue !== "" && earlyIntervalValue !== null) ? parseInt(earlyIntervalValue) : null,
        conveyanceAllowance: conveyanceAllowance !== undefined ? parseFloat(conveyanceAllowance) || 0.0 : undefined,
        foodAllowance: foodAllowance !== undefined ? parseFloat(foodAllowance) || 0.0 : undefined,
        workingHoursOverride: workingHoursOverride !== undefined && workingHoursOverride !== "" && workingHoursOverride !== null ? parseFloat(workingHoursOverride) : null,
        allowPayslipView: allowPayslipView !== undefined ? Boolean(allowPayslipView) : undefined
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

    // Fetch stored slips for these trainees in bulk
    const slips = await prisma.salarySlip.findMany({
      where: {
        month,
        userId: { in: trainees.map(t => t.id) }
      }
    });
    const slipsMap = new Map(slips.map(s => [s.userId, s]));

    const settings = await prisma.instituteSettings.findUnique({ where: { id: 1 } });
    const result = [];
    for (const t of trainees) {
      const salData = await calculateTraineeSalaryData(t, year, mon, daysInMonth, startOfMonth, endOfMonth, settings);
      const storedSlip = slipsMap.get(t.id) || null;

      if (storedSlip) {
        result.push({
          id: t.id,
          fullName: t.fullName,
          empCode: t.identifier,
          ...salData,
          storedSlip,
          basicSalary: storedSlip.basicSalary,
          professionalFee: storedSlip.basicSalary,
          conveyance: storedSlip.conveyance,
          food: storedSlip.food,
          otherAdditions: storedSlip.otherAllowance,
          additions: storedSlip.otherAllowance,
          tdsDeduction: storedSlip.tds,
          otherDeductions: storedSlip.otherDeductions,
          netTakeHome: storedSlip.netSalary,
          totalDeductions: storedSlip.pf + storedSlip.professionalTax + storedSlip.esi + storedSlip.tds + storedSlip.otherDeductions,
          grossEarnings: storedSlip.basicSalary + storedSlip.hra + storedSlip.conveyance + storedSlip.specialAllowance + storedSlip.otherAllowance + storedSlip.food
        });
      } else {
        result.push({
          id: t.id,
          fullName: t.fullName,
          empCode: t.identifier,
          ...salData,
          storedSlip: null
        });
      }
    }

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch single trainee's computed salary data for print/PDF
router.get('/admin/reports/payslip/single/:userId', authenticateToken, checkSalarySlipsAccess, async (req: AuthRequest, res) => {
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

    res.json({
      id: trainee.id,
      fullName: trainee.fullName,
      empCode: trainee.identifier,
      user: {
        fullName: trainee.fullName,
        identifier: trainee.identifier,
        role: trainee.role,
        email: trainee.email,
        bankName: trainee.bankName,
        bankAccountNo: trainee.bankAccountNo,
        bankIfscCode: trainee.bankIfscCode,
        bankBranchName: trainee.bankBranchName,
      },
      ...salData,
      salaryData: salData,
      storedSlip
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to generate an individual trainee's pay slip worksheet in the standard NICT layout
export function generateIndividualPayslipSheet(
  ws: exceljs.Worksheet,
  trainee: any,
  salData: any,
  storedSlip: any,
  month: string,
  year: number,
  mon: number
) {
  ws.columns = [
    { width: 45 }, // Col A: Earnings label
    { width: 15 }, // Col B: Earnings value
    { width: 38 }, // Col C: Deductions label
    { width: 22 }, // Col D: Deductions instance
    { width: 18 }, // Col E: Deductions remarks
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
  addressCell.value = '';
  ws.getRow(2).height = 0;

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

  let curRow = 10;

  // Earnings & Deductions Details Rows
  if (storedSlip) {
    // Row curRow:
    ws.getCell(`A${curRow}`).value = 'Basic Salary / Professional Fee :';
    ws.getCell(`B${curRow}`).value = storedSlip.basicSalary;
    ws.getCell(`B${curRow}`).numFmt = '"₹"#,##0';
    ws.getCell(`B${curRow}`).alignment = { horizontal: 'right' };

    ws.getCell(`C${curRow}`).value = 'Description';
    ws.getCell(`C${curRow}`).font = { bold: true, size: 9 };
    ws.getCell(`D${curRow}`).value = 'Instance';
    ws.getCell(`D${curRow}`).font = { bold: true, size: 9 };
    ws.getCell(`D${curRow}`).alignment = { horizontal: 'center' };
    ws.getCell(`E${curRow}`).value = 'Remarks';
    ws.getCell(`E${curRow}`).font = { bold: true, size: 9 };
    ws.getCell(`F${curRow}`).value = 'Amount';
    ws.getCell(`F${curRow}`).font = { bold: true, size: 9 };
    ws.getCell(`F${curRow}`).alignment = { horizontal: 'right' };
    
    curRow++;

    // Row curRow: Conveyance Allowance & TDS
    ws.getCell(`A${curRow}`).value = 'Conveyance Allowance :';
    ws.getCell(`B${curRow}`).value = storedSlip.conveyance;
    ws.getCell(`B${curRow}`).numFmt = '"₹"#,##0';
    ws.getCell(`B${curRow}`).alignment = { horizontal: 'right' };

    ws.getCell(`C${curRow}`).value = 'TDS :';
    ws.getCell(`D${curRow}`).value = 1;
    ws.getCell(`D${curRow}`).alignment = { horizontal: 'center' };
    ws.getCell(`E${curRow}`).value = '--';
    ws.getCell(`E${curRow}`).alignment = { horizontal: 'center' };
    ws.getCell(`F${curRow}`).value = storedSlip.tds;
    ws.getCell(`F${curRow}`).numFmt = '"₹"#,##0';
    ws.getCell(`F${curRow}`).alignment = { horizontal: 'right' };

    curRow++;

    // Row curRow: Food Allowance & Other Deductions
    ws.getCell(`A${curRow}`).value = 'Food Allowance :';
    ws.getCell(`B${curRow}`).value = storedSlip.food || 0.0;
    ws.getCell(`B${curRow}`).numFmt = '"₹"#,##0';
    ws.getCell(`B${curRow}`).alignment = { horizontal: 'right' };

    ws.getCell(`C${curRow}`).value = 'Other Deductions :';
    ws.getCell(`D${curRow}`).value = 1;
    ws.getCell(`D${curRow}`).alignment = { horizontal: 'center' };
    ws.getCell(`E${curRow}`).value = '--';
    ws.getCell(`E${curRow}`).alignment = { horizontal: 'center' };
    ws.getCell(`F${curRow}`).value = storedSlip.otherDeductions;
    ws.getCell(`F${curRow}`).numFmt = '"₹"#,##0';
    ws.getCell(`F${curRow}`).alignment = { horizontal: 'right' };

    curRow++;

    // Row curRow: Additions / Other Allowance & Spacer row
    ws.getCell(`A${curRow}`).value = 'Additions / Other Allowance :';
    ws.getCell(`B${curRow}`).value = storedSlip.otherAllowance;
    ws.getCell(`B${curRow}`).numFmt = '"₹"#,##0';
    ws.getCell(`B${curRow}`).alignment = { horizontal: 'right' };

    ws.getCell(`C${curRow}`).value = '--';
    ws.getCell(`D${curRow}`).value = '';
    ws.getCell(`E${curRow}`).value = '';
    ws.getCell(`F${curRow}`).value = 0;
    ws.getCell(`F${curRow}`).numFmt = '"₹"#,##0';
    ws.getCell(`F${curRow}`).alignment = { horizontal: 'right' };

    applyGridBorders(10, curRow, 1, 6);
    curRow++;

    // Row curRow: Totals
    const totalEarnings = storedSlip.basicSalary + storedSlip.conveyance + storedSlip.otherAllowance + (storedSlip.food || 0.0);
    const totalDeductions = storedSlip.tds + storedSlip.otherDeductions;

    ws.getCell(`A${curRow}`).value = 'Total Earnings :';
    ws.getCell(`A${curRow}`).font = { bold: true, color: { argb: '800000' } };
    ws.getCell(`B${curRow}`).value = totalEarnings;
    ws.getCell(`B${curRow}`).font = { bold: true };
    ws.getCell(`B${curRow}`).numFmt = '"₹"#,##0';
    ws.getCell(`B${curRow}`).alignment = { horizontal: 'right' };

    ws.mergeCells(`C${curRow}:E${curRow}`);
    ws.getCell(`C${curRow}`).value = 'Total Deductions :';
    ws.getCell(`C${curRow}`).font = { bold: true, color: { argb: '800000' } };
    ws.getCell(`F${curRow}`).value = totalDeductions;
    ws.getCell(`F${curRow}`).font = { bold: true };
    ws.getCell(`F${curRow}`).numFmt = '"₹"#,##0';
    ws.getCell(`F${curRow}`).alignment = { horizontal: 'right' };

    applyGridBorders(curRow, curRow, 1, 6);
    curRow++;

    // Row curRow: Nett Take Home
    ws.mergeCells(`A${curRow}:B${curRow}`);
    const netLabel = ws.getCell(`A${curRow}`);
    netLabel.value = 'Nett Take Home / NEFT done :';
    netLabel.font = { bold: true };
    netLabel.alignment = { horizontal: 'right', vertical: 'middle' };

    ws.mergeCells(`C${curRow}:F${curRow}`);
    const netVal = ws.getCell(`C${curRow}`);
    netVal.value = storedSlip.netSalary;
    netVal.font = { name: 'Calibri', size: 12, bold: true, color: { argb: '0000FF' } };
    netVal.numFmt = '"₹"#,##0';
    netVal.alignment = { horizontal: 'center', vertical: 'middle' };
    netVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F0F8FF' } };

    applyGridBorders(curRow, curRow, 1, 6);
  } else {
    // Row 10:
    ws.getCell(`A${curRow}`).value = 'Professional Fee (Basic) :';
    ws.getCell(`B${curRow}`).value = salData.professionalFee;
    ws.getCell(`B${curRow}`).numFmt = '"₹"#,##0';
    ws.getCell(`B${curRow}`).alignment = { horizontal: 'right' };

    ws.getCell(`C${curRow}`).value = 'Description';
    ws.getCell(`C${curRow}`).font = { bold: true, size: 9 };
    ws.getCell(`D${curRow}`).value = 'Details';
    ws.getCell(`D${curRow}`).font = { bold: true, size: 9 };
    ws.getCell(`D${curRow}`).alignment = { horizontal: 'center' };
    ws.getCell(`E${curRow}`).value = 'Remarks';
    ws.getCell(`E${curRow}`).font = { bold: true, size: 9 };
    ws.getCell(`F${curRow}`).value = 'Amount';
    ws.getCell(`F${curRow}`).font = { bold: true, size: 9 };
    ws.getCell(`F${curRow}`).alignment = { horizontal: 'right' };
    
    curRow++;

    // Row 11:
    ws.getCell(`A${curRow}`).value = `College Visits (${salData.collegeVisitHours.toFixed(2)}h) :`;
    ws.getCell(`B${curRow}`).value = { formula: `=${salData.collegeVisitHours}*${salData.collegeVisitRate}`, result: salData.collegeVisitEarnings };
    ws.getCell(`B${curRow}`).numFmt = '"₹"#,##0';
    ws.getCell(`B${curRow}`).alignment = { horizontal: 'right' };

    ws.getCell(`C${curRow}`).value = 'Late Arrivals :';
    ws.getCell(`D${curRow}`).value = `${salData.totalLateMinutes}m (${(salData.totalLateMinutes / 60).toFixed(2)}h)`;
    ws.getCell(`D${curRow}`).alignment = { horizontal: 'center' };
    ws.getCell(`E${curRow}`).value = `${salData.lateInstances} times`;
    ws.getCell(`E${curRow}`).alignment = { horizontal: 'center' };
    ws.getCell(`F${curRow}`).value = salData.lateDeduction;
    ws.getCell(`F${curRow}`).numFmt = '"₹"#,##0';
    ws.getCell(`F${curRow}`).alignment = { horizontal: 'right' };

    curRow++;

    // Row 12: Other Additions on Left, Early Depart on Right
    ws.getCell(`A${curRow}`).value = 'Other Additions :';
    ws.getCell(`B${curRow}`).value = salData.otherAdditions;
    ws.getCell(`B${curRow}`).numFmt = '"₹"#,##0';
    ws.getCell(`B${curRow}`).alignment = { horizontal: 'right' };

    ws.getCell(`C${curRow}`).value = 'Early Depart :';
    ws.getCell(`D${curRow}`).value = `${salData.totalEarlyMinutes}m (${(salData.totalEarlyMinutes / 60).toFixed(2)}h)`;
    ws.getCell(`D${curRow}`).alignment = { horizontal: 'center' };
    ws.getCell(`E${curRow}`).value = `${salData.earlyInstances} times`;
    ws.getCell(`E${curRow}`).alignment = { horizontal: 'center' };
    ws.getCell(`F${curRow}`).value = salData.earlyDeduction;
    ws.getCell(`F${curRow}`).numFmt = '"₹"#,##0';
    ws.getCell(`F${curRow}`).alignment = { horizontal: 'right' };

    curRow++;

    // Row 13: Extra Classes on Left, Absence Deduction on Right
    ws.getCell(`A${curRow}`).value = `Extra Classes (${salData.extraClassesHours.toFixed(2)}h) :`;
    ws.getCell(`B${curRow}`).value = { formula: `=${salData.extraClassesHours}*${salData.extraClassRate}`, result: salData.extraClassEarnings };
    ws.getCell(`B${curRow}`).numFmt = '"₹"#,##0';
    ws.getCell(`B${curRow}`).alignment = { horizontal: 'right' };

    ws.getCell(`C${curRow}`).value = 'Absence Deduction :';
    ws.getCell(`D${curRow}`).value = `${salData.absentDays} days`;
    ws.getCell(`D${curRow}`).alignment = { horizontal: 'center' };
    ws.getCell(`E${curRow}`).value = 'Absent';
    ws.getCell(`E${curRow}`).alignment = { horizontal: 'center' };
    ws.getCell(`F${curRow}`).value = salData.absentDeduction;
    ws.getCell(`F${curRow}`).numFmt = '"₹"#,##0';
    ws.getCell(`F${curRow}`).alignment = { horizontal: 'right' };

    curRow++;

    // Row 14: Other Center Classes on Left, Unpaid Approved Leaves on Right
    ws.getCell(`A${curRow}`).value = salData.otherCenterClassesBreakdown ? `Other Center Classes (${salData.otherCenterClassesBreakdown}) :` : 'Other Center Classes :';
    ws.getCell(`B${curRow}`).value = { formula: `=${salData.otherCenterClassesHours}*${salData.otherCenterClassRate}`, result: salData.otherCenterClassEarnings };
    ws.getCell(`B${curRow}`).numFmt = '"₹"#,##0';
    ws.getCell(`B${curRow}`).alignment = { horizontal: 'right' };

    ws.getCell(`C${curRow}`).value = 'Unpaid Approved Leaves :';
    ws.getCell(`D${curRow}`).value = `${salData.unpaidApprovedLeaves} days`;
    ws.getCell(`D${curRow}`).alignment = { horizontal: 'center' };
    ws.getCell(`E${curRow}`).value = 'Unpaid';
    ws.getCell(`E${curRow}`).alignment = { horizontal: 'center' };
    ws.getCell(`F${curRow}`).value = salData.unpaidApprovedLeavesDeduction;
    ws.getCell(`F${curRow}`).numFmt = '"₹"#,##0';
    ws.getCell(`F${curRow}`).alignment = { horizontal: 'right' };

    curRow++;

    // Row 15: Conveyance Allowance on Left, Approved Leaves on Right
    ws.getCell(`A${curRow}`).value = 'Conveyance Allowance :';
    ws.getCell(`B${curRow}`).value = salData.conveyance;
    ws.getCell(`B${curRow}`).numFmt = '"₹"#,##0';
    ws.getCell(`B${curRow}`).alignment = { horizontal: 'right' };

    ws.getCell(`C${curRow}`).value = 'Approved Leaves :';
    ws.getCell(`D${curRow}`).value = `${salData.approvedLeavesCount} days`;
    ws.getCell(`D${curRow}`).alignment = { horizontal: 'center' };
    ws.getCell(`E${curRow}`).value = 'Leaves Taken';
    ws.getCell(`E${curRow}`).alignment = { horizontal: 'center' };
    ws.getCell(`F${curRow}`).value = '';
    ws.getCell(`F${curRow}`).alignment = { horizontal: 'right' };

    curRow++;

    // Row 16: Food Allowance on Left, Paid Leaves on Right
    ws.getCell(`A${curRow}`).value = 'Food Allowance :';
    ws.getCell(`B${curRow}`).value = salData.food;
    ws.getCell(`B${curRow}`).numFmt = '"₹"#,##0';
    ws.getCell(`B${curRow}`).alignment = { horizontal: 'right' };

    ws.getCell(`C${curRow}`).value = 'Paid Leaves :';
    ws.getCell(`D${curRow}`).value = `${salData.paidLeavesLimit} days`;
    ws.getCell(`D${curRow}`).alignment = { horizontal: 'center' };
    ws.getCell(`E${curRow}`).value = 'Paid';
    ws.getCell(`E${curRow}`).alignment = { horizontal: 'center' };
    ws.getCell(`F${curRow}`).value = '';
    ws.getCell(`F${curRow}`).alignment = { horizontal: 'right' };

    curRow++;

    // Row 17: Other Deductions
    ws.mergeCells(`C${curRow}:E${curRow}`);
    ws.getCell(`C${curRow}`).value = 'Other Deductions :';
    ws.getCell(`F${curRow}`).value = salData.otherDeductions;
    ws.getCell(`F${curRow}`).numFmt = '"₹"#,##0';
    ws.getCell(`F${curRow}`).alignment = { horizontal: 'right' };

    curRow++;

    // Row 18: Tax Deducted at Source (TDS)
    ws.mergeCells(`C${curRow}:E${curRow}`);
    ws.getCell(`C${curRow}`).value = `Tax Deducted at Source (TDS, ${salData.tdsPercentage}%) :`;
    ws.getCell(`F${curRow}`).value = { formula: `=ROUND(SUM(B10:B14)*${salData.tdsPercentage}/100,0)`, result: salData.tdsDeduction };
    ws.getCell(`F${curRow}`).numFmt = '"₹"#,##0';
    ws.getCell(`F${curRow}`).alignment = { horizontal: 'right' };

    applyGridBorders(10, curRow, 1, 6);
    curRow++;

    // Row 19: Totals
    ws.getCell(`A${curRow}`).value = 'Total Earnings :';
    ws.getCell(`A${curRow}`).font = { bold: true, color: { argb: '800000' } };
    ws.getCell(`B${curRow}`).value = { formula: '=SUM(B10:B16)', result: salData.grossEarnings };
    ws.getCell(`B${curRow}`).font = { bold: true };
    ws.getCell(`B${curRow}`).numFmt = '"₹"#,##0';
    ws.getCell(`B${curRow}`).alignment = { horizontal: 'right' };

    ws.mergeCells(`C${curRow}:E${curRow}`);
    ws.getCell(`C${curRow}`).value = 'Total Deductions :';
    ws.getCell(`C${curRow}`).font = { bold: true, color: { argb: '800000' } };
    ws.getCell(`F${curRow}`).value = { formula: '=SUM(F11:F18)', result: salData.totalDeductions };
    ws.getCell(`F${curRow}`).font = { bold: true };
    ws.getCell(`F${curRow}`).numFmt = '"₹"#,##0';
    ws.getCell(`F${curRow}`).alignment = { horizontal: 'right' };

    applyGridBorders(curRow, curRow, 1, 6);
    curRow++;

    // Row 20: Nett Take Home
    ws.mergeCells(`A${curRow}:B${curRow}`);
    const netLabel = ws.getCell(`A${curRow}`);
    netLabel.value = 'Nett Take Home / NEFT done :';
    netLabel.font = { bold: true };
    netLabel.alignment = { horizontal: 'right', vertical: 'middle' };

    ws.mergeCells(`C${curRow}:F${curRow}`);
    const netVal = ws.getCell(`C${curRow}`);
    netVal.value = { formula: '=B19-F19', result: salData.netTakeHome };
    netVal.font = { name: 'Calibri', size: 12, bold: true, color: { argb: '0000FF' } };
    netVal.numFmt = '"₹"#,##0';
    netVal.alignment = { horizontal: 'center', vertical: 'middle' };
    netVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F0F8FF' } }; // AliceBlue

    applyGridBorders(curRow, curRow, 1, 6);
  }

  // Row curRow + 1: Attendance Details Section Header
  curRow++;
  const attSectionRow = curRow;
  ws.mergeCells(`A${attSectionRow}:F${attSectionRow}`);
  const attSection = ws.getCell(`A${attSectionRow}`);
  attSection.value = 'Attendance Details';
  attSection.font = { bold: true, color: { argb: 'FFFFFF' } };
  attSection.alignment = { horizontal: 'center', vertical: 'middle' };
  attSection.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '800000' } }; // maroon

  applyGridBorders(attSectionRow, attSectionRow, 1, 6);

  // Row curRow + 2: Attendance Headers
  curRow++;
  const attHeaderRow = curRow;
  ws.getCell(`A${attHeaderRow}`).value = 'Leaves Taken';
  ws.getCell(`A${attHeaderRow}`).font = { size: 9 };
  ws.getCell(`A${attHeaderRow}`).alignment = { horizontal: 'center' };
  ws.getCell(`B${attHeaderRow}`).value = 'Paid Leaves';
  ws.getCell(`B${attHeaderRow}`).font = { size: 9 };
  ws.getCell(`B${attHeaderRow}`).alignment = { horizontal: 'center' };
  ws.getCell(`C${attHeaderRow}`).value = 'Unpaid Approved Leaves';
  ws.getCell(`C${attHeaderRow}`).font = { size: 9 };
  ws.getCell(`C${attHeaderRow}`).alignment = { horizontal: 'center' };
  ws.getCell(`D${attHeaderRow}`).value = 'Absent Days';
  ws.getCell(`D${attHeaderRow}`).font = { size: 9 };
  ws.getCell(`D${attHeaderRow}`).alignment = { horizontal: 'center' };
  ws.mergeCells(`E${attHeaderRow}:F${attHeaderRow}`);
  ws.getCell(`E${attHeaderRow}`).value = 'Approval Status';
  ws.getCell(`E${attHeaderRow}`).font = { size: 9 };
  ws.getCell(`E${attHeaderRow}`).alignment = { horizontal: 'center' };

  applyGridBorders(attHeaderRow, attHeaderRow, 1, 6);

  // Row curRow + 3: Attendance Values
  curRow++;
  const attValRow = curRow;
  ws.getCell(`A${attValRow}`).value = storedSlip ? '--' : salData.approvedLeavesCount;
  ws.getCell(`A${attValRow}`).alignment = { horizontal: 'center' };
  ws.getCell(`A${attValRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '00FFFF' } };

  ws.getCell(`B${attValRow}`).value = storedSlip ? '--' : salData.paidLeavesLimit;
  ws.getCell(`B${attValRow}`).alignment = { horizontal: 'center' };
  ws.getCell(`B${attValRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '00FFFF' } };

  ws.getCell(`C${attValRow}`).value = storedSlip ? '--' : salData.unpaidApprovedLeaves;
  ws.getCell(`C${attValRow}`).alignment = { horizontal: 'center' };
  ws.getCell(`C${attValRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '00FFFF' } };

  ws.getCell(`D${attValRow}`).value = storedSlip ? '--' : salData.absentDays;
  ws.getCell(`D${attValRow}`).alignment = { horizontal: 'center' };
  ws.getCell(`D${attValRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '00FFFF' } };

  ws.mergeCells(`E${attValRow}:F${attValRow}`);
  ws.getCell(`E${attValRow}`).value = 'SK & KK Approved';
  ws.getCell(`E${attValRow}`).alignment = { horizontal: 'center' };

  applyGridBorders(attValRow, attValRow, 1, 6);

  // Signatory
  curRow += 2;
  const sigRow1 = curRow;
  ws.mergeCells(`A${sigRow1}:C${sigRow1}`);
  const sigName = ws.getCell(`A${sigRow1}`);
  sigName.value = 'Kushal Pabbi';
  sigName.font = { bold: true };
  sigName.alignment = { horizontal: 'center' };

  curRow++;
  const sigRow2 = curRow;
  ws.mergeCells(`A${sigRow2}:C${sigRow2}`);
  const sigLabel = ws.getCell(`A${sigRow2}`);
  sigLabel.value = 'Authorised Signatory';
  sigLabel.font = { size: 9 };
  sigLabel.alignment = { horizontal: 'center' };

  applyGridBorders(sigRow1, sigRow2, 1, 3);
}

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
    const sanitizedSheetName = trainee.fullName.replace(/[\\/?:*\[\]]/g, '').substring(0, 31) || 'Pay Slip';
    const ws = workbook.addWorksheet(sanitizedSheetName);

    generateIndividualPayslipSheet(ws, trainee, salData, storedSlip, month, year, mon);

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
      otherDeductions,
      food
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
    const foodVal = parseFloat(food) || 0.0;
    const spec = parseFloat(specialAllowance) || 0.0;
    const othAllow = parseFloat(otherAllowance) || 0.0;
    const pfVal = parseFloat(pf) || 0.0;
    const ptVal = parseFloat(professionalTax) || 0.0;
    const esiVal = parseFloat(esi) || 0.0;
    const tdsVal = parseFloat(tds) || 0.0;
    const othDed = parseFloat(otherDeductions) || 0.0;

    const netSalary = (basic + hraVal + conv + foodVal + spec + othAllow) - (pfVal + ptVal + esiVal + tdsVal + othDed);

    const slip = await prisma.salarySlip.upsert({
      where: {
        userId_month: { userId, month }
      },
      update: {
        basicSalary: basic,
        hra: hraVal,
        conveyance: conv,
        food: foodVal,
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
        food: foodVal,
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
    const ws = workbook.addWorksheet('Summary');

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
      'Paid Leaves Limit',
      'Unpaid Approved Leaves',
      'Unexcused Leaves',
      'Absenteeism Deduction',
      'Unpaid Leaves Deduction',
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

    // Fetch all stored slips for the month in bulk
    const slips = await prisma.salarySlip.findMany({
      where: {
        month,
        userId: { in: trainees.map(t => t.id) }
      }
    });
    const slipsMap = new Map(slips.map(s => [s.userId, s]));

    for (let idx = 0; idx < trainees.length; idx++) {
      const t = trainees[idx];
      const salData = await calculateTraineeSalaryData(t, year, mon, daysInMonth, startOfMonth, endOfMonth, settings);
      const storedSlip = slipsMap.get(t.id);

      if (storedSlip) {
        const grossEarnings = storedSlip.basicSalary + storedSlip.conveyance + storedSlip.otherAllowance + (storedSlip.food || 0.0);
        const totalDeductions = storedSlip.tds + storedSlip.otherDeductions;
        ws.addRow([
          idx + 1,
          t.fullName,
          t.identifier,
          month,
          storedSlip.basicSalary, // Column 5: Professional Fee (Basic)
          0, // Column 6: Training Fee (blank/0 for manual override)
          storedSlip.conveyance + (storedSlip.food || 0.0) + storedSlip.otherAllowance, // Column 7: Other Additions
          grossEarnings, // Column 8: Gross Earnings
          0, // Column 9: Late Arrival Total (Mins)
          0, // Column 10: Late Arrival Total (Hrs)
          0, // Column 11: Late Penalty
          0, // Column 12: Early Checkout Total (Mins)
          0, // Column 13: Early Checkout Total (Hrs)
          0, // Column 14: Early Penalty
          0, // Column 15: Absent Days
          0, // Column 16: Approved Leaves
          0, // Column 17: Paid Leaves Limit
          0, // Column 18: Unpaid Approved Leaves
          0, // Column 19: Unexcused Leaves
          0, // Column 20: Absenteeism Deduction
          0, // Column 21: Unpaid Leaves Deduction
          0, // Column 22: Extra Classes Conducted (Count)
          0, // Column 23: Extra Classes Hours
          0, // Column 24: Other Center Classes Conducted (Count)
          0, // Column 25: Other Center Classes Hours
          storedSlip.otherDeductions, // Column 26: Other Deductions
          storedSlip.tds, // Column 27: TDS
          totalDeductions, // Column 28: Total Deductions
          storedSlip.netSalary // Column 29: Net Salary (Take Home)
        ]);
      } else {
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
          salData.paidLeavesLimit,
          salData.unpaidApprovedLeaves,
          salData.unexcusedLeaves,
          salData.absentDeduction,
          salData.unpaidApprovedLeavesDeduction,
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
    }

    // Formatting numbers
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      // Currency columns
      [5, 6, 7, 8, 11, 14, 20, 21, 26, 27, 28, 29].forEach(c => {
        const cell = row.getCell(c);
        cell.numFmt = '"₹"#,##0';
        cell.alignment = { horizontal: 'right' };
      });
      // Center align columns
      [1, 4, 9, 10, 12, 13, 15, 16, 17, 18, 19, 22, 23, 24, 25].forEach(c => {
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

    // Helper to sanitize sheet names for Excel constraints
    const sanitizeSheetName = (name: string): string => {
      let sanitized = name.replace(/[\\/?*\[\]]/g, '');
      if (sanitized.length > 31) {
        sanitized = sanitized.substring(0, 31);
      }
      return sanitized || 'Sheet';
    };

    const addedNames = new Set<string>();
    const getUniqueSheetName = (name: string): string => {
      let sanitized = sanitizeSheetName(name);
      let uniqueName = sanitized;
      let counter = 1;
      while (addedNames.has(uniqueName.toLowerCase())) {
        const suffix = ` (${counter})`;
        const allowedLength = 31 - suffix.length;
        uniqueName = sanitized.substring(0, allowedLength) + suffix;
        counter++;
      }
      addedNames.add(uniqueName.toLowerCase());
      return uniqueName;
    };

    // Add separate sheet for each teacher
    for (const t of trainees) {
      const uniqueName = getUniqueSheetName(t.fullName);
      const teacherWs = workbook.addWorksheet(uniqueName);
      
      const salData = await calculateTraineeSalaryData(t, year, mon, daysInMonth, startOfMonth, endOfMonth, settings);
      const storedSlip = await prisma.salarySlip.findUnique({
        where: {
          userId_month: { userId: t.id, month }
        }
      });

      generateIndividualPayslipSheet(teacherWs, t, salData, storedSlip, month, year, mon);
    }

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

    if (settings?.allowPayslipsView === false || user.allowPayslipView === false) {
      return res.status(403).json({ error: 'Payslips are currently hidden by the Administrator.' });
    }

    const salData = await calculateTraineeSalaryData(user, year, mon, daysInMonth, startOfMonth, endOfMonth, settings);

    const storedSlip = await prisma.salarySlip.findUnique({
      where: {
        userId_month: { userId, month }
      }
    });

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
      salaryData: salData,
      storedSlip
    });
  } catch (error) {
    console.error('Error fetching own salary slip:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
