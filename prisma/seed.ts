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

const walletSeeds: Array<{
	email: string;
	address: string;
	label?: string;
	chainId?: number;
	isActive?: boolean;
	savingPercentBps?: number;
	withdrawalDelaySeconds?: number;
}> = [
	{
		email: "alice@prisma.io",
		address: "0x611beee11e1b21eaa39752607e78c1036435836a",
		label: "Alice Main Wallet",
		chainId: 1,
		isActive: true,
		savingPercentBps: 1500,
		withdrawalDelaySeconds: 86_400,
	},
	{
		email: "bob@prisma.io",
		address: "0x63d2f485ddf23b649fcc94b2c90df0bffebc5431",
		label: "Bob Primary",
		chainId: 1,
		isActive: true,
		savingPercentBps: 2500,
		withdrawalDelaySeconds: 172_800,
	},
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
	for (const seed of walletSeeds) {
		const user = await prisma.user.findUnique({
			where: {email: seed.email},
		});

		if (!user) {
			continue;
		}

		await prisma.user.update({
			where: {id: user.id},
			data: {
				savingPercentBps:
					seed.savingPercentBps ?? user.savingPercentBps ?? 0,
				withdrawalDelaySeconds:
					seed.withdrawalDelaySeconds ?? user.withdrawalDelaySeconds ?? 86_400,
			},
		});

		await prisma.wallet.upsert({
			where: {address: seed.address.toLowerCase()},
			update: {
				label: seed.label,
				chainId: seed.chainId ?? 1,
				isActive: seed.isActive ?? true,
				userId: user.id,
			},
			create: {
				address: seed.address.toLowerCase(),
				label: seed.label,
				chainId: seed.chainId ?? 1,
				isActive: seed.isActive ?? true,
				user: {connect: {id: user.id}},
			},
		});
	}

	console.log("Seeding complete!");
}

main()
	.catch((error) => {
		console.error(error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
