import * as exceljs from 'exceljs';
export declare const getTraineeReportData: (user: any, attendances: any[], year: number, mon: number, daysInMonth: number, holidays?: any[], leaves?: any[]) => {
    rows: any[];
    totals: {
        late: string;
        earlyDeparture: string;
        extraWork: string;
    };
    assignedSlotNos: number[];
    hasExtraSlots: boolean;
    hasSlot1: boolean;
    hasSlot2: boolean;
    hasSlot3: boolean;
};
export declare const generateTraineeWorksheet: (ws: exceljs.Worksheet, user: any, attendances: any[], year: number, mon: number, daysInMonth: number, holidays?: any[], leaves?: any[]) => void;
//# sourceMappingURL=excel.d.ts.map