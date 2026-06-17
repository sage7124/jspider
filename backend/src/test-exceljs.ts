import exceljs from 'exceljs';
import path from 'path';

async function main() {
  const workbook = new exceljs.Workbook();
  const ws = workbook.addWorksheet('Test');

  // Test cell with leading =
  ws.getCell('A1').value = { formula: '=10*5', result: 50 };
  
  // Test cell without leading =
  ws.getCell('A2').value = { formula: '10*5', result: 50 };

  // Test cell with SUM and leading =
  ws.getCell('A3').value = { formula: '=SUM(A1:A2)', result: 100 };

  // Test cell with SUM without leading =
  ws.getCell('A4').value = { formula: 'SUM(A1:A2)', result: 100 };

  const filePath = path.join(__dirname, '../test-formulas.xlsx');
  await workbook.xlsx.writeFile(filePath);
  console.log("Written test file to:", filePath);
}

main().catch(console.error);
