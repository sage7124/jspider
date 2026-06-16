-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'TRAINEE',
    "fullName" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "email" TEXT,
    "department" TEXT,
    "password" TEXT NOT NULL,
    "plainPassword" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "leaveBalance" INTEGER NOT NULL DEFAULT 0,
    "totalLeaves" INTEGER NOT NULL DEFAULT 0,
    "mobileDeviceId" TEXT,
    "desktopDeviceId" TEXT,
    "editAccessGrantedUntil" TIMESTAMP(3),
    "photoUrl" TEXT,
    "officeTimings" TEXT,
    "dateOfJoining" TEXT,
    "aadhaarNumber" TEXT,
    "aadhaarPhotoUrl" TEXT,
    "panNumber" TEXT,
    "panPhotoUrl" TEXT,
    "bankName" TEXT,
    "bankAccountNo" TEXT,
    "bankIfscCode" TEXT,
    "bankBranchName" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactMobile" TEXT,
    "fatherName" TEXT,
    "motherName" TEXT,
    "presentAddress" TEXT,
    "permanentAddress" TEXT,
    "educationCompleted" TEXT,
    "subClassification" TEXT,
    "permissions" TEXT NOT NULL DEFAULT 'RESET_PASSWORD,DIRECT_LEAVE,DOWNLOAD_REPORT',
    "activeSessionToken" TEXT,
    "supervisorId" INTEGER,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "adminReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "appliedDate" TIMESTAMP(3),
    "remarksAlternative" TEXT,
    "remarksOfficeUse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Slot" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "slotNo" INTEGER NOT NULL DEFAULT 1,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "inTime" TIMESTAMP(3),
    "outTime" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'IN',
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inTime1" TIMESTAMP(3),
    "outTime1" TIMESTAMP(3),
    "inBranch1" TEXT,
    "outBranch1" TEXT,
    "inTime2" TIMESTAMP(3),
    "outTime2" TIMESTAMP(3),
    "inBranch2" TEXT,
    "outBranch2" TEXT,
    "inTime3" TIMESTAMP(3),
    "outTime3" TIMESTAMP(3),
    "inBranch3" TEXT,
    "outBranch3" TEXT,
    "inTime4" TIMESTAMP(3),
    "outTime4" TIMESTAMP(3),
    "inTime5" TIMESTAMP(3),
    "outTime5" TIMESTAMP(3),
    "info" TEXT,
    "info1" TEXT,
    "info2" TEXT,
    "info3" TEXT,
    "info4" TEXT,
    "info5" TEXT,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstituteSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lat" DOUBLE PRECISION NOT NULL DEFAULT 12.9716,
    "lng" DOUBLE PRECISION NOT NULL DEFAULT 77.5946,
    "radius" INTEGER NOT NULL DEFAULT 500,
    "lat2" DOUBLE PRECISION NOT NULL DEFAULT 12.9716,
    "lng2" DOUBLE PRECISION NOT NULL DEFAULT 77.5946,
    "radius2" INTEGER NOT NULL DEFAULT 500,
    "totalHolidaysQuota" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstituteSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notice" (
    "id" SERIAL NOT NULL,
    "message" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER,
    "targetGroup" TEXT NOT NULL DEFAULT 'ALL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DropdownOption" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DropdownOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchLocation" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "branchCode" TEXT,
    "kioskDeviceId" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "radius" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Memo" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "recipientId" INTEGER NOT NULL,
    "senderId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Memo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreakLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "breakOut" TIMESTAMP(3) NOT NULL,
    "breakIn" TIMESTAMP(3),
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "bookletNo" TEXT,
    "collegeName" TEXT,
    "subject" TEXT,
    "topicsCovered" TEXT,
    "conveyance" TEXT,
    "numberOfHours" TEXT,
    "fromTime" TEXT,
    "toTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BreakLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtraClassLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "day" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "noOfStudents" INTEGER NOT NULL,
    "centerName" TEXT NOT NULL,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "adminReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtraClassLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassCancelledLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "day" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL,
    "centerName" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'Other reasons',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassCancelledLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_identifier_key" ON "User"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_mobileDeviceId_key" ON "User"("mobileDeviceId");

-- CreateIndex
CREATE UNIQUE INDEX "User_desktopDeviceId_key" ON "User"("desktopDeviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Slot_userId_dayOfWeek_slotNo_key" ON "Slot"("userId", "dayOfWeek", "slotNo");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_userId_date_key" ON "Attendance"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DropdownOption_value_key" ON "DropdownOption"("value");

-- CreateIndex
CREATE UNIQUE INDEX "BranchLocation_name_key" ON "BranchLocation"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BranchLocation_kioskDeviceId_key" ON "BranchLocation"("kioskDeviceId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slot" ADD CONSTRAINT "Slot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memo" ADD CONSTRAINT "Memo_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memo" ADD CONSTRAINT "Memo_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakLog" ADD CONSTRAINT "BreakLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraClassLog" ADD CONSTRAINT "ExtraClassLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassCancelledLog" ADD CONSTRAINT "ClassCancelledLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

