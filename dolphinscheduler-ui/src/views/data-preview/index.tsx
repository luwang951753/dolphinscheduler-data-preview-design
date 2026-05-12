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

import { computed, defineComponent, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { DataTableColumns, SelectOption } from 'naive-ui'
import {
  NAlert,
  NButton,
  NCheckbox,
  NDataTable,
  NDivider,
  NEmpty,
  NIcon,
  NInput,
  NSelect,
  NSpace,
  NSpin,
  NTag,
  NTooltip
} from 'naive-ui'
import {
  CopyOutlined,
  FilterOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SortAscendingOutlined
} from '@vicons/antd'
import {
  getDatasourceDatabasesById,
  getDatasourceTableColumnMetasById,
  getDatasourceTablesById,
  createDataPreviewView,
  deleteDataPreviewView,
  previewDatasourceTableData,
  queryDataPreviewViews,
  queryDataSourceList,
  updateDataPreviewView
} from '@/service/modules/data-source'
import type {
  IDataPreviewQueryRequest,
  IDataPreviewQueryResult,
  IDataPreviewSort,
  IDataPreviewViewResponse,
  IDatasourceColumnMeta
} from '@/service/modules/data-source/types'
import styles from './index.module.scss'

type SupportedDatasourceType = 'MYSQL' | 'POSTGRESQL'
type FilterOperator = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'CONTAINS'
type ActivePanel = 'columns' | 'filters' | 'sorts' | 'joins' | null
type JoinMode = 'manual' | 'lookup'

interface DatasourceOption extends SelectOption {
  value: number
  label: string
  type: SupportedDatasourceType
  defaultDatabase?: string
}

interface DatasourceRecord {
  id: number
  name: string
  type: SupportedDatasourceType
  connectionParams?: string
  database?: string
}

interface FilterRow {
  id: number
  field: string | null
  operator: FilterOperator
  value: string
}

interface SortRow {
  id: number
  field: string | null
  direction: 'ASC' | 'DESC'
}

interface OpenedTab {
  key: string
  datasourceId: number
  database: string
  tableName: string
}

interface JoinConfig {
  id: number
  table: 'dept_dict' | 'region_dict'
  mainField: string | null
  targetField: string
  type: 'LEFT' | 'INNER'
  visibleFields: string[]
}

interface ViewConfig {
  columnOrder: string[]
  visibleColumnKeys: string[]
  filters: FilterRow[]
  sorts: SortRow[]
  pageSize: number
  joinApplied: boolean
  joinConfigs: JoinConfig[]
}

interface SavedView {
  id: string
  name: string
  config: ViewConfig
  isDefault?: boolean
  backendId?: number
}

interface CellMenuState {
  visible: boolean
  x: number
  y: number
  row: Record<string, any> | null
  field: string
  value: unknown
}

const SUPPORTED_TYPES: SupportedDatasourceType[] = ['MYSQL', 'POSTGRESQL']
const PAGE_SIZE_OPTIONS = [20, 50, 100, 200]
const FILTER_OPERATOR_OPTIONS: Array<{ label: string; value: FilterOperator }> = [
  { label: '等于', value: '=' },
  { label: '不等于', value: '!=' },
  { label: '大于', value: '>' },
  { label: '大于等于', value: '>=' },
  { label: '小于', value: '<' },
  { label: '小于等于', value: '<=' },
  { label: '包含', value: 'CONTAINS' }
]
const SORT_DIRECTION_OPTIONS: Array<{ label: string; value: 'ASC' | 'DESC' }> = [
  { label: '升序', value: 'ASC' },
  { label: '降序', value: 'DESC' }
]
const JOIN_TABLE_OPTIONS = [
  { label: 'dept_dict（部门字典表）', value: 'dept_dict' },
  { label: 'region_dict（区域字典表）', value: 'region_dict' }
]
const JOIN_TYPE_OPTIONS = [
  { label: '左连接 LEFT JOIN', value: 'LEFT' },
  { label: '内连接 INNER JOIN', value: 'INNER' }
]
const JOIN_FIELD_METAS: Record<string, IDatasourceColumnMeta> = {
  'dept_dict.dept_code': {
    name: 'dept_dict.dept_code',
    type: 'varchar',
    nullable: true,
    primaryKey: false,
    comment: '部门编码'
  },
  'dept_dict.dept_manager': {
    name: 'dept_dict.dept_manager',
    type: 'varchar',
    nullable: true,
    primaryKey: false,
    comment: '部门负责人'
  },
  'region_dict.region_level': {
    name: 'region_dict.region_level',
    type: 'varchar',
    nullable: true,
    primaryKey: false,
    comment: '区域等级'
  },
  'region_dict.area_manager': {
    name: 'region_dict.area_manager',
    type: 'varchar',
    nullable: true,
    primaryKey: false,
    comment: '区域负责人'
  }
}
const JOIN_TABLE_FIELD_OPTIONS: Record<JoinConfig['table'], string[]> = {
  dept_dict: ['dept_dict.dept_code', 'dept_dict.dept_manager'],
  region_dict: ['region_dict.region_level', 'region_dict.area_manager']
}
const DEPT_DICT: Record<string, Record<string, string>> = {
  '数据治理一组': { dept_code: 'DG-001', dept_manager: '周敏' },
  '同步平台组': { dept_code: 'SYNC-002', dept_manager: '陈远' },
  '客户数据组': { dept_code: 'CD-003', dept_manager: '李倩' },
  '平台运维组': { dept_code: 'OPS-004', dept_manager: '王磊' }
}
const REGION_DICT: Record<string, Record<string, string>> = {
  杭州: { region_level: '核心城市', area_manager: '林舟' },
  上海: { region_level: '核心城市', area_manager: '许宁' },
  南京: { region_level: '重点城市', area_manager: '马岩' },
  深圳: { region_level: '核心城市', area_manager: '罗晨' },
  北京: { region_level: '核心城市', area_manager: '韩旭' },
  广州: { region_level: '核心城市', area_manager: '唐佳' }
}

const normalizeList = (payload: unknown): Array<Record<string, any>> => {
  return Array.isArray(payload) ? (payload as Array<Record<string, any>>) : []
}

const normalizeTextList = (payload: unknown): string[] => {
  return normalizeList(payload)
    .map((item) => {
      if (typeof item === 'string') {
        return item
      }
      if (typeof item?.value === 'string') {
        return item.value
      }
      if (typeof item?.label === 'string') {
        return item.label
      }
      return ''
    })
    .filter(Boolean) as string[]
}

const parseDatasourceDefaultDatabase = (item: DatasourceRecord) => {
  if (item.database) {
    return item.database
  }
  if (!item.connectionParams) {
    return undefined
  }
  try {
    const params = JSON.parse(item.connectionParams) as { database?: string }
    return params.database
  } catch (error) {
    return undefined
  }
}

const normalizeColumns = (payload: unknown): IDatasourceColumnMeta[] => {
  return normalizeList(payload).map((item) => ({
    name: item.name || '',
    type: item.type || '',
    nullable: !!item.nullable,
    primaryKey: !!item.primaryKey,
    comment: item.comment || ''
  }))
}

const createRowId = () => Date.now() + Math.floor(Math.random() * 100000)
const cloneFilter = (item: FilterRow): FilterRow => ({ ...item, id: createRowId() })
const cloneSort = (item: SortRow): SortRow => ({ ...item, id: createRowId() })
const cloneJoin = (item: JoinConfig): JoinConfig => ({
  ...item,
  id: createRowId(),
  visibleFields: [...item.visibleFields]
})

const quoteIdentifier = (dbType: SupportedDatasourceType, identifier: string) => {
  return dbType === 'MYSQL' ? `\`${identifier}\`` : `"${identifier}"`
}

const formatCellValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

export default defineComponent({
  name: 'data-preview',
  setup() {
    const draggingColumnName = ref<string | null>(null)
    const sidebarDragging = ref(false)
    const sidebarLayoutLeft = ref(0)

    const state = reactive({
      loadingDatasources: false,
      loadingDatabases: false,
      loadingTables: false,
      loadingColumns: false,
      loadingPreview: false,
      datasourceOptions: [] as DatasourceOption[],
      datasourceId: null as number | null,
      selectedDatasourceType: null as SupportedDatasourceType | null,
      databaseOptions: [] as string[],
      database: null as string | null,
      tables: [] as string[],
      tableSearch: '',
      tableSectionExpanded: true,
      datasourceSectionExpanded: true,
      databaseSectionExpanded: true,
      viewSectionExpanded: false,
      sidebarWidth: 288,
      sidebarCollapsed: false,
      selectedTable: null as string | null,
      openedTabs: [] as OpenedTab[],
      recentTables: [] as string[],
      columns: [] as IDatasourceColumnMeta[],
      columnOrder: [] as string[],
      visibleColumnKeys: [] as string[],
      columnKeyword: '',
      filters: [] as FilterRow[],
      sorts: [] as SortRow[],
      joinMode: 'manual' as JoinMode,
      joinConfigs: [
        {
          id: 1,
          table: 'dept_dict',
          mainField: 'owner_dept',
          targetField: 'dept_name',
          type: 'LEFT',
          visibleFields: ['dept_dict.dept_code', 'dept_dict.dept_manager']
        }
      ] as JoinConfig[],
      joinApplied: false,
      savedViews: [] as SavedView[],
      activeViewId: 'default',
      viewDirty: false,
      viewMenuOpen: false,
      viewNameDraft: '',
      viewLoading: false,
      viewSaving: false,
      selectedCellKey: '',
      cellDetailVisible: false,
      cellDetailTitle: '',
      cellDetailValue: '',
      cellMenu: {
        visible: false,
        x: 0,
        y: 0,
        row: null,
        field: '',
        value: ''
      } as CellMenuState,
      rows: [] as Array<Record<string, any>>,
      pageNo: 1,
      pageSize: 50,
      rowCount: 0,
      executedAt: '',
      elapsedMs: 0,
      previewError: '',
      warnings: [] as string[],
      activePanel: null as ActivePanel
    })

    const datasourceSelectOptions = computed(() => state.datasourceOptions)
    const databaseSelectOptions = computed(() =>
      state.databaseOptions.map((item) => ({
        label: item,
        value: item
      }))
    )
    const columnSelectOptions = computed(() =>
      state.columns.map((item) => ({
        label: item.name,
        value: item.name
      }))
    )
    const pageSizeSelectOptions = computed(() =>
      PAGE_SIZE_OPTIONS.map((item) => ({
        label: `${item} 行`,
        value: item
      }))
    )
    const filteredTables = computed(() => {
      const keyword = state.tableSearch.trim().toLowerCase()
      if (!keyword) {
        return state.tables
      }
      return state.tables.filter((item) => item.toLowerCase().includes(keyword))
    })
    const recentTableList = computed(() => state.recentTables.filter((item) => state.tables.includes(item)))
    const orderedColumns = computed(() => {
      const columnMap = new Map(state.columns.map((item) => [item.name, item]))
      return state.columnOrder
        .map((name) => columnMap.get(name))
        .filter(Boolean) as IDatasourceColumnMeta[]
    })
    const filteredColumnList = computed(() => {
      const keyword = state.columnKeyword.trim().toLowerCase()
      if (!keyword) {
        return orderedColumns.value
      }
      return orderedColumns.value.filter((item) => {
        return (
          item.name.toLowerCase().includes(keyword) ||
          (item.comment || '').toLowerCase().includes(keyword)
        )
      })
    })
    const visibleColumns = computed(() => {
      const visibleSet = new Set(state.visibleColumnKeys)
      return orderedColumns.value.filter((item) => visibleSet.has(item.name))
    })
    const appliedJoinColumns = computed(() => {
      if (!state.joinApplied) {
        return [] as IDatasourceColumnMeta[]
      }
      const keys = state.joinConfigs.flatMap((item) => item.visibleFields)
      return keys
        .map((key) => JOIN_FIELD_METAS[key])
        .filter(Boolean) as IDatasourceColumnMeta[]
    })
    const displayColumns = computed(() => [...visibleColumns.value, ...appliedJoinColumns.value])
    const selectedDatasource = computed(() =>
      state.datasourceOptions.find((item) => item.value === state.datasourceId) || null
    )
    const selectedTableKey = computed(() => {
      if (!state.datasourceId || !state.database || !state.selectedTable) {
        return ''
      }
      return `${state.datasourceId}:${state.database}:${state.selectedTable}`
    })
    const activeView = computed(() =>
      state.savedViews.find((item) => item.id === state.activeViewId) || state.savedViews[0] || null
    )
    const viewSelectOptions = computed(() =>
      state.savedViews.map((item) => ({
        label: item.name,
        value: item.id
      }))
    )
    const whereSummary = computed(() => {
      const filters = state.filters
        .filter((item) => item.field && item.value.trim())
        .map((item) => {
          const operatorText =
            item.operator === 'CONTAINS'
              ? '包含'
              : item.operator
          return `${item.field} ${operatorText} ${item.value}`
        })
      return filters.length ? filters.join(' AND ') : '未设置筛选条件'
    })
    const orderSummary = computed(() => {
      const sorts = state.sorts
        .filter((item) => item.field)
        .map((item) => `${item.field} ${item.direction}`)
      return sorts.length ? sorts.join(', ') : '未设置排序'
    })
    const sqlPreview = computed(() => {
      if (!state.datasourceId || !state.database || !state.selectedTable || !state.selectedDatasourceType) {
        return '-- 请选择数据源、数据库和表后生成 SQL 预览'
      }
      const fields = displayColumns.value.length
        ? displayColumns.value.map((item) => quoteIdentifier(state.selectedDatasourceType!, item.name))
        : ['*']
      const whereParts = state.filters
        .filter((item) => item.field && item.value.trim())
        .map((item) => {
          if (item.operator === 'CONTAINS') {
            return `${quoteIdentifier(state.selectedDatasourceType!, item.field!)} LIKE '%${item.value}%'`
          }
          return `${quoteIdentifier(state.selectedDatasourceType!, item.field!)} ${item.operator} '${item.value}'`
        })
      const orderParts = state.sorts
        .filter((item) => item.field)
        .map((item) => `${quoteIdentifier(state.selectedDatasourceType!, item.field!)} ${item.direction}`)

      const lines = [
        `SELECT ${fields.join(', ')}`,
        `FROM ${quoteIdentifier(state.selectedDatasourceType!, state.database)}.${quoteIdentifier(
          state.selectedDatasourceType!,
          state.selectedTable
        )}`
      ]
      if (whereParts.length) {
        lines.push(`WHERE ${whereParts.join(' AND ')}`)
      }
      if (state.joinApplied) {
        state.joinConfigs.forEach((join) => {
          lines.push(
            `${join.type} JOIN ${join.table} ON ${state.selectedTable}.${join.mainField || '字段'} = ${join.table}.${join.targetField}`
          )
        })
      }
      if (orderParts.length) {
        lines.push(`ORDER BY ${orderParts.join(', ')}`)
      }
      lines.push(`LIMIT ${state.pageSize} OFFSET ${(state.pageNo - 1) * state.pageSize}`)
      return lines.join('\n')
    })

    const createViewConfig = (): ViewConfig => ({
      columnOrder: [...state.columnOrder],
      visibleColumnKeys: [...state.visibleColumnKeys],
      filters: state.filters.map(cloneFilter),
      sorts: state.sorts.map(cloneSort),
      pageSize: state.pageSize,
      joinApplied: state.joinApplied,
      joinConfigs: state.joinConfigs.map(cloneJoin)
    })

    const applyViewConfig = async (config: ViewConfig) => {
      state.columnOrder = (config.columnOrder || []).filter((item) =>
        state.columns.some((column) => column.name === item)
      )
      const missingColumns = state.columns
        .map((item) => item.name)
        .filter((item) => !state.columnOrder.includes(item))
      state.columnOrder = [...state.columnOrder, ...missingColumns]
      state.visibleColumnKeys = (config.visibleColumnKeys || []).filter((item) =>
        state.columnOrder.includes(item)
      )
      state.filters = (config.filters || []).map(cloneFilter)
      state.sorts = (config.sorts || []).map(cloneSort)
      state.pageSize = PAGE_SIZE_OPTIONS.includes(config.pageSize) ? config.pageSize : state.pageSize
      state.joinApplied = !!config.joinApplied
      state.joinConfigs = (config.joinConfigs || []).map(cloneJoin)
      state.viewDirty = false
      await runPreview(1)
    }

    const toSavedView = (item: IDataPreviewViewResponse): SavedView | null => {
      try {
        return {
          id: `remote-${item.id}`,
          backendId: item.id,
          name: item.viewName,
          config: JSON.parse(item.viewConfig) as ViewConfig
        }
      } catch (error) {
        return null
      }
    }

    const buildViewRequest = (viewName?: string) => ({
      datasourceId: state.datasourceId!,
      database: state.database!,
      tableName: state.selectedTable!,
      viewName,
      viewConfig: JSON.stringify(createViewConfig())
    })

    const loadSavedViews = async () => {
      if (!state.datasourceId || !state.database || !state.selectedTable) {
        return
      }
      const defaultView = state.savedViews.find((item) => item.id === 'default')
      if (!defaultView) {
        return
      }
      state.viewLoading = true
      try {
        const res = await queryDataPreviewViews({
          datasourceId: state.datasourceId,
          database: state.database,
          tableName: state.selectedTable
        })
        const remoteViews = normalizeList(res)
          .map((item) => toSavedView(item as unknown as IDataPreviewViewResponse))
          .filter(Boolean) as SavedView[]
        state.savedViews = [defaultView, ...remoteViews]
        state.activeViewId = 'default'
        state.viewDirty = false
      } catch (error) {
        state.savedViews = [defaultView]
        state.activeViewId = 'default'
        state.viewDirty = false
        window.$message.warning('个人视图加载失败，当前仍可使用默认视图查数。')
      } finally {
        state.viewLoading = false
      }
    }

    const markViewDirty = () => {
      state.viewDirty = true
    }

    const resetTableState = () => {
      state.tables = []
      state.selectedTable = null
      state.openedTabs = []
      state.recentTables = []
      state.columns = []
      state.columnOrder = []
      state.visibleColumnKeys = []
      state.rows = []
      state.rowCount = 0
      state.executedAt = ''
      state.elapsedMs = 0
      state.previewError = ''
      state.warnings = []
      state.filters = []
      state.sorts = []
      state.joinApplied = false
      state.savedViews = []
      state.activeViewId = 'default'
      state.viewDirty = false
      state.viewNameDraft = ''
      state.pageNo = 1
    }

    const loadDatasourceList = async () => {
      if (state.loadingDatasources) {
        return
      }
      state.loadingDatasources = true
      try {
        const [mysqlList, postgresqlList] = await Promise.all([
          queryDataSourceList({ type: 'MYSQL' }),
          queryDataSourceList({ type: 'POSTGRESQL' })
        ])
        const list = [...normalizeList(mysqlList), ...normalizeList(postgresqlList)] as DatasourceRecord[]
        state.datasourceOptions = list
          .filter((item) => SUPPORTED_TYPES.includes(item.type))
          .map((item) => ({
            label: `${item.name} (${item.type})`,
            value: item.id,
            type: item.type,
            defaultDatabase: parseDatasourceDefaultDatabase(item)
          }))
      } catch (error) {
        window.$message.error('读取数据源列表失败，请先确认源中心连接配置。')
      } finally {
        state.loadingDatasources = false
      }
    }

    const loadDatabases = async () => {
      if (!state.datasourceId) {
        return
      }
      state.loadingDatabases = true
      try {
        const res = await getDatasourceDatabasesById(state.datasourceId)
        state.databaseOptions = normalizeTextList(res)
        const preferredDatabase = selectedDatasource.value?.defaultDatabase
        state.database =
          preferredDatabase && state.databaseOptions.includes(preferredDatabase)
            ? preferredDatabase
            : state.databaseOptions[0] || null
      } catch (error) {
        state.databaseOptions = []
        state.database = null
        window.$message.error('读取数据库列表失败，请检查当前数据源是否可连接。')
      } finally {
        state.loadingDatabases = false
      }
    }

    const loadTables = async () => {
      if (!state.datasourceId || !state.database) {
        return
      }
      state.loadingTables = true
      try {
        const res = await getDatasourceTablesById(state.datasourceId, state.database)
        state.tables = normalizeTextList(res)
        state.selectedTable = state.tables[0] || null
        if (state.datasourceId && state.database && state.selectedTable) {
          state.recentTables = [state.selectedTable]
          state.openedTabs = [
            {
              key: `${state.datasourceId}:${state.database}:${state.selectedTable}`,
              datasourceId: state.datasourceId,
              database: state.database,
              tableName: state.selectedTable
            }
          ]
        }
      } catch (error) {
        state.tables = []
        state.selectedTable = null
        state.recentTables = []
        window.$message.error('读取表目录失败，请确认库名和权限配置正确。')
      } finally {
        state.loadingTables = false
      }
    }

    const loadColumns = async () => {
      if (!state.datasourceId || !state.database || !state.selectedTable) {
        return
      }
      state.loadingColumns = true
      try {
        const res = await getDatasourceTableColumnMetasById(
          state.datasourceId,
          state.database,
          state.selectedTable
        )
        state.columns = normalizeColumns(res)
        state.columnOrder = state.columns.map((item) => item.name)
        state.visibleColumnKeys = state.columns.map((item) => item.name)
        state.filters = []
        state.sorts = []
        state.savedViews = [
          {
            id: 'default',
            name: '默认视图',
            isDefault: true,
            config: createViewConfig()
          }
        ]
        state.activeViewId = 'default'
        state.viewDirty = false
        await loadSavedViews()
      } catch (error) {
        state.columns = []
        state.columnOrder = []
        state.visibleColumnKeys = []
        window.$message.error('读取字段元数据失败，请确认当前表存在且账号具备查询权限。')
      } finally {
        state.loadingColumns = false
      }
    }

    const collectFilters = () => {
      const result: NonNullable<IDataPreviewQueryRequest['filters']> = []
      for (const item of state.filters) {
        const hasAnyValue = !!item.field || !!item.value.trim()
        if (!hasAnyValue) {
          continue
        }
        if (!item.field || !item.value.trim()) {
          window.$message.error('筛选条件未填写完整，请补全字段和值。')
          return null
        }
        result.push({
          field: item.field,
          operator: item.operator,
          value: item.value.trim()
        })
      }
      return result
    }

    const collectSorts = () => {
      const result: IDataPreviewSort[] = []
      for (const item of state.sorts) {
        if (!item.field) {
          continue
        }
        result.push({
          field: item.field,
          direction: item.direction
        })
      }
      return result
    }

    const runPreview = async (pageNo = 1) => {
      if (!state.datasourceId || !state.database || !state.selectedTable) {
        window.$message.warning('请先选择数据源、数据库和表。')
        return
      }
      const filters = collectFilters()
      if (filters === null) {
        return
      }
      const sorts = collectSorts()
      state.loadingPreview = true
      state.pageNo = pageNo
      state.previewError = ''
      try {
        const result = (await previewDatasourceTableData({
          datasourceId: state.datasourceId,
          database: state.database,
          tableName: state.selectedTable,
          filters,
          sorts,
          pageNo,
          pageSize: state.pageSize
        })) as IDataPreviewQueryResult
        // 后端会对页码、页大小和返回行数做最终确认，前端以服务端返回为准展示状态栏。
        state.rows = result.rows || []
        state.pageNo = result.pageNo || pageNo
        state.pageSize = result.pageSize || state.pageSize
        state.rowCount = result.rowCount ?? state.rows.length
        state.executedAt = result.executedAt || ''
        state.elapsedMs = result.elapsedMs || 0
        state.warnings = result.warnings || []
      } catch (error) {
        state.rows = []
        state.rowCount = 0
        state.previewError = '查询失败，请检查筛选、排序、表权限或数据源连接状态。'
      } finally {
        state.loadingPreview = false
      }
    }

    const reloadCurrentTable = async () => {
      await runPreview(1)
    }

    const handleDatasourceChange = async (value: number | null) => {
      state.datasourceId = value
      state.selectedDatasourceType =
        state.datasourceOptions.find((item) => item.value === value)?.type || null
      state.databaseOptions = []
      state.database = null
      resetTableState()
      if (!value) {
        return
      }
      await loadDatabases()
      await loadTables()
      await loadColumns()
      if (state.selectedTable) {
        await runPreview(1)
      }
    }

    const handleDatabaseChange = async (value: string | null) => {
      state.database = value
      resetTableState()
      if (!value) {
        return
      }
      await loadTables()
      await loadColumns()
      if (state.selectedTable) {
        await runPreview(1)
      }
    }

    const handleSelectTable = async (tableName: string) => {
      if (!state.datasourceId || !state.database) {
        return
      }
      state.selectedTable = tableName
      state.recentTables = [
        tableName,
        ...state.recentTables.filter((item) => item !== tableName)
      ].slice(0, 5)
      const tabKey = `${state.datasourceId}:${state.database}:${tableName}`
      if (!state.openedTabs.some((tab) => tab.key === tabKey)) {
        state.openedTabs.push({
          key: tabKey,
          datasourceId: state.datasourceId,
          database: state.database,
          tableName
        })
      }
      state.rows = []
      state.rowCount = 0
      state.executedAt = ''
      state.elapsedMs = 0
      state.previewError = ''
      await loadColumns()
      await runPreview(1)
    }

    const closeTab = async (tabKey: string) => {
      const closingActive = selectedTableKey.value === tabKey
      state.openedTabs = state.openedTabs.filter((tab) => tab.key !== tabKey)
      if (!closingActive) {
        return
      }
      const nextTab = state.openedTabs[state.openedTabs.length - 1]
      if (!nextTab) {
        state.selectedTable = null
        state.columns = []
        state.columnOrder = []
        state.visibleColumnKeys = []
        state.rows = []
        state.rowCount = 0
        return
      }
      await handleSelectTable(nextTab.tableName)
    }

    const addFilterRow = (field?: string) => {
      state.filters.push({
        id: createRowId(),
        field: field || null,
        operator: 'CONTAINS',
        value: ''
      })
      markViewDirty()
    }

    const addSortRow = (field?: string, direction: 'ASC' | 'DESC' = 'ASC') => {
      state.sorts.push({
        id: createRowId(),
        field: field || null,
        direction
      })
      markViewDirty()
    }

    const addQuickFilter = () => {
      addFilterRow(state.columns[0]?.name)
    }

    const addQuickSort = () => {
      addSortRow(state.columns[0]?.name, 'ASC')
    }

    const removeFilterRow = (id: number) => {
      state.filters = state.filters.filter((item) => item.id !== id)
      markViewDirty()
    }

    const removeSortRow = (id: number) => {
      state.sorts = state.sorts.filter((item) => item.id !== id)
      markViewDirty()
    }

    const toggleHeaderSort = async (field: string) => {
      const index = state.sorts.findIndex((item) => item.field === field)
      if (index === -1) {
        state.sorts = [{ id: createRowId(), field, direction: 'ASC' }]
      } else {
        const current = state.sorts[index]
        if (current.direction === 'ASC') {
          state.sorts = state.sorts.map((item, itemIndex) =>
            itemIndex === index ? { ...item, direction: 'DESC' } : item
          )
        } else {
          state.sorts = state.sorts.filter((item, itemIndex) => itemIndex !== index)
        }
      }
      markViewDirty()
      await runPreview(1)
    }

    const getHeaderSortState = (field: string) => {
      return state.sorts.find((item) => item.field === field)?.direction || null
    }

    const ensureFilterField = (field: string) => {
      const existed = state.filters.find((item) => item.field === field)
      if (existed) {
        return
      }
      addFilterRow(field)
      window.$message.info(`已把 ${field} 加入 WHERE 条件，可直接在条件条填写值。`)
    }

    const handleColumnVisibleChange = (checked: boolean, columnName: string) => {
      const nextSet = new Set(state.visibleColumnKeys)
      if (checked) {
        nextSet.add(columnName)
      } else {
        nextSet.delete(columnName)
      }
      state.visibleColumnKeys = state.columnOrder.filter((item) => nextSet.has(item))
      markViewDirty()
    }

    const moveColumn = (dragName: string, dropName: string) => {
      if (dragName === dropName) {
        return
      }
      const nextOrder = [...state.columnOrder]
      const dragIndex = nextOrder.indexOf(dragName)
      const dropIndex = nextOrder.indexOf(dropName)
      if (dragIndex === -1 || dropIndex === -1) {
        return
      }
      const [dragItem] = nextOrder.splice(dragIndex, 1)
      nextOrder.splice(dropIndex, 0, dragItem)
      state.columnOrder = nextOrder
      state.visibleColumnKeys = nextOrder.filter((item) => state.visibleColumnKeys.includes(item))
      markViewDirty()
    }

    const handleCopySql = async () => {
      try {
        await navigator.clipboard.writeText(sqlPreview.value)
        window.$message.success('当前结构化 SQL 预览已复制。')
      } catch (error) {
        window.$message.error('复制失败，请检查浏览器剪贴板权限。')
      }
    }

    const setAllColumnsVisible = () => {
      state.visibleColumnKeys = [...state.columnOrder]
      markViewDirty()
    }

    const invertColumnsVisible = () => {
      const current = new Set(state.visibleColumnKeys)
      state.visibleColumnKeys = state.columnOrder.filter((item) => !current.has(item))
      markViewDirty()
    }

    const clearColumnsVisible = () => {
      state.visibleColumnKeys = []
      markViewDirty()
    }

    const resetColumns = () => {
      state.columnOrder = state.columns.map((item) => item.name)
      state.visibleColumnKeys = state.columns.map((item) => item.name)
      markViewDirty()
    }

    const saveCurrentView = async () => {
      const current = activeView.value
      if (!current) {
        return
      }
      if (state.viewSaving) {
        return
      }
      if (current.isDefault) {
        const name = window.prompt('默认视图不能被覆盖，请输入新视图名称后另存。', state.viewNameDraft)
        if (!name) {
          return
        }
        state.viewNameDraft = name
        await saveAsView()
        return
      }
      if (!current.backendId) {
        window.$message.warning('当前视图缺少后端编号，请另存为新视图。')
        return
      }
      state.viewSaving = true
      try {
        const res = await updateDataPreviewView(current.backendId, buildViewRequest(current.name))
        const saved = toSavedView(res as IDataPreviewViewResponse)
        current.config = saved?.config || createViewConfig()
        current.name = saved?.name || current.name
        state.viewDirty = false
        window.$message.success(`已保存视图：${current.name}`)
      } catch (error) {
        window.$message.error('保存视图失败，请稍后重试。')
      } finally {
        state.viewSaving = false
      }
    }

    const saveAsView = async () => {
      const name = state.viewNameDraft.trim()
      if (!name) {
        window.$message.warning('视图名称不能为空。')
        return
      }
      if (state.savedViews.some((item) => item.name === name)) {
        window.$message.warning('同一张表下已存在同名视图。')
        return
      }
      if (!state.datasourceId || !state.database || !state.selectedTable) {
        window.$message.warning('请先打开一张表再保存视图。')
        return
      }
      if (state.viewSaving) {
        return
      }
      state.viewSaving = true
      try {
        const res = await createDataPreviewView(buildViewRequest(name))
        const view = toSavedView(res as IDataPreviewViewResponse)
        if (!view) {
          throw new Error('invalid saved view response')
        }
        state.savedViews = [...state.savedViews, view]
        state.activeViewId = view.id
        state.viewDirty = false
        state.viewNameDraft = ''
        state.viewMenuOpen = false
        window.$message.success(`已另存为视图：${name}`)
      } catch (error) {
        window.$message.error('另存视图失败，请确认名称未重复且配置有效。')
      } finally {
        state.viewSaving = false
      }
    }

    const switchView = async (viewId: string) => {
      const view = state.savedViews.find((item) => item.id === viewId)
      if (!view) {
        return
      }
      if (state.viewDirty && !window.confirm('当前视图有未保存修改，切换会放弃这些修改。继续切换吗？')) {
        return
      }
      state.activeViewId = viewId
      await applyViewConfig(view.config)
      state.viewMenuOpen = false
    }

    const deleteCurrentView = async () => {
      const current = activeView.value
      if (!current || current.isDefault) {
        window.$message.warning('默认视图不能删除。')
        return
      }
      if (!current.backendId) {
        window.$message.warning('当前视图缺少后端编号，无法删除。')
        return
      }
      if (!window.confirm(`确认删除视图“${current.name}”吗？`)) {
        return
      }
      try {
        await deleteDataPreviewView(current.backendId)
        state.savedViews = state.savedViews.filter((item) => item.id !== current.id)
        state.activeViewId = 'default'
        const defaultView = state.savedViews.find((item) => item.id === 'default')
        if (defaultView) {
          await applyViewConfig(defaultView.config)
        }
        window.$message.success('已删除当前视图。')
      } catch (error) {
        window.$message.error('删除视图失败，请稍后重试。')
      }
    }

    const exportCsv = () => {
      if (!state.rows.length) {
        window.$message.warning('当前没有可导出的数据。')
        return
      }
      const columns = displayColumns.value
      const escapeCsv = (value: unknown) => `"${formatCellValue(value).replace(/"/g, '""')}"`
      const header = columns.map((item) => escapeCsv(item.name)).join(',')
      const body = state.rows
        .map((row) =>
          columns
            .map((column) =>
              escapeCsv(column.name.includes('.') ? getJoinCellValue(row, column.name) : row[column.name])
            )
            .join(',')
        )
        .join('\n')
      const blob = new Blob([`\uFEFF${header}\n${body}`], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${state.selectedTable || 'data-preview'}-${Date.now()}.csv`
      link.click()
      URL.revokeObjectURL(url)
      window.$message.success('已导出当前结果 CSV。')
    }

    const openPanel = (panel: Exclude<ActivePanel, null>) => {
      if (panel === 'filters') {
        addQuickFilter()
        return
      }
      if (panel === 'sorts') {
        addQuickSort()
        return
      }
      state.activePanel = panel
    }

    const closePanel = () => {
      state.activePanel = null
    }

    const addJoinConfig = () => {
      state.joinConfigs.push({
        id: createRowId(),
        table: 'region_dict',
        mainField: 'city',
        targetField: 'city_name',
        type: 'LEFT',
        visibleFields: ['region_dict.region_level', 'region_dict.area_manager']
      })
      markViewDirty()
    }

    const removeJoinConfig = (id: number) => {
      state.joinConfigs = state.joinConfigs.filter((item) => item.id !== id)
      if (!state.joinConfigs.length) {
        state.joinApplied = false
      }
      markViewDirty()
    }

    const handleJoinTableChange = (join: JoinConfig, table: JoinConfig['table']) => {
      join.table = table
      join.mainField = table === 'dept_dict' ? 'owner_dept' : 'city'
      join.targetField = table === 'dept_dict' ? 'dept_name' : 'city_name'
      join.visibleFields = JOIN_TABLE_FIELD_OPTIONS[table]
      markViewDirty()
    }

    const applyJoin = () => {
      if (!state.joinConfigs.length) {
        window.$message.warning('请至少添加一张关联表。')
        return
      }
      state.joinApplied = true
      state.activePanel = null
      markViewDirty()
      window.$message.success('已应用关联，结果表追加关联字段。')
    }

    const clearJoin = () => {
      state.joinApplied = false
      markViewDirty()
      window.$message.success('已清除关联字段。')
    }

    const getJoinCellValue = (row: Record<string, any>, key: string) => {
      if (key.startsWith('dept_dict.')) {
        const dept = DEPT_DICT[formatCellValue(row.owner_dept)] || {}
        return dept[key.replace('dept_dict.', '')] || ''
      }
      if (key.startsWith('region_dict.')) {
        const region = REGION_DICT[formatCellValue(row.city)] || {}
        return region[key.replace('region_dict.', '')] || ''
      }
      return ''
    }

    const addCellFilter = async (field: string, value: unknown, exclude = false) => {
      if (!field || field.includes('.')) {
        window.$message.warning('关联模拟字段暂不支持下推筛选。')
        return
      }
      state.filters.push({
        id: createRowId(),
        field,
        operator: exclude ? '!=' : '=',
        value: formatCellValue(value)
      })
      state.cellMenu.visible = false
      markViewDirty()
      await runPreview(1)
    }

    const copyCellValue = async () => {
      await navigator.clipboard.writeText(formatCellValue(state.cellMenu.value))
      state.cellMenu.visible = false
      window.$message.success('已复制单元格值。')
    }

    const copyRowJson = async () => {
      await navigator.clipboard.writeText(JSON.stringify(state.cellMenu.row || {}, null, 2))
      state.cellMenu.visible = false
      window.$message.success('已复制整行 JSON。')
    }

    const showCellDetail = (field: string, value: unknown) => {
      state.cellDetailTitle = field
      state.cellDetailValue = formatCellValue(value)
      state.cellDetailVisible = true
      state.cellMenu.visible = false
    }

    const openCellMenu = (
      event: MouseEvent,
      row: Record<string, any>,
      field: string,
      value: unknown
    ) => {
      event.preventDefault()
      state.cellMenu = {
        visible: true,
        x: event.clientX,
        y: event.clientY,
        row,
        field,
        value
      }
    }

    const selectCell = (rowIndex: number, field: string) => {
      state.selectedCellKey = `${rowIndex}:${field}`
    }

    const startSidebarResize = (event: MouseEvent) => {
      sidebarDragging.value = true
      const layout = (event.currentTarget as HTMLElement).closest(`.${styles.mainLayout}`)
      sidebarLayoutLeft.value = layout?.getBoundingClientRect().left ?? 0
      document.body.classList.add('data-preview-sidebar-resizing')
      event.preventDefault()
    }

    const onSidebarResize = (event: MouseEvent) => {
      if (!sidebarDragging.value) {
        return
      }
      const rawWidth = event.clientX - sidebarLayoutLeft.value
      const collapsed = rawWidth <= 72
      state.sidebarCollapsed = collapsed
      // 对象树只有两种稳定状态：42px 窄栏，或 220-430px 可读宽栏，避免停在半折叠宽度导致内容挤压。
      state.sidebarWidth = collapsed ? 42 : Math.max(220, Math.min(430, rawWidth))
    }

    const stopSidebarResize = () => {
      sidebarDragging.value = false
      document.body.classList.remove('data-preview-sidebar-resizing')
    }

    const tableColumns = computed<DataTableColumns<Record<string, any>>>(() =>
      [
        {
          key: '__rowIndex',
          title: '#',
          width: 54,
          fixed: 'left' as const,
          render: (_row: Record<string, any>, rowIndex: number) =>
            (state.pageNo - 1) * state.pageSize + rowIndex + 1
        },
        ...displayColumns.value.map((column) => ({
        key: column.name,
        title: () => (
          <div class={styles.columnHeader}>
            <div class={styles.columnHeaderText}>
              <span class={styles.columnName}>{column.name}</span>
              <span class={styles.columnComment} title={column.comment || column.name}>
                {column.comment || column.name}
              </span>
            </div>
            <div class={styles.columnHeaderActions}>
              <NTooltip trigger='hover'>
                {{
                  trigger: () => (
                    <button
                      class={styles.headerIconButton}
                      onClick={(event) => {
                        event.stopPropagation()
                        ensureFilterField(column.name)
                      }}
                    >
                      <NIcon size={14}>
                        <FilterOutlined />
                      </NIcon>
                    </button>
                  ),
                  default: () => '加入筛选'
                }}
              </NTooltip>
              <NTooltip trigger='hover'>
                {{
                  trigger: () => (
                    <button
                      class={[
                        styles.headerIconButton,
                        getHeaderSortState(column.name) ? styles.headerIconButtonActive : ''
                      ]}
                      onClick={(event) => {
                        event.stopPropagation()
                        void toggleHeaderSort(column.name)
                      }}
                    >
                      <NIcon size={14}>
                        <SortAscendingOutlined />
                      </NIcon>
                    </button>
                  ),
                  default: () => {
                    const sortState = getHeaderSortState(column.name)
                    if (!sortState) {
                      return '点击升序'
                    }
                    return sortState === 'ASC' ? '当前升序，再点切换降序' : '当前降序，再点取消排序'
                  }
                }}
              </NTooltip>
            </div>
          </div>
        ),
        ellipsis: {
          tooltip: true
        },
        width: 220,
        render: (row: Record<string, any>, rowIndex: number) => {
          const value = column.name.includes('.')
            ? getJoinCellValue(row, column.name)
            : row[column.name]
          const cellKey = `${rowIndex}:${column.name}`
          return (
            <span
              class={[
                styles.cellValue,
                state.selectedCellKey === cellKey ? styles.cellValueSelected : '',
                value === null || value === undefined ? styles.nullValue : ''
              ]}
              title={value === null || value === undefined ? 'NULL' : formatCellValue(value)}
              onClick={() => selectCell(rowIndex, column.name)}
              onDblclick={() => showCellDetail(column.name, value)}
              onContextmenu={(event) => openCellMenu(event, row, column.name, value)}
            >
              {value === null || value === undefined ? 'NULL' : formatCellValue(value)}
            </span>
          )
        }
      }))
      ]
    )

    onMounted(async () => {
      window.addEventListener('mousemove', onSidebarResize)
      window.addEventListener('mouseup', stopSidebarResize)
      window.addEventListener('click', () => {
        state.cellMenu.visible = false
      })
      await loadDatasourceList()
      if (state.datasourceOptions.length) {
        await handleDatasourceChange(state.datasourceOptions[0].value)
      }
    })

    onBeforeUnmount(() => {
      window.removeEventListener('mousemove', onSidebarResize)
      window.removeEventListener('mouseup', stopSidebarResize)
      document.body.classList.remove('data-preview-sidebar-resizing')
    })

    return {
      draggingColumnName,
      sidebarDragging,
      state,
      datasourceSelectOptions,
      databaseSelectOptions,
      columnSelectOptions,
      pageSizeSelectOptions,
      filteredTables,
      recentTableList,
      filteredColumnList,
      visibleColumns,
      appliedJoinColumns,
      displayColumns,
      selectedDatasource,
      selectedTableKey,
      whereSummary,
      orderSummary,
      sqlPreview,
      tableColumns,
      handleDatasourceChange,
      handleDatabaseChange,
      handleSelectTable,
      addFilterRow,
      addSortRow,
      addQuickFilter,
      addQuickSort,
      removeFilterRow,
      removeSortRow,
      runPreview,
      reloadCurrentTable,
      handleColumnVisibleChange,
      moveColumn,
      handleCopySql,
      setAllColumnsVisible,
      invertColumnsVisible,
      clearColumnsVisible,
      resetColumns,
      saveCurrentView,
      saveAsView,
      switchView,
      deleteCurrentView,
      exportCsv,
      openPanel,
      closePanel,
      closeTab,
      addJoinConfig,
      removeJoinConfig,
      handleJoinTableChange,
      applyJoin,
      clearJoin,
      addCellFilter,
      copyCellValue,
      copyRowJson,
      showCellDetail,
      startSidebarResize
    }
  },
  render() {
    const loadingTree =
      this.state.loadingDatabases || this.state.loadingTables || this.state.loadingColumns

    return (
      <div class={styles.page}>
        <header class={styles.topbar}>
          <div class={styles.brand}>
            <span class={styles.brandIcon}>D</span>
            <span>数据预览</span>
          </div>
          <div class={styles.selectbox}>
            <span>数据源</span>
            <NSelect
              class={styles.selector}
              value={this.state.datasourceId}
              options={this.datasourceSelectOptions}
              placeholder='选择数据源'
              filterable
              clearable
              loading={this.state.loadingDatasources}
              onUpdateValue={(value) => void this.handleDatasourceChange(value as number | null)}
            />
          </div>
          <div class={styles.selectbox}>
            <span>数据库</span>
            <NSelect
              class={styles.selector}
              value={this.state.database}
              options={this.databaseSelectOptions}
              placeholder='选择数据库'
              filterable
              clearable
              loading={this.state.loadingDatabases}
              disabled={!this.state.datasourceId}
              onUpdateValue={(value) => void this.handleDatabaseChange(value as string | null)}
            />
          </div>
          <div class={styles.tableContext}>
            <span class={styles.tableIcon}>▦</span>
            <strong>
              {this.state.selectedTable
                ? `${this.state.selectedTable}${this.state.columns.length ? '（当前表）' : ''}`
                : '未选择表'}
            </strong>
            <span class={styles.pill}>{this.visibleColumns.length} 字段</span>
            <span class={styles.pill}>{this.state.filters.length} 筛选</span>
            <span class={styles.pill}>{this.state.sorts.length} 排序</span>
            {this.state.joinApplied ? (
              <span class={styles.pill}>{this.state.joinConfigs.length} 关联</span>
            ) : null}
          </div>
          <NButton
            type='primary'
            size='small'
            disabled={!this.state.selectedTable}
            onClick={() => void this.runPreview(1)}
          >
            查询
          </NButton>
          <NButton
            size='small'
            disabled={!this.state.selectedTable}
            onClick={() => void this.reloadCurrentTable()}
          >
            刷新
          </NButton>
          <NButton size='small' disabled={!this.state.selectedTable} onClick={() => this.exportCsv()}>
            导出
          </NButton>
          <NButton
            size='small'
            disabled={!this.state.selectedTable || this.state.viewSaving}
            onClick={() => void this.saveCurrentView()}
          >
            {this.state.viewSaving ? '保存中' : '保存视图'}
          </NButton>
        </header>

        <div
          class={[styles.mainLayout, this.sidebarDragging ? styles.sidebarResizing : '']}
          style={{ gridTemplateColumns: `${this.state.sidebarWidth}px minmax(0, 1fr)` }}
        >
          <aside
            class={[
              styles.objectPane,
              this.state.sidebarCollapsed ? styles.objectPaneCollapsed : ''
            ]}
          >
            <div class={styles.treeSearch}>
              {this.state.sidebarCollapsed ? (
                <div class={styles.collapsedTreeEntry} title='拖拽右侧边线展开对象树'>
                  ▦
                </div>
              ) : (
                <NInput
                  value={this.state.tableSearch}
                  placeholder='搜索表名或注释'
                  clearable
                  size='small'
                  onUpdateValue={(value) => {
                    this.state.tableSearch = value
                  }}
                >
                  {{
                    prefix: () => (
                      <NIcon size={14}>
                        <SearchOutlined />
                      </NIcon>
                    )
                  }}
                </NInput>
              )}
            </div>
            <div class={styles.recent}>
              <div class={styles.sideTitle}>最近打开</div>
              {this.recentTableList.length ? (
                this.recentTableList.slice(0, 3).map((tableName) => (
                  <button
                    key={tableName}
                    class={[
                      styles.recentRow,
                      this.state.selectedTable === tableName ? styles.recentRowActive : ''
                    ]}
                    title={`打开 ${tableName}`}
                    onClick={() => void this.handleSelectTable(tableName)}
                  >
                    <span>▦</span>
                    <span>{tableName}</span>
                  </button>
                ))
              ) : (
                <div class={styles.recentEmpty}>暂无打开表</div>
              )}
            </div>
            <div class={styles.treeShell}>
              {loadingTree ? (
                <div class={styles.centerState}>
                  <NSpin size='small' />
                </div>
              ) : !this.state.datasourceId || !this.state.database ? (
                <NEmpty description='请先选择数据源和数据库' />
              ) : (
                <div class={styles.treeGroup}>
                  <button
                    class={[styles.treeNode, styles.treeNodeLevel0, styles.treeNodeStrong]}
                    title={String(this.selectedDatasource?.label || '数据源')}
                    onClick={() => {
                      this.state.datasourceSectionExpanded = !this.state.datasourceSectionExpanded
                    }}
                  >
                    <span class={styles.treeChevron}>
                      {this.state.datasourceSectionExpanded ? '▾' : '▸'}
                    </span>
                    <span
                      class={[
                        styles.dbVendorIcon,
                        this.selectedDatasource?.type === 'POSTGRESQL'
                          ? styles.dbVendorPostgresql
                          : styles.dbVendorMysql
                      ]}
                    >
                      {this.selectedDatasource?.type === 'POSTGRESQL' ? 'PG' : 'MY'}
                    </span>
                    <span class={styles.treeNodeText}>{this.selectedDatasource?.label || '数据源'}</span>
                    <span class={styles.treeNodeMeta}>{this.selectedDatasource?.type || 'DB'}</span>
                  </button>
                  {this.state.datasourceSectionExpanded ? (
                    <>
                      <button
                        class={[styles.treeNode, styles.treeNodeLevel1, styles.treeNodeStrong]}
                        title={String(this.state.database)}
                        onClick={() => {
                          this.state.databaseSectionExpanded = !this.state.databaseSectionExpanded
                        }}
                      >
                        <span class={styles.treeChevron}>
                          {this.state.databaseSectionExpanded ? '▾' : '▸'}
                        </span>
                        <span
                          class={[
                            styles.databaseIcon,
                            this.selectedDatasource?.type === 'POSTGRESQL'
                              ? styles.databaseIconPostgresql
                              : styles.databaseIconMysql
                          ]}
                        ></span>
                        <span class={styles.treeNodeText}>{this.state.database}</span>
                        <span class={styles.treeNodeMeta}>DB</span>
                      </button>
                      {this.state.databaseSectionExpanded ? (
                        <>
                          <button
                            class={[styles.treeNode, styles.treeNodeLevel2]}
                            onClick={() => {
                              this.state.tableSectionExpanded = !this.state.tableSectionExpanded
                            }}
                          >
                            <span class={styles.treeChevron}>
                              {this.state.tableSectionExpanded ? '▾' : '▸'}
                            </span>
                            <span class={styles.tableGroupIcon}></span>
                            <span class={styles.treeNodeText}>表</span>
                            <span class={styles.treeNodeCount}>{this.filteredTables.length}</span>
                          </button>
                          {this.state.tableSectionExpanded ? (
                            <div class={styles.treeList}>
                              {this.filteredTables.length ? (
                                this.filteredTables.map((tableName) => (
                                  <button
                                    key={tableName}
                                    class={[
                                      styles.treeItem,
                                      this.state.selectedTable === tableName
                                        ? styles.treeItemActive
                                        : ''
                                    ]}
                                    title={tableName}
                                    onClick={() => void this.handleSelectTable(tableName)}
                                  >
                                    <span class={styles.tableGridIcon}></span>
                                    <span class={styles.treeItemName}>{tableName}</span>
                                    <span class={styles.treeTypeBadge}>TABLE</span>
                                  </button>
                                ))
                              ) : (
                                <div class={styles.treeEmpty}>当前库没有匹配的表</div>
                              )}
                            </div>
                          ) : null}
                          <button
                            class={[styles.treeNode, styles.treeNodeLevel2]}
                            onClick={() => {
                              this.state.viewSectionExpanded = !this.state.viewSectionExpanded
                            }}
                          >
                            <span class={styles.treeChevron}>
                              {this.state.viewSectionExpanded ? '▾' : '▸'}
                            </span>
                            <span class={styles.viewGroupIcon}></span>
                            <span class={styles.treeNodeText}>视图</span>
                            <span class={styles.treeNodeCount}>0</span>
                          </button>
                          {this.state.viewSectionExpanded ? (
                            <div class={styles.treeEmptyIndented}>当前库暂无视图</div>
                          ) : null}
                        </>
                      ) : null}
                    </>
                  ) : null}
                </div>
              )}
            </div>
            <div class={styles.sidebarStatus}>
              <span>已加载 {this.state.tables.length} 张表</span>
              <span>刷新</span>
            </div>
            <div
              class={styles.resizeHandle}
              title='拖拽调整左侧宽度'
              onMousedown={(event) => this.startSidebarResize(event)}
            ></div>
          </aside>

          <main class={styles.workspace}>
            <div class={styles.tabs}>
              {this.state.openedTabs.length ? (
                this.state.openedTabs.map((tab) => (
                  <button
                    key={tab.key}
                    class={[
                      styles.tab,
                      this.selectedTableKey === tab.key ? styles.tabActive : ''
                    ]}
                    onClick={() => void this.handleSelectTable(tab.tableName)}
                  >
                    <span>{`${tab.tableName} · ${tab.database}`}</span>
                    <b
                      onClick={(event) => {
                        event.stopPropagation()
                        void this.closeTab(tab.key)
                      }}
                    >
                      ×
                    </b>
                  </button>
                ))
              ) : (
                <div class={[styles.tab, styles.tabActive]}>
                  <span>请选择表</span>
                </div>
              )}
            </div>
            <div class={styles.tableToolbar}>
              <NButton
                size='small'
                quaternary
                disabled={!this.state.selectedTable}
                onClick={() => void this.reloadCurrentTable()}
              >
                {{
                  icon: () => (
                    <NIcon>
                      <ReloadOutlined />
                    </NIcon>
                  )
                }}
              </NButton>
              <div class={styles.viewControl}>
                <NButton
                  size='small'
                  secondary
                  disabled={!this.state.selectedTable || this.state.viewLoading}
                  onClick={() => {
                    this.state.viewMenuOpen = !this.state.viewMenuOpen
                  }}
                >
                  视图：{this.state.savedViews.find((item) => item.id === this.state.activeViewId)?.name || '默认视图'}{this.state.viewDirty ? ' *' : ''}
                </NButton>
                {this.state.viewMenuOpen ? (
                  <div class={styles.viewMenu}>
                    <div class={styles.viewMenuTitle}>我的视图</div>
                    {this.state.savedViews.map((view) => (
                      <button
                        key={view.id}
                        class={styles.viewMenuItem}
                        onClick={() => void this.switchView(view.id)}
                      >
                        <span>{view.id === this.state.activeViewId ? '✓' : ''}</span>
                        <span>{view.name}</span>
                      </button>
                    ))}
                    <div class={styles.viewMenuDivider}></div>
                    <button
                      class={styles.viewMenuItem}
                      disabled={this.state.viewSaving}
                      onClick={() => void this.saveCurrentView()}
                    >
                      {this.state.viewSaving ? '保存中...' : '保存当前视图'}
                    </button>
                    <div class={styles.saveAsRow}>
                      <NInput
                        value={this.state.viewNameDraft}
                        placeholder='新视图名称'
                        size='small'
                        onUpdateValue={(value) => {
                          this.state.viewNameDraft = value
                        }}
                      />
                      <NButton
                        size='small'
                        disabled={this.state.viewSaving}
                        onClick={() => void this.saveAsView()}
                      >
                        {this.state.viewSaving ? '保存中' : '另存'}
                      </NButton>
                    </div>
                    <button class={styles.viewMenuItemDanger} onClick={() => void this.deleteCurrentView()}>
                      删除当前视图
                    </button>
                  </div>
                ) : null}
              </div>
              <NButton
                size='small'
                secondary={this.state.activePanel === 'columns'}
                onClick={() => this.openPanel('columns')}
              >
                列设置
              </NButton>
              <NButton
                size='small'
                secondary={this.state.activePanel === 'filters'}
                onClick={() => this.openPanel('filters')}
              >
                筛选
              </NButton>
              <NButton
                size='small'
                secondary={this.state.activePanel === 'sorts'}
                onClick={() => this.openPanel('sorts')}
              >
                排序
              </NButton>
              <NButton
                size='small'
                secondary={this.state.activePanel === 'joins'}
                onClick={() => this.openPanel('joins')}
              >
                关联
              </NButton>
              <NButton size='small' onClick={() => void this.handleCopySql()}>
                {{
                  icon: () => (
                    <NIcon>
                      <CopyOutlined />
                    </NIcon>
                  ),
                  default: () => '复制SQL'
                }}
              </NButton>
              <div class={styles.toolbarSpacer}></div>
              <NSelect
                class={styles.pageSizeSelector}
                value={this.state.pageSize}
                options={this.pageSizeSelectOptions}
                size='small'
                onUpdateValue={(value) => {
                  this.state.pageSize = value as number
                  this.state.viewDirty = true
                  void this.runPreview(1)
                }}
              />
            </div>

            <div class={styles.queryBand}>
              <div class={styles.queryLine}>
                <span class={styles.queryLabel}>WHERE</span>
                <div class={styles.conditionList}>
                  {this.state.filters.length ? (
                    this.state.filters.map((filter) => (
                      <div key={filter.id} class={styles.conditionEditor}>
                        <NSelect
                          class={styles.conditionField}
                          value={filter.field}
                          options={this.columnSelectOptions}
                          placeholder='字段'
                          size='small'
                          filterable
                          onUpdateValue={(value) => {
                            filter.field = value as string
                            this.state.viewDirty = true
                          }}
                        />
                        <NSelect
                          class={styles.conditionOp}
                          value={filter.operator}
                          options={FILTER_OPERATOR_OPTIONS}
                          size='small'
                          onUpdateValue={(value) => {
                            filter.operator = value as FilterOperator
                            this.state.viewDirty = true
                          }}
                        />
                        <NInput
                          class={styles.conditionValue}
                          value={filter.value}
                          placeholder='值'
                          size='small'
                          onUpdateValue={(value) => {
                            filter.value = value
                            this.state.viewDirty = true
                          }}
                          onKeydown={(event) => {
                            if (event.key === 'Enter') {
                              void this.runPreview(1)
                            }
                          }}
                        />
                        <button
                          class={styles.conditionRemove}
                          onClick={() => this.removeFilterRow(filter.id)}
                        >
                          ×
                        </button>
                      </div>
                    ))
                  ) : (
                    <span class={styles.emptyCondition}>无筛选条件</span>
                  )}
                  <button class={styles.addCondition} onClick={() => this.addQuickFilter()}>
                    + 条件
                  </button>
                  {this.state.filters.length ? (
                    <button
                      class={styles.applyCondition}
                      disabled={!this.state.selectedTable}
                      onClick={() => void this.runPreview(1)}
                    >
                      应用
                    </button>
                  ) : null}
                </div>
              </div>
              <div class={styles.queryLine}>
                <span class={styles.queryLabel}>ORDER BY</span>
                <div class={styles.conditionList}>
                  {this.state.sorts.length ? (
                    this.state.sorts.map((sort, index) => (
                      <div key={sort.id} class={styles.conditionEditor}>
                        <NSelect
                          class={styles.conditionField}
                          value={sort.field}
                          options={this.columnSelectOptions}
                          placeholder='字段'
                          size='small'
                          filterable
                          onUpdateValue={(value) => {
                            sort.field = value as string
                            this.state.viewDirty = true
                          }}
                        />
                        <NSelect
                          class={styles.conditionOp}
                          value={sort.direction}
                          options={SORT_DIRECTION_OPTIONS}
                          size='small'
                          onUpdateValue={(value) => {
                            sort.direction = value as 'ASC' | 'DESC'
                            this.state.viewDirty = true
                          }}
                        />
                        <span class={styles.sortIndex}>{index + 1}</span>
                        <button
                          class={styles.conditionRemove}
                          onClick={() => this.removeSortRow(sort.id)}
                        >
                          ×
                        </button>
                      </div>
                    ))
                  ) : (
                    <span class={styles.emptyCondition}>无排序条件</span>
                  )}
                  <button class={styles.addCondition} onClick={() => this.addQuickSort()}>
                    + 排序
                  </button>
                  {this.state.sorts.length ? (
                    <button
                      class={styles.applyCondition}
                      disabled={!this.state.selectedTable}
                      onClick={() => void this.runPreview(1)}
                    >
                      应用
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
            {this.state.joinApplied ? (
              <div class={styles.joinStrip}>
                <strong>JOIN</strong>
                <span>
                  {this.state.joinConfigs
                    .map(
                      (join) =>
                        `${join.type} JOIN ${join.table} ON ${this.state.selectedTable}.${join.mainField || '字段'} = ${join.table}.${join.targetField}`
                    )
                    .join('；')}
                </span>
                <button class={styles.addCondition} onClick={() => this.clearJoin()}>
                  清除
                </button>
              </div>
            ) : null}

            {this.state.warnings.length ? (
              <NAlert type='warning' showIcon={false}>
                {this.state.warnings.join('；')}
              </NAlert>
            ) : null}

            {this.state.previewError ? (
              <NAlert type='error' showIcon={false}>
                {this.state.previewError}
              </NAlert>
            ) : null}

            <div class={styles.tableWrap}>
              {this.state.selectedTable ? (
                this.state.loadingPreview ? (
                  <div class={styles.centerState}>
                    <NSpin />
                  </div>
                ) : this.visibleColumns.length ? (
                  this.state.rows.length ? (
                    <NDataTable
                      size='small'
                      striped
                      columns={this.tableColumns}
                      data={this.state.rows}
                      scrollX={Math.max(this.visibleColumns.length * 220, 960)}
                      maxHeight={'calc(100vh - 290px)'}
                    />
                  ) : (
                    <NEmpty
                      description={
                        this.state.previewError ? '请修正条件后重新查询' : '当前条件无数据'
                      }
                    />
                  )
                ) : (
                  <NEmpty description='列设置中至少保留一个显示字段' />
                )
              ) : (
                <NEmpty description='请从左侧选择要查看的表' />
              )}
            </div>

            <div class={styles.statusbar}>
              <div class={styles.statusLeft}>
                <span class={styles.statusDot}></span>
                <span>返回 {this.state.rowCount} 行</span>
                {this.state.executedAt ? (
                  <span>
                    耗时 {this.state.elapsedMs} ms
                  </span>
                ) : (
                  <span>选择表后自动读取第一页</span>
                )}
                <span>
                  {this.selectedDatasource?.label || '-'} / {this.state.database || '-'} / {this.state.selectedTable || '-'}
                </span>
              </div>
              <div class={styles.pager}>
                <button
                  class={styles.miniButton}
                  disabled={this.state.pageNo <= 1 || !this.state.selectedTable}
                  onClick={() => void this.runPreview(this.state.pageNo - 1)}
                >
                  ‹
                </button>
                <span>第 {this.state.pageNo} 页</span>
                <button
                  class={styles.miniButton}
                  disabled={
                    !this.state.selectedTable || this.state.rows.length < this.state.pageSize
                  }
                  onClick={() => void this.runPreview(this.state.pageNo + 1)}
                >
                  ›
                </button>
              </div>
            </div>
          </main>
        </div>

        {this.state.activePanel ? (
          <aside class={styles.configPane}>
              <div class={styles.drawerHeader}>
                <span class={styles.sectionTitle}>
                  {this.state.activePanel === 'columns'
                    ? '列设置'
                    : this.state.activePanel === 'filters'
                      ? '筛选'
                      : this.state.activePanel === 'sorts'
                        ? '排序'
                        : '关联'}
                </span>
                <button class={styles.drawerClose} onClick={() => this.closePanel()}>
                  ×
                </button>
              </div>

              {this.state.activePanel === 'columns' ? (
                <section class={styles.configSection}>
                  <div class={styles.sectionHeader}>
                    <span class={styles.sectionTitle}>字段显示</span>
                    <NTag size='small' type='default'>
                      拖拽排序
                    </NTag>
                  </div>
                  <div class={styles.fieldTools}>
                    <button class={styles.linkButton} onClick={() => this.setAllColumnsVisible()}>
                      全选
                    </button>
                    <button class={styles.linkButton} onClick={() => this.invertColumnsVisible()}>
                      反选
                    </button>
                    <button class={styles.linkButton} onClick={() => this.clearColumnsVisible()}>
                      清空
                    </button>
                    <button class={styles.linkButton} onClick={() => this.resetColumns()}>
                      恢复默认
                    </button>
                  </div>
                  <NInput
                    value={this.state.columnKeyword}
                    placeholder='搜索字段或注释'
                    clearable
                    onUpdateValue={(value) => {
                      this.state.columnKeyword = value
                    }}
                  >
                    {{
                      prefix: () => (
                        <NIcon size={14}>
                          <SearchOutlined />
                        </NIcon>
                      )
                    }}
                  </NInput>
                  <div class={styles.columnList}>
                    {this.filteredColumnList.map((column) => (
                      <div
                        key={column.name}
                        class={styles.columnRow}
                        draggable
                        onDragstart={() => {
                          this.draggingColumnName = column.name
                        }}
                        onDragover={(event) => {
                          event.preventDefault()
                        }}
                        onDrop={() => {
                          if (this.draggingColumnName) {
                            this.moveColumn(this.draggingColumnName, column.name)
                          }
                        }}
                        onDragend={() => {
                          this.draggingColumnName = null
                        }}
                      >
                        <NCheckbox
                          checked={this.state.visibleColumnKeys.includes(column.name)}
                          onUpdateChecked={(checked) =>
                            this.handleColumnVisibleChange(checked, column.name)
                          }
                        />
                        <div class={styles.columnRowMain}>
                          <span class={styles.columnRowName}>{column.name}</span>
                          <span
                            class={styles.columnRowComment}
                            title={column.comment || column.name}
                          >
                            {column.comment || '未填写字段注释'}
                          </span>
                        </div>
                        <span class={styles.columnRowType}>{column.type || '--'}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {this.state.activePanel === 'filters' ? (
                <section class={styles.configSection}>
                  <div class={styles.sectionHeader}>
                    <span class={styles.sectionTitle}>筛选条件</span>
                    <NButton size='tiny' quaternary onClick={() => this.addFilterRow()}>
                      {{
                        icon: () => (
                          <NIcon>
                            <PlusOutlined />
                          </NIcon>
                        ),
                        default: () => '新增'
                      }}
                    </NButton>
                  </div>
                  <div class={styles.stackList}>
                    {this.state.filters.length ? (
                      this.state.filters.map((filter) => (
                        <div key={filter.id} class={styles.stackRow}>
                          <NSelect
                            class={styles.stackField}
                            value={filter.field}
                            options={this.columnSelectOptions}
                            placeholder='字段'
                            filterable
                            onUpdateValue={(value) => {
                              filter.field = value as string
                            }}
                          />
                          <NSelect
                            class={styles.stackOperator}
                            value={filter.operator}
                            options={FILTER_OPERATOR_OPTIONS}
                            onUpdateValue={(value) => {
                              filter.operator = value as FilterOperator
                            }}
                          />
                          <NInput
                            value={filter.value}
                            placeholder='值'
                            onUpdateValue={(value) => {
                              filter.value = value
                            }}
                          />
                          <button
                            class={styles.inlineIconButton}
                            onClick={() => this.removeFilterRow(filter.id)}
                          >
                            <NIcon size={14}>
                              <MinusCircleOutlined />
                            </NIcon>
                          </button>
                        </div>
                      ))
                    ) : (
                      <div class={styles.placeholderLine}>暂未设置筛选条件</div>
                    )}
                  </div>
                  <NButton
                    size='small'
                    type='primary'
                    ghost
                    disabled={!this.state.selectedTable}
                    onClick={() => void this.runPreview(1)}
                  >
                    应用筛选
                  </NButton>
                </section>
              ) : null}

              {this.state.activePanel === 'sorts' ? (
                <section class={styles.configSection}>
                  <div class={styles.sectionHeader}>
                    <span class={styles.sectionTitle}>排序字段</span>
                    <NButton size='tiny' quaternary onClick={() => this.addSortRow()}>
                      {{
                        icon: () => (
                          <NIcon>
                            <PlusOutlined />
                          </NIcon>
                        ),
                        default: () => '新增'
                      }}
                    </NButton>
                  </div>
                  <div class={styles.stackList}>
                    {this.state.sorts.length ? (
                      this.state.sorts.map((sort) => (
                        <div key={sort.id} class={styles.stackRow}>
                          <NSelect
                            class={styles.stackField}
                            value={sort.field}
                            options={this.columnSelectOptions}
                            placeholder='字段'
                            filterable
                            onUpdateValue={(value) => {
                              sort.field = value as string
                            }}
                          />
                          <NSelect
                            class={styles.stackOperator}
                            value={sort.direction}
                            options={SORT_DIRECTION_OPTIONS}
                            onUpdateValue={(value) => {
                              sort.direction = value as 'ASC' | 'DESC'
                            }}
                          />
                          <div class={styles.stackRowHint}>支持多字段顺序叠加</div>
                          <button
                            class={styles.inlineIconButton}
                            onClick={() => this.removeSortRow(sort.id)}
                          >
                            <NIcon size={14}>
                              <MinusCircleOutlined />
                            </NIcon>
                          </button>
                        </div>
                      ))
                    ) : (
                      <div class={styles.placeholderLine}>暂未设置排序</div>
                    )}
                  </div>
                  <NButton
                    size='small'
                    type='primary'
                    ghost
                    disabled={!this.state.selectedTable}
                    onClick={() => void this.runPreview(1)}
                  >
                    应用排序
                  </NButton>
                </section>
              ) : null}

              {this.state.activePanel === 'joins' ? (
                <section class={styles.configSection}>
                  <div class={styles.sectionHeader}>
                    <span class={styles.sectionTitle}>关联表</span>
                    <NButton size='tiny' quaternary onClick={() => this.addJoinConfig()}>
                      {{
                        icon: () => (
                          <NIcon>
                            <PlusOutlined />
                          </NIcon>
                        ),
                        default: () => '添加另一张关联表'
                      }}
                    </NButton>
                  </div>
                  <div class={styles.joinModeTabs}>
                    <button
                      class={[
                        styles.joinMode,
                        this.state.joinMode === 'manual' ? styles.joinModeActive : ''
                      ]}
                      onClick={() => {
                        this.state.joinMode = 'manual'
                      }}
                    >
                      手动关联
                    </button>
                    <button
                      class={[
                        styles.joinMode,
                        this.state.joinMode === 'lookup' ? styles.joinModeActive : ''
                      ]}
                      onClick={() => {
                        this.state.joinMode = 'lookup'
                      }}
                    >
                      Lookup 关联
                    </button>
                  </div>
                  {this.state.joinMode === 'manual' ? (
                    <div class={styles.joinList}>
                      {this.state.joinConfigs.map((join, index) => (
                        <div key={join.id} class={styles.joinCard}>
                          <div class={styles.joinCardHead}>
                            <span class={styles.joinCardTitle}>关联 {index + 1}</span>
                            <button
                              class={styles.linkButton}
                              onClick={() => this.removeJoinConfig(join.id)}
                            >
                              删除
                            </button>
                          </div>
                          <div class={styles.formGrid}>
                            <label class={styles.formField}>
                              <span>关联表</span>
                              <NSelect
                                value={join.table}
                                options={JOIN_TABLE_OPTIONS}
                                size='small'
                                onUpdateValue={(value) =>
                                  this.handleJoinTableChange(join, value as JoinConfig['table'])
                                }
                              />
                            </label>
                            <label class={styles.formField}>
                              <span>主表字段</span>
                              <NSelect
                                value={join.mainField}
                                options={this.columnSelectOptions}
                                size='small'
                                filterable
                                onUpdateValue={(value) => {
                                  join.mainField = value as string
                                  this.state.viewDirty = true
                                }}
                              />
                            </label>
                            <label class={styles.formField}>
                              <span>关联表字段</span>
                              <NSelect
                                value={join.targetField}
                                options={[
                                  { label: join.table === 'dept_dict' ? 'dept_name（部门名称）' : 'city_name（城市名称）', value: join.table === 'dept_dict' ? 'dept_name' : 'city_name' }
                                ]}
                                size='small'
                                onUpdateValue={(value) => {
                                  join.targetField = value as string
                                  this.state.viewDirty = true
                                }}
                              />
                            </label>
                            <label class={styles.formField}>
                              <span>关联类型</span>
                              <NSelect
                                value={join.type}
                                options={JOIN_TYPE_OPTIONS}
                                size='small'
                                onUpdateValue={(value) => {
                                  join.type = value as 'LEFT' | 'INNER'
                                  this.state.viewDirty = true
                                }}
                              />
                            </label>
                          </div>
                          <div class={styles.joinFields}>
                            <span class={styles.formLabel}>展示关联字段</span>
                            {JOIN_TABLE_FIELD_OPTIONS[join.table].map((fieldKey) => (
                              <NCheckbox
                                key={fieldKey}
                                checked={join.visibleFields.includes(fieldKey)}
                                onUpdateChecked={(checked) => {
                                  if (checked) {
                                    join.visibleFields = [...new Set([...join.visibleFields, fieldKey])]
                                  } else {
                                    join.visibleFields = join.visibleFields.filter((item) => item !== fieldKey)
                                  }
                                  this.state.viewDirty = true
                                }}
                              >
                                {`${fieldKey} · ${JOIN_FIELD_METAS[fieldKey]?.comment || ''}`}
                              </NCheckbox>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div class={styles.lookupFlow}>
                      <div><b>1</b> 选择主表关联记录字段：owner_dept / city</div>
                      <div><b>2</b> 选择目标表：dept_dict / region_dict</div>
                      <div><b>3</b> 勾选要查回的字段：部门编码、负责人、区域等级</div>
                      <div class={styles.placeholderLine}>Lookup 方式会复用上方关联配置，只是把 JOIN 概念弱化为“查回字段”。</div>
                    </div>
                  )}
                  <div class={styles.drawerActions}>
                    <NButton size='small' onClick={() => this.clearJoin()}>
                      清除关联
                    </NButton>
                    <NButton size='small' type='primary' onClick={() => this.applyJoin()}>
                      应用关联
                    </NButton>
                  </div>
                </section>
              ) : null}
          </aside>
        ) : null}

        {this.state.cellMenu.visible ? (
          <div
            class={styles.contextMenu}
            style={{ left: `${this.state.cellMenu.x}px`, top: `${this.state.cellMenu.y}px` }}
            onClick={(event) => event.stopPropagation()}
          >
            <button onClick={() => void this.copyCellValue()}>复制单元格值</button>
            <button onClick={() => void this.copyRowJson()}>复制整行 JSON</button>
            <button
              onClick={() =>
                void this.addCellFilter(
                  this.state.cellMenu.field,
                  this.state.cellMenu.value,
                  false
                )
              }
            >
              仅看此值
            </button>
            <button
              onClick={() =>
                void this.addCellFilter(
                  this.state.cellMenu.field,
                  this.state.cellMenu.value,
                  true
                )
              }
            >
              排除此值
            </button>
            <button
              onClick={() =>
                this.showCellDetail(this.state.cellMenu.field, this.state.cellMenu.value)
              }
            >
              查看完整内容
            </button>
          </div>
        ) : null}

        {this.state.cellDetailVisible ? (
          <div class={styles.modalMask}>
            <div class={styles.detailDialog}>
              <div class={styles.detailHeader}>
                <span>{this.state.cellDetailTitle}</span>
                <button
                  class={styles.drawerClose}
                  onClick={() => {
                    this.state.cellDetailVisible = false
                  }}
                >
                  ×
                </button>
              </div>
              <pre class={styles.detailBody}>{this.state.cellDetailValue || 'NULL'}</pre>
              <div class={styles.drawerActions}>
                <NButton
                  size='small'
                  onClick={async () => {
                    await navigator.clipboard.writeText(this.state.cellDetailValue)
                    window.$message.success('已复制完整内容。')
                  }}
                >
                  复制
                </NButton>
                <NButton
                  size='small'
                  type='primary'
                  onClick={() => {
                    this.state.cellDetailVisible = false
                  }}
                >
                  关闭
                </NButton>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    )
  }
})
