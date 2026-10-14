# Data Provenance

## Sources

### 1. UCSF-PDGM (clinical metadata and labels)

- **Source:** The Cancer Imaging Archive (TCIA)
- **URL:** https://doi.org/10.7937/tcia.nb3b-t866
- **License:** CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/
- **Citation:** Calabrese E, et al. "The University of California San Francisco Preoperative Diffuse Glioma MRI Dataset." *Radiology: Artificial Intelligence*, 2022. https://doi.org/10.1148/ryai.220058
- **Version used:** UCSF-PDGM v3 / v5 metadata mirror
- **Download date:** 2026-10-14
- **File(s) used:** `UCSF-PDGM-metadata.csv`
- **File checksum (sha256):** `9efbfa0ecfcf598287515c9ff81788c0356e89eeae2dd1d73a7d4a6ec588e146`
- **Inputs used:** `age`, `sex` only
- **Targets used:** IDH status, 1p/19q co-deletion status, MGMT promoter methylation status, WHO grade
- **Fields explicitly excluded as inputs:** WHO grade, pathology diagnosis, extent of resection, treatment, survival, vital status, MGMT index, and all post-operative variables

### 2. UCSF-PDGM Filtered Cohort (imaging)

- **Source:** TCIA / Kaggle mirror (`rukiyeaydn/ucsf-pdgm-filtered`)
- **License:** CC BY 4.0 (TCIA Open Access)
- **Citation:** Calabrese E, et al. *Radiology: Artificial Intelligence*, 2022.
- **Download date:** 2026-10-14
- **Content:** skull-stripped, co-registered 3D NIfTI volumes (`T1`, `T1c`, `T2`, `FLAIR`) and expert 3-compartment tumor segmentations (`tumor_segmentation.nii`)
- **Segmentation label map (verified against TCIA / BraTS documentation):**
  - Label 1 = Necrotic Core (NCR)
  - Label 2 = Peritumoral Edema (ED)
  - Label 4 = Enhancing Tumor (ET)

---

## Join and deduplication counts

| Stage | Count | Reason |
|---|---|---|
| Rows in raw UCSF-PDGM clinical CSV | 501 | Initial raw patient metadata records |
| Follow-up scans dropped | 0 | UCSF-PDGM baseline entries contain only pre-operative baseline records |
| Rows after dedup | 501 | Clean pre-operative records |
| Patients missing volume directory on disk | 6 | Image volume folders not present in dataset mount (495 matched) |
| Excluded pediatric records (< 18 yrs) | 1 | UCSF-PDGM-0124 (age 17) excluded per adult diffuse glioma problem boundary |
| Final cohort with volumes present | 494 | Adult pre-operative cohort with complete multi-sequence imaging and segmentations |
| Train split | 395 | Stratified on IDH, seed=42, 80% |
| Test split | 99 | Stratified on IDH, seed=42, 20% |

**Deduplication rule:** Keep the pre-operative baseline scan. Exclude follow-up entries (`_FU`) and pediatric records (< 18 years) to align strictly with adult diffuse glioma clinical decision support boundary.

---

## Missing labels per marker

| Marker | Missing (n) | Missing (%) |
|:---|---:|---:|
| `idh` | 2 | 0.4% |
| `codeletion_1p19q` | 91 | 18.4% |
| `mgmt` | 85 | 17.2% |
| `who_grade` | 0 | 0.0% |

---

## Label encodings

| Marker | 1 means | 0 means | Source strings (→1) | Source strings (→0) |
|---|---|---|---|---|
| `idh` | IDH mutant | IDH wildtype | mutated (NOS), IDH1/2 point mutations (p.R132H, etc.) | wildtype |
| `codeletion_1p19q` | Co-deleted | Non-co-deleted | co-deletion, relative co-deletion, codel | intact, non-co-deleted |
| `mgmt` | Methylated | Unmethylated | positive, methylated | negative, unmethylated |
| `sex` | Male | Female | M, male (encoded 1) | F, female (encoded 0) |

Missing labels stay `NaN`; targets are never imputed.

---

## Split class balance

### `idh`
| split | 0.0 (Wildtype) | 1.0 (Mutant) | NaN |
|:---|---:|---:|---:|
| test | 78 | 20 | 1 |
| train | 314 | 80 | 1 |

### `codeletion_1p19q`
| split | 0.0 (Intact) | 1.0 (Co-deletion) | NaN |
|:---|---:|---:|---:|
| test | 77 | 3 | 19 |
| train | 311 | 12 | 72 |

### `mgmt`
| split | 0.0 (Unmethylated) | 1.0 (Methylated) | NaN |
|:---|---:|---:|---:|
| test | 25 | 55 | 19 |
| train | 87 | 242 | 66 |

### `who_grade`
| split | 2.0 (Grade 2) | 3.0 (Grade 3) | 4.0 (Grade 4) |
|:---|---:|---:|---:|
| test | 12 | 10 | 77 |
| train | 44 | 33 | 318 |

## Clinical inputs (pre-operative)

- `age`: Patient age at scan (years, 18–100)
- `sex`: Biological sex (1=Male, 0=Female)
- `prior_biopsy`: Stereotactic biopsy performed prior to MRI scan (1.0=Yes, 0.0=No, NaN=unrecorded)
  - Source: clinical CSV column "Biopsy prior to imaging", copied unmodified per patient into `artifacts/features/prior_biopsy_raw.csv` (No 426, Yes 68, blank 0). Encoded by `ml/pipeline/prior_biopsy.py`; CI checks the table against it (`test_prior_biopsy_matches_the_raw_clinical_column`).
  - Yes: 68 patients (13.8%)
  - No: 426 patients (86.2%)
  - Unrecorded: 0 patients

---

## Feature table

- **File:** `artifacts/features/features.parquet`
- **sha256:** `85e3b9883e3e5af5b36493cd407fbbffedd04a5544139bdf515e0c99a322e0bb`
- **Rows:** 494
- **Columns:** 278
- **Column naming convention:**
  - Radiomics: `{sequence}__{region}__{featureclass}__{feature}` (e.g. `t1ce__et__glcm__Contrast`)
  - Shape (extracted once per region): `shape__{region}__shape__{feature}`
  - Descriptors: `desc__{name}`
  - Clinical inputs: `age`, `sex`, `prior_biopsy`
  - Targets: `idh`, `codeletion_1p19q`, `mgmt`, `who_grade`
  - Admin: `patient_id`, `split`, `fold`
  - Flags: `missing__{region}`

---

## Feature extraction implementation

- **Method:** VBX implementation of radiomics-style features (SciPy / scikit-image / SimpleITK)
- **Features extracted:**
  - 3D morphological shape features (surface area, sphericity, compactness, elongation, flatness via marching cubes & regionprops)
  - First-order intensity statistics (mean, variance, skewness, kurtosis, percentiles, entropy, energy)
  - Multi-slice Gray-Level Co-occurrence Matrix (GLCM: contrast, correlation, energy, homogeneity, dissimilarity via scikit-image `graycomatrix` & `graycoprops`)
- **Config:** `ml/configs/radiomics.yaml` (specifies extraction parameters and binning)

---

## Leakage rules

The following fields from UCSF-PDGM are **never** used as model inputs:
WHO grade, pathology diagnosis, extent of resection, treatment, survival, vital status, MGMT index, and all post-operative variables.

Splits are strictly patient-level. No patient appears in more than one split.
Feature scaling, selection, and imputation are applied only inside CV folds in Layer 2.
This layer exports raw extracted features only.

---

## Synthetic data

None used in the model. Demo test-account users are synthetic; labelled accordingly in the UI.

---

## Bulk data policy

Raw imaging volumes and clinical CSVs are never committed to this repository.
Feature extraction runs in a cloud notebook (Kaggle); only the derived feature table and the notebook (with outputs) are committed.
Hero-case volumes will be committed only after BraTS redistribution license is confirmed.
