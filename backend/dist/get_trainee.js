"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../.env') });
const prisma = new client_1.PrismaClient();
async function main() {
    const users = await prisma.user.findMany({
        where: {
            role: 'TRAINEE'
        },
        select: {
            id: true,
            fullName: true,
            baseSalary: true,
            collegeVisitRate: true,
            extraClassRate: true,
            otherCenterClassRate: true,
            tdsRate: true
        }
    });
    console.log("Trainees and their rates:");
    console.table(users);
}
main()
    .catch(e => {
    console.error(e);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=get_trainee.js.map