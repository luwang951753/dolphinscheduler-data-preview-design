---
acp-version: "3.9"
file-type: tech-spec
domain: root
module: root
created: 2026-05-09
updated: 2026-05-09
inherit: none
---

# 技术规范

## 技术栈

| 层 | 技术 |
|----|------|
| 平台底座 | Apache DolphinScheduler |
| 同步引擎 | Apache SeaTunnel |
| 后端 | Java、Spring Boot、DolphinScheduler API/Service/DAO |
| 前端 | DolphinScheduler UI，Vue/TypeScript 体系 |
| 数据源 | MySQL、PostgreSQL |
| 本地服务地址 | `http://127.0.0.1:12345/dolphinscheduler` |

## 主要源码目录

| 类型 | 路径 |
|------|------|
| 后端 API | `dolphinscheduler-api/src/main/java/org/apache/dolphinscheduler/api` |
| 前端 UI | `dolphinscheduler-ui/src` |
| SeaTunnel 任务插件 | `dolphinscheduler-task-plugin/dolphinscheduler-task-seatunnel` |
| E2E/临时点击脚本 | `tmp_sync_task_e2e.js`、`tmp_sync_task_mapping_e2e.js` |

## 关键接口

| 接口 | 用途 |
|------|------|
| `/datasources/tableColumnMetas` | 读取源端/目标端真实字段元数据 |
| `/datasources/preview-target-table` | 生成目标端建表 SQL 预览 |
| `/datasources/create-target-table` | 在目标端执行建表 |
| `/projects/{projectCode}/workflow-definition` | 保存同步任务为 DolphinScheduler 工作流定义 |
| `/projects/{projectCode}/workflow-definition/{code}/release` | 上线工作流定义 |
| `/projects/{projectCode}/executors/start-workflow-instance` | 启动同步实例 |

## 编码要求

- 中文输入、存储、传输、页面展示必须保持 UTF-8。
- MySQL 字段注释和枚举类型要确保不会出现乱码，必要时从 `information_schema` 获取原始信息并进行兼容处理。
- 核心代码修改需要添加中文注释，说明关键逻辑、输入输出和边界情况。
- 后端接口返回应使用 DolphinScheduler 现有响应结构，避免新增风格不一致的协议。
