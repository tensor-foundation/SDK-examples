import {
  fetchOrderState,
  ClaimCompressedReceiveSolAsyncInput,
  getClaimCompressedReceiveSolInstructionAsync,
  ClaimLegacyReceiveSolAsyncInput,
  getClaimLegacyReceiveSolInstructionAsync,
} from '@tensor-foundation/price-lock';
import {
  KeyPairSigner,
  createKeyPairSignerFromBytes,
  IInstruction,
  address,
} from '@solana/web3.js';
import { helius_url, keypairBytes, rpc } from './common';
import {
  getCNFTArgs,
  getRulesetFromMetadataPda,
  retrieveAssetFields,
  retrieveProofFields,
  simulateTxWithIxs,
} from '@tensor-foundation/common-helpers';
import { getSetComputeUnitLimitInstruction } from '@solana-program/compute-budget';
import { findMetadataPda } from '@tensor-foundation/resolvers';

// exercise short lock specified via orderStateAddress by locking in NFT specified via mint
async function exerciseShortLock(orderStateAddress: string, mint: string) {
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
    ).then((orderState) => orderState.data);
    if (orderStateData.orderType !== 0)
      throw new Error('Not a short lock! orderType !== Token');
  } catch (error) {
    console.log(error);
    return;
  }

  // check if mint is compressed or not
  const assetFields = await retrieveAssetFields(helius_url, mint);
  const isCompressed = !!assetFields.compression?.compressed;

  var claimSolIx: IInstruction;
  // if compressed => execute via claimCompressedReceiveSol ix
  if (isCompressed) {
    const proofFields = await retrieveProofFields(helius_url, mint);
    const { root, merkleTree, proof, tMetadataArgsArgs, canopyDepth } =
      await getCNFTArgs(rpc, address(mint), assetFields, proofFields);
    const claimCompressedReceiveSolAsyncInput: ClaimCompressedReceiveSolAsyncInput =
      {
        taker: keypairSigner,
        orderState: address(orderStateAddress),
        maker: orderStateData.maker,
        whitelist: orderStateData.whitelist,
        merkleTree: merkleTree,
        minAmount: orderStateData.price,
        root: root,
        index: assetFields.compression!.leaf_id,
        metaArgs: tMetadataArgsArgs,
        creators:
          assetFields.creators?.map((c: any) => [c.address, c.share]) ?? [],
        proof: proof,
        canopyDepth: canopyDepth,
      };
    claimSolIx = await getClaimCompressedReceiveSolInstructionAsync(
      claimCompressedReceiveSolAsyncInput
    );
  }
  // else use claimLegacyReceiveSol (IMPORTANT: note that you might have to make use of claimT22ReceiveSol or claimWnsReceiveSol instead if the NFT has that standard)
  else {
    const [metadataPda] = await findMetadataPda({ mint: address(mint) });
    const ruleset = await getRulesetFromMetadataPda(rpc, metadataPda);
    const claimLegacyReceiveSolAsyncInput: ClaimLegacyReceiveSolAsyncInput = {
      taker: keypairSigner,
      orderState: address(orderStateAddress),
      maker: orderStateData.maker,
      whitelist: orderStateData.whitelist,
      mint: address(mint),
      authRules: ruleset,
      minAmount: orderStateData.price,
    };
    claimSolIx = await getClaimLegacyReceiveSolInstructionAsync(
      claimLegacyReceiveSolAsyncInput
    );
  }
  // legacy NFTs are CU heavy (especially pNFTs), extend CU limit 200k => 400k
  const computeIx = getSetComputeUnitLimitInstruction({
    units: 400_000,
  });

  await simulateTxWithIxs(rpc, [computeIx, claimSolIx], keypairSigner);
}
exerciseShortLock(
  'GE6J7qL2xuAS6zFvsxa7iXSwqDbq97tbwtC5qPH72K5v',
  'CPqz93pg7Hi7VQ6QNFFHwsqDrJj6fagAdFSYiZDviSmw'
);
