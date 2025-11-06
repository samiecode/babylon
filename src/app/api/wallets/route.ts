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

// GET all wallets
export async function GET() {
	try {
		const wallets = await prisma.wallet.findMany({
			orderBy: {createdAt: "desc"},
			include: {user: true},
		});

		return NextResponse.json({success: true, data: wallets});
	} catch (error) {
		console.error("Error fetching wallets:", error);
		return NextResponse.json(
			{success: false, error: "Failed to fetch wallets"},
			{status: 500}
		);
	}
}

// POST to add a new wallet
export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const {
			address,
			label,
			isActive = true,
			userId,
			chainId = 1,
		} = body;

		if (!address) {
			return NextResponse.json(
				{success: false, error: "Address is required"},
				{status: 400}
			);
		}

		if (!userId) {
			return NextResponse.json(
				{success: false, error: "userId is required"},
				{status: 400}
			);
		}

		// Normalize address to lowercase
		const normalizedAddress = address.toLowerCase();

		const wallet = await prisma.wallet.create({
			data: {
				address: normalizedAddress,
				label,
				isActive,
				chainId,
				user: {connect: {id: userId}},
			},
			include: {user: true},
		});

		return NextResponse.json({success: true, data: wallet}, {status: 201});
	} catch (error: unknown) {
		console.error("Error creating wallet:", error);

		// Handle unique constraint violation
		if (isUniqueConstraintViolation(error)) {
			return NextResponse.json(
				{success: false, error: "Wallet address already exists"},
				{status: 409}
			);
		}

		return NextResponse.json(
			{success: false, error: "Failed to create wallet"},
			{status: 500}
		);
	}
}
