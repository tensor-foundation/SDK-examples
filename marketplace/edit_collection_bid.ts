import { simulateTxWithIxs } from '@tensor-foundation/common-helpers';
import { rpc, keypairBytes } from './common';
import {
  address,
  KeyPairSigner,
  createKeyPairSignerFromBytes,
  isSome,
  unwrapOption,
} from '@solana/web3.js';
import {
  Target,
  BidAsyncInput,
  getBidInstructionAsync,
  fetchBidState,
} from '@tensor-foundation/marketplace';

// edits a collection bid for a collection specified by its bidState address
// quantity defaults to remaining quantity (quantity - filledQuantity) if not specified to be edited
// amount (price) defaults to existing price if not specified 
async function editCollectionBid(
  bidStateAddress: string,
  amountLamports?: number,
  quantity?: number
) {
  const keypairSigner: KeyPairSigner = await createKeyPairSignerFromBytes(
    Buffer.from(keypairBytes),
    false
  );
  // fetch bidState for fields that'll stay as-is - e.g. whitelist, bidId, sharedEscrow etc.
  const bidState = (await fetchBidState(rpc, address(bidStateAddress))).data;

  const bidAsyncInput: BidAsyncInput = {
    owner: keypairSigner,
    target: Target.Whitelist,
    targetId: bidState.targetId,
    bidState: address(bidStateAddress),
    bidId: bidState.bidId,
    currency: bidState.currency,
    sharedEscrow: isSome(bidState.margin) ? unwrapOption(bidState.margin)! : undefined,
    amount: amountLamports ?? bidState.amount,
    quantity: quantity ?? (bidState.quantity - bidState.filledQuantity),
    makerBroker: bidState.makerBroker,
    privateTaker: bidState.privateTaker,
  };
  // retrieve edit bid instruction
  const editBidIx = await getBidInstructionAsync(bidAsyncInput);
  await simulateTxWithIxs(rpc, [editBidIx], keypairSigner);
}
editCollectionBid(
  'BID_STATE_ADDRESS_OF_THE_BID_YOU_WANT_TO_EDIT',
  1 * 1_000_000_000, // 1 sol
  5 // 5 bids @ 1 sol
);
