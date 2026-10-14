"""Falsification panel (CLAUDE.md §2.4 item 9): the case for a call, the case
against it, the strongest competing call, and what would overturn it.

Every sentence is filled from a fixed template using computed results, and
every claim lists the evidence IDs it rests on. Nothing here is free text from
a language model, and no claim exists without linked evidence.
"""
from dataclasses import dataclass

from app.domain.contracts import MARKER_LABELS, Marker, Provenance, SetPrediction
from app.domain.explain import Explanation
from app.domain.tipping import Tipping

TOP_ITEMS=3

# The lab test that settles each marker. Standard practice, not a model output.
CONFIRMATORY_TEST: dict[Marker, str]={
    Marker.IDH: "IDH1 R132H immunohistochemistry, then IDH1/IDH2 sequencing if negative",
    Marker.CODEL_1P19Q: "1p/19q co-deletion testing (FISH or copy-number analysis)",
    Marker.MGMT: "MGMT promoter methylation assay (methylation-specific PCR or pyrosequencing)",
    Marker.GRADE: "Histopathological grading of tissue (WHO CNS5)",
}


@dataclass(frozen=True)
class Claim:
    short: str
    text: str
    evidence_ids: list[str]
    provenance: Provenance


@dataclass(frozen=True)
class Falsification:
    supporting: list[Claim]
    contradicting: list[Claim]
    competing: Claim
    overturn: list[Claim]
    confirmatory_test: str


def _points(weight: float) -> str:
    return f"{weight*100:.1f} percentage points"


def _value(t: Tipping, value: float) -> str:
    if t.unit=="years":
        return f"{round(value)} years"
    if t.unit=="fraction":
        return f"{round(value*100)}%"
    if t.unit=="mm³":
        return f"{value/1000:.1f} cm³"
    return f"{value:.2f}"


def build_falsification(
    marker: Marker,
    variant: str,
    prediction: SetPrediction,
    explanation: Explanation,
    labels: dict[str, str],
    tipping: list[Tipping],
) -> Falsification:
    """labels maps evidence group id to its human label (from the explanation)."""
    positive, negative=MARKER_LABELS[marker]
    call=prediction.call
    other=negative if call==positive else positive
    toward_call="toward_positive" if call==positive else "toward_negative"

    supporting: list[Claim]=[]
    contradicting: list[Claim]=[]
    for item in explanation.items:
        sentence=(
            f"{labels[item.group]} moves the models toward {call if item.direction==toward_call else other} "
            f"by {_points(item.weight)} on average"
        )
        if item.agreement is not None:
            sentence+=f"; {round(item.agreement*100)}% of models agree on the direction"
        claim=Claim(
            short=labels[item.group], text=sentence+".", evidence_ids=[item.evidence_id],
            provenance=item.provenance,
        )
        (supporting if item.direction==toward_call else contradicting).append(claim)

    other_votes=round((1.0-prediction.agreement)*prediction.n_models)
    set_id=f"{marker.value}:{variant}:set"
    competing=Claim(
        short=f"{other}: {other_votes} of {prediction.n_models} models",
        text=f"The competing call is {other}: {other_votes} of {prediction.n_models} equally good models "
        f"favour it; the set's median probability of {positive} is {prediction.prob_median:.0%}.",
        evidence_ids=[set_id],
        provenance=Provenance.MODEL_INFERRED,
    )

    overturn=[]
    for t in tipping:
        if t.flip_at is None:
            continue
        overturn.append(Claim(
            short=f"{t.label} {_value(t, t.flip_at)} → {t.flips_to}",
            text=f"{t.label} of {_value(t, t.flip_at)} instead of {_value(t, t.current)} would flip the "
            f"majority call to {t.flips_to}, with everything else unchanged.",
            evidence_ids=[f"{marker.value}:{variant}:tipping:{t.column}"],
            provenance=Provenance.MODEL_INFERRED,
        ))
    return Falsification(
        supporting=supporting[:TOP_ITEMS],
        contradicting=contradicting[:TOP_ITEMS],
        competing=competing,
        overturn=overturn,
        confirmatory_test=CONFIRMATORY_TEST[marker],
    )
