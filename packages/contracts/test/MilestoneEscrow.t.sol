// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MilestoneEscrow} from "../src/MilestoneEscrow.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract MilestoneEscrowTest is Test {
    MilestoneEscrow internal escrow;

    address internal alice;
    address internal bob;
    address internal token;
    MockUSDC internal usdc;
    bytes32 internal projectId;

    function setUp() public {
        escrow = new MilestoneEscrow();

        alice = makeAddr("alice");
        bob = makeAddr("bob");
        usdc = new MockUSDC();
        token = address(usdc);
        projectId = keccak256("project-1");
        usdc.mint(alice, 10_000e6);
    }

    function testCreateProjectStoresState() public {
        uint256[] memory amounts = new uint256[](3);

        amounts[0] = 800e6;
        amounts[1] = 1000e6;
        amounts[2] = 1200e6;

        vm.prank(alice);

        escrow.createProject(projectId, bob, token, amounts);

        (
            address client,
            address freelancer,
            address storedToken,
            uint256 totalAmount,
            uint256 releasedCount,
            bool funded,
            uint256 milestoneCount
        ) = escrow.getProject(projectId);

        assertEq(client, alice);
        assertEq(freelancer, bob);
        assertEq(storedToken, token);

        assertEq(totalAmount, 3000e6);
        assertEq(releasedCount, 0);
        assertFalse(funded);
        assertEq(milestoneCount, 3);

        (uint256 amount, bool released) = escrow.getMilestone(projectId, 0);

        assertEq(amount, 800e6);
        assertFalse(released);
    }

    function testCannotCreateDuplicateProject() public {
        uint256[] memory amounts = new uint256[](1);

        amounts[0] = 800e6;

        vm.prank(alice);
        escrow.createProject(projectId, bob, token, amounts);

        vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.ProjectAlreadyExists.selector, projectId));

        vm.prank(alice);
        escrow.createProject(projectId, bob, token, amounts);
    }

    function testCannotCreateProjectWithoutMilestones() public {
        uint256[] memory amounts = new uint256[](0);

        vm.expectRevert(MilestoneEscrow.NoMilestones.selector);

        vm.prank(alice);

        escrow.createProject(projectId, bob, token, amounts);
    }

    function testCannotCreateZeroAmountMilestone() public {
        uint256[] memory amounts = new uint256[](2);

        amounts[0] = 800e6;
        amounts[1] = 0;

        vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.InvalidMilestoneAmount.selector, 1));

        vm.prank(alice);

        escrow.createProject(projectId, bob, token, amounts);
    }

    function testClientCanFundProject() public {
        uint256[] memory amounts = new uint256[](3);

        amounts[0] = 800e6;
        amounts[1] = 1000e6;
        amounts[2] = 1200e6;

        vm.prank(alice);
        escrow.createProject(projectId, bob, address(usdc), amounts);

        vm.startPrank(alice);

        usdc.approve(address(escrow), 3000e6);

        escrow.fundProject(projectId);

        vm.stopPrank();

        assertEq(usdc.balanceOf(address(escrow)), 3000e6);

        assertEq(usdc.balanceOf(alice), 7000e6);

        (,,,,, bool funded,) = escrow.getProject(projectId);

        assertTrue(funded);
    }

    function testClientCanReleaseMilestone() public {
        uint256[] memory amounts = new uint256[](3);

        amounts[0] = 800e6;
        amounts[1] = 1000e6;
        amounts[2] = 1200e6;

        vm.prank(alice);
        escrow.createProject(projectId, bob, address(usdc), amounts);

        vm.startPrank(alice);

        usdc.approve(address(escrow), 3000e6);

        escrow.fundProject(projectId);

        escrow.releaseMilestone(projectId, 0);

        vm.stopPrank();

        assertEq(usdc.balanceOf(bob), 800e6);

        assertEq(usdc.balanceOf(address(escrow)), 2200e6);

        (uint256 amount, bool released) = escrow.getMilestone(projectId, 0);

        assertEq(amount, 800e6);
        assertTrue(released);
    }

    function testFreelancerCannotReleaseMilestone() public {
        uint256[] memory amounts = new uint256[](1);

        amounts[0] = 800e6;

        vm.prank(alice);
        escrow.createProject(projectId, bob, address(usdc), amounts);

        vm.startPrank(alice);

        usdc.approve(address(escrow), 800e6);

        escrow.fundProject(projectId);

        vm.stopPrank();

        vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.NotClient.selector, bob));

        vm.prank(bob);

        escrow.releaseMilestone(projectId, 0);
    }

    function testCannotReleaseBeforeFunding() public {
        uint256[] memory amounts = new uint256[](1);

        amounts[0] = 800e6;

        vm.prank(alice);
        escrow.createProject(projectId, bob, address(usdc), amounts);

        vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.ProjectNotFunded.selector, projectId));

        vm.prank(alice);

        escrow.releaseMilestone(projectId, 0);
    }

    function testCannotReleaseMilestoneTwice() public {
        uint256[] memory amounts = new uint256[](1);

        amounts[0] = 800e6;

        vm.prank(alice);
        escrow.createProject(projectId, bob, address(usdc), amounts);

        vm.startPrank(alice);

        usdc.approve(address(escrow), 800e6);

        escrow.fundProject(projectId);

        escrow.releaseMilestone(projectId, 0);

        vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.MilestoneAlreadyReleased.selector, projectId, 0));

        escrow.releaseMilestone(projectId, 0);

        vm.stopPrank();
    }
}
