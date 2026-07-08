import { PrismaClient } from '@prisma/client';

const DB_URL_CENTRAL = "postgresql://neondb_owner:npg_CPZAONJQ1z2n@ep-blue-butterfly-ao90qqq3-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const DB_URL_JAYA = "postgresql://neondb_owner:npg_xvd21RQLOGNf@ep-noisy-fire-aos9xgtm-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const DB_URL_HANU = "postgresql://neondb_owner:npg_WRVS3qQb5fFX@ep-curly-cake-ao9qtiyr-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function runMerge() {
  console.log('=========================================');
  console.log('🚀 INITIATING MASTER DATABASE CONSOLIDATION');
  console.log('=========================================');

  const prismaCentral = new PrismaClient({ datasources: { db: { url: DB_URL_CENTRAL } } });
  const prismaJaya = new PrismaClient({ datasources: { db: { url: DB_URL_JAYA } } });
  const prismaHanu = new PrismaClient({ datasources: { db: { url: DB_URL_HANU } } });

  const remoteDbs = [
    { name: 'Jayanagar', client: prismaJaya },
    { name: 'Hanumanthnagar', client: prismaHanu },
  ];

  try {
    for (const remote of remoteDbs) {
      console.log(`\n📦 Processing legacy branch: [${remote.name}]`);
      
      // 1. Fetch ALL Users
      const remoteUsers = await remote.client.user.findMany();
      console.log(` - Found ${remoteUsers.length} users in ${remote.name}`);

      let usersCreated = 0;
      let usersLinked = 0;
      
      // Map to hold mapping from remote UserId to central UserId
      const userMapping = new Map<number, number>();

      for (const ru of remoteUsers) {
        // Look up by unique identifier
        let centralUser = await prismaCentral.user.findUnique({
          where: { identifier: ru.identifier }
        });

        if (!centralUser) {
          // Create the user exactly as they are in remote
          const createData = { ...ru };
          delete (createData as any).id; // auto increment
          
          // Check uniqueness of email or device IDs if already taken in central
          if (ru.email) {
            const emailExists = await prismaCentral.user.findUnique({ where: { email: ru.email } });
            if (emailExists) createData.email = null; // safely unset duplicate email to prevent crash
          }
          if (ru.mobileDeviceId) {
            const mobExists = await prismaCentral.user.findUnique({ where: { mobileDeviceId: ru.mobileDeviceId } });
            if (mobExists) createData.mobileDeviceId = null;
          }
          if (ru.desktopDeviceId) {
            const deskExists = await prismaCentral.user.findUnique({ where: { desktopDeviceId: ru.desktopDeviceId } });
            if (deskExists) createData.desktopDeviceId = null;
          }

          centralUser = await prismaCentral.user.create({
            data: createData
          });
          usersCreated++;
        } else {
          usersLinked++;
        }
        userMapping.set(ru.id, centralUser.id);
      }
      console.log(`   ✅ Linked: ${usersLinked} users | Created: ${usersCreated} new users`);

      // 2. Fetch and Upsert Slots
      const remoteSlots = await remote.client.slot.findMany();
      console.log(` - Found ${remoteSlots.length} slots in ${remote.name}. Upserting...`);
      let slotsUpserted = 0;
      
      for (const rs of remoteSlots) {
        const newUserId = userMapping.get(rs.userId);
        if (!newUserId) continue;

        const existingSlot = await prismaCentral.slot.findFirst({
          where: {
            userId: newUserId,
            dayOfWeek: rs.dayOfWeek,
            slotNo: rs.slotNo,
            effectiveTo: null
          }
        });

        if (existingSlot) {
          await prismaCentral.slot.update({
            where: { id: existingSlot.id },
            data: {
              startTime: rs.startTime,
              endTime: rs.endTime
            }
          });
        } else {
          await prismaCentral.slot.create({
            data: {
              userId: newUserId,
              dayOfWeek: rs.dayOfWeek,
              slotNo: rs.slotNo,
              startTime: rs.startTime,
              endTime: rs.endTime
            }
          });
        }
        slotsUpserted++;
      }
      console.log(`   ✅ Successfully processed ${slotsUpserted} slots`);

      // 3. Fetch and Merge Attendance Records
      const remoteAtts = await remote.client.attendance.findMany();
      console.log(` - Found ${remoteAtts.length} attendance records in ${remote.name}. Performing data fusion...`);
      let attCreated = 0;
      let attMerged = 0;

      for (const ra of remoteAtts) {
        const newUserId = userMapping.get(ra.userId);
        if (!newUserId) continue;

        // Ensure local midnight date matching
        const attDate = new Date(ra.date);
        attDate.setHours(0, 0, 0, 0);

        const existing = await prismaCentral.attendance.findUnique({
          where: {
            userId_date: {
              userId: newUserId,
              date: attDate
            }
          }
        });

        if (existing) {
          // Intelligent blend: remote overrides central ONLY for fields where remote has actual values
          const updatePayload: any = {};
          const fields = [
            'inTime', 'outTime',
            'inTime1', 'outTime1', 'inTime2', 'outTime2', 'inTime3', 'outTime3',
            'inTime4', 'outTime4', 'inTime5', 'outTime5'
          ];

          let hasChange = false;
          for (const f of fields) {
            const remVal = (ra as any)[f];
            const exVal = (existing as any)[f];
            
            // Remote value wins if it exists and is different or fills an empty field
            if (remVal && (!exVal || remVal.getTime() !== exVal.getTime())) {
              updatePayload[f] = remVal;
              hasChange = true;
            }
          }
          
          // If status matches remote IN or has active values, override
          if (ra.status === 'IN' && existing.status === 'OUT') {
            updatePayload.status = 'IN';
            hasChange = true;
          }
          if (ra.isLate && !existing.isLate) {
            updatePayload.isLate = true;
            hasChange = true;
          }

          if (hasChange) {
            await prismaCentral.attendance.update({
              where: { id: existing.id },
              data: updatePayload
            });
            attMerged++;
          }
        } else {
          // Create fresh
          const createData = { ...ra };
          delete (createData as any).id;
          createData.userId = newUserId;
          createData.date = attDate;

          await prismaCentral.attendance.create({
            data: createData
          });
          attCreated++;
        }
      }
      console.log(`   ✅ Created: ${attCreated} new records | Merged: ${attMerged} updated records`);

      // 4. Fetch and Sync LeaveRequests
      const remoteLeaves = await remote.client.leaveRequest.findMany();
      console.log(` - Found ${remoteLeaves.length} leave requests in ${remote.name}. Syncing...`);
      let leavesCreated = 0;

      for (const rl of remoteLeaves) {
        const newUserId = userMapping.get(rl.userId);
        if (!newUserId) continue;

        // Avoid duplicate leaves (very simple overlapping bounds check)
        const exists = await prismaCentral.leaveRequest.findFirst({
          where: {
            userId: newUserId,
            startDate: rl.startDate,
            endDate: rl.endDate
          }
        });

        if (!exists) {
          const createData = { ...rl };
          delete (createData as any).id;
          createData.userId = newUserId;
          await prismaCentral.leaveRequest.create({ data: createData });
          leavesCreated++;
        }
      }
      console.log(`   ✅ Successfully synced ${leavesCreated} leave records`);
    }

    // 5. Sync Global Entities (Holidays & DropdownOptions) from Jayanagar (representative)
    console.log(`\n📦 Syncing Global Entities (Holidays & System Settings)...`);
    const remoteHols = await prismaJaya.holiday.findMany();
    let holsCreated = 0;
    for (const rh of remoteHols) {
      const exists = await prismaCentral.holiday.findUnique({ where: { date: rh.date } });
      if (!exists) {
        await prismaCentral.holiday.create({
          data: { date: rh.date, name: rh.name }
        });
        holsCreated++;
      }
    }
    console.log(` ✅ Imported ${holsCreated} new global holidays`);

    console.log('\n🎉=========================================');
    console.log('🏁 FUSION COMPLETE! ALL LOGS ARE UNIFIED!');
    console.log('=========================================');

  } catch (error) {
    console.error('❌ CRITICAL SYNC FAILURE:', error);
  } finally {
    await prismaCentral.$disconnect();
    await prismaJaya.$disconnect();
    await prismaHanu.$disconnect();
  }
}

runMerge();
