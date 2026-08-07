# Foundation Management Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver editable personnel/team, area/base-station, and user/role workbenches with transactional audit logs.

**Architecture:** Keep business rules in the six NestJS domain services and write `AuditLog` in the same Prisma transaction as each mutation. Replace the read-only Vue resource table with one lightweight configurable management component, while each page owns its lookup options and relation mapping.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Vue 3, Vite, Element Plus, Jest, Docker Compose.

## Global Constraints

- Preserve API prefix `/api/v1`, Swagger path `/api/docs`, and current JWT permission guards.
- Do not add npm dependencies or alter the Prisma schema.
- Every backend behavior starts with a failing Jest test.
- Keep the current restrained table-driven admin design and 8px-or-less radii.
- All six module mutations write actor-aware `AuditLog` rows transactionally.

---

### Task 1: Personnel And Team Transactions

**Files:**
- Create: `apps/api/src/modules/personnel/personnel.service.spec.ts`
- Create: `apps/api/src/modules/teams/teams.service.spec.ts`
- Modify: `apps/api/src/modules/personnel/personnel.service.ts`
- Modify: `apps/api/src/modules/personnel/personnel.controller.ts`
- Modify: `apps/api/src/modules/teams/teams.service.ts`
- Modify: `apps/api/src/modules/teams/teams.controller.ts`

**Interfaces:**
- `create(dto, userId?: string)`, `update(id, dto, userId?: string)`, `remove(id, userId?: string)`.
- Audit modules are `personnel` and `teams`; actions are `CREATE`, `UPDATE`, `DELETE`.

- [ ] **Step 1: Write failing service tests**

Assert that create/update/delete call the real service and produce transaction-scoped audit data such as:

```ts
expect(tx.auditLog.create).toHaveBeenCalledWith({
  data: {
    userId: 'user-1',
    module: 'personnel',
    action: 'CREATE',
    resourceId: 'person-1',
    detail: '新增人员 P001 张三',
  },
});
```

Also assert `teamIds: []` clears personnel memberships.

- [ ] **Step 2: Verify red**

Run:

```bash
pnpm --filter @gas-detection/api test -- personnel.service.spec.ts teams.service.spec.ts --runInBand
```

Expected: failures because mutations do not write audit logs or accept the actor ID.

- [ ] **Step 3: Implement transactional mutations and controller actor propagation**

Use `@CurrentUser() user: AuthenticatedUser` and pass `user.id`. For each mutation:

```ts
return this.prisma.$transaction(async (tx) => {
  const item = await tx.personnel.create({ data, include });
  await tx.auditLog.create({ data: { userId, module: 'personnel', action: 'CREATE', resourceId: item.id, detail } });
  return item;
});
```

- [ ] **Step 4: Verify green**

Run the targeted command from Step 2 and expect all tests to pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/personnel apps/api/src/modules/teams
git commit -m "feat: audit personnel and team management"
```

### Task 2: Shared Resource Management UI And Round One Pages

**Files:**
- Create: `apps/admin-web/src/components/resource-management.types.ts`
- Create: `apps/admin-web/src/components/ResourceManagementView.vue`
- Modify: `apps/admin-web/src/views/PersonnelView.vue`
- Modify: `apps/admin-web/src/views/TeamsView.vue`

**Interfaces:**
- `ResourceColumn`: `prop`, `label`, optional sizing and `formatter(row)`.
- `ResourceField`: `prop`, `label`, type, required rules, options, number bounds, and `valueFromRow(row)`.
- Component props: `title`, `endpoint`, `columns`, `fields`, `initialValues`, optional `toForm` and `toPayload`.

- [ ] **Step 1: Build the reusable management component**

Implement keyword query, pagination, loading states, dynamic form controls, Element Plus validation, save feedback and delete confirmation using existing API helpers.

- [ ] **Step 2: Configure personnel and team pages**

Personnel loads `/teams?pageSize=200`, maps `row.teams` to `teamIds`, and renders team names. Teams renders `members.length` and description.

- [ ] **Step 3: Verify round one frontend**

```bash
pnpm --filter @gas-detection/admin-web typecheck
pnpm --filter @gas-detection/admin-web build
```

Expected: both commands exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/admin-web/src/components apps/admin-web/src/views/PersonnelView.vue apps/admin-web/src/views/TeamsView.vue
git commit -m "feat: add personnel and team workbenches"
```

### Task 3: Area And Base Station Transactions

**Files:**
- Create: `apps/api/src/modules/areas/areas.service.spec.ts`
- Create: `apps/api/src/modules/base-stations/base-stations.service.spec.ts`
- Modify: `apps/api/src/modules/areas/areas.service.ts`
- Modify: `apps/api/src/modules/areas/areas.controller.ts`
- Modify: `apps/api/src/modules/base-stations/base-stations.service.ts`
- Modify: `apps/api/src/modules/base-stations/base-stations.controller.ts`

**Interfaces:**
- Mutation signatures add optional `userId`.
- Audit modules are `areas` and `base-stations`.

- [ ] **Step 1: Write failing transaction tests**

Cover create/update/delete audit rows and verify returned area/base-station data comes from the same transaction.

- [ ] **Step 2: Verify red**

```bash
pnpm --filter @gas-detection/api test -- areas.service.spec.ts base-stations.service.spec.ts --runInBand
```

Expected: audit assertions fail.

- [ ] **Step 3: Implement transactions and current-user propagation**

Write details such as `新增区域 A01 一采区` and `更新基站 BS01 一号基站`, preserving `include: { area: true }` for base stations.

- [ ] **Step 4: Verify green and commit**

Run Step 2, then:

```bash
git add apps/api/src/modules/areas apps/api/src/modules/base-stations
git commit -m "feat: audit area and base station management"
```

### Task 4: Area And Base Station Workbenches

**Files:**
- Modify: `apps/admin-web/src/views/AreasView.vue`
- Modify: `apps/admin-web/src/views/BaseStationsView.vue`

**Interfaces:**
- Areas use numeric `riskLevel`, `lng`, `lat` fields.
- Base stations load area options and submit `areaId`, `lng`, `lat`, `depth`.

- [ ] **Step 1: Configure both pages**

Use the shared component. Display risk as `L1` through `L5`; display depth with `m`; use a select for area.

- [ ] **Step 2: Verify frontend and commit**

```bash
pnpm --filter @gas-detection/admin-web typecheck
pnpm --filter @gas-detection/admin-web build
git add apps/admin-web/src/views/AreasView.vue apps/admin-web/src/views/BaseStationsView.vue
git commit -m "feat: add area and base station workbenches"
```

### Task 5: User And Role Service Closure

**Files:**
- Create: `apps/api/src/modules/users/users.service.spec.ts`
- Create: `apps/api/src/modules/roles/roles.service.spec.ts`
- Modify: `apps/api/src/modules/users/users.service.ts`
- Modify: `apps/api/src/modules/users/users.controller.ts`
- Modify: `apps/api/src/modules/roles/roles.service.ts`
- Modify: `apps/api/src/modules/roles/roles.controller.ts`

**Interfaces:**
- `findAll(query: ListQueryDto)` returns `paginated(...)` for users and roles.
- `RolesService.listPermissions()` returns permissions ordered by module then code.
- `GET /roles/permissions` requires `roles:read`.
- User mutations receive actor ID; `remove(id, actorId)` rejects `id === actorId`.
- Role mutations receive actor ID; `remove` rejects the role whose name is `admin`.

- [ ] **Step 1: Write failing user tests**

Cover keyword pagination, transactional create/update/delete audit writes, role replacement, empty edit password omission, and self-delete rejection.

- [ ] **Step 2: Write failing role tests**

Cover keyword pagination, ordered permission lookup, transactional permission replacement and built-in admin deletion rejection.

- [ ] **Step 3: Verify red**

```bash
pnpm --filter @gas-detection/api test -- users.service.spec.ts roles.service.spec.ts --runInBand
```

Expected: failures for pagination, permission lookup, audit writes, and protection rules.

- [ ] **Step 4: Implement minimal service and controller changes**

Build Prisma keyword `OR` filters, reuse `pagination` and `paginated`, keep password hashing at cost 10, and return role/permission relations required by editing forms.

- [ ] **Step 5: Verify green and commit**

Run Step 3, then:

```bash
git add apps/api/src/modules/users apps/api/src/modules/roles
git commit -m "feat: complete user and role management services"
```

### Task 6: User And Role Workbenches

**Files:**
- Modify: `apps/admin-web/src/views/SystemUsersView.vue`
- Modify: `apps/admin-web/src/views/SystemRolesView.vue`
- Modify: `apps/admin-web/src/views/AuditLogsView.vue`
- Delete: `apps/admin-web/src/views/SimpleResourceView.vue`

**Interfaces:**
- Users load role options from `/roles?pageSize=200`.
- Roles load permission options from `/roles/permissions`.
- Edit serialization removes an empty `password` field.

- [ ] **Step 1: Configure user workbench**

Use password, multi-select roles and switch controls. Format role names and enabled state in the table.

- [ ] **Step 2: Configure role workbench**

Use multi-select permissions labelled `module / name`; show permission count.

- [ ] **Step 3: Extend operation-log module labels**

Add `personnel`, `teams`, `areas`, `base-stations`, `users`, and `roles` to filters and display mappings.

- [ ] **Step 4: Remove the unused read-only view, verify and commit**

```bash
pnpm --filter @gas-detection/admin-web typecheck
pnpm --filter @gas-detection/admin-web build
git add apps/admin-web/src
git commit -m "feat: add user and role workbenches"
```

### Task 7: End-To-End Verification

**Files:**
- Verify all changed files; no new committed artifacts.

- [ ] **Step 1: Run full checks**

```bash
pnpm -r typecheck
pnpm -r test
pnpm -r build
git diff --check
```

- [ ] **Step 2: Rebuild Docker Compose**

```bash
./scripts/docker-up.sh
docker compose ps
```

- [ ] **Step 3: Browser verification**

Log in at `http://localhost:8080`, exercise create/edit/search on personnel, areas and users, verify operation logs, console health and responsive layout, then delete only the smoke-test records.

- [ ] **Step 4: Push current branch**

```bash
git push -u origin codex/alarm-closure-workflow
```
