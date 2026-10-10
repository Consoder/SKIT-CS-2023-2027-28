// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AuditLog
/// @notice Sprint 6, Task 4 (Blockchain audit logging — due 10-03-2027).
/// Anchors a hash of each URL analysis result on-chain. The contract never
/// stores the analysis itself (too expensive, and not the point) - it
/// stores just enough to let anyone later prove a specific result existed,
/// unmodified, at a specific time: a tamper-evident fingerprint, not a
/// tamper-evident database.
contract AuditLog {
    struct Entry {
        bytes32 contentHash;
        uint256 timestamp;
        address submittedBy;
    }

    Entry[] private entries;

    event EntryAnchored(uint256 indexed entryId, bytes32 indexed contentHash, uint256 timestamp, address submittedBy);

    /// @notice Anchors a new content hash. Returns the entry's index so the
    /// backend can store it alongside the analysis row for later lookup.
    function anchor(bytes32 contentHash) external returns (uint256 entryId) {
        entries.push(Entry({contentHash: contentHash, timestamp: block.timestamp, submittedBy: msg.sender}));
        entryId = entries.length - 1;
        emit EntryAnchored(entryId, contentHash, block.timestamp, msg.sender);
    }

    /// @notice Reads back one anchored entry for verification.
    function getEntry(uint256 entryId) external view returns (bytes32 contentHash, uint256 timestamp, address submittedBy) {
        Entry storage e = entries[entryId];
        return (e.contentHash, e.timestamp, e.submittedBy);
    }

    function totalEntries() external view returns (uint256) {
        return entries.length;
    }
}
