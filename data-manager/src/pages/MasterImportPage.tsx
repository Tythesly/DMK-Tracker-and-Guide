import {
  useState,
} from "react";

import {
  invoke,
} from "@tauri-apps/api/core";

import {
  open,
} from "@tauri-apps/plugin-dialog";

import "./MasterImportPage.css";

type WorkbookSheetInspection = {
  name: string;
  rows: number;
  columns: number;
  recognized: boolean;
};

type CoreSourceInspection = {
  key: string;
  label: string;
  sheetName: string | null;
  found: boolean;
  headerCell: string | null;
  recordCount: number;
  detail: string;
};

type MasterWorkbookInspection = {
  fileName: string;
  filePath: string;
  extension: string;
  fileSizeBytes: number;

  workbookId: string | null;
  workbookVersion:
    string | null;
  structureVersion:
    string | null;
  workbookType:
    string | null;
  metadataValid: boolean;

  sheetCount: number;
  coreReady: boolean;
  readyForMapping: boolean;

  sheets:
    WorkbookSheetInspection[];
  coreSources:
    CoreSourceInspection[];
  warnings: string[];
};

type IdentityPlanExample = {
  status: string;
  source: string;
  displayName: string;
  proposedId: string | null;
  matchedId: string | null;
  detail: string;
};

type IdentityPlanIssue = {
  section: string;
  source: string;
  message: string;
};

type IdentityPlanSection = {
  key: string;
  label: string;
  workbookRecords: number;
  databaseRecords: number;
  matchedRecords: number;
  newRecords: number;
  ambiguousRecords: number;
  invalidRecords: number;
  databaseOnlyRecords: number;
  examples: IdentityPlanExample[];
};

type MasterImportIdentityPlan = {
  fileName: string;
  workbookVersion: string | null;
  planReady: boolean;
  sections: IdentityPlanSection[];
  issues: IdentityPlanIssue[];
  notes: string[];
};

type ValuePlanFieldDifference = {
  field: string;
  workbookValue: string;
  databaseValue: string;
};

type ValuePlanExample = {
  status: string;
  source: string;
  displayName: string;
  recordId: string | null;
  detail: string;
  differences: ValuePlanFieldDifference[];
};

type ValuePlanIssue = {
  section: string;
  source: string;
  message: string;
};

type ValuePlanSection = {
  key: string;
  label: string;
  workbookRecords: number;
  databaseRecords: number;
  newRecords: number;
  unchangedRecords: number;
  changedRecords: number;
  invalidRecords: number;
  unresolvedReferences: number;
  databaseOnlyRecords: number;
  comparedFields: string[];
  examples: ValuePlanExample[];
};

type MasterImportValuePlan = {
  fileName: string;
  workbookVersion: string | null;
  planReady: boolean;
  sections: ValuePlanSection[];
  issues: ValuePlanIssue[];
  deferredReferences: ValuePlanIssue[];
  notes: string[];
};

function formatFileSize(
  bytes: number,
) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes =
    bytes / 1024;

  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(
      1,
    )} KB`;
  }

  const megabytes =
    kilobytes / 1024;

  return `${megabytes.toFixed(
    2,
  )} MB`;
}

function displayValue(
  value: string | null,
) {
  if (
    value === null ||
    value.trim() === ""
  ) {
    return "Not detected";
  }

  return value;
}

function formatCount(
  value: number,
) {
  return value.toLocaleString(
    "en-US",
  );
}

function planStatusLabel(
  status: string,
) {
  switch (
    status
      .trim()
      .toLowerCase()
  ) {
    case "matched":
      return "Matched";

    case "new":
      return "New";

    case "ambiguous":
      return "Ambiguous";

    case "invalid":
      return "Invalid";

    default:
      return status;
  }
}

function planStatusClass(
  status: string,
) {
  const normalized =
    status
      .trim()
      .toLowerCase();

  if (
    normalized === "matched"
  ) {
    return "identity-example-status identity-example-status-matched";
  }

  if (
    normalized === "new"
  ) {
    return "identity-example-status identity-example-status-new";
  }

  if (
    normalized === "ambiguous"
  ) {
    return "identity-example-status identity-example-status-review";
  }

  if (
    normalized === "invalid"
  ) {
    return "identity-example-status identity-example-status-error";
  }

  return "identity-example-status";
}

function valueStatusLabel(
  status: string,
) {
  switch (
    status
      .trim()
      .toLowerCase()
  ) {
    case "unchanged":
      return "Unchanged";

    case "changed":
      return "Changed";

    case "new":
      return "New";

    case "invalid":
      return "Invalid";

    default:
      return status;
  }
}

function valueStatusClass(
  status: string,
) {
  const normalized =
    status
      .trim()
      .toLowerCase();

  if (normalized === "unchanged") {
    return "identity-example-status identity-example-status-matched";
  }

  if (normalized === "new") {
    return "identity-example-status identity-example-status-new";
  }

  if (normalized === "changed") {
    return "identity-example-status value-example-status-changed";
  }

  if (normalized === "invalid") {
    return "identity-example-status identity-example-status-error";
  }

  return "identity-example-status";
}

function MasterImportPage() {
  const [
    inspection,
    setInspection,
  ] =
    useState<
      MasterWorkbookInspection | null
    >(null);

  const [
    selectedPath,
    setSelectedPath,
  ] = useState<string | null>(
    null,
  );

  const [
    identityPlan,
    setIdentityPlan,
  ] =
    useState<
      MasterImportIdentityPlan | null
    >(null);

  const [
    valuePlan,
    setValuePlan,
  ] =
    useState<
      MasterImportValuePlan | null
    >(null);

  const [
    inspecting,
    setInspecting,
  ] = useState(false);

  const [
    buildingPlan,
    setBuildingPlan,
  ] = useState(false);

  const [
    buildingValuePlan,
    setBuildingValuePlan,
  ] = useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    planError,
    setPlanError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    valuePlanError,
    setValuePlanError,
  ] =
    useState<string | null>(
      null,
    );

  async function selectWorkbook() {
    setError(null);
    setPlanError(null);
    setValuePlanError(null);

    const selected =
      await open({
        title:
          "Select DMK Master Workbook",

        multiple: false,
        directory: false,

        filters: [
          {
            name:
              "Excel Workbooks",

            extensions: [
              "xlsm",
              "xlsx",
            ],
          },
        ],
      });

    if (
      selected === null
    ) {
      return;
    }

    if (
      Array.isArray(
        selected,
      )
    ) {
      setError(
        "Select one workbook only.",
      );

      return;
    }

    setInspecting(true);
    setInspection(null);
    setIdentityPlan(null);
    setValuePlan(null);
    setSelectedPath(
      selected,
    );

    try {
      const result =
        await invoke<
          MasterWorkbookInspection
        >(
          "inspect_master_workbook",
          {
            path:
              selected,
          },
        );

      setInspection(
        result,
      );
    } catch (caughtError) {
      console.error(
        "Master workbook inspection failed:",
        caughtError,
      );

      setSelectedPath(null);

      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : String(
              caughtError,
            ),
      );
    } finally {
      setInspecting(
        false,
      );
    }
  }

  async function buildIdentityPlan() {
    if (
      !selectedPath ||
      !inspection?.readyForMapping
    ) {
      return;
    }

    setPlanError(null);
    setValuePlanError(null);
    setBuildingPlan(true);
    setIdentityPlan(null);
    setValuePlan(null);

    try {
      const result =
        await invoke<
          MasterImportIdentityPlan
        >(
          "build_master_import_identity_plan",
          {
            path:
              selectedPath,
          },
        );

      setIdentityPlan(
        result,
      );
    } catch (caughtError) {
      console.error(
        "Master import identity plan failed:",
        caughtError,
      );

      setPlanError(
        caughtError instanceof
          Error
          ? caughtError.message
          : String(
              caughtError,
            ),
      );
    } finally {
      setBuildingPlan(
        false,
      );
    }
  }

  async function buildValuePlan() {
    if (
      !selectedPath ||
      !identityPlan?.planReady
    ) {
      return;
    }

    setValuePlanError(null);
    setBuildingValuePlan(true);
    setValuePlan(null);

    try {
      const result =
        await invoke<
          MasterImportValuePlan
        >(
          "build_master_import_value_plan",
          {
            path:
              selectedPath,
          },
        );

      setValuePlan(
        result,
      );
    } catch (caughtError) {
      console.error(
        "Master import value plan failed:",
        caughtError,
      );

      setValuePlanError(
        caughtError instanceof
          Error
          ? caughtError.message
          : String(
              caughtError,
            ),
      );
    } finally {
      setBuildingValuePlan(
        false,
      );
    }
  }

  const statusLabel =
    inspection === null
      ? "No workbook selected"
      : inspection
            .readyForMapping
        ? "Ready for mapping"
        : "Review required";

  const identityPlanStatus =
    identityPlan === null
      ? "Not built"
      : identityPlan.planReady
        ? "Identity mapping ready"
        : "Identity review required";


  const valuePlanStatus =
    valuePlan === null
      ? "Not built"
      : valuePlan.planReady
        ? "Value comparison ready"
        : "Value review required";

  return (
    <>
      <header className="manager-page-header">
        <div>
          <div className="manager-eyebrow">
            TOOLS
          </div>

          <h1>
            Master Workbook Import
          </h1>

          <p>
            Inspect the
            authoritative DMK
            Master workbook, map
            record identities, and
            compare actual values
            before any game data
            can be imported.
          </p>
        </div>
      </header>

      <div className="manager-warning-banner">
        <strong>
          Read-only planning
        </strong>

        <span>
          Inspection, identity
          mapping, and actual value
          comparison do not add,
          update, deactivate, or
          remove anything in
          dmk-editor.db.
        </span>
      </div>

      {error && (
        <div className="manager-error-banner">
          <strong>
            Workbook inspection
            failed
          </strong>

          <span>
            {error}
          </span>
        </div>
      )}

      {planError && (
        <div className="manager-error-banner">
          <strong>
            Identity plan failed
          </strong>

          <span>
            {planError}
          </span>
        </div>
      )}

      {valuePlanError && (
        <div className="manager-error-banner">
          <strong>
            Value comparison failed
          </strong>

          <span>
            {valuePlanError}
          </span>
        </div>
      )}

      <section className="manager-panel master-import-picker">
        <div>
          <div className="master-import-picker-title">
            Select Master
            Workbook
          </div>

          <p>
            Choose the current
            DMK Master .xlsm or
            .xlsx file. The
            inspector scans for
            known workbook data
            before the identity
            mapper compares those
            records with the
            authoring database.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          disabled={
            inspecting ||
            buildingPlan ||
            buildingValuePlan
          }
          onClick={() =>
            void selectWorkbook()
          }
        >
          {inspecting
            ? "Inspecting..."
            : inspection
              ? "Select Another Workbook"
              : "Select Master Workbook"}
        </button>
      </section>

      {inspection && (
        <>
          <section className="database-status-bar master-import-status-bar">
            <div>
              <strong>
                Workbook
                Inspection
              </strong>

              <span>
                {
                  inspection.fileName
                }
              </span>
            </div>

            <div
              className={
                inspection
                  .readyForMapping
                  ? "database-status-pill"
                  : "master-import-review-pill"
              }
            >
              {statusLabel}
            </div>
          </section>

          <section className="manager-panel master-import-summary-panel">
            <div className="manager-panel-header">
              <div>
                <h2>
                  Workbook
                  Identity
                </h2>

                <p>
                  Metadata and
                  file information
                  detected from
                  the selected
                  workbook.
                </p>
              </div>
            </div>

            <div className="master-import-summary-grid">
              <div className="master-import-summary-item">
                <span>
                  Workbook
                  Version
                </span>

                <strong>
                  {displayValue(
                    inspection
                      .workbookVersion,
                  )}
                </strong>
              </div>

              <div className="master-import-summary-item">
                <span>
                  Workbook ID
                </span>

                <strong>
                  {displayValue(
                    inspection
                      .workbookId,
                  )}
                </strong>
              </div>

              <div className="master-import-summary-item">
                <span>
                  Workbook Type
                </span>

                <strong>
                  {displayValue(
                    inspection
                      .workbookType,
                  )}
                </strong>
              </div>

              <div className="master-import-summary-item">
                <span>
                  Structure
                  Version
                </span>

                <strong>
                  {displayValue(
                    inspection
                      .structureVersion,
                  )}
                </strong>
              </div>

              <div className="master-import-summary-item">
                <span>
                  Worksheets
                </span>

                <strong>
                  {
                    inspection.sheetCount
                  }
                </strong>
              </div>

              <div className="master-import-summary-item">
                <span>
                  File Size
                </span>

                <strong>
                  {formatFileSize(
                    inspection
                      .fileSizeBytes,
                  )}
                </strong>
              </div>

              <div className="master-import-summary-item master-import-summary-wide">
                <span>
                  File
                </span>

                <strong
                  title={
                    inspection.filePath
                  }
                >
                  {
                    inspection.fileName
                  }
                </strong>
              </div>

              <div className="master-import-summary-item">
                <span>
                  Metadata
                </span>

                <strong
                  className={
                    inspection
                      .metadataValid
                      ? "master-import-good-text"
                      : "master-import-warning-text"
                  }
                >
                  {inspection
                    .metadataValid
                    ? "Valid Master"
                    : "Review"}
                </strong>
              </div>
            </div>
          </section>

          <section className="manager-panel master-import-core-panel">
            <div className="manager-panel-header">
              <div>
                <h2>
                  Core Import
                  Sources
                </h2>

                <p>
                  These are the
                  four Data
                  Manager areas
                  currently ready
                  for workbook
                  mapping.
                </p>
              </div>
            </div>

            <div className="master-import-core-grid">
              {inspection
                .coreSources
                .map(
                  (
                    source,
                  ) => (
                    <article
                      key={
                        source.key
                      }
                      className="master-import-source-card"
                    >
                      <div className="master-import-source-heading">
                        <div>
                          <h3>
                            {
                              source.label
                            }
                          </h3>

                          <span>
                            {source
                              .sheetName ??
                              "Source not detected"}
                          </span>
                        </div>

                        <span
                          className={
                            source.found &&
                            source
                                .recordCount >
                              0
                              ? "master-import-source-pill master-import-source-pill-good"
                              : "master-import-source-pill master-import-source-pill-review"
                          }
                        >
                          {source.found
                            ? "Detected"
                            : "Missing"}
                        </span>
                      </div>

                      <div className="master-import-source-count">
                        {formatCount(
                          source.recordCount,
                        )}

                        <span>
                          candidate
                          records
                        </span>
                      </div>

                      <div className="master-import-source-detail">
                        {
                          source.detail
                        }
                      </div>

                      <div className="master-import-source-location">
                        <span>
                          Header
                        </span>

                        <strong>
                          {source
                            .sheetName &&
                          source
                            .headerCell
                            ? `${source.sheetName}!${source.headerCell}`
                            : "Not detected"}
                        </strong>
                      </div>
                    </article>
                  ),
                )}
            </div>
          </section>

          {inspection
            .warnings.length >
            0 && (
            <section className="manager-panel master-import-warning-panel">
              <div className="manager-panel-header">
                <div>
                  <h2>
                    Inspection
                    Review Items
                  </h2>

                  <p>
                    These items
                    come from the
                    workbook
                    inspection
                    stage.
                  </p>
                </div>
              </div>

              <div className="master-import-warning-list">
                {inspection
                  .warnings
                  .map(
                    (
                      warning,
                      index,
                    ) => (
                      <div
                        key={
                          `${index}-${warning}`
                        }
                        className="master-import-warning-item"
                      >
                        <span>
                          !
                        </span>

                        <p>
                          {
                            warning
                          }
                        </p>
                      </div>
                    ),
                  )}
              </div>
            </section>
          )}

          <section className="manager-panel identity-plan-action-panel">
            <div>
              <div className="manager-eyebrow">
                DRY-RUN IMPORT PLAN
              </div>

              <h2>
                Compare Record
                Identities
              </h2>

              <p>
                Compare workbook
                collections,
                characters,
                tokens, and
                character levels
                against the
                existing stable
                identities in
                dmk-editor.db.
                This does not
                write to the
                database.
              </p>
            </div>

            <button
              type="button"
              className="primary-button"
              disabled={
                !inspection
                  .readyForMapping ||
                !selectedPath ||
                buildingPlan
              }
              onClick={() =>
                void buildIdentityPlan()
              }
            >
              {buildingPlan
                ? "Building Plan..."
                : identityPlan
                  ? "Rebuild Identity Plan"
                  : "Build Identity Plan"}
            </button>
          </section>

          {identityPlan && (
            <>
              <section className="database-status-bar identity-plan-status-bar">
                <div>
                  <strong>
                    Identity
                    Mapping Plan
                  </strong>

                  <span>
                    {identityPlan
                      .workbookVersion ??
                      identityPlan.fileName}
                  </span>
                </div>

                <div
                  className={
                    identityPlan
                      .planReady
                      ? "database-status-pill"
                      : "master-import-review-pill"
                  }
                >
                  {identityPlanStatus}
                </div>
              </section>

              <section className="manager-panel identity-plan-panel">
                <div className="manager-panel-header">
                  <div>
                    <h2>
                      Identity
                      Mapping Summary
                    </h2>

                    <p>
                      Workbook records
                      are being compared
                      with existing
                      stable IDs and
                      aliases. Database-
                      only records are
                      reported, not
                      deleted.
                    </p>
                  </div>
                </div>

                <div className="identity-plan-grid">
                  {identityPlan
                    .sections
                    .map(
                      (
                        section,
                      ) => (
                        <article
                          key={
                            section.key
                          }
                          className="identity-plan-card"
                        >
                          <div className="identity-plan-card-heading">
                            <div>
                              <h3>
                                {
                                  section.label
                                }
                              </h3>

                              <span>
                                {formatCount(
                                  section.workbookRecords,
                                )}{" "}
                                workbook records
                              </span>
                            </div>

                            <span
                              className={
                                section.ambiguousRecords ===
                                  0 &&
                                section.invalidRecords ===
                                  0
                                  ? "master-import-source-pill master-import-source-pill-good"
                                  : "master-import-source-pill master-import-source-pill-review"
                              }
                            >
                              {section.ambiguousRecords ===
                                0 &&
                              section.invalidRecords ===
                                0
                                ? "Resolved"
                                : "Review"}
                            </span>
                          </div>

                          <div className="identity-plan-stat-grid">
                            <div className="identity-plan-stat">
                              <span>
                                Existing DB
                              </span>

                              <strong>
                                {formatCount(
                                  section.databaseRecords,
                                )}
                              </strong>
                            </div>

                            <div className="identity-plan-stat identity-plan-stat-good">
                              <span>
                                Matched
                              </span>

                              <strong>
                                {formatCount(
                                  section.matchedRecords,
                                )}
                              </strong>
                            </div>

                            <div className="identity-plan-stat identity-plan-stat-new">
                              <span>
                                New
                              </span>

                              <strong>
                                {formatCount(
                                  section.newRecords,
                                )}
                              </strong>
                            </div>

                            <div className="identity-plan-stat identity-plan-stat-review">
                              <span>
                                Ambiguous
                              </span>

                              <strong>
                                {formatCount(
                                  section.ambiguousRecords,
                                )}
                              </strong>
                            </div>

                            <div className="identity-plan-stat identity-plan-stat-error">
                              <span>
                                Invalid
                              </span>

                              <strong>
                                {formatCount(
                                  section.invalidRecords,
                                )}
                              </strong>
                            </div>

                            <div className="identity-plan-stat">
                              <span>
                                DB Only
                              </span>

                              <strong>
                                {formatCount(
                                  section.databaseOnlyRecords,
                                )}
                              </strong>
                            </div>
                          </div>

                          {section
                            .examples.length >
                            0 && (
                            <details className="identity-plan-examples">
                              <summary>
                                Show mapping
                                examples
                              </summary>

                              <div className="identity-example-list">
                                {section
                                  .examples
                                  .map(
                                    (
                                      example,
                                      index,
                                    ) => (
                                      <div
                                        key={
                                          `${example.source}-${index}`
                                        }
                                        className="identity-example-row"
                                      >
                                        <div className="identity-example-main">
                                          <span
                                            className={planStatusClass(
                                              example.status,
                                            )}
                                          >
                                            {planStatusLabel(
                                              example.status,
                                            )}
                                          </span>

                                          <div>
                                            <strong>
                                              {
                                                example.displayName
                                              }
                                            </strong>

                                            <span>
                                              {
                                                example.source
                                              }
                                            </span>
                                          </div>
                                        </div>

                                        <div className="identity-example-detail">
                                          <p>
                                            {
                                              example.detail
                                            }
                                          </p>

                                          <div className="identity-example-ids">
                                            {example.proposedId && (
                                              <span>
                                                Proposed:{" "}
                                                <code>
                                                  {
                                                    example.proposedId
                                                  }
                                                </code>
                                              </span>
                                            )}

                                            {example.matchedId && (
                                              <span>
                                                Matched:{" "}
                                                <code>
                                                  {
                                                    example.matchedId
                                                  }
                                                </code>
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ),
                                  )}
                              </div>
                            </details>
                          )}
                        </article>
                      ),
                    )}
                </div>
              </section>

              {identityPlan
                .issues.length >
                0 && (
                <section className="manager-panel identity-plan-issues-panel">
                  <div className="manager-panel-header">
                    <div>
                      <h2>
                        Identity
                        Review Items
                      </h2>

                      <p>
                        Ambiguous or
                        invalid mappings
                        must be understood
                        before we allow a
                        future import.
                      </p>
                    </div>
                  </div>

                  <div className="identity-issue-list">
                    {identityPlan
                      .issues
                      .map(
                        (
                          issue,
                          index,
                        ) => (
                          <div
                            key={
                              `${issue.section}-${issue.source}-${index}`
                            }
                            className="identity-issue-row"
                          >
                            <span className="identity-issue-icon">
                              !
                            </span>

                            <div>
                              <strong>
                                {
                                  issue.section
                                }
                              </strong>

                              <span>
                                {
                                  issue.source
                                }
                              </span>

                              <p>
                                {
                                  issue.message
                                }
                              </p>
                            </div>
                          </div>
                        ),
                      )}
                  </div>
                </section>
              )}

              <section className="manager-panel identity-plan-notes-panel">
                <div className="manager-panel-header">
                  <div>
                    <h2>
                      Plan Notes
                    </h2>

                    <p>
                      Safety rules for
                      this dry-run stage.
                    </p>
                  </div>
                </div>

                <div className="identity-plan-note-list">
                  {identityPlan
                    .notes
                    .map(
                      (
                        note,
                        index,
                      ) => (
                        <div
                          key={
                            `${index}-${note}`
                          }
                          className="identity-plan-note"
                        >
                          <span>
                            ✓
                          </span>

                          <p>
                            {note}
                          </p>
                        </div>
                      ),
                    )}
                </div>
              </section>
            </>
          )}

          {identityPlan?.planReady && (
            <section className="manager-panel value-plan-action-panel">
              <div>
                <div className="manager-eyebrow">
                  DRY-RUN VALUE COMPARISON
                </div>

                <h2>
                  Compare Actual
                  Values
                </h2>

                <p>
                  Compare the actual
                  workbook values for
                  collections,
                  characters, tokens,
                  rarity, Magic, times,
                  and token requirements
                  against dmk-editor.db.
                  This remains read-only.
                </p>
              </div>

              <button
                type="button"
                className="primary-button"
                disabled={
                  !selectedPath ||
                  buildingValuePlan
                }
                onClick={() =>
                  void buildValuePlan()
                }
              >
                {buildingValuePlan
                  ? "Comparing Values..."
                  : valuePlan
                    ? "Rebuild Value Comparison"
                    : "Compare Actual Values"}
              </button>
            </section>
          )}

          {valuePlan && (
            <>
              <section className="database-status-bar value-plan-status-bar">
                <div>
                  <strong>
                    Actual Value
                    Comparison
                  </strong>

                  <span>
                    {valuePlan
                      .workbookVersion ??
                      valuePlan.fileName}
                  </span>
                </div>

                <div
                  className={
                    valuePlan.planReady
                      ? "database-status-pill"
                      : "master-import-review-pill"
                  }
                >
                  {valuePlanStatus}
                </div>
              </section>

              <section className="manager-panel value-plan-panel">
                <div className="manager-panel-header">
                  <div>
                    <h2>
                      Actual Value
                      Summary
                    </h2>

                    <p>
                      Matched identities
                      are now classified as
                      unchanged or changed.
                      New records show the
                      values a future import
                      would create.
                    </p>
                  </div>
                </div>

                <div className="value-plan-grid">
                  {valuePlan.sections.map(
                    (section) => (
                      <article
                        key={section.key}
                        className="value-plan-card"
                      >
                        <div className="identity-plan-card-heading">
                          <div>
                            <h3>
                              {section.label}
                            </h3>

                            <span>
                              {formatCount(
                                section.workbookRecords,
                              )}{" "}
                              workbook records
                            </span>
                          </div>

                          <span
                            className={
                              section.invalidRecords >
                              0
                                ? "master-import-source-pill master-import-source-pill-review"
                                : section.unresolvedReferences >
                                    0
                                  ? "master-import-source-pill master-import-source-pill-deferred"
                                  : "master-import-source-pill master-import-source-pill-good"
                            }
                          >
                            {section.invalidRecords >
                            0
                              ? "Review"
                              : section.unresolvedReferences >
                                  0
                                ? "Compared + Deferred"
                                : "Compared"}
                          </span>
                        </div>

                        <div className="value-plan-stat-grid">
                          <div className="identity-plan-stat">
                            <span>
                              Existing DB
                            </span>
                            <strong>
                              {formatCount(
                                section.databaseRecords,
                              )}
                            </strong>
                          </div>

                          <div className="identity-plan-stat identity-plan-stat-new">
                            <span>New</span>
                            <strong>
                              {formatCount(
                                section.newRecords,
                              )}
                            </strong>
                          </div>

                          <div className="identity-plan-stat identity-plan-stat-good">
                            <span>
                              Unchanged
                            </span>
                            <strong>
                              {formatCount(
                                section.unchangedRecords,
                              )}
                            </strong>
                          </div>

                          <div className="identity-plan-stat value-plan-stat-changed">
                            <span>Changed</span>
                            <strong>
                              {formatCount(
                                section.changedRecords,
                              )}
                            </strong>
                          </div>

                          <div className="identity-plan-stat identity-plan-stat-error">
                            <span>Invalid</span>
                            <strong>
                              {formatCount(
                                section.invalidRecords,
                              )}
                            </strong>
                          </div>

                          <div className="identity-plan-stat value-plan-stat-deferred">
                            <span>Deferred Refs</span>
                            <strong>
                              {formatCount(
                                section.unresolvedReferences,
                              )}
                            </strong>
                          </div>

                          <div className="identity-plan-stat">
                            <span>DB Only</span>
                            <strong>
                              {formatCount(
                                section.databaseOnlyRecords,
                              )}
                            </strong>
                          </div>
                        </div>

                        <div className="value-plan-fields">
                          <span>
                            Compared fields
                          </span>

                          <div>
                            {section.comparedFields.map(
                              (field) => (
                                <span
                                  key={field}
                                  className="value-plan-field-pill"
                                >
                                  {field}
                                </span>
                              ),
                            )}
                          </div>
                        </div>

                        {section.examples.length >
                          0 && (
                          <details className="identity-plan-examples">
                            <summary>
                              Show value
                              examples
                            </summary>

                            <div className="identity-example-list">
                              {section.examples.map(
                                (
                                  example,
                                  index,
                                ) => (
                                  <div
                                    key={`${example.source}-${index}`}
                                    className="identity-example-row value-example-row"
                                  >
                                    <div className="identity-example-main">
                                      <span
                                        className={valueStatusClass(
                                          example.status,
                                        )}
                                      >
                                        {valueStatusLabel(
                                          example.status,
                                        )}
                                      </span>

                                      <div>
                                        <strong>
                                          {example.displayName}
                                        </strong>

                                        <span>
                                          {example.source}
                                        </span>

                                        {example.recordId && (
                                          <code className="value-example-record-id">
                                            {example.recordId}
                                          </code>
                                        )}
                                      </div>
                                    </div>

                                    <div className="identity-example-detail">
                                      <p>
                                        {example.detail}
                                      </p>

                                      {example.differences.length >
                                        0 && (
                                        <div className="value-difference-list">
                                          {example.differences.map(
                                            (difference) => (
                                              <div
                                                key={`${example.source}-${difference.field}`}
                                                className="value-difference-row"
                                              >
                                                <strong>
                                                  {difference.field}
                                                </strong>

                                                <div>
                                                  <span>
                                                    Workbook
                                                  </span>
                                                  <code>
                                                    {difference.workbookValue}
                                                  </code>
                                                </div>

                                                <div>
                                                  <span>
                                                    Database
                                                  </span>
                                                  <code>
                                                    {difference.databaseValue}
                                                  </code>
                                                </div>
                                              </div>
                                            ),
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          </details>
                        )}
                      </article>
                    ),
                  )}
                </div>
              </section>

              {valuePlan.issues.length >
                0 && (
                <section className="manager-panel value-plan-issues-panel">
                  <div className="manager-panel-header">
                    <div>
                      <h2>
                        Value Review
                        Items
                      </h2>

                      <p>
                        Blocking value
                        errors must be
                        resolved before a
                        future database
                        import is enabled.
                      </p>
                    </div>
                  </div>

                  <div className="identity-issue-list">
                    {valuePlan.issues.map(
                      (issue, index) => (
                        <div
                          key={`${issue.section}-${issue.source}-${index}`}
                          className="identity-issue-row"
                        >
                          <span className="identity-issue-icon">
                            !
                          </span>

                          <div>
                            <strong>
                              {issue.section}
                            </strong>
                            <span>
                              {issue.source}
                            </span>
                            <p>
                              {issue.message}
                            </p>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </section>
              )}

              {valuePlan.deferredReferences.length >
                0 && (
                <section className="manager-panel value-plan-deferred-panel">
                  <div className="manager-panel-header">
                    <div>
                      <h2>
                        Deferred Token
                        References
                      </h2>

                      <p>
                        These are valid
                        forward references,
                        not bad workbook
                        data. A Character
                        Level can require a
                        token before that
                        token has been
                        defined elsewhere
                        in the Master.
                      </p>
                    </div>
                  </div>

                  <div className="identity-issue-list">
                    {valuePlan.deferredReferences.map(
                      (reference, index) => (
                        <div
                          key={`${reference.section}-${reference.source}-${index}`}
                          className="identity-issue-row value-plan-deferred-row"
                        >
                          <span className="identity-issue-icon value-plan-deferred-icon">
                            ~
                          </span>

                          <div>
                            <strong>
                              {reference.section}
                            </strong>
                            <span>
                              {reference.source}
                            </span>
                            <p>
                              {reference.message}
                            </p>
                          </div>
                        </div>
                      ),
                    )}
                  </div>

                  <div className="value-plan-deferred-note">
                    These references do not
                    block the read-only
                    comparison. Database
                    writing will remain
                    disabled until the
                    importer can preserve
                    them safely and link
                    them when the missing
                    token is added later.
                  </div>
                </section>
              )}

              <section className="manager-panel value-plan-notes-panel">
                <div className="manager-panel-header">
                  <div>
                    <h2>
                      Comparison Notes
                    </h2>

                    <p>
                      Fields intentionally
                      included or excluded
                      from this dry-run.
                    </p>
                  </div>
                </div>

                <div className="identity-plan-note-list">
                  {valuePlan.notes.map(
                    (note, index) => (
                      <div
                        key={`${index}-${note}`}
                        className="identity-plan-note"
                      >
                        <span>✓</span>
                        <p>{note}</p>
                      </div>
                    ),
                  )}
                </div>
              </section>
            </>
          )}

          <section className="manager-panel master-import-sheets-panel">
            <div className="manager-panel-header">
              <div>
                <h2>
                  Worksheet
                  Inventory
                </h2>

                <p>
                  Confirms the
                  sheets and used
                  range dimensions
                  seen by the
                  reader.
                </p>
              </div>
            </div>

            <div className="manager-table-wrap">
              <table className="manager-table">
                <thead>
                  <tr>
                    <th>
                      Worksheet
                    </th>

                    <th className="number-column">
                      Rows
                    </th>

                    <th className="number-column">
                      Columns
                    </th>

                    <th>
                      DMK Sheet
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {inspection
                    .sheets
                    .map(
                      (
                        sheet,
                      ) => (
                        <tr
                          key={
                            sheet.name
                          }
                        >
                          <td>
                            <strong>
                              {
                                sheet.name
                              }
                            </strong>
                          </td>

                          <td className="number-column">
                            {formatCount(
                              sheet.rows,
                            )}
                          </td>

                          <td className="number-column">
                            {formatCount(
                              sheet.columns,
                            )}
                          </td>

                          <td>
                            <span
                              className={
                                sheet
                                  .recognized
                                  ? "record-pill record-pill-active"
                                  : "record-pill"
                              }
                            >
                              {sheet
                                .recognized
                                ? "Known"
                                : "Other"}
                            </span>
                          </td>
                        </tr>
                      ),
                    )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="manager-panel master-import-next-panel">
            <div>
              <div className="manager-eyebrow">
                NEXT IMPORT STAGE
              </div>

              <h2>
                Database Import
              </h2>

              <p>
                Once the actual value
                comparison is verified,
                the next stage will build
                the controlled database
                write transaction. Import
                remains disabled until the
                dry-run results are proven
                correct.
              </p>
            </div>

            <button
              type="button"
              className="primary-button"
              disabled
            >
              Import to Database
              — Disabled
            </button>
          </section>
        </>
      )}
    </>
  );
}

export default MasterImportPage;
