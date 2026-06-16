const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Helper function to convert array of objects to CSV string
function convertToCSV(array, keys) {
  const header = keys.map(k => `"${k}"`).join(',');
  const rows = array.map(row => {
    return keys.map(fieldName => {
      const val = row[fieldName];
      if (val === null || val === undefined) {
        return '""';
      }
      if (val instanceof Date) {
        return `"${val.toISOString()}"`;
      }
      // Stringify and escape double quotes
      const escaped = String(val).replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(',');
  });
  return [header, ...rows].join('\n');
}

async function main() {
  console.log('Fetching all data from Neon database...');

  // Create a clean output directory to avoid locked file errors
  const exportDir = path.join(__dirname, 'neon_export');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir);
  }

  // 1. Export Users
  const users = await prisma.user.findMany();
  const userKeys = [
    'id', 'role', 'fullName', 'identifier', 'email', 'department', 
    'password', 'plainPassword', 'isApproved', 'createdAt', 'updatedAt', 
    'leaveBalance', 'totalLeaves', 'photoUrl', 'officeTimings', 'dateOfJoining', 
    'aadhaarNumber', 'aadhaarPhotoUrl', 'panNumber', 'panPhotoUrl', 'bankName', 
    'bankAccountNo', 'bankIfscCode', 'bankBranchName', 'emergencyContactName', 
    'emergencyContactMobile', 'fatherName', 'motherName', 'presentAddress', 
    'permanentAddress', 'educationCompleted', 'subClassification', 'permissions', 
    'activeSessionToken', 'supervisorId'
  ];
  fs.writeFileSync(path.join(exportDir, 'users.csv'), convertToCSV(users, userKeys), 'utf8');
  console.log(`- Exported ${users.length} users`);

  // 2. Export Branch Locations
  const branches = await prisma.branchLocation.findMany();
  const branchKeys = ['id', 'name', 'branchCode', 'kioskDeviceId', 'lat', 'lng', 'radius', 'createdAt', 'updatedAt'];
  fs.writeFileSync(path.join(exportDir, 'branch_locations.csv'), convertToCSV(branches, branchKeys), 'utf8');
  console.log(`- Exported ${branches.length} branch locations`);

  // 3. Export Dropdown Options
  const options = await prisma.dropdownOption.findMany();
  const optionKeys = ['id', 'type', 'value', 'createdAt'];
  fs.writeFileSync(path.join(exportDir, 'dropdown_options.csv'), convertToCSV(options, optionKeys), 'utf8');
  console.log(`- Exported ${options.length} dropdown options`);

  // 4. Export Institute Settings
  const settings = await prisma.instituteSettings.findMany();
  const settingsKeys = ['id', 'lat', 'lng', 'radius', 'lat2', 'lng2', 'radius2', 'totalHolidaysQuota', 'updatedAt'];
  fs.writeFileSync(path.join(exportDir, 'institute_settings.csv'), convertToCSV(settings, settingsKeys), 'utf8');
  console.log(`- Exported ${settings.length} settings records`);

  // 5. Export Attendance (Punch-in / Punch-out logs)
  const attendance = await prisma.attendance.findMany();
  const attendanceKeys = [
    'id', 'userId', 'date', 'inTime', 'outTime', 'status', 'isLate', 'createdAt',
    'inTime1', 'outTime1', 'inBranch1', 'outBranch1',
    'inTime2', 'outTime2', 'inBranch2', 'outBranch2',
    'inTime3', 'outTime3', 'inBranch3', 'outBranch3',
    'inTime4', 'outTime4', 'inTime5', 'outTime5',
    'info', 'info1', 'info2', 'info3', 'info4', 'info5'
  ];
  fs.writeFileSync(path.join(exportDir, 'attendance_punch_logs.csv'), convertToCSV(attendance, attendanceKeys), 'utf8');
  console.log(`- Exported ${attendance.length} attendance logs`);

  // 6. Export Break Logs
  const breaks = await prisma.breakLog.findMany();
  const breakKeys = [
    'id', 'userId', 'date', 'breakOut', 'breakIn', 'reason', 'status',
    'bookletNo', 'collegeName', 'subject', 'topicsCovered', 'conveyance',
    'numberOfHours', 'fromTime', 'toTime', 'createdAt'
  ];
  fs.writeFileSync(path.join(exportDir, 'break_details_logs.csv'), convertToCSV(breaks, breakKeys), 'utf8');
  console.log(`- Exported ${breaks.length} break logs`);

  // 7. Export Extra Classes
  const extraClasses = await prisma.extraClassLog.findMany();
  const extraClassKeys = [
    'id', 'userId', 'date', 'day', 'subject', 'batchNo', 'duration',
    'startTime', 'endTime', 'noOfStudents', 'centerName', 'remarks',
    'status', 'adminReason', 'createdAt', 'updatedAt'
  ];
  fs.writeFileSync(path.join(exportDir, 'extra_classes_logs.csv'), convertToCSV(extraClasses, extraClassKeys), 'utf8');
  console.log(`- Exported ${extraClasses.length} extra class logs`);

  // 8. Export Cancelled Classes
  const cancelledClasses = await prisma.classCancelledLog.findMany();
  const cancelledKeys = ['id', 'userId', 'date', 'day', 'subject', 'batchNo', 'centerName', 'reason', 'remarks', 'createdAt'];
  fs.writeFileSync(path.join(exportDir, 'cancelled_classes_logs.csv'), convertToCSV(cancelledClasses, cancelledKeys), 'utf8');
  console.log(`- Exported ${cancelledClasses.length} cancelled class logs`);

  // 9. Export Leave Requests
  const leaves = await prisma.leaveRequest.findMany();
  const leaveKeys = ['id', 'userId', 'startDate', 'endDate', 'reason', 'adminReason', 'status', 'appliedDate', 'remarksAlternative', 'remarksOfficeUse', 'createdAt', 'updatedAt'];
  fs.writeFileSync(path.join(exportDir, 'leave_requests_logs.csv'), convertToCSV(leaves, leaveKeys), 'utf8');
  console.log(`- Exported ${leaves.length} leave requests`);

  // 10. Export Memos
  const memos = await prisma.memo.findMany();
  const memoKeys = ['id', 'content', 'recipientId', 'senderId', 'createdAt'];
  fs.writeFileSync(path.join(exportDir, 'memos.csv'), convertToCSV(memos, memoKeys), 'utf8');
  console.log(`- Exported ${memos.length} memos`);

  console.log(`\nAll database data successfully downloaded and saved to: ${exportDir}`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
