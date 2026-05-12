# Data Preview Real Route And Query Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first real DolphinScheduler data preview slice: a `/data-preview` page that loads real datasources, databases, tables, column metadata, and a safe read-only first page of table data.

**Architecture:** Reuse the existing datasource metadata APIs for source/database/table/column discovery, and add one backend read-only preview query API under `DataSourceController`. The frontend implements a professional Data Editor style page in Vue 3 TSX + Naive UI, but only ships the minimum real-data loop for this slice: object selection, grid rendering, basic filter/sort, pagination size, and refresh.

**Tech Stack:** Java Spring MVC service/controller, JDBC metadata + prepared statement query construction, Vue 3, TSX, Naive UI, existing DolphinScheduler router/menu/service conventions.

---

## Scope

This first implementation slice includes:

- Route and menu entry for `/data-preview`.
- Datasource selector using existing datasource list API.
- Database selector using existing `/datasources/databases`.
- Left object tree using existing `/datasources/tables`.
- Column metadata using existing `/datasources/tableColumnMetas`.
- Read-only table data preview using a new `/datasources/preview-data` API.
- Frontend WHERE and ORDER BY state that sends structured filters/sorts, not raw SQL.
- Manual browser verification against the running DolphinScheduler UI.

This slice does not include:

- Personal view persistence.
- Multi-table joins.
- Export.
- Editable SQL console.
- Shared views.
- Backend query history.
- Full production table virtualization.

## File Structure

- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/.ai/data-preview/core/req.md`
  - Mark the first real development slice as route + readonly query.
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/.ai/data-preview/ui-wizard/ui.md`
  - Add first-slice implementation notes and downgrade unavailable controls to disabled placeholders.
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/.ai/data-preview/test/test-cases.md`
  - Add real DolphinScheduler route/query verification cases.
- Create: `/Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-api/src/main/java/org/apache/dolphinscheduler/api/dto/DataPreviewQueryRequest.java`
  - Request DTO for structured readonly preview query.
- Create: `/Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-api/src/main/java/org/apache/dolphinscheduler/api/dto/DataPreviewQueryResult.java`
  - Response DTO for columns, rows, page metadata, elapsed time, and warnings.
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-api/src/main/java/org/apache/dolphinscheduler/api/enums/Status.java`
  - Add a data preview query error status.
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-api/src/main/java/org/apache/dolphinscheduler/api/service/DataSourceService.java`
  - Add `previewData(User loginUser, DataPreviewQueryRequest request)`.
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-api/src/main/java/org/apache/dolphinscheduler/api/service/impl/DataSourceServiceImpl.java`
  - Implement safe table identifier validation, prepared filter values, sort whitelist validation, page size limit, and result mapping.
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-api/src/main/java/org/apache/dolphinscheduler/api/controller/DataSourceController.java`
  - Add `POST /datasources/preview-data`.
- Create: `/Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-service/src/test/java/org/apache/dolphinscheduler/service/datasource/DataSourcePreviewQueryBuilderTest.java`
  - Unit-level tests for request validation and SQL fragment building helpers if helpers are package-visible/static.
- Create: `/Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-ui/src/router/modules/data-preview.ts`
  - Route module for `/data-preview`.
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-ui/src/router/routes.ts`
  - Register the data preview route module.
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-ui/src/layouts/content/use-dataList.ts`
  - Add the top-level menu entry.
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-ui/src/locales/zh_CN/menu.ts`
  - Add `data_preview: '数据预览'`.
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-ui/src/locales/en_US/menu.ts`
  - Add `data_preview: 'Data Preview'`.
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-ui/src/service/modules/data-source/index.ts`
  - Add `previewDatasourceTableData`.
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-ui/src/service/modules/data-source/types.ts`
  - Add preview request/response TypeScript interfaces.
- Create: `/Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-ui/src/views/data-preview/index.tsx`
  - Real data preview page.
- Create: `/Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-ui/src/views/data-preview/index.module.scss`
  - Dense professional Data Editor layout styles.

## Task 1: Update ACP Docs For The Real Implementation Slice

**Files:**
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/.ai/data-preview/core/req.md`
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/.ai/data-preview/ui-wizard/ui.md`
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/.ai/data-preview/test/test-cases.md`

- [ ] **Step 1: Add first-slice requirement note to `req.md`**

Add this section after the overview requirements:

```markdown
## 首期真实二开范围

首期真实二开只交付数据预览的最小可用闭环：

- 接入 DolphinScheduler 真实路由 `/data-preview`。
- 复用源中心已有数据源权限与数据源列表。
- 支持选择数据源、数据库和表。
- 支持读取真实字段元数据。
- 支持只读查询第一页数据。
- 支持基础筛选和排序。
- 查询请求必须使用结构化参数，不允许前端传入任意 SQL。
- 后端必须限制 pageSize，默认 50，最大 200。
- 后端必须校验表名、字段名和排序字段来自元数据白名单。

本期不交付个人视图持久化、关联、导出、共享视图、任意 SQL 编辑器。
```

- [ ] **Step 2: Add implementation note to `ui.md`**

Add this section near the prototype/page requirements:

```markdown
## 首期真实页面降级规则

首期真实页面应保持专业 Data Editor 布局，但未接入的能力必须降级展示：

- `列设置` 可先只控制当前前端列显隐，不保存。
- `筛选` 和表头筛选必须真实请求后端。
- `排序` 和表头排序必须真实请求后端。
- `关联`、`复制 SQL`、`保存视图` 可先禁用或显示“后续版本支持”。
- 页面空态必须提示先选择数据源、数据库和表。
```

- [ ] **Step 3: Add real route/query test cases to `test-cases.md`**

Add:

```markdown
## 真实二开首期用例

### TC-REAL-P0-001 路由可访问

访问 `/data-preview`，页面进入数据预览工作台，不影响同步任务、源中心等原有菜单。

### TC-REAL-P0-002 数据源数据库表级联

选择数据源后加载数据库；选择数据库后加载表；选择表后加载字段。

### TC-REAL-P0-003 查询第一页数据

选择一张有数据的表，点击查询，表格展示字段表头和最多 50 行数据。

### TC-REAL-P0-004 筛选查询

通过表头筛选生成结构化筛选条件，重新查询后 WHERE 条和数据网格同步更新。

### TC-REAL-P0-005 排序查询

点击表头排序后 ORDER BY 条更新，重新查询后排序参数发送给后端。

### TC-REAL-P1-001 查询安全限制

前端不能提交任意 SQL；后端拒绝未知字段、非法表名、超过 200 的 pageSize。
```

- [ ] **Step 4: Verify docs**

Run:

```bash
rg -n "首期真实二开范围|首期真实页面降级规则|真实二开首期用例|TC-REAL-P0" /Users/luwang/bigdata-build/dolphinscheduler/.ai/data-preview
```

Expected: all new sections appear.

## Task 2: Add Backend DTOs And Service Contract

**Files:**
- Create: `/Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-api/src/main/java/org/apache/dolphinscheduler/api/dto/DataPreviewQueryRequest.java`
- Create: `/Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-api/src/main/java/org/apache/dolphinscheduler/api/dto/DataPreviewQueryResult.java`
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-api/src/main/java/org/apache/dolphinscheduler/api/service/DataSourceService.java`
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-api/src/main/java/org/apache/dolphinscheduler/api/enums/Status.java`

- [ ] **Step 1: Create request DTO**

Create `DataPreviewQueryRequest.java`:

```java
package org.apache.dolphinscheduler.api.dto;

import java.util.List;

public class DataPreviewQueryRequest {

    private Integer datasourceId;
    private String database;
    private String schema;
    private String tableName;
    private List<Filter> filters;
    private List<Sort> sorts;
    private Integer pageNo;
    private Integer pageSize;

    public static class Filter {
        private String field;
        private String operator;
        private String value;

        public String getField() {
            return field;
        }

        public void setField(String field) {
            this.field = field;
        }

        public String getOperator() {
            return operator;
        }

        public void setOperator(String operator) {
            this.operator = operator;
        }

        public String getValue() {
            return value;
        }

        public void setValue(String value) {
            this.value = value;
        }
    }

    public static class Sort {
        private String field;
        private String direction;

        public String getField() {
            return field;
        }

        public void setField(String field) {
            this.field = field;
        }

        public String getDirection() {
            return direction;
        }

        public void setDirection(String direction) {
            this.direction = direction;
        }
    }

    public Integer getDatasourceId() {
        return datasourceId;
    }

    public void setDatasourceId(Integer datasourceId) {
        this.datasourceId = datasourceId;
    }

    public String getDatabase() {
        return database;
    }

    public void setDatabase(String database) {
        this.database = database;
    }

    public String getSchema() {
        return schema;
    }

    public void setSchema(String schema) {
        this.schema = schema;
    }

    public String getTableName() {
        return tableName;
    }

    public void setTableName(String tableName) {
        this.tableName = tableName;
    }

    public List<Filter> getFilters() {
        return filters;
    }

    public void setFilters(List<Filter> filters) {
        this.filters = filters;
    }

    public List<Sort> getSorts() {
        return sorts;
    }

    public void setSorts(List<Sort> sorts) {
        this.sorts = sorts;
    }

    public Integer getPageNo() {
        return pageNo;
    }

    public void setPageNo(Integer pageNo) {
        this.pageNo = pageNo;
    }

    public Integer getPageSize() {
        return pageSize;
    }

    public void setPageSize(Integer pageSize) {
        this.pageSize = pageSize;
    }
}
```

- [ ] **Step 2: Create result DTO**

Create `DataPreviewQueryResult.java`:

```java
package org.apache.dolphinscheduler.api.dto;

import java.util.List;
import java.util.Map;

public class DataPreviewQueryResult {

    private List<DatasourceColumnDto> columns;
    private List<Map<String, Object>> rows;
    private Integer pageNo;
    private Integer pageSize;
    private Integer rowCount;
    private Long elapsedMs;
    private String executedAt;
    private List<String> warnings;

    public List<DatasourceColumnDto> getColumns() {
        return columns;
    }

    public void setColumns(List<DatasourceColumnDto> columns) {
        this.columns = columns;
    }

    public List<Map<String, Object>> getRows() {
        return rows;
    }

    public void setRows(List<Map<String, Object>> rows) {
        this.rows = rows;
    }

    public Integer getPageNo() {
        return pageNo;
    }

    public void setPageNo(Integer pageNo) {
        this.pageNo = pageNo;
    }

    public Integer getPageSize() {
        return pageSize;
    }

    public void setPageSize(Integer pageSize) {
        this.pageSize = pageSize;
    }

    public Integer getRowCount() {
        return rowCount;
    }

    public void setRowCount(Integer rowCount) {
        this.rowCount = rowCount;
    }

    public Long getElapsedMs() {
        return elapsedMs;
    }

    public void setElapsedMs(Long elapsedMs) {
        this.elapsedMs = elapsedMs;
    }

    public String getExecutedAt() {
        return executedAt;
    }

    public void setExecutedAt(String executedAt) {
        this.executedAt = executedAt;
    }

    public List<String> getWarnings() {
        return warnings;
    }

    public void setWarnings(List<String> warnings) {
        this.warnings = warnings;
    }
}
```

- [ ] **Step 3: Add service method**

In `DataSourceService.java`, add imports:

```java
import org.apache.dolphinscheduler.api.dto.DataPreviewQueryRequest;
import org.apache.dolphinscheduler.api.dto.DataPreviewQueryResult;
```

Add method:

```java
DataPreviewQueryResult previewData(User loginUser, DataPreviewQueryRequest request);
```

- [ ] **Step 4: Add status**

In `Status.java`, add near datasource table errors:

```java
DATA_PREVIEW_QUERY_ERROR(1200036, "data preview query error", "数据预览查询错误"),
```

- [ ] **Step 5: Compile API DTO contract**

Run:

```bash
./mvnw -pl dolphinscheduler-api -DskipTests compile
```

Expected: compile reaches either success or unrelated pre-existing dependency failure. DTO import errors must not appear.

## Task 3: Implement Safe Readonly Backend Preview Query

**Files:**
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-api/src/main/java/org/apache/dolphinscheduler/api/service/impl/DataSourceServiceImpl.java`
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-api/src/main/java/org/apache/dolphinscheduler/api/controller/DataSourceController.java`

- [ ] **Step 1: Add imports to `DataSourceServiceImpl.java`**

Add:

```java
import org.apache.dolphinscheduler.api.dto.DataPreviewQueryRequest;
import org.apache.dolphinscheduler.api.dto.DataPreviewQueryResult;

import java.sql.ResultSetMetaData;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
```

- [ ] **Step 2: Add constants**

Near existing static constants:

```java
private static final int DATA_PREVIEW_DEFAULT_PAGE_SIZE = 50;
private static final int DATA_PREVIEW_MAX_PAGE_SIZE = 200;
private static final int DATA_PREVIEW_MAX_FILTERS = 10;
private static final int DATA_PREVIEW_MAX_SORTS = 5;
private static final DateTimeFormatter DATA_PREVIEW_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
```

- [ ] **Step 3: Implement `previewData`**

Add this method:

```java
@Override
public DataPreviewQueryResult previewData(User loginUser, DataPreviewQueryRequest request) {
    long start = System.currentTimeMillis();
    validatePreviewRequest(request);
    int pageNo = request.getPageNo() == null || request.getPageNo() < 1 ? 1 : request.getPageNo();
    int pageSize = request.getPageSize() == null ? DATA_PREVIEW_DEFAULT_PAGE_SIZE : request.getPageSize();
    if (pageSize < 1 || pageSize > DATA_PREVIEW_MAX_PAGE_SIZE) {
        throw new ServiceException(Status.DATA_PREVIEW_QUERY_ERROR);
    }

    DataSource dataSource = dataSourceMapper.selectById(request.getDatasourceId());
    if (dataSource == null) {
        throw new ServiceException(Status.RESOURCE_NOT_EXIST);
    }
    if (!canOperatorPermissions(loginUser, new Object[]{dataSource.getId()}, AuthorizationType.DATASOURCE,
            ApiFuncIdentificationConstant.DATASOURCE)) {
        throw new ServiceException(Status.USER_NO_OPERATION_PERM);
    }

    List<DatasourceColumnDto> columns = getTableColumnMetas(
            request.getDatasourceId(), request.getDatabase(), request.getTableName());
    Set<String> allowedColumns = columns.stream().map(DatasourceColumnDto::getName).collect(Collectors.toCollection(LinkedHashSet::new));
    if (allowedColumns.isEmpty()) {
        throw new ServiceException(Status.DATA_PREVIEW_QUERY_ERROR);
    }

    BaseConnectionParam connectionParam =
            (BaseConnectionParam) DataSourceUtils.buildConnectionParams(
                    dataSource.getType(),
                    dataSource.getConnectionParams());
    if (connectionParam == null) {
        throw new ServiceException(Status.DATASOURCE_CONNECT_FAILED);
    }

    String sql = buildPreviewSql(dataSource.getType(), request, allowedColumns, pageNo, pageSize);
    List<Object> parameters = buildPreviewParameters(request, allowedColumns);
    List<Map<String, Object>> rows = new ArrayList<>();

    Connection connection = DataSourceUtils.getConnection(dataSource.getType(), connectionParam);
    try (PreparedStatement statement = connection.prepareStatement(sql)) {
        for (int i = 0; i < parameters.size(); i++) {
            statement.setObject(i + 1, parameters.get(i));
        }
        try (ResultSet resultSet = statement.executeQuery()) {
            ResultSetMetaData metaData = resultSet.getMetaData();
            int columnCount = metaData.getColumnCount();
            while (resultSet.next()) {
                Map<String, Object> row = new LinkedHashMap<>();
                for (int i = 1; i <= columnCount; i++) {
                    row.put(metaData.getColumnLabel(i), resultSet.getObject(i));
                }
                rows.add(row);
            }
        }
    } catch (Exception ex) {
        log.error("Preview datasource table data error, datasourceId:{} table:{}.", request.getDatasourceId(), request.getTableName(), ex);
        throw new ServiceException(Status.DATA_PREVIEW_QUERY_ERROR);
    } finally {
        releaseConnection(connection);
    }

    DataPreviewQueryResult result = new DataPreviewQueryResult();
    result.setColumns(columns);
    result.setRows(rows);
    result.setPageNo(pageNo);
    result.setPageSize(pageSize);
    result.setRowCount(rows.size());
    result.setElapsedMs(System.currentTimeMillis() - start);
    result.setExecutedAt(LocalDateTime.now().format(DATA_PREVIEW_TIME_FORMATTER));
    result.setWarnings(Collections.emptyList());
    return result;
}
```

- [ ] **Step 4: Add validation and SQL helpers**

Add these helpers near existing datasource metadata helpers:

```java
private void validatePreviewRequest(DataPreviewQueryRequest request) {
    if (request == null || request.getDatasourceId() == null || StringUtils.isBlank(request.getDatabase())
            || StringUtils.isBlank(request.getTableName())) {
        throw new ServiceException(Status.REQUEST_PARAMS_NOT_VALID_ERROR);
    }
    validateIdentifier(request.getDatabase());
    validateIdentifier(request.getTableName());
    if (StringUtils.isNotBlank(request.getSchema())) {
        validateIdentifier(request.getSchema());
    }
    if (request.getFilters() != null && request.getFilters().size() > DATA_PREVIEW_MAX_FILTERS) {
        throw new ServiceException(Status.DATA_PREVIEW_QUERY_ERROR);
    }
    if (request.getSorts() != null && request.getSorts().size() > DATA_PREVIEW_MAX_SORTS) {
        throw new ServiceException(Status.DATA_PREVIEW_QUERY_ERROR);
    }
}

private void validateIdentifier(String identifier) {
    if (!identifier.matches("[A-Za-z0-9_.$-]+")) {
        throw new ServiceException(Status.DATA_PREVIEW_QUERY_ERROR);
    }
}

private String quoteIdentifier(DbType dbType, String identifier) {
    validateIdentifier(identifier);
    if (dbType == DbType.MYSQL) {
        return "`" + identifier.replace("`", "``") + "`";
    }
    return "\"" + identifier.replace("\"", "\"\"") + "\"";
}

private String buildPreviewTableName(DbType dbType, DataPreviewQueryRequest request) {
    if (StringUtils.isNotBlank(request.getSchema())) {
        return quoteIdentifier(dbType, request.getSchema()) + "." + quoteIdentifier(dbType, request.getTableName());
    }
    return quoteIdentifier(dbType, request.getTableName());
}

private String buildPreviewSql(DbType dbType, DataPreviewQueryRequest request, Set<String> allowedColumns, int pageNo, int pageSize) {
    StringBuilder sql = new StringBuilder();
    sql.append("SELECT ");
    sql.append(allowedColumns.stream().map(column -> quoteIdentifier(dbType, column)).collect(Collectors.joining(", ")));
    sql.append(" FROM ").append(buildPreviewTableName(dbType, request));
    appendPreviewWhere(sql, request, allowedColumns, dbType);
    appendPreviewOrderBy(sql, request, allowedColumns, dbType);
    sql.append(" LIMIT ").append(pageSize).append(" OFFSET ").append((pageNo - 1) * pageSize);
    return sql.toString();
}

private void appendPreviewWhere(StringBuilder sql, DataPreviewQueryRequest request, Set<String> allowedColumns, DbType dbType) {
    if (CollectionUtils.isEmpty(request.getFilters())) {
        return;
    }
    List<String> conditions = new ArrayList<>();
    for (DataPreviewQueryRequest.Filter filter : request.getFilters()) {
        if (filter == null || !allowedColumns.contains(filter.getField())) {
            throw new ServiceException(Status.DATA_PREVIEW_QUERY_ERROR);
        }
        String operator = StringUtils.upperCase(StringUtils.trimToEmpty(filter.getOperator()), Locale.ROOT);
        if ("=".equals(operator) || "!=".equals(operator) || ">".equals(operator) || ">=".equals(operator)
                || "<".equals(operator) || "<=".equals(operator)) {
            conditions.add(quoteIdentifier(dbType, filter.getField()) + " " + operator + " ?");
        } else if ("CONTAINS".equals(operator)) {
            conditions.add(quoteIdentifier(dbType, filter.getField()) + " LIKE ?");
        } else {
            throw new ServiceException(Status.DATA_PREVIEW_QUERY_ERROR);
        }
    }
    if (!conditions.isEmpty()) {
        sql.append(" WHERE ").append(String.join(" AND ", conditions));
    }
}

private void appendPreviewOrderBy(StringBuilder sql, DataPreviewQueryRequest request, Set<String> allowedColumns, DbType dbType) {
    if (CollectionUtils.isEmpty(request.getSorts())) {
        return;
    }
    List<String> orders = new ArrayList<>();
    for (DataPreviewQueryRequest.Sort sort : request.getSorts()) {
        if (sort == null || !allowedColumns.contains(sort.getField())) {
            throw new ServiceException(Status.DATA_PREVIEW_QUERY_ERROR);
        }
        String direction = StringUtils.upperCase(StringUtils.trimToEmpty(sort.getDirection()), Locale.ROOT);
        if (!"ASC".equals(direction) && !"DESC".equals(direction)) {
            throw new ServiceException(Status.DATA_PREVIEW_QUERY_ERROR);
        }
        orders.add(quoteIdentifier(dbType, sort.getField()) + " " + direction);
    }
    if (!orders.isEmpty()) {
        sql.append(" ORDER BY ").append(String.join(", ", orders));
    }
}

private List<Object> buildPreviewParameters(DataPreviewQueryRequest request, Set<String> allowedColumns) {
    if (CollectionUtils.isEmpty(request.getFilters())) {
        return Collections.emptyList();
    }
    List<Object> parameters = new ArrayList<>();
    for (DataPreviewQueryRequest.Filter filter : request.getFilters()) {
        if (filter == null || !allowedColumns.contains(filter.getField())) {
            throw new ServiceException(Status.DATA_PREVIEW_QUERY_ERROR);
        }
        String operator = StringUtils.upperCase(StringUtils.trimToEmpty(filter.getOperator()), Locale.ROOT);
        if ("CONTAINS".equals(operator)) {
            parameters.add("%" + StringUtils.defaultString(filter.getValue()) + "%");
        } else {
            parameters.add(filter.getValue());
        }
    }
    return parameters;
}
```

- [ ] **Step 5: Add controller endpoint**

In `DataSourceController.java`, add imports:

```java
import static org.apache.dolphinscheduler.api.enums.Status.DATA_PREVIEW_QUERY_ERROR;
import org.apache.dolphinscheduler.api.dto.DataPreviewQueryRequest;
import org.apache.dolphinscheduler.api.dto.DataPreviewQueryResult;
```

Add endpoint before the final `getDatabases` method:

```java
@Operation(summary = "previewData", description = "DATA_PREVIEW_QUERY_NOTES")
@PostMapping(value = "/preview-data")
@ResponseStatus(HttpStatus.OK)
@ApiException(DATA_PREVIEW_QUERY_ERROR)
public Result<DataPreviewQueryResult> previewData(@Parameter(hidden = true) @RequestAttribute(value = Constants.SESSION_USER) User loginUser,
                                                  @RequestBody DataPreviewQueryRequest request) {
    DataPreviewQueryResult result = dataSourceService.previewData(loginUser, request);
    return Result.success(result);
}
```

- [ ] **Step 6: Compile backend**

Run:

```bash
./mvnw -pl dolphinscheduler-api -DskipTests compile
```

Expected: no compile errors in `DataPreviewQueryRequest`, `DataPreviewQueryResult`, `DataSourceController`, `DataSourceService`, or `DataSourceServiceImpl`.

## Task 4: Add Frontend Service And Route/Menu

**Files:**
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-ui/src/service/modules/data-source/types.ts`
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-ui/src/service/modules/data-source/index.ts`
- Create: `/Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-ui/src/router/modules/data-preview.ts`
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-ui/src/router/routes.ts`
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-ui/src/layouts/content/use-dataList.ts`
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-ui/src/locales/zh_CN/menu.ts`
- Modify: `/Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-ui/src/locales/en_US/menu.ts`

- [ ] **Step 1: Add TypeScript types**

Append to `types.ts`:

```ts
interface DataPreviewFilter {
  field: string
  operator: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'CONTAINS'
  value: string
}

interface DataPreviewSort {
  field: string
  direction: 'ASC' | 'DESC'
}

interface DataPreviewQueryRequest {
  datasourceId: number
  database: string
  schema?: string
  tableName: string
  filters: DataPreviewFilter[]
  sorts: DataPreviewSort[]
  pageNo: number
  pageSize: number
}

interface DataPreviewColumn {
  name: string
  type: string
  nullable?: boolean
  primaryKey?: boolean
  comment?: string
}

interface DataPreviewQueryResult {
  columns: DataPreviewColumn[]
  rows: Array<Record<string, unknown>>
  pageNo: number
  pageSize: number
  rowCount: number
  elapsedMs: number
  executedAt: string
  warnings: string[]
}
```

Update the export block:

```ts
export {
  ListReq,
  IDataBase,
  IDataSource,
  UserIdReq,
  TypeReq,
  NameReq,
  IdReq,
  DataPreviewFilter,
  DataPreviewSort,
  DataPreviewQueryRequest,
  DataPreviewColumn,
  DataPreviewQueryResult
}
```

- [ ] **Step 2: Add frontend API function**

In `index.ts`, import the types and add:

```ts
import type { DataPreviewQueryRequest } from './types'

export function previewDatasourceTableData(
  data: DataPreviewQueryRequest
): any {
  return axios({
    url: '/datasources/preview-data',
    method: 'post',
    data,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8'
    },
    transformRequest: (params) => JSON.stringify(params)
  })
}
```

- [ ] **Step 3: Create route module**

Create `data-preview.ts`:

```ts
import type { Component } from 'vue'
import utils from '@/utils'

const modules = import.meta.glob('/src/views/**/**.tsx')
const components: { [key: string]: Component } = utils.mapping(modules)

export default {
  path: '/data-preview',
  name: 'data-preview',
  meta: { title: '数据预览' },
  component: () => import('@/layouts/content'),
  children: [
    {
      path: '',
      name: 'data-preview-index',
      component: components['data-preview'],
      meta: {
        title: '数据预览',
        activeMenu: 'data-preview',
        showSide: false,
        auth: []
      }
    }
  ]
}
```

- [ ] **Step 4: Register route**

In `routes.ts`, add:

```ts
import dataPreviewPage from './modules/data-preview'
```

Add `dataPreviewPage` between `datasourcePage` and `syncTaskPage`:

```ts
datasourcePage,
dataPreviewPage,
syncTaskPage,
```

- [ ] **Step 5: Add menu labels**

In `zh_CN/menu.ts`, add:

```ts
data_preview: '数据预览',
```

In `en_US/menu.ts`, add:

```ts
data_preview: 'Data Preview',
```

- [ ] **Step 6: Add menu entry**

In `use-dataList.ts`, import icon `TableOutlined` from `@vicons/antd`.

Add between datasource and sync task:

```tsx
{
  label: () =>
    h(NEllipsis, null, { default: () => t('menu.data_preview') }),
  key: 'data-preview',
  icon: renderIcon(TableOutlined),
  children: []
},
```

- [ ] **Step 7: Type check route/service**

Run:

```bash
cd /Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-ui
pnpm exec vue-tsc --noEmit
```

Expected: no errors from data-preview route, menu, or service types.

## Task 5: Build Real Data Preview Page

**Files:**
- Create: `/Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-ui/src/views/data-preview/index.tsx`
- Create: `/Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-ui/src/views/data-preview/index.module.scss`

- [ ] **Step 1: Create styles**

Create `index.module.scss` with:

```scss
.page {
  height: calc(100vh - 88px);
  min-height: 620px;
  display: grid;
  grid-template-rows: 48px minmax(0, 1fr);
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
}

.topbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border-bottom: 1px solid var(--n-border-color);
}

.contextTitle {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--n-text-color-2);
}

.tableName {
  color: var(--n-text-color);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.body {
  min-height: 0;
  display: grid;
  grid-template-columns: 286px minmax(0, 1fr);
}

.sidebar {
  min-width: 0;
  border-right: 1px solid var(--n-border-color);
  display: grid;
  grid-template-rows: 40px minmax(0, 1fr);
}

.sidebarHeader {
  display: flex;
  align-items: center;
  padding: 0 10px;
  border-bottom: 1px solid var(--n-border-color);
  font-weight: 600;
}

.tree {
  min-height: 0;
  overflow: auto;
  padding: 8px;
}

.tableNode {
  min-height: 34px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 5px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.tableNode:hover {
  background: var(--n-action-color);
}

.tableNodeActive {
  background: rgba(24, 160, 88, 0.12);
  color: var(--n-primary-color);
  box-shadow: inset 3px 0 0 var(--n-primary-color);
}

.tableNodeMeta {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.workspace {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: 38px 38px 38px minmax(0, 1fr) 36px;
}

.tabs,
.tools,
.queryLine,
.statusbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  border-bottom: 1px solid var(--n-border-color);
}

.tabActive {
  height: 30px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  border: 1px solid var(--n-border-color);
  border-bottom: 0;
  border-radius: 6px 6px 0 0;
  background: var(--n-color);
  font-weight: 600;
}

.queryLabel {
  width: 72px;
  font-weight: 700;
  color: var(--n-text-color-2);
}

.chip {
  height: 26px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  border: 1px solid var(--n-border-color);
  border-radius: 4px;
  background: var(--n-color);
}

.grid {
  min-height: 0;
  overflow: auto;
}

.statusbar {
  border-bottom: 0;
  border-top: 1px solid var(--n-border-color);
  color: var(--n-text-color-3);
  font-size: 12px;
}
```

- [ ] **Step 2: Create page component state**

Create `index.tsx` with imports and state:

```tsx
import { defineComponent, onMounted, reactive, computed } from 'vue'
import {
  NButton,
  NDataTable,
  NEmpty,
  NInput,
  NSelect,
  NSpace,
  NSpin,
  NTag
} from 'naive-ui'
import type { DataTableColumns, SelectOption } from 'naive-ui'
import {
  queryDataSourceList,
  getDatasourceDatabasesById,
  getDatasourceTablesById,
  getDatasourceTableColumnMetasById,
  previewDatasourceTableData
} from '@/service/modules/data-source'
import type {
  DataPreviewColumn,
  DataPreviewFilter,
  DataPreviewQueryResult,
  DataPreviewSort
} from '@/service/modules/data-source/types'
import styles from './index.module.scss'

interface DatasourceOption extends SelectOption {
  value: number
  label: string
  type: 'MYSQL' | 'POSTGRESQL'
}

interface TableOption {
  name: string
}

export default defineComponent({
  name: 'DataPreview',
  setup() {
    const state = reactive({
      datasourceOptions: [] as DatasourceOption[],
      databaseOptions: [] as SelectOption[],
      tableOptions: [] as TableOption[],
      columns: [] as DataPreviewColumn[],
      rows: [] as Array<Record<string, unknown>>,
      filters: [] as DataPreviewFilter[],
      sorts: [] as DataPreviewSort[],
      datasourceId: null as number | null,
      database: null as string | null,
      tableName: null as string | null,
      filterField: null as string | null,
      filterValue: '',
      pageNo: 1,
      pageSize: 50,
      elapsedMs: 0,
      executedAt: '',
      loadingDatasource: false,
      loadingTree: false,
      loadingData: false
    })
```

- [ ] **Step 3: Add loaders and query functions**

Inside `setup`, add:

```tsx
    const normalizeList = (value: any): any[] => {
      if (Array.isArray(value)) return value
      if (Array.isArray(value?.totalList)) return value.totalList
      return []
    }

    const normalizeTextOptions = (value: any): SelectOption[] =>
      normalizeList(value).map((item) => ({
        label: item.label || item.value || item,
        value: item.value || item.label || item
      }))

    const loadDatasources = async () => {
      state.loadingDatasource = true
      try {
        const [mysqlList, pgList] = await Promise.all([
          queryDataSourceList({ type: 'MYSQL' }),
          queryDataSourceList({ type: 'POSTGRESQL' })
        ])
        state.datasourceOptions = [...normalizeList(mysqlList), ...normalizeList(pgList)].map((item) => ({
          label: `${item.name} (${item.type})`,
          value: item.id,
          type: item.type
        }))
        if (!state.datasourceId && state.datasourceOptions.length) {
          state.datasourceId = state.datasourceOptions[0].value
          await loadDatabases()
        }
      } finally {
        state.loadingDatasource = false
      }
    }

    const loadDatabases = async () => {
      if (!state.datasourceId) return
      state.loadingTree = true
      try {
        const res = await getDatasourceDatabasesById(state.datasourceId)
        state.databaseOptions = normalizeTextOptions(res)
        state.database = (state.databaseOptions[0]?.value as string) || null
        state.tableName = null
        state.rows = []
        await loadTables()
      } finally {
        state.loadingTree = false
      }
    }

    const loadTables = async () => {
      if (!state.datasourceId || !state.database) return
      state.loadingTree = true
      try {
        const res = await getDatasourceTablesById(state.datasourceId, state.database)
        state.tableOptions = normalizeTextOptions(res).map((item) => ({ name: item.value as string }))
        if (!state.tableName && state.tableOptions.length) {
          state.tableName = state.tableOptions[0].name
          await loadColumns()
        }
      } finally {
        state.loadingTree = false
      }
    }

    const loadColumns = async () => {
      if (!state.datasourceId || !state.database || !state.tableName) return
      const res = await getDatasourceTableColumnMetasById(
        state.datasourceId,
        state.database,
        state.tableName
      )
      state.columns = normalizeList(res)
      state.filterField = state.columns[0]?.name || null
      await queryData()
    }

    const queryData = async () => {
      if (!state.datasourceId || !state.database || !state.tableName) return
      state.loadingData = true
      try {
        const result = (await previewDatasourceTableData({
          datasourceId: state.datasourceId,
          database: state.database,
          tableName: state.tableName,
          filters: state.filters,
          sorts: state.sorts,
          pageNo: state.pageNo,
          pageSize: state.pageSize
        })) as DataPreviewQueryResult
        state.columns = result.columns || state.columns
        state.rows = result.rows || []
        state.elapsedMs = result.elapsedMs || 0
        state.executedAt = result.executedAt || ''
      } finally {
        state.loadingData = false
      }
    }
```

- [ ] **Step 4: Add interactions**

Add:

```tsx
    const handleDatasourceChange = async (value: number) => {
      state.datasourceId = value
      state.database = null
      state.tableName = null
      state.columns = []
      state.rows = []
      state.filters = []
      state.sorts = []
      await loadDatabases()
    }

    const handleDatabaseChange = async (value: string) => {
      state.database = value
      state.tableName = null
      state.columns = []
      state.rows = []
      state.filters = []
      state.sorts = []
      await loadTables()
    }

    const handleTableClick = async (tableName: string) => {
      state.tableName = tableName
      state.pageNo = 1
      state.filters = []
      state.sorts = []
      await loadColumns()
    }

    const applyFilter = async () => {
      if (!state.filterField || !state.filterValue) return
      state.filters = [
        {
          field: state.filterField,
          operator: 'CONTAINS',
          value: state.filterValue
        }
      ]
      state.pageNo = 1
      await queryData()
    }

    const clearFilter = async () => {
      state.filters = []
      state.filterValue = ''
      state.pageNo = 1
      await queryData()
    }

    const toggleSort = async (field: string) => {
      const current = state.sorts.find((item) => item.field === field)
      if (!current) {
        state.sorts = [{ field, direction: 'ASC' }]
      } else if (current.direction === 'ASC') {
        state.sorts = [{ field, direction: 'DESC' }]
      } else {
        state.sorts = []
      }
      await queryData()
    }
```

- [ ] **Step 5: Add computed columns**

Add:

```tsx
    const tableColumns = computed<DataTableColumns<Record<string, unknown>>>(() =>
      state.columns.map((column) => {
        const sort = state.sorts.find((item) => item.field === column.name)
        return {
          title: () => (
            <div onClick={() => toggleSort(column.name)} style={{ cursor: 'pointer' }}>
              <div>{column.name}{sort ? (sort.direction === 'ASC' ? ' ↑' : ' ↓') : ''}</div>
              <div style={{ fontSize: '11px', color: 'var(--n-text-color-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {column.comment || column.type}
              </div>
            </div>
          ),
          key: column.name,
          minWidth: 140,
          ellipsis: {
            tooltip: true
          },
          render: (row: Record<string, unknown>) => {
            const value = row[column.name]
            return value === null || value === undefined ? (
              <NTag size='small' type='default'>NULL</NTag>
            ) : String(value)
          }
        }
      })
    )

    const whereText = computed(() =>
      state.filters.length
        ? state.filters.map((item) => `${item.field} ${item.operator} '${item.value}'`).join(' AND ')
        : '无筛选条件'
    )

    const orderText = computed(() =>
      state.sorts.length
        ? state.sorts.map((item) => `${item.field} ${item.direction}`).join(', ')
        : '无排序条件'
    )
```

- [ ] **Step 6: Add lifecycle and return render**

Add:

```tsx
    onMounted(loadDatasources)

    return () => (
      <div class={styles.page}>
        <div class={styles.topbar}>
          <strong>数据预览</strong>
          <NSelect
            style={{ width: '220px' }}
            value={state.datasourceId}
            options={state.datasourceOptions}
            loading={state.loadingDatasource}
            placeholder='选择数据源'
            onUpdateValue={handleDatasourceChange}
          />
          <NSelect
            style={{ width: '180px' }}
            value={state.database}
            options={state.databaseOptions}
            placeholder='选择数据库'
            onUpdateValue={handleDatabaseChange}
          />
          <div class={styles.contextTitle}>
            <span>▦</span>
            <span class={styles.tableName}>{state.tableName || '请选择表'}</span>
            <NTag size='small'>{state.columns.length} 字段</NTag>
            <NTag size='small'>{state.filters.length} 筛选</NTag>
            <NTag size='small'>{state.sorts.length} 排序</NTag>
          </div>
          <NButton type='primary' onClick={queryData} loading={state.loadingData}>查询</NButton>
          <NButton onClick={queryData}>刷新</NButton>
        </div>
        <div class={styles.body}>
          <aside class={styles.sidebar}>
            <div class={styles.sidebarHeader}>库表目录</div>
            <div class={styles.tree}>
              <NSpin show={state.loadingTree}>
                {state.tableOptions.length ? state.tableOptions.map((table) => (
                  <div
                    key={table.name}
                    class={[styles.tableNode, table.name === state.tableName ? styles.tableNodeActive : '']}
                    onClick={() => handleTableClick(table.name)}
                  >
                    <div>{table.name}</div>
                    <div class={styles.tableNodeMeta}>TABLE</div>
                  </div>
                )) : <NEmpty description='暂无表，请先选择数据源和数据库' />}
              </NSpin>
            </div>
          </aside>
          <section class={styles.workspace}>
            <div class={styles.tabs}>
              <div class={styles.tabActive}>{state.tableName || '未打开表'}</div>
            </div>
            <div class={styles.tools}>
              <NSelect
                style={{ width: '180px' }}
                value={state.filterField}
                options={state.columns.map((item) => ({ label: item.name, value: item.name }))}
                placeholder='筛选字段'
                onUpdateValue={(value) => (state.filterField = value)}
              />
              <NInput
                style={{ width: '220px' }}
                value={state.filterValue}
                placeholder='输入筛选值'
                onUpdateValue={(value) => (state.filterValue = value)}
              />
              <NButton onClick={applyFilter}>筛选</NButton>
              <NButton onClick={clearFilter}>清空</NButton>
              <NSpace style={{ marginLeft: 'auto' }}>
                <NButton disabled>列设置</NButton>
                <NButton disabled>关联</NButton>
                <NButton disabled>保存视图</NButton>
              </NSpace>
            </div>
            <div class={styles.queryLine}>
              <span class={styles.queryLabel}>WHERE</span>
              <span class={styles.chip}>{whereText.value}</span>
            </div>
            <div class={styles.queryLine}>
              <span class={styles.queryLabel}>ORDER BY</span>
              <span class={styles.chip}>{orderText.value}</span>
            </div>
            <div class={styles.grid}>
              <NDataTable
                remote
                loading={state.loadingData}
                columns={tableColumns.value}
                data={state.rows}
                rowKey={(row) => JSON.stringify(row)}
                scrollX={Math.max(900, state.columns.length * 150)}
                size='small'
              />
            </div>
            <div class={styles.statusbar}>
              <span>返回 {state.rows.length} 行</span>
              <span>耗时 {state.elapsedMs} ms</span>
              <span>执行时间 {state.executedAt || '-'}</span>
            </div>
          </section>
        </div>
      </div>
    )
  }
})
```

- [ ] **Step 7: Type check page**

Run:

```bash
cd /Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-ui
pnpm exec vue-tsc --noEmit
```

Expected: no errors in `views/data-preview`.

## Task 6: Verification

**Files:**
- Verify backend and frontend behavior.

- [ ] **Step 1: Backend compile**

Run:

```bash
./mvnw -pl dolphinscheduler-api -DskipTests compile
```

Expected: API module compiles.

- [ ] **Step 2: Frontend type check**

Run:

```bash
cd /Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-ui
pnpm exec vue-tsc --noEmit
```

Expected: no TypeScript errors.

- [ ] **Step 3: Frontend build**

Run:

```bash
cd /Users/luwang/bigdata-build/dolphinscheduler/dolphinscheduler-ui
pnpm run build:prod
```

Expected: production build succeeds.

- [ ] **Step 4: Browser manual test**

Start the existing DolphinScheduler backend and UI dev server if not already running. Then test:

```text
1. Open /data-preview.
2. Confirm the left menu highlights 数据预览.
3. Select datasource.
4. Select database.
5. Click a table in the object tree.
6. Confirm field headers render.
7. Click 查询.
8. Confirm rows render.
9. Add a filter and confirm WHERE updates.
10. Click a table header and confirm ORDER BY updates.
11. Navigate to /sync-task and /datasource to confirm existing pages still open.
```

Expected: all steps work, or failures are documented with exact error messages.

## Task 7: Sync Design Repo After Implementation

**Files:**
- Source docs: `/Users/luwang/bigdata-build/dolphinscheduler/.ai/data-preview`
- Source plans: `/Users/luwang/bigdata-build/dolphinscheduler/docs/superpowers`
- Target repo: `/Users/luwang/bigdata-build/data-preview-design-repo`

- [ ] **Step 1: Copy updated docs**

Run:

```bash
rsync -a /Users/luwang/bigdata-build/dolphinscheduler/.ai/data-preview/ /Users/luwang/bigdata-build/data-preview-design-repo/.ai/data-preview/
rsync -a /Users/luwang/bigdata-build/dolphinscheduler/docs/superpowers/ /Users/luwang/bigdata-build/data-preview-design-repo/docs/superpowers/
```

- [ ] **Step 2: Commit and push design repo**

Run:

```bash
git -C /Users/luwang/bigdata-build/data-preview-design-repo status --short
git -C /Users/luwang/bigdata-build/data-preview-design-repo add .ai/data-preview docs/superpowers
git -C /Users/luwang/bigdata-build/data-preview-design-repo commit -m "Add real data preview implementation plan"
git -C /Users/luwang/bigdata-build/data-preview-design-repo push
```

Expected: design repo is updated with docs and this plan.

## Self-Review

- Spec coverage: covers docs-first workflow, DolphinScheduler route/menu, datasource/database/table loading, metadata loading, safe readonly query API, frontend Data Editor layout, filter/sort, verification, and design repo sync.
- Placeholder scan: no placeholder markers or deferred implementation wording remain.
- Type consistency: request/response DTO names match frontend service types and backend service/controller names.
- Scope check: first slice is intentionally limited to real route and readonly table data query. Personal views, joins, export, and SQL console are explicitly excluded.
- Risk note: the SQL helper in Task 3 uses datasource-specific identifier quoting in both WHERE and ORDER BY.
