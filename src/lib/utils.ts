export function decodeAddress(topic: string) {
	return "0x" + topic.slice(-40).toLowerCase();
}

export function hexToBigInt(hex?: string) {
	return BigInt(hex || "0x0");
}


export const WEI = BigInt(10) ** BigInt(18);
export const walletConnectEnabled = Boolean(
	process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
);

export function getErrorMessage(error: unknown) {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	return "Unexpected error";
}

export function formatWei(value?: string | null, suffix = "CELO") {
	if (!value) return "-";
	try {
		const raw = BigInt(value);
		const whole = raw / WEI;
		const fraction = raw % WEI;
		const fracStr = fraction
			.toString()
			.padStart(18, "0")
			.slice(0, 4)
			.replace(/0+$/, "");
		return `${whole.toString()}${fracStr ? `.${fracStr}` : ""} ${suffix}`;
	} catch {
		return `${value} wei`;
	}
}

export function formatDate(value?: string | null) {
	if (!value) return "-";
	const date = new Date(value);
	return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

export function formatStatus(status?: string) {
	if (!status) return "-";
	return status
		.toLowerCase()
		.split("_")
		.map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
		.join(" ");
}