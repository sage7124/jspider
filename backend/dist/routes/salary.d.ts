declare const router: import("express-serve-static-core").Router;
export declare const calculateTraineeSalaryData: (trainee: any, year: number, mon: number, daysInMonth: number, startOfMonth: Date, endOfMonth: Date) => Promise<{
    professionalFee: any;
    trainingFee: any;
    grossEarnings: any;
    lateInstances: number;
    lateDeduction: number;
    earlyInstances: number;
    earlyDeduction: number;
    absentDays: number;
    eligibleCLs: number;
    cfLeaves: number;
    unexcusedLeaves: number;
    absentDeduction: number;
    tdsDeduction: number;
    totalDeductions: number;
    netTakeHome: number;
    panNo: any;
    aadhaarNo: any;
}>;
export default router;
//# sourceMappingURL=salary.d.ts.map