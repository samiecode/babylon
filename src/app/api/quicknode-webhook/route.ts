import {NextRequest, NextResponse} from "next/server";
import prisma from "@/lib/prisma";
import {Prisma} from "@/app/generated/prisma/client";
import {decodeAddress, hexToBigInt} from "@/lib/utils";

type QuickNodeLog = {
	address: string;
	data: string;
	topics: string[];
	logIndex?: string | number;
	transactionHash: string;
	transactionIndex?: string | number;
};

type QuickNodeReceipt = {
	blockNumber?: string | number;
	logs?: QuickNodeLog[];
};

const TRANSFER_SIG = (process.env.QUICKNODE_SIGNATURE || "").toLowerCase();
const CACHE_TTL_MS = 5 * 60 * 1000;

type WatchedWallet = Awaited<
	ReturnType<typeof prisma.wallet.findMany>
>[number] & {
	user: {savingPercentBps: number; withdrawalDelaySeconds: number};
};

let cachedWallets: Map<string, WatchedWallet> | null = null;
let cacheExpiry = 0;

async function getWatchedWallets(): Promise<Map<string, WatchedWallet>> {
	const now = Date.now();

	if (cachedWallets && cacheExpiry > now) {
		return cachedWallets;
	}

	const wallets = await prisma.wallet.findMany({
		where: {isActive: true},
		include: {user: true},
	});

	const nextCache = new Map<string, WatchedWallet>();
	for (const wallet of wallets) {
		nextCache.set(wallet.address.toLowerCase(), wallet as WatchedWallet);
	}

	cachedWallets = nextCache;
	cacheExpiry = now + CACHE_TTL_MS;

	return nextCache;
}

function safeBigInt(value: unknown): bigint | null {
	if (typeof value === "number") {
		return BigInt(value);
	}
	if (typeof value === "string") {
		if (!value.length) return null;
		try {
			return BigInt(value);
		} catch {
			return null;
		}
	}
	return null;
}

function computeSaveAmount(amount: bigint, bps: number): bigint {
	if (bps <= 0) return BigInt("0");
	return (amount * BigInt(String(bps))) / BigInt("10000");
}

export async function POST(req: NextRequest) {
	const payload = (await req.json()) as {
		data?: QuickNodeReceipt[];
	};

	const watchedWallets = await getWatchedWallets();

	const detectedTransfers: Array<{
		wallet: WatchedWallet;
		fromAddress: string;
		toAddress: string;
		tokenAddress: string;
		txHash: string;
		blockNumber: bigint | null;
		amountRaw: bigint;
		saveAmountWei: bigint;
		log: QuickNodeLog;
	}> = [];

	for (const receipt of payload.data ?? []) {
		if (!Array.isArray(receipt.logs)) continue;

		const blockNumber = safeBigInt(receipt.blockNumber);

		for (const log of receipt.logs) {
			if (!log.topics?.length) continue;
			if (log.topics[0]?.toLowerCase() !== TRANSFER_SIG) continue;

			const to = decodeAddress(log.topics[2] ?? "");
			const wallet = watchedWallets.get(to);

			if (!wallet) continue;

			const from = decodeAddress(log.topics[1] ?? "");
			const amountRaw = hexToBigInt(log.data);
			const saveAmountWei = computeSaveAmount(
				amountRaw,
				wallet.user.savingPercentBps ?? 0
			);

			detectedTransfers.push({
				wallet,
				fromAddress: from,
				toAddress: to,
				tokenAddress: log.address,
				txHash: log.transactionHash,
				blockNumber,
				amountRaw,
				saveAmountWei,
				log,
			});
		}
	}

	if (!detectedTransfers.length) {
		return NextResponse.json({success: true, detected: 0});
	}

	await Promise.all(
		detectedTransfers.map(async (entry) => {
			const {wallet} = entry;
			const amountDecimal = new Prisma.Decimal(
				entry.amountRaw.toString()
			);
			const saveAmountDecimal = new Prisma.Decimal(
				entry.saveAmountWei.toString()
			);

			await prisma.$transaction(async (tx) => {
				const transactionRecord = await tx.incomingTransaction.upsert({
					where: {
						txHash_walletId_tokenAddress: {
							txHash: entry.txHash,
							walletId: wallet.id,
							tokenAddress: entry.tokenAddress.toLowerCase(),
						},
					},
					create: {
						txHash: entry.txHash,
						blockNumber: entry.blockNumber ?? undefined,
						tokenAddress: entry.tokenAddress.toLowerCase(),
						fromAddress: entry.fromAddress,
						toAddress: entry.toAddress,
						amountRaw: amountDecimal,
						saveAmountWei: saveAmountDecimal,
						status: "PENDING",
						metadata: {
							logIndex: entry.log.logIndex ?? null,
							transactionIndex:
								entry.log.transactionIndex ?? null,
						},
						walletId: wallet.id,
						userId: wallet.userId,
					},
					update: {
						blockNumber: entry.blockNumber ?? undefined,
						amountRaw: amountDecimal,
						saveAmountWei: saveAmountDecimal,
						toAddress: entry.toAddress,
						fromAddress: entry.fromAddress,
						detectedAt: new Date(),
						metadata: {
							logIndex: entry.log.logIndex ?? null,
							transactionIndex:
								entry.log.transactionIndex ?? null,
						},
					},
				});

				await tx.wallet.update({
					where: {id: wallet.id},
					data: {lastDetectedAt: new Date()},
				});

				if (entry.saveAmountWei > BigInt("0")) {
					await tx.savingsLedger.upsert({
						where: {transactionId: transactionRecord.id},
						create: {
							userId: wallet.userId,
							walletId: wallet.id,
							transactionId: transactionRecord.id,
							action: "DEPOSIT_PENDING",
							amountWei: saveAmountDecimal,
							notes: "Auto-savings detected via QuickNode webhook",
						},
						update: {
							amountWei: saveAmountDecimal,
							createdAt: new Date(),
						},
					});
				}
			});
		})
	);

	return NextResponse.json({
		success: true,
		detected: detectedTransfers.length,
	});
}
