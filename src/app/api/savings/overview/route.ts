import {NextResponse} from "next/server";
import prisma from "@/lib/prisma";

const DEFAULT_LIMIT = 10;

export async function GET() {
	try {
		const [wallets, pendingTransactions, ledgerEntries, withdrawalRequests] =
			await Promise.all([
				prisma.wallet.findMany({
					include: {user: true},
					orderBy: {createdAt: "desc"},
					take: DEFAULT_LIMIT,
				}),
				prisma.incomingTransaction.findMany({
					where: {status: {in: ["PENDING", "AUTHORIZED"]}},
					orderBy: {detectedAt: "desc"},
					include: {wallet: true},
					take: DEFAULT_LIMIT,
				}),
				prisma.savingsLedger.findMany({
					orderBy: {createdAt: "desc"},
					include: {wallet: true},
					take: DEFAULT_LIMIT,
				}),
				prisma.withdrawalRequest.findMany({
					where: {status: {in: ["PENDING", "READY"]}},
					orderBy: {requestedAt: "desc"},
					include: {wallet: true},
					take: DEFAULT_LIMIT,
				}),
			]);

		const stats = {
			totalWallets: await prisma.wallet.count(),
			pendingTransactions: await prisma.incomingTransaction.count({
				where: {status: "PENDING"},
			}),
			pendingWithdrawals: await prisma.withdrawalRequest.count({
				where: {status: {in: ["PENDING", "READY"]}},
			}),
		};

		return NextResponse.json({
			success: true,
			data: {
				wallets,
				pendingTransactions,
				ledgerEntries,
				withdrawalRequests,
				stats,
			},
		});
	} catch (error) {
		console.error("Error loading savings overview:", error);
		return NextResponse.json(
			{
				success: false,
				error: "Failed to load savings overview",
			},
			{status: 500}
		);
	}
}
