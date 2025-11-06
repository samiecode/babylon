export function decodeAddress(topic: string) {
	return "0x" + topic.slice(-40).toLowerCase();
}

export function hexToBigInt(hex?: string) {
	return BigInt(hex || "0x0");
}
