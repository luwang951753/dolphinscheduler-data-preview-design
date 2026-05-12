---
acp-version: "3.9"
file-type: index
domain: root
module: root
created: 2026-05-09
updated: 2026-05-09
inherit: none
---

# DolphinScheduler 二开 ACP 路由表

## 项目定位

本项目是在 DolphinScheduler 源码基础上进行二次开发，目标是构建更成熟的数据同步与调度平台。当前主线是以 DolphinScheduler 为平台底座，以 SeaTunnel 作为数据同步执行组件，在现有菜单和工作流体系内新增“同步任务”能力。

## 当前代码位置

| 类型 | 路径 |
|------|------|
| 主要二开目录 | `/Users/luwang/bigdata-build/dolphinscheduler` |
| 备份/另一份源码目录 | `/Users/luwang/大数据平台/dolphinscheduler` |
| SeaTunnel 源码目录 | `/Users/luwang/bigdata-build/seatunnel` |
| SeaTunnel 运行包 | `/Users/luwang/大数据平台/runtime/seatunnel/apache-seatunnel-2.3.3` |

## 模块索引

| 域 | 模块 | 文件 | 说明 |
|----|------|------|------|
| platform | core | `platform/core/desc.md` | 平台二开边界、总体目标、源码保护原则 |
| platform | runtime-integration | `platform/runtime-integration/desc.md` | DolphinScheduler 与 SeaTunnel 运行集成 |
| data-preview | core | `data-preview/core/req.md` | 数据预览模块需求开发文档 |
| data-preview | ui-wizard | `data-preview/ui-wizard/ui.md` | 数据预览页面原型说明文档 |
| data-preview | test | `data-preview/test/test-cases.md` | 数据预览模块测试用例基线文档 |
| data-preview | prototype | `data-preview/prototype/data-preview-prototype.html` | 数据预览网页原型 V1 |
| sync-task | core | `sync-task/core/desc.md` | 同步任务模块总览 |
| sync-task | ui-wizard | `sync-task/ui-wizard/ui.md` | 四步向导、页面交互、产品设计要求 |
| sync-task | backend-api | `sync-task/backend-api/tech.md` | 后端接口、工作流创建、建表接口 |
| sync-task | field-mapping | `sync-task/field-mapping/desc.md` | 字段勾选、字段映射、拖拽连线、类型转换 |
| sync-task | schedule-run | `sync-task/schedule-run/desc.md` | 立即执行、周期调度、保存并执行 |
| quality | e2e-click-testing | `quality/e2e-click-testing/desc.md` | 模拟人类点击自测规范 |
| quality | e2e-click-testing | `quality/e2e-click-testing/test-cases.md` | 同步任务详细测试用例基线 |
| design-system | patterns | `design-system/patterns.md` | 参考成熟产品的设计原则 |

## 关键页面和接口

| 类型 | 地址 |
|------|------|
| DolphinScheduler UI | `http://127.0.0.1:12345/dolphinscheduler/ui` |
| 同步任务页面 | `/ui/sync-task` |
| 字段元数据 | `/datasources/tableColumnMetas` |
| 建表预览 | `/datasources/preview-target-table` |
| 执行建表 | `/datasources/create-target-table` |
| 工作流定义 | `/projects/{projectCode}/workflow-definition` |
| 启动工作流实例 | `/projects/{projectCode}/executors/start-workflow-instance` |

## 用户长期要求

- 二开主对象是 DolphinScheduler，SeaTunnel 作为组件集成，能同步数据即可。
- 不能破坏 DolphinScheduler 原有功能，尤其是项目管理、工作流定义、定时等原生能力。
- 做任何设计都要参考市面成熟产品，尤其是 DataWorks、云厂商数据集成平台、大数据处理平台头部产品。
- 功能交付前必须用模拟人类逐步点击页面的方式完整自测。
- 不能只做页面样子，必须保证同步任务可以保存、建表、生成 SeaTunnel 配置并运行。
