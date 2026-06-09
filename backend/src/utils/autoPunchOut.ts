import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function getSlotEndTimeDate(attDate: Date, endTimeStr: string): Date {
  const d = new Date(attDate);
  const [time, mod] = endTimeStr.split(' ');
  let [h, m] = time.split(':').map(Number);
  if (mod === 'PM' && h < 12) h += 12;
  if (mod === 'AM' && h === 12) h = 0;
  d.setHours(h, m, 0, 0);
  return d;
}

export async function performAutoPunchOut() {
  try {
    const now = new Date();
    // Find all attendance records where status is 'IN'
    const activeAttendances = await prisma.attendance.findMany({
      where: { status: 'IN' },
      include: {
        user: {
          include: {
            slots: true
          }
        }
      }
    });

    for (const att of activeAttendances) {
      if (!att.user) continue;

      // Find the day of week for this attendance record in Asia/Kolkata timezone
      const localDate = new Date(att.date);
      const dayOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][localDate.getDay()];

      // Get user's slots for this day of week
      const userSlots = att.user.slots.filter(s => s.dayOfWeek === dayOfWeek).sort((a, b) => a.slotNo - b.slotNo);

      // Check which slot is currently open (has inTime but no outTime)
      for (const slot of userSlots) {
        const si = slot.slotNo;
        const inTimeSlot = att[`inTime${si}` as keyof typeof att];
        const outTimeSlot = att[`outTime${si}` as keyof typeof att];

        if (inTimeSlot && !outTimeSlot) {
          // Parse slot end time
          const slotEndTime = getSlotEndTimeDate(att.date, slot.endTime);
          
          // Add 5 minutes gap
          const thresholdTime = new Date(slotEndTime.getTime() + 5 * 60000);

          if (now.getTime() > thresholdTime.getTime()) {
            console.log(`[Auto Punch Out] Punching out user ${att.user.fullName} (${att.user.identifier}) for Slot ${si} on date ${att.date.toLocaleDateString()}`);
            
            // Auto punch out time is exactly the slot's endTime
            const autoPunchOutTime = slotEndTime;

            const updateData: any = {
              status: 'OUT',
              outTime: autoPunchOutTime
            };
            updateData[`outTime${si}`] = autoPunchOutTime;
            updateData[`outBranch${si}`] = 'Auto';

            // Update local record
            await prisma.attendance.update({
              where: { id: att.id },
              data: updateData
            });

            break; // Stop checking other slots for this attendance record
          }
        }
      }
    }
  } catch (err) {
    console.error('Error in performAutoPunchOut:', err);
  }
}
