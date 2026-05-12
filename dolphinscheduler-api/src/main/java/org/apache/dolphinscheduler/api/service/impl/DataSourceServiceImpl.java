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

package org.apache.dolphinscheduler.api.service.impl;

import static org.apache.dolphinscheduler.api.constants.ApiFuncIdentificationConstant.DATASOURCE_DELETE;
import static org.apache.dolphinscheduler.api.constants.ApiFuncIdentificationConstant.DATASOURCE_UPDATE;

import org.apache.dolphinscheduler.api.constants.ApiFuncIdentificationConstant;
import org.apache.dolphinscheduler.api.dto.DataPreviewQueryRequest;
import org.apache.dolphinscheduler.api.dto.DataPreviewQueryResult;
import org.apache.dolphinscheduler.api.dto.DataPreviewViewRequest;
import org.apache.dolphinscheduler.api.dto.DataPreviewViewResponse;
import org.apache.dolphinscheduler.api.dto.DatasourceColumnDto;
import org.apache.dolphinscheduler.api.dto.DatasourceTableCreateRequest;
import org.apache.dolphinscheduler.api.enums.Status;
import org.apache.dolphinscheduler.api.exceptions.ServiceException;
import org.apache.dolphinscheduler.api.service.DataSourceService;
import org.apache.dolphinscheduler.api.utils.PageInfo;
import org.apache.dolphinscheduler.common.constants.Constants;
import org.apache.dolphinscheduler.common.enums.AuthorizationType;
import org.apache.dolphinscheduler.common.enums.UserType;
import org.apache.dolphinscheduler.common.utils.JSONUtils;
import org.apache.dolphinscheduler.dao.entity.DataSource;
import org.apache.dolphinscheduler.dao.entity.DataPreviewView;
import org.apache.dolphinscheduler.dao.entity.User;
import org.apache.dolphinscheduler.dao.mapper.DataSourceMapper;
import org.apache.dolphinscheduler.dao.mapper.DataPreviewViewMapper;
import org.apache.dolphinscheduler.dao.mapper.DataSourceUserMapper;
import org.apache.dolphinscheduler.plugin.datasource.api.datasource.BaseDataSourceParamDTO;
import org.apache.dolphinscheduler.plugin.datasource.api.datasource.DataSourceProcessor;
import org.apache.dolphinscheduler.plugin.datasource.api.utils.DataSourceUtils;
import org.apache.dolphinscheduler.spi.datasource.BaseConnectionParam;
import org.apache.dolphinscheduler.spi.datasource.ConnectionParam;
import org.apache.dolphinscheduler.spi.enums.DbType;
import org.apache.dolphinscheduler.spi.params.base.ParamsOptions;

import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.lang3.StringUtils;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * data source service impl
 */
@Service
public class DataSourceServiceImpl extends BaseServiceImpl implements DataSourceService {

    private static final Logger log = LoggerFactory.getLogger(DataSourceServiceImpl.class);

    @Autowired
    private DataSourceMapper dataSourceMapper;

    @Autowired
    private DataSourceUserMapper datasourceUserMapper;

    @Autowired
    private DataPreviewViewMapper dataPreviewViewMapper;

    private static final String TABLE = "TABLE";
    private static final String VIEW = "VIEW";
    private static final String[] TABLE_TYPES = new String[]{TABLE, VIEW};
    private static final String TABLE_NAME = "TABLE_NAME";
    private static final String COLUMN_NAME = "COLUMN_NAME";
    private static final String TARGET_TABLE_EXISTS_PREFIX = "-- DS_TARGET_TABLE_ALREADY_EXISTS";
    private static final int DATA_PREVIEW_DEFAULT_PAGE_SIZE = 50;
    private static final int DATA_PREVIEW_MAX_PAGE_SIZE = 200;
    private static final int DATA_PREVIEW_MAX_FILTERS = 10;
    private static final int DATA_PREVIEW_MAX_SORTS = 5;
    private static final int DATA_PREVIEW_MAX_VIEW_NAME_LENGTH = 30;
    private static final int DATA_PREVIEW_MAX_VIEW_CONFIG_LENGTH = 20000;
    private static final DateTimeFormatter DATA_PREVIEW_TIME_FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /**
     * create data source
     *
     * @param loginUser       login user
     * @param datasourceParam datasource parameters
     * @return create result code
     */
    @Override
    public DataSource createDataSource(User loginUser, BaseDataSourceParamDTO datasourceParam) {
        DataSourceUtils.checkDatasourceParam(datasourceParam);
        if (!canOperatorPermissions(loginUser, null, AuthorizationType.DATASOURCE,
                ApiFuncIdentificationConstant.DATASOURCE_CREATE_DATASOURCE)) {
            throw new ServiceException(Status.USER_NO_OPERATION_PERM);
        }
        // check name can use or not
        if (checkName(datasourceParam.getName())) {
            throw new ServiceException(Status.DATASOURCE_EXIST);
        }
        if (checkDescriptionLength(datasourceParam.getNote())) {
            throw new ServiceException(Status.DESCRIPTION_TOO_LONG_ERROR);
        }
        ConnectionParam connectionParam = DataSourceUtils.buildConnectionParams(datasourceParam);

        // build datasource
        DataSource dataSource = new DataSource();
        Date now = new Date();

        dataSource.setName(datasourceParam.getName().trim());
        dataSource.setNote(datasourceParam.getNote());
        dataSource.setUserId(loginUser.getId());
        dataSource.setUserName(loginUser.getUserName());
        dataSource.setType(datasourceParam.getType());
        dataSource.setConnectionParams(JSONUtils.toJsonString(connectionParam));
        dataSource.setCreateTime(now);
        dataSource.setUpdateTime(now);
        try {
            dataSourceMapper.insert(dataSource);
            return dataSource;
        } catch (DuplicateKeyException ex) {
            throw new ServiceException(Status.DATASOURCE_EXIST);
        }
    }

    /**
     * updateWorkflowInstance datasource
     *
     * @param loginUser login user
     * @return update result code
     */
    @Override
    public DataSource updateDataSource(User loginUser, BaseDataSourceParamDTO dataSourceParam) {
        DataSourceUtils.checkDatasourceParam(dataSourceParam);
        // determine whether the data source exists
        DataSource dataSource = dataSourceMapper.selectById(dataSourceParam.getId());
        if (dataSource == null) {
            throw new ServiceException(Status.RESOURCE_NOT_EXIST);
        }

        if (!canOperatorPermissions(loginUser, new Object[]{dataSource.getId()}, AuthorizationType.DATASOURCE,
                DATASOURCE_UPDATE)) {
            throw new ServiceException(Status.USER_NO_OPERATION_PERM);
        }

        // check name can use or not
        if (!dataSourceParam.getName().trim().equals(dataSource.getName()) && checkName(dataSourceParam.getName())) {
            throw new ServiceException(Status.DATASOURCE_EXIST);
        }
        if (checkDescriptionLength(dataSourceParam.getNote())) {
            throw new ServiceException(Status.DESCRIPTION_TOO_LONG_ERROR);
        }
        // check password，if the password is not updated, set to the old password.
        ConnectionParam connectionParam = DataSourceUtils.buildConnectionParams(dataSourceParam);

        String password = connectionParam.getPassword();

        if (StringUtils.isBlank(password)) {
            String oldConnectionParams = dataSource.getConnectionParams();
            ObjectNode oldParams = JSONUtils.parseObject(oldConnectionParams);
            connectionParam.setPassword(oldParams.path(Constants.PASSWORD).asText());
        }

        Date now = new Date();

        dataSource.setName(dataSourceParam.getName().trim());
        dataSource.setNote(dataSourceParam.getNote());
        dataSource.setUserName(loginUser.getUserName());
        dataSource.setType(dataSource.getType());
        dataSource.setConnectionParams(JSONUtils.toJsonString(connectionParam));
        dataSource.setUpdateTime(now);
        try {
            dataSourceMapper.updateById(dataSource);
            return dataSource;
        } catch (DuplicateKeyException ex) {
            throw new ServiceException(Status.DATASOURCE_EXIST);
        }
    }

    private boolean checkName(String name) {
        List<DataSource> queryDataSource = dataSourceMapper.queryDataSourceByName(name.trim());
        return queryDataSource != null && !queryDataSource.isEmpty();
    }

    /**
     * updateWorkflowInstance datasource
     *
     * @param id datasource id
     * @return data source detail
     */
    @Override
    public BaseDataSourceParamDTO queryDataSource(int id, User loginUser) {
        DataSource dataSource = dataSourceMapper.selectById(id);
        if (dataSource == null) {
            log.error("Datasource does not exist, id:{}.", id);
            throw new ServiceException(Status.RESOURCE_NOT_EXIST);
        }

        if (!canOperatorPermissions(loginUser, new Object[]{dataSource.getId()}, AuthorizationType.DATASOURCE,
                ApiFuncIdentificationConstant.DATASOURCE)) {
            throw new ServiceException(Status.USER_NO_OPERATION_PERM);
        }

        // type
        BaseDataSourceParamDTO baseDataSourceParamDTO = DataSourceUtils.buildDatasourceParamDTO(
                dataSource.getType(), dataSource.getConnectionParams());
        baseDataSourceParamDTO.setId(dataSource.getId());
        baseDataSourceParamDTO.setName(dataSource.getName());
        baseDataSourceParamDTO.setNote(dataSource.getNote());
        baseDataSourceParamDTO.setPassword(getHiddenPassword());

        return baseDataSourceParamDTO;
    }

    /**
     * query datasource list by keyword
     *
     * @param loginUser login user
     * @param searchVal search value
     * @param pageNo page number
     * @param pageSize page size
     * @return data source list page
     */
    @Override
    public PageInfo<DataSource> queryDataSourceListPaging(User loginUser, String searchVal, Integer pageNo,
                                                          Integer pageSize) {
        IPage<DataSource> dataSourceList;
        Page<DataSource> dataSourcePage = new Page<>(pageNo, pageSize);
        PageInfo<DataSource> pageInfo = new PageInfo<>(pageNo, pageSize);
        if (loginUser.getUserType().equals(UserType.ADMIN_USER)) {
            dataSourceList = dataSourceMapper.selectPaging(dataSourcePage, 0, searchVal);
        } else {
            Set<Integer> ids = resourcePermissionCheckService
                    .userOwnedResourceIdsAcquisition(AuthorizationType.DATASOURCE, loginUser.getId(), log);
            if (ids.isEmpty()) {
                return pageInfo;
            }
            dataSourceList = dataSourceMapper.selectPagingByIds(dataSourcePage, new ArrayList<>(ids), searchVal);
        }

        List<DataSource> dataSources = dataSourceList != null ? dataSourceList.getRecords() : new ArrayList<>();
        handlePasswd(dataSources);
        pageInfo.setTotal((int) (dataSourceList != null ? dataSourceList.getTotal() : 0L));
        pageInfo.setTotalList(dataSources);
        return pageInfo;
    }

    /**
     * handle datasource connection password for safety
     */
    private void handlePasswd(List<DataSource> dataSourceList) {
        for (DataSource dataSource : dataSourceList) {
            String connectionParams = dataSource.getConnectionParams();
            ObjectNode object = JSONUtils.parseObject(connectionParams);
            object.put(Constants.PASSWORD, getHiddenPassword());
            dataSource.setConnectionParams(object.toString());
        }
    }

    /**
     * get hidden password (resolve the security hotspot)
     *
     * @return hidden password
     */
    private String getHiddenPassword() {
        return Constants.XXXXXX;
    }

    /**
     * query data resource list
     *
     * @param loginUser login user
     * @param type data source type
     * @return data source list page
     */
    @Override
    public List<DataSource> queryDataSourceList(User loginUser, Integer type) {

        List<DataSource> datasourceList;
        if (loginUser.getUserType().equals(UserType.ADMIN_USER)) {
            datasourceList = dataSourceMapper.queryDataSourceByType(0, type);
        } else {
            Set<Integer> ids = resourcePermissionCheckService
                    .userOwnedResourceIdsAcquisition(AuthorizationType.DATASOURCE, loginUser.getId(), log);
            if (ids.isEmpty()) {
                return Collections.emptyList();
            }
            datasourceList = dataSourceMapper.selectBatchIds(ids).stream()
                    .filter(dataSource -> dataSource.getType().getCode() == type).collect(Collectors.toList());
        }

        return datasourceList;
    }

    /**
     * verify datasource exists
     *
     * @param name datasource name
     * @return true if data datasource not exists, otherwise return false
     */
    @Override
    public void verifyDataSourceName(String name) {
        List<DataSource> dataSourceList = dataSourceMapper.queryDataSourceByName(name);
        if (dataSourceList != null && !dataSourceList.isEmpty()) {
            throw new ServiceException(Status.DATASOURCE_EXIST);
        }
    }

    /**
     * check connection
     *
     * @param type            data source type
     * @param connectionParam connectionParam
     * @return true if connect successfully, otherwise false
     * @return true if connect successfully, otherwise false
     */
    @Override
    public void checkConnection(DbType type, ConnectionParam connectionParam) {
        DataSourceProcessor sshDataSourceProcessor = DataSourceUtils.getDatasourceProcessor(type);
        boolean connectivity = sshDataSourceProcessor.checkDataSourceConnectivity(connectionParam);
        if (connectivity) {
            return;
        }
        throw new ServiceException(Status.CONNECTION_TEST_FAILURE);
    }

    /**
     * test connection
     *
     * @param id datasource id
     * @return connect result code
     */
    @Override
    public void connectionTest(int id) {
        DataSource dataSource = dataSourceMapper.selectById(id);
        if (dataSource == null) {
            throw new ServiceException(Status.RESOURCE_NOT_EXIST);
        }
        checkConnection(dataSource.getType(),
                DataSourceUtils.buildConnectionParams(dataSource.getType(), dataSource.getConnectionParams()));
    }

    /**
     * delete datasource
     *
     * @param loginUser    login user
     * @param datasourceId data source id
     * @return delete result code
     */
    @Override
    @Transactional
    public void delete(User loginUser, int datasourceId) {
        // query datasource by id
        DataSource dataSource = dataSourceMapper.selectById(datasourceId);
        if (dataSource == null) {
            throw new ServiceException(Status.RESOURCE_NOT_EXIST);
        }
        if (!canOperatorPermissions(loginUser, new Object[]{dataSource.getId()}, AuthorizationType.DATASOURCE,
                DATASOURCE_DELETE)) {
            throw new ServiceException(Status.USER_NO_OPERATION_PERM);
        }
        dataSourceMapper.deleteById(datasourceId);
        datasourceUserMapper.deleteByDatasourceId(datasourceId);
    }

    /**
     * unauthorized datasource
     *
     * @param loginUser login user
     * @param userId user id
     * @return unauthed data source result code
     */
    @Override
    public List<DataSource> unAuthDatasource(User loginUser, Integer userId) {
        List<DataSource> datasourceList;
        if (canOperatorPermissions(loginUser, null, AuthorizationType.DATASOURCE, null)) {
            // admin gets all data sources except userId
            datasourceList = dataSourceMapper.queryDatasourceExceptUserId(userId);
        } else {
            // non-admins users get their own data sources
            datasourceList = dataSourceMapper.selectByMap(Collections.singletonMap("user_id", loginUser.getId()));
        }
        List<DataSource> resultList = new ArrayList<>();
        Set<DataSource> datasourceSet;
        if (datasourceList != null && !datasourceList.isEmpty()) {
            datasourceSet = new HashSet<>(datasourceList);

            List<DataSource> authedDataSourceList = dataSourceMapper.queryAuthedDatasource(userId);

            Set<DataSource> authedDataSourceSet;
            if (authedDataSourceList != null && !authedDataSourceList.isEmpty()) {
                authedDataSourceSet = new HashSet<>(authedDataSourceList);
                datasourceSet.removeAll(authedDataSourceSet);
            }
            resultList = new ArrayList<>(datasourceSet);
        }
        return resultList;
    }

    /**
     * authorized datasource
     *
     * @param loginUser login user
     * @param userId user id
     * @return authorized result code
     */
    @Override
    public List<DataSource> authedDatasource(User loginUser, Integer userId) {
        List<DataSource> authedDatasourceList = dataSourceMapper.queryAuthedDatasource(userId);
        return authedDatasourceList;
    }

    @Override
    public List<ParamsOptions> getTables(Integer datasourceId, String database) {
        DataSource dataSource = dataSourceMapper.selectById(datasourceId);

        List<String> tableList;
        BaseConnectionParam connectionParam =
                (BaseConnectionParam) DataSourceUtils.buildConnectionParams(
                        dataSource.getType(),
                        dataSource.getConnectionParams());

        if (null == connectionParam) {
            throw new ServiceException(Status.DATASOURCE_CONNECT_FAILED);
        }

        Connection connection =
                DataSourceUtils.getConnection(dataSource.getType(), connectionParam);
        ResultSet tables = null;

        try {

            if (null == connection) {
                throw new ServiceException(Status.DATASOURCE_CONNECT_FAILED);
            }

            DatabaseMetaData metaData = connection.getMetaData();
            String schema = null;
            try {
                schema = metaData.getConnection().getSchema();
            } catch (SQLException e) {
                log.error("Cant not get the schema, datasourceId:{}.", datasourceId, e);
                throw new ServiceException(Status.GET_DATASOURCE_TABLES_ERROR);
            }

            tables = metaData.getTables(
                    database,
                    getDbSchemaPattern(dataSource.getType(), schema, connectionParam),
                    "%", TABLE_TYPES);
            if (null == tables) {
                log.error("Get datasource tables error, datasourceId:{}.", datasourceId);
                throw new ServiceException(Status.GET_DATASOURCE_TABLES_ERROR);
            }

            tableList = new ArrayList<>();
            while (tables.next()) {
                String name = tables.getString(TABLE_NAME);
                tableList.add(name);
            }

        } catch (Exception e) {
            log.error("Get datasource tables error, datasourceId:{}.", datasourceId, e);
            throw new ServiceException(Status.GET_DATASOURCE_TABLES_ERROR);
        } finally {
            closeResult(tables);
            releaseConnection(connection);
        }

        List<ParamsOptions> options = getParamsOptions(tableList);
        return options;
    }

    @Override
    public List<ParamsOptions> getTableColumns(Integer datasourceId, String database, String tableName) {
        DataSource dataSource = dataSourceMapper.selectById(datasourceId);
        BaseConnectionParam connectionParam =
                (BaseConnectionParam) DataSourceUtils.buildConnectionParams(
                        dataSource.getType(),
                        dataSource.getConnectionParams());

        if (null == connectionParam) {
            throw new ServiceException(Status.DATASOURCE_CONNECT_FAILED);
        }

        Connection connection =
                DataSourceUtils.getConnection(dataSource.getType(), connectionParam);
        List<String> columnList = new ArrayList<>();
        ResultSet rs = null;

        try {
            if (null == connection) {
                throw new ServiceException(Status.DATASOURCE_CONNECT_FAILED);
            }

            DatabaseMetaData metaData = connection.getMetaData();
            String schema = null;
            try {
                schema = metaData.getConnection().getSchema();
            } catch (SQLException e) {
                log.error("Cant not get the schema, datasourceId:{}.", datasourceId, e);
                throw new ServiceException(Status.GET_DATASOURCE_TABLE_COLUMNS_ERROR);
            }

            if (dataSource.getType() == DbType.ORACLE) {
                database = null;
            }
            rs = metaData.getColumns(
                    database,
                    getDbSchemaPattern(dataSource.getType(), schema, connectionParam),
                    tableName,
                    "%");
            if (rs == null) {
                throw new ServiceException(Status.DATASOURCE_CONNECT_FAILED);
            }
            while (rs.next()) {
                columnList.add(rs.getString(COLUMN_NAME));
            }
        } catch (Exception e) {
            log.error("Get datasource table columns error, datasourceId:{}.", dataSource.getId(), e);
            throw new ServiceException(Status.DATASOURCE_CONNECT_FAILED);
        } finally {
            closeResult(rs);
            releaseConnection(connection);
        }

        List<ParamsOptions> options = getParamsOptions(columnList);
        return options;
    }

    @Override
    public List<DatasourceColumnDto> getTableColumnMetas(Integer datasourceId, String database, String tableName) {
        DataSource dataSource = dataSourceMapper.selectById(datasourceId);
        if (dataSource == null) {
            throw new ServiceException(Status.RESOURCE_NOT_EXIST);
        }
        BaseConnectionParam connectionParam =
                (BaseConnectionParam) DataSourceUtils.buildConnectionParams(
                        dataSource.getType(),
                        dataSource.getConnectionParams());

        if (null == connectionParam) {
            throw new ServiceException(Status.DATASOURCE_CONNECT_FAILED);
        }

        Connection connection =
                DataSourceUtils.getConnection(dataSource.getType(), connectionParam);
        List<DatasourceColumnDto> columnList = new ArrayList<>();
        ResultSet rs = null;
        ResultSet primaryKeyRs = null;

        try {
            if (null == connection) {
                throw new ServiceException(Status.DATASOURCE_CONNECT_FAILED);
            }
            if (dataSource.getType() == DbType.MYSQL) {
                return getMysqlTableColumnMetas(connection, database, tableName);
            }

            DatabaseMetaData metaData = connection.getMetaData();
            String schema = null;
            try {
                schema = metaData.getConnection().getSchema();
            } catch (SQLException e) {
                log.error("Cant not get the schema, datasourceId:{}.", datasourceId, e);
                throw new ServiceException(Status.GET_DATASOURCE_TABLE_COLUMNS_ERROR);
            }

            if (dataSource.getType() == DbType.ORACLE) {
                database = null;
            }
            Set<String> primaryKeyColumns = new HashSet<>();
            primaryKeyRs = metaData.getPrimaryKeys(
                    database,
                    getDbSchemaPattern(dataSource.getType(), schema, connectionParam),
                    tableName);
            while (primaryKeyRs != null && primaryKeyRs.next()) {
                primaryKeyColumns.add(primaryKeyRs.getString(COLUMN_NAME));
            }
            rs = metaData.getColumns(
                    database,
                    getDbSchemaPattern(dataSource.getType(), schema, connectionParam),
                    tableName,
                    "%");
            if (rs == null) {
                throw new ServiceException(Status.DATASOURCE_CONNECT_FAILED);
            }
            while (rs.next()) {
                String columnName = rs.getString(COLUMN_NAME);
                String typeName = rs.getString("TYPE_NAME");
                String comment = normalizeMetadataText(rs.getString("REMARKS"));
                int nullableValue = rs.getInt("NULLABLE");
                boolean nullable = nullableValue == DatabaseMetaData.columnNullable;
                boolean primaryKey = primaryKeyColumns.contains(columnName);
                columnList.add(new DatasourceColumnDto(columnName, typeName, nullable, primaryKey, comment));
            }
        } catch (Exception e) {
            log.error("Get datasource table column metas error, datasourceId:{}.", dataSource.getId(), e);
            throw new ServiceException(Status.DATASOURCE_CONNECT_FAILED);
        } finally {
            closeResult(rs);
            closeResult(primaryKeyRs);
            releaseConnection(connection);
        }

        return columnList;
    }

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
        // 首期真实页面先只开放 MySQL / PostgreSQL，避免不同方言的分页语法和元数据差异直接暴露给用户。
        if (dataSource.getType() != DbType.MYSQL && dataSource.getType() != DbType.POSTGRESQL) {
            throw new ServiceException(Status.DATA_PREVIEW_QUERY_ERROR);
        }
        if (!canOperatorPermissions(loginUser, new Object[]{dataSource.getId()}, AuthorizationType.DATASOURCE,
                ApiFuncIdentificationConstant.DATASOURCE)) {
            throw new ServiceException(Status.USER_NO_OPERATION_PERM);
        }

        List<DatasourceColumnDto> columns =
                getTableColumnMetas(request.getDatasourceId(), request.getDatabase(), request.getTableName());
        Set<String> allowedColumns = columns.stream()
                .map(DatasourceColumnDto::getName)
                .collect(Collectors.toCollection(LinkedHashSet::new));
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
        if (connection == null) {
            throw new ServiceException(Status.DATASOURCE_CONNECT_FAILED);
        }
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            // 只允许元数据白名单字段参与 SQL 组装，筛选值始终走预编译参数，避免任意 SQL 注入。
            for (int i = 0; i < parameters.size(); i++) {
                statement.setObject(i + 1, parameters.get(i));
            }
            try (ResultSet resultSet = statement.executeQuery()) {
                ResultSetMetaData metaData = resultSet.getMetaData();
                int columnCount = metaData.getColumnCount();
                while (resultSet.next()) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    for (int i = 1; i <= columnCount; i++) {
                        row.put(metaData.getColumnLabel(i), normalizePreviewCellValue(resultSet.getObject(i)));
                    }
                    rows.add(row);
                }
            }
        } catch (Exception ex) {
            log.error("Preview datasource table data error, datasourceId:{} table:{}.",
                    request.getDatasourceId(), request.getTableName(), ex);
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

    @Override
    public List<DataPreviewViewResponse> queryDataPreviewViews(User loginUser,
                                                              Integer datasourceId,
                                                              String database,
                                                              String schema,
                                                              String tableName) {
        validatePreviewViewScope(loginUser, datasourceId, database, schema, tableName);
        String normalizedSchema = normalizePreviewViewSchema(schema);
        List<DataPreviewView> views = dataPreviewViewMapper.selectList(new QueryWrapper<DataPreviewView>().lambda()
                .eq(DataPreviewView::getUserId, loginUser.getId())
                .eq(DataPreviewView::getDatasourceId, datasourceId)
                .eq(DataPreviewView::getDatabaseName, database)
                .eq(DataPreviewView::getSchemaName, normalizedSchema)
                .eq(DataPreviewView::getTableName, tableName)
                .orderByDesc(DataPreviewView::getUpdateTime)
                .orderByDesc(DataPreviewView::getId));
        return views.stream().map(this::toDataPreviewViewResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public DataPreviewViewResponse createDataPreviewView(User loginUser, DataPreviewViewRequest request) {
        validatePreviewViewRequest(loginUser, request, true);
        Date now = new Date();
        DataPreviewView view = new DataPreviewView();
        view.setUserId(loginUser.getId());
        view.setDatasourceId(request.getDatasourceId());
        view.setDatabaseName(request.getDatabase());
        view.setSchemaName(normalizePreviewViewSchema(request.getSchema()));
        view.setTableName(request.getTableName());
        view.setViewName(normalizePreviewViewName(request.getViewName()));
        view.setViewConfig(request.getViewConfig());
        view.setCreateTime(now);
        view.setUpdateTime(now);
        try {
            dataPreviewViewMapper.insert(view);
        } catch (DuplicateKeyException ex) {
            throw new ServiceException(Status.DATA_PREVIEW_VIEW_NAME_EXISTS);
        }
        return toDataPreviewViewResponse(view);
    }

    @Override
    @Transactional
    public DataPreviewViewResponse updateDataPreviewView(User loginUser, Integer id, DataPreviewViewRequest request) {
        if (id == null) {
            throw new ServiceException(Status.REQUEST_PARAMS_NOT_VALID_ERROR);
        }
        DataPreviewView view = getOwnedDataPreviewView(loginUser, id);
        validatePreviewViewScope(loginUser, view.getDatasourceId(), view.getDatabaseName(), view.getSchemaName(),
                view.getTableName());

        if (request != null && StringUtils.isNotBlank(request.getViewName())) {
            String viewName = normalizePreviewViewName(request.getViewName());
            ensurePreviewViewNameNotDuplicated(loginUser, view.getDatasourceId(), view.getDatabaseName(),
                    view.getSchemaName(), view.getTableName(), viewName, id);
            view.setViewName(viewName);
        }
        if (request != null && StringUtils.isNotBlank(request.getViewConfig())) {
            validatePreviewViewConfig(request.getViewConfig());
            view.setViewConfig(request.getViewConfig());
        }
        view.setUpdateTime(new Date());
        dataPreviewViewMapper.updateById(view);
        return toDataPreviewViewResponse(view);
    }

    @Override
    @Transactional
    public void deleteDataPreviewView(User loginUser, Integer id) {
        if (id == null) {
            throw new ServiceException(Status.REQUEST_PARAMS_NOT_VALID_ERROR);
        }
        DataPreviewView view = getOwnedDataPreviewView(loginUser, id);
        validatePreviewViewScope(loginUser, view.getDatasourceId(), view.getDatabaseName(), view.getSchemaName(),
                view.getTableName());
        dataPreviewViewMapper.deleteById(id);
    }

    /**
     * Controller 专用包装方法：当前 standalone 热更新环境里，新增到 DataSourceService 接口的方法会被旧的
     * Spring FastClass 代理命中导致 AbstractMethodError。这里用非接口方法承接数据预览个人视图入口，
     * 正式拆分独立 service 后可以移除。
     */
    public List<DataPreviewViewResponse> queryDataPreviewViewsFromController(User loginUser,
                                                                             Integer datasourceId,
                                                                             String database,
                                                                             String schema,
                                                                             String tableName) {
        return queryDataPreviewViews(loginUser, datasourceId, database, schema, tableName);
    }

    @Transactional
    public DataPreviewViewResponse createDataPreviewViewFromController(User loginUser, DataPreviewViewRequest request) {
        return createDataPreviewView(loginUser, request);
    }

    @Transactional
    public DataPreviewViewResponse updateDataPreviewViewFromController(User loginUser,
                                                                       Integer id,
                                                                       DataPreviewViewRequest request) {
        return updateDataPreviewView(loginUser, id, request);
    }

    @Transactional
    public void deleteDataPreviewViewFromController(User loginUser, Integer id) {
        deleteDataPreviewView(loginUser, id);
    }

    private void validatePreviewViewRequest(User loginUser, DataPreviewViewRequest request, boolean requireConfig) {
        if (request == null) {
            throw new ServiceException(Status.REQUEST_PARAMS_NOT_VALID_ERROR);
        }
        validatePreviewViewScope(loginUser, request.getDatasourceId(), request.getDatabase(), request.getSchema(),
                request.getTableName());
        String viewName = normalizePreviewViewName(request.getViewName());
        if (StringUtils.isBlank(viewName)) {
            throw new ServiceException(Status.DATA_PREVIEW_VIEW_NAME_INVALID);
        }
        if (StringUtils.length(viewName) > DATA_PREVIEW_MAX_VIEW_NAME_LENGTH) {
            throw new ServiceException(Status.DATA_PREVIEW_VIEW_NAME_INVALID);
        }
        if (requireConfig || StringUtils.isNotBlank(request.getViewConfig())) {
            validatePreviewViewConfig(request.getViewConfig());
        }
        ensurePreviewViewNameNotDuplicated(loginUser, request.getDatasourceId(), request.getDatabase(),
                normalizePreviewViewSchema(request.getSchema()), request.getTableName(), viewName, null);
    }

    private void validatePreviewViewScope(User loginUser,
                                          Integer datasourceId,
                                          String database,
                                          String schema,
                                          String tableName) {
        if (datasourceId == null || StringUtils.isBlank(database) || StringUtils.isBlank(tableName)) {
            throw new ServiceException(Status.REQUEST_PARAMS_NOT_VALID_ERROR);
        }
        validateIdentifier(database);
        validateIdentifier(tableName);
        if (StringUtils.isNotBlank(schema)) {
            validateIdentifier(schema);
        }
        DataSource dataSource = dataSourceMapper.selectById(datasourceId);
        if (dataSource == null) {
            throw new ServiceException(Status.RESOURCE_NOT_EXIST);
        }
        // 个人视图只保存当前用户的看表配置，权限仍然沿用数据源授权体系。
        if (!canOperatorPermissions(loginUser, new Object[]{datasourceId}, AuthorizationType.DATASOURCE,
                ApiFuncIdentificationConstant.DATASOURCE)) {
            throw new ServiceException(Status.USER_NO_OPERATION_PERM);
        }
    }

    private void validatePreviewViewConfig(String viewConfig) {
        if (StringUtils.isBlank(viewConfig)
                || StringUtils.length(viewConfig) > DATA_PREVIEW_MAX_VIEW_CONFIG_LENGTH) {
            throw new ServiceException(Status.DATA_PREVIEW_VIEW_CONFIG_INVALID);
        }
        try {
            JSONUtils.parseObject(viewConfig);
        } catch (Exception ex) {
            throw new ServiceException(Status.DATA_PREVIEW_VIEW_CONFIG_INVALID);
        }
    }

    private void ensurePreviewViewNameNotDuplicated(User loginUser,
                                                    Integer datasourceId,
                                                    String database,
                                                    String schema,
                                                    String tableName,
                                                    String viewName,
                                                    Integer excludeId) {
        QueryWrapper<DataPreviewView> wrapper = new QueryWrapper<>();
        wrapper.lambda()
                .eq(DataPreviewView::getUserId, loginUser.getId())
                .eq(DataPreviewView::getDatasourceId, datasourceId)
                .eq(DataPreviewView::getDatabaseName, database)
                .eq(DataPreviewView::getSchemaName, normalizePreviewViewSchema(schema))
                .eq(DataPreviewView::getTableName, tableName)
                .eq(DataPreviewView::getViewName, viewName);
        if (excludeId != null) {
            wrapper.lambda().ne(DataPreviewView::getId, excludeId);
        }
        if (dataPreviewViewMapper.selectCount(wrapper) > 0) {
            throw new ServiceException(Status.DATA_PREVIEW_VIEW_NAME_EXISTS);
        }
    }

    private DataPreviewView getOwnedDataPreviewView(User loginUser, Integer id) {
        DataPreviewView view = dataPreviewViewMapper.selectById(id);
        if (view == null || !loginUser.getId().equals(view.getUserId())) {
            throw new ServiceException(Status.RESOURCE_NOT_EXIST);
        }
        return view;
    }

    private String normalizePreviewViewName(String viewName) {
        return StringUtils.trimToEmpty(viewName);
    }

    private String normalizePreviewViewSchema(String schema) {
        return StringUtils.trimToEmpty(schema);
    }

    private DataPreviewViewResponse toDataPreviewViewResponse(DataPreviewView view) {
        DataPreviewViewResponse response = new DataPreviewViewResponse();
        response.setId(view.getId());
        response.setDatasourceId(view.getDatasourceId());
        response.setDatabase(view.getDatabaseName());
        response.setSchema(view.getSchemaName());
        response.setTableName(view.getTableName());
        response.setViewName(view.getViewName());
        response.setViewConfig(view.getViewConfig());
        response.setCreateTime(view.getCreateTime());
        response.setUpdateTime(view.getUpdateTime());
        return response;
    }

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
        if (StringUtils.isBlank(identifier) || !identifier.matches("[A-Za-z0-9_.$-]+")) {
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
        if (dbType == DbType.MYSQL) {
            return quoteIdentifier(dbType, request.getDatabase()) + "." + quoteIdentifier(dbType, request.getTableName());
        }
        if (StringUtils.isNotBlank(request.getSchema())) {
            return quoteIdentifier(dbType, request.getSchema()) + "." + quoteIdentifier(dbType, request.getTableName());
        }
        return quoteIdentifier(dbType, request.getTableName());
    }

    private String buildPreviewSql(DbType dbType,
                                   DataPreviewQueryRequest request,
                                   Set<String> allowedColumns,
                                   int pageNo,
                                   int pageSize) {
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT ");
        sql.append(allowedColumns.stream()
                .map(column -> quoteIdentifier(dbType, column))
                .collect(Collectors.joining(", ")));
        sql.append(" FROM ").append(buildPreviewTableName(dbType, request));
        appendPreviewWhere(sql, request, allowedColumns, dbType);
        appendPreviewOrderBy(sql, request, allowedColumns, dbType);
        sql.append(" LIMIT ").append(pageSize).append(" OFFSET ").append((pageNo - 1) * pageSize);
        return sql.toString();
    }

    private void appendPreviewWhere(StringBuilder sql,
                                    DataPreviewQueryRequest request,
                                    Set<String> allowedColumns,
                                    DbType dbType) {
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

    private void appendPreviewOrderBy(StringBuilder sql,
                                      DataPreviewQueryRequest request,
                                      Set<String> allowedColumns,
                                      DbType dbType) {
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

    private Object normalizePreviewCellValue(Object value) {
        if (!(value instanceof String)) {
            return value;
        }
        // 只对字符串结果做保守编码修复。数字、日期等类型保持 JDBC 原始值，
        // 避免影响前端排序展示和后续类型判断。
        return normalizeMetadataText((String) value);
    }

    private List<DatasourceColumnDto> getMysqlTableColumnMetas(Connection connection,
                                                               String database,
                                                               String tableName) throws SQLException {
        String sql = "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_COMMENT "
                + ", HEX(COLUMN_TYPE) AS COLUMN_TYPE_HEX, HEX(COLUMN_COMMENT) AS COLUMN_COMMENT_HEX "
                + "FROM information_schema.COLUMNS "
                + "WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? "
                + "ORDER BY ORDINAL_POSITION";
        List<DatasourceColumnDto> columnList = new ArrayList<>();
        try (PreparedStatement preparedStatement = connection.prepareStatement(sql)) {
            preparedStatement.setString(1, database);
            preparedStatement.setString(2, tableName);
            try (ResultSet resultSet = preparedStatement.executeQuery()) {
                while (resultSet.next()) {
                    String columnName = resultSet.getString("COLUMN_NAME");
                    // 优先按 information_schema 里的原始十六进制字节解码，
                    // 避免 JDBC 在元数据层提前按错误字符集转成乱码文本。
                    String typeName = decodeMysqlMetadataHex(
                            resultSet.getString("COLUMN_TYPE_HEX"),
                            resultSet.getString("COLUMN_TYPE"));
                    boolean nullable = StringUtils.equalsIgnoreCase(
                            resultSet.getString("IS_NULLABLE"),
                            "YES");
                    boolean primaryKey = StringUtils.equalsIgnoreCase(
                            resultSet.getString("COLUMN_KEY"),
                            "PRI");
                    String comment = decodeMysqlMetadataHex(
                            resultSet.getString("COLUMN_COMMENT_HEX"),
                            resultSet.getString("COLUMN_COMMENT"));
                    columnList.add(new DatasourceColumnDto(columnName, typeName, nullable, primaryKey, comment));
                }
            }
        }
        return columnList;
    }

    @Override
    public String createTableByColumns(DatasourceTableCreateRequest request) {
        String ddl = previewCreateTableSql(request);
        request.setDdl(ddl);
        return executeTableDdl(request);
    }

    @Override
    public String previewCreateTableSql(DatasourceTableCreateRequest request) {
        if (request == null
                || request.getDatasourceId() == null
                || StringUtils.isBlank(request.getDatabase())
                || StringUtils.isBlank(request.getTableName())
                || CollectionUtils.isEmpty(request.getColumns())) {
            throw new ServiceException(Status.REQUEST_PARAMS_NOT_VALID_ERROR);
        }

        DataSource dataSource = dataSourceMapper.selectById(request.getDatasourceId());
        if (dataSource == null) {
            throw new ServiceException(Status.QUERY_DATASOURCE_ERROR);
        }

        return buildCreateTableSql(dataSource.getType(), request, true);
    }

    @Override
    public String executeTableDdl(DatasourceTableCreateRequest request) {
        if (request == null
                || request.getDatasourceId() == null
                || StringUtils.isBlank(request.getDatabase())
                || StringUtils.isBlank(request.getTableName())
                || StringUtils.isBlank(request.getDdl())) {
            throw new ServiceException(Status.REQUEST_PARAMS_NOT_VALID_ERROR);
        }

        DataSource dataSource = dataSourceMapper.selectById(request.getDatasourceId());
        if (dataSource == null) {
            throw new ServiceException(Status.QUERY_DATASOURCE_ERROR);
        }

        BaseConnectionParam connectionParam =
                (BaseConnectionParam) DataSourceUtils.buildConnectionParams(
                        dataSource.getType(),
                        dataSource.getConnectionParams());
        if (connectionParam == null) {
            throw new ServiceException(Status.DATASOURCE_CONNECT_FAILED);
        }

        Connection connection = DataSourceUtils.getConnection(dataSource.getType(), connectionParam);
        Statement statement = null;
        try {
            if (connection == null) {
                throw new ServiceException(Status.DATASOURCE_CONNECT_FAILED);
            }
            if (tableAlreadyExists(connection, dataSource.getType(), request)) {
                // 目标表已经存在时，成熟产品通常不会把它当成连接失败，
                // 而是提示“已存在，可继续复用”，避免用户在复用目标表场景里被误导。
                return TARGET_TABLE_EXISTS_PREFIX + "\n" + request.getDdl().trim();
            }
            List<String> primaryKeyColumns = determinePrimaryKeyColumns(request);
            String ddl = request.getDdl().trim();
            statement = connection.createStatement();
            for (String sql : splitExecutableSqls(ddl)) {
                statement.execute(sql);
            }
            String primaryKeySql = ensurePrimaryKeyConstraint(connection, dataSource.getType(), request, primaryKeyColumns);
            if (StringUtils.isNotBlank(primaryKeySql)) {
                return ddl + ";\n" + primaryKeySql;
            }
            return ddl;
        } catch (ServiceException e) {
            throw e;
        } catch (Exception e) {
            log.error("Create target table error, datasourceId:{}, database:{}, table:{}.",
                    request.getDatasourceId(), request.getDatabase(), request.getTableName(), e);
            throw new ServiceException(resolveCreateTableFailureMessage(e));
        } finally {
            if (statement != null) {
                try {
                    statement.close();
                } catch (Exception e) {
                    log.error("Statement close error", e);
                }
            }
            releaseConnection(connection);
        }
    }

    private boolean tableAlreadyExists(Connection connection,
                                       DbType dbType,
                                       DatasourceTableCreateRequest request) throws SQLException {
        DatabaseMetaData metaData = connection.getMetaData();
        String catalog = null;
        String schemaPattern = null;

        if (dbType == DbType.MYSQL) {
            catalog = request.getDatabase();
        } else if (dbType == DbType.POSTGRESQL) {
            catalog = request.getDatabase();
            schemaPattern = StringUtils.defaultIfBlank(request.getSchema(), "public");
        }

        try (ResultSet resultSet = metaData.getTables(catalog, schemaPattern, request.getTableName(), TABLE_TYPES)) {
            return resultSet != null && resultSet.next();
        }
    }

    private String resolveCreateTableFailureMessage(Exception exception) {
        Throwable root = exception;
        while (root.getCause() != null && root.getCause() != root) {
            root = root.getCause();
        }
        String message = StringUtils.defaultIfBlank(root.getMessage(), exception.getMessage());
        if (StringUtils.isBlank(message)) {
            return "目标端建表失败，请检查目标库连接和建表语句。";
        }
        return "目标端建表失败：" + message;
    }

    @Override
    public List<ParamsOptions> getDatabases(Integer datasourceId) {

        DataSource dataSource = dataSourceMapper.selectById(datasourceId);

        if (dataSource == null) {
            throw new ServiceException(Status.QUERY_DATASOURCE_ERROR);
        }

        List<String> tableList;
        BaseConnectionParam connectionParam =
                (BaseConnectionParam) DataSourceUtils.buildConnectionParams(
                        dataSource.getType(),
                        dataSource.getConnectionParams());

        if (null == connectionParam) {
            throw new ServiceException(Status.DATASOURCE_CONNECT_FAILED);
        }

        Connection connection =
                DataSourceUtils.getConnection(dataSource.getType(), connectionParam);
        ResultSet rs = null;

        try {
            if (null == connection) {
                throw new ServiceException(Status.DATASOURCE_CONNECT_FAILED);
            }
            if (dataSource.getType() == DbType.POSTGRESQL) {
                rs = connection.createStatement().executeQuery(Constants.DATABASES_QUERY_PG);
            } else {
                rs = connection.createStatement().executeQuery(Constants.DATABASES_QUERY);
            }
            tableList = new ArrayList<>();
            while (rs.next()) {
                String name = rs.getString(1);
                tableList.add(name);
            }
        } catch (Exception e) {
            log.error("Get databases error, datasourceId:{}.", datasourceId, e);
            throw new ServiceException(Status.GET_DATASOURCE_TABLES_ERROR);
        } finally {
            closeResult(rs);
            releaseConnection(connection);
        }

        List<ParamsOptions> options = getParamsOptions(tableList);
        return options;
    }

    private List<ParamsOptions> getParamsOptions(List<String> columnList) {
        List<ParamsOptions> options = null;
        if (CollectionUtils.isNotEmpty(columnList)) {
            options = new ArrayList<>();

            for (String column : columnList) {
                ParamsOptions childrenOption =
                        new ParamsOptions(column, column, false);
                options.add(childrenOption);
            }
        }
        return options;
    }

    private String getDbSchemaPattern(DbType dbType, String schema, BaseConnectionParam connectionParam) {
        if (dbType == null) {
            return null;
        }
        String schemaPattern = null;
        switch (dbType) {
            case HIVE:
                schemaPattern = connectionParam.getDatabase();
                break;
            case ORACLE:
                schemaPattern = connectionParam.getUser();
                if (null != schemaPattern) {
                    schemaPattern = schemaPattern.toUpperCase();
                }
                break;
            case SQLSERVER:
                schemaPattern = "dbo";
                break;
            case CLICKHOUSE:
            case DATABEND:
            case POSTGRESQL:
            case PRESTO:
                if (!StringUtils.isEmpty(schema)) {
                    schemaPattern = schema;
                }
                break;
            default:
                break;
        }
        return schemaPattern;
    }

    private String buildCreateTableSql(DbType dbType, DatasourceTableCreateRequest request, boolean includePrimaryKey) {
        switch (dbType) {
            case MYSQL:
                return buildMysqlCreateTableSql(request, includePrimaryKey);
            case POSTGRESQL:
                return buildPostgresqlCreateTableSql(request, includePrimaryKey);
            default:
                throw new ServiceException("Unsupported create table datasource type: " + dbType);
        }
    }

    private String buildMysqlCreateTableSql(DatasourceTableCreateRequest request, boolean includePrimaryKey) {
        List<String> columnDefinitions = request.getColumns().stream()
                .map(column -> String.format(
                        "`%s` %s %s%s",
                        escapeMysqlIdentifier(column.getTargetColumn()),
                        column.getTargetType(),
                        Boolean.FALSE.equals(column.getNullable()) ? "NOT NULL" : "NULL",
                        StringUtils.isNotBlank(column.getTargetComment())
                                ? String.format(" COMMENT '%s'", escapeSqlComment(column.getTargetComment()))
                                : StringUtils.EMPTY))
                .collect(Collectors.toList());
        if (includePrimaryKey) {
            List<String> primaryKeyColumns = determinePrimaryKeyColumns(request);
            if (CollectionUtils.isNotEmpty(primaryKeyColumns)) {
                columnDefinitions.add(String.format(
                        "PRIMARY KEY (%s)",
                        primaryKeyColumns.stream()
                                .map(column -> String.format("`%s`", escapeMysqlIdentifier(column)))
                                .collect(Collectors.joining(", "))));
            }
        }
        return String.format(
                "CREATE TABLE IF NOT EXISTS `%s`.`%s` (%s)",
                escapeMysqlIdentifier(request.getDatabase()),
                escapeMysqlIdentifier(request.getTableName()),
                String.join(", ", columnDefinitions));
    }

    private String buildPostgresqlCreateTableSql(DatasourceTableCreateRequest request, boolean includePrimaryKey) {
        String schema = StringUtils.defaultIfBlank(request.getSchema(), "public");
        List<String> columnDefinitions = request.getColumns().stream()
                .map(column -> String.format(
                        "\"%s\" %s %s",
                        escapePostgresqlIdentifier(column.getTargetColumn()),
                        column.getTargetType(),
                        Boolean.FALSE.equals(column.getNullable()) ? "NOT NULL" : "NULL"))
                .collect(Collectors.toList());
        if (includePrimaryKey) {
            List<String> primaryKeyColumns = determinePrimaryKeyColumns(request);
            if (CollectionUtils.isNotEmpty(primaryKeyColumns)) {
                columnDefinitions.add(String.format(
                        "PRIMARY KEY (%s)",
                        primaryKeyColumns.stream()
                                .map(column -> String.format("\"%s\"", escapePostgresqlIdentifier(column)))
                                .collect(Collectors.joining(", "))));
            }
        }
        String createTableSql = String.format(
                "CREATE TABLE IF NOT EXISTS \"%s\".\"%s\" (%s)",
                escapePostgresqlIdentifier(schema),
                escapePostgresqlIdentifier(request.getTableName()),
                String.join(", ", columnDefinitions));
        List<String> commentStatements = request.getColumns().stream()
                .filter(column -> StringUtils.isNotBlank(column.getTargetComment()))
                .map(column -> String.format(
                        "COMMENT ON COLUMN \"%s\".\"%s\".\"%s\" IS '%s'",
                        escapePostgresqlIdentifier(schema),
                        escapePostgresqlIdentifier(request.getTableName()),
                        escapePostgresqlIdentifier(column.getTargetColumn()),
                        escapeSqlComment(column.getTargetComment())))
                .collect(Collectors.toList());
        if (CollectionUtils.isEmpty(commentStatements)) {
            return createTableSql;
        }
        commentStatements.add(0, createTableSql);
        return String.join(";\n", commentStatements);
    }

    private List<String> determinePrimaryKeyColumns(DatasourceTableCreateRequest request) {
        if (request == null || CollectionUtils.isEmpty(request.getColumns())) {
            return Collections.emptyList();
        }

        List<String> explicitPrimaryKeys = request.getColumns().stream()
                .filter(column -> Boolean.TRUE.equals(column.getPrimaryKey()))
                .map(DatasourceTableCreateRequest.ColumnDefinition::getTargetColumn)
                .filter(StringUtils::isNotBlank)
                .collect(Collectors.toList());
        if (CollectionUtils.isNotEmpty(explicitPrimaryKeys)) {
            return explicitPrimaryKeys;
        }

        List<String> exactCandidates = new ArrayList<>();
        Collections.addAll(exactCandidates, "id", "goods_id", "ajbh", "rybh");

        List<String> primaryKeyColumns = request.getColumns().stream()
                .map(DatasourceTableCreateRequest.ColumnDefinition::getTargetColumn)
                .filter(StringUtils::isNotBlank)
                .filter(column -> exactCandidates.stream().anyMatch(candidate -> candidate.equalsIgnoreCase(column)))
                .limit(1)
                .collect(Collectors.toList());

        if (CollectionUtils.isNotEmpty(primaryKeyColumns)) {
            return primaryKeyColumns;
        }

        return request.getColumns().stream()
                .map(DatasourceTableCreateRequest.ColumnDefinition::getTargetColumn)
                .filter(StringUtils::isNotBlank)
                .filter(column -> StringUtils.endsWithIgnoreCase(column, "_id")
                        || StringUtils.endsWithIgnoreCase(column, "id")
                        || StringUtils.endsWithIgnoreCase(column, "bh"))
                .limit(1)
                .collect(Collectors.toList());
    }

    private String ensurePrimaryKeyConstraint(Connection connection,
                                              DbType dbType,
                                              DatasourceTableCreateRequest request,
                                              List<String> primaryKeyColumns) throws SQLException {
        if (CollectionUtils.isEmpty(primaryKeyColumns) || hasPrimaryKey(connection, dbType, request)) {
            return StringUtils.EMPTY;
        }

        String primaryKeySql = buildAddPrimaryKeySql(dbType, request, primaryKeyColumns);
        try (Statement alterStatement = connection.createStatement()) {
            alterStatement.executeUpdate(primaryKeySql);
        }
        return primaryKeySql;
    }

    private boolean hasPrimaryKey(Connection connection,
                                  DbType dbType,
                                  DatasourceTableCreateRequest request) throws SQLException {
        DatabaseMetaData metaData = connection.getMetaData();
        String catalog = null;
        String schema = null;

        if (dbType == DbType.MYSQL) {
            catalog = request.getDatabase();
        } else if (dbType == DbType.POSTGRESQL) {
            catalog = request.getDatabase();
            schema = StringUtils.defaultIfBlank(request.getSchema(), "public");
        }

        try (ResultSet resultSet = metaData.getPrimaryKeys(catalog, schema, request.getTableName())) {
            return resultSet.next();
        }
    }

    private String buildAddPrimaryKeySql(DbType dbType,
                                         DatasourceTableCreateRequest request,
                                         List<String> primaryKeyColumns) {
        switch (dbType) {
            case MYSQL:
                return String.format(
                        "ALTER TABLE `%s`.`%s` ADD PRIMARY KEY (%s)",
                        escapeMysqlIdentifier(request.getDatabase()),
                        escapeMysqlIdentifier(request.getTableName()),
                        primaryKeyColumns.stream()
                                .map(column -> String.format("`%s`", escapeMysqlIdentifier(column)))
                                .collect(Collectors.joining(", ")));
            case POSTGRESQL:
                String schema = StringUtils.defaultIfBlank(request.getSchema(), "public");
                String constraintName = String.format("pk_%s", request.getTableName());
                return String.format(
                        "ALTER TABLE \"%s\".\"%s\" ADD CONSTRAINT \"%s\" PRIMARY KEY (%s)",
                        escapePostgresqlIdentifier(schema),
                        escapePostgresqlIdentifier(request.getTableName()),
                        escapePostgresqlIdentifier(constraintName),
                        primaryKeyColumns.stream()
                                .map(column -> String.format("\"%s\"", escapePostgresqlIdentifier(column)))
                                .collect(Collectors.joining(", ")));
            default:
                throw new ServiceException("Unsupported primary key datasource type: " + dbType);
        }
    }

    private String escapeMysqlIdentifier(String identifier) {
        return identifier.replace("`", "``");
    }

    private String escapePostgresqlIdentifier(String identifier) {
        return identifier.replace("\"", "\"\"");
    }

    private String escapeSqlComment(String value) {
        return value.replace("'", "''");
    }

    private String normalizeMetadataText(String rawValue) {
        if (StringUtils.isBlank(rawValue)) {
            return StringUtils.defaultString(rawValue);
        }
        String trimmedValue = rawValue.trim();
        if (containsHan(trimmedValue) && !trimmedValue.contains("\uFFFD")) {
            return trimmedValue;
        }

        // MySQL 元数据在不同驱动/字符集组合下，常见两类乱码链路：
        // 1. ISO-8859-1 误解码 UTF-8
        // 2. Windows-1252 误解码 UTF-8
        // 这里把原值和两种候选解码一起评分，优先保留中文更多、替换字符更少的结果。
        List<String> candidates = new ArrayList<>();
        candidates.add(trimmedValue);
        candidates.add(recodeWindows1252LikeText(trimmedValue));
        candidates.add(recodeMetadataText(trimmedValue, StandardCharsets.ISO_8859_1));
        return candidates.stream()
                .max((left, right) -> Integer.compare(scoreMetadataText(left), scoreMetadataText(right)))
                .orElse(trimmedValue);
    }

    private String recodeMetadataText(String value, Charset sourceCharset) {
        return new String(value.getBytes(sourceCharset), StandardCharsets.UTF_8);
    }

    private String recodeWindows1252LikeText(String value) {
        return new String(toWindows1252LikeBytes(value), StandardCharsets.UTF_8);
    }

    private String decodeMysqlMetadataHex(String hexValue, String fallbackValue) {
        if (StringUtils.isBlank(hexValue)) {
            return normalizeMetadataText(fallbackValue);
        }
        byte[] bytes = hexToBytes(hexValue);
        if (bytes.length == 0) {
            return normalizeMetadataText(fallbackValue);
        }
        return normalizeMetadataText(new String(bytes, StandardCharsets.UTF_8));
    }

    private byte[] hexToBytes(String hexValue) {
        if (StringUtils.isBlank(hexValue) || hexValue.length() % 2 != 0) {
            return new byte[0];
        }
        byte[] bytes = new byte[hexValue.length() / 2];
        for (int i = 0; i < hexValue.length(); i += 2) {
            int high = Character.digit(hexValue.charAt(i), 16);
            int low = Character.digit(hexValue.charAt(i + 1), 16);
            if (high < 0 || low < 0) {
                return new byte[0];
            }
            bytes[i / 2] = (byte) ((high << 4) + low);
        }
        return bytes;
    }

    private byte[] toWindows1252LikeBytes(String value) {
        byte[] bytes = new byte[value.length()];
        for (int i = 0; i < value.length(); i++) {
            bytes[i] = mapWindows1252LikeByte(value.charAt(i));
        }
        return bytes;
    }

    private byte mapWindows1252LikeByte(char ch) {
        if (ch <= 0x00FF) {
            return (byte) ch;
        }
        switch (ch) {
            case '\u20AC':
                return (byte) 0x80;
            case '\u201A':
                return (byte) 0x82;
            case '\u0192':
                return (byte) 0x83;
            case '\u201E':
                return (byte) 0x84;
            case '\u2026':
                return (byte) 0x85;
            case '\u2020':
                return (byte) 0x86;
            case '\u2021':
                return (byte) 0x87;
            case '\u02C6':
                return (byte) 0x88;
            case '\u2030':
                return (byte) 0x89;
            case '\u0160':
                return (byte) 0x8A;
            case '\u2039':
                return (byte) 0x8B;
            case '\u0152':
                return (byte) 0x8C;
            case '\u017D':
                return (byte) 0x8E;
            case '\u2018':
                return (byte) 0x91;
            case '\u2019':
                return (byte) 0x92;
            case '\u201C':
                return (byte) 0x93;
            case '\u201D':
                return (byte) 0x94;
            case '\u2022':
                return (byte) 0x95;
            case '\u2013':
                return (byte) 0x96;
            case '\u2014':
                return (byte) 0x97;
            case '\u02DC':
                return (byte) 0x98;
            case '\u2122':
                return (byte) 0x99;
            case '\u0161':
                return (byte) 0x9A;
            case '\u203A':
                return (byte) 0x9B;
            case '\u0153':
                return (byte) 0x9C;
            case '\u017E':
                return (byte) 0x9E;
            case '\u0178':
                return (byte) 0x9F;
            default:
                return (byte) '?';
        }
    }

    private int scoreMetadataText(String value) {
        if (StringUtils.isBlank(value)) {
            return Integer.MIN_VALUE;
        }
        int hanCount = (int) value.codePoints()
                .filter(codePoint -> Character.UnicodeScript.of(codePoint) == Character.UnicodeScript.HAN)
                .count();
        int replacementCount = (int) value.chars().filter(ch -> ch == '\uFFFD').count();
        int questionMarkCount = (int) value.chars().filter(ch -> ch == '?').count();
        // 对字段注释和枚举值来说，“大部分可读中文 + 少量替换字符”仍然比整段纯乱码更有价值，
        // 因此这里优先提升中文命中权重，再对替换字符和问号做扣分。
        return hanCount * 1000 - replacementCount * 200 - questionMarkCount * 100;
    }

    private boolean containsHan(String value) {
        return value.codePoints().anyMatch(codePoint ->
                Character.UnicodeScript.of(codePoint) == Character.UnicodeScript.HAN);
    }

    private List<String> splitExecutableSqls(String ddl) {
        if (StringUtils.isBlank(ddl)) {
            return Collections.emptyList();
        }
        Set<String> sqlSet = new LinkedHashSet<>();
        String[] sqlParts = ddl.split(";\\s*(?:\\r?\\n|$)");
        for (String sqlPart : sqlParts) {
            if (StringUtils.isNotBlank(sqlPart)) {
                sqlSet.add(sqlPart.trim());
            }
        }
        if (sqlSet.isEmpty()) {
            sqlSet.add(ddl.trim());
        }
        return new ArrayList<>(sqlSet);
    }

    private static void releaseConnection(Connection connection) {
        if (null != connection) {
            try {
                connection.close();
            } catch (Exception e) {
                log.error("Connection release error", e);
            }
        }
    }

    private static void closeResult(ResultSet rs) {
        if (rs != null) {
            try {
                rs.close();
            } catch (Exception e) {
                log.error("ResultSet close error", e);
            }
        }
    }

}
