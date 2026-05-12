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

import org.apache.dolphinscheduler.api.constants.ApiFuncIdentificationConstant;
import org.apache.dolphinscheduler.api.dto.DataPreviewViewRequest;
import org.apache.dolphinscheduler.api.dto.DataPreviewViewResponse;
import org.apache.dolphinscheduler.api.enums.Status;
import org.apache.dolphinscheduler.api.exceptions.ServiceException;
import org.apache.dolphinscheduler.api.service.impl.BaseServiceImpl;
import org.apache.dolphinscheduler.common.enums.AuthorizationType;
import org.apache.dolphinscheduler.common.utils.JSONUtils;
import org.apache.dolphinscheduler.dao.entity.DataPreviewView;
import org.apache.dolphinscheduler.dao.entity.DataSource;
import org.apache.dolphinscheduler.dao.entity.User;
import org.apache.dolphinscheduler.dao.mapper.DataPreviewViewMapper;
import org.apache.dolphinscheduler.dao.mapper.DataSourceMapper;

import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;

import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;

@Service
public class DataPreviewViewService extends BaseServiceImpl {

    private static final int MAX_VIEW_NAME_LENGTH = 64;

    private static final int MAX_VIEW_CONFIG_LENGTH = 20000;

    @Autowired
    private DataPreviewViewMapper dataPreviewViewMapper;

    @Autowired
    private DataSourceMapper dataSourceMapper;

    public List<DataPreviewViewResponse> queryViews(User loginUser,
                                                    Integer datasourceId,
                                                    String database,
                                                    String schema,
                                                    String tableName) {
        validateScope(loginUser, datasourceId, database, schema, tableName);
        String normalizedSchema = normalizeSchema(schema);
        List<DataPreviewView> views = dataPreviewViewMapper.selectList(new QueryWrapper<DataPreviewView>().lambda()
                .eq(DataPreviewView::getUserId, loginUser.getId())
                .eq(DataPreviewView::getDatasourceId, datasourceId)
                .eq(DataPreviewView::getDatabaseName, database)
                .eq(DataPreviewView::getSchemaName, normalizedSchema)
                .eq(DataPreviewView::getTableName, tableName)
                .orderByDesc(DataPreviewView::getUpdateTime)
                .orderByDesc(DataPreviewView::getId));
        return views.stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public DataPreviewViewResponse createView(User loginUser, DataPreviewViewRequest request) {
        validateRequest(loginUser, request, true);
        Date now = new Date();
        DataPreviewView view = new DataPreviewView();
        view.setUserId(loginUser.getId());
        view.setDatasourceId(request.getDatasourceId());
        view.setDatabaseName(request.getDatabase());
        view.setSchemaName(normalizeSchema(request.getSchema()));
        view.setTableName(request.getTableName());
        view.setViewName(normalizeViewName(request.getViewName()));
        view.setViewConfig(request.getViewConfig());
        view.setCreateTime(now);
        view.setUpdateTime(now);
        try {
            dataPreviewViewMapper.insert(view);
        } catch (DuplicateKeyException ex) {
            throw new ServiceException(Status.DATA_PREVIEW_VIEW_NAME_EXISTS);
        }
        return toResponse(view);
    }

    @Transactional
    public DataPreviewViewResponse updateView(User loginUser, Integer id, DataPreviewViewRequest request) {
        if (id == null || request == null) {
            throw new ServiceException(Status.REQUEST_PARAMS_NOT_VALID_ERROR);
        }
        DataPreviewView view = getOwnedView(loginUser, id);
        validateScope(loginUser, view.getDatasourceId(), view.getDatabaseName(), view.getSchemaName(),
                view.getTableName());
        if (StringUtils.isNotBlank(request.getViewName())) {
            String viewName = normalizeViewName(request.getViewName());
            validateViewName(viewName);
            ensureNameNotDuplicated(loginUser, view.getDatasourceId(), view.getDatabaseName(), view.getSchemaName(),
                    view.getTableName(), viewName, id);
            view.setViewName(viewName);
        }
        if (StringUtils.isNotBlank(request.getViewConfig())) {
            validateConfig(request.getViewConfig());
            view.setViewConfig(request.getViewConfig());
        }
        view.setUpdateTime(new Date());
        dataPreviewViewMapper.updateById(view);
        return toResponse(view);
    }

    @Transactional
    public void deleteView(User loginUser, Integer id) {
        if (id == null) {
            throw new ServiceException(Status.REQUEST_PARAMS_NOT_VALID_ERROR);
        }
        DataPreviewView view = getOwnedView(loginUser, id);
        validateScope(loginUser, view.getDatasourceId(), view.getDatabaseName(), view.getSchemaName(),
                view.getTableName());
        dataPreviewViewMapper.deleteById(id);
    }

    private void validateRequest(User loginUser, DataPreviewViewRequest request, boolean requireConfig) {
        if (request == null) {
            throw new ServiceException(Status.REQUEST_PARAMS_NOT_VALID_ERROR);
        }
        validateScope(loginUser, request.getDatasourceId(), request.getDatabase(), request.getSchema(),
                request.getTableName());
        String viewName = normalizeViewName(request.getViewName());
        validateViewName(viewName);
        if (requireConfig || StringUtils.isNotBlank(request.getViewConfig())) {
            validateConfig(request.getViewConfig());
        }
        ensureNameNotDuplicated(loginUser, request.getDatasourceId(), request.getDatabase(), normalizeSchema(
                request.getSchema()), request.getTableName(), viewName, null);
    }

    private void validateScope(User loginUser,
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
        // 个人视图只保存看表偏好；能否访问该表仍然复用 DolphinScheduler 原有数据源权限。
        if (!canOperatorPermissions(loginUser, new Object[]{datasourceId}, AuthorizationType.DATASOURCE,
                ApiFuncIdentificationConstant.DATASOURCE)) {
            throw new ServiceException(Status.USER_NO_OPERATION_PERM);
        }
    }

    private void validateViewName(String viewName) {
        if (StringUtils.isBlank(viewName) || StringUtils.length(viewName) > MAX_VIEW_NAME_LENGTH) {
            throw new ServiceException(Status.DATA_PREVIEW_VIEW_NAME_INVALID);
        }
    }

    private void validateConfig(String viewConfig) {
        if (StringUtils.isBlank(viewConfig) || StringUtils.length(viewConfig) > MAX_VIEW_CONFIG_LENGTH) {
            throw new ServiceException(Status.DATA_PREVIEW_VIEW_CONFIG_INVALID);
        }
        try {
            JSONUtils.parseObject(viewConfig);
        } catch (Exception ex) {
            throw new ServiceException(Status.DATA_PREVIEW_VIEW_CONFIG_INVALID);
        }
    }

    private void ensureNameNotDuplicated(User loginUser,
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
                .eq(DataPreviewView::getSchemaName, normalizeSchema(schema))
                .eq(DataPreviewView::getTableName, tableName)
                .eq(DataPreviewView::getViewName, viewName);
        if (excludeId != null) {
            wrapper.lambda().ne(DataPreviewView::getId, excludeId);
        }
        if (dataPreviewViewMapper.selectCount(wrapper) > 0) {
            throw new ServiceException(Status.DATA_PREVIEW_VIEW_NAME_EXISTS);
        }
    }

    private DataPreviewView getOwnedView(User loginUser, Integer id) {
        DataPreviewView view = dataPreviewViewMapper.selectById(id);
        if (view == null || !loginUser.getId().equals(view.getUserId())) {
            throw new ServiceException(Status.RESOURCE_NOT_EXIST);
        }
        return view;
    }

    private String normalizeViewName(String viewName) {
        return StringUtils.trimToEmpty(viewName);
    }

    private String normalizeSchema(String schema) {
        return StringUtils.trimToEmpty(schema);
    }

    private void validateIdentifier(String identifier) {
        if (StringUtils.isBlank(identifier) || !identifier.matches("[A-Za-z0-9_.$-]+")) {
            throw new ServiceException(Status.DATA_PREVIEW_QUERY_ERROR);
        }
    }

    private DataPreviewViewResponse toResponse(DataPreviewView view) {
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
}
