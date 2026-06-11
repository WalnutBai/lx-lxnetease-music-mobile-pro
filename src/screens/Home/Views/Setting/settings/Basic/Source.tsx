import { memo, useCallback, useMemo, useRef, useState, useEffect } from 'react'

import { View, ScrollView, Animated, PanResponder, StyleSheet } from 'react-native'

import SubTitle from '../../components/SubTitle'
import CheckBox from '@/components/common/CheckBox'
import { createStyle } from '@/utils/tools'
import { setApiSource } from '@/core/apiSource'
import { useI18n } from '@/lang'
import apiSourceInfo from '@/utils/musicSdk/api-source-info'
import { useSettingValue } from '@/store/setting/hook'
import { useStatus, useUserApiList } from '@/store/userApi'
import Button from '../../components/Button'
import UserApiEditModal, { type UserApiEditModalType } from './UserApiEditModal'
import SourceTest from './SourceTest'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { Icon } from '@/components/common/Icon'
import { reorderUserApi } from '@/core/userApi'
import { state as userApiState } from '@/store/userApi'

const apiSourceList = apiSourceInfo.map((api) => ({
  id: api.id,
  name: api.name,
  disabled: api.disabled,
}))

const LONG_PRESS_MS = 350
const DRAG_CANCEL_THRESHOLD = 6

const useActive = (id: string) => {
  const activeLangId = useSettingValue('common.apiSource')
  const isActive = useMemo(() => activeLangId == id, [activeLangId, id])
  return isActive
}

// 内置源项组件（无拖拽）
const BuiltInItem = ({
  id,
  name,
  change,
}: {
  id: string
  name: string
  change: (id: string) => void
}) => {
  const isActive = useActive(id)
  const theme = useTheme()
  return (
    <CheckBox
      marginBottom={5}
      check={isActive}
      onChange={() => {
        change(id)
      }}
      need
    >
      <Text style={styles.sourceLabel}>
        {name}
      </Text>
    </CheckBox>
  )
}

interface UserApiItemProps {
  item: {
    id: string
    name: string
    desc?: string
    statusLabel?: string
  }
  index: number
  isChecked: boolean
  isDragging: boolean
  isDragSource: boolean
  translateY: Animated.Value
  scale: Animated.Value
  opacity: Animated.Value
  zIndex: number
  onLayoutHeight: (index: number, height: number) => void
  onLongPressStart: (index: number) => void
  onDragMove: (dy: number) => void
  onDragRelease: () => void
  onDragCancel: () => void
  onChange: (id: string) => void
  dragHandleHint: string
}

interface DragAnim {
  translateY: Animated.Value
  scale: Animated.Value
  opacity: Animated.Value
}

const createAnim = (): DragAnim => ({
  translateY: new Animated.Value(0),
  scale: new Animated.Value(1),
  opacity: new Animated.Value(1),
})

const UserApiItem = memo(({
  item,
  index,
  isChecked,
  isDragging,
  isDragSource,
  translateY,
  scale,
  opacity,
  zIndex,
  onLayoutHeight,
  onLongPressStart,
  onDragMove,
  onDragRelease,
  onDragCancel,
  onChange,
  dragHandleHint,
}: UserApiItemProps) => {
  const theme = useTheme()
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isActivatedRef = useRef(false)

  const clearLongPressTimer = () => {
    if (longPressTimer.current != null) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  useEffect(() => {
    return () => {
      clearLongPressTimer()
    }
  }, [])

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: (_e, gs) => {
          if (!isActivatedRef.current) return false
          return Math.abs(gs.dy) > 1 || Math.abs(gs.dx) > 1
        },
        onMoveShouldSetPanResponderCapture: (_e, gs) => {
          if (!isActivatedRef.current) return false
          return Math.abs(gs.dy) > 2
        },
        onPanResponderGrant: () => {
          clearLongPressTimer()
          isActivatedRef.current = false
          longPressTimer.current = setTimeout(() => {
            longPressTimer.current = null
            isActivatedRef.current = true
            onLongPressStart(index)
          }, LONG_PRESS_MS)
        },
        onPanResponderMove: (_e, gs) => {
          if (!isActivatedRef.current) {
            if (
              Math.abs(gs.dy) > DRAG_CANCEL_THRESHOLD ||
              Math.abs(gs.dx) > DRAG_CANCEL_THRESHOLD
            ) {
              clearLongPressTimer()
            }
            return
          }
          onDragMove(gs.dy)
        },
        onPanResponderRelease: () => {
          clearLongPressTimer()
          if (isActivatedRef.current) {
            isActivatedRef.current = false
            onDragRelease()
          }
        },
        onPanResponderTerminate: () => {
          clearLongPressTimer()
          if (isActivatedRef.current) {
            isActivatedRef.current = false
            onDragCancel()
          }
        },
        onPanResponderTerminationRequest: () => !isActivatedRef.current,
      }),
    [index, onLongPressStart, onDragMove, onDragRelease, onDragCancel]
  )

  const transform = isDragSource
    ? [{ translateY }, { scale }]
    : [{ translateY }]
  const elevation = isDragSource ? 8 : 0
  const shadowOpacity = isDragSource ? 0.25 : 0

  return (
    <Animated.View
      onLayout={(e) => onLayoutHeight(index, e.nativeEvent.layout.height)}
      style={[
        styles.userApiItem,
        {
          backgroundColor: isDragSource ? theme['c-primary-background-active'] : 'transparent',
          opacity,
          transform,
          zIndex,
          elevation,
          shadowOpacity,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 4,
        },
      ]}
    >
      <View style={styles.userApiItemInfo}>
        <View style={styles.dragHandle} {...panResponder.panHandlers}>
          <Icon name="menu" color={theme['c-font-label']} size={16} />
        </View>
        <Text style={[styles.userApiItemName, { color: theme['c-font'] }]}>
          {item.name}
          {item.desc ? (
            <Text style={styles.userApiItemDesc} color={theme['c-500']} size={13}>
              {' '}
              {item.desc}
            </Text>
          ) : null}
          {item.statusLabel ? (
            <Text style={styles.userApiItemStatus} size={13}>
              {' '}
              {item.statusLabel}
            </Text>
          ) : null}
        </Text>
        <CheckBox
          check={isChecked}
          label=""
          onChange={() => onChange(item.id)}
        />
      </View>
      {isDragSource ? (
        <Text size={11} color={theme['c-font-label']} style={styles.dragHint}>
          {dragHandleHint}
        </Text>
      ) : null}
    </Animated.View>
  )
})

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const subContainerOpacity = useSettingValue('theme.subContainerOpacity')
  const list = useMemo(
    () =>
      apiSourceList.map((s) => ({
        // @ts-expect-error
        name: t(`setting_basic_source_${s.id}`) || s.name,
        id: s.id,
      })),
    [t]
  )
  const setApiSourceId = useCallback((id: string) => {
    setApiSource(id)
  }, [])
  const userApiListRaw = useUserApiList()
  const apiStatus = useStatus()
  const apiSourceSetting = useSettingValue('common.apiSource')
  const userApiList = useMemo(() => {
    const getApiStatus = () => {
      let status
      if (apiStatus.status) status = t('setting_basic_source_status_success')
      else if (apiStatus.message == 'initing') status = t('setting_basic_source_status_initing')
      else status = t('setting_basic_source_status_failed')

      return status
    }
    return userApiListRaw.map((api) => {
      const statusLabel = api.id == apiSourceSetting ? `[${getApiStatus()}]` : ''
      return {
        id: api.id,
        name: api.name,
        label: `${api.name}${statusLabel}`,
        desc: [/^\d/.test(api.version) ? `v${api.version}` : api.version]
          .filter(Boolean)
          .join(', '),
        statusLabel,
      }
    })
  }, [userApiListRaw, apiStatus, apiSourceSetting, t])

  const modalRef = useRef<UserApiEditModalType>(null)
  const handleShow = () => {
    modalRef.current?.show()
  }

  // 拖拽排序状态
  const heightsRef = useRef<number[]>([])
  const animsRef = useRef<DragAnim[]>([])
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const draggingIndexRef = useRef<number | null>(null)
  const targetIndexRef = useRef<number | null>(null)
  const lastTargetRef = useRef<number | null>(null)

  // 同步动画值数组长度与列表长度
  if (animsRef.current.length !== userApiList.length) {
    if (animsRef.current.length < userApiList.length) {
      for (let i = animsRef.current.length; i < userApiList.length; i++) {
        animsRef.current.push(createAnim())
      }
    } else {
      animsRef.current.length = userApiList.length
    }
    heightsRef.current.length = userApiList.length
  }

  const handleLayoutHeight = useCallback((index: number, height: number) => {
    heightsRef.current[index] = height
  }, [])

  const resetAllAnims = useCallback(() => {
    for (const anim of animsRef.current) {
      anim.translateY.stopAnimation()
      anim.scale.stopAnimation()
      anim.opacity.stopAnimation()
      anim.translateY.setValue(0)
      anim.scale.setValue(1)
      anim.opacity.setValue(1)
    }
  }, [])

  const handleLongPressStart = useCallback((index: number) => {
    draggingIndexRef.current = index
    targetIndexRef.current = index
    lastTargetRef.current = index
    setDraggingIndex(index)
    const anim = animsRef.current[index]
    if (!anim) return
    Animated.parallel([
      Animated.spring(anim.scale, { toValue: 1.03, useNativeDriver: true, friction: 7 }),
      Animated.timing(anim.opacity, { toValue: 0.92, duration: 120, useNativeDriver: true }),
    ]).start()
  }, [])

  const computeTargetIndex = useCallback((from: number, dy: number) => {
    const heights = heightsRef.current
    const n = heights.length
    if (n === 0) return from

    const cumulative: number[] = []
    let acc = 0
    for (let i = 0; i < n; i++) {
      cumulative.push(acc)
      acc += heights[i] ?? 0
    }
    const draggedHeight = heights[from] ?? 0
    const originalTop = cumulative[from] ?? 0
    const newCenter = originalTop + dy + draggedHeight / 2

    let target = from
    let minDist = Infinity
    for (let i = 0; i < n; i++) {
      const itemCenter = (cumulative[i] ?? 0) + (heights[i] ?? 0) / 2
      const dist = Math.abs(itemCenter - newCenter)
      if (dist < minDist) {
        minDist = dist
        target = i
      }
    }
    return target
  }, [])

  const animateLayout = useCallback((from: number, to: number) => {
    const heights = heightsRef.current
    const draggedHeight = heights[from] ?? 0
    for (let i = 0; i < animsRef.current.length; i++) {
      if (i === from) continue
      const anim = animsRef.current[i]
      let target = 0
      if (from < to) {
        if (i > from && i <= to) target = -draggedHeight
      } else if (from > to) {
        if (i >= to && i < from) target = draggedHeight
      }
      Animated.spring(anim.translateY, {
        toValue: target,
        useNativeDriver: true,
        friction: 9,
        tension: 70,
      }).start()
    }
  }, [])

  const handleDragMove = useCallback(
    (dy: number) => {
      const from = draggingIndexRef.current
      if (from == null) return
      const anim = animsRef.current[from]
      if (anim) anim.translateY.setValue(dy)
      const target = computeTargetIndex(from, dy)
      targetIndexRef.current = target
      if (target !== lastTargetRef.current) {
        lastTargetRef.current = target
        animateLayout(from, target)
      }
    },
    [computeTargetIndex, animateLayout]
  )

  const persistReorder = useCallback((from: number, to: number) => {
    if (from === to) return
    const next = [...userApiState.list]
    const [moved] = next.splice(from, 1)
    if (!moved) return
    next.splice(to, 0, moved)
    void reorderUserApi(next)
  }, [])

  const handleDragRelease = useCallback(() => {
    const from = draggingIndexRef.current
    const to = targetIndexRef.current ?? from
    draggingIndexRef.current = null
    targetIndexRef.current = null
    lastTargetRef.current = null
    setDraggingIndex(null)
    if (from == null) return
    resetAllAnims()
    if (to != null && to !== from) {
      persistReorder(from, to)
    }
  }, [persistReorder, resetAllAnims])

  const handleDragCancel = useCallback(() => {
    draggingIndexRef.current = null
    targetIndexRef.current = null
    lastTargetRef.current = null
    setDraggingIndex(null)
    resetAllAnims()
  }, [resetAllAnims])

  const reorderHint = t('setting_basic_source_user_api_reorder_tip')

  return (
    <SubTitle title={t('setting_basic_source')} collapsible sectionId="setting_basic_source_user_api">
      <View style={styles.list}>
        {list.map(({ id, name }) => (
          <BuiltInItem name={name} id={id} key={id} change={setApiSourceId} />
        ))}
      </View>
      {userApiList.length > 0 && (
        <View style={{ ...styles.userApiContainer, backgroundColor: `rgba(255, 255, 255, ${subContainerOpacity / 100})` }}>
          <ScrollView
            style={styles.userApiScrollView}
            keyboardShouldPersistTaps={'always'}
            scrollEnabled={draggingIndex == null}
          >
            <View style={styles.userApiList}>
              {userApiList.map((item, idx) => {
                const anim = animsRef.current[idx] ?? createAnim()
                const isDragSource = draggingIndex === idx
                return (
                  <UserApiItem
                    key={item.id}
                    item={item}
                    index={idx}
                    isChecked={apiSourceSetting === item.id}
                    isDragging={draggingIndex != null}
                    isDragSource={isDragSource}
                    translateY={anim.translateY}
                    scale={anim.scale}
                    opacity={anim.opacity}
                    zIndex={isDragSource ? 10 : 1}
                    onLayoutHeight={handleLayoutHeight}
                    onLongPressStart={handleLongPressStart}
                    onDragMove={handleDragMove}
                    onDragRelease={handleDragRelease}
                    onDragCancel={handleDragCancel}
                    onChange={setApiSourceId}
                    dragHandleHint={reorderHint}
                  />
                )
              })}
            </View>
          </ScrollView>
        </View>
      )}
      <View style={styles.btn}>
        <Button onPress={handleShow}>{t('setting_basic_source_user_api_btn')}</Button>
      </View>
      <SourceTest />
      <UserApiEditModal ref={modalRef} />
    </SubTitle>
  )
})

const styles = createStyle({
  list: {
    flexGrow: 0,
    flexShrink: 1,
  },
  userApiContainer: {
    marginTop: 10,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  userApiScrollView: {
    flexGrow: 0,
  },
  userApiList: {
    overflow: 'hidden',
  },
  userApiItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
    borderRadius: 8,
  },
  userApiItemInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userApiItemName: {
    fontSize: 16,
    flex: 1,
    paddingLeft: 10,
  },
  userApiItemDesc: {},
  userApiItemStatus: {},
  dragHandle: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHint: {
    marginTop: 2,
    textAlign: 'center',
  },
  btn: {
    marginTop: 10,
    flexDirection: 'row',
  },
  sourceLabel: {},
})