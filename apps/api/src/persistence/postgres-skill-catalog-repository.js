// @ts-nocheck
import { execSql, queryMany, queryOne, sqlJson, sqlLiteral, sqlUuid } from '../lib/postgres-cli.js';

function mapSkill(row) {
  return row
    ? Object.freeze({
        skillId: row.skillId,
        ownerUserId: row.ownerUserId,
        title: row.title,
        summary: row.summary,
        visibility: row.visibility,
        allowedDepartmentIds: Object.freeze([...(row.allowedDepartmentIds ?? [])]),
        status: row.status,
        versions: Object.freeze([...(row.versions ?? [])]),
        publishedVersion: row.publishedVersion ?? null,
      })
    : null;
}

export function createPostgresSkillCatalogRepository(input) {
  const databaseUrl = input.databaseUrl;

  function select(whereSql = '') {
    return queryMany(
      databaseUrl,
      `
        select
          skill_id as "skillId",
          owner_user_id::text as "ownerUserId",
          title,
          summary,
          visibility,
          allowed_department_ids as "allowedDepartmentIds",
          status,
          history as versions,
          current_version as "publishedVersion"
        from skill.catalog
        ${whereSql}
        order by title asc
      `,
    ).map(mapSkill);
  }

  return Object.freeze({
    save(skill) {
      execSql(
        databaseUrl,
        `
          insert into skill.catalog (
            skill_id, owner_user_id, title, summary, visibility, allowed_department_ids,
            current_version, history, status, updated_at
          ) values (
            ${sqlLiteral(skill.skillId)},
            ${sqlUuid(skill.ownerUserId)},
            ${sqlLiteral(skill.title)},
            ${sqlLiteral(skill.summary)},
            ${sqlLiteral(skill.visibility)},
            ${sqlJson(skill.allowedDepartmentIds ?? [])},
            ${sqlLiteral(skill.publishedVersion)},
            ${sqlJson(skill.versions ?? [])},
            ${sqlLiteral(skill.status)},
            now()
          )
          on conflict (skill_id) do update set
            owner_user_id = excluded.owner_user_id,
            title = excluded.title,
            summary = excluded.summary,
            visibility = excluded.visibility,
            allowed_department_ids = excluded.allowed_department_ids,
            current_version = excluded.current_version,
            history = excluded.history,
            status = excluded.status,
            updated_at = now()
        `,
      );
      return this.get(skill.skillId);
    },

    get(skillId) {
      return mapSkill(
        queryOne(
          databaseUrl,
          `
            select
              skill_id as "skillId",
              owner_user_id::text as "ownerUserId",
              title,
              summary,
              visibility,
              allowed_department_ids as "allowedDepartmentIds",
              status,
              history as versions,
              current_version as "publishedVersion"
            from skill.catalog
            where skill_id = ${sqlLiteral(skillId)}
          `,
        ),
      );
    },

    list() {
      return Object.freeze(select());
    },
  });
}
