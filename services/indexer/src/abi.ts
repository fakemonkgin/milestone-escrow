import { parseAbi } from "viem";

export const milestoneEscrowAbi =
  parseAbi([
    "event ProjectCreated(bytes32 indexed projectId, address indexed client, address indexed freelancer, address token, uint256 totalAmount)",

    "event ProjectFunded(bytes32 indexed projectId, uint256 amount)",

    "event MilestoneReleased(bytes32 indexed projectId, uint256 indexed milestoneIndex, address indexed freelancer, uint256 amount)",
  ]);