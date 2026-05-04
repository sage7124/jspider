import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const attendances = await prisma.attendance.findMany({
    include: {
      user: {
        include: {
          slots: true
        }
      }
    }
  });

  console.log(`Scanning and updating ${attendances.length} attendance records...`);
  let updateCount = 0;

  for (const att of attendances) {
    if (!att.user) continue;

    const dayOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date(att.date).getDay()];
    const userSlots = att.user.slots.filter(s => s.dayOfWeek === dayOfWeek).sort((a, b) => a.slotNo - b.slotNo);
    
    // Check which slot is matching. We will check inTime, or inTime1, inTime2, inTime3
    let matchTime: Date | null = null;
    let slotStartTimeStr: string | null = null;

    if (att.inTime1) {
      matchTime = att.inTime1;
      const s = userSlots.find(slot => slot.slotNo === 1) || att.user.slots.find(slot => slot.slotNo === 1);
      if (s) slotStartTimeStr = s.startTime;
    } else if (att.inTime2) {
      matchTime = att.inTime2;
      const s = userSlots.find(slot => slot.slotNo === 2) || att.user.slots.find(slot => slot.slotNo === 2);
      if (s) slotStartTimeStr = s.startTime;
    } else if (att.inTime3) {
      matchTime = att.inTime3;
      const s = userSlots.find(slot => slot.slotNo === 3) || att.user.slots.find(slot => slot.slotNo === 3);
      if (s) slotStartTimeStr = s.startTime;
    } else if (att.inTime) {
      matchTime = att.inTime;
      const s = userSlots[0] || att.user.slots[0];
      if (s) slotStartTimeStr = s.startTime;
    }

    if (matchTime && slotStartTimeStr) {
      const [sTime, sMod] = slotStartTimeStr.split(' ');
      let [sh, sm] = sTime.split(':').map(Number);
      if (sMod === 'PM' && sh < 12) sh += 12;
      if (sMod === 'AM' && sh === 12) sh = 0;

      const slotStart = new Date(att.date);
      slotStart.setHours(sh, sm, 0, 0);

      const isLate = matchTime.getTime() > slotStart.getTime();

      if (att.isLate !== isLate) {
        await prisma.attendance.update({
          where: { id: att.id },
          data: { isLate }
        });
        updateCount++;
      }
    }
  }

  console.log(`Done! Updated ${updateCount} previous attendance records.`);
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
