import {createWalletClient, createPublicClient, defineChain, http} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {savingsVaultAbi} from "./abi/savingsVault";

type VaultClients = {
	vaultAddress: `0x${string}`;
	walletClient: ReturnType<typeof createWalletClient>;
	publicClient: ReturnType<typeof createPublicClient>;
};

let cachedClients: VaultClients | null = null;

function getRequiredEnv(key: string): string {
	const value = process.env[key];
	if (!value) {
		throw new Error(`Missing required environment variable: ${key}`);
	}
	return value;
}

function ensureHexPrivateKey(raw: string): `0x${string}` {
	return raw.startsWith("0x") ? (raw as `0x${string}`) : (`0x${raw}` as `0x${string}`);
}

function initClients(): VaultClients {
	if (cachedClients) {
		return cachedClients;
	}

	const chainId = Number(getRequiredEnv("SAVINGS_CHAIN_ID"));
	const rpcUrl = getRequiredEnv("SAVINGS_RPC_URL");
	const vaultAddress = getRequiredEnv("SAVINGS_VAULT_ADDRESS") as `0x${string}`;
	const privateKey = ensureHexPrivateKey(getRequiredEnv("SAVINGS_RELAYER_PRIVATE_KEY"));

	const chain = defineChain({
		id: chainId,
		name: `savings-${chainId}`,
		network: `savings-${chainId}`,
		nativeCurrency: {
			name: "CELO",
			symbol: "CELO",
			decimals: 18,
		},
		rpcUrls: {
			default: {http: [rpcUrl]},
			public: {http: [rpcUrl]},
		},
	});

	const account = privateKeyToAccount(privateKey);

	const walletClient = createWalletClient({
		account,
		chain,
		transport: http(rpcUrl),
	});

	const publicClient = createPublicClient({
		chain,
		transport: http(rpcUrl),
	});

	cachedClients = {vaultAddress, walletClient, publicClient};
	return cachedClients;
}

export function getVaultClients(): VaultClients {
	return initClients();
}

export async function depositForSaver(params: {
	saver: `0x${string}`;
	amountWei: bigint;
	waitForReceipt?: boolean;
}) {
	const {vaultAddress, walletClient, publicClient} = initClients();
	const {saver, amountWei, waitForReceipt = true} = params;

	const hash = await walletClient.writeContract({
		address: vaultAddress,
		abi: savingsVaultAbi,
		functionName: "depositFor",
		args: [saver],
		value: amountWei,
	});

	if (!waitForReceipt) {
		return {hash};
	}

	const receipt = await publicClient.waitForTransactionReceipt({
		hash,
		confirmations: 1,
	});

	return {hash, receipt};
}

export async function configureSaverOnChain(params: {
	saver: `0x${string}`;
	rateBps: number;
	withdrawalDelaySeconds: number;
}) {
	const {vaultAddress, walletClient, publicClient} = initClients();
	const {saver, rateBps, withdrawalDelaySeconds} = params;

	const hash = await walletClient.writeContract({
		address: vaultAddress,
		abi: savingsVaultAbi,
		functionName: "configureFor",
		args: [saver, rateBps, withdrawalDelaySeconds],
	});

	const receipt = await publicClient.waitForTransactionReceipt({
		hash,
		confirmations: 1,
	});

	return {hash, receipt};
}

export async function requestWithdrawalOnChain(params: {
	saver: `0x${string}`;
	amountWei: bigint;
}) {
	const {vaultAddress, walletClient, publicClient} = initClients();
	const {saver, amountWei} = params;

	const hash = await walletClient.writeContract({
		address: vaultAddress,
		abi: savingsVaultAbi,
		functionName: "requestWithdrawalFor",
		args: [saver, amountWei],
	});

	const receipt = await publicClient.waitForTransactionReceipt({
		hash,
		confirmations: 1,
	});

	return {hash, receipt};
}

export async function cancelWithdrawalOnChain(saver: `0x${string}`) {
	const {vaultAddress, walletClient, publicClient} = initClients();

	const hash = await walletClient.writeContract({
		address: vaultAddress,
		abi: savingsVaultAbi,
		functionName: "cancelWithdrawalFor",
		args: [saver],
	});

	const receipt = await publicClient.waitForTransactionReceipt({
		hash,
		confirmations: 1,
	});

	return {hash, receipt};
}

export async function executeWithdrawalOnChain(saver: `0x${string}`) {
	const {vaultAddress, walletClient, publicClient} = initClients();

	const hash = await walletClient.writeContract({
		address: vaultAddress,
		abi: savingsVaultAbi,
		functionName: "executeWithdrawalFor",
		args: [saver],
	});

	const receipt = await publicClient.waitForTransactionReceipt({
		hash,
		confirmations: 1,
	});

	return {hash, receipt};
}

export async function fetchVaultAccount(saver: `0x${string}`) {
	const {vaultAddress, publicClient} = initClients();

	const data = await publicClient.readContract({
		address: vaultAddress,
		abi: savingsVaultAbi,
		functionName: "getAccount",
		args: [saver],
	});

	return {
		rateBps: Number(data[0]),
		withdrawalDelay: Number(data[1]),
		balance: BigInt(data[2]),
		totalDeposited: BigInt(data[3]),
		totalWithdrawn: BigInt(data[4]),
		pendingAmount: BigInt(data[5]),
		pendingAvailableAt: Number(data[6]),
	};
}
