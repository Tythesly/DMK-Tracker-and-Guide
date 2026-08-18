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

function MasterImportPage() {
  const [
    inspection,
    setInspection,
  ] =
    useState<
      MasterWorkbookInspection | null
    >(null);

  const [
    inspecting,
    setInspecting,
  ] = useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  async function selectWorkbook() {
    setError(null);

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

  const statusLabel =
    inspection === null
      ? "No workbook selected"
      : inspection
            .readyForMapping
        ? "Ready for mapping"
        : "Review required";

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
            Master workbook
            before importing
            game data into the
            authoring database.
          </p>
        </div>
      </header>

      <div className="manager-warning-banner">
        <strong>
          Read-only inspection
        </strong>

        <span>
          This first stage does
          not add, update, or
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
            known headers instead
            of depending on fixed
            worksheet row
            numbers.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          disabled={
            inspecting
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
                  to receive
                  workbook data.
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
                        {source.recordCount.toLocaleString(
                          "en-US",
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
                    Review Items
                  </h2>

                  <p>
                    Nothing will
                    be imported
                    while these
                    results are
                    being
                    reviewed.
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
                            {sheet.rows.toLocaleString(
                              "en-US",
                            )}
                          </td>

                          <td className="number-column">
                            {sheet.columns.toLocaleString(
                              "en-US",
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
                NEXT STAGE
              </div>

              <h2>
                Build Import Plan
              </h2>

              <p>
                After the
                inspector is
                verified against
                your real Master,
                the next stage
                will compare
                workbook records
                with existing
                stable IDs,
                identify inserts,
                updates and
                unchanged
                records, and flag
                ambiguous matches
                before anything
                is written.
              </p>
            </div>

            <button
              type="button"
              className="primary-button"
              disabled
            >
              Import to Database
              — Next Stage
            </button>
          </section>
        </>
      )}
    </>
  );
}

export default MasterImportPage;