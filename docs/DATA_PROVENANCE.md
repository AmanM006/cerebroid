# Data Provenance

## Sources

### 1. UCSF-PDGM (clinical metadata and labels)
- **Source:** The Cancer Imaging Archive (TCIA)
- **License:** CC BY 4.0
- **Inputs used:** age, sex
- **Targets used:** IDH status, 1p/19q status, MGMT status, WHO grade

### 2. BraTS 2021 training set (imaging)
- **Content:** brain-extracted, co-registered NIfTI volumes (T1, T1ce, T2, FLAIR) and expert
  segmentations (enhancing tumor, necrotic core, edema)
- **License:** BraTS 2021 challenge data terms

### 3. BraTS↔TCIA ID crosswalk
- **Source:** TCIA
- **Use:** joins BraTS imaging IDs to UCSF-PDGM clinical records

## Leakage rules
Never used as model inputs: WHO grade, pathology diagnosis, extent of resection, treatment, survival,
vital status, MGMT index, or any post-operative variable.

UCSF-PDGM contains follow-up scans of the same patient (e.g. `..._FU007d`). These are deduplicated to
one scan per patient, and all train/test splits are strictly by patient.

## Synthetic data
None used in the model.

## Bulk data policy
Raw imaging and clinical data are never committed. Feature extraction runs in a cloud notebook; only
the notebook, the derived feature table, and trained model artifacts are committed.
