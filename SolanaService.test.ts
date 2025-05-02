import fs, { copyFile } from 'fs';
import { SolanaService } from './SolanaService';
import { createKeyPairSignerFromBytes, KeyPairSigner } from '@solana/kit';

async function transferMultipleTimes(
  solanaService: SolanaService,
  signer: KeyPairSigner,
  receiver: KeyPairSigner,
  lamports: number,
  prioritizationFee: bigint | number,
  times: number,
) {
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < times; i++) {
    try {
      const signature = await solanaService.sendTransactionWithRetry(signer, receiver, lamports, prioritizationFee);
      console.log(`Transfer ${i + 1} successful with signature:`, signature);
      successCount++;
    } catch (e) {
      console.error(e);
      failureCount++;
    }
  }

  console.log(
    `Completed ${times} transfers of ${lamports} lamports each. SuccessCount: ${successCount}, FailureCount: ${failureCount}`,
  );
}

(async () => {
  const rpcUrl = 'api.testnet.solana.com';
  const signer = await createKeyPairSignerFromBytes(
    Uint8Array.from(JSON.parse(fs.readFileSync('./new-test-wallet2.json', 'utf8'))),
  );
  const receiver = await createKeyPairSignerFromBytes(
    Uint8Array.from(JSON.parse(fs.readFileSync('./new-test-wallet.json', 'utf8'))),
  );
  const lamports = 1_0000_000;
  const solanaService = new SolanaService(rpcUrl);
  const times = 10;
  const prioritizationFee = await solanaService.getPrioritizationFee([signer.address, receiver.address]);

  console.log(`Starting ${times} transfers of ${lamports} lamports each...`);

  await transferMultipleTimes(solanaService, signer, receiver, lamports, prioritizationFee, times);

  console.log('All transfers completed successfully.');
})();
