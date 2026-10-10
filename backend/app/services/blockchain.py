"""
Sprint 6, Task 4 (Blockchain audit logging — due 10-03-2027):
anchors a hash of each analysis result on the AuditLog contract. Same
resilience pattern as threat_intel.py and cache.py: a blockchain outage or
missing configuration degrades to "not anchored" rather than breaking the
request - the analysis result is still returned to the caller either way.

Real key signing (done ahead of schedule 2026-09-25): the original version
relied on the connected node holding an unlocked account and signing on
our behalf via .transact() - fine for a local Ganache/dev chain, but a
real production node won't (and shouldn't) hold a private key on our
behalf. Now signs locally with our own key when BLOCKCHAIN_PRIVATE_KEY is
configured: build the transaction, sign it with eth_account, send the raw
signed bytes - the node never sees the private key. Falls back to the old
node-trust path only when no key is configured, purely for local
Ganache/dev convenience where wallet setup would be pure friction.
"""

import hashlib
import json
import logging
from pathlib import Path
from typing import Any

from app.core.config import get_settings

logger = logging.getLogger(__name__)

CONTRACT_ABI_PATH = Path(__file__).resolve().parent.parent.parent / "contracts" / "build" / "AuditLog.abi"


def compute_content_hash(payload: dict[str, Any]) -> bytes:
    """Deterministic hash of an analysis result - this is what actually gets anchored on-chain."""
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(canonical).digest()


class BlockchainAuditLogger:
    def __init__(self, w3: Any, contract: Any, account: str, private_key: str | None = None) -> None:
        self._w3 = w3
        self._contract = contract
        self._account = account
        self._private_key = private_key

    def _send_anchor_tx(self, content_hash: bytes):
        if self._private_key is None:
            # Dev/Ganache convenience path: node holds the unlocked account
            # and signs for us. Never the path a real deployment should use.
            return self._contract.functions.anchor(content_hash).transact({"from": self._account})

        # Real signing path: we hold the key, the node never does. Build
        # the tx ourselves (nonce/gas/chain_id all explicit - a node can't
        # forge a transaction it never got to sign), sign locally, submit
        # only the already-signed raw bytes.
        tx = self._contract.functions.anchor(content_hash).build_transaction({
            "from": self._account,
            "nonce": self._w3.eth.get_transaction_count(self._account),
            "chainId": self._w3.eth.chain_id,
        })
        signed = self._w3.eth.account.sign_transaction(tx, private_key=self._private_key)
        return self._w3.eth.send_raw_transaction(signed.raw_transaction)

    def anchor(self, payload: dict[str, Any]) -> dict[str, Any] | None:
        content_hash = compute_content_hash(payload)
        try:
            tx_hash = self._send_anchor_tx(content_hash)
            receipt = self._w3.eth.wait_for_transaction_receipt(tx_hash)
        except Exception as exc:  # noqa: BLE001 - a chain outage must never break the request it belongs to
            logger.warning("blockchain anchor failed, continuing without an on-chain record: %s", exc)
            return None

        return {
            "tx_hash": receipt.transactionHash.hex(),
            "content_hash": content_hash.hex(),
            "block_number": receipt.blockNumber,
        }

    def get_entry(self, entry_id: int) -> dict[str, Any] | None:
        try:
            content_hash, timestamp, submitted_by = self._contract.functions.getEntry(entry_id).call()
        except Exception as exc:  # noqa: BLE001 - see anchor() above
            logger.warning("blockchain read failed: %s", exc)
            return None

        return {
            "content_hash": content_hash.hex(),
            "timestamp": timestamp,
            "submitted_by": submitted_by,
        }


def get_default_blockchain_logger() -> BlockchainAuditLogger | None:
    """None means blockchain anchoring is disabled - callers must handle that, same as get_default_cache()."""
    settings = get_settings()
    if not (settings.BLOCKCHAIN_RPC_URL and settings.BLOCKCHAIN_CONTRACT_ADDRESS and settings.BLOCKCHAIN_ACCOUNT_ADDRESS):
        return None

    from web3 import Web3

    w3 = Web3(Web3.HTTPProvider(settings.BLOCKCHAIN_RPC_URL))
    abi = json.loads(CONTRACT_ABI_PATH.read_text())
    contract = w3.eth.contract(address=settings.BLOCKCHAIN_CONTRACT_ADDRESS, abi=abi)
    return BlockchainAuditLogger(
        w3=w3,
        contract=contract,
        account=settings.BLOCKCHAIN_ACCOUNT_ADDRESS,
        private_key=settings.BLOCKCHAIN_PRIVATE_KEY,
    )
