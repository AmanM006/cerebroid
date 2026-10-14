# ADR-002: Use UCSF-PDGM imaging directly instead of BraTS 2021 + crosswalk

**Status:** Accepted
**Date:** 2026-10-14

## Context
The original plan took molecular labels and age/sex from UCSF-PDGM, took MRI volumes and tumor segmentations
from the BraTS 2021 training set, and joined the two through the BraTS↔TCIA ID crosswalk.

UCSF-PDGM itself provides, for the same patients, skull-stripped and co-registered NIfTI volumes (T1, T1c, T2,
FLAIR) and a tumor segmentation with enhancing tumor, necrotic core and edema regions.

## Decision
Use UCSF-PDGM for both labels and imaging. Drop BraTS 2021 and the crosswalk.

## Consequences
- **No cross-dataset join:** no ID-mapping errors, and no patients lost to an incomplete crosswalk.
- **One license:** UCSF-PDGM is CC BY 4.0, which permits redistribution with attribution, so a small number of
  demo-case volumes can be shown in the application and committed with attribution. BraTS 2021 data terms
  restrict redistribution.
- **One provenance chain** to document in [DATA_PROVENANCE.md](../DATA_PROVENANCE.md).
- Segmentation label values and file naming must be checked on the actual files before extraction rather than
  assumed from BraTS conventions.
- Follow-up scans (`_FU` IDs) remain in UCSF-PDGM; deduplication to one pre-operative scan per patient still
  applies, and patients with only follow-up scans are excluded.
