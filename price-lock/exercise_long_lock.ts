import {
  fetchOrderState,
  ClaimCompressedReceiveNftAsyncInput,
  getClaimCompressedReceiveNftInstructionAsync,
  ClaimLegacyReceiveNftAsyncInput,
  getClaimLegacyReceiveNftInstructionAsync,
} from '@tensor-foundation/price-lock';
import {
  KeyPairSigner,
  createKeyPairSignerFromBytes,
  IInstruction,
  address,
} from '@solana/web3.js';
import { helius_url, keypairBytes, rpc } from './common';
import {
  retrieveAssetFields,
  getCNFTArgs,
  getRulesetFromMetadataPda,
  simulateTxWithIxs,
  retrieveProofFields,
} from '@tensor-foundation/common-helpers';
import { getSetComputeUnitLimitInstruction } from '@solana-program/compute-budget';
import { findMetadataPda } from '@tensor-foundation/resolvers';

// exercise long lock specified via orderStateAddress by claiming the NFT specified via mint
async function exerciseLongLock(orderStateAddress: string, mint: string) {
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
    if (orderStateData.orderType !== 1)
      throw new Error('Not a long lock! orderType !== NFT');
  } catch (error) {
    console.log(error);
    return;
  }

  // check if mint is compressed or not
  const assetFields = await retrieveAssetFields(helius_url, mint);
  const isCompressed = !!assetFields.compression?.compressed;

  var claimNftIx: IInstruction;
  // if compressed => claim via claimCompressedReceiveNft ix
  if (isCompressed) {
    const proofFields = await retrieveProofFields(helius_url, mint);
    const { root, merkleTree, proof, tMetadataArgsArgs, canopyDepth } =
      await getCNFTArgs(rpc, address(mint), assetFields, proofFields);
    const claimCompressedReceiveNftAsyncInput: ClaimCompressedReceiveNftAsyncInput =
      {
        taker: keypairSigner,
        orderState: address(orderStateAddress),
        maker: orderStateData.maker,
        whitelist: orderStateData.whitelist,
        merkleTree: merkleTree,
        maxAmount: orderStateData.price,
        root: root,
        index: assetFields.compression!.leaf_id,
        metaArgs: tMetadataArgsArgs,
        creators:
          assetFields.creators?.map((c: any) => [c.address, c.share]) ?? [],
        proof: proof,
        canopyDepth: canopyDepth,
      };
    claimNftIx = await getClaimCompressedReceiveNftInstructionAsync(
      claimCompressedReceiveNftAsyncInput
    );
  }
  // else use claimLegacyReceiveNft (IMPORTANT: note that you might have to make use of claimT22ReceiveNft or claimWnsReceiveNft instead if the NFT has that standard)
  else {
    const [metadataPda] = await findMetadataPda({ mint: address(mint) });
    const ruleset = await getRulesetFromMetadataPda(rpc, metadataPda);
    const claimLegacyReceiveNftAsyncInput: ClaimLegacyReceiveNftAsyncInput = {
      taker: keypairSigner,
      orderState: address(orderStateAddress),
      maker: orderStateData.maker,
      whitelist: orderStateData.whitelist,
      mint: address(mint),
      authRules: ruleset,
      maxAmount: orderStateData.price,
    };
    claimNftIx = await getClaimLegacyReceiveNftInstructionAsync(
      claimLegacyReceiveNftAsyncInput
    );
  }

  // legacy NFTs are CU heavy (especially pNFTs), extend CU limit 200k => 400k
  const computeIx = getSetComputeUnitLimitInstruction({
    units: 400_000,
  });
  await simulateTxWithIxs(rpc, [computeIx, claimNftIx], keypairSigner);
}
exerciseLongLock(
  'ELuK2Zsix5G73qDLhorCBQfDFgR5xax9M9ps3VkTMLwE',
  '58bXsKu6bc6q1qyBRoQLMz9zwZwz6gHVCsNEEBNJUiJS'
);
