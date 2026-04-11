"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pageOf = pageOf;
exports.errorBody = errorBody;
function pageOf(items, page, pageSize, total = items.length) {
    return {
        items,
        page,
        pageSize,
        total,
        hasMore: page * pageSize < total,
    };
}
function errorBody(code, message, retryable = false, detail = null) {
    return { error: { code, message, detail, retryable } };
}
