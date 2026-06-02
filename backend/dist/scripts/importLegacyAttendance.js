"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function runMigration() {
    const legacyUrlA = process.env.LEGACY_DB_A_URL;
    const legacyUrlB = process.env.LEGACY_DB_B_URL;
    if (!legacyUrlA || !legacyUrlB) {
        console.error('Error: Please define both LEGACY_DB_A_URL and LEGACY_DB_B_URL in your backend .env file first!');
        process.exit(1);
    }
    console.log('Initializing PostgreSQL clients...');
    const targetDb = new client_1.PrismaClient();
    const dbA = new client_1.PrismaClient({ datasources: { db: { url: legacyUrlA } } });
    const dbB = new client_1.PrismaClient({ datasources: { db: { url: legacyUrlB } } });
    try {
        const startDate = new Date('2026-05-01T00:00:00.000Z');
        const endDate = new Date('2026-05-16T23:59:59.999Z');
        console.log('Fetching users and May 1-16 attendance records from DB A...');
        const usersA = await dbA.user.findMany({ select: { id: true, identifier: true } });
        const attsA = await dbA.attendance.findMany({
            where: { date: { gte: startDate, lte: endDate } }
        });
        console.log('Fetching users and May 1-16 attendance records from DB B...');
        const usersB = await dbB.user.findMany({ select: { id: true, identifier: true } });
        const attsB = await dbB.attendance.findMany({
            where: { date: { gte: startDate, lte: endDate } }
        });
        console.log('Fetching target database users to build phone mappings...');
        const targetUsers = await targetDb.user.findMany({ select: { id: true, identifier: true } });
        const targetUserMap = new Map();
        targetUsers.forEach(u => {
            if (u.identifier)
                targetUserMap.set(u.identifier.trim(), u.id);
        });
        const userMapA = new Map();
        usersA.forEach(u => {
            if (u.identifier)
                userMapA.set(u.id, u.identifier.trim());
        });
        const userMapB = new Map();
        usersB.forEach(u => {
            if (u.identifier)
                userMapB.set(u.id, u.identifier.trim());
        });
        let successCount = 0;
        let skippedCount = 0;
        console.log('Processing DB A imports...');
        for (const att of attsA) {
            const phone = userMapA.get(att.userId);
            if (!phone) {
                skippedCount++;
                continue;
            }
            const targetUserId = targetUserMap.get(phone);
            if (!targetUserId) {
                skippedCount++;
                continue;
            }
            await targetDb.attendance.upsert({
                where: { userId_date: { userId: targetUserId, date: att.date } },
                create: {
                    userId: targetUserId,
                    date: att.date,
                    inTime: att.inTime,
                    outTime: att.outTime,
                    status: att.status || 'OUT',
                    isLate: att.isLate || false,
                    inTime1: att.inTime1 || att.inTime,
                    outTime1: att.outTime1 || att.outTime,
                    inBranch1: att.inBranch1 || 'LEGACY_A',
                    outBranch1: att.outBranch1 || 'LEGACY_A',
                    info: att.info || 'Legacy DB A Import'
                },
                update: {
                    inTime: att.inTime,
                    outTime: att.outTime,
                    status: att.status || 'OUT',
                    isLate: att.isLate || false,
                    inTime1: att.inTime1 || att.inTime,
                    outTime1: att.outTime1 || att.outTime,
                    inBranch1: att.inBranch1 || 'LEGACY_A',
                    outBranch1: att.outBranch1 || 'LEGACY_A',
                    info: att.info || 'Legacy DB A Import'
                }
            });
            successCount++;
        }
        console.log('Processing DB B imports...');
        for (const att of attsB) {
            const phone = userMapB.get(att.userId);
            if (!phone) {
                skippedCount++;
                continue;
            }
            const targetUserId = targetUserMap.get(phone);
            if (!targetUserId) {
                skippedCount++;
                continue;
            }
            await targetDb.attendance.upsert({
                where: { userId_date: { userId: targetUserId, date: att.date } },
                create: {
                    userId: targetUserId,
                    date: att.date,
                    inTime: att.inTime,
                    outTime: att.outTime,
                    status: att.status || 'OUT',
                    isLate: att.isLate || false,
                    inTime1: att.inTime1 || att.inTime,
                    outTime1: att.outTime1 || att.outTime,
                    inBranch1: att.inBranch1 || 'LEGACY_B',
                    outBranch1: att.outBranch1 || 'LEGACY_B',
                    info: att.info || 'Legacy DB B Import'
                },
                update: {
                    inTime: att.inTime,
                    outTime: att.outTime,
                    status: att.status || 'OUT',
                    isLate: att.isLate || false,
                    inTime1: att.inTime1 || att.inTime,
                    outTime1: att.outTime1 || att.outTime,
                    inBranch1: att.inBranch1 || 'LEGACY_B',
                    outBranch1: att.outBranch1 || 'LEGACY_B',
                    info: att.info || 'Legacy DB B Import'
                }
            });
            successCount++;
        }
        console.log(`Migration complete! Successfully imported/mapped ${successCount} attendance records. Skipped ${skippedCount} unmatched users.`);
    }
    catch (error) {
        console.error('Fatal Migration Error:', error);
    }
    finally {
        await targetDb.$disconnect();
        await dbA.$disconnect();
        await dbB.$disconnect();
    }
}
runMigration();
//# sourceMappingURL=importLegacyAttendance.js.map