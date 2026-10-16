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


def test_all_type_markers_stable_means_no_test_changes_the_type():
    # IDH-mutant, 1p/19q intact, grade 2-3, all stable; MGMT has no signal from MRI.
    result=plan(_results(
        _predicted(Marker.IDH, True), _predicted(Marker.CODEL_1P19Q, False),
        _predicted(Marker.MGMT, True, low_signal=True), _predicted(Marker.GRADE, False),
    ), age=22)
    assert result.candidates==["Astrocytoma, IDH-mutant"]
    assert result.next_step.kind=="confirm" and result.next_step.marker is None
    assert "grade 2 from 3" in result.next_step.reason


def test_settled_glioblastoma_makes_mgmt_the_next_step():
    result=plan(_results(
        _predicted(Marker.IDH, False), _predicted(Marker.CODEL_1P19Q, False),
        _predicted(Marker.MGMT, True, low_signal=True), _predicted(Marker.GRADE, True),
    ), age=83)
    assert result.next_step.kind=="decide_treatment" and result.next_step.marker==Marker.MGMT
    assert any("Age 83" in line for line in result.basis)


def test_unsettled_type_marker_comes_before_mgmt():
    result=plan(_results(
        _predicted(Marker.IDH, True, StabilityVerdict.ARBITRARY), _predicted(Marker.CODEL_1P19Q, False),
        _predicted(Marker.MGMT, True, low_signal=True), _predicted(Marker.GRADE, True),
    ))
    assert result.next_step.kind=="decide_type" and result.next_step.marker==Marker.IDH


def test_stable_calls_that_fit_no_tumor_type_are_never_offered_for_planning():
    """IDH wildtype with grade 2-3 is no WHO 2021 adult type: each Stable call must say to confirm first."""
    result=plan(_results(
        _predicted(Marker.IDH, False), _predicted(Marker.CODEL_1P19Q, False),
        _predicted(Marker.MGMT, True, low_signal=True), _predicted(Marker.GRADE, False),
    ))
    assert result.next_step.kind=="review"
    for t in result.tests:
        if t.settled:
            assert "usable for planning" not in t.reason and "confirm on tissue before planning" in t.reason



def test_agreement_on_a_near_coin_flip_is_never_stable():
    """Models agreeing at 0.59 on a 0.5 threshold sit on the boundary (doubt: ambiguity high)."""
    from app.domain.profile import apply_safety_screens
    stable=StabilityVerdict.STABLE
    near=SetPrediction(marker=Marker.IDH, model_probabilities=[0.57, 0.59, 0.71], verdict=stable,
                       model_version="sha256:x")
    clear=SetPrediction(marker=Marker.IDH, model_probabilities=[0.93, 0.95, 0.96], verdict=stable,
                        model_version="sha256:x")
    for prediction, expected, close in ((near, StabilityVerdict.CONTESTED, True), (clear, stable, False)):
        r=MarkerResult(Marker.IDH, "predicted", call=prediction.call, prediction=prediction)
        [screened]=apply_safety_screens([r], unlike_training=False)
        assert screened.prediction.verdict==expected and screened.close_call is close
        assert screened.call==r.call  # the call itself never changes, only how sure it is
