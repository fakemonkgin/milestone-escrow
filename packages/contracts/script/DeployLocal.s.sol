// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {MilestoneEscrow} from
    "../src/MilestoneEscrow.sol";

import {MockUSDC} from
    "../test/mocks/MockUSDC.sol";

contract DeployLocal is Script {
    function run() external {
        uint256 privateKey =
            vm.envUint(
                "ANVIL_PRIVATE_KEY"
            );

        address deployer =
            vm.addr(privateKey);

        vm.startBroadcast(privateKey);

        MockUSDC usdc =
            new MockUSDC();

        MilestoneEscrow escrow =
            new MilestoneEscrow();

        usdc.mint(
            deployer,
            10_000e6
        );

        vm.stopBroadcast();

        console2.log(
            "MockUSDC:",
            address(usdc)
        );

        console2.log(
            "MilestoneEscrow:",
            address(escrow)
        );

        console2.log(
            "Deployer:",
            deployer
        );
    }
}