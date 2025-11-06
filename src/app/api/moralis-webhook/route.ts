import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";


export async function POST(req: NextRequest) {
	const body = await req.json();
	console.log("Incoming transaction:", body);

	const tx = body.txs?.[0];
	if (!tx || !tx.toAddress || !tx.value) return NextResponse.json({ok: true});

	const amountEth = Number(tx.value) / 1e18;
	const wallet = tx.toAddress.toLowerCase();

	// Get user’s saving % from DB
	const user = await prisma.user.findUnique({where: {wallet}});
	if (!user) return NextResponse.json({ok: true});

	const savePercent = user.savePercent / 100;
	const saveAmount = amountEth * savePercent;

	console.log(
		`💰 ${wallet} received ${amountEth} ETH → saving ${saveAmount} ETH`
	);

	// OPTIONAL: trigger smart contract save
	// await saveToContract(wallet, saveAmount);

	return NextResponse.json({success: true});
}
