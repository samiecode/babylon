// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {SavingsVault} from "../src/SavingsVault.sol";

contract SavingsVaultTest is Test {
    SavingsVault internal vault;
    address internal constant CONTROLLER = address(0xC0FFEE);
    address internal constant SAVER = address(0xA11CE);

    function setUp() public {
        vault = new SavingsVault(CONTROLLER);
        vm.deal(CONTROLLER, 100 ether);
        vm.deal(SAVER, 100 ether);
    }

    function testConfigureForSetsValues() public {
        vm.prank(CONTROLLER);
        vault.configureFor(SAVER, 500, 1 days);

        (uint16 rateBps, uint40 delay,, ,,,) = vault.getAccount(SAVER);
        assertEq(rateBps, 500, "rate");
        assertEq(delay, 1 days, "delay");
    }

    function testDepositForUpdatesBalance() public {
        vm.prank(CONTROLLER);
        vault.configureFor(SAVER, 1000, 1 days);

        vm.prank(CONTROLLER);
        vault.depositFor{value: 2 ether}(SAVER);

        (, , uint256 balance,, , ,) = vault.getAccount(SAVER);
        assertEq(balance, 2 ether, "balance mismatch");
    }

    function testRequestAndExecuteWithdrawal() public {
        vm.prank(CONTROLLER);
        vault.configureFor(SAVER, 1000, 1 days);

        vm.prank(CONTROLLER);
        vault.depositFor{value: 5 ether}(SAVER);

        vm.prank(CONTROLLER);
        vault.requestWithdrawalFor(SAVER, 2 ether);

        (, , , , , uint256 pending, uint40 release) = vault.getAccount(SAVER);
        assertEq(pending, 2 ether, "pending amount");

        vm.warp(uint256(release) + 1);

        uint256 balanceBefore = SAVER.balance;
        vm.prank(CONTROLLER);
        vault.executeWithdrawalFor(SAVER);

        assertEq(SAVER.balance - balanceBefore, 2 ether, "payout mismatch");
        (, , uint256 balance,, , ,) = vault.getAccount(SAVER);
        assertEq(balance, 3 ether, "vault balance mismatch");
    }

    function testCancelWithdrawalClearsPlan() public {
        vm.prank(CONTROLLER);
        vault.configureFor(SAVER, 800, 6 hours);

        vm.prank(CONTROLLER);
        vault.depositFor{value: 1 ether}(SAVER);

        vm.prank(CONTROLLER);
        vault.requestWithdrawalFor(SAVER, 0.25 ether);

        vm.prank(CONTROLLER);
        vault.cancelWithdrawalFor(SAVER);

        (, , , , , uint256 pending, ) = vault.getAccount(SAVER);
        assertEq(pending, 0, "pending not cleared");
    }

    function testCannotWithdrawMoreThanBalance() public {
        vm.prank(CONTROLLER);
        vault.configureFor(SAVER, 900, 12 hours);

        vm.prank(CONTROLLER);
        vault.depositFor{value: 0.5 ether}(SAVER);

        vm.expectRevert(SavingsVault.InsufficientBalance.selector);
        vm.prank(CONTROLLER);
        vault.requestWithdrawalFor(SAVER, 1 ether);
    }
}
