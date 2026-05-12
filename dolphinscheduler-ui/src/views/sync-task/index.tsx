/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  defineComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  computed,
  ref,
  watch,
  h
} from 'vue'
import { useRouter } from 'vue-router'
import type { Router } from 'vue-router'
import {
  NAlert,
  NButton,
  NCheckbox,
  NDataTable,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NInput,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSpace,
  NSpin,
  NTag,
  NThing,
  NSteps,
  NStep,
  NDescriptions,
  NDescriptionsItem
} from 'naive-ui'
import type { DataTableColumns, SelectOption } from 'naive-ui'
import { format } from 'date-fns'
import Card from '@/components/card'
import TimingModal from './timing-modal'
import utils from '@/utils'
import {
  queryDataSourceList,
  getDatasourceDatabasesById,
  getDatasourceTablesById,
  getDatasourceTableColumnMetasById,
  createDatasourceTargetTable,
  previewDatasourceTargetTable
} from '@/service/modules/data-source'
import { queryAllProjectList } from '@/service/modules/projects'
import {
  createWorkflowDefinition,
  verifyName,
  queryWorkflowDefinitionByName,
  queryWorkflowDefinitionByCode,
  updateWorkflowDefinition,
  release
} from '@/service/modules/workflow-definition'
import { genTaskCodeList } from '@/service/modules/task-definition'
import { startWorkflowInstance } from '@/service/modules/executors'
import {
  online,
  queryScheduleListPaging
} from '@/service/modules/schedules'
import {
  queryWorkflowInstanceById,
  queryWorkflowInstanceListPaging,
  queryTaskListByWorkflowId
} from '@/service/modules/workflow-instances'
import { queryLog } from '@/service/modules/log'
import styles from './index.module.scss'

type SyncDatasourceType = 'MYSQL' | 'POSTGRESQL'
type ExecutionMode = 'IMMEDIATE' | 'SCHEDULE'

interface DatasourceOption extends SelectOption {
  value: number
  label: string
  type: SyncDatasourceType
}

interface ColumnItem {
  name: string
  type: string
  key: string
  nullable?: boolean
  primaryKey?: boolean
  comment?: string
}

interface DatasourceDetail {
  id: number
  name: string
  type: SyncDatasourceType
  host: string
  port: number
  userName: string
  password: string
  database: string
}

interface DatasourceRecord {
  id: number
  name: string
  type: SyncDatasourceType
  host?: string
  port?: number | string
  userName?: string
  dbUser?: string
  password?: string
  database?: string
  connectionParams?: string | Record<string, any>
}

interface ProjectOption extends SelectOption {
  value: number
  label: string
}

interface MappingRow {
  key: string
  sourceColumn: string
  sourceType: string
  targetColumn: string
  targetType: string
  sync: boolean
  mappedTargetKey?: string | null
  targetPrimaryKey?: boolean
}

interface FieldDesignRow {
  key: string
  sourceColumn: string
  sourceType: string
  sourceComment: string
  sourcePrimaryKey: boolean
  sourceNullable: boolean
  targetColumn: string
  targetType: string
  targetComment: string
  targetPrimaryKey: boolean
  targetNullable: boolean
  sync: boolean
  mappedTargetKey: string | null
}

interface WorkflowTaskProgressRow {
  key: string
  taskInstanceId: number | null
  name: string
  state: string
  stateLabel: string
  stateType: 'default' | 'info' | 'success' | 'warning' | 'error'
  startTime: string
  endTime: string
  host: string
}

interface EndpointState {
  datasourceId: number | null
  database: string | null
  table: string | null
  databases: string[]
  tables: string[]
  columns: ColumnItem[]
  loading: boolean
}

const SUPPORT_TYPES: SyncDatasourceType[] = ['MYSQL', 'POSTGRESQL']
const PASSWORD_MASK = '******'
const TARGET_TABLE_EXISTS_PREFIX = '-- DS_TARGET_TABLE_ALREADY_EXISTS'
const RUN_PROGRESS_LABELS = {
  IDLE: '等待执行',
  PREPARING: '准备工作流',
  STARTING: '提交运行',
  MONITORING: '运行监控中',
  SUCCESS: '执行成功',
  FAILURE: '执行失败'
} as const
const TERMINAL_WORKFLOW_STATES = new Set(['SUCCESS', 'FAILURE', 'STOP', 'PAUSE'])
const WORKFLOW_STATE_META: Record<
  string,
  {
    label: string
    type: 'default' | 'info' | 'success' | 'warning' | 'error'
  }
> = {
  SUBMITTED_SUCCESS: {
    label: '已提交',
    type: 'info'
  },
  RUNNING_EXECUTION: {
    label: '运行中',
    type: 'info'
  },
  READY_PAUSE: {
    label: '准备暂停',
    type: 'warning'
  },
  PAUSE: {
    label: '已暂停',
    type: 'warning'
  },
  READY_STOP: {
    label: '准备停止',
    type: 'warning'
  },
  STOP: {
    label: '已停止',
    type: 'warning'
  },
  FAILURE: {
    label: '失败',
    type: 'error'
  },
  SUCCESS: {
    label: '成功',
    type: 'success'
  },
  SERIAL_WAIT: {
    label: '串行等待',
    type: 'default'
  }
}
const TARGET_TYPE_OPTIONS: Record<SyncDatasourceType, string[]> = {
  MYSQL: [
    'BIGINT',
    'INT',
    'INTEGER',
    'SMALLINT',
    'TINYINT',
    'DECIMAL(10,2)',
    'DOUBLE',
    'FLOAT',
    'VARCHAR(255)',
    'TEXT',
    'LONGTEXT',
    'DATE',
    'TIME',
    'DATETIME',
    'TIMESTAMP',
    'BOOLEAN',
    'JSON'
  ],
  POSTGRESQL: [
    'BIGINT',
    'INTEGER',
    'SMALLINT',
    'NUMERIC(10,2)',
    'DOUBLE PRECISION',
    'REAL',
    'VARCHAR(255)',
    'TEXT',
    'DATE',
    'TIME',
    'TIMESTAMP',
    'TIMESTAMPTZ',
    'BOOLEAN',
    'JSONB'
  ]
}
const GENERIC_TARGET_TYPE_OPTIONS = Array.from(
  new Set(Object.values(TARGET_TYPE_OPTIONS).flat())
)

const normalizeList = (payload: any): any[] => {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload.totalList)) return payload.totalList
  if (Array.isArray(payload.records)) return payload.records
  if (Array.isArray(payload.data)) return payload.data
  return []
}

const normalizeTextList = (payload: any): string[] => {
  return normalizeList(payload)
    .map((item) => {
      if (typeof item === 'string') return item
      return item?.name || item?.label || item?.value || ''
    })
    .filter(Boolean)
}

const normalizeColumnList = (payload: any): ColumnItem[] => {
  return normalizeList(payload)
    .map((item, index) => {
      const name =
        item?.columnName || item?.name || item?.field || item?.label || ''
      if (!name) return null
      return {
        name,
        type:
          item?.type ||
          item?.dataType ||
          item?.columnType ||
          item?.jdbcType ||
          'unknown',
        key: `${name}-${index}`,
        nullable: item?.nullable,
        primaryKey: !!item?.primaryKey,
        comment: item?.comment || item?.remarks || ''
      }
    })
    .filter(Boolean) as ColumnItem[]
}

const extractErrorMessage = (error: any, fallback: string): string => {
  return (
    error?.response?.data?.msg ||
    error?.response?.data?.message ||
    error?.msg ||
    error?.message ||
    fallback
  )
}

const stripCreateTableResponsePrefix = (ddl: string) => {
  if (!ddl) {
    return {
      ddl: '',
      targetTableExists: false
    }
  }
  if (ddl.startsWith(TARGET_TABLE_EXISTS_PREFIX)) {
    return {
      ddl: ddl.replace(`${TARGET_TABLE_EXISTS_PREFIX}\n`, '').trim(),
      targetTableExists: true
    }
  }
  return {
    ddl,
    targetTableExists: false
  }
}

const parsePort = (value: any, fallback: number): number => {
  const port = Number(value)
  return Number.isFinite(port) ? port : fallback
}

const parseJdbcHostPort = (
  jdbcUrl: string | undefined,
  fallbackPort: number
): { host: string; port: number } => {
  if (!jdbcUrl) {
    return {
      host: '127.0.0.1',
      port: fallbackPort
    }
  }
  const matched = jdbcUrl.match(/^jdbc:[^:]+:\/\/([^/:?]+)(?::(\d+))?/)
  return {
    host: matched?.[1] || '127.0.0.1',
    port: parsePort(matched?.[2], fallbackPort)
  }
}

const parseConnectionParams = (
  item: DatasourceRecord
): Partial<DatasourceDetail> => {
  const fallbackPort = item.type === 'MYSQL' ? 3306 : 5432
  let params: Record<string, any> = {}
  if (typeof item.connectionParams === 'string') {
    try {
      params = JSON.parse(item.connectionParams)
    } catch (err) {
      params = {}
    }
  } else if (item.connectionParams) {
    params = item.connectionParams
  }

  const jdbcUrl = params.jdbcUrl || params.address
  const parsedAddress = parseJdbcHostPort(jdbcUrl, fallbackPort)
  return {
    host: item.host || parsedAddress.host,
    port: parsePort(item.port, parsedAddress.port || fallbackPort),
    userName: item.userName || item.dbUser || params.user || '',
    password:
      item.password && item.password !== PASSWORD_MASK
        ? item.password
        : params.password || '',
    database: item.database || params.database || ''
  }
}

const formatDateTime = (value: number | null): string => {
  if (!value) return ''
  return format(new Date(value), 'yyyy-MM-dd HH:mm:ss')
}

const extractWriteCountFromLog = (logText: string): number | null => {
  if (!logText) return null
  const matchedValues = [...logText.matchAll(/Total Write Count\s*:\s*([\d,]+)/g)]
  if (!matchedValues.length) return null
  const parsedValue = Number(
    matchedValues[matchedValues.length - 1][1]?.replaceAll(',', '')
  )
  return Number.isFinite(parsedValue) ? parsedValue : null
}

const escapeSqlIdentifier = (name: string): string => {
  return `\`${name.replaceAll('`', '``')}\``
}

const quotePostgresIdentifier = (name: string): string => {
  return `"${name.replaceAll('"', '""')}"`
}

// 这里按“目标字段设计区”的行顺序来拼 source select，
// 这样当用户通过连线把源字段重新映射到别的目标字段时，生成的 Seatunnel SQL 仍然与目标表列顺序一致。
const buildOrderedSourceRows = (rows: MappingRow[]): MappingRow[] => {
  const selectedRows = rows.filter((item) => item.sync && item.sourceColumn)
  if (!selectedRows.length) return []
  const mappedByTargetKey = new Map(
    selectedRows
      .filter((item) => item.mappedTargetKey)
      .map((item) => [item.mappedTargetKey as string, item])
  )
  return selectedRows.map((targetRow) => mappedByTargetKey.get(targetRow.key) || targetRow)
}

const buildSourceSelect = (rows: MappingRow[]): string => {
  const orderedSourceRows = buildOrderedSourceRows(rows)
  if (!orderedSourceRows.length) return 'select *'
  return `select ${orderedSourceRows
    .map((item) => escapeSqlIdentifier(item.sourceColumn))
    .join(', ')}`
}

const buildJdbcUrl = (detail: DatasourceDetail, databaseName: string): string => {
  if (detail.type === 'MYSQL') {
    return `jdbc:mysql://${detail.host}:${detail.port}/${databaseName}?useUnicode=true&characterEncoding=UTF-8&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true`
  }
  return `jdbc:postgresql://${detail.host}:${detail.port}/${databaseName}`
}

const buildDriver = (type: SyncDatasourceType): string => {
  return type === 'MYSQL'
    ? 'com.mysql.cj.jdbc.Driver'
    : 'org.postgresql.Driver'
}

const buildSinkTable = (
  targetType: SyncDatasourceType,
  databaseName: string,
  tableName: string
): string => {
  if (targetType === 'POSTGRESQL') {
    return tableName.includes('.') ? tableName : `public.${tableName}`
  }
  return tableName
}

const buildPrimaryKeys = (rows: MappingRow[]): string[] => {
  const configuredPrimaryKeys = rows
    .filter((item) => item.sync && item.targetPrimaryKey)
    .map((item) => item.targetColumn)
    .filter(Boolean)
  if (configuredPrimaryKeys.length) {
    return configuredPrimaryKeys
  }
  const candidates = ['id', 'ajbh', 'rybh']
  const matched = rows
    .filter((item) => item.sync)
    .map((item) => item.targetColumn)
    .filter((name) => candidates.includes(name))
  return matched.length ? [matched[0]] : []
}

const buildWorkflowName = (
  sourceName: string,
  sourceTable: string,
  targetName: string,
  targetTable: string
): string => {
  return `sync_${sourceName}_${sourceTable}_to_${targetName}_${targetTable}`
    .replaceAll(/[^a-zA-Z0-9_\u4e00-\u9fa5]+/g, '_')
    .slice(0, 120)
}

const buildDraftWorkflowName = (): string => {
  return `sync_draft_${format(new Date(), 'yyyyMMddHHmmss')}`
}

const extractWorkflowDefinitionMeta = (
  payload: any
): {
  code: number | null
  version: number
  releaseState: string
  name: string
} | null => {
  if (!payload) return null

  // query-by-name 接口返回的是一个 DAG 结构，真正的工作流定义在 workflowDefinition 字段里。
  // 这里统一兼容 query-by-name、query-by-code 以及可能的平铺对象，避免后续判断“是否已存在工作流”失真。
  const definition = payload.workflowDefinition || payload
  const code = Number(definition?.code)
  if (!Number.isFinite(code) || code <= 0) {
    return null
  }

  return {
    code,
    version: Number(definition?.version) || 1,
    releaseState: definition?.releaseState || '-',
    name: definition?.name || ''
  }
}

const extractWorkflowReleaseState = (payload: any): string => {
  return extractWorkflowDefinitionMeta(payload)?.releaseState || '-'
}

const inferTargetColumnType = (
  sourceType: string,
  targetDatasourceType?: SyncDatasourceType
): string => {
  const normalized = sourceType.toLowerCase()
  const targetType = targetDatasourceType || 'MYSQL'

  if (normalized.includes('json')) {
    return targetType === 'POSTGRESQL' ? 'JSONB' : 'JSON'
  }
  if (
    normalized.includes('bool') ||
    normalized.includes('bit') ||
    normalized.includes('tinyint(1)')
  ) {
    return 'BOOLEAN'
  }
  if (normalized.includes('bigint')) {
    return 'BIGINT'
  }
  if (normalized.includes('smallint')) {
    return 'SMALLINT'
  }
  if (normalized.includes('tinyint')) {
    return targetType === 'POSTGRESQL' ? 'SMALLINT' : 'TINYINT'
  }
  if (
    normalized.includes('int') ||
    normalized.includes('serial') ||
    normalized.includes('number')
  ) {
    return targetType === 'POSTGRESQL' ? 'INTEGER' : 'INT'
  }
  if (normalized.includes('decimal') || normalized.includes('numeric')) {
    return targetType === 'POSTGRESQL' ? 'NUMERIC(10,2)' : 'DECIMAL(10,2)'
  }
  if (normalized.includes('double')) {
    return targetType === 'POSTGRESQL' ? 'DOUBLE PRECISION' : 'DOUBLE'
  }
  if (normalized.includes('float') || normalized.includes('real')) {
    return targetType === 'POSTGRESQL' ? 'REAL' : 'FLOAT'
  }
  if (normalized.includes('longtext')) {
    return targetType === 'POSTGRESQL' ? 'TEXT' : 'LONGTEXT'
  }
  if (
    normalized.includes('char') ||
    normalized.includes('varchar') ||
    normalized.includes('string')
  ) {
    return 'VARCHAR(255)'
  }
  if (normalized.includes('text') || normalized.includes('clob')) {
    return 'TEXT'
  }
  if (normalized.includes('timestamp') || normalized.includes('datetime')) {
    return 'TIMESTAMP'
  }
  if (normalized.includes('date')) {
    return 'DATE'
  }
  if (normalized.includes('time')) {
    return 'TIME'
  }
  return 'TEXT'
}

const DRAFT_SEATUNNEL_CONFIG = [
  'env {',
  '  execution.parallelism = 1',
  '  job.mode = "BATCH"',
  '}',
  '',
  'source {',
  '  FakeSource {',
  '    result_table_name = "draft_source"',
  '    row.num = 1',
  '    schema = {',
  '      fields {',
  '        draft_id = "int"',
  '      }',
  '    }',
  '  }',
  '}',
  '',
  'sink {',
  '  Console {}',
  '}'
].join('\n')

const syncTask = defineComponent({
  name: 'sync-task',
  setup() {
    const router: Router = useRouter()
    const state = reactive({
      datasourceOptions: [] as DatasourceOption[],
      datasourceDetails: {} as Record<number, DatasourceDetail>,
      loadingDatasources: false,
      projectOptions: [] as ProjectOption[],
      selectedProjectCode: null as number | null,
      currentStep: 1,
      loadingProjects: false,
      creatingWorkflow: false,
      savingWorkflow: false,
      creatingTable: false,
      runningWorkflow: false,
      source: {
        datasourceId: null,
        database: null,
        table: null,
        databases: [],
        tables: [],
        columns: [],
        loading: false
      } as EndpointState,
      target: {
        datasourceId: null,
        database: null,
        table: null,
        databases: [],
        tables: [],
        columns: [],
        loading: false
      } as EndpointState,
      targetTableName: '',
      targetSchemaName: 'public',
      previewVisible: false,
      configEditorText: '',
      configManualOverride: false,
      fieldRows: [] as FieldDesignRow[],
      creatingMapping: false,
      latestWorkflowCode: null as number | null,
      latestWorkflowName: '',
      latestWorkflowVersion: 1,
      latestWorkflowReleaseState: '-' as string,
      latestRunStage: 'IDLE' as keyof typeof RUN_PROGRESS_LABELS,
      latestRunMessage: '尚未发起同步运行。',
      latestInstanceId: null as number | null,
      latestInstanceName: '',
      latestInstanceState: '' as string,
      latestInstanceStateLabel: '等待执行',
      latestInstanceStateType: 'default' as 'default' | 'info' | 'success' | 'warning' | 'error',
      latestInstanceStartTime: '',
      latestInstanceEndTime: '',
      latestInstanceTaskRows: [] as WorkflowTaskProgressRow[],
      latestInstanceTaskTotal: 0,
      latestInstanceTaskSuccess: 0,
      latestInstanceTaskRunning: 0,
      latestInstanceTaskFailed: 0,
      latestSyncedRowCount: null as number | null,
      latestSyncedRowCountLoading: false,
      latestSyncedRowCountInstanceId: null as number | null,
      latestScheduleId: null as number | null,
      latestCreateTableDdl: '',
      previewingTableDdl: false,
      executionParallelism: 1,
      executionMode: 'IMMEDIATE' as ExecutionMode,
      scheduleModalVisible: false,
      scheduleModalType: 'create' as 'create' | 'update',
      scheduleModalState: 'OFFLINE',
      scheduleModalRow: {} as Record<string, any>,
      latestScheduleSummary: '未配置' as string
    })
    const mappingWorkbenchRef = ref<HTMLElement | null>(null)
    const mappingAnchorPositions = ref<Record<string, { x: number; y: number }>>({})
    const draggingMapping = ref<{
      side: 'source' | 'target'
      key: string
    } | null>(null)
    const mappingDraftPoint = ref<{ x: number; y: number } | null>(null)
    let latestInstancePollingTimer: number | null = null

    const sourceDatasourceOption = computed(() =>
      state.datasourceOptions.find(
        (item) => item.value === state.source.datasourceId
      )
    )
    const targetDatasourceOption = computed(() =>
      state.datasourceOptions.find(
        (item) => item.value === state.target.datasourceId
      )
    )

    const sourceDatabaseOptions = computed(() =>
      state.source.databases.map((item) => ({ label: item, value: item }))
    )
    const sourceTableOptions = computed(() =>
      state.source.tables.map((item) => ({ label: item, value: item }))
    )
    const targetDatabaseOptions = computed(() =>
      state.target.databases.map((item) => ({ label: item, value: item }))
    )
    const targetTableOptions = computed(() =>
      state.target.tables.map((item) => ({ label: item, value: item }))
    )
    const sourceColumnOptions = computed(() =>
      state.source.columns.map((item) => ({
        label: `${item.name} (${item.type})`,
        value: item.name
      }))
    )
    const effectiveTargetColumns = computed(() => {
      if (state.target.columns.length) {
        return state.target.columns
      }
      if (!state.targetTableName.trim()) {
        return []
      }
      return state.source.columns.map((item, index) => ({
        name: item.name,
        type: item.type,
        key: `virtual-target-${item.name}-${index}`,
        nullable: item.nullable
      }))
    })

    const syncWarnings = computed(() => {
      const warnings: string[] = []
      if (!state.source.datasourceId || !state.target.datasourceId) {
        warnings.push('请选择源数据源和目标数据源。')
      }
      if (sourceDatasourceOption.value?.type === targetDatasourceOption.value?.type) {
        warnings.push('当前建议优先使用异构同步场景，例如 MySQL -> PostgreSQL。')
      }
      if (!state.fieldRows.some((item) => item.sync)) {
        warnings.push('当前没有选中任何字段，生成的配置将无法用于真实同步。')
      }
      if (!state.targetTableName.trim()) {
        warnings.push('目标表名称未确认，建议使用已有表或明确新表名。')
      }
      if (state.executionMode === 'SCHEDULE' && !state.latestScheduleId) {
        warnings.push('当前还没有配置周期调度，请先点击“配置周期调度”。')
      }
      return warnings
    })

    const mappedCount = computed(
      () => state.fieldRows.filter((item) => item.sync).length
    )

    const selectedSourceColumns = computed(() =>
      state.fieldRows.filter((item) => item.sync).map((item) => item.sourceColumn)
    )

    const targetTypeOptions = computed(() => {
      const targetType = targetDatasourceOption.value?.type
      const options = targetType
        ? TARGET_TYPE_OPTIONS[targetType]
        : GENERIC_TARGET_TYPE_OPTIONS
      return options.map((item) => ({
        label: item,
        value: item
      }))
    })

    const normalizeTargetMappings = (rows: FieldDesignRow[]): FieldDesignRow[] => {
      const selectedKeys = rows.filter((item) => item.sync).map((item) => item.key)
      if (!selectedKeys.length) {
        return rows.map((item) => ({
          ...item,
          mappedTargetKey: null
        }))
      }

      const usedTargetKeys = new Set<string>()
      const remainingTargetKeys = [...selectedKeys]

      return rows.map((row) => {
        if (!row.sync) {
          return {
            ...row,
            mappedTargetKey: null
          }
        }
        const nextTargetKey = row.mappedTargetKey
        if (nextTargetKey && selectedKeys.includes(nextTargetKey) && !usedTargetKeys.has(nextTargetKey)) {
          usedTargetKeys.add(nextTargetKey)
          const remainIndex = remainingTargetKeys.indexOf(nextTargetKey)
          if (remainIndex >= 0) {
            remainingTargetKeys.splice(remainIndex, 1)
          }
          return row
        }
        const fallbackTargetKey = remainingTargetKeys.shift() || row.key
        usedTargetKeys.add(fallbackTargetKey)
        return {
          ...row,
          mappedTargetKey: fallbackTargetKey
        }
      })
    }

    const selectedFieldRows = computed(() => state.fieldRows.filter((item) => item.sync))
    const mappedSourceByTargetKey = computed(() => {
      const targetMap = new Map<string, FieldDesignRow>()
      selectedFieldRows.value.forEach((row) => {
        if (row.mappedTargetKey) {
          targetMap.set(row.mappedTargetKey, row)
        }
      })
      return targetMap
    })

    const targetFieldRows = computed(() => selectedFieldRows.value)

    const getMappedSourceLabel = (targetKey: string) => {
      return mappedSourceByTargetKey.value.get(targetKey)?.sourceColumn || '未映射'
    }

    const generatedConfig = computed(() => {
      const sourceDetail = state.source.datasourceId
        ? state.datasourceDetails[state.source.datasourceId]
        : null
      const targetDetail = state.target.datasourceId
        ? state.datasourceDetails[state.target.datasourceId]
        : null
      if (
        !sourceDetail ||
        !targetDetail ||
        !state.source.database ||
        !state.source.table ||
        !state.target.database ||
        !state.targetTableName.trim()
      ) {
        return '# 请选择完整的源端、目标端和字段映射后，再自动生成 SeaTunnel 配置'
      }

      const sourceQuery =
        buildSourceSelect(state.fieldRows) +
        ` from ${state.source.table.includes('.')
          ? state.source.table
          : escapeSqlIdentifier(state.source.table)}`
      const primaryKeys = buildPrimaryKeys(state.fieldRows)
      const targetType = targetDetail.type
      const sinkTableName =
        targetType === 'POSTGRESQL'
          ? `${state.targetSchemaName.trim() || 'public'}.${state.targetTableName.trim()}`
          : state.targetTableName.trim()

      const lines = [
        'env {',
        '  execution.parallelism = 1',
        '  job.mode = "BATCH"',
        '}',
        '',
        'source {',
        '  Jdbc {',
        `    url = "${buildJdbcUrl(sourceDetail, state.source.database)}"`,
        `    driver = "${buildDriver(sourceDetail.type)}"`,
        `    user = "${sourceDetail.userName}"`,
        `    password = "${sourceDetail.password}"`,
        `    query = "${sourceQuery}"`,
        '  }',
        '}',
        '',
        'sink {',
        '  Jdbc {',
        `    url = "${buildJdbcUrl(targetDetail, state.target.database)}"`,
        `    driver = "${buildDriver(targetDetail.type)}"`,
        `    user = "${targetDetail.userName}"`,
        `    password = "${targetDetail.password}"`,
        '    generate_sink_sql = true',
        `    database = "${state.target.database}"`,
        `    table = "${buildSinkTable(targetType, state.target.database, sinkTableName)}"`
      ]

      if (primaryKeys.length) {
        lines.push(
          `    primary_keys = [${primaryKeys.map((item) => `"${item}"`).join(', ')}]`
        )
      }

      lines.push('  }', '}')
      return lines.join('\n')
    })

    const effectiveConfigText = computed(() =>
      state.configManualOverride ? state.configEditorText : generatedConfig.value
    )

    const summaryItems = computed(() => [
      {
        label: '执行方式',
        value: state.executionMode === 'IMMEDIATE' ? '立即执行' : '周期调度'
      },
      {
        label: '同步方向',
        value: `${sourceDatasourceOption.value?.type || '-'} -> ${
          targetDatasourceOption.value?.type || '-'
        }`
      },
      {
        label: '源表',
        value: state.source.table || '-'
      },
      {
        label: '目标表',
        value: state.targetTableName || state.target.table || '-'
      },
      {
        label: '映射字段数',
        value: String(mappedCount.value)
      },
      {
        label: '调度状态',
        value: state.latestScheduleSummary
      }
    ])

    watch(
      generatedConfig,
      (value) => {
        if (!state.configManualOverride || !state.configEditorText.trim()) {
          state.configEditorText = value
        }
      },
      {
        immediate: true
      }
    )

    const stepItems = computed(() => [
      {
        index: 1,
        title: '选择源与目标',
        description: '确认项目、数据源、库表和目标表'
      },
      {
        index: 2,
        title: '设计字段',
        description: '勾选源字段并设计目标字段类型'
      },
      {
        index: 3,
        title: '执行与调度',
        description: '配置建表、立即执行或周期调度'
      },
      {
        index: 4,
        title: '预览与发布',
        description: '检查配置结果并保存、执行'
      }
    ])

    const currentStepMeta = computed(
      () =>
        stepItems.value.find((item) => item.index === state.currentStep) ||
        stepItems.value[0]
    )

    const mappingLinePaths = computed(() => {
      return selectedFieldRows.value
        .map((sourceRow) => {
          const sourcePoint = mappingAnchorPositions.value[`source:${sourceRow.key}`]
          const targetPoint = sourceRow.mappedTargetKey
            ? mappingAnchorPositions.value[`target:${sourceRow.mappedTargetKey}`]
            : null
          if (!sourcePoint || !targetPoint) {
            return null
          }
          return {
            key: sourceRow.key,
            path: buildMappingPath(sourcePoint, targetPoint),
            active:
              draggingMapping.value?.side === 'source'
                ? draggingMapping.value.key === sourceRow.key
                : draggingMapping.value?.side === 'target'
                  ? sourceRow.mappedTargetKey === draggingMapping.value.key
                  : false
          }
        })
        .filter(Boolean) as Array<{ key: string; path: string; active: boolean }>
    })

    const mappingDraftPath = computed(() => {
      if (!draggingMapping.value || !mappingDraftPoint.value) {
        return ''
      }
      const startPoint =
        mappingAnchorPositions.value[
          `${draggingMapping.value.side}:${draggingMapping.value.key}`
        ]
      if (!startPoint) {
        return ''
      }
      return draggingMapping.value.side === 'source'
        ? buildMappingPath(startPoint, mappingDraftPoint.value)
        : buildMappingPath(mappingDraftPoint.value, startPoint)
    })

    watch(
      () =>
        `${state.currentStep}|${state.fieldRows
          .map(
            (item) =>
              `${item.key}:${item.sync}:${item.mappedTargetKey || ''}:${item.targetPrimaryKey}:${item.targetNullable}`
          )
          .join('|')}`,
      () => {
        void nextTick(refreshMappingLayout)
      }
    )

    onMounted(() => {
      window.addEventListener('resize', refreshMappingLayout)
      window.addEventListener('mousemove', handleGlobalMouseMove)
      window.addEventListener('mouseup', handleGlobalMouseUp)
    })

    onBeforeUnmount(() => {
      window.removeEventListener('resize', refreshMappingLayout)
      window.removeEventListener('mousemove', handleGlobalMouseMove)
      window.removeEventListener('mouseup', handleGlobalMouseUp)
      stopLatestInstancePolling()
    })

    const loadDatasourceDetail = async (datasourceId: number) => {
      const cachedDetail = state.datasourceDetails[datasourceId]
      if (
        cachedDetail &&
        cachedDetail.host &&
        cachedDetail.userName &&
        cachedDetail.password
      ) {
        return
      }
      // 同步任务页面直接复用数据源列表中已返回的连接参数，
      // 不再额外要求用户手工补密码，避免“数据源已可用、页面却提示密码为空”的割裂体验。
      if (!cachedDetail) {
        throw new Error(`未找到数据源详情: ${datasourceId}`)
      }
    }

    const loadDatasourceList = async () => {
      if (state.loadingDatasources) return
      state.loadingDatasources = true
      const [mysqlList, postgresqlList] = await Promise.all([
        queryDataSourceList({ type: 'MYSQL' }),
        queryDataSourceList({ type: 'POSTGRESQL' })
      ])
      const res = [...normalizeList(mysqlList), ...normalizeList(postgresqlList)]
      state.loadingDatasources = false
      state.datasourceOptions = res
        .filter((item) => SUPPORT_TYPES.includes(item.type))
        .map((item) => ({
          label: `${item.name} (${item.type})`,
          value: item.id,
          type: item.type
        }))
      res.forEach((item: DatasourceRecord) => {
        const parsedDetail = parseConnectionParams(item)
        state.datasourceDetails[item.id] = {
          id: item.id,
          name: item.name,
          type: item.type,
          host: parsedDetail.host || '127.0.0.1',
          port: parsedDetail.port || (item.type === 'MYSQL' ? 3306 : 5432),
          userName: parsedDetail.userName || '',
          password: parsedDetail.password || '',
          database: parsedDetail.database || ''
        }
      })
    }

    const loadProjects = async () => {
      if (state.loadingProjects) return
      state.loadingProjects = true
      const res = await queryAllProjectList()
      state.loadingProjects = false
      state.projectOptions = normalizeList(res).map((item) => ({
        label: item.name,
        value: item.code
      }))
    }

    const resetEndpoint = (endpoint: EndpointState) => {
      endpoint.database = null
      endpoint.table = null
      endpoint.databases = []
      endpoint.tables = []
      endpoint.columns = []
    }

    const refreshFieldRows = () => {
      const existed = new Map(
        state.fieldRows.map((item) => [item.sourceColumn, item])
      )
      const inferredTargetType = targetDatasourceOption.value?.type
      const targetColumnMap = new Map(
        state.target.columns.map((item) => [item.name, item])
      )

      state.fieldRows = normalizeTargetMappings(state.source.columns.map((sourceColumn) => {
        const oldRow = existed.get(sourceColumn.name)
        const targetSnapshot =
          targetColumnMap.get(oldRow?.targetColumn || sourceColumn.name) || null
        return {
          key: sourceColumn.name,
          sourceColumn: sourceColumn.name,
          sourceType: sourceColumn.type,
          sourceComment: oldRow?.sourceComment || sourceColumn.comment || '',
          sourcePrimaryKey: oldRow?.sourcePrimaryKey ?? !!sourceColumn.primaryKey,
          sourceNullable: oldRow?.sourceNullable ?? !!sourceColumn.nullable,
          targetColumn: oldRow?.targetColumn || sourceColumn.name,
          targetType:
            oldRow?.targetType ||
            targetSnapshot?.type ||
            inferTargetColumnType(sourceColumn.type, inferredTargetType),
          targetComment:
            oldRow?.targetComment ||
            targetSnapshot?.comment ||
            sourceColumn.comment ||
            '',
          targetPrimaryKey:
            oldRow?.targetPrimaryKey ??
            (targetSnapshot ? !!targetSnapshot.primaryKey : !!sourceColumn.primaryKey),
          targetNullable:
            oldRow?.targetNullable ??
            (targetSnapshot ? !!targetSnapshot.nullable : !!sourceColumn.nullable),
          sync: oldRow?.sync || false,
          mappedTargetKey: oldRow?.mappedTargetKey || null
        }
      }))
      void nextTick(refreshMappingLayout)
    }

    const updateFieldRow = (
      sourceColumnName: string,
      updater: (row: FieldDesignRow) => FieldDesignRow
    ) => {
      state.fieldRows = state.fieldRows.map((item) =>
        item.sourceColumn === sourceColumnName ? updater(item) : item
      )
    }

    const handleToggleField = (sourceColumnName: string, checked: boolean) => {
      state.fieldRows = normalizeTargetMappings(
        state.fieldRows.map((item) =>
          item.sourceColumn === sourceColumnName
            ? {
                ...item,
                sync: checked
              }
            : item
        )
      )
      void nextTick(refreshMappingLayout)
    }

    const handleTargetColumnNameChange = (
      sourceColumnName: string,
      targetColumnName: string
    ) => {
      updateFieldRow(sourceColumnName, (row) => ({
        ...row,
        targetColumn: targetColumnName
      }))
    }

    const handleTargetTypeChange = (
      sourceColumnName: string,
      targetType: string | null
    ) => {
      updateFieldRow(sourceColumnName, (row) => ({
        ...row,
        targetType: targetType || row.targetType
      }))
    }

    const handleTargetCommentChange = (
      sourceColumnName: string,
      targetComment: string
    ) => {
      updateFieldRow(sourceColumnName, (row) => ({
        ...row,
        targetComment
      }))
    }

    const handleTargetPrimaryKeyChange = (
      sourceColumnName: string,
      targetPrimaryKey: boolean
    ) => {
      updateFieldRow(sourceColumnName, (row) => ({
        ...row,
        targetPrimaryKey
      }))
    }

    const handleTargetNullableChange = (
      sourceColumnName: string,
      targetNullable: boolean
    ) => {
      updateFieldRow(sourceColumnName, (row) => ({
        ...row,
        targetNullable
      }))
    }

    const handleMapSourceToTarget = (sourceKey: string, targetKey: string) => {
      const sourceRow = state.fieldRows.find((item) => item.key === sourceKey && item.sync)
      const targetOwner = state.fieldRows.find(
        (item) => item.sync && item.mappedTargetKey === targetKey
      )
      if (!sourceRow) {
        return
      }
      const sourceCurrentTargetKey = sourceRow.mappedTargetKey
      state.fieldRows = normalizeTargetMappings(
        state.fieldRows.map((item) => {
          if (item.key === sourceKey) {
            return {
              ...item,
              mappedTargetKey: targetKey
            }
          }
          if (
            targetOwner &&
            targetOwner.key !== sourceKey &&
            item.key === targetOwner.key
          ) {
            return {
              ...item,
              mappedTargetKey: sourceCurrentTargetKey || item.key
            }
          }
          return item
        })
      )
      draggingMapping.value = null
      mappingDraftPoint.value = null
      void nextTick(refreshMappingLayout)
    }

    const handleMapTargetToSource = (targetKey: string, sourceKey: string) => {
      handleMapSourceToTarget(sourceKey, targetKey)
    }

    const loadDatabases = async (endpoint: EndpointState) => {
      if (!endpoint.datasourceId) return
      endpoint.loading = true
      try {
        await loadDatasourceDetail(endpoint.datasourceId)
        const res = await getDatasourceDatabasesById(endpoint.datasourceId)
        endpoint.databases = normalizeTextList(res)
        const datasourceDetail = state.datasourceDetails[endpoint.datasourceId]
        if (!endpoint.database && datasourceDetail?.database) {
          endpoint.database = datasourceDetail.database
        }
        if (!endpoint.database && endpoint.databases.length) {
          endpoint.database = endpoint.databases[0]
        }
      } catch (err) {
        endpoint.databases = []
        endpoint.database = null
        window.$message.error('读取数据源库列表失败，请检查该数据源的连接信息。')
      }
      endpoint.loading = false
    }

    const loadTables = async (endpoint: EndpointState) => {
      if (!endpoint.datasourceId || !endpoint.database) return
      endpoint.loading = true
      try {
        const res = await getDatasourceTablesById(
          endpoint.datasourceId,
          endpoint.database
        )
        endpoint.tables = normalizeTextList(res)
        if (endpoint.table && endpoint.tables.includes(endpoint.table)) return
        endpoint.table = endpoint.tables[0] || null
      } catch (err) {
        endpoint.tables = []
        endpoint.table = null
        window.$message.error('读取表列表失败，请确认数据库名称和数据源连接是否正确。')
      }
      endpoint.loading = false
    }

    const loadColumns = async (endpoint: EndpointState) => {
      if (!endpoint.datasourceId || !endpoint.database || !endpoint.table) return
      endpoint.loading = true
      try {
        const res = await getDatasourceTableColumnMetasById(
          endpoint.datasourceId,
          endpoint.database,
          endpoint.table
        )
        endpoint.columns = normalizeColumnList(res)
      } catch (err) {
        endpoint.columns = []
        window.$message.error('读取字段列表失败，请确认目标表存在且当前账号有查询权限。')
      }
      endpoint.loading = false
    }

    const refreshMappingLayout = () => {
      const container = mappingWorkbenchRef.value
      if (!container || state.currentStep !== 2) return
      const containerRect = container.getBoundingClientRect()
      const nextPositions: Record<string, { x: number; y: number }> = {}

      container.querySelectorAll<HTMLElement>('[data-source-anchor]').forEach((node) => {
        const key = node.dataset.sourceAnchor
        if (!key) return
        const rect = node.getBoundingClientRect()
        nextPositions[`source:${key}`] = {
          x: rect.left + rect.width / 2 - containerRect.left,
          y: rect.top + rect.height / 2 - containerRect.top
        }
      })

      container.querySelectorAll<HTMLElement>('[data-target-anchor]').forEach((node) => {
        const key = node.dataset.targetAnchor
        if (!key) return
        const rect = node.getBoundingClientRect()
        nextPositions[`target:${key}`] = {
          x: rect.left + rect.width / 2 - containerRect.left,
          y: rect.top + rect.height / 2 - containerRect.top
        }
      })

      mappingAnchorPositions.value = nextPositions
    }

    const handleGlobalMouseMove = (event: MouseEvent) => {
      if (!draggingMapping.value || !mappingWorkbenchRef.value) {
        return
      }
      const containerRect = mappingWorkbenchRef.value.getBoundingClientRect()
      mappingDraftPoint.value = {
        x: event.clientX - containerRect.left,
        y: event.clientY - containerRect.top
      }
    }

    const handleGlobalMouseUp = () => {
      if (!draggingMapping.value) {
        return
      }
      draggingMapping.value = null
      mappingDraftPoint.value = null
    }

    const handleStartMappingDrag = (
      side: 'source' | 'target',
      key: string,
      event: MouseEvent
    ) => {
      if (!state.fieldRows.find((item) => item.key === key && item.sync)) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      draggingMapping.value = {
        side,
        key
      }
      handleGlobalMouseMove(event)
    }

    const buildMappingPath = (
      startPoint: { x: number; y: number },
      endPoint: { x: number; y: number }
    ) => {
      const controlOffset = Math.min(
        Math.max(Math.abs(endPoint.x - startPoint.x) * 0.36, 72),
        140
      )
      return `M ${startPoint.x} ${startPoint.y} C ${startPoint.x + controlOffset} ${startPoint.y}, ${endPoint.x - controlOffset} ${endPoint.y}, ${endPoint.x} ${endPoint.y}`
    }

    const handleChooseAllMappings = (checked: boolean) => {
      state.fieldRows = normalizeTargetMappings(
        state.fieldRows.map((item) => ({
          ...item,
          sync: checked
        }))
      )
      void nextTick(refreshMappingLayout)
    }

    const handleInvertMappings = () => {
      state.fieldRows = normalizeTargetMappings(
        state.fieldRows.map((item) => ({
          ...item,
          sync: !item.sync
        }))
      )
      void nextTick(refreshMappingLayout)
    }

    const allFieldsChecked = computed(
      () => !!state.fieldRows.length && state.fieldRows.every((item) => item.sync)
    )

    const someFieldsChecked = computed(
      () =>
        state.fieldRows.some((item) => item.sync) &&
        !state.fieldRows.every((item) => item.sync)
    )

    const handleCopyConfig = () => {
      const copied = utils.copy(effectiveConfigText.value)
      if (copied) {
        window.$message.success('SeaTunnel 配置已复制。')
      } else {
        window.$message.error('复制失败，请手动复制配置内容。')
      }
    }

    const handleOpenPreview = () => {
      if (!state.configManualOverride) {
        state.configEditorText = generatedConfig.value
      }
      state.previewVisible = true
    }

    const handleConfigEditorChange = (value: string) => {
      state.configEditorText = value
      state.configManualOverride = true
    }

    const handleResetConfigEditor = () => {
      state.configManualOverride = false
      state.configEditorText = generatedConfig.value
      window.$message.success('已恢复为自动生成的 SeaTunnel 配置。')
    }

    const openWorkflowInstanceDetail = (instanceId?: number | null) => {
      if (!state.selectedProjectCode || !instanceId) return
      void router.push({
        name: 'workflow-instance-detail',
        params: {
          projectCode: state.selectedProjectCode,
          id: instanceId
        },
        query: {
          code: String(state.latestWorkflowCode || '')
        }
      })
    }

    const stopLatestInstancePolling = () => {
      if (latestInstancePollingTimer) {
        window.clearInterval(latestInstancePollingTimer)
        latestInstancePollingTimer = null
      }
    }

    const resolveWorkflowStateMeta = (stateValue: string) => {
      return WORKFLOW_STATE_META[stateValue] || {
        label: stateValue || '未知状态',
        type: 'default' as const
      }
    }

    const refreshLatestInstanceProgress = async (instanceId: number) => {
      if (!state.selectedProjectCode) return null
      const [instanceDetail, taskResult] = await Promise.all([
        queryWorkflowInstanceById(instanceId, state.selectedProjectCode),
        queryTaskListByWorkflowId(instanceId, state.selectedProjectCode)
      ])

      const instanceState =
        instanceDetail?.state ||
        instanceDetail?.processInstance?.state ||
        ''
      const stateMeta = resolveWorkflowStateMeta(instanceState)
      const taskRows = normalizeList(taskResult?.taskList || taskResult).map((task: any, index) => {
        const taskState = task?.state || ''
        const taskStateMeta = resolveWorkflowStateMeta(taskState)
        return {
          key: `${task?.id || task?.taskCode || index}`,
          taskInstanceId: Number(task?.id) || null,
          name: task?.name || task?.taskName || `task_${index + 1}`,
          state: taskState,
          stateLabel: taskStateMeta.label,
          stateType: taskStateMeta.type,
          startTime: formatDateTime(task?.startTime || null),
          endTime: formatDateTime(task?.endTime || null),
          host: task?.host || '-'
        }
      })

      state.latestInstanceState = instanceState
      state.latestInstanceStateLabel = stateMeta.label
      state.latestInstanceStateType = stateMeta.type
      state.latestInstanceStartTime = formatDateTime(instanceDetail?.startTime || null)
      state.latestInstanceEndTime = formatDateTime(instanceDetail?.endTime || null)
      state.latestInstanceTaskRows = taskRows
      state.latestInstanceTaskTotal = taskRows.length
      state.latestInstanceTaskSuccess = taskRows.filter((item) => item.state === 'SUCCESS').length
      state.latestInstanceTaskRunning = taskRows.filter((item) =>
        ['RUNNING_EXECUTION', 'SUBMITTED_SUCCESS', 'SERIAL_WAIT'].includes(item.state)
      ).length
      state.latestInstanceTaskFailed = taskRows.filter((item) =>
        ['FAILURE', 'STOP'].includes(item.state)
      ).length

      if (instanceState === 'SUCCESS') {
        state.latestRunStage = 'SUCCESS'
        state.latestRunMessage = '执行成功'
      } else if (instanceState && TERMINAL_WORKFLOW_STATES.has(instanceState)) {
        state.latestRunStage = 'FAILURE'
        state.latestRunMessage = '执行失败'
      } else {
        state.latestRunStage = 'MONITORING'
        state.latestRunMessage = '运行中'
      }

      if (
        instanceState === 'SUCCESS' &&
        state.latestSyncedRowCountInstanceId !== instanceId
      ) {
        state.latestSyncedRowCountLoading = true
        try {
          let totalWriteCount = 0
          let hasWriteCount = false
          for (const taskRow of taskRows) {
            if (taskRow.state !== 'SUCCESS' || !taskRow.taskInstanceId) {
              continue
            }
            // 这里复用 DolphinScheduler 原生日志接口，从 SeaTunnel 执行日志中解析
            // Total Write Count，确保页面展示的是真实同步行数。
            let skipLineNum = 0
            let taskLogText = ''
            for (let attempt = 0; attempt < 12; attempt += 1) {
              const logChunk = await queryLog({
                taskInstanceId: taskRow.taskInstanceId,
                skipLineNum,
                limit: 1000
              })
              const message = logChunk?.message || ''
              const lineNum = Number(logChunk?.lineNum || 0)
              if (!message) {
                break
              }
              taskLogText += message
              skipLineNum += lineNum || message.split(/\r?\n/).length
            }
            const taskWriteCount = extractWriteCountFromLog(taskLogText)
            if (taskWriteCount !== null) {
              totalWriteCount += taskWriteCount
              hasWriteCount = true
            }
          }
          state.latestSyncedRowCount = hasWriteCount ? totalWriteCount : null
          state.latestSyncedRowCountInstanceId = instanceId
        } catch (error) {
          state.latestSyncedRowCount = null
          state.latestSyncedRowCountInstanceId = instanceId
        }
        state.latestSyncedRowCountLoading = false
      } else if (instanceState !== 'SUCCESS') {
        state.latestSyncedRowCount = null
        state.latestSyncedRowCountLoading = false
        state.latestSyncedRowCountInstanceId = null
      }

      return instanceState
    }

    const startLatestInstancePolling = async (instanceId: number) => {
      stopLatestInstancePolling()
      const firstState = await refreshLatestInstanceProgress(instanceId)
      if (firstState && TERMINAL_WORKFLOW_STATES.has(firstState)) {
        return
      }
      latestInstancePollingTimer = window.setInterval(async () => {
        try {
          const currentState = await refreshLatestInstanceProgress(instanceId)
          if (currentState && TERMINAL_WORKFLOW_STATES.has(currentState)) {
            stopLatestInstancePolling()
          }
        } catch (error) {
          stopLatestInstancePolling()
        }
      }, 3000)
    }

    const queryLatestWorkflowInstanceId = async (
      workflowDefinitionCode: number
    ): Promise<number | null> => {
      if (!state.selectedProjectCode) return null

      // DolphinScheduler 的启动接口并不总是稳定返回实例 ID。
      // 这里在启动后主动按工作流编码查询最新实例，避免“任务已启动但页面无法跳转”的体验断层。
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const result = await queryWorkflowInstanceListPaging(
          {
            pageNo: 1,
            pageSize: 10,
            workflowDefinitionCode,
            searchVal: ''
          },
          state.selectedProjectCode
        )
        const latestRow = normalizeList(result)[0]
        const latestInstanceId = Number(latestRow?.id)
        if (Number.isFinite(latestInstanceId) && latestInstanceId > 0) {
          state.latestInstanceName = latestRow?.name || ''
          return latestInstanceId
        }
        await new Promise((resolve) => window.setTimeout(resolve, 800))
      }

      return null
    }

    const validateProjectSelection = (): number | null => {
      if (!state.selectedProjectCode) {
        window.$message.error('请先选择要落入的 DolphinScheduler 项目。')
        return null
      }
      return state.selectedProjectCode
    }

    const validateSyncDesign = () => {
      const sourceOption = sourceDatasourceOption.value
      const targetOption = targetDatasourceOption.value
      const projectCode = validateProjectSelection()
      if (!projectCode) {
        return null
      }
      if (!sourceOption || !targetOption) {
        window.$message.error('请先选择源数据源和目标数据源。')
        return null
      }
      if (!state.source.table || !state.targetTableName.trim()) {
        window.$message.error('请先选择源表并确认目标表名称。')
        return null
      }
      if (
        !state.fieldRows.some(
          (item) => item.sync && item.targetColumn.trim() && item.targetType.trim()
        )
      ) {
        window.$message.error('请至少配置一个有效的字段映射。')
        return null
      }
      if (state.executionMode === 'SCHEDULE' && !state.latestScheduleId) {
        window.$message.error('请先配置周期调度。')
        return null
      }
      return {
        projectCode,
        sourceOption,
        targetOption
      }
    }

    // 第一步只校验连接设计是否完整，方便用户以“步骤式”方式推进配置。
    const validateStepOne = (showMessage = true) => {
      if (!state.selectedProjectCode) {
        if (showMessage) {
          window.$message.error('请先选择要落入的 DolphinScheduler 项目。')
        }
        return false
      }
      if (!state.source.datasourceId || !state.target.datasourceId) {
        if (showMessage) {
          window.$message.error('请先选择源数据源和目标数据源。')
        }
        return false
      }
      if (!state.source.database || !state.source.table) {
        if (showMessage) {
          window.$message.error('请先选择完整的源库和源表。')
        }
        return false
      }
      if (!state.target.database) {
        if (showMessage) {
          window.$message.error('请先选择目标库。')
        }
        return false
      }
      if (!state.targetTableName.trim()) {
        if (showMessage) {
          window.$message.error('请先确认目标表名称。')
        }
        return false
      }
      return true
    }

    // 第二步只关心字段设计本身，避免和调度、执行耦合在一起。
    const validateStepTwo = (showMessage = true) => {
      if (!validateStepOne(showMessage)) {
        return false
      }
      const selectedRows = state.fieldRows.filter((item) => item.sync)
      if (!selectedRows.length) {
        if (showMessage) {
          window.$message.error('请至少勾选一个需要同步的源字段。')
        }
        return false
      }
      const invalidRow = selectedRows.find(
        (item) => !item.targetColumn.trim() || !item.targetType.trim()
      )
      if (invalidRow) {
        if (showMessage) {
          window.$message.error(`字段 ${invalidRow.sourceColumn} 的目标字段名或目标类型未配置完整。`)
        }
        return false
      }
      return true
    }

    const buildTargetTableRequest = (showMessage = true) => {
      if (!validateStepTwo(showMessage)) {
        return null
      }
      if (!state.target.datasourceId || !state.target.database) {
        if (showMessage) {
          window.$message.error('请先确认目标数据源和目标库。')
        }
        return null
      }

      return {
        datasourceId: state.target.datasourceId,
        database: state.target.database,
        schema: state.targetSchemaName.trim() || 'public',
        tableName: state.targetTableName.trim(),
        columns: targetFieldRows.value.map((targetRow) => {
          const mappedSourceRow =
            mappedSourceByTargetKey.value.get(targetRow.key) || targetRow
          return {
            sourceColumn: mappedSourceRow.sourceColumn,
            sourceType: mappedSourceRow.sourceType,
            sourceComment: mappedSourceRow.sourceComment,
            targetColumn: targetRow.targetColumn,
            targetType: targetRow.targetType,
            targetComment: targetRow.targetComment,
            nullable: targetRow.targetNullable,
            primaryKey: targetRow.targetPrimaryKey
          }
        })
      }
    }

    const handlePrevStep = () => {
      state.currentStep = Math.max(1, state.currentStep - 1)
    }

    const handleNextStep = () => {
      if (state.currentStep === 1 && !validateStepOne()) {
        return
      }
      if (state.currentStep === 2 && !validateStepTwo()) {
        return
      }
      state.currentStep = Math.min(4, state.currentStep + 1)
    }

    const handleJumpStep = (step: number) => {
      state.currentStep = step
    }

    const loadScheduleMeta = async (workflowDefinitionCode: number) => {
      if (!state.selectedProjectCode) return null
      const scheduleList = await queryScheduleListPaging(
        {
          pageNo: 1,
          pageSize: 20,
          searchVal: '',
          workflowDefinitionCode
        },
        state.selectedProjectCode
      )
      const scheduleRow = normalizeList(scheduleList)[0] || null
      if (!scheduleRow) {
        state.latestScheduleId = null
        state.latestScheduleSummary = '未配置'
        return null
      }

      state.latestScheduleId = scheduleRow.id || null
      state.latestScheduleSummary = `${scheduleRow.releaseState || 'OFFLINE'} / ${
        scheduleRow.crontab || '未生成'
      }`
      return scheduleRow
    }

    const buildWorkflowPayload = async (draftOnly = false) => {
      if (draftOnly) {
        const projectCode = validateProjectSelection()
        if (!projectCode) return null
        const [taskCode] = await genTaskCodeList(1, projectCode)
        return {
          projectCode,
          workflowName: state.latestWorkflowName || buildDraftWorkflowName(),
          taskDefinition: {
            code: taskCode,
            delayTime: '0',
            description: '同步任务调度草稿，占位用，正式保存后会被真实同步任务覆盖',
            environmentCode: -1,
            failRetryInterval: '1',
            failRetryTimes: '0',
            flag: 'YES',
            name: 'sync_task_draft',
            taskGroupId: null,
            taskGroupPriority: null,
            taskParams: {
              localParams: [],
              rawScript: DRAFT_SEATUNNEL_CONFIG,
              resourceList: [],
              startupScript: 'seatunnel.sh',
              useCustom: true,
              deployMode: 'local',
              others: ''
            },
            taskPriority: 'MEDIUM',
            taskType: 'SEATUNNEL',
            timeout: 0,
            timeoutFlag: 'CLOSE',
            timeoutNotifyStrategy: '',
            workerGroup: 'default',
            cpuQuota: -1,
            memoryMax: -1,
            taskExecuteType: 'BATCH'
          },
          taskRelation: {
            name: '',
            preTaskCode: 0,
            preTaskVersion: 0,
            postTaskCode: taskCode,
            postTaskVersion: 1,
            conditionType: 'NONE',
            conditionParams: {}
          },
          location: {
            taskCode,
            x: 320,
            y: 160
          },
          description:
            '同步任务页面自动生成的调度草稿，等待补全源端、目标端和字段映射'
        }
      }

      const validated = validateSyncDesign()
      if (!validated) return null
      const { sourceOption, targetOption } = validated

      const workflowName = buildWorkflowName(
        sourceOption.label,
        state.source.table || '',
        targetOption.label,
        state.targetTableName.trim()
      )
      const taskName = `${state.source.table}_to_${state.targetTableName.trim()}`
        .replaceAll(/[^a-zA-Z0-9_\u4e00-\u9fa5]+/g, '_')
        .slice(0, 120)
      const [taskCode] = await genTaskCodeList(1, state.selectedProjectCode as number)
      const taskDefinition = {
        code: taskCode,
        delayTime: '0',
        description: `由同步任务页面自动生成，来源 ${sourceOption.label} -> ${targetOption.label}`,
        environmentCode: -1,
        failRetryInterval: '1',
        failRetryTimes: '0',
        flag: 'YES',
        name: taskName,
        taskGroupId: null,
        taskGroupPriority: null,
        taskParams: {
          localParams: [],
          rawScript: effectiveConfigText.value,
          resourceList: [],
          startupScript: 'seatunnel.sh',
          useCustom: true,
          deployMode: 'local',
          others: ''
        },
        taskPriority: 'MEDIUM',
        taskType: 'SEATUNNEL',
        timeout: 0,
        timeoutFlag: 'CLOSE',
        timeoutNotifyStrategy: '',
        workerGroup: 'default',
        cpuQuota: -1,
        memoryMax: -1,
        taskExecuteType: 'BATCH'
      }
      const taskRelation = {
        name: '',
        preTaskCode: 0,
        preTaskVersion: 0,
        postTaskCode: taskCode,
        postTaskVersion: 1,
        conditionType: 'NONE',
        conditionParams: {}
      }
      const location = {
        taskCode,
        x: 320,
        y: 160
      }

      return {
        projectCode: validated.projectCode,
        workflowName,
        taskDefinition,
        taskRelation,
        location,
        description: `同步任务页面自动生成: ${state.source.table} -> ${state.targetTableName.trim()}`
      }
    }

    const handleCreateTargetTable = async () => {
      const request = buildTargetTableRequest()
      if (!request) return
      if (!state.latestCreateTableDdl.trim()) {
        window.$message.error('请先生成建表语句，再确认执行建表。')
        return
      }
      state.creatingTable = true
      try {
        const ddlResponse = await createDatasourceTargetTable({
          ...request,
          ddl: state.latestCreateTableDdl
        })
        const { ddl, targetTableExists } = stripCreateTableResponsePrefix(ddlResponse)
        state.latestCreateTableDdl = ddl
        if (targetTableExists) {
          window.$message.success('目标表已存在，已跳过重复建表，可直接继续保存或执行同步任务。')
        } else {
          window.$message.success('目标端建表成功。')
        }
      } catch (err) {
        window.$message.error(
          extractErrorMessage(err, '目标端建表失败，请检查目标库连接和建表语句。')
        )
        state.creatingTable = false
        return
      }
      state.creatingTable = false
    }

    const handlePreviewTargetTable = async () => {
      const request = buildTargetTableRequest()
      if (!request) return
      state.previewingTableDdl = true
      try {
        const ddl = await previewDatasourceTargetTable(request)
        state.latestCreateTableDdl = ddl
        window.$message.success('已生成目标端建表语句，你可以继续审阅或编辑。')
      } catch (err) {
        window.$message.error('生成建表语句失败，请检查字段设计和目标库配置。')
        state.previewingTableDdl = false
        return
      }
      state.previewingTableDdl = false
    }

    const handleSaveWorkflow = async () => {
      const payload = await buildWorkflowPayload()
      if (!payload) return false
      state.savingWorkflow = true
      try {
        let existedMeta: ReturnType<typeof extractWorkflowDefinitionMeta> = null
        try {
          const existed = await queryWorkflowDefinitionByName(
            {
              name: payload.workflowName
            },
            payload.projectCode
          )
          existedMeta = extractWorkflowDefinitionMeta(existed)
        } catch (err) {
          existedMeta = null
        }

        if (existedMeta?.code) {
          if (existedMeta.releaseState === 'ONLINE') {
            // DolphinScheduler 原生限制：上线状态的工作流定义不允许直接修改。
            // 这里先自动下线，再执行更新，这样同步任务页面可以持续迭代同一条工作流。
            await release(
              {
                name: payload.workflowName,
                releaseState: 'OFFLINE'
              },
              payload.projectCode,
              existedMeta.code
            )
          }
          await updateWorkflowDefinition(
            {
              name: payload.workflowName,
              executionType: 'PARALLEL',
              description: `同步任务页面自动生成: ${state.source.table} -> ${state.targetTableName.trim()}`,
              globalParams: '[]',
              timeout: 0,
              taskDefinitionJson: JSON.stringify([payload.taskDefinition]),
              taskRelationJson: JSON.stringify([payload.taskRelation]),
              locations: JSON.stringify([payload.location]),
              releaseState: 'OFFLINE'
            },
            existedMeta.code,
            payload.projectCode
          )
          state.latestWorkflowCode = existedMeta.code
          const latest = await queryWorkflowDefinitionByCode(
            existedMeta.code,
            payload.projectCode
          )
          const latestMeta = extractWorkflowDefinitionMeta(latest)
          state.latestWorkflowVersion = latestMeta?.version || existedMeta.version || 1
          state.latestWorkflowReleaseState = latestMeta?.releaseState || 'OFFLINE'
        } else {
          await verifyName(
            {
              name: payload.workflowName
            },
            state.selectedProjectCode as number
          )
          await createWorkflowDefinition(
            {
              name: payload.workflowName,
              executionType: 'PARALLEL',
              description: payload.description,
              globalParams: '[]',
              timeout: 0,
              taskDefinitionJson: JSON.stringify([payload.taskDefinition]),
              taskRelationJson: JSON.stringify([payload.taskRelation]),
              locations: JSON.stringify([payload.location])
            },
            payload.projectCode
          )
          const latest = await queryWorkflowDefinitionByName(
            {
              name: payload.workflowName
            },
            payload.projectCode
          )
          const latestMeta = extractWorkflowDefinitionMeta(latest)
          state.latestWorkflowCode = latestMeta?.code || null
          state.latestWorkflowVersion = latestMeta?.version || 1
          state.latestWorkflowReleaseState = latestMeta?.releaseState || '-'
        }
        state.latestWorkflowName = payload.workflowName
        if (state.latestWorkflowCode) {
          await loadScheduleMeta(state.latestWorkflowCode)
        }
        window.$message.success('同步任务已保存为 DolphinScheduler 工作流定义。')
      } catch (err) {
        window.$message.error('保存同步任务失败，请检查当前项目和任务配置。')
        state.savingWorkflow = false
        return false
      }
      state.savingWorkflow = false
      return true
    }

    const handleEnsureScheduleDraft = async () => {
      const payload = await buildWorkflowPayload(true)
      if (!payload) return false
      if (state.latestWorkflowCode) {
        return true
      }

      state.savingWorkflow = true
      try {
        await verifyName(
          {
            name: payload.workflowName
          },
          payload.projectCode
        )
        await createWorkflowDefinition(
          {
            name: payload.workflowName,
            executionType: 'PARALLEL',
            description: payload.description,
            globalParams: '[]',
            timeout: 0,
            taskDefinitionJson: JSON.stringify([payload.taskDefinition]),
            taskRelationJson: JSON.stringify([payload.taskRelation]),
            locations: JSON.stringify([payload.location])
          },
          payload.projectCode
        )
        const latest = await queryWorkflowDefinitionByName(
          {
            name: payload.workflowName
          },
          payload.projectCode
        )
        const latestMeta = extractWorkflowDefinitionMeta(latest)
        state.latestWorkflowCode = latestMeta?.code || null
        state.latestWorkflowVersion = latestMeta?.version || 1
        state.latestWorkflowReleaseState = latestMeta?.releaseState || '-'
        state.latestWorkflowName = latestMeta?.name || payload.workflowName
        state.savingWorkflow = false
        return true
      } catch (err) {
        window.$message.error('创建调度草稿失败，请检查当前项目权限。')
        state.savingWorkflow = false
        return false
      }
    }

    const handleOpenScheduleModal = async () => {
      const projectCode = validateProjectSelection()
      if (!projectCode) return
      const saved = await handleEnsureScheduleDraft()
      if (!saved || !state.latestWorkflowCode) return
      const releasedWorkflow = await queryWorkflowDefinitionByCode(
        state.latestWorkflowCode,
        projectCode
      )
      state.latestWorkflowReleaseState =
        extractWorkflowReleaseState(releasedWorkflow) ||
        state.latestWorkflowReleaseState

      const scheduleRow = await loadScheduleMeta(state.latestWorkflowCode)
      state.scheduleModalType = scheduleRow?.id ? 'update' : 'create'
      state.scheduleModalState = state.latestWorkflowReleaseState || 'OFFLINE'
      state.scheduleModalRow = scheduleRow?.id
        ? {
            ...scheduleRow
          }
        : {
            code: state.latestWorkflowCode,
            warningGroupId: 0,
            workerGroup: 'default',
            tenantCode: 'default',
            environmentCode: null
          }
      state.scheduleModalVisible = true
    }

    const handleRunWorkflow = async () => {
      const validated = validateSyncDesign()
      if (!validated) {
        return
      }
      state.runningWorkflow = true
      state.latestRunStage = 'PREPARING'
      state.latestRunMessage = '保存中'
      state.latestSyncedRowCount = null
      state.latestSyncedRowCountLoading = false
      state.latestSyncedRowCountInstanceId = null
      try {
        const saved = await handleSaveWorkflow()
        if (!saved) {
          state.runningWorkflow = false
          return
        }
        if (!state.latestWorkflowCode) {
          window.$message.error('运行失败，未获取到工作流编码。')
          state.latestRunStage = 'FAILURE'
          state.latestRunMessage = '启动失败'
          state.runningWorkflow = false
          return
        }
        state.latestRunStage = 'STARTING'
        state.latestRunMessage = '提交中'
        await release(
          {
            name: state.latestWorkflowName,
            releaseState: 'ONLINE'
          },
          state.selectedProjectCode as number,
          state.latestWorkflowCode
        )
        const releasedWorkflow = await queryWorkflowDefinitionByCode(
          state.latestWorkflowCode,
          state.selectedProjectCode as number
        )
        state.latestWorkflowReleaseState =
          extractWorkflowReleaseState(releasedWorkflow) ||
          state.latestWorkflowReleaseState
        if (state.latestWorkflowReleaseState !== 'ONLINE') {
          window.$message.error('工作流未成功上线，请稍后重试。')
          state.latestRunStage = 'FAILURE'
          state.latestRunMessage = '上线失败'
          state.runningWorkflow = false
          return
        }
        if (state.executionMode === 'SCHEDULE') {
          const scheduleRow = await loadScheduleMeta(state.latestWorkflowCode)
          if (!scheduleRow?.id) {
            window.$message.error('当前还没有可启用的周期调度，请先完成调度配置。')
            state.latestRunStage = 'FAILURE'
            state.latestRunMessage = '调度未配置'
            state.runningWorkflow = false
            return
          }
          await online(state.selectedProjectCode as number, scheduleRow.id)
          state.latestScheduleId = scheduleRow.id
          state.latestScheduleSummary = `ONLINE / ${scheduleRow.crontab || '已配置'}`
          state.latestRunStage = 'SUCCESS'
          state.latestRunMessage = '调度已启用'
          window.$message.success('同步任务已保存并上线为周期调度。')
          state.runningWorkflow = false
          return
        }
        const businessTime = formatDateTime(Date.now())
        const result = await startWorkflowInstance(
          {
            workflowDefinitionCode: state.latestWorkflowCode,
            failureStrategy: 'CONTINUE',
            workflowInstancePriority: 'MEDIUM',
            scheduleTime: JSON.stringify({
              complementScheduleDateList: businessTime
            }),
            warningGroupId: 0,
            warningType: 'NONE',
            execType: 'START_PROCESS',
            runMode: 'RUN_MODE_SERIAL',
            workerGroup: 'default',
            environmentCode: -1,
            timeout: 0,
            startParams: '',
            version: state.latestWorkflowVersion,
            dryRun: 0
          },
          state.selectedProjectCode as number
        )
        const latestInstanceId = Array.isArray(result)
          ? Number(result[0])
          : Number(
              result?.id ||
                result?.workflowInstanceId ||
                result?.processInstanceId ||
                0
            )
        state.latestInstanceId = Number.isFinite(latestInstanceId) &&
          latestInstanceId > 0
          ? latestInstanceId
          : null
        state.latestInstanceName = state.latestInstanceId
          ? `${state.latestWorkflowName || 'sync_workflow'}-${state.latestInstanceId}`
          : ''
        if (!state.latestInstanceId && state.latestWorkflowCode) {
          state.latestInstanceId = await queryLatestWorkflowInstanceId(
            state.latestWorkflowCode
          )
        }
        if (state.latestInstanceId) {
          state.latestRunStage = 'MONITORING'
          state.latestRunMessage = '运行中'
          await startLatestInstancePolling(state.latestInstanceId)
          window.$message.success('同步实例已启动，正在当前页面展示运行进度。')
        } else {
          state.latestRunStage = 'FAILURE'
          state.latestRunMessage = '实例未返回'
          window.$message.success('同步实例已启动，可前往工作流实例页面查看进度。')
        }
      } catch (err) {
        state.latestRunStage = 'FAILURE'
        state.latestRunMessage = '执行失败'
        window.$message.error(extractErrorMessage(err, '执行失败，请检查工作流发布、调度或任务日志。'))
        state.runningWorkflow = false
        return
      }
      state.runningWorkflow = false
    }

    const sourceFieldColumns = computed<DataTableColumns<FieldDesignRow>>(() => [
      {
        title: '同步',
        key: 'sync',
        width: 84,
        titleAlign: 'center',
        renderHeader: () => (
          <NCheckbox
            checked={allFieldsChecked.value}
            indeterminate={someFieldsChecked.value}
            onUpdateChecked={(checked) => handleChooseAllMappings(checked)}
          />
        ),
        render: (row) => {
          return (
            <NCheckbox
              v-model:checked={row.sync}
              onUpdateChecked={(checked) =>
                handleToggleField(row.sourceColumn, checked)
              }
            />
          )
        }
      },
      {
        title: '源类型',
        key: 'sourceType',
        width: 140,
        render: (row) => (
          <span class={styles.typeText}>{row.sourceType || 'UNKNOWN'}</span>
        )
      },
      {
        title: '字段注释',
        key: 'sourceComment',
        minWidth: 220,
        render: (row) => (
          <span class={styles.commentText}>{row.sourceComment || '暂无注释'}</span>
        )
      },
      {
        title: '源字段',
        key: 'sourceColumn',
        minWidth: 240,
        render: (row) => (
          <div class={[styles.columnCell, styles.sourceColumnCell]}>
            <div
              class={[styles.mappingFieldHead, styles.sourceFieldHead]}
              onMouseup={() => {
                if (draggingMapping.value?.side === 'target') {
                  handleMapTargetToSource(draggingMapping.value.key, row.key)
                }
              }}
            >
              <div class={styles.columnName}>{row.sourceColumn}</div>
              <div
                class={[styles.mappingAnchor, styles.sourceMappingAnchor]}
                data-source-anchor={row.key}
                onMousedown={(event: MouseEvent) =>
                  handleStartMappingDrag('source', row.key, event)
                }
              />
            </div>
            <div class={styles.columnMeta}>
              {row.sourcePrimaryKey ? (
                <NTag size='small' bordered={false} type='warning'>
                  主键
                </NTag>
              ) : null}
              <NTag size='small' bordered={false} type={row.sourceNullable ? 'success' : 'error'}>
                {row.sourceNullable ? '可空' : '非空'}
              </NTag>
            </div>
          </div>
        )
      }
    ])

    const targetFieldColumns = computed<DataTableColumns<FieldDesignRow>>(() => [
      {
        title: '目标字段',
        key: 'targetColumnName',
        minWidth: 240,
        render: (row) => (
          <div class={styles.columnCell}>
            <div
              class={styles.mappingFieldHead}
              onMouseup={() => {
                if (draggingMapping.value?.side === 'source') {
                  handleMapSourceToTarget(draggingMapping.value.key, row.key)
                }
              }}
            >
              <div
                class={styles.mappingAnchor}
                data-target-anchor={row.key}
                onMousedown={(event: MouseEvent) =>
                  handleStartMappingDrag('target', row.key, event)
                }
                onMouseup={() => {
                  if (draggingMapping.value?.side === 'source') {
                    handleMapSourceToTarget(draggingMapping.value.key, row.key)
                  }
                }}
              />
              <div class={styles.columnName}>{row.targetColumn}</div>
            </div>
            <div class={styles.columnMeta}>
              <NTag size='small' bordered={false} type='info'>
                来自 {getMappedSourceLabel(row.key)}
              </NTag>
              {row.targetPrimaryKey ? (
                <NTag size='small' bordered={false} type='warning'>
                  主键
                </NTag>
              ) : null}
              <NTag size='small' bordered={false} type={row.targetNullable ? 'success' : 'error'}>
                {row.targetNullable ? '可空' : '非空'}
              </NTag>
            </div>
          </div>
        )
      },
      {
        title: '字段名',
        key: 'targetColumnInput',
        minWidth: 180,
        render: (row) => (
          <NInput
            value={row.targetColumn}
            placeholder='输入目标字段名'
            onUpdateValue={(value) =>
              handleTargetColumnNameChange(row.key, value)
            }
          />
        )
      },
      {
        title: '目标类型',
        key: 'targetType',
        width: 220,
        render: (row) => (
          <NSelect
            value={row.targetType}
            options={targetTypeOptions.value}
            placeholder='选择目标字段类型'
            filterable
            onUpdateValue={(value) =>
              handleTargetTypeChange(row.key, value)
            }
          />
        )
      },
      {
        title: '字段注释',
        key: 'targetComment',
        minWidth: 220,
        render: (row) => (
          <NInput
            value={row.targetComment}
            placeholder='输入目标字段注释'
            onUpdateValue={(value) => handleTargetCommentChange(row.key, value)}
          />
        )
      },
      {
        title: '主键',
        key: 'targetPrimaryKey',
        width: 90,
        render: (row) => (
          <NCheckbox
            checked={row.targetPrimaryKey}
            onUpdateChecked={(checked) =>
              handleTargetPrimaryKeyChange(row.key, checked)
            }
          />
        )
      },
      {
        title: '可空',
        key: 'targetNullable',
        width: 90,
        render: (row) => (
          <NCheckbox
            checked={row.targetNullable}
            onUpdateChecked={(checked) =>
              handleTargetNullableChange(row.key, checked)
            }
          />
        )
      }
    ])

    const latestInstanceTaskColumns = computed<DataTableColumns<WorkflowTaskProgressRow>>(() => [
      {
        title: '任务节点',
        key: 'name',
        minWidth: 220,
        render: (row) => (
          <button
            class={styles.taskLinkButton}
            type='button'
            onClick={() => openWorkflowInstanceDetail(state.latestInstanceId)}
          >
            {row.name}
          </button>
        )
      },
      {
        title: '状态',
        key: 'stateLabel',
        width: 120,
        render: (row) => (
          <NTag bordered={false} type={row.stateType}>
            {row.stateLabel}
          </NTag>
        )
      },
      {
        title: '开始时间',
        key: 'startTime',
        minWidth: 160,
        render: (row) => row.startTime || '-'
      },
      {
        title: '结束时间',
        key: 'endTime',
        minWidth: 160,
        render: (row) => row.endTime || '-'
      },
      {
        title: '执行机器',
        key: 'host',
        minWidth: 180
      }
    ])

    watch(
      () => state.source.datasourceId,
      async () => {
        resetEndpoint(state.source)
        state.fieldRows = []
        if (!state.source.datasourceId) return
        await loadDatabases(state.source)
      }
    )

    watch(
      () => state.target.datasourceId,
      async () => {
        resetEndpoint(state.target)
        if (!state.target.datasourceId) return
        await loadDatabases(state.target)
      }
    )

    watch(
      () => state.source.database,
      async () => {
        state.source.table = null
        state.source.tables = []
        state.source.columns = []
        state.fieldRows = []
        if (!state.source.database) return
        await loadTables(state.source)
      }
    )

    watch(
      () => state.target.database,
      async () => {
        state.target.table = null
        state.target.tables = []
        state.target.columns = []
        if (!state.target.database) return
        await loadTables(state.target)
      }
    )

    watch(
      () => state.source.table,
      async () => {
        state.source.columns = []
        state.fieldRows = []
        if (!state.source.table) return
        await loadColumns(state.source)
        if (!state.targetTableName) {
          state.targetTableName = state.source.table || ''
        }
      }
    )

    watch(
      () => state.target.table,
      async () => {
        state.target.columns = []
        if (!state.target.table) return
        await loadColumns(state.target)
        state.targetTableName = state.target.table || state.targetTableName
      }
    )

    watch(
      () => [
        state.source.datasourceId,
        state.source.database,
        state.source.table,
        state.target.datasourceId,
        state.target.database,
        state.target.table,
        state.targetTableName.trim()
      ],
      () => {
        if (!state.source.columns.length) {
          state.fieldRows = []
          return
        }
        refreshFieldRows()
      }
    )

    watch(
      () => [
        state.source.columns
          .map(
            (item) =>
              `${item.name}:${item.type}:${item.comment || ''}:${item.primaryKey}:${item.nullable}`
          )
          .join(','),
        state.target.columns
          .map(
            (item) =>
              `${item.name}:${item.type}:${item.comment || ''}:${item.primaryKey}:${item.nullable}`
          )
          .join(',')
      ],
      () => {
        if (!state.source.columns.length) return
        refreshFieldRows()
      }
    )

    onMounted(() => {
      loadDatasourceList()
      loadProjects()
    })

    return {
      state,
      sourceDatasourceOption,
      targetDatasourceOption,
      sourceDatabaseOptions,
      sourceTableOptions,
      targetDatabaseOptions,
      targetTableOptions,
      sourceColumnOptions,
      effectiveTargetColumns,
      targetTypeOptions,
      syncWarnings,
      summaryItems,
      stepItems,
      currentStepMeta,
      generatedConfig,
      effectiveConfigText,
      mappedCount,
      mappingWorkbenchRef,
      mappingLinePaths,
      mappingDraftPath,
      targetFieldRows,
      refreshMappingLayout,
      selectedSourceColumns,
      sourceFieldColumns,
      targetFieldColumns,
      latestInstanceTaskColumns,
      openWorkflowInstanceDetail,
      allFieldsChecked,
      someFieldsChecked,
      handleChooseAllMappings,
      handleInvertMappings,
      handleCopyConfig,
      handleOpenPreview,
      handleConfigEditorChange,
      handleResetConfigEditor,
      handleCreateTargetTable,
      handlePreviewTargetTable,
      handleSaveWorkflow,
      handleRunWorkflow,
      handleOpenScheduleModal,
      loadScheduleMeta,
      handlePrevStep,
      handleNextStep,
      handleJumpStep,
      validateStepOne,
      validateStepTwo
    }
  },
  render() {
    const datasourceSelectOptions = this.state.datasourceOptions
    let stepContent = null

    // 这里用单一分支而不是多个 && 并列分支，避免 Vue JSX 在同层复用节点时把上一步内容残留在页面里。
    if (this.state.currentStep === 1) {
      stepContent = (
        <div class={styles.stageStack} key='step-1'>
          <Card title='项目'>
            <div class={styles.projectStrip}>
              <div class={styles.fieldBlock}>
                <div class={styles.fieldLabel}>
                  归属项目
                  <span class={styles.requiredMark}>*</span>
                </div>
                <NSelect
                  value={this.state.selectedProjectCode}
                  options={this.state.projectOptions}
                  placeholder='选择项目'
                  style={{ width: '320px' }}
                  filterable
                  clearable
                  loading={this.state.loadingProjects}
                  onUpdateValue={(value) => {
                    this.state.selectedProjectCode = value
                  }}
                />
              </div>
            </div>
          </Card>

          <div class={styles.grid}>
            <Card title='源端'>
              <NSpin show={this.state.source.loading || this.state.loadingDatasources}>
                <div class={styles.endpointPanel}>
                  <div class={styles.endpointTopbar}>
                    <NTag bordered={false} type='info'>
                      {this.sourceDatasourceOption?.type || 'SOURCE'}
                    </NTag>
                    <div class={styles.endpointPath}>
                      {this.state.source.database && this.state.source.table
                        ? `${this.state.source.database}.${this.state.source.table}`
                        : '选择数据源、库、表'}
                    </div>
                  </div>
                  <div class={styles.formGrid}>
                    <div class={styles.fieldBlock}>
                      <div class={styles.fieldLabel}>数据源</div>
                      <NSelect
                        value={this.state.source.datasourceId}
                        options={datasourceSelectOptions}
                        placeholder='选择源数据源'
                        filterable
                        clearable
                        onUpdateValue={(value) => {
                          this.state.source.datasourceId = value
                        }}
                      />
                    </div>
                    <div class={styles.fieldBlock}>
                      <div class={styles.fieldLabel}>数据库</div>
                      <NSelect
                        value={this.state.source.database}
                        options={this.sourceDatabaseOptions}
                        placeholder='选择源库'
                        filterable
                        clearable
                        onUpdateValue={(value) => {
                          this.state.source.database = value
                        }}
                      />
                    </div>
                    <div class={[styles.fieldBlock, styles.fieldBlockSpan2]}>
                      <div class={styles.fieldLabel}>数据表</div>
                      <NSelect
                        value={this.state.source.table}
                        options={this.sourceTableOptions}
                        placeholder='选择源表'
                        filterable
                        clearable
                        onUpdateValue={(value) => {
                          this.state.source.table = value
                        }}
                      />
                    </div>
                  </div>
                </div>
              </NSpin>
            </Card>

            <Card title='目标端'>
              <NSpin show={this.state.target.loading || this.state.loadingDatasources}>
                <div class={styles.endpointPanel}>
                  <div class={styles.endpointTopbar}>
                    <NTag bordered={false} type='success'>
                      {this.targetDatasourceOption?.type || 'TARGET'}
                    </NTag>
                    <div class={styles.endpointPath}>
                      {this.state.targetSchemaName && this.state.targetTableName
                        ? `${this.state.targetSchemaName}.${this.state.targetTableName}`
                        : '确认目标库、Schema、表名'}
                    </div>
                  </div>
                  <div class={styles.formGrid}>
                    <div class={styles.fieldBlock}>
                      <div class={styles.fieldLabel}>数据源</div>
                      <NSelect
                        value={this.state.target.datasourceId}
                        options={datasourceSelectOptions}
                        placeholder='选择目标数据源'
                        filterable
                        clearable
                        onUpdateValue={(value) => {
                          this.state.target.datasourceId = value
                        }}
                      />
                    </div>
                    <div class={styles.fieldBlock}>
                      <div class={styles.fieldLabel}>数据库</div>
                      <NSelect
                        value={this.state.target.database}
                        options={this.targetDatabaseOptions}
                        placeholder='选择目标库'
                        filterable
                        clearable
                        onUpdateValue={(value) => {
                          this.state.target.database = value
                        }}
                      />
                    </div>
                    <div class={styles.fieldBlock}>
                      <div class={styles.fieldLabel}>参考表</div>
                      <NSelect
                        value={this.state.target.table}
                        options={this.targetTableOptions}
                        placeholder='可选'
                        filterable
                        clearable
                        onUpdateValue={(value) => {
                          this.state.target.table = value
                        }}
                      />
                    </div>
                    <div class={styles.fieldBlock}>
                      <div class={styles.fieldLabel}>Schema</div>
                      <NInput
                        value={this.state.targetSchemaName}
                        placeholder='public'
                        onUpdateValue={(value) => {
                          this.state.targetSchemaName = value
                        }}
                      />
                    </div>
                    <div class={[styles.fieldBlock, styles.fieldBlockSpan2]}>
                      <div class={styles.fieldLabel}>目标表名</div>
                      <NInput
                        value={this.state.targetTableName}
                        placeholder='输入目标表名称'
                        onUpdateValue={(value) => {
                          this.state.targetTableName = value
                        }}
                      />
                    </div>
                  </div>
                </div>
              </NSpin>
            </Card>
          </div>
        </div>
      )
    } else if (this.state.currentStep === 2) {
      stepContent = (
        <Card title='字段映射设计' key='step-2'>
          <div
            class={styles.mappingWorkbench}
            ref={(el) => {
              this.mappingWorkbenchRef = el as HTMLElement | null
            }}
          >
            <svg class={styles.mappingSvgLayer}>
              {this.mappingLinePaths.map((item) => (
                <path
                  key={item.key}
                  d={item.path}
                  class={item.active ? styles.mappingPathActive : styles.mappingPath}
                />
              ))}
              {this.mappingDraftPath ? (
                <path d={this.mappingDraftPath} class={styles.mappingPathDraft} />
              ) : null}
            </svg>
            <div class={styles.mappingPane}>
              <div class={styles.paneTitleBar}>
                <NThing>
                  {{
                    header: () => <div class={styles.paneTitle}>源字段区</div>,
                    description: () => (
                      <div class={styles.paneDesc}>
                        展示源字段名、类型、注释、主键和可空属性。勾选哪些字段，就同步哪些字段。
                      </div>
                    )
                  }}
                </NThing>
                <div class={styles.paneStats}>
                  <NTag type='info' bordered={false}>
                    {this.state.source.table || '未选择源表'}
                  </NTag>
                  <NTag bordered={false}>共 {this.state.fieldRows.length} 列</NTag>
                </div>
              </div>
              <div class={styles.fieldToolbar}>
                <NButton
                  size='small'
                  onClick={() => this.handleChooseAllMappings(true)}
                >
                  全选字段
                </NButton>
                <NButton size='small' onClick={this.handleInvertMappings}>
                  反选字段
                </NButton>
                <NButton
                  size='small'
                  onClick={() => this.handleChooseAllMappings(false)}
                >
                  清空选择
                </NButton>
              </div>
              <div class={styles.scrollTable} onScroll={this.refreshMappingLayout}>
                <NDataTable
                  columns={this.sourceFieldColumns}
                  data={this.state.fieldRows}
                  row-key={(row: FieldDesignRow) => row.key}
                  size='small'
                  pagination={false}
                  striped
                />
              </div>
            </div>

            <div class={styles.mappingPane}>
              <div class={styles.paneTitleBar}>
                <NThing>
                  {{
                    header: () => <div class={styles.paneTitle}>目标字段设计区</div>,
                    description: () => (
                      <div class={styles.paneDesc}>
                        承接连线映射结果，并允许继续调整目标字段名、类型、注释、主键和可空属性。
                      </div>
                    )
                  }}
                </NThing>
                <div class={styles.paneStats}>
                  <NTag type='success' bordered={false}>
                    {this.state.targetTableName || '未确认目标表'}
                  </NTag>
                  <NTag bordered={false}>已选 {this.mappedCount} 列</NTag>
                </div>
              </div>
              <div class={styles.scrollTable} onScroll={this.refreshMappingLayout}>
                {this.targetFieldRows.length ? (
                  <NDataTable
                    columns={this.targetFieldColumns}
                    data={this.targetFieldRows}
                    row-key={(row: FieldDesignRow) => row.key}
                    size='small'
                    pagination={false}
                    striped
                  />
                ) : (
                  <div class={styles.emptyPanel}>
                    <NEmpty description='左侧还没有勾选任何源字段，勾选后这里会自动生成目标字段设计。' />
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      )
    } else if (this.state.currentStep === 3) {
      stepContent = (
        <div class={styles.stageStack} key='step-3'>
          <Card title='执行方式'>
            <NDescriptions columns={4} labelPlacement='left' bordered size='small'>
              <NDescriptionsItem label='执行方式'>
                <NRadioGroup
                  value={this.state.executionMode}
                  onUpdateValue={(value: ExecutionMode) => {
                    this.state.executionMode = value
                  }}
                >
                  <NSpace>
                    <NRadioButton value='IMMEDIATE'>立即执行</NRadioButton>
                    <NRadioButton value='SCHEDULE'>周期调度</NRadioButton>
                  </NSpace>
                </NRadioGroup>
              </NDescriptionsItem>
              <NDescriptionsItem label='目标 Schema'>
                {this.state.targetSchemaName || 'public'}
              </NDescriptionsItem>
              <NDescriptionsItem label='工作流编码'>
                {this.state.latestWorkflowCode || '-'}
              </NDescriptionsItem>
              <NDescriptionsItem label='工作流状态'>
                {this.state.latestWorkflowReleaseState || '-'}
              </NDescriptionsItem>
            </NDescriptions>

            {this.state.executionMode === 'SCHEDULE' && (
              <div class={styles.schedulePanelWrap}>
                <div class={styles.schedulePanel}>
                  <div>
                    <div class={styles.scheduleTitle}>周期调度配置</div>
                    <div class={styles.hintText}>
                      这里复用同步任务专用的定时弹框，布局和原生工作流“定时”保持一致，但不再改动 Dolphin 原生页面。
                    </div>
                  </div>
                  <NSpace>
                    <NTag bordered={false} type='info'>
                      {this.state.latestScheduleSummary}
                    </NTag>
                    <NButton type='primary' ghost onClick={this.handleOpenScheduleModal}>
                      配置周期调度
                    </NButton>
                  </NSpace>
                </div>
                <div class={styles.hintText}>
                  周期调度的配置入口不再和字段设计耦合。只要项目已选择，就可以先打开调度弹框进行配置。
                </div>
              </div>
            )}
          </Card>

          <Card title='发布前动作'>
            <div class={styles.actionGrid}>
              <div class={styles.actionPanel}>
                <div class={styles.sectionTitle}>目标端建表</div>
                <div class={styles.hintText}>
                  先生成建表语句并审阅，再确认真正下发到目标端。这种方式更接近成熟数据集成产品的“预览后执行”流程。
                </div>
                <NSpace>
                  <NButton
                    ghost
                    loading={this.state.previewingTableDdl}
                    onClick={this.handlePreviewTargetTable}
                  >
                    生成建表语句
                  </NButton>
                  <NButton
                    type='primary'
                    loading={this.state.creatingTable}
                    onClick={this.handleCreateTargetTable}
                  >
                    确认建表
                  </NButton>
                </NSpace>
                <div class={styles.ddlPanel}>
                  <div class={styles.ddlHeader}>
                    <div class={styles.sectionTitle}>目标端建表语句</div>
                    <div class={styles.hintText}>
                      支持你按需调整字段类型、主键或表名后再执行。
                    </div>
                  </div>
                  <NInput
                    type='textarea'
                    autosize={{
                      minRows: 8,
                      maxRows: 16
                    }}
                    value={this.state.latestCreateTableDdl}
                    placeholder='点击“生成建表语句”后，这里会展示可编辑的 DDL。'
                    onUpdateValue={(value) => {
                      this.state.latestCreateTableDdl = value
                    }}
                  />
                </div>
              </div>
              <div class={styles.actionPanel}>
                <div class={styles.sectionTitle}>保存工作流草稿</div>
                <div class={styles.hintText}>
                  如果你希望先把同步任务保存到 DolphinScheduler，再稍后运行，可以先执行保存动作。
                </div>
                <NButton
                  type='primary'
                  ghost
                  loading={this.state.savingWorkflow}
                  onClick={this.handleSaveWorkflow}
                >
                  保存同步任务
                </NButton>
              </div>
            </div>
          </Card>
        </div>
      )
    } else {
      stepContent = (
        <div class={styles.stageStack} key='step-4'>
          <Card title='同步概览' contentClass={styles.overviewCardContent}>
            <div class={styles.overviewSummaryGrid}>
              {this.summaryItems.map((item) => (
                <div class={styles.overviewSummaryItem} key={item.label}>
                  <div class={styles.overviewSummaryLabel}>{item.label}</div>
                  <div class={styles.overviewSummaryValue}>{item.value}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card title='保存与运行'>
            <div class={styles.publishBar}>
              <div class={styles.sectionTitle}>发布</div>
              <NSpace>
                <NButton
                  type='primary'
                  ghost
                  loading={this.state.savingWorkflow}
                  onClick={this.handleSaveWorkflow}
                >
                  保存同步任务
                </NButton>
                <NButton
                  type='primary'
                  loading={this.state.runningWorkflow}
                  onClick={this.handleRunWorkflow}
                >
                  {this.state.executionMode === 'SCHEDULE'
                    ? '保存并启用调度'
                    : '保存并执行'}
                </NButton>
              </NSpace>
            </div>
            <div class={styles.resultPanel} style={{ marginTop: '14px' }}>
              <div class={styles.sectionTitle}>提交与运行状态</div>
              <NSpace style={{ marginTop: '12px' }}>
                <NTag bordered={false} type='info'>
                  {RUN_PROGRESS_LABELS[this.state.latestRunStage]}
                </NTag>
                {this.state.latestInstanceId ? (
                  <NTag bordered={false} type={this.state.latestInstanceStateType}>
                    实例状态：{this.state.latestInstanceStateLabel}
                  </NTag>
                ) : null}
                {this.state.latestWorkflowCode ? (
                  <NTag bordered={false}>
                    工作流编码：{this.state.latestWorkflowCode}
                  </NTag>
                ) : null}
              </NSpace>
              <div class={styles.hintText} style={{ marginTop: '10px' }}>
                {this.state.latestRunMessage}
              </div>
              {this.state.latestInstanceId ? (
                <div class={styles.summaryGrid} style={{ marginTop: '14px' }}>
                  <div class={styles.summaryItem}>
                    <div class={styles.summaryLabel}>实例 ID</div>
                    <div class={styles.summaryValue}>{this.state.latestInstanceId}</div>
                  </div>
                  <div class={styles.summaryItem}>
                    <div class={styles.summaryLabel}>开始时间</div>
                    <div class={styles.summaryValue}>
                      {this.state.latestInstanceStartTime || '-'}
                    </div>
                  </div>
                  <div class={styles.summaryItem}>
                    <div class={styles.summaryLabel}>成功节点</div>
                    <div class={styles.summaryValue}>{this.state.latestInstanceTaskSuccess}</div>
                  </div>
                  <div class={styles.summaryItem}>
                    <div class={styles.summaryLabel}>运行中 / 失败</div>
                    <div class={styles.summaryValue}>
                      {this.state.latestInstanceTaskRunning} / {this.state.latestInstanceTaskFailed}
                    </div>
                  </div>
                  <div class={styles.summaryItem}>
                    <div class={styles.summaryLabel}>同步数据量</div>
                    <div class={styles.summaryValue}>
                      {this.state.latestSyncedRowCountLoading
                        ? '统计中'
                        : this.state.latestSyncedRowCount !== null
                          ? `${this.state.latestSyncedRowCount} 行`
                          : '-'}
                    </div>
                  </div>
                </div>
              ) : null}
              {this.state.latestInstanceTaskRows.length ? (
                <div style={{ marginTop: '14px' }}>
                  <NDataTable
                    columns={this.latestInstanceTaskColumns}
                    data={this.state.latestInstanceTaskRows}
                    row-key={(row: WorkflowTaskProgressRow) => row.key}
                    size='small'
                    pagination={false}
                    striped
                  />
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      )
    }

    return (
      <NSpace vertical class={styles.page}>
        <div class={styles.pageHeader}>
          <div class={styles.heroBlock}>
            <h2 class={styles.heroTitle}>同步任务</h2>
          </div>
          <div class={styles.heroActions}>
            <NButton type='primary' ghost onClick={this.handleOpenPreview}>
              查看配置预览
            </NButton>
          </div>
        </div>

        <Card title='执行步骤' contentClass={styles.stepsCard}>
          <div class={styles.stepRail}>
            <NSteps current={this.state.currentStep} status='process'>
              {this.stepItems.map((item) => (
                <NStep key={item.index} title={item.title} />
              ))}
            </NSteps>
          </div>
        </Card>

        <div class={styles.wizardMain}>
          <div key={`stage-${this.state.currentStep}`}>
            {stepContent}
          </div>

          <div class={styles.wizardFooterBar}>
            <div class={styles.wizardFooter}>
              <NButton
                disabled={this.state.currentStep === 1}
                onClick={this.handlePrevStep}
              >
                上一步
              </NButton>
              <NSpace>
                <NButton
                  type='primary'
                  disabled={this.state.currentStep === 4}
                  onClick={this.handleNextStep}
                >
                  下一步
                </NButton>
              </NSpace>
            </div>
          </div>
        </div>

        {!this.state.datasourceOptions.length && !this.state.loadingDatasources ? (
          <Card>
            <NEmpty description='当前未发现可用的 MySQL / PostgreSQL 数据源，请先在源中心创建。' />
          </Card>
        ) : null}

        <NDrawer
          show={this.state.previewVisible}
          placement='right'
          width='40vw'
          minWidth={520}
          onUpdateShow={(value) => {
            this.state.previewVisible = value
          }}
        >
          <NDrawerContent title='SeaTunnel 配置预览' closable>
            <NSpace vertical>
              {this.syncWarnings.length ? (
                <div class={styles.warningList}>
                  {this.syncWarnings.map((item) => (
                    <NAlert type='warning' showIcon={false}>
                      {item}
                    </NAlert>
                  ))}
                </div>
              ) : null}
              <NSpace justify='space-between'>
                <div>
                  <span class={styles.sectionTitle}>自动生成结果</span>
                  <span class={styles.sectionHint}>
                    支持在这里直接修正配置，保存工作流和运行时都会优先使用这里的内容
                  </span>
                </div>
                <NSpace>
                  <NButton size='small' onClick={this.handleResetConfigEditor}>
                    恢复自动生成
                  </NButton>
                  <NButton
                    type='primary'
                    size='small'
                    onClick={this.handleCopyConfig}
                  >
                    复制配置
                  </NButton>
                </NSpace>
              </NSpace>
              <div class={styles.codeWrap}>
                <NInput
                  type='textarea'
                  autosize={{
                    minRows: 18,
                    maxRows: 28
                  }}
                  value={this.effectiveConfigText}
                  onUpdateValue={this.handleConfigEditorChange}
                />
              </div>
            </NSpace>
          </NDrawerContent>
        </NDrawer>

        <TimingModal
          v-model:row={this.state.scheduleModalRow}
          v-model:show={this.state.scheduleModalVisible}
          v-model:type={this.state.scheduleModalType}
          v-model:state={this.state.scheduleModalState}
          projectCode={this.state.selectedProjectCode}
          onUpdateList={async () => {
            if (this.state.latestWorkflowCode) {
              await this.loadScheduleMeta(this.state.latestWorkflowCode)
            }
          }}
        />
      </NSpace>
    )
  }
})

export default syncTask
