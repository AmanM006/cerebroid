"""Guideline treatment pathway for each WHO CNS5 adult diffuse-glioma category.

A summary for tumor-board discussion, not a treatment recommendation: every line
paraphrases a published source, and the right pathway for a patient also depends
on age, performance status, extent of resection and the confirmed tissue result.

Sources:
- EANO guidelines on the diagnosis and treatment of diffuse gliomas of adulthood,
  Weller et al., Nature Reviews Clinical Oncology 2021 (PMC7904519)
- FDA approval of vorasidenib (Voranigo), 6 August 2024: grade 2 astrocytoma or
  oligodendroglioma with a susceptible IDH1/IDH2 mutation, after surgery

How the markers interact: IDH and 1p/19q decide the tumor type; grade separates the
lower-grade from the high-grade pathway; MGMT matters most in glioblastoma, where it
predicts benefit from temozolomide and steers treatment of older patients.
"""
from dataclasses import dataclass

SOURCES=(
    "EANO guideline on diffuse gliomas of adulthood (Weller et al., Nat Rev Clin Oncol 2021)",
    "FDA approval of vorasidenib for grade 2 IDH-mutant glioma (August 2024)",
)
LABEL="Guideline summary for tumor-board discussion, not a treatment recommendation."


@dataclass(frozen=True)
class Pathway:
    category: str
    steps: list[str]
    mgmt_note: str
    grade_note: str | None


def pathway(category: str, grade: str | None, mgmt: str | None) -> Pathway:
    """grade / mgmt: the settled call for that marker, or None when it is not settled."""
    if category.startswith("Glioblastoma"):
        mgmt_note={
            "methylated": "MGMT methylated: predicts benefit from temozolomide.",
            "unmethylated": "MGMT unmethylated: little expected benefit from temozolomide; "
                            "clinical trials are often considered.",
        }.get(mgmt or "", "MGMT status decides how much temozolomide is expected to help, and steers "
                          "treatment of older patients: order the MGMT assay.")
        return Pathway(category, [
            "Maximal safe resection if feasible, otherwise biopsy.",
            "Radiotherapy with concomitant temozolomide, then six cycles of maintenance temozolomide "
            "(patients under about 70 in good condition).",
            "Older patients not suited to chemoradiotherapy: radiotherapy alone or temozolomide alone, "
            "chosen by MGMT status.",
        ], mgmt_note, None)

    lower=["Resection if feasible, otherwise biopsy."]
    if category.startswith("Oligodendroglioma"):
        steps=lower+["Radiotherapy followed by PCV chemotherapy (procarbazine, lomustine, vincristine)."]
        grade_note={
            "grade 2-3": "Grade 2 after surgery: vorasidenib (IDH inhibitor) is FDA-approved since 2024.",
            "grade 4": "Grade 4 is not expected for oligodendroglioma (WHO grades 2-3): re-check the calls.",
        }.get(grade or "", "Grade 2 after surgery: vorasidenib (IDH inhibitor) is FDA-approved since 2024.")
    else:
        if grade=="grade 4":
            steps=lower+["High-grade (grade 4): radiotherapy followed by temozolomide; evidence for this "
                         "group is more limited."]
            grade_note=None
        else:
            steps=lower+[
                "Grade 2 needing further treatment: radiotherapy followed by PCV chemotherapy.",
                "Grade 3: radiotherapy followed by temozolomide (or PCV).",
            ]
            grade_note="Grade 2 after surgery: vorasidenib (IDH inhibitor) is FDA-approved since 2024."
    mgmt_note=(
        "MGMT is methylated in most IDH-mutant gliomas and is less decisive for the choice of "
        "treatment than in glioblastoma."
    )
    return Pathway(category, steps, mgmt_note, grade_note)
