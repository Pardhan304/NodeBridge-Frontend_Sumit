"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { hardhat, sepolia } from "wagmi/chains";

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 31337);
const chains = chainId === sepolia.id ? [sepolia] : [hardhat];

export const wagmiConfig = getDefaultConfig({
  appName: "NodeBridge",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo-project-id",
  chains,
  ssr: true,
});
