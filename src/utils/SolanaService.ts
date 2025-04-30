import { Connection, Transaction, SystemProgram, Keypair, VersionedTransaction, TransactionMessage } from '@solana/web3.js';

export class SolanaService {
  public connection: Connection;

  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  async sendTransaction(fromKeypair: Keypair, toKeypair: Keypair, lamports: number): Promise<string> {
    try {
      const latestBlockhash = await this.connection.getLatestBlockhash();

      const transaction = new Transaction({
        recentBlockhash: latestBlockhash.blockhash,
        feePayer: fromKeypair.publicKey,
      }).add(
        SystemProgram.transfer({
          fromPubkey: fromKeypair.publicKey,
          toPubkey: toKeypair.publicKey,
          lamports,
        })
      );

      const transactionMessage = new TransactionMessage({
        payerKey: fromKeypair.publicKey,
        recentBlockhash: latestBlockhash.blockhash,
        instructions: transaction.instructions,
      }).compileToV0Message();

      const versionedTransaction = new VersionedTransaction(transactionMessage);
      versionedTransaction.sign([fromKeypair]);

      const signature = await this.connection.sendTransaction(versionedTransaction, {
        skipPreflight: false,
      });

      await this.connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      });

      console.log('Transaction successful:', signature);
      return signature;
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }

  async sendTransactionWithDynamicFee(fromKeypair: Keypair, toKeypair: Keypair, lamports: number, maxRetries = 5): Promise<string> {
    let retries = 0;
    let lastError: Error | null = null;

    while (retries < maxRetries) {
      try {
        const latestBlockhash = await this.connection.getLatestBlockhash();

        const transaction = new Transaction({
          recentBlockhash: latestBlockhash.blockhash,
          feePayer: fromKeypair.publicKey,
        }).add(
          SystemProgram.transfer({
            fromPubkey: fromKeypair.publicKey,
            toPubkey: toKeypair.publicKey,
            lamports,
          })
        );

        const transactionMessage = new TransactionMessage({
          payerKey: fromKeypair.publicKey,
          recentBlockhash: latestBlockhash.blockhash,
          instructions: transaction.instructions,
        }).compileToV0Message();

        const versionedTransaction = new VersionedTransaction(transactionMessage);
        versionedTransaction.sign([fromKeypair]);

        console.log(`Attempt ${retries + 1}: Sending transaction`);

        const signature = await this.connection.sendTransaction(versionedTransaction, {
          skipPreflight: false,
        });

        await this.connection.confirmTransaction({
          signature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        });

        console.log('Transaction successful:', signature);
        return signature;
      } catch (error) {
        console.error(`Attempt ${retries + 1} failed:`, error);
        lastError = error as Error;
        retries++;
      }
    }

    throw new Error(`Transaction failed after ${maxRetries} attempts: ${lastError}`);
  }
}