import { MediaBrowser } from '@/components/media-browser';
import { LimitedAccessBanner } from '@/components/permission-gate';
import { useTabBarInset } from '@/components/screen-header';
import { useMediaList } from '@/hooks/use-media';

export default function PhotosScreen() {
  const { items, loading, refreshing, done, loadMore, refresh } = useMediaList('image');
  const bottomInset = useTabBarInset();

  return (
    <MediaBrowser
      title="Photos"
      subtitle={loading ? undefined : `${items.length}${done ? '' : '+'} photos`}
      items={items}
      loading={loading}
      refreshing={refreshing}
      onRefresh={refresh}
      onEndReached={loadMore}
      headerChildren={<LimitedAccessBanner />}
      bottomInset={bottomInset}
      emptyTitle="No photos yet"
      emptyMessage="Photos you take or save on this device will show up here."
    />
  );
}
