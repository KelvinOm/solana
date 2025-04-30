import { Connection, Keypair } from '@solana/web3.js';

export async function setupTestEnvironment(rpcUrl: string) {
  const connection = new Connection(rpcUrl, 'confirmed');

  // Создайте два кошелька
  const wallet1 = Keypair.generate();
  const wallet2 = Keypair.generate();

  // Функция для пополнения кошелька
  const fundWallet = async (wallet: Keypair) => {
    console.log(`Requesting airdrop for wallet: ${wallet.publicKey.toBase58()}`);
    const airdropSignature = await connection.requestAirdrop(wallet.publicKey, 1_000_000_000); // 1 SOL
    await connection.confirmTransaction(airdropSignature, 'confirmed');
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`Wallet ${wallet.publicKey.toBase58()} balance:`, balance);
  };

  // Пополните оба кошелька
  await fundWallet(wallet1);
  await fundWallet(wallet2);

  console.log('Test wallets created and funded successfully.');
  console.log('Wallet 1 Public Key:', wallet1.publicKey.toBase58());
  console.log('Wallet 2 Public Key:', wallet2.publicKey.toBase58());

  return [wallet1, wallet2];
}