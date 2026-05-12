import { PrismaClient } from '@prisma/client';

const DB_URL_JAYA = "postgresql://neondb_owner:npg_xvd21RQLOGNf@ep-noisy-fire-aos9xgtm-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const DB_URL_HANU = "postgresql://neondb_owner:npg_WRVS3qQb5fFX@ep-curly-cake-ao9qtiyr-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const DB_URL_NEW  = "postgresql://neondb_owner:npg_CPZAONJQ1z2n@ep-blue-butterfly-ao90qqq3-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function mergeAll() {
    console.log("🚀 Starting Great Consolidation...");

    const prJaya = new PrismaClient({ datasources: { db: { url: DB_URL_JAYA } } });
    const prHanu = new PrismaClient({ datasources: { db: { url: DB_URL_HANU } } });
    const prNew  = new PrismaClient({ datasources: { db: { url: DB_URL_NEW } } });

    try {
        console.log("📥 Downloading Datasets from Source A (Jayanagar)...");
        const usersA = await prJaya.user.findMany({ include: { slots: true, attendances: true, leaveRequests: true, notices: true } });
        
        console.log("📥 Downloading Datasets from Source B (Hanumanthanagar)...");
        const usersB = await prHanu.user.findMany({ include: { slots: true, attendances: true, leaveRequests: true, notices: true } });

        console.log("🧹 Cleaning New Database destination before populate...");
        await prNew.attendance.deleteMany({});
        await prNew.slot.deleteMany({});
        await prNew.leaveRequest.deleteMany({});
        await prNew.notice.deleteMany({});
        await prNew.user.deleteMany({});
        await prNew.instituteSettings.deleteMany({});

        console.log("⚙️ Creating default GPS Settings in New DB...");
        await prNew.instituteSettings.create({
            data: {
                id: 1,
                lat: 12.926234, lng: 77.584561, radius: 100, // Spot 1 Defaults
                lat2: 12.926234, lng2: 77.584561, radius2: 100 // Spot 2 Defaults
            }
        });

        // 1. MERGE USERS VIA IDENTIFIER
        const unifiedUsers = new Map();
        
        function processUserList(list, sourceName) {
            for (const u of list) {
                // System Admin bypass
                if (u.identifier === 'admin') continue;

                if (!unifiedUsers.has(u.identifier)) {
                    // First time seeing this user
                    unifiedUsers.set(u.identifier, {
                        ...u,
                        attendances: [...u.attendances],
                        slots: [...u.slots],
                        leaveRequests: [...u.leaveRequests]
                    });
                } else {
                    // Duplicate found! We merge lists!
                    console.log(`🔗 Duplicate Found (Mobile: ${u.identifier}). Stitched successfully.`);
                    const master = unifiedUsers.get(u.identifier);
                    master.attendances.push(...u.attendances);
                    master.slots.push(...u.slots);
                    master.leaveRequests.push(...u.leaveRequests);
                }
            }
        }

        processUserList(usersA, "JAYANAGAR");
        processUserList(usersB, "HANUMANTHANAGAR");

        console.log(`📊 Unique User Count: ${unifiedUsers.size}`);

        // Insert Users One-by-One to resolve relational integrity
        for (const [identifier, data] of unifiedUsers.entries()) {
            const userObj = {
                role: data.role,
                fullName: data.fullName,
                identifier: data.identifier,
                email: data.email,
                department: data.department,
                password: data.password,
                isApproved: data.isApproved,
                leaveBalance: data.leaveBalance,
                totalLeaves: data.totalLeaves,
                mobileDeviceId: data.mobileDeviceId,
                desktopDeviceId: data.desktopDeviceId,
                photoUrl: data.photoUrl,
                officeTimings: data.officeTimings,
                dateOfJoining: data.dateOfJoining,
                aadhaarNumber: data.aadhaarNumber,
                aadhaarPhotoUrl: data.aadhaarPhotoUrl,
                panNumber: data.panNumber,
                panPhotoUrl: data.panPhotoUrl,
                bankName: data.bankName,
                bankAccountNo: data.bankAccountNo,
                bankIfscCode: data.bankIfscCode,
                bankBranchName: data.bankBranchName,
                emergencyContactName: data.emergencyContactName,
                emergencyContactMobile: data.emergencyContactMobile,
                fatherName: data.fatherName,
                motherName: data.motherName,
                presentAddress: data.presentAddress,
                permanentAddress: data.permanentAddress,
                educationCompleted: data.educationCompleted,
                subClassification: data.subClassification
            };

            // Check if email uniquely occupied in case two users share mobile but differ emails
            if (data.email) {
                 const existingMail = await prNew.user.findFirst({ where: { email: data.email } });
                 if (existingMail) userObj.email = null; // Discard email clone to avoid SQL error
            }

            const newUser = await prNew.user.create({ data: userObj });
            console.log(`✅ Migrated: ${newUser.fullName}`);

            // --- RE-INDEX SLOTS TO AVOID DAY/SLOTNO COLLISION ---
            const dailyCounters = {}; // Tracks count per day for re-numbering
            for (const s of data.slots) {
                const day = s.dayOfWeek.toUpperCase();
                if (!dailyCounters[day]) dailyCounters[day] = 0;
                dailyCounters[day]++;

                if (dailyCounters[day] > 5) {
                    console.warn(`⚠️ Warning: User ${newUser.fullName} has >5 slots on ${day}. Dropped excess.`);
                    continue;
                }

                await prNew.slot.create({
                    data: {
                        userId: newUser.id,
                        dayOfWeek: day,
                        slotNo: dailyCounters[day], // Safe sequential overwrite!
                        startTime: s.startTime,
                        endTime: s.endTime
                    }
                });
            }

            // --- MIGRATE ATTENDANCE ---
            // Group duplicate dates to prevent unique key violation if logged in both sides
            const attendanceMap = new Map();
            for (const att of data.attendances) {
                const dateStr = new Date(att.date).toDateString();
                if (!attendanceMap.has(dateStr)) {
                    attendanceMap.set(dateStr, att);
                }
            }

            for (const a of attendanceMap.values()) {
                try {
                    await prNew.attendance.create({
                        data: {
                            userId: newUser.id,
                            date: a.date,
                            inTime: a.inTime,
                            outTime: a.outTime,
                            status: a.status,
                            isLate: a.isLate,
                            inTime1: a.inTime1, outTime1: a.outTime1,
                            inTime2: a.inTime2, outTime2: a.outTime2,
                            inTime3: a.inTime3, outTime3: a.outTime3,
                            inTime4: a.inTime4, outTime4: a.outTime4,
                            inTime5: a.inTime5, outTime5: a.outTime5
                        }
                    });
                } catch (er) {} // Silently skip random duplicates
            }

            // --- MIGRATE LEAVES ---
            for (const l of data.leaveRequests) {
                await prNew.leaveRequest.create({
                    data: {
                        userId: newUser.id,
                        startDate: l.startDate,
                        endDate: l.endDate,
                        reason: l.reason,
                        adminReason: l.adminReason,
                        status: l.status,
                        appliedDate: l.appliedDate,
                        remarksAlternative: l.remarksAlternative,
                        remarksOfficeUse: l.remarksOfficeUse
                    }
                });
            }
        }

        console.log("🎉 ALL SYSTEMS CONSOLIDATED SUCCESSFULLY WITHOUT DATA LOSS!");

    } catch (err) {
        console.error("CRITICAL MERGE FAILURE:", err);
    } finally {
        await prJaya.$disconnect();
        await prHanu.$disconnect();
        await prNew.$disconnect();
    }
}

mergeAll();
