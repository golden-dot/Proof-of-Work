def test_create_and_submit(direct_vm, direct_deploy):
    contract = direct_deploy("contracts/proof_work.py")
    contract.create_work(
        "demo-001",
        "Landing page delivery",
        "The evidence must show a responsive landing page with a clear headline and working navigation.",
    )
    contract.submit_evidence("demo-001", "https://example.com/demo")

    work = contract.get_work("demo-001")
    assert work["id"] == "demo-001"
    assert work["status"] == "SUBMITTED"
    assert work["evidence_url"] == "https://example.com/demo"


def test_duplicate_work_fails(direct_vm, direct_deploy):
    contract = direct_deploy("contracts/proof_work.py")
    contract.create_work("demo-001", "Test", "The submission must demonstrate the requested work.")
    with direct_vm.expect_revert("work already exists"):
        contract.create_work("demo-001", "Test again", "Another version")


def test_verify_work_with_mocks(direct_vm, direct_deploy):
    contract = direct_deploy("contracts/proof_work.py")
    contract.create_work(
        "demo-002",
        "Documentation delivery",
        "The evidence must include setup instructions and a usage example.",
    )
    contract.submit_evidence("demo-002", "https://example.com/docs")

    direct_vm.mock_web(
        r"https://example\.com/docs.*",
        {"status": 200, "body": "Setup instructions. Usage example. Configuration steps."},
    )
    direct_vm.mock_llm(
        r".*You are an evidence-based work verifier.*",
        '{"approved": true, "score": 92, "summary": "The evidence contains setup instructions and a concrete usage example, satisfying the stated criteria."}',
    )

    contract.verify_work("demo-002")
    work = contract.get_work("demo-002")
    assert work["status"] == "VERIFIED"
    assert work["approved"] is True
    assert work["score"] == 92
