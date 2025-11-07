import {NextRequest, NextResponse} from "next/server";
import prisma from "@/lib/prisma";
import {Prisma} from "@/app/generated/prisma/client";
import {
	requestWithdrawalOnChain,
	executeWithdrawalOnChain,
	cancelWithdrawalOnChain,
	fetchVaultAccount,
} from "@/lib/vaultClient";

const ACTIVE_STATUSES = ["PENDING", "READY"] as const;

function normalizeAddress(address: string): `0x${string}` {
	const value = String(address ?? "").trim().toLowerCase();
	if (!/^0x[a-f0-9]{40}$/.test(value)) {
		throw new Error("walletAddress must be a valid 20-byte hex string");
	}
	return value as `0x${string}`;
}

function nowDate() {
	return new Date();
}

function toBigInt(value: unknown): bigint | null {
	if (typeof value === "bigint") return value;
	if (typeof value === "number") return BigInt(Math.floor(value));
	if (typeof value === "string" && value.trim().length) {
		try {
			return BigInt(value);
		} catch {
			return null;
		}
	}
	return null;
}

function mergeMetadata(value: unknown): Record<string, unknown> {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		return {...(value as Record<string, unknown>)};
	}
	return {};
}

// export async function POST(req: NextRequest) {
// 	try {
// 		const body = await req.json();
// 		const action = String(body?.action || "").toLowerCase();
// 		const userId = Number(body?.userId);
// 		const amountInput = body?.amountWei;

// 		if (!["request", "execute", "cancel"].includes(action)) {
// 			return NextResponse.json(
// 				{success: false, error: "action must be request, execute, or cancel"},
// 				{status: 400}
// 			);
// 		}

// 		if (!Number.isInteger(userId) || userId <= 0) {
// 			return NextResponse.json(
// 				{success: false, error: "userId is required"},
// 				{status: 400}
// 			);
// 		}

// 		let walletAddress: `0x${string}`;
// 		try {
// 			walletAddress = normalizeAddress(body?.walletAddress);
// 		} catch (error: unknown) {
// 			const message =
// 				error instanceof Error ? error.message : "Invalid wallet address";
// 			return NextResponse.json(
// 				{success: false, error: message},
// 				{status: 400}
// 			);
// 		}

// 		const wallet = await prisma.wallet.findFirst({
// 			where: {address: walletAddress, userId},
// 			include: {user: true},
// 		});

// 		if (!wallet) {
// 			return NextResponse.json(
// 				{success: false, error: "Wallet not found for user"},
// 				{status: 404}
// 			);
// 		}

// 		if (action === "request") {
// 			const amountWei = toBigInt(amountInput);
// 			if (!amountWei || amountWei <= 0n) {
// 				return NextResponse.json(
// 					{success: false, error: "amountWei must be provided for request action"},
// 					{status: 400}
// 				);
// 			}

// 			const existing = await prisma.withdrawalRequest.findFirst({
// 				where: {
// 					walletId: wallet.id,
// 					status: {in: ACTIVE_STATUSES},
// 				},
// 			});

// 			if (existing) {
// 				return NextResponse.json(
// 					{
// 						success: false,
// 						error: "An active withdrawal request already exists for this wallet",
// 					},
// 					{status: 409}
// 				);
// 			}

// 			const onChain = await requestWithdrawalOnChain({
// 				saver: walletAddress,
// 				amountWei,
// 			});

// 			const availableAt = new Date(
// 				Date.now() + wallet.user.withdrawalDelaySeconds * 1000
// 			);

// 			const amountDecimal = new Prisma.Decimal(amountWei.toString());

// 			const record = await prisma.$transaction(async (tx) => {
// 				const withdrawal = await tx.withdrawalRequest.create({
// 					data: {
// 						userId: wallet.userId,
// 						walletId: wallet.id,
// 						amountWei: amountDecimal,
// 						status: "PENDING",
// 						availableAt,
// 						requestTxHash: onChain.hash,
// 					},
// 				});

// 				await tx.savingsLedger.create({
// 					data: {
// 						userId: wallet.userId,
// 						walletId: wallet.id,
// 						action: "WITHDRAW_REQUESTED",
// 						amountWei: amountDecimal,
// 						txHash: onChain.hash,
// 						notes: "Withdrawal request submitted on-chain",
// 					},
// 				});

// 				return withdrawal;
// 			});

// 			return NextResponse.json({
// 				success: true,
// 				data: record,
// 				transactionHash: onChain.hash,
// 			});
// 		}

// 		const pending = await prisma.withdrawalRequest.findFirst({
// 			where: {
// 				walletId: wallet.id,
// 				status: {in: ACTIVE_STATUSES},
// 			},
// 			orderBy: {requestedAt: "desc"},
// 		});

// 		if (!pending) {
// 			return NextResponse.json(
// 				{success: false, error: "No active withdrawal request for this wallet"},
// 				{status: 404}
// 			);
// 		}

// 		if (action === "cancel") {
// 			const onChain = await cancelWithdrawalOnChain(walletAddress);

// 			const updated = await prisma.$transaction(async (tx) => {
// 				const updatedRequest = await tx.withdrawalRequest.update({
// 					where: {id: pending.id},
// 					data: {
// 						status: "CANCELLED",
// 						cancelledAt: nowDate(),
// 					},
// 				});

// 				await tx.savingsLedger.create({
// 					data: {
// 						userId: wallet.userId,
// 						walletId: wallet.id,
// 						action: "WITHDRAW_CANCELLED",
// 						amountWei: pending.amountWei,
// 						txHash: onChain.hash,
// 						notes: "Withdrawal request cancelled",
// 					},
// 				});

// 				return updatedRequest;
// 			});

// 			return NextResponse.json({
// 				success: true,
// 				data: updated,
// 				transactionHash: onChain.hash,
// 			});
// 		}

// 		// action === "execute"
// 		const availableAt = pending.availableAt.getTime();
// 		if (Date.now() < availableAt) {
// 			const account = await fetchVaultAccount(walletAddress);
// 			return NextResponse.json(
// 				{
// 					success: false,
// 					error: "Withdrawal cooldown still active",
// 					pending: {
// 						amountWei: pending.amountWei,
// 						availableAt,
// 						onChainPendingAmount: account.pendingAmount.toString(),
// 						onChainAvailableAt: account.pendingAvailableAt,
// 					},
// 				},
// 				{status: 409}
// 			);
// 		}

// 		const onChain = await executeWithdrawalOnChain(walletAddress);
// 		const amountDecimal = pending.amountWei;
// 		const now = nowDate();

// 		const updated = await prisma.$transaction(async (tx) => {
// 			const completed = await tx.withdrawalRequest.update({
// 				where: {id: pending.id},
// 				data: {
// 					status: "COMPLETED",
// 					executeTxHash: onChain.hash,
// 					metadata: {
// 						...mergeMetadata(pending.metadata),
// 						completedAt: now.toISOString(),
// 					},
// 				},
// 			});

// 			await tx.savingsLedger.create({
// 				data: {
// 					userId: wallet.userId,
// 					walletId: wallet.id,
// 					action: "WITHDRAW_COMPLETED",
// 					amountWei: amountDecimal,
// 					txHash: onChain.hash,
// 					notes: "Withdrawal executed on-chain",
// 				},
// 			});

// 			return completed;
// 		});

// 		return NextResponse.json({
// 			success: true,
// 			data: updated,
// 			transactionHash: onChain.hash,
// 		});
// 	} catch (error: unknown) {
// 		console.error("Error handling withdrawal request:", error);
// 		return NextResponse.json(
// 			{
// 				success: false,
// 				error: "Failed to process withdrawal",
// 			},
// 			{status: 500}
// 		);
// 	}
// }
