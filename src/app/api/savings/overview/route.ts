import {NextRequest, NextResponse} from "next/server";
import prisma from "@/lib/prisma";

const DEFAULT_LIMIT = 50;

export async function GET(req: NextRequest) {
	try {
		// Get wallet address from query params to filter user-specific data
		const {searchParams} = new URL(req.url);
		const walletAddress = searchParams.get("address");

		if (!walletAddress) {
			return NextResponse.json(
				{
					success: false,
					error: "Wallet address is required",
				},
				{status: 400}
			);
		}

		// Find the wallet and user
		const wallet = await prisma.wallet.findUnique({
			where: {address: walletAddress.toLowerCase()},
			include: {user: true},
		});

		if (!wallet) {
			return NextResponse.json(
				{
					success: false,
					error: "Wallet not registered",
				},
				{status: 404}
			);
		}

		const userId = wallet.userId;

		// Get user-specific data
		const [
			userWallets,
			pendingTransactions,
			ledgerEntries,
			withdrawalRequests,
		] = await Promise.all([
			prisma.wallet.findMany({
				where: {userId},
				include: {user: true},
				orderBy: {createdAt: "desc"},
			}),
			prisma.incomingTransaction.findMany({
				where: {
					userId,
					status: {in: ["PENDING", "AUTHORIZED"]},
				},
				orderBy: {detectedAt: "desc"},
				include: {wallet: true},
				take: DEFAULT_LIMIT,
			}),
			prisma.savingsLedger.findMany({
				where: {userId},
				orderBy: {createdAt: "desc"},
				include: {wallet: true},
				take: DEFAULT_LIMIT,
			}),
			prisma.withdrawalRequest.findMany({
				where: {
					userId,
					status: {in: ["PENDING", "READY"]},
				},
				orderBy: {requestedAt: "desc"},
				include: {wallet: true},
				take: DEFAULT_LIMIT,
			}),
		]);

		const stats = {
			totalWallets: userWallets.length,
			pendingTransactions: await prisma.incomingTransaction.count({
				where: {userId, status: "PENDING"},
			}),
			pendingWithdrawals: await prisma.withdrawalRequest.count({
				where: {
					userId,
					status: {in: ["PENDING", "READY"]},
				},
			}),
		};

		return NextResponse.json({
			success: true,
			data: {
				user: wallet.user,
				wallets: userWallets,
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
