---
acp-version: "3.9"
file-type: tech
domain: sync-task
module: backend-api
created: 2026-05-09
updated: 2026-05-09
inherit: ../core/desc.md
---

# 同步任务后端接口

## 字段元数据接口

### GET/POST `/datasources/tableColumnMetas`

读取源端或目标端表字段元数据，用于第 2 步字段设计。

**返回字段需要包含：**

| 字段 | 说明 |
|------|------|
| `name` | 字段名 |
| `type` | 原始字段类型 |
| `nullable` | 是否允许为空 |
| `primaryKey` | 是否主键 |
| `comment` | 字段注释 |

**历史问题：**

- MySQL 字段类型曾显示 `unknown`。
- 中文注释和 `enum('刑事','行政')` 曾出现解码问题。
- 修复方向是在后端保证从 `information_schema` 读取真实元数据，并统一处理中文编码。

## 建表预览接口

### POST `/datasources/preview-target-table`

根据目标字段设计生成 DDL 预览。

**要求：**

- PostgreSQL 目标表要生成 `CREATE TABLE IF NOT EXISTS`。
- 主键字段生成 `PRIMARY KEY`。
- 字段注释生成 `COMMENT ON COLUMN`。
- DDL 要能在页面友好展示，并允许用户编辑后执行。

## 执行建表接口

### POST `/datasources/create-target-table`

在目标端执行建表 SQL。

**要求：**

- 不要提前自动创建真实目标表。
- 只有用户点击“确认建表”后才执行。
- 执行结果需要在页面明确反馈。

## 工作流保存与执行

同步任务最终应保存为 DolphinScheduler 工作流定义。

| 接口 | 用途 |
|------|------|
| `/projects/{projectCode}/workflow-definition/query-by-name` | 查询同名工作流 |
| `/projects/{projectCode}/workflow-definition/verify-name` | 校验工作流名称 |
| `/projects/{projectCode}/workflow-definition` | 创建工作流定义 |
| `/projects/{projectCode}/workflow-definition/{code}/release` | 上线工作流 |
| `/projects/{projectCode}/executors/start-workflow-instance` | 启动工作流实例 |

## 已验证接口链路

历史自测曾看到以下成功响应：

- `preview-target-table` 返回 200，并生成包含主键和注释的 DDL。
- `create-target-table` 返回 200。
- 创建工作流定义返回 201。
- 工作流 release 返回 200。
- `start-workflow-instance` 返回 200。
