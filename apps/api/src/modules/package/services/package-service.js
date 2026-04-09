import { createPackageValidationReport } from '../core/validation-report.js';

/**
 * @param {{
 *   packageReportRepository: { save: (report: ReturnType<typeof import('../core/validation-report.js').createPackageValidationReport>) => unknown; get: (packageId: string) => ReturnType<typeof import('../core/validation-report.js').createPackageValidationReport> | null };
 *   auditService: ReturnType<typeof import('../../audit/services/audit-service.js').createAuditService>;
 *   artifactStorage?: { savePackage: (input: { packageId: string; files: { path: string; size?: number; sha256?: string | null; contentText?: string; contentBase64?: string }[]; manifest: { skillId: string; version: string; title: string; summary?: string; tags?: string[] } }) => { kind: string; packageRoot: string; manifestPath?: string; files: { path: string; size: number; sha256: string; storagePath: string }[] } };
 * }} input
 */
export function createPackageService(input) {
  return Object.freeze({
    /**
     * @param {{
     *   requestId: string;
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   packageId: string;
     *   files: { path: string; size?: number; sha256?: string | null; contentText?: string; contentBase64?: string }[];
     *   manifest: { skillId: string; version: string; title: string; summary?: string; tags?: string[] };
     *   now?: Date;
     * }} uploadInput
     */
    upload(uploadInput) {
      const storage = input.artifactStorage?.savePackage({
        packageId: uploadInput.packageId,
        files: uploadInput.files,
        manifest: uploadInput.manifest,
      });
      const report = createPackageValidationReport({
        packageId: uploadInput.packageId,
        files: storage?.files ?? uploadInput.files,
        manifest: uploadInput.manifest,
        storage,
        uploadedBy: uploadInput.actor.userId,
        createdAt: uploadInput.now,
      });
      input.packageReportRepository.save(report);
      input.auditService.record({
        requestId: uploadInput.requestId,
        actor: uploadInput.actor,
        targetType: 'package',
        targetId: uploadInput.packageId,
        action: 'package.uploaded',
        details: {
          valid: report.valid,
          findings: report.findings.length,
          storageKind: report.storage?.kind ?? 'report-only',
        },
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
