// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISavingsVault {
    function deposit(address user) external payable;
}

contract SmartWallet {
    address public owner;
    ISavingsVault public vault;
    uint256 public savePercent;

    event AutoSaved(uint256 amount);

    constructor(address _owner, address _vault, uint256 _savePercent) {
        owner = _owner;
        vault = ISavingsVault(_vault);
        savePercent = _savePercent;
    }

    receive() external payable {
        // Calculate how much to save
        uint256 toSave = (msg.value * savePercent) / 100;
        if (toSave > 0) {
            vault.deposit{value: toSave}(owner);
            emit AutoSaved(toSave);
        }
        // Remaining balance stays in the wallet
    }

    function updateSavePercent(uint256 newPercent) external {
        require(msg.sender == owner, "Not authorized");
        savePercent = newPercent;
    }

    function withdraw(uint256 amount) external {
        require(msg.sender == owner, "Not authorized");
        payable(owner).transfer(amount);
    }
}
