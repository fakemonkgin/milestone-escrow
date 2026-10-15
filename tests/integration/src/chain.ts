import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  http,
  parseAbi,
} from "viem";

import {
  privateKeyToAccount,
} from "viem/accounts";

import {
  foundry,
} from "viem/chains";

import {
  config,
} from "./config.js";


export const alice =
  privateKeyToAccount(
    config.alicePrivateKey
  );

export const bob =
  privateKeyToAccount(
    config.bobPrivateKey
  );


export const publicClient =
  createPublicClient({
    chain: foundry,

    transport:
      http(
        config.rpcUrl
      ),
  });


export const aliceWallet =
  createWalletClient({
    account: alice,

    chain: foundry,

    transport:
      http(
        config.rpcUrl
      ),
  });


export const bobWallet =
  createWalletClient({
    account: bob,

    chain: foundry,

    transport:
      http(
        config.rpcUrl
      ),
  });


export const testClient =
  createTestClient({
    chain: foundry,

    mode: "anvil",

    transport:
      http(
        config.rpcUrl
      ),
  });


export const tokenAbi =
  parseAbi([
    "function mint(address to, uint256 amount)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
  ]);


export const escrowAbi =
  parseAbi([
    "function createProject(bytes32 projectId, address freelancer, address token, uint256[] milestoneAmounts)",

    "function fundProject(bytes32 projectId)",

    "function releaseMilestone(bytes32 projectId, uint256 milestoneIndex)",
  ]);