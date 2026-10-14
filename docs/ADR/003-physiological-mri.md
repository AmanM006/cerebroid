# ADR-003: Add diffusion (ADC) and perfusion (ASL) MRI as inputs

**Status:** Accepted
**Date:** 2026-10-14

## Context
The first feature pass uses the four anatomical MRI sequences (T1, T1 with contrast, T2, FLAIR), each analyzed in
three tumor regions, plus age, sex and any known lab result. Anatomical sequences largely describe structure:
size, shape, swelling and where contrast leaks.

UCSF-PDGM also provides, for the same patients and under the same CC BY 4.0 license, physiological MRI:
- **Diffusion (ADC):** how freely water moves in tissue, which reflects how densely packed the cells are.
- **Perfusion (ASL):** how much blood reaches the tissue.

These measure different biology from the anatomical sequences.

## Decision
Add ADC and ASL as two further imaging inputs, extracted per tumor region with the same feature classes and
naming convention as the anatomical sequences (sequence codes `adc` and `asl`, e.g. `adc__et__firstorder__Mean`).

## Consequences
- **Broader evidence:** each prediction draws on anatomy, contrast enhancement, cellularity and blood flow,
  alongside patient details and known lab results.
- **Missing information becomes a real case:** a patient without one of these volumes gets NaN features and a
  `missing__adc` / `missing__asl` flag. The model sets impute inside their pipelines, and the doubt breakdown
  reports the missing input.
- **A further comparison:** anatomical-only versus anatomical + physiological sets, on the same held-out patients,
  shows what the physiological sequences add.
- **Order of work:** the first model sets on anatomical features ship first; ADC and ASL are a second feature pass,
  so the end-to-end flow is never blocked on the extra data.
- The shared contract (`backend/app/domain/contracts.py`) accepts `adc` and `asl` as sequence codes.
