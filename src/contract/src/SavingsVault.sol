// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SavingsVault
/// @notice Native-asset vault (CELO-compatible) that tracks auto-saved balances per saver account with configurable withdrawal delays.
contract SavingsVault {
    uint256 private constant MAX_BPS = 10_000;
    uint40 public constant MIN_WITHDRAWAL_DELAY = 1 hours;
    uint40 public constant MAX_WITHDRAWAL_DELAY = 365 days;

    address public owner;
    address public controller;

    uint256 private _lock = 1;

    struct Saver {
        uint16 rateBps;
        uint40 withdrawalDelay;
        uint40 lastConfigAt;
        uint56 _reserved;
        uint256 balance;
        uint256 totalDeposited;
        uint256 totalWithdrawn;
    }

    struct WithdrawalPlan {
        uint256 amount;
        uint40 availableAt;
    }

    mapping(address => Saver) private savers;
    mapping(address => WithdrawalPlan) private withdrawals;

    event OwnerTransferred(address indexed previousOwner, address indexed newOwner);
    event ControllerUpdated(address indexed previousController, address indexed newController);
    event SaverConfigured(address indexed saver, uint16 rateBps, uint40 withdrawalDelaySeconds);
    event Deposited(address indexed saver, address indexed operator, uint256 amount, uint256 newBalance);
    event WithdrawalRequested(address indexed saver, uint256 amount, uint40 availableAt);
    event WithdrawalCancelled(address indexed saver);
    event Withdrawn(address indexed saver, address indexed operator, uint256 amount, uint256 newBalance);

    error Unauthorized();
    error InvalidPercentage();
    error InvalidDelay();
    error ZeroValue();
    error PendingWithdrawal();
    error NoPendingWithdrawal();
    error CooldownActive(uint40 availableAt);
    error InsufficientBalance();
    error Reentrancy();
    error TransferFailed();

    constructor(address controller_) {
        owner = msg.sender;
        controller = controller_;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyController() {
        if (msg.sender != controller) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    modifier onlyAuthorized(address saver) {
        if (msg.sender != saver && msg.sender != controller) revert Unauthorized();
        _;
    }

    receive() external payable {
        _deposit(msg.sender, msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert Unauthorized();
        address previous = owner;
        owner = newOwner;
        emit OwnerTransferred(previous, newOwner);
    }

    function setController(address newController) external onlyOwner {
        address previous = controller;
        controller = newController;
        emit ControllerUpdated(previous, newController);
    }

    function configure(uint16 rateBps, uint40 withdrawalDelaySeconds) external {
        _configureSaver(msg.sender, rateBps, withdrawalDelaySeconds);
    }

    function configureFor(address saver, uint16 rateBps, uint40 withdrawalDelaySeconds) external onlyController {
        _configureSaver(saver, rateBps, withdrawalDelaySeconds);
    }

    function deposit() external payable {
        _deposit(msg.sender, msg.sender);
    }

    function depositFor(address saver) external payable onlyAuthorized(saver) {
        _deposit(saver, msg.sender);
    }

    function requestWithdrawal(uint256 amount) external {
        _requestWithdrawal(msg.sender, amount);
    }

    function requestWithdrawalFor(address saver, uint256 amount) external onlyController {
        _requestWithdrawal(saver, amount);
    }

    function cancelWithdrawal() external {
        _cancelWithdrawal(msg.sender);
    }

    function cancelWithdrawalFor(address saver) external onlyController {
        _cancelWithdrawal(saver);
    }

    function executeWithdrawal() external nonReentrant {
        _executeWithdrawal(msg.sender, msg.sender);
    }

    function executeWithdrawalFor(address saver) external nonReentrant onlyController {
        _executeWithdrawal(saver, saver);
    }

    function balanceOf(address saver) external view returns (uint256) {
        return savers[saver].balance;
    }

    function getAccount(address saver)
        external
        view
        returns (
            uint16 rateBps,
            uint40 withdrawalDelay,
            uint256 balance,
            uint256 totalDeposited,
            uint256 totalWithdrawn,
            uint256 pendingWithdrawalAmount,
            uint40 pendingAvailableAt
        )
    {
        Saver storage data = savers[saver];
        WithdrawalPlan storage plan = withdrawals[saver];

        return (
            data.rateBps,
            data.withdrawalDelay,
            data.balance,
            data.totalDeposited,
            data.totalWithdrawn,
            plan.amount,
            plan.availableAt
        );
    }

    function _configureSaver(address saver, uint16 rateBps, uint40 withdrawalDelaySeconds) internal {
        if (rateBps > MAX_BPS) revert InvalidPercentage();
        if (
            withdrawalDelaySeconds != 0 &&
            (withdrawalDelaySeconds < MIN_WITHDRAWAL_DELAY || withdrawalDelaySeconds > MAX_WITHDRAWAL_DELAY)
        ) {
            revert InvalidDelay();
        }

        Saver storage profile = savers[saver];

        profile.rateBps = rateBps;
        if (withdrawalDelaySeconds == 0 && profile.withdrawalDelay == 0) {
            profile.withdrawalDelay = MIN_WITHDRAWAL_DELAY;
        } else if (withdrawalDelaySeconds != 0) {
            profile.withdrawalDelay = withdrawalDelaySeconds;
        }
        profile.lastConfigAt = uint40(block.timestamp);

        emit SaverConfigured(saver, profile.rateBps, profile.withdrawalDelay);
    }

    function _deposit(address saver, address operator) internal {
        if (msg.value == 0) revert ZeroValue();

        Saver storage profile = savers[saver];
        if (profile.withdrawalDelay == 0) {
            profile.withdrawalDelay = MIN_WITHDRAWAL_DELAY;
        }

        profile.balance += msg.value;
        profile.totalDeposited += msg.value;

        emit Deposited(saver, operator, msg.value, profile.balance);
    }

    function _requestWithdrawal(address saver, uint256 amount) internal onlyAuthorized(saver) {
        if (amount == 0) revert ZeroValue();

        Saver storage profile = savers[saver];
        if (profile.balance < amount) revert InsufficientBalance();

        WithdrawalPlan storage plan = withdrawals[saver];
        if (plan.amount != 0) revert PendingWithdrawal();

        uint40 delay = profile.withdrawalDelay;
        if (delay == 0) {
            delay = MIN_WITHDRAWAL_DELAY;
            profile.withdrawalDelay = delay;
        }

        uint40 availableAt = uint40(block.timestamp) + delay;
        plan.amount = amount;
        plan.availableAt = availableAt;

        emit WithdrawalRequested(saver, amount, availableAt);
    }

    function _cancelWithdrawal(address saver) internal onlyAuthorized(saver) {
        WithdrawalPlan storage plan = withdrawals[saver];
        if (plan.amount == 0) revert NoPendingWithdrawal();

        plan.amount = 0;
        plan.availableAt = 0;

        emit WithdrawalCancelled(saver);
    }

    function _executeWithdrawal(address saver, address recipient) internal {
        WithdrawalPlan storage plan = withdrawals[saver];
        if (plan.amount == 0) revert NoPendingWithdrawal();
        if (block.timestamp < plan.availableAt) revert CooldownActive(plan.availableAt);

        uint256 amount = plan.amount;
        plan.amount = 0;
        plan.availableAt = 0;

        Saver storage profile = savers[saver];
        if (profile.balance < amount) revert InsufficientBalance();

        profile.balance -= amount;
        profile.totalWithdrawn += amount;

        (bool success, ) = payable(recipient).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit Withdrawn(saver, msg.sender, amount, profile.balance);
    }
}
