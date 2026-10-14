"""Next-measurement heuristic: WHO CNS5 categories narrow only on settled markers,
and the test that narrows the open categories most comes first."""
from app.domain.contracts import Marker, SetPrediction, StabilityVerdict
from app.domain.next_measurement import plan
from app.domain.profile import MarkerResult

ALL=[
    "Glioblastoma, IDH-wildtype",
    "Astrocytoma, IDH-mutant",
    "Oligodendroglioma, IDH-mutant and 1p/19q-codeleted",
]


def _predicted(marker: Marker, call_positive: bool, verdict=StabilityVerdict.STABLE, low_signal=False):
    p=0.9 if call_positive else 0.1
    prediction=SetPrediction(
        marker=marker, model_probabilities=[p, p, p], verdict=verdict, model_version="sha256:x",
    )
    return MarkerResult(
        marker, "predicted", call=prediction.call, prediction=prediction, low_signal=low_signal,
    )


def _known(marker: Marker, call: str):
    return MarkerResult(marker, "known", call=call)


def _results(idh, codel, mgmt, grade):
    return [idh, codel, mgmt, grade]


def test_nothing_settled_keeps_every_category_open():
    contested=StabilityVerdict.CONTESTED
    result=plan(_results(
        _predicted(Marker.IDH, True, contested), _predicted(Marker.CODEL_1P19Q, False, contested),
        _predicted(Marker.MGMT, True, contested), _predicted(Marker.GRADE, True, contested),
    ))
    assert result.candidates==ALL
    assert result.tests[0].marker==Marker.IDH  # IDH splits wildtype from both mutant categories
    assert result.tests[-1].marker==Marker.MGMT


def test_stable_idh_wildtype_and_grade_4_leave_glioblastoma():
    result=plan(_results(
        _predicted(Marker.IDH, False), _predicted(Marker.CODEL_1P19Q, False),
        _predicted(Marker.MGMT, True), _predicted(Marker.GRADE, True),
    ))
    assert result.candidates==["Glioblastoma, IDH-wildtype"]


def test_known_idh_mutant_makes_1p19q_the_deciding_test():
    result=plan(_results(
        _known(Marker.IDH, "mutant"), _predicted(Marker.CODEL_1P19Q, False, StabilityVerdict.CONTESTED),
        _predicted(Marker.MGMT, True), _predicted(Marker.GRADE, False, StabilityVerdict.CONTESTED),
    ))
    assert result.candidates==ALL[1:]
    assert all(t.marker!=Marker.IDH for t in result.tests)  # already known: never suggested
    assert result.tests[0].marker==Marker.CODEL_1P19Q
    assert result.tests[0].remaining_worst_case==1


def test_low_signal_marker_is_never_treated_as_settled():
    result=plan(_results(
        _predicted(Marker.IDH, True), _predicted(Marker.CODEL_1P19Q, False),
        _predicted(Marker.MGMT, True, low_signal=True), _predicted(Marker.GRADE, False),
    ))
    mgmt=next(s for s in result.states if s.marker==Marker.MGMT)
    assert mgmt.settled is False and "no signal" in mgmt.reason
    assert "temozolomide" in result.tests[-1].reason
