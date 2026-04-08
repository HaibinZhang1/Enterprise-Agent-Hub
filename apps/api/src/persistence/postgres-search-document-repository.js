// @ts-nocheck
import { execSql, queryMany, sqlJson, sqlLiteral, sqlUuid } from '../lib/postgres-cli.js';

function mapDocument(row) {
  return Object.freeze({
    skillId: row.skillId,
    title: row.title,
    summary: row.summary,
    ownerUserId: row.ownerUserId,
    publishedVersion: row.publishedVersion ?? null,
    visibility: row.visibility,
    allowedDepartmentIds: Object.freeze([...(row.allowedDepartmentIds ?? [])]),
    tags: Object.freeze([...(row.tags ?? [])]),
  });
}

export function createPostgresSearchDocumentRepository(input) {
  const databaseUrl = input.databaseUrl;

  return Object.freeze({
    upsert(document) {
      execSql(
        databaseUrl,
        `
          insert into search.documents (
            skill_id, title, summary, owner_user_id, published_version,
            visibility, allowed_department_ids, tags, updated_at
          ) values (
            ${sqlLiteral(document.skillId)},
            ${sqlLiteral(document.title)},
            ${sqlLiteral(document.summary)},
            ${sqlUuid(document.ownerUserId)},
            ${sqlLiteral(document.publishedVersion)},
            ${sqlLiteral(document.visibility)},
            ${sqlJson(document.allowedDepartmentIds ?? [])},
            ${sqlJson(document.tags ?? [])},
            now()
          )
          on conflict (skill_id) do update set
            title = excluded.title,
            summary = excluded.summary,
            owner_user_id = excluded.owner_user_id,
            published_version = excluded.published_version,
            visibility = excluded.visibility,
            allowed_department_ids = excluded.allowed_department_ids,
            tags = excluded.tags,
            updated_at = now()
        `,
      );
      return document;
    },

    list() {
      return Object.freeze(
        queryMany(
          databaseUrl,
          `
            select
              skill_id as "skillId",
              title,
              summary,
              owner_user_id::text as "ownerUserId",
              published_version as "publishedVersion",
              visibility,
              allowed_department_ids as "allowedDepartmentIds",
              tags
            from search.documents
            order by updated_at desc
          `,
        ).map(mapDocument),
      );
    },
  });
}
