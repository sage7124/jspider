import exceljs from 'exceljs';
import path from 'path';

async function main() {
  const workbook = new exceljs.Workbook();
  const filePath = path.join(__dirname, '../test-formulas.xlsx');
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
