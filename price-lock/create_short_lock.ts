import {
  OrderType,
  UpsertOrderAsyncInput,
  getUpsertOrderInstructionAsync,
} from '@tensor-foundation/price-lock';
import { keypairBytes, rpc } from './common';
import { simulateTxWithIxs } from '@tensor-foundation/common-helpers';
import {
  address,
  KeyPairSigner,
  createKeyPairSignerFromBytes,
} from '@solana/web3.js';

// create short lock by specifying the collection via its whitelist and the price via lamports
async function createShortLock(whitelist: string, lamports: number) {
  const keypairSigner: KeyPairSigner = await createKeyPairSignerFromBytes(
    Buffer.from(keypairBytes),
    false
  );
  const upsertOrderAsyncInput: UpsertOrderAsyncInput = {
    maker: keypairSigner,
    whitelist: address(whitelist),
    // get maker broker fees of the price back to your own wallet
    // when your lock gets bought
    makerBroker: keypairSigner.address,
    orderType: OrderType.Token,
    price: lamports,
    // TODO: fetch correct apr for collection w/ REST API
    aprBps: 14000,
  };
  const upsertOrderIx = await getUpsertOrderInstructionAsync(
    upsertOrderAsyncInput
  );
  await simulateTxWithIxs(rpc, [upsertOrderIx], keypairSigner);
}
createShortLock('WHITELIST_ADDRESS', 0.01 * 1_000_000_000);
