"use client";

import { useAccount } from "wagmi";
import { useAbstractSession } from "@/hooks/useAbstractSession";
import { Button } from "./ui/button";
import {
  useAbstractClient,
  useLoginWithAbstract,
} from "@abstract-foundation/agw-react";
import { Loader2, InfoIcon } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { privateKeyToAccount } from "viem/accounts";
import {
  COOKIE_CLICKER_CONTRACT_ABI,
  COOKIE_CLICKER_CONTRACT_ADDRESS,
} from "@/const/contracts";
import chain from "@/const/chain";
import { publicClient } from "@/lib/viem/publicClient";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Define metrics types
type TransactionMetric = {
  submitted: number;
  receipt: number;
};

export default function Login() {
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  const { login } = useLoginWithAbstract();
  const { data: abstractClient } = useAbstractClient();
  const { hasValidSession, createAndStoreSession, session } =
    useAbstractSession();
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSessionValidating, setIsSessionValidating] = useState(true);

  const [startTime, setStartTime] = useState<number | null>(null);
  const [transactionSubmittedTime, setTransactionSubmittedTime] = useState<
    number | null
  >(null);
  const [transactionReceiptTime, setTransactionReceiptTime] = useState<
    number | null
  >(null);

  // Store historical metrics
  const [metrics, setMetrics] = useState<TransactionMetric[]>([]);

  // Animation state
  const [isRunning, setIsRunning] = useState(false);
  const [displayedSubmittedTime, setDisplayedSubmittedTime] = useState(0);
  const [displayedReceiptTime, setDisplayedReceiptTime] = useState(0);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number>(0);

  // Prevent flash of content by setting a small delay for initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsPageLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Add delay for session validation to prevent flashing
  useEffect(() => {
    if (isConnected && address) {
      const timer = setTimeout(() => {
        setIsSessionValidating(false);
      }, 1000); // Allow time for session validation to complete
      return () => clearTimeout(timer);
    }
  }, [isConnected, address, hasValidSession]);

  // Reset session validation state when connection changes
  useEffect(() => {
    if (!isConnected || !address) {
      setIsSessionValidating(true);
    }
  }, [isConnected, address]);

  // Animation effect
  useEffect(() => {
    if (!isRunning) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const animate = (timestamp: number) => {
      if (!lastTimestampRef.current) {
        lastTimestampRef.current = timestamp;
      }

      const elapsed = timestamp - lastTimestampRef.current;
      if (elapsed > 16) {
        // Roughly 60fps
        lastTimestampRef.current = timestamp;

        // Update displayed times based on current real times
        const now = Date.now();
        const timeFromStart = startTime ? now - startTime : 0;

        // Update submitted time (if not yet reached)
        if (transactionSubmittedTime) {
          const targetSubmittedDelta =
            transactionSubmittedTime - (startTime || 0);
          setDisplayedSubmittedTime(
            Math.min(timeFromStart, targetSubmittedDelta)
          );
        } else {
          setDisplayedSubmittedTime(timeFromStart);
        }

        // Update receipt time (if not yet reached)
        if (transactionReceiptTime) {
          const targetReceiptDelta = transactionReceiptTime - (startTime || 0);
          setDisplayedReceiptTime(Math.min(timeFromStart, targetReceiptDelta));
        } else if (transactionSubmittedTime) {
          setDisplayedReceiptTime(timeFromStart);
        }

        // Check if we should stop the animation
        if (transactionReceiptTime) {
          setIsRunning(false);
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRunning, startTime, transactionSubmittedTime, transactionReceiptTime]);

  // Save metrics when a transaction completes
  useEffect(() => {
    if (
      !isRunning &&
      startTime &&
      transactionSubmittedTime &&
      transactionReceiptTime
    ) {
      setMetrics((prev) => [
        ...prev,
        {
          submitted: transactionSubmittedTime - startTime,
          receipt: transactionReceiptTime - transactionSubmittedTime,
        },
      ]);
    }
  }, [isRunning, startTime, transactionSubmittedTime, transactionReceiptTime]);

  const handleCreateSession = async () => {
    setIsCreatingSession(true);
    try {
      await createAndStoreSession();
    } catch (error) {
      console.error("Failed to create session:", error);
    } finally {
      setIsCreatingSession(false);
    }
  };

  // Time formatters
  const formatTime = (ms: number) => {
    return `${Math.round(ms)}ms`;
  };

  // Get displayed times for UI
  const getClickTime = () => {
    return "0ms";
  };

  const getSubmittedTime = () => {
    if (!startTime) return "0ms";
    if (isRunning && !transactionSubmittedTime) {
      return formatTime(displayedSubmittedTime);
    }
    if (transactionSubmittedTime) {
      return formatTime(transactionSubmittedTime - startTime);
    }
    return "0ms";
  };

  const getReceiptTime = () => {
    if (!startTime) return "0ms";
    if (isRunning && !transactionReceiptTime) {
      return formatTime(displayedReceiptTime);
    }
    if (transactionReceiptTime) {
      return formatTime(transactionReceiptTime - startTime);
    }
    return "0ms";
  };

  // Calculate time since previous step
  const getClickDelta = () => {
    return "0ms";
  };

  const getSubmittedDelta = () => {
    if (!startTime) return "0ms";
    if (isRunning && !transactionSubmittedTime) {
      return formatTime(displayedSubmittedTime);
    }
    if (transactionSubmittedTime) {
      return formatTime(transactionSubmittedTime - startTime);
    }
    return "0ms";
  };

  const getReceiptDelta = () => {
    if (!transactionSubmittedTime) return "0ms";
    if (isRunning && !transactionReceiptTime && transactionSubmittedTime) {
      return formatTime(
        displayedReceiptTime - (transactionSubmittedTime - startTime!)
      );
    }
    if (transactionReceiptTime && transactionSubmittedTime) {
      return formatTime(transactionReceiptTime - transactionSubmittedTime);
    }
    return "0ms";
  };

  // Calculate statistics
  const calculateStats = (data: number[]) => {
    if (data.length === 0) return { avg: 0, min: 0, max: 0 };

    const sum = data.reduce((acc, val) => acc + val, 0);
    const avg = sum / data.length;
    const min = Math.min(...data);
    const max = Math.max(...data);

    return { avg, min, max };
  };

  const getSubmittedStats = () => {
    const data = metrics.map((m) => m.submitted);
    return calculateStats(data);
  };

  const getReceiptStats = () => {
    const data = metrics.map((m) => m.receipt);
    return calculateStats(data);
  };

  const getTotalStats = () => {
    const data = metrics.map((m) => m.submitted + m.receipt);
    return calculateStats(data);
  };

  async function beginPerformanceTest() {
    // Reset times
    setStartTime(null);
    setTransactionSubmittedTime(null);
    setTransactionReceiptTime(null);
    setDisplayedSubmittedTime(0);
    setDisplayedReceiptTime(0);
    lastTimestampRef.current = 0;

    // 1. Kick off a timer
    const now = Date.now();
    setStartTime(now);
    setIsRunning(true);

    // 2. Get the session data
    const storedSession = session;

    if (!storedSession || !abstractClient || !address)
      throw new Error("No stored session or abstract client or address");

    const sessionClient = abstractClient.toSessionClient(
      privateKeyToAccount(storedSession.privateKey),
      storedSession.session
    );

    const hash = await sessionClient.writeContract({
      address: COOKIE_CLICKER_CONTRACT_ADDRESS,
      abi: COOKIE_CLICKER_CONTRACT_ABI,
      functionName: "click",
      args: [],
      account: address,
      chain: chain,
    });

    setTransactionSubmittedTime(Date.now());
    console.log(hash);

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: hash as `0x${string}`,
      pollingInterval: 500,
    });

    setTransactionReceiptTime(Date.now());
    console.log(receipt);
  }

  const resetStats = () => {
    setMetrics([]);
  };

  // Common container for consistent layout
  const Container = ({ children }: { children: React.ReactNode }) => (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-50 p-4">
      {children}
    </div>
  );

  // Initial page loading state
  if (isPageLoading) {
    return (
      <Container>
        <div className="flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </Container>
    );
  }

  // Connecting wallet loading state
  if (isConnecting || isReconnecting) {
    return (
      <Container>
        <div className="flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-center font-medium">Connecting wallet...</p>
          <p className="text-center text-sm text-gray-500">
            Please wait while we connect to your wallet
          </p>
        </div>
      </Container>
    );
  }

  // No wallet connected state
  if (!isConnected || !address) {
    return (
      <Container>
        <div className="flex flex-col items-center justify-center gap-6">
          <h2 className="text-center text-xl font-semibold">Welcome</h2>
          <p className="text-center text-gray-600">
            Connect your wallet to continue
          </p>
          <Button onClick={() => login()} className="w-full">
            Connect Wallet
          </Button>
        </div>
      </Container>
    );
  }

  // Session validation in progress
  if (isSessionValidating) {
    return (
      <Container>
        <div className="flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-center font-medium">Checking session...</p>
          <p className="text-center text-sm text-gray-500">
            Verifying your access credentials
          </p>
        </div>
      </Container>
    );
  }

  // No session state
  if (!hasValidSession) {
    return (
      <Container>
        <div className="flex flex-col items-center justify-center gap-6">
          <h2 className="text-center text-xl font-semibold">
            Wallet Connected
          </h2>
          <p className="text-center text-gray-600">
            Please create a session to continue
          </p>
          <Button
            onClick={handleCreateSession}
            className="w-full"
            disabled={isCreatingSession}
          >
            {isCreatingSession ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Session...
              </>
            ) : (
              "Create Session"
            )}
          </Button>
        </div>
      </Container>
    );
  }

  // Success state - wallet connected and session valid - Show the Transaction Performance tracker
  return (
    <Container>
      <div className="flex flex-col justify-center items-center w-full gap-8 max-w-[500px]">
        {/* Current Transaction Metrics Card */}
        <div className="flex-shrink-0 flex flex-col items-center rounded-lg border bg-white p-6 shadow-sm w-full">
          <div className="flex space-x-4 mb-6">
            <Button onClick={beginPerformanceTest} disabled={isRunning}>
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Send Transaction"
              )}
            </Button>

            <Button
              onClick={resetStats}
              variant="outline"
              disabled={metrics.length === 0}
            >
              Reset Stats
            </Button>
          </div>

          <h3 className="text-lg font-medium mb-4 self-start">
            Current Transaction Metrics
          </h3>

          <TooltipProvider>
            <div className="w-full grid grid-cols-3 gap-2">
              <div className="font-medium">Event</div>
              <div>Time Since Click</div>
              <div>Delta (previous)</div>

              <div className="font-medium flex items-center">
                Click
                <Tooltip>
                  <TooltipTrigger asChild>
                    <InfoIcon className="h-4 w-4 ml-1 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      User clicks the submit button and the function to send
                      transaction begins.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div>{getClickTime()}</div>
              <div>{getClickDelta()}</div>

              <div className="font-medium flex items-center">
                Submitted
                <Tooltip>
                  <TooltipTrigger asChild>
                    <InfoIcon className="h-4 w-4 ml-1 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      Time it took for the transaction to arrive on-chain (and
                      the app to get a transaction hash).
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div
                className={
                  isRunning && !transactionSubmittedTime
                    ? "text-primary font-bold"
                    : ""
                }
              >
                {getSubmittedTime()}
              </div>
              <div
                className={
                  isRunning && !transactionSubmittedTime
                    ? "text-primary font-bold"
                    : ""
                }
              >
                {getSubmittedDelta()}
              </div>

              <div className="font-medium flex items-center">
                Receipt
                <Tooltip>
                  <TooltipTrigger asChild>
                    <InfoIcon className="h-4 w-4 ml-1 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      Time it took for the transaction to be confirmed and the
                      tx receipt to be available in the app.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div
                className={
                  isRunning && !transactionReceiptTime
                    ? "text-primary font-bold"
                    : ""
                }
              >
                {getReceiptTime()}
              </div>
              <div
                className={
                  isRunning && !transactionReceiptTime
                    ? "text-primary font-bold"
                    : ""
                }
              >
                {getReceiptDelta()}
              </div>
            </div>
          </TooltipProvider>
        </div>

        {metrics.length > 0 && (
          <>
            <Separator className="w-full" />

            {/* Statistics Card */}
            <div className="flex-shrink-0 rounded-lg border bg-white p-6 shadow-sm w-full">
              <h3 className="text-lg font-medium mb-4">
                Performance Statistics ({metrics.length} transactions)
              </h3>

              <div className="w-full grid grid-cols-4 gap-2">
                <div className="font-medium">Metric</div>
                <div>Average</div>
                <div>Minimum</div>
                <div>Maximum</div>

                <div className="font-medium">Submission</div>
                <div>{formatTime(getSubmittedStats().avg)}</div>
                <div>{formatTime(getSubmittedStats().min)}</div>
                <div>{formatTime(getSubmittedStats().max)}</div>

                <div className="font-medium">Receipt</div>
                <div>{formatTime(getReceiptStats().avg)}</div>
                <div>{formatTime(getReceiptStats().min)}</div>
                <div>{formatTime(getReceiptStats().max)}</div>

                <div className="font-medium">Total</div>
                <div>{formatTime(getTotalStats().avg)}</div>
                <div>{formatTime(getTotalStats().min)}</div>
                <div>{formatTime(getTotalStats().max)}</div>
              </div>
            </div>
          </>
        )}
      </div>
    </Container>
  );
}
