"use client";

import { AbstractWalletProvider } from "@abstract-foundation/agw-react";
import { abstractTestnet } from "viem/chains"; // Use abstract for mainnet
import { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export default function CustomAbstractWalletProvider({ children }: Props) {
  return (
    <AbstractWalletProvider chain={abstractTestnet}>
      {children}
    </AbstractWalletProvider>
  );
}
