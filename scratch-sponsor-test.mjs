import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

async function test() {
  const client = new SuiClient({ url: getFullnodeUrl('testnet') });
  
  const sponsor = new Ed25519Keypair();
  const user = new Ed25519Keypair();
  
  const tx = new Transaction();
  tx.setSender(user.toSuiAddress());
  tx.setGasOwner(sponsor.toSuiAddress());
  
  // Just a dummy transfer or something to test building
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(100)]);
  tx.transferObjects([coin], tx.pure.address(user.toSuiAddress()));
  
  try {
    const txBytes = await tx.build({ client });
    console.log("Built tx bytes successfully. Length:", txBytes.length);
    
    // Sponsor signs
    const sponsorSignature = (await sponsor.signTransaction(txBytes)).signature;
    console.log("Sponsor signed");
    
    // User signs
    const userSignature = (await user.signTransaction(txBytes)).signature;
    console.log("User signed");
    
  } catch (err) {
    console.error("Error:", err.message);
  }
}

test();
