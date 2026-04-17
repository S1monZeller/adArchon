import { useDroppable } from '@dnd-kit/core';
import type { DashboardRunResponse } from '@/lib/api';
import { cn } from '@/lib/utils';
import { KanbanCard } from './KanbanCard';

interface KanbanColumnProps {
  status: string;
  label: string;
  colorClass: string;
  runs: DashboardRunResponse[];
  isInvalidDrop: boolean;
  onCancel: (runId: string) => void;
  onResume: (runId: string) => void;
  onAbandon: (runId: string) => void;
  onDelete: (runId: string) => void;
  onApprove: (runId: string) => void;
}

export function KanbanColumn({
  status,
  label,
  colorClass,
  runs,
  isInvalidDrop,
  onCancel,
  onResume,
  onAbandon,
  onDelete,
  onApprove,
}: KanbanColumnProps): React.ReactElement {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex flex-col w-64 shrink-0 h-full">
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between px-3 py-2 rounded-t-lg border-b border-border',
          status === 'paused' && 'border-warning/50 bg-warning/5'
        )}
      >
        <span className={cn('text-sm font-semibold', colorClass)}>{label}</span>
        <span className="text-xs text-text-tertiary bg-surface-elevated px-1.5 py-0.5 rounded-full">
          {String(runs.length)}
        </span>
      </div>
      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-col gap-2 flex-1 overflow-y-auto p-2 rounded-b-lg border border-t-0 border-border',
          isOver && isInvalidDrop && 'border-error/50 bg-error/5',
          isOver && !isInvalidDrop && 'border-primary/30 bg-primary/5'
        )}
      >
        {runs.map(run => (
          <KanbanCard
            key={run.id}
            run={run}
            onCancel={onCancel}
            onResume={onResume}
            onAbandon={onAbandon}
            onDelete={onDelete}
            onApprove={onApprove}
          />
        ))}
      </div>
    </div>
  );
}
