# 前端页面设计

## 页面索引
- [home](./home.md)
- [market](./market.md)
- [my-skill](./my-skill.md)
- [review](./review.md)
- [department-management](./department-management.md)
- [user-management](./user-management.md)
- [skill-management](./skill-management.md)
- [tools](./tools.md)
- [projects](./projects.md)
- [notifications](./notifications.md)
- [settings](./settings.md)

## 页面统一约束
- 使用 Ant Design + TanStack Query + Zustand
- 所有列表页都需定义 loading / empty / error / permission denied 状态
- 红点、待办、通知优先使用 SSE 实时收敛，失败时退化为轮询
- 权限不足表现必须与 17_interaction_ux.md 保持一致
