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

import { axios } from '@/service/service'
import {
  ListReq,
  IDataSource,
  UserIdReq,
  TypeReq,
  NameReq,
  IdReq,
  IDataPreviewQueryRequest,
  IDataPreviewViewRequest
} from './types'

export function queryDataSourceListPaging(params: ListReq): any {
  return axios({
    url: '/datasources',
    method: 'get',
    params
  })
}

export function createDataSource(data: IDataSource): any {
  return axios({
    url: '/datasources',
    method: 'post',
    data,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8'
    },
    transformRequest: (params) => JSON.stringify(params)
  })
}

export function authedDatasource(params: UserIdReq): any {
  return axios({
    url: '/datasources/authed-datasource',
    method: 'get',
    params
  })
}

export function connectDataSource(data: IDataSource): any {
  return axios({
    url: '/datasources/connect',
    method: 'post',
    data,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8'
    },
    transformRequest: (params) => JSON.stringify(params)
  })
}

export function getKerberosStartupState(): any {
  return axios({
    url: '/datasources/kerberos-startup-state',
    method: 'get'
  })
}

export function queryDataSourceList(params: TypeReq): any {
  return axios({
    url: '/datasources/list',
    method: 'get',
    params
  })
}

export function unAuthDatasource(params: UserIdReq): any {
  return axios({
    url: '/datasources/unauth-datasource',
    method: 'get',
    params
  })
}

export function verifyDataSourceName(params: NameReq): any {
  return axios({
    url: '/datasources/verify-name',
    method: 'get',
    params
  })
}

export function queryDataSource(id: IdReq): any {
  return axios({
    url: `/datasources/${id}`,
    method: 'get'
  })
}

export function updateDataSource(data: IDataSource, id: IdReq): any {
  return axios({
    url: `/datasources/${id}`,
    method: 'put',
    data,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8'
    },
    transformRequest: (params) => JSON.stringify(params)
  })
}

export function deleteDataSource(id: IdReq): any {
  return axios({
    url: `/datasources/${id}`,
    method: 'delete'
  })
}

export function connectionTest(id: IdReq): any {
  return axios({
    url: `/datasources/${id}/connect-test`,
    method: 'get'
  })
}

export function getDatasourceDatabasesById(datasourceId: number): any {
  return axios({
    url: '/datasources/databases',
    method: 'get',
    params: {
      datasourceId
    }
  })
}

export function getDatasourceTablesById(
  datasourceId: number,
  database: string
): any {
  return axios({
    url: '/datasources/tables',
    method: 'get',
    params: {
      datasourceId,
      database
    }
  })
}
export function getDatasourceTableColumnsById(
  datasourceId: number,
  database: string,
  tableName: string
): any {
  return axios({
    url: '/datasources/tableColumns',
    method: 'get',
    params: {
      datasourceId,
      database,
      tableName
    }
  })
}

export function getDatasourceTableColumnMetasById(
  datasourceId: number,
  database: string,
  tableName: string
): any {
  return axios({
    url: '/datasources/tableColumnMetas',
    method: 'get',
    params: {
      datasourceId,
      database,
      tableName
    }
  })
}

export function createDatasourceTargetTable(data: {
  datasourceId: number
  database: string
  schema?: string
  tableName: string
  ddl?: string
  columns: Array<{
    sourceColumn: string
    sourceType: string
    sourceComment?: string
    targetColumn: string
    targetType: string
    targetComment?: string
    nullable?: boolean
    primaryKey?: boolean
  }>
}): any {
  return axios({
    url: '/datasources/create-target-table',
    method: 'post',
    data,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8'
    },
    transformRequest: (params) => JSON.stringify(params)
  })
}

export function previewDatasourceTargetTable(data: {
  datasourceId: number
  database: string
  schema?: string
  tableName: string
  columns: Array<{
    sourceColumn: string
    sourceType: string
    sourceComment?: string
    targetColumn: string
    targetType: string
    targetComment?: string
    nullable?: boolean
    primaryKey?: boolean
  }>
}): any {
  return axios({
    url: '/datasources/preview-target-table',
    method: 'post',
    data,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8'
    },
    transformRequest: (params) => JSON.stringify(params)
  })
}

export function previewDatasourceTableData(
  data: IDataPreviewQueryRequest
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

export function queryDataPreviewViews(params: {
  datasourceId: number
  database: string
  schema?: string
  tableName: string
}): any {
  return axios({
    url: '/datasources/preview-views',
    method: 'get',
    params
  })
}

export function createDataPreviewView(data: IDataPreviewViewRequest): any {
  return axios({
    url: '/datasources/preview-views',
    method: 'post',
    data,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8'
    },
    transformRequest: (params) => JSON.stringify(params)
  })
}

export function updateDataPreviewView(
  id: number,
  data: IDataPreviewViewRequest
): any {
  return axios({
    url: `/datasources/preview-views/${id}`,
    method: 'put',
    data,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8'
    },
    transformRequest: (params) => JSON.stringify(params)
  })
}

export function deleteDataPreviewView(id: number): any {
  return axios({
    url: `/datasources/preview-views/${id}`,
    method: 'delete'
  })
}
