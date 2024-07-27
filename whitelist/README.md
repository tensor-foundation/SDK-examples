# Whitelist Examples
Concise example scripts showcasing the usage of Tensor's new Whitelist SDK.

This repository is temporary until all audits are concluded and programs are open-sourced.

## Getting Started
To get started, clone or download this repository, navigate to the whitelist folder and install the necessary dependencies:
```shell
git clone https://github.com/tensor-foundation/SDK-examples.git
cd SDK-examples
cd whitelist
npm install
```

## Filling in common variables
Afterwards, open `common.ts` and fill in:
1. your wallet's private key (please use a dedicated burner wallet) to `keypairBytes` 
2. replace `helius_url` with a valid Helius RPC link - if you don't already have one, you can create one for free on [Helius' website](https://dev.helius.xyz/dashboard/app) - this is used for their DAS API to retrieve indexed details for compressed NFTs
3. (optional) replace `helius_url` for the `rpc` variable to use a custom RPC connection used for all RPC calls

## Running a script
Now you can run whatever script you like by filling in the arguments of the function you want to execute at the bottom of each corresponding script file and executing the following command afterwards, e.g.:
```shell
npx tsx init_mint_proof_if_needed.ts
```

## Feedback

If you have any questions or feedback, join our [Discord](https://discord.com/invite/6S3pRkfedB) and talk to us in #api-sdk-questions !