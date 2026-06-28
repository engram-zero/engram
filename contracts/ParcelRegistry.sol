// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ParcelRegistry
/// @notice Owns Engram land parcel IDs on 0G Chain.
/// @dev No owner/admin. A parcel can be claimed once; only its owner can update its data root.
contract ParcelRegistry {
    struct Parcel {
        address owner;
        bytes32 dataRoot;
        uint96 pricePaid;
        uint16 commissionBps;
        uint64 updatedAt;
    }

    mapping(bytes32 => Parcel) public parcels;

    event ParcelClaimed(
        bytes32 indexed parcelId,
        address indexed owner,
        bytes32 dataRoot,
        uint256 pricePaid,
        uint16 commissionBps,
        uint64 at
    );
    event ParcelDataUpdated(bytes32 indexed parcelId, address indexed owner, bytes32 dataRoot, uint16 commissionBps, uint64 at);

    function ownerOf(bytes32 parcelId) external view returns (address) {
        return parcels[parcelId].owner;
    }

    function claim(bytes32 parcelId, bytes32 dataRoot, uint16 commissionBps) external payable {
        require(parcelId != bytes32(0), "parcelId=0");
        require(parcels[parcelId].owner == address(0), "claimed");
        require(commissionBps <= 5000, "commission too high");

        uint64 at = uint64(block.timestamp);
        parcels[parcelId] = Parcel({
            owner: msg.sender,
            dataRoot: dataRoot,
            pricePaid: uint96(msg.value),
            commissionBps: commissionBps,
            updatedAt: at
        });

        emit ParcelClaimed(parcelId, msg.sender, dataRoot, msg.value, commissionBps, at);
    }

    function updateData(bytes32 parcelId, bytes32 dataRoot, uint16 commissionBps) external {
        Parcel storage parcel = parcels[parcelId];
        require(parcel.owner == msg.sender, "not owner");
        require(commissionBps <= 5000, "commission too high");

        uint64 at = uint64(block.timestamp);
        parcel.dataRoot = dataRoot;
        parcel.commissionBps = commissionBps;
        parcel.updatedAt = at;

        emit ParcelDataUpdated(parcelId, msg.sender, dataRoot, commissionBps, at);
    }
}
