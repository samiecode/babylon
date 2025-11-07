"use client";

import {FormEvent, useEffect, useMemo, useState} from "react";
import {AppKitButton} from "@reown/appkit/react";

type Wallet = {
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

type IncomingTransaction = {
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

type LedgerEntry = {
	id: number;
	action: string;
	amountWei: string;
	txHash?: string | null;
	createdAt: string;
	notes?: string | null;
	wallet: Wallet;
};

type WithdrawalRequest = {
	id: number;
	amountWei: string;
	status: string;
	availableAt: string;
	requestedAt: string;
	requestTxHash?: string | null;
	wallet: Wallet;
};

type OverviewPayload = {
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

type ApiResponse<T> = {
	success: boolean;
	data?: T;
	error?: string;
};

const WEI = BigInt(10) ** BigInt(18);
const walletConnectEnabled = Boolean(
	process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
);

function getErrorMessage(error: unknown) {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	return "Unexpected error";
}

function formatWei(value?: string | null, suffix = "CELO") {
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

function formatDate(value?: string | null) {
	if (!value) return "-";
	const date = new Date(value);
	return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

function formatStatus(status?: string) {
	if (!status) return "-";
	return status
		.toLowerCase()
		.split("_")
		.map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
		.join(" ");
}

type Toast = {message: string; type: "success" | "error"};

export default function Dashboard() {
	const [overview, setOverview] = useState<OverviewPayload | null>(null);
	const [loading, setLoading] = useState(true);
	const [toast, setToast] = useState<Toast | null>(null);

	const [walletForm, setWalletForm] = useState({
		userId: "",
		address: "",
		label: "",
		chainId: "44787",
	});
	const [configForm, setConfigForm] = useState({
		userId: "",
		walletAddress: "",
		savingPercentBps: "500",
		withdrawalDelaySeconds: "86400",
	});
	const [authorizationForm, setAuthorizationForm] = useState({
		transactionId: "",
		action: "approve",
		amountWei: "",
		reason: "",
	});
	const [withdrawForm, setWithdrawForm] = useState({
		action: "request",
		userId: "",
		walletAddress: "",
		amountWei: "",
	});

	const [submitting, setSubmitting] = useState({
		wallet: false,
		config: false,
		authorize: false,
		withdraw: false,
	});

	const activeWallets = useMemo(
		() => overview?.wallets?.filter((wallet) => wallet.isActive) ?? [],
		[overview?.wallets]
	);

	useEffect(() => {
		void refreshOverview();
	}, []);

	async function refreshOverview() {
		setLoading(true);
		try {
			const res = await fetch("/api/savings/overview");
			const json: ApiResponse<OverviewPayload> = await res.json();
			if (!res.ok || !json.success || !json.data) {
				throw new Error(json.error || "Failed to load overview");
			}
			setOverview(json.data);
		} catch (error: unknown) {
			const message = getErrorMessage(error);
			console.error(error);
			setToast({message, type: "error"});
		} finally {
			setLoading(false);
		}
	}

	async function handleSubmit(
		key: keyof typeof submitting,
		fn: () => Promise<void>
	) {
		setSubmitting((prev) => ({...prev, [key]: true}));
		try {
			await fn();
			await refreshOverview();
		} catch (error: unknown) {
			const message = getErrorMessage(error);
			console.error(error);
			setToast({
				message,
				type: "error",
			});
		} finally {
			setSubmitting((prev) => ({...prev, [key]: false}));
		}
	}

	const onAddWallet = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		return handleSubmit("wallet", async () => {
			const response = await fetch("/api/wallets", {
				method: "POST",
				headers: {"Content-Type": "application/json"},
				body: JSON.stringify({
					userId: Number(walletForm.userId),
					address: walletForm.address,
					label: walletForm.label,
					chainId: Number(walletForm.chainId),
					isActive: true,
				}),
			});
			const json = await response.json();
			if (!response.ok) {
				throw new Error(json.error || "Failed to add wallet");
			}
			setWalletForm({
				userId: "",
				address: "",
				label: "",
				chainId: walletForm.chainId,
			});
			setToast({message: "Wallet registered", type: "success"});
		});
	};

	const onConfigureSavings = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		return handleSubmit("config", async () => {
			const response = await fetch("/api/savings/config", {
				method: "POST",
				headers: {"Content-Type": "application/json"},
				body: JSON.stringify({
					userId: Number(configForm.userId),
					walletAddress: configForm.walletAddress,
					savingPercentBps: Number(configForm.savingPercentBps),
					withdrawalDelaySeconds: Number(configForm.withdrawalDelaySeconds),
				}),
			});
			const json = await response.json();
			if (!response.ok) {
				throw new Error(json.error || "Failed to configure savings");
			}
			setToast({message: "Savings preferences updated", type: "success"});
		});
	};

	const onAuthorizeTransaction = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		return handleSubmit("authorize", async () => {
			const response = await fetch("/api/savings/authorize", {
				method: "POST",
				headers: {"Content-Type": "application/json"},
				body: JSON.stringify({
					transactionId: Number(authorizationForm.transactionId),
					action: authorizationForm.action,
					amountWei: authorizationForm.amountWei || undefined,
					reason: authorizationForm.reason || undefined,
				}),
			});
			const json = await response.json();
			if (!response.ok) {
				throw new Error(json.error || "Failed to process authorization");
			}
			setAuthorizationForm({
				transactionId: "",
				action: "approve",
				amountWei: "",
				reason: "",
			});
			setToast({message: "Transaction processed", type: "success"});
		});
	};

	const onWithdrawAction = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		return handleSubmit("withdraw", async () => {

			const response = await fetch("/api/savings/withdraw", {
				method: "POST",
				headers: {"Content-Type": "application/json"},
				body: JSON.stringify({
					...withdrawForm,
					userId: Number(withdrawForm.userId),
					amountWei:
						withdrawForm.action === "request"
							? withdrawForm.amountWei
							: undefined,
				}),
			});
			const json = await response.json();
			if (!response.ok) {
				throw new Error(json.error || "Failed to process withdrawal");
			}
			setToast({message: "Withdrawal flow updated", type: "success"});
		});
	};

	return (
		<div className="min-h-screen bg-gray-50 px-4 py-10 text-gray-900">
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
				<header className="flex flex-col gap-2">
					<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
						<h1 className="text-3xl font-semibold">Babylon Savings Console</h1>
						<div className="flex flex-col gap-2 text-right sm:flex-row sm:items-center">
							{walletConnectEnabled ? (
								<AppKitButton label="Connect Wallet" balance="hide" />
							) : (
								<span className="text-xs text-gray-500">
									Add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to enable WalletConnect
								</span>
							)}
							<button
								onClick={() => refreshOverview()}
								className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-white"
								type="button"
							>
								Refresh
							</button>
						</div>
					</div>
					<p className="text-sm text-gray-600">
						Configure wallets, approve deposits, and orchestrate withdrawals
						directly from the dashboard.
					</p>
				</header>

				{toast ? (
					<div
						className={`rounded-md border px-4 py-2 text-sm ${
							toast.type === "success"
								? "border-green-200 bg-green-50 text-green-800"
								: "border-red-200 bg-red-50 text-red-800"
						}`}
					>
						<div className="flex items-center justify-between">
							<span>{toast.message}</span>
							<button
								onClick={() => setToast(null)}
								className="text-xs uppercase tracking-wide"
								type="button"
							>
								Dismiss
							</button>
						</div>
					</div>
				) : null}

				<section className="grid grid-cols-1 gap-4 md:grid-cols-3">
					<StatCard
						label="Tracked wallets"
						value={
							loading
								? "Loading..."
								: overview?.stats.totalWallets.toString() ?? "0"
						}
					/>
					<StatCard
						label="Pending auto-saves"
						value={
							loading
								? "Loading..."
								: overview?.stats.pendingTransactions.toString() ?? "0"
						}
					/>
					<StatCard
						label="Pending withdrawals"
						value={
							loading
								? "Loading..."
								: overview?.stats.pendingWithdrawals.toString() ?? "0"
						}
					/>
				</section>

				<section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
					<Card title="Register Wallet" description="Track a new Celo wallet">
						<form className="flex flex-col gap-3" onSubmit={onAddWallet}>
							<input
								required
								type="number"
								min="1"
								value={walletForm.userId}
								onChange={(e) =>
									setWalletForm((prev) => ({...prev, userId: e.target.value}))
								}
								placeholder="User ID"
								className="rounded-md border border-gray-300 px-3 py-2 text-sm"
							/>
							<input
								required
								value={walletForm.address}
								onChange={(e) =>
									setWalletForm((prev) => ({...prev, address: e.target.value}))
								}
								placeholder="Wallet address"
								className="rounded-md border border-gray-300 px-3 py-2 text-sm"
							/>
							<input
								value={walletForm.label}
								onChange={(e) =>
									setWalletForm((prev) => ({...prev, label: e.target.value}))
								}
								placeholder="Label (optional)"
								className="rounded-md border border-gray-300 px-3 py-2 text-sm"
							/>
							<input
								required
								type="number"
								value={walletForm.chainId}
								onChange={(e) =>
									setWalletForm((prev) => ({...prev, chainId: e.target.value}))
								}
								placeholder="Chain ID (e.g. 44787)"
								className="rounded-md border border-gray-300 px-3 py-2 text-sm"
							/>
							<button
								type="submit"
								className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
								disabled={submitting.wallet}
							>
								{submitting.wallet ? "Registering..." : "Register wallet"}
							</button>
						</form>
					</Card>

					<Card
						title="Savings Preferences"
						description="Update saving % and withdrawal lock"
					>
						<form className="flex flex-col gap-3" onSubmit={onConfigureSavings}>
							<input
								required
								type="number"
								min="1"
								value={configForm.userId}
								onChange={(e) =>
									setConfigForm((prev) => ({...prev, userId: e.target.value}))
								}
								placeholder="User ID"
								className="rounded-md border border-gray-300 px-3 py-2 text-sm"
							/>
							<input
								required
								value={configForm.walletAddress}
								onChange={(e) =>
									setConfigForm((prev) => ({
										...prev,
										walletAddress: e.target.value,
									}))
								}
								placeholder="Wallet address"
								className="rounded-md border border-gray-300 px-3 py-2 text-sm"
							/>
							<label className="text-xs font-medium text-gray-600">
								Saving percentage (basis points)
							</label>
							<input
								required
								type="number"
								min="0"
								max="10000"
								value={configForm.savingPercentBps}
								onChange={(e) =>
									setConfigForm((prev) => ({
										...prev,
										savingPercentBps: e.target.value,
									}))
								}
								className="rounded-md border border-gray-300 px-3 py-2 text-sm"
							/>
							<label className="text-xs font-medium text-gray-600">
								Withdrawal delay (seconds)
							</label>
							<input
								required
								type="number"
								min="3600"
								value={configForm.withdrawalDelaySeconds}
								onChange={(e) =>
									setConfigForm((prev) => ({
										...prev,
										withdrawalDelaySeconds: e.target.value,
									}))
								}
								className="rounded-md border border-gray-300 px-3 py-2 text-sm"
							/>
							<button
								type="submit"
								className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
								disabled={submitting.config}
							>
								{submitting.config ? "Saving..." : "Save preferences"}
							</button>
						</form>
					</Card>
				</section>

				<section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
					<Card
						title="Authorization"
						description="Approve or reject pending auto-save transactions"
					>
						<form className="flex flex-col gap-3" onSubmit={onAuthorizeTransaction}>
							<select
								required
								value={authorizationForm.transactionId}
								onChange={(e) =>
									setAuthorizationForm((prev) => ({
										...prev,
										transactionId: e.target.value,
									}))
								}
								className="rounded-md border border-gray-300 px-3 py-2 text-sm"
							>
								<option value="">Select a pending transaction</option>
								{overview?.pendingTransactions.map((tx) => (
									<option key={tx.id} value={tx.id}>
										#{tx.id} · {tx.wallet.label ?? tx.wallet.address.slice(0, 6)} ·{" "}
										{formatWei(tx.saveAmountWei)}
									</option>
								))}
							</select>
							<select
								value={authorizationForm.action}
								onChange={(e) =>
									setAuthorizationForm((prev) => ({
										...prev,
										action: e.target.value,
									}))
								}
								className="rounded-md border border-gray-300 px-3 py-2 text-sm"
							>
								<option value="approve">Approve & fund</option>
								<option value="reject">Reject</option>
							</select>
							<input
								value={authorizationForm.amountWei}
								onChange={(e) =>
									setAuthorizationForm((prev) => ({
										...prev,
										amountWei: e.target.value,
									}))
								}
								placeholder="Override amount (wei, optional)"
								className="rounded-md border border-gray-300 px-3 py-2 text-sm"
							/>
							<textarea
								value={authorizationForm.reason}
								onChange={(e) =>
									setAuthorizationForm((prev) => ({
										...prev,
										reason: e.target.value,
									}))
								}
								placeholder="Rejection note (optional)"
								className="min-h-[80px] rounded-md border border-gray-300 px-3 py-2 text-sm"
							/>
							<button
								type="submit"
								className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
								disabled={submitting.authorize}
							>
								{submitting.authorize ? "Processing..." : "Submit decision"}
							</button>
						</form>
					</Card>

					<Card
						title="Withdrawals"
						description="Request, cancel, or execute withdrawals"
					>
						<form className="flex flex-col gap-3" onSubmit={onWithdrawAction}>
							<select
								value={withdrawForm.action}
								onChange={(e) =>
									setWithdrawForm((prev) => ({
										...prev,
										action: e.target.value,
									}))
								}
								className="rounded-md border border-gray-300 px-3 py-2 text-sm"
							>
								<option value="request">Request withdrawal</option>
								<option value="execute">Execute withdrawal</option>
								<option value="cancel">Cancel withdrawal</option>
							</select>
							<input
								required
								type="number"
								min="1"
								value={withdrawForm.userId}
								onChange={(e) =>
									setWithdrawForm((prev) => ({
										...prev,
										userId: e.target.value,
									}))
								}
								placeholder="User ID"
								className="rounded-md border border-gray-300 px-3 py-2 text-sm"
							/>
							<select
								required
								value={withdrawForm.walletAddress}
								onChange={(e) =>
									setWithdrawForm((prev) => ({
										...prev,
										walletAddress: e.target.value,
									}))
								}
								className="rounded-md border border-gray-300 px-3 py-2 text-sm"
							>
								<option value="">Choose wallet</option>
								{activeWallets.map((wallet) => (
									<option key={wallet.id} value={wallet.address}>
										{wallet.label ?? wallet.address} · User {wallet.userId}
									</option>
								))}
							</select>
							{withdrawForm.action === "request" ? (
								<input
									required
									value={withdrawForm.amountWei}
									onChange={(e) =>
										setWithdrawForm((prev) => ({
											...prev,
											amountWei: e.target.value,
										}))
									}
									placeholder="Amount in wei"
									className="rounded-md border border-gray-300 px-3 py-2 text-sm"
								/>
							) : null}
							<button
								type="submit"
								className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
								disabled={submitting.withdraw}
							>
								{submitting.withdraw ? "Submitting..." : "Run action"}
							</button>
						</form>
					</Card>
				</section>

				<section className="grid grid-cols-1 gap-6">
					<DataCard
						title="Recent Wallets"
						emptyLabel="No wallets yet"
						headers={["User", "Address", "Label", "Created"]}
						rows={
							overview?.wallets.map((wallet) => [
								wallet.user.email,
								wallet.address,
								wallet.label ?? "-",
								formatDate(wallet.createdAt),
							]) ?? []
						}
					/>
					<DataCard
						title="Pending Auto-Saves"
						emptyLabel="No pending transfers"
						headers={["Tx", "Wallet", "Amount", "Status", "Detected"]}
						rows={
							overview?.pendingTransactions.map((tx) => [
								tx.txHash.slice(0, 10) + "...",
								tx.wallet.label ?? tx.wallet.address,
								formatWei(tx.saveAmountWei),
								formatStatus(tx.status),
								formatDate(tx.detectedAt),
							]) ?? []
						}
					/>
					<DataCard
						title="Active Withdrawals"
						emptyLabel="No pending withdrawals"
						headers={["Wallet", "Amount", "Status", "Available"]}
						rows={
							overview?.withdrawalRequests.map((request) => [
								request.wallet.label ?? request.wallet.address,
								formatWei(request.amountWei),
								formatStatus(request.status),
								formatDate(request.availableAt),
							]) ?? []
						}
					/>
					<DataCard
						title="Latest Ledger Entries"
						emptyLabel="No ledger entries"
						headers={["Wallet", "Action", "Amount", "Notes", "Created"]}
						rows={
							overview?.ledgerEntries.map((entry) => [
								entry.wallet.label ?? entry.wallet.address,
								formatStatus(entry.action),
								formatWei(entry.amountWei),
								entry.notes ?? "-",
								formatDate(entry.createdAt),
							]) ?? []
						}
					/>
				</section>
			</div>
		</div>
	);
}

function StatCard({label, value}: {label: string; value: string}) {
	return (
		<div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
			<p className="text-xs uppercase text-gray-500">{label}</p>
			<p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
		</div>
	);
}

function Card({
	title,
	description,
	children,
}: {
	title: string;
	description: string;
	children: React.ReactNode;
}) {
	return (
		<div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
			<div className="mb-4">
				<h3 className="text-lg font-semibold">{title}</h3>
				<p className="text-sm text-gray-600">{description}</p>
			</div>
			{children}
		</div>
	);
}

function DataCard({
	title,
	headers,
	rows,
	emptyLabel,
}: {
	title: string;
	headers: string[];
	rows: Array<string[]>;
	emptyLabel: string;
}) {
	return (
		<div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
			<h3 className="text-lg font-semibold">{title}</h3>
			{rows.length === 0 ? (
				<p className="mt-4 text-sm text-gray-500">{emptyLabel}</p>
			) : (
				<div className="mt-4 overflow-x-auto">
					<table className="min-w-full text-left text-sm">
						<thead>
							<tr>
								{headers.map((header) => (
									<th
										key={header}
										className="border-b border-gray-200 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500"
									>
										{header}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{rows.map((row, idx) => (
								<tr key={`${row[0]}-${idx}`} className="even:bg-gray-50/40">
									{row.map((value, cellIdx) => (
										<td key={`${value}-${cellIdx}`} className="px-2 py-2">
											{value}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
