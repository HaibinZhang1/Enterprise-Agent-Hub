import { createPackageValidationReport } from '../core/validation-report.js';

/**
 * @param {{
 *   packageReportRepository: ReturnType<typeof import('../repositories/memory-package-report-repository.js').createMemoryPackageReportRepository>;
 *   auditService: ReturnType<typeof import('../../audit/services/audit-service.js').createAuditService>;
 * }} input
 */
export function createPackageService(input) {
  return Object.freeze({
    /**
     * @param {{
     *   requestId: string;
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   packageId: string;
     *   files: { path: string; size?: number; sha256?: string | null }[];
     *   manifest: { skillId: string; version: string; title: string; summary?: string; tags?: string[] };
     *   now?: Date;
     * }} uploadInput
     */
    upload(uploadInput) {
      const report = createPackageValidationReport({
        packageId: uploadInput.packageId,
        files: uploadInput.files,
        manifest: uploadInput.manifest,
      });
      input.packageReportRepository.save(report);
      input.auditService.record({
        requestId: uploadInput.requestId,
        actor: uploadInput.actor,
        targetType: 'package',
        targetId: uploadInput.packageId,
        action: 'package.uploaded',
        details: { valid: report.valid, findings: report.findings.length },
        occurredAt: uploadInput.now,
      });
      return report;
    },

    /**
     * @param {string} packageId
     */
    getReport(packageId) {
      const report = input.packageReportRepository.get(packageId);
      if (!report) {
        throw new Error(`Unknown package report: ${packageId}`);
      }
      return report;
    },
  });
}
