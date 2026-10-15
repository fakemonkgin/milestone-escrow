// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MilestoneEscrow {
    using SafeERC20 for IERC20;

    struct Milestone {
        uint256 amount;
        bool released;
    }

    struct Project {
        address client;
        address freelancer;
        address token;

        uint256 totalAmount;
        uint256 releasedCount;

        bool funded;

        Milestone[] milestones;
    }

    mapping(bytes32 => Project) private projects;

    error InvalidProjectId();
    error ProjectAlreadyExists(bytes32 projectId);
    error InvalidFreelancer();
    error InvalidToken();
    error NoMilestones();
    error InvalidMilestoneAmount(uint256 index);
    error ProjectNotFound(bytes32 projectId);
    error MilestoneNotFound(uint256 index);
    error NotClient(address caller);
    error ProjectAlreadyFunded(bytes32 projectId);
    error ProjectNotFunded(bytes32 projectId);
    error MilestoneAlreadyReleased(bytes32 projectId, uint256 milestoneIndex);

    event ProjectCreated(
        bytes32 indexed projectId,
        address indexed client,
        address indexed freelancer,
        address token,
        uint256 totalAmount
    );

    event ProjectFunded(bytes32 indexed projectId, uint256 amount);

    event MilestoneReleased(
        bytes32 indexed projectId, uint256 indexed milestoneIndex, address indexed freelancer, uint256 amount
    );

    function createProject(bytes32 projectId, address freelancer, address token, uint256[] calldata milestoneAmounts)
        external
    {
        if (projectId == bytes32(0)) {
            revert InvalidProjectId();
        }

        if (projects[projectId].client != address(0)) {
            revert ProjectAlreadyExists(projectId);
        }

        if (freelancer == address(0)) {
            revert InvalidFreelancer();
        }

        if (token == address(0)) {
            revert InvalidToken();
        }

        if (milestoneAmounts.length == 0) {
            revert NoMilestones();
        }

        Project storage project = projects[projectId];

        project.client = msg.sender;
        project.freelancer = freelancer;
        project.token = token;

        uint256 totalAmount;

        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            uint256 amount = milestoneAmounts[i];

            if (amount == 0) {
                revert InvalidMilestoneAmount(i);
            }

            totalAmount += amount;

            project.milestones.push(Milestone({amount: amount, released: false}));
        }

        project.totalAmount = totalAmount;

        emit ProjectCreated(projectId, msg.sender, freelancer, token, totalAmount);
    }

    function fundProject(bytes32 projectId) external {
        Project storage project = projects[projectId];

        if (project.client == address(0)) {
            revert ProjectNotFound(projectId);
        }

        if (msg.sender != project.client) {
            revert NotClient(msg.sender);
        }

        if (project.funded) {
            revert ProjectAlreadyFunded(projectId);
        }

        project.funded = true;

        IERC20(project.token).safeTransferFrom(msg.sender, address(this), project.totalAmount);

        emit ProjectFunded(projectId, project.totalAmount);
    }

    function releaseMilestone(bytes32 projectId, uint256 milestoneIndex) external {
        Project storage project = projects[projectId];

        if (project.client == address(0)) {
            revert ProjectNotFound(projectId);
        }

        if (msg.sender != project.client) {
            revert NotClient(msg.sender);
        }

        if (!project.funded) {
            revert ProjectNotFunded(projectId);
        }

        if (milestoneIndex >= project.milestones.length) {
            revert MilestoneNotFound(milestoneIndex);
        }

        Milestone storage milestone = project.milestones[milestoneIndex];

        if (milestone.released) {
            revert MilestoneAlreadyReleased(projectId, milestoneIndex);
        }

        milestone.released = true;
        project.releasedCount += 1;

        IERC20(project.token).safeTransfer(project.freelancer, milestone.amount);

        emit MilestoneReleased(projectId, milestoneIndex, project.freelancer, milestone.amount);
    }

    function getProject(bytes32 projectId)
        external
        view
        returns (
            address client,
            address freelancer,
            address token,
            uint256 totalAmount,
            uint256 releasedCount,
            bool funded,
            uint256 milestoneCount
        )
    {
        Project storage project = projects[projectId];

        if (project.client == address(0)) {
            revert ProjectNotFound(projectId);
        }

        return (
            project.client,
            project.freelancer,
            project.token,
            project.totalAmount,
            project.releasedCount,
            project.funded,
            project.milestones.length
        );
    }

    function getMilestone(bytes32 projectId, uint256 milestoneIndex)
        external
        view
        returns (uint256 amount, bool released)
    {
        Project storage project = projects[projectId];

        if (project.client == address(0)) {
            revert ProjectNotFound(projectId);
        }

        if (milestoneIndex >= project.milestones.length) {
            revert MilestoneNotFound(milestoneIndex);
        }

        Milestone storage milestone = project.milestones[milestoneIndex];

        return (milestone.amount, milestone.released);
    }

    function isProjectCompleted(bytes32 projectId) external view returns (bool) {
        Project storage project = projects[projectId];

        if (project.client == address(0)) {
            revert ProjectNotFound(projectId);
        }

        return (project.funded && project.releasedCount == project.milestones.length);
    }
}
