export type Wallet = {
	id: number;
	address: string;
	label?: string | null;
	isActive: boolean;
	chainId: number;
	createdAt: string;
	userId: number;
	user: {
		id: number;
		email: string;
		name?: string | null;
	};
};

export type IncomingTransaction = {
	id: number;
	txHash: string;
	tokenAddress: string;
	fromAddress: string;
	toAddress: string;
	amountRaw: string;
	saveAmountWei: string;
	status: string;
	detectedAt: string;
	wallet: Wallet;
};

export type LedgerEntry = {
	id: number;
	action: string;
	amountWei: string;
	txHash?: string | null;
	createdAt: string;
	notes?: string | null;
	wallet: Wallet;
};

export type WithdrawalRequest = {
	id: number;
	amountWei: string;
	status: string;
	availableAt: string;
	requestedAt: string;
	requestTxHash?: string | null;
	wallet: Wallet;
};

export type OverviewPayload = {
	user: {
		id: number;
		email: string;
		name?: string | null;
		savingPercentBps: number;
		withdrawalDelaySeconds: number;
	};
	wallets: Wallet[];
	pendingTransactions: IncomingTransaction[];
	ledgerEntries: LedgerEntry[];
	withdrawalRequests: WithdrawalRequest[];
	stats: {
		totalWallets: number;
		pendingTransactions: number;
		pendingWithdrawals: number;
	};
};

export type ApiResponse<T> = {
	success: boolean;
	data?: T;
	error?: string;
};

export type Toast = {message: string; type: "success" | "error"};
