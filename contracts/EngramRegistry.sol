// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title EngramRegistry
/// @notice Stores the latest 0G Storage MemoryBundle root for each wallet.
/// @dev No owner or admin: every wallet can only update its own memory pointer.
contract EngramRegistry {
    mapping(address => bytes32) public rootOf;
    mapping(address => uint64) public updatedAt;

    event RootUpdated(address indexed wallet, bytes32 root, uint64 at);

    function setRoot(bytes32 root) external {
        uint64 at = uint64(block.timestamp);
        rootOf[msg.sender] = root;
        updatedAt[msg.sender] = at;
        emit RootUpdated(msg.sender, root, at);
    }
}
