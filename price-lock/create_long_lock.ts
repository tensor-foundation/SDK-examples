import {
  OrderType,
  UpsertOrderAsyncInput,
  DepositCompressedAsyncInput,
  getUpsertOrderInstructionAsync,
  findOrderStatePda,
  getDepositCompressedInstructionAsync,
  DepositLegacyAsyncInput,
  getDepositLegacyInstructionAsync,
} from '@tensor-foundation/price-lock';
import {
  KeyPairSigner,
  createKeyPairSignerFromBytes,
  address,
  IInstruction,
} from '@solana/web3.js';
import { helius_url, keypairBytes, rpc } from './common';
import {
  retrieveAssetFields,
  simulateTxWithIxs,
  getCNFTArgs,
  getRulesetFromMetadataPda,
  retrieveProofFields,
} from '@tensor-foundation/common-helpers';
import { getSetComputeUnitLimitInstruction } from '@solana-program/compute-budget';
import { findMetadataPda } from '@tensor-foundation/resolvers';

// create a long lock for a collection specified by its whitelist, with an NFT (mint) and the amount of lamports the lock is supposed to be buyable for
async function createLongLock(
  whitelist: string,
  mint: string,
  lamports: number
) {
  const keypairSigner: KeyPairSigner = await createKeyPairSignerFromBytes(
    Buffer.from(keypairBytes),
    false
  );

  // orderId and orderState are optional, but we need to know our orderId to derive the orderState PDA for the next instruction
  // alternative: leave orderId and orderState args undefined and retrieve orderState PDA from upsertOrderIx.accounts
  const orderId = new Uint8Array(32).map(() => (Math.random() * 256) & 255);
  const [orderStateAddress, orderStateBump] = await findOrderStatePda({
    maker: keypairSigner.address,
    orderId: orderId,
  });

  const upsertOrderAsyncInput: UpsertOrderAsyncInput = {
    maker: keypairSigner,
    orderState: orderStateAddress,
    whitelist: address(whitelist),
    orderType: OrderType.NFT,
    // get maker broker fees of the price back to your own wallet
    // when your lock gets bought
    makerBroker: keypairSigner.address,
    price: lamports,
    orderId: orderId,
    // TODO: fetch correct apr for collection w/ REST API
    aprBps: 14000,
  };
  const upsertOrderIx = await getUpsertOrderInstructionAsync(
    upsertOrderAsyncInput
  );

  // check if mint is compressed or not
  const assetFields = await retrieveAssetFields(helius_url, mint);
  const isCompressed = !!assetFields.compression?.compressed;

  var depositIx: IInstruction;
  if (isCompressed) {
    const proofFields = await retrieveProofFields(helius_url, mint);
    const { root, merkleTree, proof, tMetadataArgsArgs, canopyDepth } =
      await getCNFTArgs(rpc, address(mint), assetFields, proofFields);
    const depositCompressedAsyncInput: DepositCompressedAsyncInput = {
      maker: keypairSigner,
      orderState: orderStateAddress,
      whitelist: address(whitelist),
      merkleTree: merkleTree,
      root: root,
      index: assetFields.compression!.leaf_id,
      metaArgs: tMetadataArgsArgs,
      creators:
        assetFields.creators?.map((c: any) => [c.address, c.share]) ?? [],
      proof: proof,
      canopyDepth: canopyDepth,
    };
    depositIx = await getDepositCompressedInstructionAsync(
      depositCompressedAsyncInput
    );
  } else {
    const [metadataPda] = await findMetadataPda({ mint: address(mint) });
    const ruleset = await getRulesetFromMetadataPda(rpc, metadataPda);
    const depositLegacyAsyncInput: DepositLegacyAsyncInput = {
      maker: keypairSigner,
      orderState: orderStateAddress,
      whitelist: address(whitelist),
      mint: address(mint),
      authRules: ruleset,
    };
    depositIx = await getDepositLegacyInstructionAsync(depositLegacyAsyncInput);
  }
  // legacy NFTs are CU heavy (especially pNFTs), extend CU limit 200k => 400k
  const computeIx = getSetComputeUnitLimitInstruction({
    units: 400_000,
  });
  await simulateTxWithIxs(
    rpc,
    [computeIx, upsertOrderIx, depositIx],
    keypairSigner
  );
}

createLongLock('WHITELIST_ADDRESS', 'NFT_ADDRESS', 0.01 * 1_000_000_000);
