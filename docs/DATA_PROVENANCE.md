# Data Provenance

## Sources

### 1. UCSF-PDGM (clinical metadata and labels)

- **Source:** The Cancer Imaging Archive (TCIA)
- **URL:** https://doi.org/10.7937/tcia.nb3b-t866
- **License:** CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/
- **Citation:** Calabrese E, et al. "The University of California San Francisco Preoperative Diffuse Glioma MRI Dataset." *Radiology: Artificial Intelligence*, 2022. https://doi.org/10.1148/ryai.220058
- **Version used:** UCSF-PDGM v3
- **Download date:** to be filled after Kaggle run
- **File(s) used:** clinical CSV (exact filename to be filled after run)
- **File checksum (sha256):** to be filled after download
- **Inputs used:** `age`, `sex` only
- **Targets used:** IDH status, 1p/19q co-deletion status, MGMT promoter methylation status, WHO grade
- **Fields explicitly excluded as inputs:** WHO grade, pathology diagnosis, extent of resection, treatment, survival, vital status, MGMT index, and all post-operative variables

### 2. BraTS 2021 Training Set (imaging)

- **Source:** Synapse / Kaggle (RSNA-MICCAI Brain Tumor Radiogenomic Classification)
- **URL:** https://www.kaggle.com/c/rsna-miccai-brain-tumor-radiogenomic-classification/data
- **Challenge page:** https://www.med.upenn.edu/cbica/brats2021/
- **License:** BraTS 2021 challenge data terms — academic research use only; redistribution restrictions apply. Hero-case volume redistribution is pending license confirmation.
- **Citation:** Baid U, et al. "The RSNA-ASNR-MICCAI BraTS 2021 Benchmark on Brain Tumor Segmentation and Radiogenomic Classification." arXiv:2107.02314, 2021.
- **Download date:** to be filled after Kaggle run
- **Content:** brain-extracted, co-registered NIfTI volumes (T1, T1ce, T2, FLAIR) and expert segmentations
- **Segmentation label map (verified against BraTS 2021 challenge documentation):**
  - Label 1 = Necrotic Core (NCR)
  - Label 2 = Peritumoral Edema (ED)
  - Label 4 = Enhancing Tumor (ET)
  - Label 3 = not used in BraTS 2021

### 3. BraTS↔TCIA ID Crosswalk

- **Source:** TCIA
- **URL:** https://www.cancerimagingarchive.net/analysis-result/brats-tcia-crosswalk/
- **License:** CC BY 3.0 — https://creativecommons.org/licenses/by/3.0/
- **Use:** joins BraTS imaging IDs to UCSF-PDGM clinical records
- **Download date:** to be filled after download
- **File checksum (sha256):** to be filled after download

---

## Join and deduplication counts

All counts below are to be filled from the notebook output after the Kaggle run.

| Stage | Count | Reason |
|---|---|---|
| Rows in raw UCSF clinical CSV | — | — |
| Follow-up scans dropped | — | _FU suffix → retain baseline scan only |
| Rows after dedup | — | — |
| Rows in BraTS↔TCIA crosswalk | — | — |
| Rows after inner join | — | Inner join on TCIA patient ID |
| Patients missing BraTS volume directory | — | Volume not found in dataset mount |
| Final cohort with volumes present | — | — |
| Train split | — | Stratified on IDH, seed=42, 80% |
| Test split | — | Stratified on IDH, seed=42, 20% |

**Deduplication rule:** Keep the baseline scan (ID without `_FU` suffix). If a patient has only follow-up entries, keep the one with the smallest follow-up day count. Reason: follow-up scans are post-operative and may reflect treatment effects rather than the pre-operative molecular profile.

---

## Missing labels per marker

To be filled from notebook output.

| Marker | Missing (n) | Missing (%) |
|---|---|---|
| IDH status | — | — |
| 1p/19q co-deletion | — | — |
| MGMT methylation | — | — |
| WHO grade | — | — |

---

## Label encodings

| Marker | 1 means | 0 means | Source strings (→1) | Source strings (→0) |
|---|---|---|---|---|
| `idh` | IDH mutant | IDH wildtype | mutant, mut, IDH mutant | wildtype, wt, IDH wildtype |
| `codeletion_1p19q` | Co-deleted | Non-co-deleted | co-deleted, codel, deleted, yes | non-co-deleted, noncodel, non-deleted, no |
| `mgmt` | Methylated | Unmethylated | methylated, meth, positive, yes | unmethylated, unmeth, negative, no |
| `sex` | Male | Female | m, male | f, female |

Missing labels stay `NaN`; targets are never imputed.

---

## Split class balance

To be filled from notebook output.

---

## Feature table

- **File:** `artifacts/features/features.parquet`
- **sha256:** to be filled from notebook output (`provenance.json`)
- **Rows:** to be filled
- **Columns:** to be filled
- **Column naming convention:**
  - Radiomics: `{sequence}__{region}__{featureclass}__{feature}` (e.g. `t1ce__et__glcm__Contrast`)
  - Shape (extracted once per region): `shape__{region}__shape__{feature}`
  - Descriptors: `desc__{name}`
  - Clinical inputs: `age`, `sex`
  - Targets: `idh`, `codeletion_1p19q`, `mgmt`, `who_grade`
  - Admin: `patient_id`, `split`, `fold`
  - Flags: `missing__{region}`

---

## Radiomics config

- **File:** `ml/configs/radiomics.yaml`
- **sha256:** to be filled from notebook output (`provenance.json`)
- **pyradiomics version:** to be filled
- **SimpleITK version:** to be filled
- **numpy version:** to be filled

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
