import type { RequesterScope, SkillLeaderboardQueryPlan, SkillListQuery, SkillListQueryPlan } from "./skills.types";

export interface SkillListQueryOptions {
  requester?: RequesterScope;
  requirePublished?: boolean;
}

export function positiveInt(value: string | undefined, fallback: number, max = 100): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, max);
}

export function buildSkillListQueryPlan(query: SkillListQuery, options: SkillListQueryOptions = {}): SkillListQueryPlan {
  const page = positiveInt(query.page, 1);
  const pageSize = positiveInt(query.pageSize, 20, 100);
  const offset = (page - 1) * pageSize;
  const values: unknown[] = [];
  const conditions: string[] = [];
  const searchTerm = query.q?.trim();
  const requestedTags = parseTagsQuery(query.tags);

  const push = (value: unknown): string => {
    values.push(value);
    return `$${values.length}`;
  };

  const searchParam = searchTerm ? push(searchTerm) : null;

  if (searchParam) {
    conditions.push(
      `(doc.search_vector @@ websearch_to_tsquery('simple', ${searchParam}) OR POSITION(LOWER(${searchParam}) IN LOWER(doc.document)) > 0)`
    );
  }

  if (options.requirePublished) {
    conditions.push("s.status = 'published'");
  }

  if (query.departmentID) {
    conditions.push(`d.name = ${push(query.departmentID)}`);
  }

  if (query.compatibleTool) {
    conditions.push(
      `EXISTS (
        SELECT 1
        FROM skill_tool_compatibilities tc_filter
        WHERE tc_filter.skill_id = s.id AND tc_filter.tool_id = ${push(query.compatibleTool)}
      )`
    );
  }

  if (query.category) {
    conditions.push(`s.category = ${push(query.category)}`);
  }

  if (requestedTags.length > 0) {
    conditions.push(
      `EXISTS (
        SELECT 1
        FROM skill_tags st_filter
        WHERE st_filter.skill_id = s.id AND st_filter.tag = ANY(${push(requestedTags)}::text[])
      )`
    );
  }

  if (query.riskLevel) {
    conditions.push(`v.risk_level = ${push(query.riskLevel)}`);
  }

  if (query.publishedSince) {
    conditions.push(`v.published_at >= ${push(query.publishedSince)}`);
  }

  if (query.updatedSince) {
    conditions.push(`s.updated_at >= ${push(query.updatedSince)}`);
  }

  if (options.requester) {
    conditions.push(buildRequesterVisibilityCondition(options.requester, query.accessScope === "authorized_only", push));
  } else if (query.accessScope === "authorized_only") {
    conditions.push(`s.visibility_level <> 'private'`);
  }

  const whereClause = conditions.length > 0 ? conditions.join("\n        AND ") : "TRUE";
  const orderByClause = buildSkillOrderClause(query.sort ?? "composite", searchParam);
  const limitParam = push(pageSize);
  const offsetParam = push(offset);
  const requesterStarParam = options.requester ? push(options.requester.user_id) : null;
  const requesterStarJoin = requesterStarParam
    ? `LEFT JOIN skill_stars requester_star ON requester_star.skill_id = s.id AND requester_star.user_id = ${requesterStarParam}`
    : "";
  const requesterStarSelect = requesterStarParam ? "(requester_star.user_id IS NOT NULL)" : "false";
  const requesterStarGroupBy = requesterStarParam ? ",\n          requester_star.user_id" : "";

  return {
    page,
    pageSize,
    values,
    text: `
      WITH star_counts AS (
        SELECT skill_id, count(*)::bigint AS star_count
        FROM skill_stars
        GROUP BY skill_id
      ),
      download_counts AS (
        SELECT skill_id, count(DISTINCT user_id)::bigint AS download_count
        FROM download_events
        WHERE purpose = 'install'
        GROUP BY skill_id
      ),
      base AS (
        SELECT
          s.id,
          s.skill_id,
          s.display_name,
          s.description,
          s.status,
          s.visibility_level,
          s.category,
          s.updated_at,
          v.version,
          v.risk_level,
          v.risk_description,
          v.review_summary,
          v.published_at,
          u.username AS author_name,
          d.name AS author_department,
          COALESCE(array_agg(DISTINCT st.tag) FILTER (WHERE st.tag IS NOT NULL), '{}') AS tags,
          COALESCE(array_agg(DISTINCT tc.tool_id) FILTER (WHERE tc.tool_id IS NOT NULL), '{}') AS compatible_tools,
          COALESCE(array_agg(DISTINCT tc.system) FILTER (WHERE tc.system IS NOT NULL), '{}') AS compatible_systems,
          auth.scope_type,
          auth.scope_department_ids,
          auth.scope_department_paths,
          COALESCE(stars.star_count, 0)::text AS star_count,
          ${requesterStarSelect} AS starred,
          COALESCE(downloads.download_count, 0)::text AS download_count,
          doc.document,
          ${searchParam ? `ts_rank_cd(doc.search_vector, websearch_to_tsquery('simple', ${searchParam}))` : "0"} AS search_rank
        FROM skills s
        JOIN skill_versions v ON v.id = s.current_version_id
        LEFT JOIN users u ON u.id = s.author_id
        LEFT JOIN departments d ON d.id = s.department_id
        LEFT JOIN skill_tags st ON st.skill_id = s.id
        LEFT JOIN skill_tool_compatibilities tc ON tc.skill_id = s.id
        LEFT JOIN LATERAL (
          SELECT
            sa.scope_type,
            array_remove(array_agg(sa.department_id ORDER BY sa.department_id), NULL) AS scope_department_ids,
            array_remove(array_agg(scope_department.path ORDER BY scope_department.path), NULL) AS scope_department_paths
          FROM skill_authorizations sa
          LEFT JOIN departments scope_department ON scope_department.id = sa.department_id
          WHERE sa.skill_id = s.id
          GROUP BY sa.scope_type
          ORDER BY count(*) DESC, sa.scope_type ASC
          LIMIT 1
        ) auth ON true
        LEFT JOIN skill_search_documents doc ON doc.skill_id = s.id
        LEFT JOIN star_counts stars ON stars.skill_id = s.id
        LEFT JOIN download_counts downloads ON downloads.skill_id = s.id
        ${requesterStarJoin}
        WHERE ${whereClause}
        GROUP BY
          s.id,
          v.id,
          u.username,
          d.name,
          auth.scope_type,
          auth.scope_department_ids,
          auth.scope_department_paths,
          doc.document,
          doc.search_vector,
          stars.star_count,
          downloads.download_count${requesterStarGroupBy}
      )
      SELECT
        base.id,
        base.skill_id,
        base.display_name,
        base.description,
        base.status,
        base.visibility_level,
        base.category,
        base.updated_at,
        base.version,
        base.risk_level,
        base.risk_description,
        base.review_summary,
        base.published_at,
        base.author_name,
        base.author_department,
        base.tags,
        base.compatible_tools,
        base.compatible_systems,
        base.scope_type,
        base.scope_department_ids,
        base.scope_department_paths,
        base.star_count,
        base.starred,
        base.download_count,
        count(*) OVER()::text AS total_count
      FROM base
      ORDER BY ${orderByClause}
      LIMIT ${limitParam}
      OFFSET ${offsetParam}
    `
  };
}

export function buildSkillLeaderboardQueryPlan(windowDays = 7, options: SkillListQueryOptions = {}): SkillLeaderboardQueryPlan {
  const values: unknown[] = [windowDays];
  const push = (value: unknown): string => {
    values.push(value);
    return `$${values.length}`;
  };
  const requesterStarParam = options.requester ? push(options.requester.user_id) : null;
  const requesterStarJoin = requesterStarParam
    ? `LEFT JOIN skill_stars requester_star ON requester_star.skill_id = s.id AND requester_star.user_id = ${requesterStarParam}`
    : "";
  const requesterStarSelect = requesterStarParam ? "(requester_star.user_id IS NOT NULL)" : "false";
  const requesterStarGroupBy = requesterStarParam ? ",\n        requester_star.user_id" : "";

  return {
    values,
    text: `
      WITH star_counts AS (
        SELECT skill_id, count(*)::bigint AS star_count
        FROM skill_stars
        GROUP BY skill_id
      ),
      download_counts AS (
        SELECT skill_id, count(DISTINCT user_id)::bigint AS download_count
        FROM download_events
        WHERE purpose = 'install'
        GROUP BY skill_id
      ),
      recent_star_counts AS (
        SELECT skill_id, count(*)::bigint AS recent_star_count
        FROM skill_stars
        WHERE created_at >= now() - ($1::int * INTERVAL '1 day')
        GROUP BY skill_id
      ),
      recent_download_counts AS (
        SELECT skill_id, count(DISTINCT user_id)::bigint AS recent_download_count
        FROM download_events
        WHERE purpose = 'install'
          AND created_at >= now() - ($1::int * INTERVAL '1 day')
        GROUP BY skill_id
      )
      SELECT
        s.id,
        s.skill_id,
        s.display_name,
        s.description,
        s.status,
        s.visibility_level,
        s.category,
        s.updated_at,
        v.version,
        v.risk_level,
        v.risk_description,
        v.review_summary,
        v.published_at,
        u.username AS author_name,
        d.name AS author_department,
        COALESCE(array_agg(DISTINCT st.tag) FILTER (WHERE st.tag IS NOT NULL), '{}') AS tags,
        COALESCE(array_agg(DISTINCT tc.tool_id) FILTER (WHERE tc.tool_id IS NOT NULL), '{}') AS compatible_tools,
        COALESCE(array_agg(DISTINCT tc.system) FILTER (WHERE tc.system IS NOT NULL), '{}') AS compatible_systems,
        auth.scope_type,
        auth.scope_department_ids,
        auth.scope_department_paths,
        COALESCE(stars.star_count, 0)::text AS star_count,
        ${requesterStarSelect} AS starred,
        COALESCE(downloads.download_count, 0)::text AS download_count,
        COALESCE(recent_stars.recent_star_count, 0)::text AS recent_star_count,
        COALESCE(recent_downloads.recent_download_count, 0)::text AS recent_download_count,
        (
          (
            COALESCE(recent_downloads.recent_download_count, 0) * 6
            + COALESCE(recent_stars.recent_star_count, 0) * 3
            + CASE WHEN s.updated_at >= now() - ($1::int * INTERVAL '1 day') THEN 2 ELSE 0 END
          )
          * CASE
              WHEN COALESCE(v.risk_level, 'unknown') = 'high' THEN 0.5
              WHEN COALESCE(v.risk_level, 'unknown') = 'medium' THEN 0.8
              ELSE 1.0
            END
        )::text AS hot_score
      FROM skills s
      JOIN skill_versions v ON v.id = s.current_version_id
      LEFT JOIN users u ON u.id = s.author_id
      LEFT JOIN departments d ON d.id = s.department_id
      LEFT JOIN skill_tags st ON st.skill_id = s.id
      LEFT JOIN skill_tool_compatibilities tc ON tc.skill_id = s.id
      LEFT JOIN LATERAL (
        SELECT
          sa.scope_type,
          array_remove(array_agg(sa.department_id ORDER BY sa.department_id), NULL) AS scope_department_ids,
          array_remove(array_agg(scope_department.path ORDER BY scope_department.path), NULL) AS scope_department_paths
        FROM skill_authorizations sa
        LEFT JOIN departments scope_department ON scope_department.id = sa.department_id
        WHERE sa.skill_id = s.id
        GROUP BY sa.scope_type
        ORDER BY count(*) DESC, sa.scope_type ASC
        LIMIT 1
      ) auth ON true
      LEFT JOIN star_counts stars ON stars.skill_id = s.id
      LEFT JOIN download_counts downloads ON downloads.skill_id = s.id
      LEFT JOIN recent_star_counts recent_stars ON recent_stars.skill_id = s.id
      LEFT JOIN recent_download_counts recent_downloads ON recent_downloads.skill_id = s.id
      ${requesterStarJoin}
      WHERE s.status = 'published'
        AND s.visibility_level <> 'private'
      GROUP BY
        s.id,
        v.id,
        u.username,
        d.name,
        auth.scope_type,
        auth.scope_department_ids,
        auth.scope_department_paths,
        stars.star_count,
        downloads.download_count,
        recent_stars.recent_star_count,
        recent_downloads.recent_download_count${requesterStarGroupBy}
    `
  };
}

function parseTagsQuery(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
}

function buildRequesterVisibilityCondition(
  requester: RequesterScope,
  authorizedOnly: boolean,
  push: (value: unknown) => string,
): string {
  const departmentID = push(requester.department_id);
  const departmentPath = push(requester.department_path);
  const departmentPathLike = push(requester.department_path);
  const authorizedCondition = `(
    auth.scope_type = 'all_employees'
    OR (auth.scope_type IN ('current_department', 'selected_departments') AND ${departmentID} = ANY(auth.scope_department_ids))
    OR (auth.scope_type = 'department_tree' AND EXISTS (
      SELECT 1
      FROM unnest(auth.scope_department_paths) AS scope_path
      WHERE ${departmentPath} = scope_path OR ${departmentPathLike} LIKE scope_path || '/%'
    ))
    OR (auth.scope_type IS NULL AND s.visibility_level = 'public_installable')
  )`;

  if (authorizedOnly) {
    return `(s.visibility_level <> 'private' AND ${authorizedCondition})`;
  }

  return `(
    s.visibility_level IN ('public_installable', 'detail_visible', 'summary_visible')
    OR ${authorizedCondition}
  )`;
}

function buildSkillOrderClause(sort: string, searchParam: string | null): string {
  const searchBoost = searchParam
    ? `CASE WHEN POSITION(LOWER(${searchParam}) IN LOWER(base.document)) > 0 THEN 100 ELSE 0 END`
    : "0";
  const publishedBoost = `CASE WHEN base.status = 'published' THEN 10 ELSE 0 END`;
  const composite = `(${searchBoost} + ${publishedBoost} + base.star_count::bigint + (base.download_count::bigint / 10.0)) DESC, base.updated_at DESC, base.skill_id ASC`;

  switch (sort) {
    case "latest_published":
      return `base.published_at DESC, base.updated_at DESC, base.skill_id ASC`;
    case "recently_updated":
      return `base.updated_at DESC, base.skill_id ASC`;
    case "download_count":
      return `base.download_count::bigint DESC, base.updated_at DESC, base.skill_id ASC`;
    case "star_count":
      return `base.star_count::bigint DESC, base.updated_at DESC, base.skill_id ASC`;
    case "relevance":
      return searchParam
        ? `base.search_rank DESC, ${searchBoost} DESC, ${publishedBoost} DESC, base.star_count::bigint DESC, base.download_count::bigint DESC, base.updated_at DESC, base.skill_id ASC`
        : composite;
    case "composite":
    default:
      return composite;
  }
}

export function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
