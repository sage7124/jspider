"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const exceljs_1 = __importDefault(require("exceljs"));
const path_1 = __importDefault(require("path"));
async function main() {
    const workbook = new exceljs_1.default.Workbook();
    const ws = workbook.addWorksheet('Test');
    // Test cell with leading =
    ws.getCell('A1').value = { formula: '=10*5', result: 50 };
    // Test cell without leading =
    ws.getCell('A2').value = { formula: '10*5', result: 50 };
    // Test cell with SUM and leading =
    ws.getCell('A3').value = { formula: '=SUM(A1:A2)', result: 100 };
    // Test cell with SUM without leading =
    ws.getCell('A4').value = { formula: 'SUM(A1:A2)', result: 100 };
    const filePath = path_1.default.join(__dirname, '../test-formulas.xlsx');
    await workbook.xlsx.writeFile(filePath);
    console.log("Written test file to:", filePath);
}
main().catch(console.error);
//# sourceMappingURL=test-exceljs.js.map