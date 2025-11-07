import {NextRequest, NextResponse} from "next/server";
import prisma from "@/lib/prisma";

function isUniqueConstraintViolation(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as {code?: unknown}).code === "P2002"
	);
}

/**
 * Auto-register endpoint for wallet connections
 * Creates a user if needed and registers the wallet
 */
export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const {
			address,
			label,
			chainId = 44787, // Default to Celo Alfajores
		} = body;

		if (!address) {
			return NextResponse.json(
				{success: false, error: "Address is required"},
				{status: 400}
			);
		}

		// Normalize address to lowercase
		const normalizedAddress = address.toLowerCase();

		// Check if wallet already exists
		const existingWallet = await prisma.wallet.findUnique({
			where: {address: normalizedAddress},
			include: {user: true},
		});

		if (existingWallet) {
			return NextResponse.json(
				{
					success: true,
					data: existingWallet,
					message: "Wallet already registered",
					alreadyExists: true,
				},
				{status: 200}
			);
		}

		// Create user with wallet address as email (unique identifier)
		const userEmail = `${normalizedAddress}@wallet.babylon`;

		// Find or create user
		let user = await prisma.user.findUnique({
			where: {email: userEmail},
		});

		if (!user) {
			// Create new user with default settings
			user = await prisma.user.create({
				data: {
					email: userEmail,
					name: `User ${normalizedAddress.slice(0, 6)}`,
					savingPercentBps: 0, // User needs to configure
					withdrawalDelaySeconds: 86400, // 24 hours default
				},
			});
		}

		// Create wallet
		const wallet = await prisma.wallet.create({
			data: {
				address: normalizedAddress,
				label:
					label ||
					`Auto-registered ${new Date().toLocaleDateString()}`,
				isActive: true,
				chainId,
				userId: user.id,
			},
			include: {user: true},
		});

		return NextResponse.json(
			{
				success: true,
				data: wallet,
				message: "Wallet registered successfully",
				alreadyExists: false,
			},
			{status: 201}
		);
	} catch (error: unknown) {
		console.error("Error auto-registering wallet:", error);

		// Handle unique constraint violation
		if (isUniqueConstraintViolation(error)) {
			return NextResponse.json(
				{success: false, error: "Wallet address already exists"},
				{status: 409}
			);
		}

		return NextResponse.json(
			{success: false, error: "Failed to auto-register wallet"},
			{status: 500}
		);
	}
}
