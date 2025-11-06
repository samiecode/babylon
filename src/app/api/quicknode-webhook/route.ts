// quicknode-webhook route handler
import {NextRequest, NextResponse} from "next/server";
import prisma from "@/lib/prisma";
import {decodeAddress, hexToBigInt} from "@/lib/utils";

// ERC-20 Transfer event signature
const TRANSFER_SIG = process.env.QUICKNODE_SIGNATURE || "";

// Cache for watched addresses (refresh every 5 minutes)
let watchedAddressesCache: Set<string> | null = null;
let lastCacheUpdate = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getWatchedAddresses(): Promise<Set<string>> {
	const now = Date.now();
	if (watchedAddressesCache && now - lastCacheUpdate < CACHE_TTL) {
		return watchedAddressesCache;
	}

	const wallets = await prisma.wallet.findMany({
		where: {isActive: true},
		select: {address: true},
	});

	watchedAddressesCache = new Set(
		wallets.map((w) => w.address.toLowerCase())
	);
	lastCacheUpdate = now;

	return watchedAddressesCache;
}

export async function POST(req: NextRequest) {
	const body = await req.json();

	// Fetch watched addresses from database
	const WATCHED_ADDRESSES = await getWatchedAddresses();

	const incoming: any[] = [];

	for (const receipt of body?.data || []) {
		if (!receipt?.logs) continue;

		for (const log of receipt.logs) {
			if (log.topics?.[0]?.toLowerCase() !== TRANSFER_SIG) continue;

			const from = decodeAddress(log.topics[1]);
			const to = decodeAddress(log.topics[2]);
			const amountRaw = hexToBigInt(log.data);

			if (WATCHED_ADDRESSES.has(to)) {
				incoming.push({
					token: log.address,
					from,
					to,
					amountRaw: amountRaw.toString(),
					txHash: log.transactionHash,
					block: receipt.blockNumber,
				});
			}
		}
	}

	if (incoming.length > 0) {
		console.log("💸 Incoming transfers detected:", incoming);
		// Optionally store to DB, send Slack alert, etc.
	} else {
		console.log("No transaction:");
	}

	return NextResponse.json({success: true, detected: incoming.length});
}
