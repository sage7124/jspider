const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  let sql = '-- Neon Database Dump\n\n';

  // 1. Export InstituteSettings
  const settings = await prisma.instituteSettings.findMany();
  if (settings.length > 0) {
    sql += '-- InstituteSettings\n';
    settings.forEach(s => {
      sql += `INSERT INTO "InstituteSettings" ("id", "lat", "lng", "radius", "lat2", "lng2", "radius2", "totalHolidaysQuota", "updatedAt") VALUES (${s.id}, ${s.lat}, ${s.lng}, ${s.radius}, ${s.lat2}, ${s.lng2}, ${s.radius2}, ${s.totalHolidaysQuota}, '${s.updatedAt.toISOString()}') ON CONFLICT ("id") DO UPDATE SET "lat" = EXCLUDED."lat", "lng" = EXCLUDED."lng", "radius" = EXCLUDED."radius", "lat2" = EXCLUDED."lat2", "lng2" = EXCLUDED."lng2", "radius2" = EXCLUDED."radius2", "totalHolidaysQuota" = EXCLUDED."totalHolidaysQuota", "updatedAt" = EXCLUDED."updatedAt";\n`;
    });
    sql += '\n';
  }

  // 2. Export DropdownOption
  const options = await prisma.dropdownOption.findMany();
  if (options.length > 0) {
    sql += '-- DropdownOption\n';
    options.forEach(o => {
      const escapedVal = o.value.replace(/'/g, "''");
      sql += `INSERT INTO "DropdownOption" ("id", "type", "value", "createdAt") VALUES (${o.id}, '${o.type}', '${escapedVal}', '${o.createdAt.toISOString()}') ON CONFLICT ("value") DO NOTHING;\n`;
    });
    sql += '\n';
  }

  // 3. Export BranchLocation
  const branches = await prisma.branchLocation.findMany();
  if (branches.length > 0) {
    sql += '-- BranchLocation\n';
    branches.forEach(b => {
      const escapedName = b.name.replace(/'/g, "''");
      const code = b.branchCode ? `'${b.branchCode}'` : 'NULL';
      const device = b.kioskDeviceId ? `'${b.kioskDeviceId}'` : 'NULL';
      sql += `INSERT INTO "BranchLocation" ("id", "name", "branchCode", "kioskDeviceId", "lat", "lng", "radius", "createdAt", "updatedAt") VALUES (${b.id}, '${escapedName}', ${code}, ${device}, ${b.lat}, ${b.lng}, ${b.radius}, '${b.createdAt.toISOString()}', '${b.updatedAt.toISOString()}') ON CONFLICT ("name") DO NOTHING;\n`;
    });
    sql += '\n';
  }

  // 4. Export Users
  const users = await prisma.user.findMany();
  if (users.length > 0) {
    sql += '-- Users\n';
    users.forEach(u => {
      const fullName = u.fullName.replace(/'/g, "''");
      const email = u.email ? `'${u.email.replace(/'/g, "''")}'` : 'NULL';
      const dept = u.department ? `'${u.department.replace(/'/g, "''")}'` : 'NULL';
      const plain = u.plainPassword ? `'${u.plainPassword.replace(/'/g, "''")}'` : 'NULL';
      const photo = u.photoUrl ? `'${u.photoUrl.replace(/'/g, "''")}'` : 'NULL';
      const timings = u.officeTimings ? `'${u.officeTimings.replace(/'/g, "''")}'` : 'NULL';
      const joining = u.dateOfJoining ? `'${u.dateOfJoining.replace(/'/g, "''")}'` : 'NULL';
      const aadhaar = u.aadhaarNumber ? `'${u.aadhaarNumber.replace(/'/g, "''")}'` : 'NULL';
      const aadhaarPhoto = u.aadhaarPhotoUrl ? `'${u.aadhaarPhotoUrl.replace(/'/g, "''")}'` : 'NULL';
      const pan = u.panNumber ? `'${u.panNumber.replace(/'/g, "''")}'` : 'NULL';
      const panPhoto = u.panPhotoUrl ? `'${u.panPhotoUrl.replace(/'/g, "''")}'` : 'NULL';
      const bank = u.bankName ? `'${u.bankName.replace(/'/g, "''")}'` : 'NULL';
      const bankAcc = u.bankAccountNo ? `'${u.bankAccountNo.replace(/'/g, "''")}'` : 'NULL';
      const bankIfsc = u.bankIfscCode ? `'${u.bankIfscCode.replace(/'/g, "''")}'` : 'NULL';
      const bankBranch = u.bankBranchName ? `'${u.bankBranchName.replace(/'/g, "''")}'` : 'NULL';
      const emergencyName = u.emergencyContactName ? `'${u.emergencyContactName.replace(/'/g, "''")}'` : 'NULL';
      const emergencyMob = u.emergencyContactMobile ? `'${u.emergencyContactMobile.replace(/'/g, "''")}'` : 'NULL';
      const father = u.fatherName ? `'${u.fatherName.replace(/'/g, "''")}'` : 'NULL';
      const mother = u.motherName ? `'${u.motherName.replace(/'/g, "''")}'` : 'NULL';
      const presentAdd = u.presentAddress ? `'${u.presentAddress.replace(/'/g, "''")}'` : 'NULL';
      const permanentAdd = u.permanentAddress ? `'${u.permanentAddress.replace(/'/g, "''")}'` : 'NULL';
      const edu = u.educationCompleted ? `'${u.educationCompleted.replace(/'/g, "''")}'` : 'NULL';
      const subClass = u.subClassification ? `'${u.subClassification.replace(/'/g, "''")}'` : 'NULL';
      const session = u.activeSessionToken ? `'${u.activeSessionToken.replace(/'/g, "''")}'` : 'NULL';
      const supervisor = u.supervisorId ? u.supervisorId : 'NULL';

      sql += `INSERT INTO "User" ("id", "role", "fullName", "identifier", "email", "department", "password", "plainPassword", "isApproved", "createdAt", "updatedAt", "leaveBalance", "totalLeaves", "photoUrl", "officeTimings", "dateOfJoining", "aadhaarNumber", "aadhaarPhotoUrl", "panNumber", "panPhotoUrl", "bankName", "bankAccountNo", "bankIfscCode", "bankBranchName", "emergencyContactName", "emergencyContactMobile", "fatherName", "motherName", "presentAddress", "permanentAddress", "educationCompleted", "subClassification", "permissions", "activeSessionToken", "supervisorId") VALUES (${u.id}, '${u.role}', '${fullName}', '${u.identifier}', ${email}, ${dept}, '${u.password}', ${plain}, ${u.isApproved}, '${u.createdAt.toISOString()}', '${u.updatedAt.toISOString()}', ${u.leaveBalance}, ${u.totalLeaves}, ${photo}, ${timings}, ${joining}, ${aadhaar}, ${aadhaarPhoto}, ${pan}, ${panPhoto}, ${bank}, ${bankAcc}, ${bankIfsc}, ${bankBranch}, ${emergencyName}, ${emergencyMob}, ${father}, ${mother}, ${presentAdd}, ${permanentAdd}, ${edu}, ${subClass}, '${u.permissions}', ${session}, ${supervisor}) ON CONFLICT ("identifier") DO NOTHING;\n`;
    });
    sql += '\n';
  }

  fs.writeFileSync('neon_data.sql', sql, 'utf8');
  console.log('Successfully generated neon_data.sql');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
