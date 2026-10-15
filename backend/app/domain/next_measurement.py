"""Next-measurement planning. A decision-support
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

The headline next step depends on what is still open: a test that decides the tumor
type if one is needed; otherwise, for glioblastoma, the MGMT assay (it changes the
treatment); otherwise no test changes the type and tissue confirmation is the step.
"""
from dataclasses import dataclass

from app.domain.contracts import Marker, StabilityVerdict
from app.domain.falsification import CONFIRMATORY_TEST
from app.domain.pathways import Pathway, pathway
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
class NextStep:
    kind: str  # "decide_type" | "decide_treatment" | "confirm" | "review"
    marker: Marker | None
    title: str
    reason: str


@dataclass(frozen=True)
class Plan:
    states: list[MarkerState]
    candidates: list[str]
    tests: list[TestSuggestion]
    pathways: list[Pathway]
    next_step: NextStep
    basis: list[str]


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


NAMES={Marker.IDH: "IDH", Marker.CODEL_1P19Q: "1p/19q", Marker.MGMT: "MGMT", Marker.GRADE: "Grade"}


def _source(state: MarkerState) -> str:
    if state.from_lab:
        return "lab result"
    if state.settled:
        return "stable model call"
    return state.reason


def _basis(states: dict[Marker, MarkerState], candidates: list[Category], age: int | None) -> list[str]:
    """One line per input, saying what it is and what it does to the pathway."""
    def value(m: Marker) -> str:
        s=states[m]
        return f"{s.value} ({_source(s)})" if s.settled else f"not settled ({_source(s)})"
    names=[c.name for c in candidates]
    lines=[
        f"IDH {value(Marker.IDH)} and 1p/19q {value(Marker.CODEL_1P19Q)}: "
        +(f"tumor type {names[0]}." if len(names)==1 else
          "tumor type not settled, so each possible type is shown." if names else
          "the settled calls fit no WHO type."),
    ]
    grade=states[Marker.GRADE]
    if grade.settled and grade.value=="grade 4":
        lines.append(f"Grade: {value(Marker.GRADE)}, high-grade pathway.")
    elif grade.settled:
        lines.append(f"Grade: {value(Marker.GRADE)}, lower-grade pathway (histology separates 2 from 3).")
    else:
        lines.append(f"Grade: {value(Marker.GRADE)}, lower- and high-grade lines both shown.")
    if any(c.name.startswith("Glioblastoma") for c in candidates):
        lines.append(f"MGMT {value(Marker.MGMT)}: decides how much temozolomide helps"
                     +(" and, with age, the regimen." if age is not None and age>70 else "."))
    else:
        lines.append(f"MGMT {value(Marker.MGMT)}: does not change the pathway for IDH-mutant types.")
    if age is not None:
        lines.append(f"Age {age}: used in the regimen and risk lines below.")
    return lines


def _next_step(tests: list[TestSuggestion], candidates: list[Category],
               states: dict[Marker, MarkerState]) -> NextStep:
    if not candidates:
        return NextStep("review", None, "Review the calls",
                        "The settled calls fit no WHO tumor type; tissue testing of all markers is needed.")
    deciding=[t for t in tests if t.marker!=Marker.MGMT and not t.settled]
    if deciding:
        t=deciding[0]
        n=len(candidates)
        worst=t.remaining_worst_case
        why=("It decides between the possible tumor types." if worst==1 and n>1 else
             f"It narrows {n} possible tumor types to at most {worst}." if worst is not None and worst<n else
             "The models can't settle this marker from the MRI, and it changes the treatment.")
        return NextStep("decide_type", t.marker, f"Test {NAMES[t.marker]} first", why)
    mgmt=states[Marker.MGMT]
    if len(candidates)==1 and candidates[0].name.startswith("Glioblastoma") and not mgmt.settled:
        return NextStep("decide_treatment", Marker.MGMT, "Test MGMT next",
                        "The models agree on glioblastoma. MGMT decides how much temozolomide helps, "
                        "and MRI cannot predict it.")
    name=candidates[0].name if len(candidates)==1 else "the tumor type"
    extra=(" Histology also separates grade 2 from 3, which decides between watch-and-wait and "
           "radiotherapy with chemotherapy." if states[Marker.GRADE].value=="grade 2-3"
           and not name.startswith("Glioblastoma") else "")
    return NextStep("confirm", None, "No test changes the tumor type",
                    f"The models agree on {name}. Confirming the markers on tissue is still standard "
                    f"before treatment (WHO 2021 integrated diagnosis).{extra}")


def plan(results: list[MarkerResult], age: int | None=None) -> Plan:
    states=[marker_state(r) for r in results]
    settled={s.marker: s.value for s in states if s.settled and s.value is not None}
    candidates=[c for c in CATEGORIES if _consistent(c, settled)]

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
    grade=settled.get(Marker.GRADE)
    mgmt_call=settled.get(Marker.MGMT)
    pathways=[pathway(c.name, grade, mgmt_call, age) for c in candidates]
    by_marker={s.marker: s for s in states}
    return Plan(
        states=states, candidates=[c.name for c in candidates], tests=tests, pathways=pathways,
        next_step=_next_step(tests, candidates, by_marker), basis=_basis(by_marker, candidates, age),
    )
