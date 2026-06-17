"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const exceljs_1 = __importDefault(require("exceljs"));
const path_1 = __importDefault(require("path"));
async function main() {
    const workbook = new exceljs_1.default.Workbook();
    const filePath = path_1.default.join(__dirname, '../test-formulas.xlsx');
    await workbook.xlsx.readFile(filePath);
    const ws = workbook.getWorksheet('Test');
    if (!ws) {
        console.log("Worksheet not found");
        return;
    }
    for (const cellId of ['A1', 'A2', 'A3', 'A4']) {
        const cell = ws.getCell(cellId);
        console.log(`Cell ${cellId}:`, cell.value);
    }
}
main().catch(console.error);
//# sourceMappingURL=read-exceljs.js.map