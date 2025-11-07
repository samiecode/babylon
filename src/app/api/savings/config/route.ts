import {NextRequest, NextResponse} from "next/server";
import prisma from "@/lib/prisma";
import {configureSaverOnChain} from "@/lib/vaultClient";

const MAX_BPS = 50;
const MIN_WITHDRAW_SECONDS = 60 * 60; // 1 hour
const MAX_WITHDRAW_SECONDS = 365 * 24 * 60 * 60; // 1 year

function normalizeAddress(address: string): `0x${string}` {
	if (typeof address !== "string") {
		throw new Error("walletAddress must be a string");
	}
	const value = address.trim().toLowerCase();
	if (!/^0x[a-f0-9]{40}$/.test(value)) {
		throw new Error("walletAddress must be a valid 20-byte hex string");
	}
	return value as `0x${string}`;
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const {
			walletAddress,
			savingPercentBps,
			withdrawalDelaySeconds,
		} = body ?? {};


		let normalizedAddress: `0x${string}`;
		try {
			normalizedAddress = normalizeAddress(walletAddress);
		} catch (error: unknown) {
			const message =
				error instanceof Error
					? error.message
					: "Invalid wallet address";
			return NextResponse.json(
				{success: false, error: message},
				{status: 400}
			);
		}

		const percent = Number(savingPercentBps);
		if (!Number.isInteger(percent) || percent < 0 || percent > MAX_BPS) {
			return NextResponse.json(
				{
					success: false,
					error: "savingPercentBps must be between 0 and 50",
				},
				{status: 400}
			);
		}

		const delay = Number(withdrawalDelaySeconds);
		if (
			!Number.isInteger(delay) ||
			delay < MIN_WITHDRAW_SECONDS ||
			delay > MAX_WITHDRAW_SECONDS
		) {
			return NextResponse.json(
				{
					success: false,
					error: `withdrawalDelaySeconds must be between ${MIN_WITHDRAW_SECONDS} and ${MAX_WITHDRAW_SECONDS}`,
				},
				{status: 400}
			);
		}

		const wallet = await prisma.wallet.findFirst({
			where: {address: normalizedAddress},
			include: {user: true},
		});

		if (!wallet) {
			return NextResponse.json(
				{
					success: false,
					error: "Wallet not found for user",
				},
				{status: 404}
			);
		}

		const updated = await prisma.$transaction(async (tx) => {
			const user = await tx.user.update({
				where: {id: wallet.userId},
				data: {
					savingPercentBps: percent,
					withdrawalDelaySeconds: delay,
				},
			});

			const refreshedWallet = await tx.wallet.update({
				where: {id: wallet.id},
				data: {isActive: true},
				include: {user: true},
			});

			return {user, wallet: refreshedWallet};
		});

		const onChainResult = await configureSaverOnChain({
			saver: normalizedAddress,
			rateBps: percent,
			withdrawalDelaySeconds: delay,
		});

		return NextResponse.json({
			success: true,
			data: {
				user: updated.user,
				wallet: updated.wallet,
				transactionHash: onChainResult.hash,
			},
		});
	} catch (error) {
		console.error("Error configuring savings profile:", error);
		return NextResponse.json(
			{
				success: false,
				error: "Failed to configure savings profile",
			},
			{status: 500}
		);
	}
}
