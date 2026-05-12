---
acp-version: "3.9"
file-type: desc
domain: platform
module: core
created: 2026-05-09
updated: 2026-05-09
inherit: ../../rules.md
---

# 平台核心说明

## 平台目标

基于 DolphinScheduler 和 SeaTunnel 做数据同步与调度平台二开。DolphinScheduler 负责项目、数据源、工作流、调度、实例、权限和运行管理；SeaTunnel 负责实际数据同步任务执行。

## 用户决策

- 主要二开对象是 DolphinScheduler。
- SeaTunnel 暂不作为主要二开对象，优先使用二进制包或现有任务插件集成。
- 同步任务最终需要沉淀为 DolphinScheduler 工作流，确保可以在原有工作流实例体系中运行和追踪。

## 已完成/已验证过的方向

- DolphinScheduler Web 页面可通过本机 `12345` 端口访问。
- SeaTunnel 可以集成到 DolphinScheduler 并执行同步任务。
- 已做过 MySQL 到 PostgreSQL 的同步示例。
- 已围绕 `test1` 项目创建和运行过同步工作流。

## 风险点

- DolphinScheduler 源码体量大，修改共享组件容易破坏原生功能。
- 工作流定时、上线、运行实例等能力要复用但不能直接改坏原始入口。
- 页面缓存可能导致用户看到旧逻辑，交付时要明确刷新和自测方式。
