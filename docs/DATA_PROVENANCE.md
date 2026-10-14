# Data Provenance

No data has been downloaded or joined yet — this file is the v0 skeleton written at Layer 0.
It is filled in with real URLs, license text, download dates, checksums, join counts, and
exclusion reasons during **Layer 1 (Data)**, per [CLAUDE.md](../CLAUDE.md) §3 and §9.

## Planned sources

### 1. UCSF-PDGM (clinical / labels)
- **What:** clinical metadata CSV + glossary — age, sex (inputs); IDH status, 1p/19q status, MGMT
  status, WHO grade, overall survival (targets, used per the leakage rules below).
- **Source:** The Cancer Imaging Archive (TCIA).
- **License:** CC BY 4.0 — attribution required.
- **Status:** TODO — download date, checksum, row count, and citation to be recorded in Layer 1.

### 2. BraTS 2021 (imaging)
- **What:** brain-extracted, co-registered NIfTI volumes (T1, T1ce, T2, FLAIR) + expert segmentation
  masks (enhancing tumor / necrotic core / edema labels).
- **Source:** BraTS 2021 training set.
- **License:** TODO — confirm exact license terms before any redistribution of demo-case volumes.
- **Status:** TODO — download date, checksum, patient count to be recorded in Layer 1.

### 3. BraTS↔TCIA ID crosswalk
- **What:** official mapping used to join BraTS imaging IDs to UCSF-PDGM clinical records.
- **Source:** TCIA.
- **Status:** TODO — join count (~300 patients expected per CLAUDE.md §3) to be recorded in Layer 1.

## Leakage rules (binding — see CLAUDE.md §3)
Fields that must **never** be used as model inputs: WHO grade, pathology diagnosis, extent of
resection, treatment, survival, vital status, MGMT index, any post-operative variable.

UCSF-PDGM contains follow-up duplicate scans of the same patient (e.g. `..._FU007d`); these must be
deduplicated to one scan per patient before any train/test split, and all splits must be strict by
patient (no patient's scans appear in more than one fold/split).

## Synthetic data
None used in the model. Any synthetic demo/test-account data introduced later (Layer 3+) will be
clearly labelled `provenance: synthetic` and disclosed in the README.

## Bulk data policy
Per CLAUDE.md §3: bulk imaging/clinical data never enters this repository or team laptops. Feature
extraction runs in a cloud notebook (Kaggle/Colab); only the notebook, the derived feature table, model
artifacts, and a handful of small hero-case demo volumes (license permitting) are committed.
