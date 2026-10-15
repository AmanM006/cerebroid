"""Guideline treatment pathway for each WHO CNS5 adult diffuse-glioma category.

A summary for tumor-board discussion, not a treatment recommendation: every line
paraphrases a published source, and the right pathway for a patient also depends
on performance status, extent of resection and the confirmed tissue result.

Sources:
- EANO guidelines on the diagnosis and treatment of diffuse gliomas of adulthood,
  Weller et al., Nature Reviews Clinical Oncology 2021 (PMC7904519)
- FDA approval of vorasidenib (Voranigo), 6 August 2024: grade 2 astrocytoma or
  oligodendroglioma with a susceptible IDH1/IDH2 mutation, after surgery

How the markers interact, and how the pathway follows them for one patient:
- IDH and 1p/19q decide the tumor type.
- Grade separates the lower-grade from the high-grade pathway. The models estimate
  grade 4 vs 2-3 only; grade 2 vs 3 needs histology, so both lower-grade lines are shown.
- MGMT matters most in glioblastoma: it predicts benefit from temozolomide and,
  together with age, decides the treatment of patients over 70.
- Age: over 70 changes the glioblastoma regimen; age 40 or more (or residual tumor
  after surgery) marks a grade 2 IDH-mutant glioma as higher risk.
"""
from dataclasses import dataclass

SOURCES=(
    "EANO guideline on diffuse gliomas of adulthood (Weller et al., Nat Rev Clin Oncol 2021)",
    "FDA approval of vorasidenib for grade 2 IDH-mutant glioma (August 2024)",
)
LABEL="Guideline summary for tumor-board discussion, not a treatment recommendation."
OLDER_GBM_AGE=70
HIGHER_RISK_LOW_GRADE_AGE=40
VORASIDENIB="Grade 2 after surgery: vorasidenib (IDH inhibitor) is FDA-approved since 2024."


@dataclass(frozen=True)
class Pathway:
    category: str
    steps: list[str]
    mgmt_note: str
    grade_note: str | None


def _glioblastoma(age: int | None, mgmt: str | None) -> tuple[list[str], str]:
    steps=["Maximal safe resection if feasible, otherwise biopsy."]
    older=age is not None and age>OLDER_GBM_AGE
    if not older:
        steps.append(
            "Radiotherapy with concomitant temozolomide, then six cycles of maintenance temozolomide"
            +(f" (age {age}: standard regimen if in good condition)." if age is not None else
              " (patients up to about 70 in good condition).")
        )
    if older or age is None:
        prefix=f"Age {age}, over 70: " if older else "Over 70: "
        if mgmt=="methylated":
            steps.append(prefix+"MGMT methylated, so short-course radiotherapy with temozolomide, "
                         "or temozolomide alone.")
        elif mgmt=="unmethylated":
            steps.append(prefix+"MGMT unmethylated, so short-course radiotherapy alone.")
        else:
            steps.append(prefix+"temozolomide (with or without short-course radiotherapy) if MGMT is "
                         "methylated, short-course radiotherapy alone if unmethylated.")
    mgmt_note={
        "methylated": "MGMT methylated: predicts benefit from temozolomide.",
        "unmethylated": "MGMT unmethylated: little expected benefit from temozolomide; "
                        "clinical trials are often considered.",
    }.get(mgmt or "", "MGMT status decides how much temozolomide is expected to help"
                      +(" and, at this age, which regimen to use" if older else "")
                      +": MRI cannot settle it, order the MGMT assay.")
    return steps, mgmt_note


def _low_grade_risk(age: int | None) -> str:
    if age is None:
        return "higher risk if age 40 or more or tumor left after surgery"
    if age>=HIGHER_RISK_LOW_GRADE_AGE:
        return f"age {age} counts as higher risk"
    return f"age {age} is lower risk unless tumor is left after surgery"


def pathway(category: str, grade: str | None, mgmt: str | None, age: int | None=None) -> Pathway:
    """grade / mgmt: the settled call for that marker, or None when it is not settled."""
    if category.startswith("Glioblastoma"):
        steps, mgmt_note=_glioblastoma(age, mgmt)
        return Pathway(category, steps, mgmt_note, None)

    resect="Resection if feasible, otherwise biopsy."
    mgmt_note=(
        "MGMT is methylated in most IDH-mutant gliomas and is less decisive for the choice of "
        "treatment than in glioblastoma."
    )
    risk=_low_grade_risk(age)
    if category.startswith("Oligodendroglioma"):
        if grade=="grade 4":
            return Pathway(category, [resect], mgmt_note,
                           "Grade 4 is not expected for oligodendroglioma (WHO grades 2-3): "
                           "re-check the calls.")
        steps=[
            resect,
            f"Grade 2 ({risk}): watch-and-wait after surgery for lower risk; radiotherapy followed by PCV "
            "chemotherapy (procarbazine, lomustine, vincristine) for higher risk.",
            "Grade 3: radiotherapy followed by PCV chemotherapy.",
        ]
        return Pathway(category, steps, mgmt_note, VORASIDENIB)

    if grade=="grade 4":
        steps=[resect, "Grade 4: radiotherapy followed by temozolomide; evidence for this group is "
                       "more limited."]
        return Pathway(category, steps, mgmt_note, None)
    steps=[
        resect,
        f"Grade 2 ({risk}): watch-and-wait after surgery for lower risk; radiotherapy followed by "
        "chemotherapy (PCV or temozolomide) for higher risk.",
        "Grade 3: radiotherapy followed by temozolomide.",
    ]
    if grade is None:
        steps.append("If grade 4: radiotherapy followed by temozolomide.")
    return Pathway(category, steps, mgmt_note, VORASIDENIB)
