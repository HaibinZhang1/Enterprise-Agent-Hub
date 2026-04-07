export function createMemoryPackageReportRepository() {
  /** @type {Map<string, ReturnType<typeof import('../core/validation-report.js').createPackageValidationReport>>} */
  const reports = new Map();

  return Object.freeze({
    /**
     * @param {ReturnType<typeof import('../core/validation-report.js').createPackageValidationReport>} report
     */
    save(report) {
      reports.set(report.packageId, report);
      return report;
    },

    /**
     * @param {string} packageId
     */
    get(packageId) {
      return reports.get(packageId) ?? null;
    },

    list() {
      return Object.freeze([...reports.values()]);
    },
  });
}
