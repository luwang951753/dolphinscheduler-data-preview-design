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

package org.apache.dolphinscheduler.api.service;

import org.apache.dolphinscheduler.api.dto.DatasourceColumnDto;
import org.apache.dolphinscheduler.api.dto.DatasourceTableCreateRequest;
import org.apache.dolphinscheduler.api.dto.DataPreviewQueryRequest;
import org.apache.dolphinscheduler.api.dto.DataPreviewQueryResult;
import org.apache.dolphinscheduler.api.dto.DataPreviewViewRequest;
import org.apache.dolphinscheduler.api.dto.DataPreviewViewResponse;
import org.apache.dolphinscheduler.api.utils.PageInfo;
import org.apache.dolphinscheduler.dao.entity.DataSource;
import org.apache.dolphinscheduler.dao.entity.User;
import org.apache.dolphinscheduler.plugin.datasource.api.datasource.BaseDataSourceParamDTO;
import org.apache.dolphinscheduler.spi.datasource.ConnectionParam;
import org.apache.dolphinscheduler.spi.enums.DbType;
import org.apache.dolphinscheduler.spi.params.base.ParamsOptions;

import java.util.List;

/**
 * data source service
 */
public interface DataSourceService {

    /**
     * create data source
     *
     * @param loginUser login user
     * @param datasourceParam datasource parameter
     * @return create result code
     */
    DataSource createDataSource(User loginUser, BaseDataSourceParamDTO datasourceParam);

    /**
     * updateWorkflowInstance datasource
     *
     * @param loginUser login user
     * @param dataSourceParam data source params
     * @return update result code
     */
    DataSource updateDataSource(User loginUser, BaseDataSourceParamDTO dataSourceParam);

    /**
     * updateWorkflowInstance datasource
     *
     * @param id datasource id
     * @return data source detail
     */
    BaseDataSourceParamDTO queryDataSource(int id, User loginUser);

    /**
     * query datasource list by keyword
     *
     * @param loginUser login user
     * @param searchVal search value
     * @param pageNo    page number
     * @param pageSize  page size
     * @return data source list page
     */
    PageInfo<DataSource> queryDataSourceListPaging(User loginUser, String searchVal, Integer pageNo, Integer pageSize);

    /**
     * query data resource list
     *
     * @param loginUser login user
     * @param type      data source type
     * @return data source list page
     */
    List<DataSource> queryDataSourceList(User loginUser, Integer type);

    /**
     * verify datasource exists
     *
     * @param name      datasource name
     * @return true if data datasource not exists, otherwise return false
     */
    void verifyDataSourceName(String name);

    /**
     * check connection
     *
     * @param type      data source type
     * @param parameter data source parameters
     * @return true if connect successfully, otherwise false
     */
    void checkConnection(DbType type, ConnectionParam parameter);

    /**
     * test connection
     *
     * @param id datasource id
     * @return connect result code
     */
    void connectionTest(int id);

    /**
     * delete datasource
     *
     * @param loginUser    login user
     * @param datasourceId data source id
     * @return delete result code
     */
    void delete(User loginUser, int datasourceId);

    /**
     * unauthorized datasource
     *
     * @param loginUser login user
     * @param userId    user id
     * @return unauthed data source result code
     */
    List<DataSource> unAuthDatasource(User loginUser, Integer userId);

    /**
     * authorized datasource
     *
     * @param loginUser login user
     * @param userId    user id
     * @return authorized result code
     */
    List<DataSource> authedDatasource(User loginUser, Integer userId);

    /**
     * get tables
     * @param datasourceId
     * @param database
     * @return
     */
    List<ParamsOptions> getTables(Integer datasourceId, String database);

    /**
     * get table columns
     * @param datasourceId
     * @param database
     * @param tableName
     * @return
     */
    List<ParamsOptions> getTableColumns(Integer datasourceId, String database, String tableName);

    /**
     * get table columns with type metadata
     *
     * @param datasourceId datasource id
     * @param database database name
     * @param tableName table name
     * @return column metadata list
     */
    List<DatasourceColumnDto> getTableColumnMetas(Integer datasourceId, String database, String tableName);

    /**
     * preview table data with readonly structured filters and sorts
     *
     * @param loginUser login user
     * @param request data preview query request
     * @return preview query result
     */
    DataPreviewQueryResult previewData(User loginUser, DataPreviewQueryRequest request);

    /**
     * query current user's saved data preview views for one table
     *
     * @param loginUser login user
     * @param datasourceId datasource id
     * @param database database name
     * @param schema schema name
     * @param tableName table name
     * @return saved view list
     */
    List<DataPreviewViewResponse> queryDataPreviewViews(User loginUser,
                                                        Integer datasourceId,
                                                        String database,
                                                        String schema,
                                                        String tableName);

    /**
     * create current user's saved data preview view
     *
     * @param loginUser login user
     * @param request saved view request
     * @return created saved view
     */
    DataPreviewViewResponse createDataPreviewView(User loginUser, DataPreviewViewRequest request);

    /**
     * update current user's saved data preview view
     *
     * @param loginUser login user
     * @param id saved view id
     * @param request saved view request
     * @return updated saved view
     */
    DataPreviewViewResponse updateDataPreviewView(User loginUser, Integer id, DataPreviewViewRequest request);

    /**
     * delete current user's saved data preview view
     *
     * @param loginUser login user
     * @param id saved view id
     */
    void deleteDataPreviewView(User loginUser, Integer id);

    /**
     * create target table by column definitions
     *
     * @param request create table request
     * @return create table ddl
     */
    String createTableByColumns(DatasourceTableCreateRequest request);

    /**
     * preview target table ddl by column definitions
     *
     * @param request create table request
     * @return preview ddl
     */
    String previewCreateTableSql(DatasourceTableCreateRequest request);

    /**
     * execute custom ddl on target datasource
     *
     * @param request create table request with ddl
     * @return executed ddl
     */
    String executeTableDdl(DatasourceTableCreateRequest request);

    /**
     * get databases
     * @param datasourceId
     * @return
     */
    List<ParamsOptions> getDatabases(Integer datasourceId);
}
