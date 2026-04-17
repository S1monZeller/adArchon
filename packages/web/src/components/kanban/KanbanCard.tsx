import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { FileText, XCircle, PlayCircle, Ban, Trash2, CheckCircle, Pause } from 'lucide-react';
import type { DashboardRunResponse } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/lib/format';
import { useWorkflowStore } from '@/stores/workflow-store';

interface KanbanCardProps {
  run: DashboardRunResponse;
  onCancel: (runId: string) => void;
  onResume: (runId: string) => void;
  onAbandon: (runId: string) => void;
  onDelete: (runId: string) => void;
}

export function KanbanCard({
  run,
  onCancel,
  onResume,
  onAbandon,
  onDelete,
}: KanbanCardProps): React.ReactElement {
  const navigate = useNavigate();
  const liveState = useWorkflowStore(state => state.workflows.get(run.id));
  const [elapsed, setElapsed] = useState(() => formatDuration(run.started_at, run.completed_at));

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: run.id,
    data: { status: run.status },
  });

  useEffect(() => {
    if (run.status !== 'running' && run.status !== 'paused') return;
    const interval = setInterval(() => {
      setElapsed(formatDuration(run.started_at, null));
    }, 1000);
    return (): void => {
      clearInterval(interval);
    };
  }, [run.status, run.started_at]);

  const dagNodes = liveState?.dagNodes ?? [];
  const completedCount = dagNodes.filter(n => n.status === 'completed').length;
  const totalNodes = dagNodes.length || run.total_steps || 0;
  const isStale = liveState?.stale === true;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        'rounded-lg border border-border bg-surface p-3 space-y-2 cursor-grab active:cursor-grabbing select-none',
        isDragging && 'opacity-50 shadow-lg z-50',
        isStale && 'opacity-60'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'h-2 w-2 shrink-0 rounded-full',
            run.status === 'running' && 'bg-primary animate-pulse',
            run.status === 'paused' && 'bg-warning animate-pulse',
            run.status === 'pending' && 'bg-text-tertiary',
            run.status === 'completed' && 'bg-success',
            run.status === 'failed' && 'bg-error',
            run.status === 'cancelled' && 'bg-text-tertiary'
          )}
        />
        <span className="font-medium text-xs text-text-primary truncate flex-1">
          {run.workflow_name}
        </span>
        {isStale && (
          <span className="text-[9px] rounded-full bg-warning/10 text-warning px-1.5 py-0.5">
            stale
          </span>
        )}
      </div>

      {/* Meta */}
      <div className="flex items-center gap-2 text-[11px] text-text-secondary">
        <span className="truncate">{run.codebase_name ?? 'Unknown'}</span>
        <span className="text-text-tertiary shrink-0">{elapsed}</span>
      </div>

      {/* Progress for running */}
      {run.status === 'running' && totalNodes > 0 && (
        <div className="text-[11px] text-text-secondary">
          {String(completedCount)}/{String(totalNodes)} nodes
        </div>
      )}

      {/* Approval message for paused */}
      {run.status === 'paused' && liveState?.approval && (
        <div className="rounded bg-warning/5 border border-warning/20 px-2 py-1.5 flex items-start gap-1.5">
          <Pause className="h-3 w-3 text-warning shrink-0 mt-0.5" />
          <p className="text-[11px] text-text-secondary line-clamp-2">
            {liveState.approval.message}
          </p>
        </div>
      )}

      {/* Actions */}
      <div
        className="flex items-center gap-1 pt-1"
        onPointerDown={(e): void => {
          e.stopPropagation();
        }}
      >
        <button
          onClick={(): void => {
            navigate(`/workflows/runs/${run.id}`);
          }}
          className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-text-secondary hover:bg-surface-elevated hover:text-text-primary transition-colors"
        >
          <FileText className="h-3 w-3" />
          Logs
        </button>
        <div className="ml-auto flex items-center gap-0.5">
          {run.status === 'failed' && (
            <button
              onClick={(): void => {
                onResume(run.id);
              }}
              className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-primary/80 hover:bg-primary/10 hover:text-primary transition-colors"
            >
              <PlayCircle className="h-3 w-3" />
            </button>
          )}
          {run.status === 'running' && (
            <button
              onClick={(): void => {
                onAbandon(run.id);
              }}
              className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-warning/80 hover:bg-warning/10 hover:text-warning transition-colors"
            >
              <Ban className="h-3 w-3" />
            </button>
          )}
          {(run.status === 'running' || run.status === 'pending') && (
            <button
              onClick={(): void => {
                onCancel(run.id);
              }}
              className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-error/80 hover:bg-error/10 hover:text-error transition-colors"
            >
              <XCircle className="h-3 w-3" />
            </button>
          )}
          {run.status === 'paused' && (
            <button
              onClick={(): void => {
                // Approve via drag — button is for quick approve without comment
                onResume(run.id);
              }}
              className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-success/80 hover:bg-success/10 hover:text-success transition-colors"
            >
              <CheckCircle className="h-3 w-3" />
            </button>
          )}
          {run.status !== 'running' && run.status !== 'pending' && (
            <button
              onClick={(): void => {
                onDelete(run.id);
              }}
              className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-text-tertiary hover:bg-error/10 hover:text-error transition-colors"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
