import {
  CloseOrderAsyncInput,
  WithdrawCompressedAsyncInput,
  WithdrawLegacyAsyncInput,
  fetchOrderState,
  getCloseOrderInstructionAsync,
  getWithdrawCompressedInstructionAsync,
  getWithdrawLegacyInstructionAsync,
} from '@tensor-foundation/price-lock';
import {
  KeyPairSigner,
  createKeyPairSignerFromBytes,
  address,
  IInstruction,
} from '@solana/web3.js';
import { helius_url, keypairBytes, rpc } from './common';
import {
  getCNFTArgs,
  getRulesetFromMetadataPda,
  retrieveAssetFields,
  retrieveProofFields,
  simulateTxWithIxs,
} from '@tensor-foundation/common-helpers';
import { findMetadataPda } from '@tensor-foundation/resolvers';

// close lock identified via its orderStateAddress (should not be taken!)
// withdraws NFT (needs to be specified via mint) for long locks
// and SOL for short locks and closes lock afterwards
async function closeLock(orderStateAddress: string, mint?: string) {
  const keypairSigner: KeyPairSigner = await createKeyPairSignerFromBytes(
    Buffer.from(keypairBytes),
    false
  );

  // fetch orderState account data
  var orderStateData;
  try {
    orderStateData = await fetchOrderState(
      rpc,
      address(orderStateAddress)
    ).then((orderState: any) => orderState.data);
  } catch (error) {
    console.log(error);
    return;
  }

  var withdrawIx: IInstruction | null = null;
  // if order is a long order w/ held Nfts need to withdraw NFT before being able to close order
  if (orderStateData.orderType === 1 && orderStateData.nftsHeld > 0) {
    if (!mint) {
      throw new Error(
        `Lock with orderState ${orderStateAddress} is still holding an NFT, please specify the mint argument for withdrawing this NFT first!`
      );
    }
    // check if mint is compressed or not
    const assetFields = await retrieveAssetFields(helius_url, mint);
    const isCompressed = !!assetFields.compression?.compressed;

    // if compressed => use withdrawCompressed
    if (isCompressed) {
      const proofFields = await retrieveProofFields(helius_url, mint);
      const { root, merkleTree, proof, tMetadataArgsArgs, canopyDepth } =
        await getCNFTArgs(rpc, address(mint), assetFields, proofFields);
      const withdrawCompressedAsyncInput: WithdrawCompressedAsyncInput = {
        maker: keypairSigner,
        orderState: address(orderStateAddress),
        whitelist: orderStateData.whitelist,
        merkleTree: merkleTree,
        root: root,
        index: assetFields.compression!.leaf_id,
        metaArgs: tMetadataArgsArgs,
        creators:
          assetFields.creators?.map((c: any) => [c.address, c.share]) ?? [],
        proof: proof,
        canopyDepth: canopyDepth,
      };
      withdrawIx = await getWithdrawCompressedInstructionAsync(
        withdrawCompressedAsyncInput
      );
    }
    // else use withdrawLegacy (IMPORTANT: note that you might have to make use of withdrawT22 or withdrawWns instead if the NFT has that standard)
    else {
      const [metadataPda] = await findMetadataPda({ mint: address(mint) });
      const ruleset = await getRulesetFromMetadataPda(rpc, metadataPda);
      const withdrawLegacyAsyncInput: WithdrawLegacyAsyncInput = {
        maker: keypairSigner,
        orderState: address(orderStateAddress),
        whitelist: orderStateData.whitelist,
        mint: address(mint),
        authRules: ruleset,
      };
      withdrawIx = await getWithdrawLegacyInstructionAsync(
        withdrawLegacyAsyncInput
      );
    }
  }

  const closeOrderInput: CloseOrderAsyncInput = {
    signer: keypairSigner,
    orderState: address(orderStateAddress),
  };
  const closeOrderIx = await getCloseOrderInstructionAsync(closeOrderInput);
  await simulateTxWithIxs(
    rpc,
    !!withdrawIx ? [withdrawIx, closeOrderIx] : [closeOrderIx],
    keypairSigner
  );
}
closeLock('HbqR778H4x8EY2NzuEbwkmjiTmuBY2BWXLrYKA1piYYT');
