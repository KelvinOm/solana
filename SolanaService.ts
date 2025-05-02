import {
  setTransactionMessageFeePayerSigner,
  signTransactionMessageWithSigners,
  getSignatureFromTransaction,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  sendAndConfirmTransactionFactory,
  pipe,
  createTransactionMessage,
  getComputeUnitEstimateForTransactionMessageFactory,
  prependTransactionMessageInstruction,
  isSolanaError,
  SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE,
  SOLANA_ERROR__TRANSACTION_ERROR__BLOCKHASH_NOT_FOUND,
} from '@solana/kit';
import { getSetComputeUnitLimitInstruction, getSetComputeUnitPriceInstruction } from '@solana-program/compute-budget';
import { getTransferSolInstruction, getSystemErrorMessage, isSystemError } from '@solana-program/system';

import type { Address, KeyPairSigner } from '@solana/kit';

const DEFAULT_PRIORITY_FEE = 1n;
const DEFAULT_PRIORITY_FEE_BUFFER = 110n;

export class SolanaService {
  public rpc;
  public rpcSubscriptions;

  constructor(rpcUrl: string) {
    this.rpc = createSolanaRpc(`https://${rpcUrl}`);
    this.rpcSubscriptions = createSolanaRpcSubscriptions(`wss://${rpcUrl}`);
  }

  async sendTransaction(
    signer: KeyPairSigner,
    receiver: KeyPairSigner,
    lamports: bigint | number,
    prioritizationFee: bigint | number = DEFAULT_PRIORITY_FEE,
  ) {
    const transferInstruction = [
      getTransferSolInstruction({
        source: signer,
        destination: receiver.address,
        amount: BigInt(lamports),
      }),
    ];

    const { value: latestBlockhash } = await this.rpc.getLatestBlockhash().send();

    const computeUnitPriceInstruction = getSetComputeUnitPriceInstruction({
      microLamports: prioritizationFee,
    });

    const transactionMessage = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayerSigner(signer, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      (tx) => appendTransactionMessageInstructions(transferInstruction, tx),
      (tx) => appendTransactionMessageInstructions([computeUnitPriceInstruction], tx),
    );

    const getComputeUnitEstimateForTransactionMessage = getComputeUnitEstimateForTransactionMessageFactory({
      rpc: this.rpc,
    });

    const computeUnitsEstimate = await getComputeUnitEstimateForTransactionMessage(transactionMessage);

    const transactionMessageWithComputeUnitLimit = prependTransactionMessageInstruction(
      getSetComputeUnitLimitInstruction({ units: computeUnitsEstimate }),
      transactionMessage,
    );

    const signedTransaction = await signTransactionMessageWithSigners(transactionMessageWithComputeUnitLimit);

    try {
      await sendAndConfirmTransactionFactory({
        rpc: this.rpc,
        rpcSubscriptions: this.rpcSubscriptions,
      })(signedTransaction, { commitment: 'finalized' });

      const transactionSignature = getSignatureFromTransaction(signedTransaction);

      return transactionSignature;
    } catch (e) {
      if (isSolanaError(e, SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE)) {
        const errorDetailMessage = isSystemError(e.cause, transactionMessage)
          ? getSystemErrorMessage(e.cause.context.code)
          : e.cause?.message;
        console.error(errorDetailMessage);
      }

      throw e;
    }
  }

  async sendTransactionWithRetry(
    signer: KeyPairSigner,
    receiver: KeyPairSigner,
    lamports: bigint | number,
    prioritizationFee: bigint | number = DEFAULT_PRIORITY_FEE,
    retryCount = 3,
  ) {
    let currentRetryCount = 0;

    while (currentRetryCount < retryCount) {
      try {
        return await this.sendTransaction(signer, receiver, lamports, prioritizationFee);
      } catch (e) {
        if (
          isSolanaError(e, SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE) &&
          e.cause?.context?.__code === SOLANA_ERROR__TRANSACTION_ERROR__BLOCKHASH_NOT_FOUND
        ) {
          console.error('Retrying with updated blockhash...');
          currentRetryCount++;
          continue;
        } else {
          throw e;
        }
      }
    }
  }

  async getPrioritizationFee(addresses: Address[]): Promise<number | bigint> {
    try {
      const prioritizationFeeObjects = await this.rpc.getRecentPrioritizationFees(addresses).send();

      if (prioritizationFeeObjects.length === 0) {
        console.warn('No prioritization fee data available.');
        return DEFAULT_PRIORITY_FEE;
      }

      const nonZeroFees = prioritizationFeeObjects
        .map((feeObject) => feeObject.prioritizationFee)
        .filter((fee) => fee !== 0n);

      const averageFeeExcludingZeros =
        nonZeroFees.length > 0 ? nonZeroFees.reduce((acc, fee) => acc + fee, 0n) / BigInt(nonZeroFees.length) : 0n;

      return averageFeeExcludingZeros === 0n
        ? DEFAULT_PRIORITY_FEE
        : BigInt(averageFeeExcludingZeros) * BigInt(DEFAULT_PRIORITY_FEE_BUFFER);
    } catch (error) {
      console.error('Error fetching prioritization fees:', error);
      throw error;
    }
  }
}
