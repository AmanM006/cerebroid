"""Guideline pathways: one per tumor type, changed by the markers where the guideline says so."""
from app.domain.pathways import LABEL, SOURCES, pathway


def test_glioblastoma_pathway_depends_on_mgmt():
    methylated=pathway("Glioblastoma, IDH-wildtype", "grade 4", "methylated")
    unmethylated=pathway("Glioblastoma, IDH-wildtype", "grade 4", "unmethylated")
    unknown=pathway("Glioblastoma, IDH-wildtype", None, None)
    assert any("temozolomide" in s for s in methylated.steps)
    assert "benefit" in methylated.mgmt_note and "little" in unmethylated.mgmt_note
    assert "order the MGMT assay" in unknown.mgmt_note


def test_oligodendroglioma_gets_radiotherapy_and_pcv():
    p=pathway("Oligodendroglioma, IDH-mutant and 1p/19q-codeleted", "grade 2-3", "methylated")
    assert any("PCV" in s for s in p.steps)
    assert p.grade_note is not None and "vorasidenib" in p.grade_note


def test_astrocytoma_grade_changes_the_pathway():
    low=pathway("Astrocytoma, IDH-mutant", "grade 2-3", None)
    high=pathway("Astrocytoma, IDH-mutant", "grade 4", None)
    assert any("Grade 3" in s for s in low.steps) and low.grade_note and "vorasidenib" in low.grade_note
    assert any("Grade 4" in s for s in high.steps) and high.grade_note is None


def test_glioblastoma_regimen_follows_age_and_mgmt():
    young=pathway("Glioblastoma, IDH-wildtype", "grade 4", None, age=51)
    old_methylated=pathway("Glioblastoma, IDH-wildtype", "grade 4", "methylated", age=83)
    old_unmethylated=pathway("Glioblastoma, IDH-wildtype", "grade 4", "unmethylated", age=83)
    assert any("six cycles" in s for s in young.steps) and not any("over 70" in s for s in young.steps)
    assert not any("six cycles" in s for s in old_methylated.steps)
    assert any("temozolomide" in s for s in old_methylated.steps[1:])
    assert any("radiotherapy alone" in s for s in old_unmethylated.steps)


def test_low_grade_risk_line_uses_age():
    young=pathway("Astrocytoma, IDH-mutant", "grade 2-3", None, age=22)
    older=pathway("Astrocytoma, IDH-mutant", "grade 2-3", None, age=59)
    assert any("age 22 is lower risk" in s for s in young.steps)
    assert any("age 59 counts as higher risk" in s for s in older.steps)


def test_every_pathway_is_labelled_and_sourced():
    assert "not a treatment recommendation" in LABEL
    assert any("EANO" in s for s in SOURCES) and any("vorasidenib" in s for s in SOURCES)
