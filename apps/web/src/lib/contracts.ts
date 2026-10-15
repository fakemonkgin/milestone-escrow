import {
  getAddress,
  parseAbi,
} from "viem";

export const milestoneEscrowAbi =
  parseAbi([
    "function createProject(bytes32 projectId, address freelancer, address token, uint256[] milestoneAmounts)",
    "function fundProject(bytes32 projectId)",
    "function releaseMilestone(bytes32 projectId, uint256 milestoneIndex)",
  ]);

export const erc20Abi =
  parseAbi([
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
  ]);

function requireAddressEnv(
  value: string | undefined,
  name: string
) {
  if (!value) {
    throw new Error(
      `${name} environment variable is required`
    );
  }

  return getAddress(value);
}

export const ESCROW_ADDRESS =
  requireAddressEnv(
    process.env.NEXT_PUBLIC_ESCROW_ADDRESS,
    "NEXT_PUBLIC_ESCROW_ADDRESS"
  );

export const TOKEN_ADDRESS =
  requireAddressEnv(
    process.env.NEXT_PUBLIC_TOKEN_ADDRESS,
    "NEXT_PUBLIC_TOKEN_ADDRESS"
  );