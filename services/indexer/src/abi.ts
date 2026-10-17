import { parseAbi } from "viem";

export const milestoneEscrowAbi =
  parseAbi([
    "event ProjectCreated(bytes32 indexed projectId, address indexed client, address indexed freelancer, address token, uint256 totalAmount)",

    "event ProjectFunded(bytes32 indexed projectId, uint256 amount)",

    "event MilestoneReleased(bytes32 indexed projectId, uint256 indexed milestoneIndex, address indexed freelancer, uint256 amount)",
  ]);

  export const projectReadAbi = parseAbi([
  "function getProject(bytes32 projectId) view returns (address client, address freelancer, address token, uint256 totalAmount, uint256 releasedCount, bool funded, uint256 milestoneCount)",

  "function getMilestone(bytes32 projectId, uint256 milestoneIndex) view returns (uint256 amount, bool released)",
]);