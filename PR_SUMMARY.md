PR: Restrict external writes + in-memory report export + external read caching

Summary
- Prevents writes to external spreadsheets: `saveTrackingData` now records historic, seguimiento and audit entries only in the principal matrix (`DATA_FILES.PRINCIPAL`). If the RT is found in an external file, the system writes the follow-up into the matrix principal and records `ORIGEN_FILEID` to track the source.
- Replaces temporary `SpreadsheetApp.create()` flow for reports with in-memory CSV generation (`Utilities.newBlob`) and attaches the CSV to the outgoing email. No temporary files left in Drive.
 - Replaces temporary `SpreadsheetApp.create()` flow for reports with in-memory CSV generation (`Utilities.newBlob`) and attaches the CSV to the outgoing email. No temporary files left in Drive for the CSV export.
 - Note: The PDF/document generation flow still creates temporary Drive files (DocumentApp -> DriveApp.createFile) and sets sharing (`ANYONE_WITH_LINK`) in `Codigo.js`. If you require zero Drive file creation in production, I recommend converting the PDF flow to return an in-memory blob OR restrict Drive creation to a dedicated, monitored folder and remove `ANYONE_WITH_LINK` sharing.
- Adds runtime caching for external PAC sheet reads in `_PAC_RUNTIME_CACHE.externas` and reads only `getRange(1,1,lastRow,lastCol)` to reduce timeouts and data volume.
- Maintains previously applied improvements: batch `setValues`, `actualizarRango`, `LockService` usage across critical write paths.

Files changed (high level)
- Codigo.js
  - `saveTrackingData` now writes seguimiento/histórico/auditoría exclusively to principal matrix.
  - Report export: generates CSV in memory and attaches to email (no Drive temp files).
- pac_gestor.js
  - `pac_leerHojaExterna` adds `_PAC_RUNTIME_CACHE.externas` caching and reads only bounded range.
- datos.js, permisos.js, reportes.js, pac_triggers.js, config.js (already changed in previous PR steps) remain part of the PR.

Why
- Enforces policy: the only writable spreadsheet is the controlled principal matrix.
- Improves performance and reliability: reduces Drive file churn, avoids timeouts for large external sheets.

Checklist for reviewers
- [ ] Confirm `DATA_FILES.PRINCIPAL` value is correct and the account deploying has write access to it.
- [ ] Validate that `saveTrackingData` writes `SEGUIMIENTO` rows in the principal matrix when RT originates in external file.
- [ ] Confirm that for RTs in the principal matrix, `saveTrackingData` updates the `DATOS` row in-place as before.
- [ ] Run `staging_diagnosticar()` and confirm result is saved in `DIAGNOSTICO` sheet in the principal matrix.
- [ ] Run a report send and verify the CSV is attached and no temp files are created in Drive.
- [ ] Run critical triggers (`triggerSemanalPAC`, `triggerDiarioAlertasCriticas`) manually and check locks prevent concurrent executions.

Testing notes
- Use a staging principal matrix copy to run `staging_diagnosticar()` and `saveTrackingData` tests.
- For external RT tests: create a dummy secondary spreadsheet (read-only role in production) and ensure that `saveTrackingData` does not alter it.

Deployment instructions (summary)
See ROADMAP.md for the exact step-by-step deployment instructions.

PR diff pointers
- See the updated functions in `Codigo.js` (`saveTrackingData`, report export), and `pac_gestor.js` (`pac_leerHojaExterna`).
- Previous commits included `datos.js` batch updates and locks.

Notes
- `solicitarPermisosFaltantes()` remains as a manual helper; no changes applied.
- If you want `SpreadsheetApp.create()` removed from other helper functions (e.g. `solicitarPermisosFaltantes`), approve and I will remove or replace them.
