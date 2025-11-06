import {PrismaClient, Prisma} from "../src/app/generated/prisma/client";

const prisma = new PrismaClient();

const userData: Prisma.UserCreateInput[] = [
	{
		name: "Alice",
		email: "alice@prisma.io",
	},
	{
		name: "Bob",
		email: "bob@prisma.io",
	},
];

const walletData: Prisma.WalletCreateInput[] = [
	{
		address: "0x611beee11e1b21eaa39752607e78c1036435836a",
		label: "Example Wallet 1",
		isActive: true,
	},
	// Add more wallet addresses here
];

export async function main() {
	console.log("Seeding users...");
	for (const u of userData) {
		await prisma.user.upsert({
			where: {email: u.email},
			update: {},
			create: u,
		});
	}

	console.log("Seeding wallets...");
	for (const w of walletData) {
		await prisma.wallet.upsert({
			where: {address: w.address},
			update: {},
			create: w,
		});
	}

	console.log("✅ Seeding complete!");
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
