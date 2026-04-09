// @ts-nocheck
import { execSql, queryMany, queryOne, sqlJson, sqlLiteral, sqlUuid } from '../lib/postgres-cli.js';

function mapReport(row) {
  return row
    ? Object.freeze({
        packageId: row.packageId,
        valid: Boolean(row.valid),
        hash: row.hash,
        createdAt: row.createdAt,
        uploadedBy: row.uploadedBy ?? null,
        findings: Object.freeze([...(row.findings ?? [])]),
        manifest: Object.freeze({
          skillId: row.manifest.skillId,
          version: row.manifest.version,
          title: row.manifest.title,
          summary: row.manifest.summary ?? '',
          tags: Object.freeze([...(row.manifest.tags ?? [])]),
        }),
        files: Object.freeze([...(row.files ?? [])].map((entry) => Object.freeze(entry))),
        storage: row.storage
          ? Object.freeze({
              kind: row.storage.kind,
              packageRoot: row.storage.packageRoot,
              manifestPath: row.storage.manifestPath ?? null,
              files: Object.freeze([...(row.storage.files ?? [])].map((entry) => Object.freeze(entry))),
            })
          : null,
      })
    : null;
}

export function createPostgresPackageReportRepository(input) {
  const databaseUrl = input.databaseUrl;

  return Object.freeze({
    save(report) {
      execSql(
        databaseUrl,
        `
          insert into package.uploads (
            package_id, skill_id, version, title, summary, uploaded_by,
            storage_kind, package_root, manifest_path, artifact_hash, valid, created_at, updated_at
          ) values (
            ${sqlLiteral(report.packageId)},
            ${sqlLiteral(report.manifest.skillId)},
            ${sqlLiteral(report.manifest.version)},
            ${sqlLiteral(report.manifest.title)},
            ${sqlLiteral(report.manifest.summary)},
            ${sqlUuid(report.uploadedBy)},
            ${sqlLiteral(report.storage?.kind ?? 'report-only')},
            ${sqlLiteral(report.storage?.packageRoot ?? report.packageId)},
            ${sqlLiteral(report.storage?.manifestPath ?? null)},
            ${sqlLiteral(report.hash)},
            ${report.valid ? 'true' : 'false'},
            ${sqlLiteral(report.createdAt)}::timestamptz,
            ${sqlLiteral(report.createdAt)}::timestamptz
          )
          on conflict (package_id) do update set
            skill_id = excluded.skill_id,
            version = excluded.version,
            title = excluded.title,
            summary = excluded.summary,
            uploaded_by = excluded.uploaded_by,
            storage_kind = excluded.storage_kind,
            package_root = excluded.package_root,
            manifest_path = excluded.manifest_path,
            artifact_hash = excluded.artifact_hash,
            valid = excluded.valid,
            updated_at = excluded.updated_at
        `,
      );

      execSql(
        databaseUrl,
        `
          delete from package.artifact_files
          where package_id = ${sqlLiteral(report.packageId)}
        `,
      );

      for (const file of report.storage?.files ?? []) {
        execSql(
          databaseUrl,
          `
            insert into package.artifact_files (
              package_id, path, size_bytes, sha256, storage_path
            ) values (
              ${sqlLiteral(report.packageId)},
              ${sqlLiteral(file.path)},
              ${Number(file.size)},
              ${sqlLiteral(file.sha256)},
              ${sqlLiteral(file.storagePath)}
            )
          `,
        );
      }

      execSql(
        databaseUrl,
        `
          insert into package.validation_reports (
            package_id, uploaded_by, valid, report_hash, findings, manifest, created_at, updated_at
          ) values (
            ${sqlLiteral(report.packageId)},
            ${sqlUuid(report.uploadedBy)},
            ${report.valid ? 'true' : 'false'},
            ${sqlLiteral(report.hash)},
            ${sqlJson(report.findings)},
            ${sqlJson(report.manifest)},
            ${sqlLiteral(report.createdAt)}::timestamptz,
            ${sqlLiteral(report.createdAt)}::timestamptz
          )
          on conflict (package_id) do update set
            uploaded_by = excluded.uploaded_by,
            valid = excluded.valid,
            report_hash = excluded.report_hash,
            findings = excluded.findings,
            manifest = excluded.manifest,
            updated_at = excluded.updated_at
        `,
      );

      return this.get(report.packageId);
    },

    get(packageId) {
      return mapReport(
        queryOne(
          databaseUrl,
          `
            select
              uploads.package_id as "packageId",
              reports.valid,
              reports.report_hash as hash,
              reports.created_at::text as "createdAt",
              reports.uploaded_by::text as "uploadedBy",
              reports.findings,
              reports.manifest,
              case
                when uploads.storage_kind = 'report-only' then null
                else json_build_object(
                  'kind', uploads.storage_kind,
                  'packageRoot', uploads.package_root,
                  'manifestPath', uploads.manifest_path,
                  'files', (
                    select coalesce(
                      json_agg(
                        json_build_object(
                          'path', files.path,
                          'size', files.size_bytes,
                          'sha256', files.sha256,
                          'storagePath', files.storage_path
                        )
                        order by files.path asc
                      ),
                      '[]'::json
                    )
                    from package.artifact_files files
                    where files.package_id = uploads.package_id
                  )
                )
              end as storage,
              (
                select coalesce(
                  json_agg(
                    json_build_object(
                      'path', files.path,
                      'size', files.size_bytes,
                      'sha256', files.sha256
                    )
                    order by files.path asc
                  ),
                  '[]'::json
                )
                from package.artifact_files files
                where files.package_id = uploads.package_id
              ) as files
            from package.uploads uploads
            join package.validation_reports reports on reports.package_id = uploads.package_id
            where uploads.package_id = ${sqlLiteral(packageId)}
          `,
        ),
      );
    },

    list() {
      return Object.freeze(
        queryMany(
          databaseUrl,
          `
            select uploads.package_id as "packageId"
            from package.uploads uploads
            order by uploads.created_at desc
          `,
        )
          .map((row) => this.get(row.packageId))
          .filter(Boolean),
      );
    },
  });
}
