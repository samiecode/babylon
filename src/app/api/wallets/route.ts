import {NextRequest, NextResponse} from "next/server";
import prisma from "@/lib/prisma";

// GET all wallets
export async function GET() {
	try {
		const wallets = await prisma.wallet.findMany({
			orderBy: {createdAt: "desc"},
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
		const {address, label, isActive = true} = body;

		if (!address) {
			return NextResponse.json(
				{success: false, error: "Address is required"},
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
			},
		});

		return NextResponse.json({success: true, data: wallet}, {status: 201});
	} catch (error: any) {
		console.error("Error creating wallet:", error);

		// Handle unique constraint violation
		if (error.code === "P2002") {
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
