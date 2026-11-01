import AppTabs from '@/components/app-tabs';
import { PermissionGate } from '@/components/permission-gate';
import { useLibrarySync } from '@/hooks/use-media';

export default function TabsLayout() {
  return (
    <PermissionGate>
      <SyncedTabs />
    </PermissionGate>
  );
}

function SyncedTabs() {
  useLibrarySync(true);
  return <AppTabs />;
}
