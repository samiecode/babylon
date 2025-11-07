"use client";

import {FormEvent, useCallback, useEffect, useMemo, useState} from "react";
import {AppKitButton} from "@reown/appkit/react";
import {useAccount} from "wagmi";
import type {ApiResponse, OverviewPayload, Toast} from "@/types";
import {
	getErrorMessage,
	walletConnectEnabled,
	formatWei,
	formatDate,
	formatStatus,
} from "@/lib/utils";

export default function Dashboard() {
	const {address: connectedAddress, isConnected} = useAccount();
	const [overview, setOverview] = useState<OverviewPayload | null>(null);
	const [loading, setLoading] = useState(true);
	const [toast, setToast] = useState<Toast | null>(null);
	const [autoRegisterAttempted, setAutoRegisterAttempted] = useState(false);

	const [configForm, setConfigForm] = useState({
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

	const refreshOverview = useCallback(async () => {
		if (!connectedAddress) {
			// Don't load overview if no wallet is connected
			setLoading(false);
			return;
		}

		setLoading(true);
		try {
			const res = await fetch(
				`/api/savings/overview?address=${connectedAddress}`
			);
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
	}, [connectedAddress]);

	useEffect(() => {
		if (isConnected && connectedAddress) {
			void refreshOverview();
		}
	}, [isConnected, connectedAddress, refreshOverview]);

	// Auto-register wallet when user connects
	useEffect(() => {
		if (!isConnected || !connectedAddress || autoRegisterAttempted) {
			return;
		}

		const autoRegisterWallet = async () => {
			try {
				// Check if wallet already exists in overview
				const walletExists = overview?.wallets?.some(
					(w) =>
						w.address.toLowerCase() ===
						connectedAddress.toLowerCase()
				);

				if (walletExists) {
					setToast({
						message: "Wallet already registered",
						type: "success",
					});
					return;
				}

				// Auto-register using the dedicated endpoint
				const response = await fetch("/api/wallets/auto-register", {
					method: "POST",
					headers: {"Content-Type": "application/json"},
					body: JSON.stringify({
						address: connectedAddress,
						label: `Auto-registered ${new Date().toLocaleDateString()}`,
						chainId: 44787, // Celo Alfajores
					}),
				});

				const json = await response.json();

				if (!response.ok) {
					// If it's a duplicate error, that's okay
					if (json.error?.includes("already exists")) {
						setToast({
							message: "Wallet already registered",
							type: "success",
						});
					} else {
						throw new Error(
							json.error || "Failed to auto-register wallet"
						);
					}
				} else {
					if (json.alreadyExists) {
						setToast({
							message: "Wallet already registered",
							type: "success",
						});
					} else {
						setToast({
							message: `🎉 Wallet ${connectedAddress.slice(
								0,
								6
							)}...${connectedAddress.slice(
								-4
							)} registered! Configure your savings settings below.`,
							type: "success",
						});
					}
					await refreshOverview();
				}
			} catch (error: unknown) {
				const message = getErrorMessage(error);
				console.error("Auto-register error:", error);
				setToast({
					message: `Auto-register failed: ${message}`,
					type: "error",
				});
			} finally {
				setAutoRegisterAttempted(true);
			}
		};

		// Wait a bit for overview to load first
		const timer = setTimeout(() => {
			void autoRegisterWallet();
		}, 1000);

		return () => clearTimeout(timer);
	}, [
		isConnected,
		connectedAddress,
		overview?.wallets,
		autoRegisterAttempted,
		refreshOverview,
	]);

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

	const onConfigureSavings = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		return handleSubmit("config", async () => {
			if (!connectedAddress) {
				throw new Error("Please connect your wallet first");
			}

			const response = await fetch("/api/savings/config", {
				method: "POST",
				headers: {"Content-Type": "application/json"},
				body: JSON.stringify({
					walletAddress: connectedAddress,
					savingPercentBps: Number(configForm.savingPercentBps),
					withdrawalDelaySeconds: Number(
						configForm.withdrawalDelaySeconds
					),
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
				throw new Error(
					json.error || "Failed to process authorization"
				);
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
			if (!connectedAddress || !overview?.user) {
				throw new Error("Please connect your wallet first");
			}

			const response = await fetch("/api/savings/withdraw", {
				method: "POST",
				headers: {"Content-Type": "application/json"},
				body: JSON.stringify({
					action: withdrawForm.action,
					userId: overview.user.id,
					walletAddress:
						withdrawForm.walletAddress || connectedAddress,
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
						<div>
							<h1 className="text-3xl font-semibold">
								Saviumy
							</h1>
							{overview?.user && (
								<p className="mt-1 text-sm text-gray-600">
									Welcome,{" "}
									{overview.user.name || overview.user.email}
								</p>
							)}
						</div>
						<div className="flex flex-col gap-2 text-right sm:flex-row sm:items-center">
							{walletConnectEnabled ? (
								<AppKitButton
									label="Connect Wallet"
									balance="hide"
								/>
							) : (
								<span className="text-xs text-gray-500">
									Add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to
									enable WalletConnect
								</span>
							)}
							<button
								onClick={() => refreshOverview()}
								className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-white"
								type="button"
								disabled={!connectedAddress}
							>
								Refresh
							</button>
						</div>
					</div>
					{isConnected && connectedAddress && (
						<div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
							<span className="font-medium">✓ Connected:</span>{" "}
							<code className="rounded bg-blue-100 px-1 py-0.5">
								{connectedAddress}
							</code>
						</div>
					)}
					{!isConnected && (
						<div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
							<span className="font-medium">
								⚠️ Please connect your wallet to view your
								savings dashboard
							</span>
						</div>
					)}
					<p className="text-sm text-gray-600">
						Manage your auto-savings, approve deposits, and withdraw
						your funds.
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
						label="My wallets"
						value={
							!isConnected
								? "-"
								: loading
								? "Loading..."
								: overview?.stats.totalWallets.toString() ?? "0"
						}
					/>
					<StatCard
						label="Pending auto-saves"
						value={
							!isConnected
								? "-"
								: loading
								? "Loading..."
								: overview?.stats.pendingTransactions.toString() ??
								  "0"
						}
					/>
					<StatCard
						label="Pending withdrawals"
						value={
							!isConnected
								? "-"
								: loading
								? "Loading..."
								: overview?.stats.pendingWithdrawals.toString() ??
								  "0"
						}
					/>
				</section>

				<section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
					{/* <Card
						title="Register Wallet"
						description="Track a new Celo wallet"
					>
						<form
							className="flex flex-col gap-3"
							onSubmit={onAddWallet}
						>
							<input
								required
								type="number"
								min="1"
								value={walletForm.userId}
								onChange={(e) =>
									setWalletForm((prev) => ({
										...prev,
										userId: e.target.value,
									}))
								}
								placeholder="User ID"
								className="rounded-md border border-gray-300 px-3 py-2 text-sm"
							/>
							<input
								value={walletForm.address}
								onChange={(e) =>
									setWalletForm((prev) => ({
										...prev,
										address: e.target.value,
									}))
								}
								placeholder={
									connectedAddress
										? `Connected: ${connectedAddress.slice(
												0,
												8
										  )}...${connectedAddress.slice(-6)}`
										: "Wallet address (or connect wallet)"
								}
								className="rounded-md border border-gray-300 px-3 py-2 text-sm"
							/>
							{connectedAddress && !walletForm.address && (
								<p className="text-xs text-gray-500">
									💡 Connected wallet will be used if you
									leave this blank
								</p>
							)}
							<input
								value={walletForm.label}
								onChange={(e) =>
									setWalletForm((prev) => ({
										...prev,
										label: e.target.value,
									}))
								}
								placeholder="Label (optional)"
								className="rounded-md border border-gray-300 px-3 py-2 text-sm"
							/>
							<input
								required
								type="number"
								value={walletForm.chainId}
								onChange={(e) =>
									setWalletForm((prev) => ({
										...prev,
										chainId: e.target.value,
									}))
								}
								placeholder="Chain ID (e.g. 44787)"
								className="rounded-md border border-gray-300 px-3 py-2 text-sm"
							/>
							<button
								type="submit"
								className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
								disabled={submitting.wallet}
							>
								{submitting.wallet
									? "Registering..."
									: "Register wallet"}
							</button>
						</form>
					</Card> */}

					<Card
						title="Savings Preferences"
						description="Configure your auto-savings percentage and withdrawal lock period"
					>
						<form
							className="flex flex-col gap-3"
							onSubmit={onConfigureSavings}
						>
							<label className="text-xs font-medium text-gray-600">
								Saving percentage (0-50%)
							</label>
							<input
								required
								type="number"
								min="0"
								max="50"
								step="0.01"
								value={configForm.savingPercentBps}
								onChange={(e) =>
									setConfigForm((prev) => ({
										...prev,
										savingPercentBps: e.target.value,
									}))
								}
								placeholder="e.g., 10 for 10%"
								className="rounded-md border border-gray-300 px-3 py-2 text-sm"
							/>
							<p className="text-xs text-gray-500">
								Percentage of each incoming transfer to
								auto-save
							</p>
							<label className="text-xs font-medium text-gray-600">
								Withdrawal lock period (hours)
							</label>
							<input
								required
								type="number"
								min="1"
								value={Math.floor(
									Number(configForm.withdrawalDelaySeconds) /
										3600
								)}
								onChange={(e) =>
									setConfigForm((prev) => ({
										...prev,
										withdrawalDelaySeconds: String(
											Number(e.target.value) * 3600
										),
									}))
								}
								placeholder="e.g., 24 for 1 day"
								className="rounded-md border border-gray-300 px-3 py-2 text-sm"
							/>
							<p className="text-xs text-gray-500">
								How long to wait before you can withdraw
								(minimum 1 hour)
							</p>
							<button
								type="submit"
								className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
								disabled={submitting.config || !isConnected}
							>
								{submitting.config
									? "Saving..."
									: "Save preferences"}
							</button>
						</form>
					</Card>
				</section>

				<section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
					<Card
						title="Authorization"
						description="Approve or reject pending auto-save transactions"
					>
						<form
							className="flex flex-col gap-3"
							onSubmit={onAuthorizeTransaction}
						>
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
								<option value="">
									Select a pending transaction
								</option>
								{overview?.pendingTransactions.map((tx) => (
									<option key={tx.id} value={tx.id}>
										#{tx.id} ·{" "}
										{tx.wallet.label ??
											tx.wallet.address.slice(0, 6)}{" "}
										· {formatWei(tx.saveAmountWei)}
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
								{submitting.authorize
									? "Processing..."
									: "Submit decision"}
							</button>
						</form>
					</Card>

					<Card
						title="Withdrawals"
						description="Request, cancel, or execute your withdrawals"
					>
						<form
							className="flex flex-col gap-3"
							onSubmit={onWithdrawAction}
						>
							<label className="text-xs font-medium text-gray-600">
								Action
							</label>
							<select
								value={withdrawForm.action}
								onChange={(e) =>
									setWithdrawForm((prev) => ({
										...prev,
										action: e.target.value,
									}))
								}
								className="rounded-md border border-gray-300 px-3 py-2 text-sm"
								disabled={!isConnected}
							>
								<option value="request">
									Request withdrawal
								</option>
								<option value="execute">
									Execute withdrawal
								</option>
								<option value="cancel">
									Cancel withdrawal
								</option>
							</select>
							<p className="text-xs text-gray-500">
								{withdrawForm.action === "request"
									? "Start a new withdrawal request"
									: withdrawForm.action === "execute"
									? "Complete your withdrawal (after lock period expires)"
									: "Cancel a pending withdrawal"}
							</p>
							<label className="text-xs font-medium text-gray-600">
								Wallet address
							</label>
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
								disabled={!isConnected}
							>
								<option value="">
									{!isConnected
										? "Connect wallet first"
										: activeWallets.length === 0
										? "No wallets found"
										: "Choose wallet"}
								</option>
								{activeWallets.map((wallet) => (
									<option
										key={wallet.id}
										value={wallet.address}
									>
										{wallet.label || wallet.address}
									</option>
								))}
							</select>
							{withdrawForm.action === "request" ? (
								<>
									<label className="text-xs font-medium text-gray-600">
										Amount (in wei)
									</label>
									<input
										required
										value={withdrawForm.amountWei}
										onChange={(e) =>
											setWithdrawForm((prev) => ({
												...prev,
												amountWei: e.target.value,
											}))
										}
										placeholder="e.g., 1000000000000000000"
										className="rounded-md border border-gray-300 px-3 py-2 text-sm"
										disabled={!isConnected}
									/>
									<p className="text-xs text-gray-500">
										1 CELO = 1000000000000000000 wei
									</p>
								</>
							) : null}
							<button
								type="submit"
								className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
								disabled={submitting.withdraw || !isConnected}
							>
								{submitting.withdraw
									? "Processing..."
									: withdrawForm.action === "request"
									? "Request withdrawal"
									: withdrawForm.action === "execute"
									? "Execute withdrawal"
									: "Cancel withdrawal"}
							</button>
							{!isConnected && (
								<p className="text-xs text-orange-600">
									⚠️ Connect your wallet to manage withdrawals
								</p>
							)}
						</form>
					</Card>
				</section>

				<section className="grid grid-cols-1 gap-6">
					<DataCard
						title="My Wallets"
						emptyLabel={
							!isConnected
								? "Connect your wallet to get started"
								: "No wallets registered yet"
						}
						headers={["Address", "Label", "Registered on"]}
						rows={
							overview?.wallets.map((wallet) => [
								wallet.address,
								wallet.label ?? "-",
								formatDate(wallet.createdAt),
							]) ?? []
						}
					/>
					<DataCard
						title="Pending Auto-Saves"
						emptyLabel={
							!isConnected
								? "Connect to view pending transactions"
								: "No pending auto-save transactions"
						}
						headers={[
							"Tx",
							"Wallet",
							"Amount",
							"Status",
							"Detected",
						]}
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
						title="My Withdrawals"
						emptyLabel={
							!isConnected
								? "Connect to view your withdrawals"
								: "No pending withdrawals"
						}
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
						title="Savings History"
						emptyLabel={
							!isConnected
								? "Connect to view your history"
								: "No ledger entries"
						}
						headers={[
							"Wallet",
							"Action",
							"Amount",
							"Notes",
							"Created",
						]}
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
								<tr
									key={`${row[0]}-${idx}`}
									className="even:bg-gray-50/40"
								>
									{row.map((value, cellIdx) => (
										<td
											key={`${value}-${cellIdx}`}
											className="px-2 py-2"
										>
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
