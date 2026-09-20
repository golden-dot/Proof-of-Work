# ProofWork

ProofWork is an evidence-backed work verification dApp built around a GenLayer Intelligent Contract.

## Why GenLayer is in the workflow

This is not a normal app that asks an off-chain server for an AI score and writes the answer onchain. The core decision happens inside the Intelligent Contract:

1. A requester publishes a work title and explicit acceptance criteria.
2. A contributor submits a public HTTPS evidence URL.
3. `verify_work()` retrieves the evidence from the web in a non-deterministic block.
4. A leader LLM returns a small structured verdict: approved, score, and summary.
5. Validators independently rerun the evidence + evaluation and reject the leader when the approval decision disagrees or the score differs beyond the tolerance.
6. Only the consensus-agreed result is written to contract storage.

This follows GenLayer's documented leader/validator and Equivalence Principle pattern for subjective decisions over web evidence.

## Repository layout

- `contracts/proof_work.py` — Intelligent Contract
- `tests/direct/test_proof_work.py` — fast direct-mode tests with web/LLM mocks
- `deploy/deployScript.ts` — deployment script
- `frontend/` — Next.js frontend using `genlayer-js` v2-dev

## Local development

The current GenLayer CLI repository is on the `0.40.0-clarke.1` line and its package references `genlayer-js#v2-dev`. The v2-dev SDK currently defines `studioDevnet` (chain ID 61997) at `https://studio-dev.genlayer.com/api`.

For the backend/tooling install, start from the current GenLayer boilerplate and keep the Python testing/linting versions compatible with the Studio/CLI release family you choose. Do not mix stable Studionet and Studio-dev RC components.

Typical commands:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
npm install -g genlayer

# Fast contract checks
genvm-lint check contracts/proof_work.py
pytest tests/direct/ -v

# Local Studio, if you use it
genlayer init
genlayer up
genlayer network set localnet

genlayer deploy --contract contracts/proof_work.py
```

For Studio-dev / “Studio Next” qualification, use the matching release-candidate stack. The canonical programmatic endpoint is `https://studio-dev.genlayer.com/api`, chain ID `61997`; `studio-next.genlayer.com` may be a browser alias for that deployment.

## Frontend

```bash
cd frontend
cp ../.env.example .env.local
npm install
npm run dev
```

The included `.env.example` is already configured for the deployed ProofWork contract at `0x4F0b22649e8503886761E87Aafe86869b4E444c5`. Copy it to `frontend/.env.local` when running locally.

## What to add next

- evidence adapters for GitHub commits, deployed URLs, and public documents
- milestone history and versioned criteria
- an explicit appeal/explanation view showing the transaction lifecycle
- fee profiling and a fee-aware transaction UX
- optional messages to another contract after an accepted verdict
- a public explorer page for verification records

## Important design rule

The evidence page is treated as untrusted content. The verifier prompt explicitly tells the LLM to ignore instructions embedded in the fetched page. Keep acceptance criteria narrow, observable, and testable.


## Deployed ProofWork contract

`0x4F0b22649e8503886761E87Aafe86869b4E444c5`

The frontend maps directly to the deployed contract methods:

- `create_work(work_id, title, criteria)`
- `submit_evidence(work_id, evidence_url)`
- `verify_work(work_id)`
- `get_work(work_id)`

The `verify_work` transaction is the core GenLayer workflow: it retrieves the submitted HTTPS evidence, evaluates it through nondeterministic web/LLM execution, and uses an independent validator evaluation before the verdict is written to contract storage.
