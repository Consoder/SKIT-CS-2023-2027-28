"""
One-time manual verification script, NOT part of the automated test suite.

Deploys the real, Docker-compiled AuditLog contract to a real Ganache
container and exercises anchor()/getEntry() end to end, proving the
contract and BlockchainAuditLogger client actually work together against
a real EVM - not just against a mock.

Usage (Ganache container must already be running on 127.0.0.1:8545):
    python scripts/verify_blockchain_live.py
"""

import json
from pathlib import Path

from web3 import Web3

from app.services.blockchain import BlockchainAuditLogger, compute_content_hash

CONTRACTS_DIR = Path(__file__).resolve().parent.parent / "contracts" / "build"


def main() -> None:
    w3 = Web3(Web3.HTTPProvider("http://127.0.0.1:8545"))
    assert w3.is_connected(), "Ganache RPC not reachable at 127.0.0.1:8545"
    print(f"Connected to chain, latest block: {w3.eth.block_number}")

    abi = json.loads((CONTRACTS_DIR / "AuditLog.abi").read_text())
    bytecode = (CONTRACTS_DIR / "AuditLog.bin").read_text().strip()

    account = w3.eth.accounts[0]
    print(f"Deploying from account: {account}")

    ContractFactory = w3.eth.contract(abi=abi, bytecode=bytecode)
    tx_hash = ContractFactory.constructor().transact({"from": account})
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    print(f"Contract deployed at: {receipt.contractAddress} (block {receipt.blockNumber})")

    contract = w3.eth.contract(address=receipt.contractAddress, abi=abi)
    logger = BlockchainAuditLogger(w3=w3, contract=contract, account=account)

    payload = {"url": "https://example.com", "verdict": "benign", "risk_score": 5.0}
    result = logger.anchor(payload)
    assert result is not None, "anchor() returned None - it should have succeeded against a live chain"
    print(f"Anchored: {result}")

    expected_hash = compute_content_hash(payload).hex()
    assert result["content_hash"] == expected_hash
    print("Content hash matches expected value.")

    entry = logger.get_entry(0)
    print(f"Read back entry 0: {entry}")
    assert entry["content_hash"] == expected_hash, "on-chain stored hash does not match what was anchored"
    print("\nSUCCESS: real contract deployed, real transaction mined, real on-chain read verified.")


if __name__ == "__main__":
    main()
