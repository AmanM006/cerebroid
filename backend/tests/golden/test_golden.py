"""Golden regression set: the committed models must keep producing
the frozen outputs for 10 held-out patients. An intended model update regenerates
expected.json in the same commit; anything else that moves a prediction fails here."""
import json
import math

import pytest

from tests.golden.snapshot import EXPECTED, load, snapshot

pytestmark=pytest.mark.skipif(not EXPECTED.is_file(), reason="golden snapshot not generated")
REGENERATE="cd backend && .venv/Scripts/python -m tests.golden.snapshot --write"


@pytest.fixture(scope="module")
def current():
    return snapshot(*load())


@pytest.fixture(scope="module")
def expected():
    return json.loads(EXPECTED.read_text(encoding="utf-8"))


def test_snapshot_was_taken_with_the_committed_models(current, expected):
    assert current["model_versions"]==expected["model_versions"], (
        f"model files changed: if intended, regenerate the golden snapshot ({REGENERATE})"
    )
    assert current["feature_pipeline_version"]==expected["feature_pipeline_version"]


def _diff(path: str, want, got, problems: list[str]) -> None:
    if isinstance(want, dict) and isinstance(got, dict):
        for key in sorted(set(want)|set(got)):
            _diff(f"{path}.{key}", want.get(key), got.get(key), problems)
    elif isinstance(want, float) and isinstance(got, float):
        if not math.isclose(want, got, abs_tol=1e-6):
            problems.append(f"{path}: expected {want}, got {got}")
    elif want!=got:
        problems.append(f"{path}: expected {want!r}, got {got!r}")


def test_outputs_match_the_golden_snapshot(current, expected):
    if current["model_versions"]!=expected["model_versions"]:
        pytest.skip("model files changed; see test_snapshot_was_taken_with_the_committed_models")
    problems: list[str]=[]
    _diff("patients", expected["patients"], current["patients"], problems)
    assert not problems, "predictions drifted:\n"+"\n".join(problems[:20])
