"""Next-measurement planning (CLAUDE.md §2.4 item 11). A decision-support
heuristic, not expected information gain and not clinical guidance.

WHO CNS5 (2021) adult-type diffuse gliomas, by the markers VBX estimates:
- Glioblastoma, IDH-wildtype: IDH wildtype; CNS WHO grade 4
- Astrocytoma, IDH-mutant: IDH mutant, 1p/19q intact; grade 2, 3 or 4
- Oligodendroglioma, IDH-mutant and 1p/19q-codeleted: grade 2 or 3

A marker is settled when the clinician entered its lab result, or when the
model set's call is Stable and the set has real signal. Settled markers rule
categories out; unsettled ones don't. Each remaining lab test is ranked first
by whether its marker is unsettled, then by how few categories could remain
after it in the worst case. MGMT never changes the category; it is listed as
treatment-relevant (temozolomide response).
"""
from dataclasses import dataclass

from app.domain.contracts import Marker, StabilityVerdict
from app.domain.falsification import CONFIRMATORY_TEST
from app.domain.profile import MarkerResult


@dataclass(frozen=True)
class Category:
    name: str
    requires: dict[Marker, frozenset[str]]


CATEGORIES=[
    Category("Glioblastoma, IDH-wildtype", {
        Marker.IDH: frozenset({"wildtype"}), Marker.GRADE: frozenset({"grade 4"}),
    }),
    Category("Astrocytoma, IDH-mutant", {
        Marker.IDH: frozenset({"mutant"}), Marker.CODEL_1P19Q: frozenset({"intact"}),
        Marker.GRADE: frozenset({"grade 2-3", "grade 4"}),
    }),
    Category("Oligodendroglioma, IDH-mutant and 1p/19q-codeleted", {
        Marker.IDH: frozenset({"mutant"}), Marker.CODEL_1P19Q: frozenset({"codeleted"}),
        Marker.GRADE: frozenset({"grade 2-3"}),
    }),
]
OUTCOMES: dict[Marker, tuple[str, str]]={
    Marker.IDH: ("mutant", "wildtype"),
    Marker.CODEL_1P19Q: ("codeleted", "intact"),
    Marker.GRADE: ("grade 4", "grade 2-3"),
}


@dataclass(frozen=True)
class MarkerState:
    marker: Marker
    value: str | None
    settled: bool
    from_lab: bool
    reason: str


@dataclass(frozen=True)
class TestSuggestion:
    marker: Marker
    test: str
    settled: bool
    remaining_worst_case: int | None
    reason: str


@dataclass(frozen=True)
class Plan:
    states: list[MarkerState]
    candidates: list[str]
    tests: list[TestSuggestion]


def marker_state(result: MarkerResult) -> MarkerState:
    m=result.marker
    if result.status=="known":
        return MarkerState(m, result.call, True, True, "lab result entered by the clinician")
    if result.status!="predicted" or result.prediction is None:
        return MarkerState(m, None, False, False, "no model estimate available")
    if result.low_signal:
        return MarkerState(m, result.call, False, False, "imaging carries almost no signal for this marker")
    verdict=result.prediction.verdict
    if verdict!=StabilityVerdict.STABLE:
        return MarkerState(m, result.call, False, False, f"model call is {verdict.value.lower()}")
    return MarkerState(m, result.call, True, False, "stable model call (still needs tissue confirmation)")


def _consistent(category: Category, values: dict[Marker, str]) -> bool:
    return all(category.requires.get(m) is None or v in category.requires[m] for m, v in values.items())


def plan(results: list[MarkerResult]) -> Plan:
    states=[marker_state(r) for r in results]
    settled={s.marker: s.value for s in states if s.settled and s.value is not None}
    candidates=[c for c in CATEGORIES if _consistent(c, settled)]
    if not candidates:
        # Settled calls or known lab inputs conflict with canonical WHO CNS5 combinations.
        # Fall back to all categories so confirmatory testing can resolve discordance.
        candidates=list(CATEGORIES)

    tests=[]
    for state in states:
        if state.marker==Marker.MGMT:
            continue
        if state.from_lab:
            continue
        worst=max(
            sum(1 for c in candidates if _consistent(c, {state.marker: outcome}))
            for outcome in OUTCOMES[state.marker]
        )
        narrows=worst<len(candidates)
        reason=(
            f"{state.reason}; would leave at most {worst} of {len(candidates)} candidate categories"
            if narrows else f"{state.reason}; does not narrow the remaining categories"
        )
        tests.append(TestSuggestion(
            state.marker, CONFIRMATORY_TEST[state.marker], state.settled, worst, reason,
        ))
    tests.sort(key=lambda t: (t.settled, t.remaining_worst_case or 0))

    mgmt=next(s for s in states if s.marker==Marker.MGMT)
    if not mgmt.from_lab:
        tests.append(TestSuggestion(
            Marker.MGMT, CONFIRMATORY_TEST[Marker.MGMT], mgmt.settled, None,
            f"{mgmt.reason}; does not change the category but informs temozolomide response",
        ))
    return Plan(states=states, candidates=[c.name for c in candidates], tests=tests)
