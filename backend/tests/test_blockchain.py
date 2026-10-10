from app.services.blockchain import BlockchainAuditLogger, compute_content_hash


class _FakeReceipt:
    def __init__(self, tx_hash: bytes, block_number: int) -> None:
        self.transactionHash = tx_hash
        self.blockNumber = block_number


class _FakeEth:
    def __init__(self, receipt: _FakeReceipt) -> None:
        self._receipt = receipt

    def wait_for_transaction_receipt(self, tx_hash):
        return self._receipt


class _FakeW3:
    def __init__(self, receipt: _FakeReceipt) -> None:
        self.eth = _FakeEth(receipt)


class _FakeFunctions:
    def __init__(self, recorder: dict, entry: tuple | None) -> None:
        self._recorder = recorder
        self._entry = entry

    def anchor(self, content_hash: bytes):
        self._recorder["content_hash_arg"] = content_hash
        return _CallableTransact(content_hash)

    def getEntry(self, entry_id: int):
        return _CallableCall(self._entry)


class _CallableTransact:
    def __init__(self, content_hash: bytes) -> None:
        self._content_hash = content_hash

    def transact(self, params: dict):
        return b"\xab\xcd"


class _CallableCall:
    def __init__(self, entry: tuple | None) -> None:
        self._entry = entry

    def call(self):
        if self._entry is None:
            raise RuntimeError("no such entry")
        return self._entry


class _FakeContract:
    def __init__(self, recorder: dict, entry: tuple | None = None) -> None:
        self.functions = _FakeFunctions(recorder, entry)


def test_anchor_sends_correct_content_hash_and_returns_receipt_info() -> None:
    recorder: dict = {}
    receipt = _FakeReceipt(tx_hash=b"\xab\xcd", block_number=42)
    w3 = _FakeW3(receipt)
    contract = _FakeContract(recorder)
    logger = BlockchainAuditLogger(w3=w3, contract=contract, account="0xabc")

    payload = {"url": "https://example.com", "verdict": "benign", "risk_score": 5.0}
    result = logger.anchor(payload)

    assert result is not None
    assert result["content_hash"] == compute_content_hash(payload).hex()
    assert result["block_number"] == 42
    assert recorder["content_hash_arg"] == compute_content_hash(payload)


def test_anchor_is_deterministic_for_the_same_payload() -> None:
    payload = {"url": "https://example.com", "verdict": "benign", "risk_score": 5.0}
    # dict key order must not matter - same logical content, same hash
    reordered = {"risk_score": 5.0, "url": "https://example.com", "verdict": "benign"}

    assert compute_content_hash(payload) == compute_content_hash(reordered)


def test_anchor_failure_degrades_gracefully_without_raising() -> None:
    class ExplodingEth:
        def wait_for_transaction_receipt(self, tx_hash):
            raise ConnectionError("chain unreachable")

    class ExplodingW3:
        eth = ExplodingEth()

    contract = _FakeContract({})
    logger = BlockchainAuditLogger(w3=ExplodingW3(), contract=contract, account="0xabc")

    # must not raise, even though the chain is completely unreachable
    result = logger.anchor({"url": "https://example.com"})
    assert result is None


def test_get_entry_returns_normalized_dict() -> None:
    entry = (b"\x11\x22", 1700000000, "0xdeadbeef")
    contract = _FakeContract({}, entry=entry)
    logger = BlockchainAuditLogger(w3=_FakeW3(_FakeReceipt(b"", 0)), contract=contract, account="0xabc")

    result = logger.get_entry(0)

    assert result == {"content_hash": "1122", "timestamp": 1700000000, "submitted_by": "0xdeadbeef"}


def test_get_entry_failure_degrades_gracefully() -> None:
    contract = _FakeContract({}, entry=None)  # simulates a contract call that raises
    logger = BlockchainAuditLogger(w3=_FakeW3(_FakeReceipt(b"", 0)), contract=contract, account="0xabc")

    assert logger.get_entry(999) is None


class _FunctionsWithBuild(_FakeFunctions):
    """Adds .build_transaction() support for the real-signing path."""

    def anchor(self, content_hash: bytes):
        self._recorder["content_hash_arg"] = content_hash
        return _CallableTransactAndBuild(content_hash)


class _CallableTransactAndBuild(_CallableTransact):
    def build_transaction(self, params: dict):
        return {"content_hash": self._content_hash, **params}


class _FakeAccountModule:
    def __init__(self, recorder: dict) -> None:
        self._recorder = recorder

    def sign_transaction(self, tx: dict, private_key: str):
        self._recorder["signed_tx"] = tx
        self._recorder["private_key_used"] = private_key
        return type("SignedTx", (), {"raw_transaction": b"\xde\xad\xbe\xef"})()


class _EthWithSigning(_FakeEth):
    def __init__(self, receipt: _FakeReceipt, recorder: dict) -> None:
        super().__init__(receipt)
        self._recorder = recorder
        self.account = _FakeAccountModule(recorder)
        self.chain_id = 1337

    def get_transaction_count(self, account: str):
        self._recorder["nonce_requested_for"] = account
        return 5

    def send_raw_transaction(self, raw: bytes):
        self._recorder["raw_tx_sent"] = raw
        return b"\xab\xcd"


class _W3WithSigning:
    def __init__(self, receipt: _FakeReceipt, recorder: dict) -> None:
        self.eth = _EthWithSigning(receipt, recorder)


def test_anchor_with_private_key_signs_locally_not_via_node_transact() -> None:
    """
    Real fix 2026-09-25: with a private key configured, the tx must be
    built + signed locally and submitted as already-signed raw bytes -
    never routed through the node's own .transact() (which would mean
    trusting the node to hold and use our key, exactly what this fix
    replaces).
    """
    recorder: dict = {}
    receipt = _FakeReceipt(tx_hash=b"\xab\xcd", block_number=7)
    w3 = _W3WithSigning(receipt, recorder)
    contract = _FakeContract(recorder)
    contract.functions = _FunctionsWithBuild(recorder, entry=None)

    logger = BlockchainAuditLogger(w3=w3, contract=contract, account="0xSIGNER", private_key="0xPRIVATEKEY")
    result = logger.anchor({"url": "https://example.com"})

    assert result is not None
    assert recorder["private_key_used"] == "0xPRIVATEKEY"
    assert recorder["signed_tx"]["from"] == "0xSIGNER"
    assert recorder["signed_tx"]["chainId"] == 1337
    assert recorder["nonce_requested_for"] == "0xSIGNER"
    assert recorder["raw_tx_sent"] == b"\xde\xad\xbe\xef"


def test_anchor_without_private_key_falls_back_to_node_transact() -> None:
    """No key configured (local Ganache/dev convenience) - the old
    node-trust .transact() path must still work unchanged."""
    recorder: dict = {}
    receipt = _FakeReceipt(tx_hash=b"\xab\xcd", block_number=1)
    w3 = _FakeW3(receipt)
    contract = _FakeContract(recorder)

    logger = BlockchainAuditLogger(w3=w3, contract=contract, account="0xNODEACCOUNT", private_key=None)
    result = logger.anchor({"url": "https://example.com"})

    assert result is not None
    assert "signed_tx" not in recorder  # never touched the signing path
