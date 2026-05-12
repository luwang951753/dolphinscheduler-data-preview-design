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
  computed,
  defineComponent,
  getCurrentInstance,
  h,
  onMounted,
  PropType,
  ref,
  toRefs,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton,
  NDatePicker,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NInputGroup,
  NList,
  NListItem,
  NPopover,
  NRadio,
  NRadioGroup,
  NSelect,
  NSpace,
  NThing
} from 'naive-ui'
import { ArrowDownOutlined, ArrowUpOutlined } from '@vicons/antd'
import Modal from '@/components/modal'
import Crontab from '@/components/crontab'
import { timezoneList } from '@/common/timezone'
import { queryProjectPreferenceByProjectCode } from '@/service/modules/projects-preference'
import { useForm } from '@/views/projects/workflow/definition/components/use-form'
import { useI18n as useVueI18n } from 'vue-i18n'
import { queryAllEnvironmentList } from '@/service/modules/environment'
import { listAlertGroupById } from '@/service/modules/alert-group'
import { queryTenantList } from '@/service/modules/tenants'
import { queryWorkerGroupsByProjectCode } from '@/service/modules/projects-worker-group'
import { previewSchedule, createSchedule, updateSchedule } from '@/service/modules/schedules'
import { parseTime } from '@/common/common'
import { format } from 'date-fns'

const props = {
  row: {
    type: Object,
    default: {}
  },
  show: {
    type: Boolean as PropType<boolean>,
    default: false
  },
  type: {
    type: String as PropType<'create' | 'update'>,
    default: 'create'
  },
  state: {
    type: String as PropType<string>,
    default: 'OFFLINE'
  },
  projectCode: {
    type: Number as PropType<number | null>,
    default: null
  }
}

export default defineComponent({
  name: 'syncTaskTimingModal',
  props,
  emits: ['update:show', 'update:row', 'updateList'],
  setup(props, ctx) {
    const crontabRef = ref()
    const parallelismRef = ref(false)
    const { t } = useI18n()
    const { timingState } = useForm()
    const projectPreferences = ref({} as any)
    const trim = getCurrentInstance()?.appContext.config.globalProperties.trim

    const variables = ref({
      workerGroups: [] as Array<{ label: string; value: string }>,
      tenantList: [] as Array<{ label: string; value: string }>,
      alertGroups: [] as Array<{ label: string; value: number }>,
      environmentList: [] as Array<{
        label: string
        value: string | number
        workerGroups: string[]
      }>,
      schedulePreviewList: [] as string[]
    })

    const resolveProjectCode = () => {
      const projectCode = Number(props.projectCode)
      return Number.isFinite(projectCode) && projectCode > 0 ? projectCode : null
    }

    const ensureProjectCode = () => {
      const projectCode = resolveProjectCode()
      if (!projectCode) {
        window.$message.error('请先选择要落入的 DolphinScheduler 项目。')
        return null
      }
      return projectCode
    }

    const environmentOptions = computed(() =>
      variables.value.environmentList.filter((item) =>
        item.workerGroups?.includes(timingState.timingForm.workerGroup)
      )
    )

    const initProjectPreferences = (projectCode: number) => {
      queryProjectPreferenceByProjectCode(projectCode).then((result: any) => {
        if (result?.preferences && result.state === 1) {
          projectPreferences.value = JSON.parse(result.preferences)
        }
      })
    }

    const containValueInOptions = (
      options: Array<any>,
      findingValue: string | number
    ): boolean => {
      for (const { value } of options) {
        if (findingValue === value) {
          return true
        }
      }
      return false
    }

    // 这里复用官方定时弹框的默认偏好注入方式，但作用域只限同步任务页。
    const restructureTimingForm = (timingForm: any) => {
      if (projectPreferences.value?.taskPriority) {
        timingForm.workflowInstancePriority =
          projectPreferences.value.taskPriority
      }
      if (projectPreferences.value?.warningType) {
        timingForm.warningType = projectPreferences.value.warningType
      }
      if (projectPreferences.value?.workerGroup) {
        if (
          containValueInOptions(
            variables.value.workerGroups,
            projectPreferences.value.workerGroup
          )
        ) {
          timingForm.workerGroup = projectPreferences.value.workerGroup
        }
      }
      if (projectPreferences.value?.tenant) {
        if (
          containValueInOptions(
            variables.value.tenantList,
            projectPreferences.value.tenant
          )
        ) {
          timingForm.tenantCode = projectPreferences.value.tenant
        }
      }
      if (
        projectPreferences.value?.environmentCode &&
        variables.value.environmentList
      ) {
        if (
          containValueInOptions(
            variables.value.environmentList,
            projectPreferences.value.environmentCode
          )
        ) {
          timingForm.environmentCode = projectPreferences.value.environmentCode
        }
      }
      if (projectPreferences.value?.alertGroup && variables.value.alertGroups) {
        if (
          containValueInOptions(
            variables.value.alertGroups,
            projectPreferences.value.alertGroup
          )
        ) {
          timingForm.warningGroupId = projectPreferences.value.alertGroup
        }
      }
    }

    const getWorkerGroups = async () => {
      const projectCode = ensureProjectCode()
      if (!projectCode) return
      const res: any = await queryWorkerGroupsByProjectCode(projectCode)
      variables.value.workerGroups = res.data.map((item: any) => ({
        label: item.workerGroup,
        value: item.workerGroup
      }))
    }

    const getTenantList = async () => {
      const res: any = await queryTenantList()
      variables.value.tenantList = res.map((item: any) => ({
        label: item.tenantCode,
        value: item.tenantCode
      }))
    }

    const getAlertGroups = async () => {
      const res: any = await listAlertGroupById()
      variables.value.alertGroups = res.map((item: any) => ({
        label: item.groupName,
        value: item.id
      }))
    }

    const getEnvironmentList = async () => {
      const res: any = await queryAllEnvironmentList()
      variables.value.environmentList = res.map((item: any) => ({
        label: item.name,
        value: item.code,
        workerGroups: item.workerGroups
      }))
    }

    const initEnvironment = () => {
      timingState.timingForm.environmentCode = null
      variables.value.environmentList.forEach((item) => {
        if (props.row.environmentCode === item.value) {
          timingState.timingForm.environmentCode = String(item.value)
        }
      })
    }

    const initWarningGroup = () => {
      timingState.timingForm.warningGroupId = null
      variables.value.alertGroups.forEach((item) => {
        if (props.row.warningGroupId === item.value) {
          timingState.timingForm.warningGroupId = item.value
        }
      })
    }

    const updateWorkerGroup = () => {
      timingState.timingForm.environmentCode = null
    }

    const buildSchedulePayload = () => {
      const start = format(
        new Date(timingState.timingForm.startEndTime[0]),
        'yyyy-MM-dd HH:mm:ss'
      )
      const end = format(
        new Date(timingState.timingForm.startEndTime[1]),
        'yyyy-MM-dd HH:mm:ss'
      )
      return {
        schedule: JSON.stringify({
          startTime: start,
          endTime: end,
          crontab: timingState.timingForm.crontab,
          timezoneId: timingState.timingForm.timezoneId
        }),
        failureStrategy: timingState.timingForm.failureStrategy,
        warningType: timingState.timingForm.warningType,
        workflowInstancePriority:
          timingState.timingForm.workflowInstancePriority,
        warningGroupId: timingState.timingForm.warningGroupId
          ? timingState.timingForm.warningGroupId
          : 0,
        workerGroup: timingState.timingForm.workerGroup,
        tenantCode: timingState.timingForm.tenantCode,
        environmentCode: timingState.timingForm.environmentCode
      }
    }

    const handlePreview = () => {
      const projectCode = ensureProjectCode()
      if (!projectCode) return
      timingState.timingFormRef.validate(async (valid: any) => {
        if (!valid) {
          const previewPayload = buildSchedulePayload()
          const res = await previewSchedule(
            {
              schedule: previewPayload.schedule
            },
            projectCode
          )
          variables.value.schedulePreviewList = res
        }
      })
    }

    const handleTiming = async () => {
      const projectCode = ensureProjectCode()
      if (!projectCode) return
      await timingState.timingFormRef.validate()
      if (timingState.saving) return
      timingState.saving = true
      try {
        const data: any = buildSchedulePayload()
        if (props.type === 'create') {
          data.workflowDefinitionCode = props.row.code
          await createSchedule(data, projectCode)
        } else {
          data.id = props.row.id
          await updateSchedule(data, projectCode, props.row.id)
        }
        window.$message.success(t('project.workflow.success'))
        timingState.saving = false
        ctx.emit('updateList')
        ctx.emit('update:show')
      } catch (err) {
        timingState.saving = false
      }
    }

    const hideModal = () => {
      ctx.emit('update:show')
    }

    const priorityOptions = [
      {
        value: 'HIGHEST',
        label: 'HIGHEST',
        color: '#ff0000',
        icon: ArrowUpOutlined
      },
      {
        value: 'HIGH',
        label: 'HIGH',
        color: '#ff0000',
        icon: ArrowUpOutlined
      },
      {
        value: 'MEDIUM',
        label: 'MEDIUM',
        color: '#EA7D24',
        icon: ArrowUpOutlined
      },
      {
        value: 'LOW',
        label: 'LOW',
        color: '#2A8734',
        icon: ArrowDownOutlined
      },
      {
        value: 'LOWEST',
        label: 'LOWEST',
        color: '#2A8734',
        icon: ArrowDownOutlined
      }
    ]

    const timezoneOptions = () =>
      timezoneList.map((item) => ({ label: item, value: item }))

    const renderLabel = (option: any) => {
      return [
        h(
          NIcon,
          {
            style: {
              verticalAlign: 'middle',
              marginRight: '4px',
              marginBottom: '3px'
            },
            color: option.color
          },
          {
            default: () => h(option.icon)
          }
        ),
        option.label
      ]
    }

    const bootstrap = async () => {
      const projectCode = resolveProjectCode()
      if (!projectCode) return
      await Promise.all([
        getWorkerGroups(),
        getTenantList(),
        getAlertGroups(),
        getEnvironmentList()
      ])
      initProjectPreferences(projectCode)
    }

    onMounted(() => {
      bootstrap()
    })

    watch(
      () => props.projectCode,
      () => {
        bootstrap()
      }
    )

    watch(
      () => props.row,
      () => {
        if (!props.row.crontab) {
          restructureTimingForm(timingState.timingForm)
          return
        }
        timingState.timingForm.startEndTime = [
          new Date(props.row.startTime),
          new Date(props.row.endTime)
        ]
        timingState.timingForm.crontab = props.row.crontab
        timingState.timingForm.timezoneId = props.row.timezoneId
        timingState.timingForm.failureStrategy = props.row.failureStrategy
        timingState.timingForm.warningType = props.row.warningType
        timingState.timingForm.workflowInstancePriority =
          props.row.workflowInstancePriority
        timingState.timingForm.workerGroup = props.row.workerGroup
        timingState.timingForm.tenantCode = props.row.tenantCode
        initWarningGroup()
        initEnvironment()
      },
      { immediate: true }
    )

    return {
      t,
      crontabRef,
      parallelismRef,
      priorityOptions,
      environmentOptions,
      hideModal,
      handleTiming,
      timezoneOptions,
      renderLabel,
      updateWorkerGroup,
      handlePreview,
      trim,
      ...toRefs(variables.value),
      ...toRefs(timingState),
      ...toRefs(props)
    }
  },

  render() {
    const { t } = this

    return (
      <Modal
        show={this.show}
        title={t('project.workflow.set_parameters_before_timing')}
        onCancel={this.hideModal}
        onConfirm={this.handleTiming}
        confirmLoading={this.saving}
        confirmDisabled={this.$props.state === 'ONLINE'}
      >
        <NForm
          ref='timingFormRef'
          rules={this.rules}
          disabled={this.$props.state === 'ONLINE'}
        >
          <NFormItem
            label={t('project.workflow.start_and_stop_time')}
            path='startEndTime'
          >
            <NDatePicker
              type='datetimerange'
              clearable
              v-model:value={this.timingForm.startEndTime}
            />
          </NFormItem>
          <NFormItem label={t('project.workflow.timing')} path='crontab'>
            <NInputGroup>
              <NPopover
                trigger='click'
                showArrow={false}
                placement='bottom'
                style={{ width: '500px' }}
              >
                {{
                  trigger: () => (
                    <NInput
                      allowInput={this.trim}
                      style={{ width: '80%' }}
                      readonly={true}
                      v-model:value={this.timingForm.crontab}
                    ></NInput>
                  ),
                  default: () => (
                    <Crontab v-model:value={this.timingForm.crontab} />
                  )
                }}
              </NPopover>
              <NButton type='primary' ghost onClick={this.handlePreview}>
                {t('project.workflow.execute_time')}
              </NButton>
            </NInputGroup>
          </NFormItem>
          <NFormItem
            label={t('project.workflow.timezone')}
            path='timezoneId'
            showFeedback={false}
          >
            <NSelect
              v-model:value={this.timingForm.timezoneId}
              options={this.timezoneOptions()}
              filterable
            />
          </NFormItem>
          <NFormItem label=' ' showFeedback={false}>
            <NList>
              {this.schedulePreviewList.length > 0 ? (
                <NListItem>
                  <NThing
                    description={t(
                      'project.workflow.next_five_execution_times'
                    )}
                  >
                    {this.schedulePreviewList.map((item: string) => (
                      <NSpace>
                        {item}
                        <br />
                      </NSpace>
                    ))}
                  </NThing>
                </NListItem>
              ) : null}
            </NList>
          </NFormItem>
          <NFormItem
            label={t('project.workflow.failure_strategy')}
            path='failureStrategy'
          >
            <NRadioGroup v-model:value={this.timingForm.failureStrategy}>
              <NSpace>
                <NRadio value='CONTINUE'>
                  {t('project.workflow.continue')}
                </NRadio>
                <NRadio value='END'>{t('project.workflow.end')}</NRadio>
              </NSpace>
            </NRadioGroup>
          </NFormItem>
          <NFormItem
            label={t('project.workflow.notification_strategy')}
            path='warningType'
          >
            <NSelect
              options={[
                {
                  value: 'NONE',
                  label: t('project.workflow.none_send')
                },
                {
                  value: 'SUCCESS',
                  label: t('project.workflow.success_send')
                },
                {
                  value: 'FAILURE',
                  label: t('project.workflow.failure_send')
                },
                {
                  value: 'ALL',
                  label: t('project.workflow.all_send')
                }
              ]}
              v-model:value={this.timingForm.warningType}
            />
          </NFormItem>
          {this.timingForm.warningType !== 'NONE' && (
            <NFormItem
              label={t('project.workflow.alarm_group')}
              path='warningGroupId'
              required
            >
              <NSelect
                options={this.alertGroups}
                placeholder={t('project.workflow.please_choose')}
                v-model:value={this.timingForm.warningGroupId}
                clearable
                filterable
              />
            </NFormItem>
          )}
          <NFormItem
            label={t('project.workflow.workflow_priority')}
            path='workflowInstancePriority'
          >
            <NSelect
              options={this.priorityOptions}
              renderLabel={this.renderLabel}
              v-model:value={this.timingForm.workflowInstancePriority}
            />
          </NFormItem>
          <NFormItem
            label={t('project.workflow.worker_group')}
            path='workerGroup'
          >
            <NSelect
              options={this.workerGroups}
              onUpdateValue={this.updateWorkerGroup}
              v-model:value={this.timingForm.workerGroup}
              filterable
            />
          </NFormItem>
          <NFormItem
            label={t('project.workflow.tenant_code')}
            path='tenantCode'
          >
            <NSelect
              options={this.tenantList}
              v-model:value={this.timingForm.tenantCode}
              filterable
            />
          </NFormItem>
          <NFormItem
            label={t('project.workflow.environment_name')}
            path='environmentCode'
          >
            <NSelect
              options={this.environmentOptions}
              v-model:value={this.timingForm.environmentCode}
              clearable
              filterable
            />
          </NFormItem>
        </NForm>
      </Modal>
    )
  }
})
