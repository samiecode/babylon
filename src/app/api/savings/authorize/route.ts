import {NextRequest, NextResponse} from "next/server";
import prisma from "@/lib/prisma";
import {Prisma} from "@/app/generated/prisma/client";
import {depositForSaver} from "@/lib/vaultClient";

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
// 		const transactionId = Number(body?.transactionId);
// 		const action = String(body?.action || "").toLowerCase();
// 		const overrideAmount = toBigInt(body?.amountWei);
// 		const rejectionReason = body?.reason ? String(body.reason) : null;

// 		if (!Number.isInteger(transactionId) || transactionId <= 0) {
// 			return NextResponse.json(
// 				{success: false, error: "transactionId is required"},
// 				{status: 400}
// 			);
// 		}

// 		if (!["approve", "reject"].includes(action)) {
// 			return NextResponse.json(
// 				{success: false, error: "action must be either approve or reject"},
// 				{status: 400}
// 			);
// 		}

// 		const transactionRecord = await prisma.incomingTransaction.findUnique({
// 			where: {id: transactionId},
// 			include: {
// 				wallet: {include: {user: true}},
// 				ledgerEntry: true,
// 			},
// 		});

// 		if (!transactionRecord) {
// 			return NextResponse.json(
// 				{success: false, error: "Transaction not found"},
// 				{status: 404}
// 			);
// 		}

// 		if (transactionRecord.status !== "PENDING") {
// 			return NextResponse.json(
// 				{
// 					success: false,
// 					error: `Transaction already processed with status ${transactionRecord.status}`,
// 				},
// 				{status: 400}
// 			);
// 		}

// 		const walletAddress = transactionRecord.wallet.address as `0x${string}`;

// 		if (action === "reject") {
// 			const now = new Date();
// 			const updated = await prisma.$transaction(async (tx) => {
// 				const txRecord = await tx.incomingTransaction.update({
// 					where: {id: transactionRecord.id},
// 					data: {
// 						status: "REJECTED",
// 						rejectedAt: now,
// 						metadata: {
// 							...mergeMetadata(transactionRecord.metadata),
// 							rejectionReason: rejectionReason ?? "User declined auto-save",
// 						},
// 					},
// 				});

// 				await tx.savingsLedger.upsert({
// 					where: {transactionId: transactionRecord.id},
// 					create: {
// 						transactionId: transactionRecord.id,
// 						userId: transactionRecord.userId,
// 						walletId: transactionRecord.walletId,
// 						action: "DEPOSIT_FAILED",
// 						amountWei: transactionRecord.saveAmountWei,
// 						notes:
// 							rejectionReason ??
// 							"Auto-savings rejected before funding transaction",
// 					},
// 					update: {
// 						action: "DEPOSIT_FAILED",
// 						notes:
// 							rejectionReason ??
// 							"Auto-savings rejected before funding transaction",
// 						createdAt: now,
// 					},
// 				});

// 				return txRecord;
// 			});

// 			return NextResponse.json({success: true, data: updated});
// 		}

// 		const amountWei =
// 			overrideAmount ??
// 			toBigInt(transactionRecord.saveAmountWei.toString()) ??
// 			0n;

// 		if (amountWei <= 0n) {
// 			return NextResponse.json(
// 				{
// 					success: false,
// 					error: "amountWei must be greater than zero",
// 				},
// 				{status: 400}
// 			);
// 		}

// 		const onChain = await depositForSaver({
// 			saver: walletAddress,
// 			amountWei,
// 		});

// 		const now = new Date();
// 		const amountDecimal = new Prisma.Decimal(amountWei.toString());

// 		const updated = await prisma.$transaction(async (tx) => {
// 			const txRecord = await tx.incomingTransaction.update({
// 				where: {id: transactionRecord.id},
// 				data: {
// 					status: "FUNDED",
// 					authorizedAt: now,
// 					fundedAt: now,
// 					vaultTxHash: onChain.hash,
// 					saveAmountWei: amountDecimal,
// 				},
// 			});

// 			await tx.savingsLedger.upsert({
// 				where: {transactionId: transactionRecord.id},
// 				create: {
// 					transactionId: transactionRecord.id,
// 					userId: transactionRecord.userId,
// 					walletId: transactionRecord.walletId,
// 					action: "DEPOSIT_CONFIRMED",
// 					amountWei: amountDecimal,
// 					txHash: onChain.hash,
// 					notes: "Auto-savings funded on-chain",
// 				},
// 				update: {
// 					action: "DEPOSIT_CONFIRMED",
// 					amountWei: amountDecimal,
// 					txHash: onChain.hash,
// 					notes: "Auto-savings funded on-chain",
// 					createdAt: now,
// 				},
// 			});

// 			return txRecord;
// 		});

// 		return NextResponse.json({
// 			success: true,
// 			data: updated,
// 			transactionHash: onChain.hash,
// 		});
// 	} catch (error) {
// 		console.error("Error processing savings authorization:", error);
// 		return NextResponse.json(
// 			{
// 				success: false,
// 				error: "Failed to process savings authorization",
// 			},
// 			{status: 500}
// 		);
// 	}
// }
