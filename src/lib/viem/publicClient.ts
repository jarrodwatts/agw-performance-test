import { createPublicClient, webSocket } from "viem";
import chain from "@/const/chain";

export const publicClient = createPublicClient({
  chain: chain,
  transport: webSocket("wss://api.testnet.abs.xyz/ws"),
});
