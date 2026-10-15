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
    assert any("grade 4" in s for s in high.steps) and high.grade_note is None


def test_every_pathway_is_labelled_and_sourced():
    assert "not a treatment recommendation" in LABEL
    assert any("EANO" in s for s in SOURCES) and any("vorasidenib" in s for s in SOURCES)
