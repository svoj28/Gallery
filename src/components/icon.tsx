import type { AndroidSymbol } from 'expo-symbols';
import { SymbolView } from 'expo-symbols';
import type { ColorValue } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

/** Each app icon maps to an SF Symbol on iOS and a Material Symbol on Android/web. */
const ICONS = {
  photo: ['photo.on.rectangle', 'photo'],
  video: ['play.rectangle', 'videocam'],
  album: ['rectangle.stack', 'photo_album'],
  folder: ['folder', 'folder'],
  heart: ['heart', 'favorite'],
  heartFill: ['heart.fill', 'favorite'],
  play: ['play.fill', 'play_arrow'],
  pause: ['pause.fill', 'pause'],
  back10: ['gobackward.10', 'replay_10'],
  forward10: ['goforward.10', 'forward_10'],
  next: ['forward.end.fill', 'skip_next'],
  previous: ['backward.end.fill', 'skip_previous'],
  volume: ['speaker.wave.2.fill', 'volume_up'],
  mute: ['speaker.slash.fill', 'volume_off'],
  fullscreen: ['arrow.up.left.and.arrow.down.right', 'fullscreen'],
  fit: ['aspectratio', 'aspect_ratio'],
  pip: ['pip.enter', 'picture_in_picture_alt'],
  loop: ['repeat', 'repeat'],
  lock: ['lock.fill', 'lock'],
  unlock: ['lock.open.fill', 'lock_open'],
  speed: ['speedometer', 'speed'],
  share: ['square.and.arrow.up', 'share'],
  trash: ['trash', 'delete'],
  info: ['info.circle', 'info'],
  add: ['plus', 'add'],
  addToAlbum: ['rectangle.stack.badge.plus', 'playlist_add'],
  close: ['xmark', 'close'],
  back: ['chevron.left', 'arrow_back'],
  chevronRight: ['chevron.right', 'chevron_right'],
  check: ['checkmark.circle.fill', 'check_circle'],
  unchecked: ['circle', 'radio_button_unchecked'],
  edit: ['pencil', 'edit'],
  remove: ['minus.circle', 'remove_circle'],
  more: ['ellipsis.circle', 'more_vert'],
} satisfies Record<string, [SFSymbol, AndroidSymbol]>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 24,
  color,
}: {
  name: IconName;
  size?: number;
  color: ColorValue;
}) {
  const [ios, android] = ICONS[name];
  return <SymbolView name={{ ios, android, web: android }} size={size} tintColor={color} />;
}
