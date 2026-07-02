import {memo, useState, useRef, useMemo, useEffect, useCallback} from 'react'
import { View, AppState, Animated, PanResponder } from 'react-native'

import Header, { HEADER_HEIGHT } from './components/Header'
import Player from './Player'
import PagerView, { type PagerViewOnPageSelectedEvent } from 'react-native-pager-view'
import Pic from './Pic'
import Lyric from './Lyric'
import SongInfo from './components/SongInfo'
import MiniLyric from '../components/MiniLyric'
import { screenkeepAwake, screenUnkeepAwake } from '@/utils/nativeModules/utils'
import commonState, { type InitState as CommonState } from '@/store/common/state'
import { createStyle } from '@/utils/tools'
import { useWindowSize } from '@/utils/hooks'
import { useSettingValue } from '@/store/setting/hook'
import { playNext, playPrev } from '@/core/player/player'
import PlayerPlaylist, { type PlayerPlaylistType } from '@/components/player/PlayerPlaylist.tsx'
import { scaleSizeW } from '@/utils/pixelRatio'

const LyricPage = ({ activeIndex }: { activeIndex: number }) => {
  const initedRef = useRef(false)
  const lyric = useMemo(() => <Lyric />, [])
  switch (activeIndex) {
    case 1:
      if (!initedRef.current) initedRef.current = true
      return lyric
    default:
      return initedRef.current ? lyric : null
  }
}

const VerticalNew = memo(({ componentId }: { componentId: string }) => {
  const [pageIndex, setPageIndex] = useState(0)
  const pagerViewRef = useRef<PagerView>(null);
  const showLyricRef = useRef(false)
  const playlistRef = useRef<PlayerPlaylistType>(null)
  const { height: winHeight } = useWindowSize()
  const isEnableSlideSwitchSong = useSettingValue('player.isEnableSlideSwitchSong')
  const miniLyricAlign = useSettingValue('playDetail.style.miniLyricAlign')

  const maxCoverHeight = useMemo(() => {
    const availableHeight = winHeight - HEADER_HEIGHT
    return Math.round(availableHeight * 0.38)
  }, [winHeight])

  const slideOffset = useRef(new Animated.Value(0)).current;
  const maxSlide = winHeight * 0.5;
  const slideThreshold = winHeight * 0.12;
  const velocityThreshold = 800;
  const isAnimating = useRef(false);

  const isEnableSlideSwitchSongRef = useRef(isEnableSlideSwitchSong)
  const pageIndexRef = useRef(pageIndex)
  useEffect(() => {
    isEnableSlideSwitchSongRef.current = isEnableSlideSwitchSong
  }, [isEnableSlideSwitchSong])
  useEffect(() => {
    pageIndexRef.current = pageIndex
  }, [pageIndex])

  const resetSlide = useCallback(() => {
    Animated.spring(slideOffset, {
      toValue: 0,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start();
  }, [slideOffset]);

  const animateOut = useCallback((direction: 'up' | 'down') => {
    if (isAnimating.current) return
    isAnimating.current = true
    const toValue = direction === 'up' ? -winHeight : winHeight;
    Animated.timing(slideOffset, {
      toValue,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      slideOffset.setValue(0);
      isAnimating.current = false
    });
  }, [slideOffset, winHeight]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (!isEnableSlideSwitchSongRef.current || pageIndexRef.current !== 0) return false;
          const { dy, dx } = gestureState;
          return Math.abs(dy) > 15 && Math.abs(dy) > Math.abs(dx) * 1.2;
        },
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          if (!isEnableSlideSwitchSongRef.current || pageIndexRef.current !== 0) return false;
          const { dy, dx } = gestureState;
          return Math.abs(dy) > 20 && Math.abs(dy) > Math.abs(dx) * 1.5;
        },
        onPanResponderMove: (_, gestureState) => {
          const { dy } = gestureState;
          const dampening = dy > 0 ? 0.6 : 0.8;
          const dampedDy = dy * dampening;
          const clampedDy = Math.max(-maxSlide, Math.min(maxSlide, dampedDy));
          slideOffset.setValue(clampedDy);
        },
        onPanResponderRelease: (_, gestureState) => {
          const { dy, vy } = gestureState;
          const shouldPlayNext = dy < -slideThreshold || vy < -velocityThreshold / 1000;
          const shouldPlayPrev = dy > slideThreshold || vy > velocityThreshold / 1000;

          if (shouldPlayNext) {
            animateOut('up');
            setTimeout(() => void playNext(), 150);
          } else if (shouldPlayPrev) {
            animateOut('down');
            setTimeout(() => void playPrev(), 150);
          } else {
            resetSlide();
          }
        },
        onPanResponderTerminate: () => {
          resetSlide();
        },
        onPanResponderTerminationRequest: () => {
          return false;
        },
      }),
    [maxSlide, slideThreshold, velocityThreshold, slideOffset, animateOut, resetSlide]
  );

  const slideStyle = useMemo(() => {
    const scale = slideOffset.interpolate({
      inputRange: [-maxSlide, 0, maxSlide],
      outputRange: [0.92, 1, 0.92],
    });
    const opacity = slideOffset.interpolate({
      inputRange: [-maxSlide, -maxSlide * 0.3, 0, maxSlide * 0.3, maxSlide],
      outputRange: [0.7, 0.9, 1, 0.9, 0.7],
    });
    return {
      transform: [
        { translateY: slideOffset },
        { scale },
      ],
      opacity,
    };
  }, [slideOffset, maxSlide]);

  const onPageSelected = ({ nativeEvent }: PagerViewOnPageSelectedEvent) => {
    setPageIndex(nativeEvent.position)
    showLyricRef.current = nativeEvent.position === 1
    if (showLyricRef.current) {
      screenkeepAwake()
    } else {
      screenUnkeepAwake()
    }
  }

  const handleSwitchToLyricPage = useCallback(() => {
    pagerViewRef.current?.setPage(1);
  }, []);

  useEffect(() => {
    let appstateListener = AppState.addEventListener('change', (state) => {
      switch (state) {
        case 'active':
          if (showLyricRef.current && !commonState.componentIds.comment) screenkeepAwake()
          break
        case 'background':
          screenUnkeepAwake()
          break
      }
    })

    const handleComponentIdsChange = (ids: CommonState['componentIds']) => {
      if (ids.comment) screenUnkeepAwake()
      else if (AppState.currentState === 'active') screenkeepAwake()
    }

    global.state_event.on('componentIdsUpdated', handleComponentIdsChange)
    global.app_event.on('switchToLyricPage', handleSwitchToLyricPage)
    global.app_event.on('showPlaylist', () => { playlistRef.current?.show() })

    return () => {
      global.state_event.off('componentIdsUpdated', handleComponentIdsChange)
      global.app_event.off('switchToLyricPage', handleSwitchToLyricPage)
      global.app_event.off('showPlaylist', () => { playlistRef.current?.show() })
      appstateListener.remove()
      screenUnkeepAwake()
    }
  }, [])

  const containerPaddingH = useMemo(() => scaleSizeW(10), [])

  return (
    <>
      <Header isNewUI={true} pageIndex={pageIndex} />
      <View style={styles.container} {...panResponder.panHandlers}>
        <PagerView
          onPageSelected={onPageSelected}
          style={styles.pagerView}
          ref={pagerViewRef}
        >
          <View collapsable={false} style={styles.pageContainer}>
            <Animated.View collapsable={false} style={[styles.picPageContainerNew, slideStyle, { paddingTop: containerPaddingH }]}>
              <View style={styles.picContainer}>
                <Pic componentId={componentId} maxCoverHeight={maxCoverHeight} />
              </View>
              <View style={[styles.infoContainer, { paddingHorizontal: containerPaddingH, marginTop: containerPaddingH }]}>
                <SongInfo />
                <MiniLyric
                  onPress={handleSwitchToLyricPage}
                  style={[styles.miniLyricContainerNew, styles[`miniLyricAlign${miniLyricAlign.charAt(0).toUpperCase() + miniLyricAlign.slice(1)}`]]}
                />
              </View>
            </Animated.View>
            {pageIndex === 0 && <Player componentId={componentId} isNewUI={true} />}
          </View>
          <View collapsable={false}>
            <LyricPage activeIndex={pageIndex} />
          </View>
        </PagerView>
      </View>
      <PlayerPlaylist ref={playlistRef} />
    </>
  )
})

export default VerticalNew

const styles = createStyle({
  container: {
    flex: 1,
    flexDirection: 'column',
  },
  pagerView: {
    flex: 1,
  },
  pageContainer: {
    flex: 1,
    flexDirection: 'column',
    position: 'relative',
  },
  picPageContainerNew: {
    flex: 1,
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
  },
  picContainer: {
    alignItems: 'center',
    flexShrink: 0,
  },
  infoContainer: {
    flex: 0,
    flexShrink: 0,
  },
  miniLyricContainerNew: {
    paddingHorizontal: 10,
  },
  miniLyricAlignLeft: {
    alignItems: 'flex-start',
  },
  miniLyricAlignCenter: {
    alignItems: 'center',
  },
  miniLyricAlignRight: {
    alignItems: 'flex-end',
  },
})
