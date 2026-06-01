import { memo, useMemo, useEffect, useRef, useCallback } from 'react'
import {
  View,
  FlatList,
  type FlatListProps,
  type LayoutChangeEvent,
} from 'react-native'
import { type Line, useLrcPlay, useLrcSet } from '@/plugins/lyric'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { AnimatedColorText } from '@/components/common/Text'
import { setSpText } from '@/utils/pixelRatio'

type FlatListType = FlatListProps<Line>

interface LineProps {
  line: Line
  lineNum: number
  activeLine: number
  onLayout: (lineNum: number, height: number, width: number) => void
}

const LrcLine = memo(({ line, lineNum, activeLine, onLayout }: LineProps) => {
  const theme = useTheme()
  const lrcFontSize = useSettingValue('playDetail.landscapeImmersion.style.lrcFontSize')
  const size = lrcFontSize / 10
  const lineHeight = setSpText(size) * 1.3

  const colors = useMemo(() => {
    const active = activeLine == lineNum
    return active
      ? (['#fff', '#fff', 1] as const)
      : (['rgba(255, 255, 255, 0.6)', 'rgba(255, 255, 255, 0.4)', 0.8] as const)
  }, [activeLine, lineNum])

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    onLayout(lineNum, nativeEvent.layout.height, nativeEvent.layout.width)
  }

  return (
    <View style={styles.line} onLayout={handleLayout}>
      <AnimatedColorText
        color={colors[0]}
        opacity={colors[2]}
        size={size}
        style={{ ...styles.lineText, lineHeight }}
      >
        {line.text}
      </AnimatedColorText>
      {line.extendedLyrics.map((lrc, index) => (
        <AnimatedColorText
          key={index}
          color={colors[0]}
          opacity={colors[2]}
          size={size * 0.8}
          style={{ ...styles.lineTranslationText, lineHeight: lineHeight * 0.8 }}
        >
          {lrc}
        </AnimatedColorText>
      ))}
    </View>
  )
})

export default memo(() => {
  const lyricLines = useLrcSet()
  const { line, playedLines } = useLrcPlay()
  const flatListRef = useRef<FlatList<Line>>(null)
  const isPauseScrollRef = useRef(false)
  const scrollTimoutRef = useRef<NodeJS.Timeout | null>(null)
  const listLayoutInfoRef = useRef<{ lineHeights: number[], spaceHeight: number }>({
    lineHeights: [],
    spaceHeight: 0,
  })
  const lineRef = useRef({ line: 0, prevLine: 0 })
  const scrollCancelRef = useRef<(() => void) | null>(null)

  const handleScrollToActive = useCallback((index = lineRef.current.line) => {
    if (index < 0 || !flatListRef.current || lyricLines.length <= index) return
    try {
      flatListRef.current.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.5,
      })
    } catch (e) {
      // ignore
    }
  }, [lyricLines.length])

  useEffect(() => {
    listLayoutInfoRef.current.lineHeights = []
    lineRef.current.prevLine = 0
    lineRef.current.line = 0
    if (!flatListRef.current) return
    flatListRef.current.scrollToOffset({ offset: 0, animated: false })
    if (!lyricLines.length) return
    setTimeout(() => handleScrollToActive(), 100)
  }, [lyricLines, handleScrollToActive])

  useEffect(() => {
    if (line < 0) return
    lineRef.current.prevLine = lineRef.current.line
    lineRef.current.line = line
    if (!flatListRef.current || isPauseScrollRef.current) return
    handleScrollToActive()
  }, [line, playedLines, handleScrollToActive])

  const handleLineLayout = useCallback((lineNum: number, height: number) => {
    listLayoutInfoRef.current.lineHeights[lineNum] = height
  }, [])

  const handleSpaceLayout = useCallback(({ nativeEvent }: LayoutChangeEvent) => {
    listLayoutInfoRef.current.spaceHeight = nativeEvent.layout.height
  }, [])

  const renderItem: FlatListType['renderItem'] = ({ item, index }) => (
    <LrcLine line={item} lineNum={index} activeLine={line} onLayout={handleLineLayout} />
  )
  const getkey: FlatListType['keyExtractor'] = (item, index) => `${index}${item.text}`

  return (
    <View style={styles.container}>
      <FlatList
        data={lyricLines}
        renderItem={renderItem}
        keyExtractor={getkey}
        style={{ flex: 1 }}
        ref={flatListRef}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<View style={styles.space} onLayout={handleSpaceLayout} />}
        ListFooterComponent={<View style={styles.space} />}
        onScrollBeginDrag={() => { isPauseScrollRef.current = true }}
        onScrollEndDrag={() => {
          if (scrollTimoutRef.current) clearTimeout(scrollTimoutRef.current)
          scrollTimoutRef.current = setTimeout(() => {
            isPauseScrollRef.current = false
            handleScrollToActive()
          }, 3000)
        }}
        fadingEdgeLength={100}
        initialNumToRender={20}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => handleScrollToActive(info.index), 100)
        }}
      />
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
    paddingLeft: 20,
    paddingRight: 20,
  },
  space: {
    height: '50%',
  },
  line: {
    paddingTop: 10,
    paddingBottom: 10,
  },
  lineText: {
    textAlign: 'center',
  },
  lineTranslationText: {
    textAlign: 'center',
    paddingTop: 5,
  },
})
