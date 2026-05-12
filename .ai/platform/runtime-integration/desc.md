---
acp-version: "3.9"
file-type: desc
domain: platform
module: runtime-integration
created: 2026-05-09
updated: 2026-05-09
inherit: ../core/desc.md
---

# DolphinScheduler 与 SeaTunnel 集成

## 集成目标

让 DolphinScheduler 能够通过工作流运行 SeaTunnel 同步任务，用户不需要手写 SeaTunnel 配置文件，而是由“同步任务”页面自动生成配置并保存为可运行工作流。

## 运行要求

- DolphinScheduler 页面地址：`http://127.0.0.1:12345/dolphinscheduler/ui`
- SeaTunnel 环境通常应在安全中心的环境管理中配置。
- 源中心里需要存在可用的 MySQL 和 PostgreSQL 数据源。

## 典型数据源

| 名称 | 类型 | 用途 |
|------|------|------|
| `mysql_case_workbench` | MySQL | 源端示例数据源 |
| `pgsql_test1` | PostgreSQL | 目标端示例数据源 |

## 已验证同步链路

历史自测曾跑通过：

- 项目：`test1`
- 源端：`mysql_case_workbench / case_workbench / ajxx_tab`
- 目标端：`pgsql_test1 / test1 / public`
- 页面生成目标表名形如：`ajxx_tab_mapping_1778311390105`
- 能创建目标表、保存 DolphinScheduler 工作流、上线工作流并调用 `start-workflow-instance`。

## 注意事项

- 不要使用 `FakeSource -> Console` 作为交付结果，用户明确要求真实 MySQL 到 PostgreSQL 示例。
- H2 不是目标运行数据库方向，用户希望使用自己的 MySQL 和 PostgreSQL。
