"use client";

import {ReactNode, useMemo} from "react";
import { WagmiProvider, type Config  } from 'wagmi'
import {celo, celoAlfajores} from "viem/chains";
import {createAppKit} from "@reown/appkit/react";
import {WagmiAdapter} from "@reown/appkit-adapter-wagmi";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

const networks = [celo, celoAlfajores];

const metadata = {
	name: "Babylon Auto-Savings",
	description: "Auto-save CELO inflows with configurable vault rules.",
	url: "https://babylon.local",
	icons: [
		"https://walletconnect.com/_next/static/media/logo_mark.c2b107f4.svg",
	],
};

const queryClient = new QueryClient()

let wagmiConfigSingleton: Config | null = null;

function initAppKit() {
	if (!projectId || wagmiConfigSingleton) return wagmiConfigSingleton;

	const adapter = new WagmiAdapter({
		projectId,
		networks,
		ssr: true,
	});

	createAppKit({
		projectId,
		adapters: [adapter],
		networks: [celo, celoAlfajores],
		defaultNetwork: celoAlfajores,
		metadata,
		themeMode: "dark",
	});

	wagmiConfigSingleton = adapter.wagmiConfig;
	return wagmiConfigSingleton;
}

export default function Providers({children}: {children: ReactNode}) {
	const wagmiConfig = useMemo(() => initAppKit(), []);

	if (!projectId || !wagmiConfig) {
		if (process.env.NODE_ENV === "development" && !projectId) {
			console.warn(
				"NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is missing; AppKit will be disabled."
			);
		}
		return <>{children}</>;
	}

	return (
		<WagmiProvider config={wagmiConfig}>
			<QueryClientProvider client={queryClient}>
				{children}
			</QueryClientProvider>
		</WagmiProvider>
	);
}
