# Data Preview Personal View Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a clickable personal view management prototype for the data preview page, so users can save, switch, rename, delete, and restore their own table viewing configurations.

**Architecture:** Keep the current single-file prototype and add a focused personal-view state layer inside `data-preview-prototype.html`. Update ACP docs before changing the prototype, then validate through browser clicks against the existing local HTML page.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, local file prototype, ACP markdown docs.

---

## File Structure

- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/.ai/data-preview/core/req.md`
  - Add detailed personal view requirements, saved config boundaries, validation rules, and error states.
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/.ai/data-preview/ui-wizard/ui.md`
  - Add UI placement, dropdown behavior, dialogs, empty/error states, and interaction details.
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/.ai/data-preview/test/test-cases.md`
  - Add P0/P1 manual click test cases for view save, switch, rename, delete, dirty state, and restore behavior.
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/.ai/data-preview/prototype/data-preview-prototype.html`
  - Add the clickable view selector, local state model, dropdown menu, dialogs, restore logic, and dirty-state detection.

## Task 1: Update ACP Requirement Docs

**Files:**
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/.ai/data-preview/core/req.md`

- [ ] **Step 1: Add personal view requirement section**

Add a section named `个人视图管理` under the data preview feature requirements:

```markdown
## 个人视图管理

### 目标

- 用户可以为当前数据源、数据库、schema、表保存个人视图。
- 个人视图只保存看表方式，不保存查询结果。
- 切换个人视图后，页面恢复列显隐、列顺序、列宽、筛选条件、排序条件和分页大小。
- 未保存修改必须显示 `*`，切换前需要确认，避免误丢配置。

### 保存范围

保存：

- 字段显隐。
- 字段顺序。
- 列宽。
- WHERE 筛选条件。
- ORDER BY 排序条件。
- 分页大小。

不保存：

- 当前页码。
- 当前查询结果。
- 当前单元格选中状态。
- 导出配置。
- 关联配置。
- 当前数据源、数据库、schema、表。

### 操作规则

- 默认视图始终存在。
- 默认视图不能删除。
- 默认视图不能重命名。
- 普通个人视图可以保存、另存、重命名和删除。
- 同一张表下视图名称不能重复。
- 视图名称不能为空，最长 30 个中文字符。
- 删除普通视图后自动切回默认视图。
- 视图列表加载失败时，页面仍可使用默认视图查数。
```

- [ ] **Step 2: Run doc check**

Run:

```bash
rg -n "个人视图管理|默认视图|另存为新视图|未保存" /Users/luwang/bigdata-build/dolphinscheduler/.ai/data-preview/core/req.md
```

Expected: each keyword appears in the requirement document.

## Task 2: Update UI And Test Docs

**Files:**
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/.ai/data-preview/ui-wizard/ui.md`
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/.ai/data-preview/test/test-cases.md`

- [ ] **Step 1: Add UI behavior to `ui.md`**

Add the following details:

```markdown
## 个人视图管理交互

入口放在表格操作工具条最左侧，位于 `列设置` 前：

```text
视图：默认视图 ▼  列设置  筛选  排序  关联  复制SQL
```

下拉内容：

```text
我的视图
✓ 默认视图
  同步结果排查
  只看有效案件
  最近30天创建
────────
保存当前视图
另存为新视图
重命名当前视图
删除当前视图
```

交互规则：

- 当前视图使用勾选标记。
- 有未保存修改时，入口显示 `视图：默认视图 *`。
- 切换视图时如存在未保存修改，弹确认框。
- 另存和重命名使用小型输入弹窗。
- 删除普通视图前二次确认。
- 默认视图的重命名、删除入口置灰或点击时提示原因。
```

- [ ] **Step 2: Add test cases to `test-cases.md`**

Add these cases:

```markdown
## 个人视图管理

### P0

- 打开页面，工具条左侧显示 `视图：默认视图`。
- 修改列显隐后，视图入口显示 `*`。
- 点击 `保存当前视图` 后，`*` 消失。
- 点击 `另存为新视图`，输入合法名称后保存，新视图出现在下拉列表并自动选中。
- 切换到已有视图后，列显隐、列顺序、筛选、排序、分页大小恢复。
- 未保存状态下切换视图，出现确认弹窗；取消后保持当前视图。
- 删除普通个人视图后自动回到默认视图。

### P1

- 空名称保存被拦截。
- 重名保存被拦截。
- 默认视图不能重命名。
- 默认视图不能删除。
- 视图名称过长时入口和下拉列表省略显示。
```

- [ ] **Step 3: Run doc check**

Run:

```bash
rg -n "个人视图管理|视图：默认视图|保存当前视图|另存为新视图|重命名当前视图|删除当前视图" /Users/luwang/bigdata-build/dolphinscheduler/.ai/data-preview/ui-wizard/ui.md /Users/luwang/bigdata-build/dolphinscheduler/.ai/data-preview/test/test-cases.md
```

Expected: all required interaction labels appear in UI and test docs.

## Task 3: Add View Selector UI To Prototype

**Files:**
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/.ai/data-preview/prototype/data-preview-prototype.html`

- [ ] **Step 1: Insert view selector before existing toolbar buttons**

Find the table toolbar containing:

```html
<button class="btn" id="columnBtn">列设置</button>
<button class="btn" id="addFilterBtn">筛选</button>
<button class="btn" id="addSortBtn">排序</button>
<button class="btn" id="joinBtn">关联</button>
<button class="btn" id="copyWhereBtn">复制SQL</button>
```

Insert this before `columnBtn`:

```html
<div class="view-select-wrap">
  <button class="btn view-select-btn" id="viewSelectBtn" title="管理当前表的个人视图">
    <span id="activeViewLabel">视图：默认视图</span><span class="chev">▾</span>
  </button>
  <div class="view-menu" id="viewMenu"></div>
</div>
```

- [ ] **Step 2: Add compact menu and dialog CSS**

Add CSS near existing toolbar/popover styles:

```css
.view-select-wrap { position: relative; display: inline-flex; }
.view-select-btn { min-width: 148px; justify-content: space-between; }
.view-select-btn .chev { color: var(--muted); margin-left: 8px; }
.view-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  width: 240px;
  background: var(--panel);
  border: 1px solid var(--line);
  box-shadow: 0 10px 28px rgba(15, 23, 42, .14);
  border-radius: 6px;
  padding: 6px;
  z-index: 30;
  display: none;
}
.view-menu.open { display: block; }
.view-menu-title { padding: 6px 8px; font-size: 12px; color: var(--muted); }
.view-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 30px;
  padding: 5px 8px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
}
.view-menu-item:hover { background: #f3f6fb; }
.view-menu-item.disabled { color: var(--muted); cursor: not-allowed; }
.view-menu-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.view-menu-divider { height: 1px; background: var(--line); margin: 6px 0; }
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, .22);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 60;
}
.modal-mask.open { display: flex; }
.view-dialog {
  width: 360px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, .22);
}
.view-dialog-head { padding: 14px 16px; border-bottom: 1px solid var(--line); font-weight: 600; }
.view-dialog-body { padding: 16px; color: var(--text); }
.view-dialog-actions { padding: 12px 16px; border-top: 1px solid var(--line); display: flex; justify-content: flex-end; gap: 8px; }
.view-error { margin-top: 8px; color: #b91c1c; font-size: 12px; min-height: 16px; }
```

- [ ] **Step 3: Add reusable dialog root**

Add before the closing `</body>`:

```html
<div class="modal-mask" id="viewModal"></div>
```

- [ ] **Step 4: Reload file and verify no layout break**

Open:

```text
file:///Users/luwang/bigdata-build/dolphinscheduler/.ai/data-preview/prototype/data-preview-prototype.html
```

Expected: toolbar order is `视图 → 列设置 → 筛选 → 排序 → 关联 → 复制SQL`.

## Task 4: Add Personal View State And Restore Logic

**Files:**
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/.ai/data-preview/prototype/data-preview-prototype.html`

- [ ] **Step 1: Add view state near existing `columns`, `filters`, `sorts` state**

Add:

```js
const tableKey = 'mysql_prod.ds_demo.public.ajxx_tab';
let activeViewId = 'default';
let viewDirty = false;
let views = [
  {
    id: 'default',
    name: '默认视图',
    tableKey,
    isDefault: true,
    config: null
  },
  {
    id: 'sync-check',
    name: '同步结果排查',
    tableKey,
    isDefault: false,
    config: null
  },
  {
    id: 'valid-cases',
    name: '只看有效案件',
    tableKey,
    isDefault: false,
    config: null
  }
];
```

- [ ] **Step 2: Add config snapshot helpers**

Add:

```js
function captureViewConfig() {
  return {
    columns: columns.map((col, order) => ({
      key: col.key,
      visible: col.visible,
      width: col.width,
      order
    })),
    filters: filters.map(item => ({ ...item })),
    sorts: sorts.map((item, order) => ({ ...item, order })),
    pageSize
  };
}

function applyViewConfig(config) {
  if (!config) return;
  const byKey = new Map(columns.map(col => [col.key, col]));
  const ordered = [];
  config.columns.forEach(saved => {
    const col = byKey.get(saved.key);
    if (!col) return;
    col.visible = saved.visible;
    if (saved.width) col.width = saved.width;
    ordered.push(col);
    byKey.delete(saved.key);
  });
  columns = [...ordered, ...Array.from(byKey.values())];
  filters = config.filters.map(item => ({ ...item }));
  sorts = config.sorts.map(({ order, ...item }) => ({ ...item }));
  pageSize = config.pageSize || pageSize;
  renderAll();
}

function markViewDirty() {
  viewDirty = true;
  renderViewLabel();
}

function clearViewDirty() {
  viewDirty = false;
  renderViewLabel();
}
```

If `columns`, `filters`, `sorts`, or `pageSize` are currently declared as `const`, convert the ones restored by views to `let`.

- [ ] **Step 3: Seed sample saved configs after initial state exists**

Add:

```js
function seedViewConfigs() {
  views = views.map(view => {
    if (view.config) return view;
    if (view.id === 'default') return { ...view, config: captureViewConfig() };
    if (view.id === 'sync-check') {
      return {
        ...view,
        config: {
          ...captureViewConfig(),
          filters: [{ field: 'status', op: '=', value: '有效' }],
          sorts: [{ field: 'create_time', dir: 'DESC', order: 0 }],
          pageSize: 50
        }
      };
    }
    if (view.id === 'valid-cases') {
      const config = captureViewConfig();
      config.columns = config.columns.map(col => col.key === 'remark' ? { ...col, visible: false } : col);
      config.filters = [{ field: 'status', op: '=', value: '有效' }];
      return { ...view, config };
    }
    return view;
  });
}
```

- [ ] **Step 4: Ensure all existing state mutations call `markViewDirty()`**

Add `markViewDirty()` after these user actions:

```js
// column visibility/order/width changes
markViewDirty();

// filter add/edit/delete/clear/apply
markViewDirty();

// sort add/edit/delete/clear/apply
markViewDirty();

// page size change
markViewDirty();
```

Do not call `markViewDirty()` for joins, copy SQL, data source switching, database switching, table switching, or export.

## Task 5: Add View Menu Actions

**Files:**
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/.ai/data-preview/prototype/data-preview-prototype.html`

- [ ] **Step 1: Add menu rendering**

Add:

```js
function activeView() {
  return views.find(view => view.id === activeViewId) || views[0];
}

function renderViewLabel() {
  const view = activeView();
  $('activeViewLabel').textContent = `视图：${view.name}${viewDirty ? ' *' : ''}`;
}

function renderViewMenu() {
  const menu = $('viewMenu');
  menu.innerHTML = `
    <div class="view-menu-title">我的视图</div>
    ${views.map(view => `
      <div class="view-menu-item" data-view-id="${view.id}">
        <span>${view.id === activeViewId ? '✓' : ''}</span>
        <span class="view-menu-name" title="${view.name}">${view.name}</span>
      </div>
    `).join('')}
    <div class="view-menu-divider"></div>
    <div class="view-menu-item" data-view-action="save"><span></span><span class="view-menu-name">保存当前视图</span></div>
    <div class="view-menu-item" data-view-action="saveAs"><span></span><span class="view-menu-name">另存为新视图</span></div>
    <div class="view-menu-item ${activeView().isDefault ? 'disabled' : ''}" data-view-action="rename"><span></span><span class="view-menu-name">重命名当前视图</span></div>
    <div class="view-menu-item ${activeView().isDefault ? 'disabled' : ''}" data-view-action="delete"><span></span><span class="view-menu-name">删除当前视图</span></div>
  `;
}
```

- [ ] **Step 2: Add switch confirmation**

Add:

```js
function confirmDiscardChanges(targetView) {
  openViewConfirm(
    '当前视图有未保存修改',
    `切换到“${targetView.name}”会放弃当前修改。`,
    '放弃修改并切换',
    () => switchView(targetView.id, true)
  );
}

function switchView(viewId, force = false) {
  const target = views.find(view => view.id === viewId);
  if (!target || target.id === activeViewId) return;
  if (viewDirty && !force) {
    confirmDiscardChanges(target);
    return;
  }
  activeViewId = target.id;
  applyViewConfig(target.config);
  clearViewDirty();
  toast(`已切换到视图：${target.name}`);
}
```

- [ ] **Step 3: Add save, save-as, rename, delete actions**

Add:

```js
function saveCurrentView() {
  const current = activeView();
  current.config = captureViewConfig();
  clearViewDirty();
  toast(`已保存视图：${current.name}`);
}

function saveAsView(name) {
  const trimmed = name.trim();
  const error = validateViewName(trimmed);
  if (error) return error;
  const view = {
    id: `view-${Date.now()}`,
    name: trimmed,
    tableKey,
    isDefault: false,
    config: captureViewConfig()
  };
  views.push(view);
  activeViewId = view.id;
  clearViewDirty();
  renderViewMenu();
  toast(`已另存为视图：${view.name}`);
  return '';
}

function renameCurrentView(name) {
  const current = activeView();
  if (current.isDefault) return '默认视图不能重命名';
  const trimmed = name.trim();
  const error = validateViewName(trimmed, current.id);
  if (error) return error;
  current.name = trimmed;
  renderViewLabel();
  renderViewMenu();
  toast(`已重命名为：${current.name}`);
  return '';
}

function deleteCurrentView() {
  const current = activeView();
  if (current.isDefault) {
    toast('默认视图不能删除');
    return;
  }
  const name = current.name;
  views = views.filter(view => view.id !== current.id);
  activeViewId = 'default';
  applyViewConfig(activeView().config);
  clearViewDirty();
  renderViewMenu();
  toast(`已删除视图：${name}`);
}
```

- [ ] **Step 4: Add validation helper**

Add:

```js
function validateViewName(name, currentId = null) {
  if (!name) return '视图名称不能为空';
  if ([...name].length > 30) return '视图名称不能超过 30 个中文字符';
  const duplicated = views.some(view => view.id !== currentId && view.name === name);
  if (duplicated) return '同一张表下已存在同名视图';
  return '';
}
```

## Task 6: Add Dialogs And Event Wiring

**Files:**
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/.ai/data-preview/prototype/data-preview-prototype.html`

- [ ] **Step 1: Add modal helpers**

Add:

```js
function closeViewModal() {
  $('viewModal').classList.remove('open');
  $('viewModal').innerHTML = '';
}

function openViewConfirm(title, message, okText, onOk) {
  $('viewModal').innerHTML = `
    <div class="view-dialog">
      <div class="view-dialog-head">${title}</div>
      <div class="view-dialog-body">${message}</div>
      <div class="view-dialog-actions">
        <button class="btn" id="viewCancelBtn">取消</button>
        <button class="btn primary" id="viewOkBtn">${okText}</button>
      </div>
    </div>
  `;
  $('viewModal').classList.add('open');
  $('viewCancelBtn').onclick = closeViewModal;
  $('viewOkBtn').onclick = () => { closeViewModal(); onOk(); };
}

function openViewNameDialog(title, initialValue, okText, onSubmit) {
  $('viewModal').innerHTML = `
    <div class="view-dialog">
      <div class="view-dialog-head">${title}</div>
      <div class="view-dialog-body">
        <div class="form-field">
          <label>视图名称</label>
          <input class="form-input" id="viewNameInput" value="${initialValue || ''}" maxlength="30" />
          <div class="view-error" id="viewNameError"></div>
        </div>
      </div>
      <div class="view-dialog-actions">
        <button class="btn" id="viewCancelBtn">取消</button>
        <button class="btn primary" id="viewOkBtn">${okText}</button>
      </div>
    </div>
  `;
  $('viewModal').classList.add('open');
  $('viewCancelBtn').onclick = closeViewModal;
  $('viewOkBtn').onclick = () => {
    const error = onSubmit($('viewNameInput').value);
    if (error) {
      $('viewNameError').textContent = error;
      return;
    }
    closeViewModal();
  };
  $('viewNameInput').focus();
}
```

- [ ] **Step 2: Wire view selector events in the main binding area**

Add:

```js
$('viewSelectBtn').onclick = () => {
  renderViewMenu();
  $('viewMenu').classList.toggle('open');
};

$('viewMenu').onclick = (event) => {
  const viewItem = event.target.closest('[data-view-id]');
  const actionItem = event.target.closest('[data-view-action]');
  if (viewItem) {
    $('viewMenu').classList.remove('open');
    switchView(viewItem.dataset.viewId);
    return;
  }
  if (!actionItem || actionItem.classList.contains('disabled')) {
    if (actionItem && actionItem.dataset.viewAction === 'rename') toast('默认视图不能重命名');
    if (actionItem && actionItem.dataset.viewAction === 'delete') toast('默认视图不能删除');
    return;
  }
  $('viewMenu').classList.remove('open');
  const action = actionItem.dataset.viewAction;
  if (action === 'save') saveCurrentView();
  if (action === 'saveAs') openViewNameDialog('另存为新视图', '', '保存', saveAsView);
  if (action === 'rename') openViewNameDialog('重命名当前视图', activeView().name, '保存', renameCurrentView);
  if (action === 'delete') {
    openViewConfirm('删除当前视图', `确认删除“${activeView().name}”？删除后会切回默认视图。`, '删除', deleteCurrentView);
  }
};

document.addEventListener('click', event => {
  if (!event.target.closest('.view-select-wrap')) {
    $('viewMenu').classList.remove('open');
  }
});
```

- [ ] **Step 3: Initialize views during page load**

Add after initial render setup:

```js
seedViewConfigs();
renderViewLabel();
renderViewMenu();
```

Expected: page starts with `视图：默认视图` and the menu opens with sample views.

## Task 7: Manual Browser Verification

**Files:**
- Verify: `/Users/luwang/bigdata-build/dolphinscheduler/.ai/data-preview/prototype/data-preview-prototype.html`

- [ ] **Step 1: Open prototype**

Open:

```text
file:///Users/luwang/bigdata-build/dolphinscheduler/.ai/data-preview/prototype/data-preview-prototype.html
```

Expected: page loads without console-blocking errors and toolbar order is correct.

- [ ] **Step 2: Test save current view**

Click:

```text
列设置 -> hide one field -> 应用 -> 视图：默认视图 * -> 保存当前视图
```

Expected:

```text
视图：默认视图
```

The star disappears.

- [ ] **Step 3: Test save as**

Click:

```text
视图：默认视图 -> 另存为新视图 -> input 最近30天有效案件 -> 保存
```

Expected:

```text
视图：最近30天有效案件
```

The new view appears checked in the dropdown.

- [ ] **Step 4: Test dirty switch confirmation**

Click:

```text
筛选 -> 新增筛选 -> status = 有效 -> 应用筛选 -> 视图菜单 -> 默认视图
```

Expected: confirmation dialog appears. Clicking `取消` keeps current view. Clicking `放弃修改并切换` switches view.

- [ ] **Step 5: Test rename and delete**

Click:

```text
视图菜单 -> 重命名当前视图 -> input 我的排查视图 -> 保存
视图菜单 -> 删除当前视图 -> 删除
```

Expected: renamed view label updates; deleting switches back to `默认视图`.

- [ ] **Step 6: Test validation**

Click:

```text
视图菜单 -> 另存为新视图 -> empty name -> 保存
视图菜单 -> 另存为新视图 -> 默认视图 -> 保存
```

Expected:

```text
视图名称不能为空
同一张表下已存在同名视图
```

## Task 8: Sync Prototype Repo And Push If Needed

**Files:**
- Source: `/Users/luwang/bigdata-build/dolphinscheduler/.ai/data-preview`
- Target repo: `/Users/luwang/bigdata-build/data-preview-design-repo`

- [ ] **Step 1: Copy updated design files to the GitHub design repo**

Run:

```bash
rsync -a /Users/luwang/bigdata-build/dolphinscheduler/.ai/ /Users/luwang/bigdata-build/data-preview-design-repo/.ai/
rsync -a /Users/luwang/bigdata-build/dolphinscheduler/docs/superpowers/ /Users/luwang/bigdata-build/data-preview-design-repo/docs/superpowers/
```

- [ ] **Step 2: Review diff**

Run:

```bash
git -C /Users/luwang/bigdata-build/data-preview-design-repo status --short
git -C /Users/luwang/bigdata-build/data-preview-design-repo diff -- .ai/data-preview docs/superpowers
```

Expected: only data preview docs, prototype, spec, and plan files changed.

- [ ] **Step 3: Commit and push**

Run:

```bash
git -C /Users/luwang/bigdata-build/data-preview-design-repo add .ai/data-preview docs/superpowers
git -C /Users/luwang/bigdata-build/data-preview-design-repo commit -m "Add personal view management prototype"
git -C /Users/luwang/bigdata-build/data-preview-design-repo push
```

Expected: push succeeds to `git@github.com:luwang951753/dolphinscheduler-data-preview-design.git`.

## Self-Review

- Spec coverage: the plan covers docs, UI placement, saved config scope, dirty state, switch confirmation, save, save-as, rename, delete, validation, restore behavior, manual browser testing, and GitHub sync.
- Placeholder scan: no placeholder markers or unspecified implementation steps remain.
- Type consistency: the plan uses `views`, `activeViewId`, `viewDirty`, `captureViewConfig`, `applyViewConfig`, `markViewDirty`, and `clearViewDirty` consistently across tasks.
- Scope check: this plan is focused on personal view management for the existing data preview prototype and does not include shared views, permissions, backend APIs, or production Vue implementation.
