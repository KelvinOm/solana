
import { setupTestEnvironment } from '../utils/setupTestEnvironment';
import { SolanaService } from '../utils/SolanaService';
import { Keypair} from '@solana/web3.js';

const lamports = 1_000;

async function transferMultipleTimes(
  solanaService: SolanaService,
  fromKeypair: Keypair,
  toKeypair: Keypair,
  lamports: number,
  times: number
) {
  for (let i = 0; i < times; i++) {
    console.log(`Transfer ${i + 1} of ${times}...`);
    
    const signature = await solanaService.sendTransaction(fromKeypair, toKeypair, lamports);
    console.log(`Transaction ${i + 1} signature:`, signature);
    
    const fromBalance = await solanaService.connection.getBalance(fromKeypair.publicKey);
    const toBalance = await solanaService.connection.getBalance(toKeypair.publicKey);

    console.log('Sender balance after transaction:', fromBalance);
    console.log('Receiver balance after transaction:', toBalance);
  }

  console.log(`Completed ${times} transfers of ${lamports} lamports each.`);
}

(async () => {
  const rpcUrl = 'http://127.0.0.1:8899';

  // Set up test environment and get wallets
  const [fromKeypair, toKeypair] = await setupTestEnvironment(rpcUrl);

  // Initialize SolanaService
  const solanaService = new SolanaService(rpcUrl);

  // Perform multiple transfers
  const times = 50; // Number of transfers
  console.log(`Starting ${times} transfers of ${lamports} lamports each...`);
  
  await transferMultipleTimes(solanaService, fromKeypair, toKeypair, lamports, times);
  
  console.log('All transfers completed successfully.');
})().catch(console.error);;